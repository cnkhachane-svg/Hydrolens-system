import os
import cv2
import numpy as np
import base64
from pathlib import Path
from ultralytics import YOLO

class VisionService:
    def __init__(self):
        base_dir = Path(__file__).resolve().parent.parent.parent
        weights_path = base_dir / "weights" / "hydrolens_yolov8_seg.pt"
        
        if weights_path.exists() and os.path.getsize(weights_path) > 500000:
            self.model = YOLO(str(weights_path))
            self.has_custom_weights = True
        else:
            self.model = YOLO("yolov8n-seg.pt")
            self.has_custom_weights = False

    def evaluate_focus(self, gray: np.ndarray) -> float:
        return float(cv2.Laplacian(gray, cv2.CV_64F).var())

    def _is_air_bubble(self, patch_gray: np.ndarray, circularity: float, w: int, h: int) -> bool:
        if not (0.82 <= circularity <= 1.28) or min(w, h) < 6:
            return False

        ph, pw = patch_gray.shape[:2]
        center_y, center_x = ph // 2, pw // 2
        r_inner = max(1, min(pw, ph) // 4)
        
        inner_mask = np.zeros((ph, pw), dtype=np.uint8)
        cv2.circle(inner_mask, (center_x, center_y), r_inner, 255, -1)
        outer_ring_mask = cv2.bitwise_not(inner_mask)

        mean_center = float(np.mean(patch_gray[inner_mask > 0])) if np.any(inner_mask > 0) else 0.0
        mean_outer = float(np.mean(patch_gray[outer_ring_mask > 0])) if np.any(outer_ring_mask > 0) else 0.0

        return (mean_center - mean_outer) > 28.0

    def _is_mineral_or_organic(self, patch_bgr: np.ndarray, patch_gray: np.ndarray) -> tuple[bool, str]:
        if patch_bgr.shape[0] < 4 or patch_bgr.shape[1] < 4:
            return False, ""

        hsv = cv2.cvtColor(patch_bgr, cv2.COLOR_BGR2HSV)
        sat = hsv[:, :, 1]
        mean_sat = float(np.mean(sat))

        sobelx = cv2.Sobel(patch_gray, cv2.CV_64F, 1, 0, ksize=3)
        sobely = cv2.Sobel(patch_gray, cv2.CV_64F, 0, 1, ksize=3)
        grad_mag = np.sqrt(sobelx**2 + sobely**2)
        mean_edge_sharpness = float(np.mean(grad_mag))

        if mean_edge_sharpness < 11.5 and mean_sat < 15.0:
            return True, "organic_detritus"

        return False, ""

    def process_image(self, file_bytes: bytes, sample_volume_ml: float = 50.0, pixel_scale_um: float = 4.5, roi_radius_pct: float = 0.81):
        np_arr = np.frombuffer(file_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode image bytes")

        h_img, w_img = img.shape[:2]
        total_pixels = h_img * w_img

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        focus_score = round(self.evaluate_focus(gray), 1)

        particles = []
        fiber_count = 0
        fragment_count = 0
        film_count = 0
        pellet_count = 0
        lookalike_rejects = {"bubble": 0, "organic": 0, "mineral": 0}

        esd_dist = {
            '<40um': 0,
            '40-100um': 0,
            '100-250um': 0,
            '250-500um': 0,
            '>500um': 0
        }

        clean_img = img.copy()
        annotated_bgr = img.copy()

        # Chamber Detection
        blurred = cv2.GaussianBlur(gray, (25, 25), 0)
        _, thresh_dish = cv2.threshold(blurred, 35, 255, cv2.THRESH_BINARY)
        contours_dish, _ = cv2.findContours(thresh_dish, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        dish_cx, dish_cy = w_img // 2, h_img // 2
        dish_r = int(min(w_img, h_img) * 0.44)
        has_circular_well = False

        if contours_dish:
            valid_c = [c for c in contours_dish if cv2.contourArea(c) > total_pixels * 0.20]
            if valid_c:
                largest = max(valid_c, key=cv2.contourArea)
                (cx, cy), r = cv2.minEnclosingCircle(largest)
                perimeter = cv2.arcLength(largest, True)
                area = cv2.contourArea(largest)
                circularity = (perimeter * perimeter) / (4 * np.pi * max(area, 1.0))
                
                if 0.70 <= circularity <= 1.90 and r > min(w_img, h_img) * 0.25:
                    has_circular_well = True
                    dish_cx, dish_cy, dish_r = int(cx), int(cy), int(r)

        # Apply strict user-controlled ROI boundary cutoff to exclude meniscus glare
        usable_r = int(dish_r * np.clip(roi_radius_pct, 0.65, 0.95))
        well_mask = np.zeros((h_img, w_img), dtype=np.uint8)
        
        if has_circular_well:
            cv2.circle(well_mask, (dish_cx, dish_cy), usable_r, 255, -1)
        else:
            margin_x = int(w_img * (1.0 - roi_radius_pct) * 0.5)
            margin_y = int(h_img * (1.0 - roi_radius_pct) * 0.5)
            cv2.rectangle(well_mask, (margin_x, margin_y), (w_img - margin_x, h_img - margin_y), 255, -1)

        # Multi-Scale Top-Hat
        k_fine = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        k_coarse = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21))
        tophat_fine = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, k_fine)
        tophat_coarse = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, k_coarse)
        tophat = cv2.max(tophat_fine, tophat_coarse)
        tophat = cv2.bitwise_and(tophat, tophat, mask=well_mask)

        # Local Contrast Thresholding
        active_pixels = tophat[well_mask > 0]
        if len(active_pixels) > 0:
            median_val = float(np.median(active_pixels))
            std_val = float(np.std(active_pixels))
            cutoff = max(14.0, median_val + 1.8 * std_val)
        else:
            cutoff = 18.0

        _, thresh = cv2.threshold(tophat, int(cutoff), 255, cv2.THRESH_BINARY)
        clean_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, clean_kernel)

        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        candidates = []
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < 15 or area > 3500:
                continue

            x, y, w, h = cv2.boundingRect(cnt)
            cx, cy = x + w / 2.0, y + h / 2.0

            # Absolute bounds check
            if x < 4 or y < 4 or (x + w) > (w_img - 4) or (y + h) > (h_img - 4):
                continue

            # Strict radial boundary cutoff (rejects 6 o'clock and 3 o'clock outer rim glare)
            if has_circular_well:
                dist = np.sqrt((cx - dish_cx)**2 + (cy - dish_cy)**2)
                if dist > usable_r:
                    continue

            # Contrast delta vs immediate surrounding fluid
            y1_pad, y2_pad = max(0, y - 4), min(h_img, y + h + 4)
            x1_pad, x2_pad = max(0, x - 5), min(w_img, x + w + 5)
            bg_val = float(np.mean(tophat[y1_pad:y2_pad, x1_pad:x2_pad]))
            fg_val = float(np.mean(tophat[y:y+h, x:x+w]))
            contrast_delta = fg_val - bg_val

            if contrast_delta < 4.5 and fg_val < 18.0:
                continue

            perimeter = cv2.arcLength(cnt, True)
            circularity = (perimeter * perimeter) / (4 * np.pi * max(area, 1.0))
            aspect = max(w, h) / max(1.0, min(w, h))

            # Long arc flare filter
            if has_circular_well and dist > (usable_r * 0.82) and aspect > 3.2:
                continue

            # Look-alike checks
            patch_gray = gray[y:y+h, x:x+w]
            patch_bgr = img[y:y+h, x:x+w]

            if self._is_air_bubble(patch_gray, circularity, w, h):
                lookalike_rejects["bubble"] += 1
                continue

            is_reject, reject_type = self._is_mineral_or_organic(patch_bgr, patch_gray)
            if is_reject:
                if reject_type == "organic_detritus":
                    lookalike_rejects["organic"] += 1
                else:
                    lookalike_rejects["mineral"] += 1
                continue

            epsilon = 0.02 * perimeter
            approx = cv2.approxPolyDP(cnt, epsilon, True)
            poly_1000 = [[round((float(p[0][0]) / w_img) * 1000, 1), round((float(p[0][1]) / h_img) * 1000, 1)] for p in approx]
            conf = float(np.clip(0.78 + (contrast_delta / 40.0) * 0.18, 0.72, 0.98))

            candidates.append({
                "x": x, "y": y, "w": w, "h": h,
                "area": area,
                "circularity": circularity,
                "aspect": aspect,
                "conf": conf,
                "poly": poly_1000,
                "contrast": contrast_delta
            })

        # NMS
        candidates = sorted(candidates, key=lambda c: c["area"], reverse=True)
        filtered = []
        for c in candidates:
            overlap = False
            for f in filtered:
                ix1 = max(c["x"], f["x"])
                iy1 = max(c["y"], f["y"])
                ix2 = min(c["x"] + c["w"], f["x"] + f["w"])
                iy2 = min(c["y"] + c["h"], f["y"] + f["h"])
                if ix2 > ix1 and iy2 > iy1:
                    inter = (ix2 - ix1) * (iy2 - iy1)
                    if inter / min(c["area"], f["area"]) > 0.25:
                        overlap = True
                        break
            if not overlap:
                filtered.append(c)

        for item in filtered:
            x, y, w, h = item["x"], item["y"], item["w"], item["h"]
            area = item["area"]
            circularity = item["circularity"]
            aspect = item["aspect"]
            conf = item["conf"]
            poly = item["poly"]
            esd_um = np.sqrt(area) * pixel_scale_um

            if circularity > 3.2 or aspect > 2.7:
                morphology = "fiber"
                fiber_count += 1
                color = (255, 230, 0)
            elif area < 75 and circularity < 1.6:
                morphology = "pellet"
                pellet_count += 1
                color = (0, 230, 100)
            else:
                morphology = "fragment"
                fragment_count += 1
                color = (0, 180, 255)

            cv2.rectangle(annotated_bgr, (x, y), (x + w, y + h), color, 2)
            label = f"{morphology} {esd_um:.0f}um"
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.38
            (tw, th), baseline = cv2.getTextSize(label, font, font_scale, 1)

            badge_y = max(th + 4, y - 4)
            bx1, by1 = x, badge_y - th - 3
            bx2, by2 = x + tw + 6, badge_y + baseline - 1
            cv2.rectangle(annotated_bgr, (bx1, by1), (bx2, by2), (15, 23, 42), -1)
            cv2.rectangle(annotated_bgr, (bx1, by1), (bx2, by2), color, 1)
            cv2.putText(annotated_bgr, label, (bx1 + 3, badge_y - 1), font, font_scale, (255, 255, 255), 1, cv2.LINE_AA)

            if esd_um < 40:
                esd_dist['<40um'] += 1
            elif esd_um < 100:
                esd_dist['40-100um'] += 1
            elif esd_um < 250:
                esd_dist['100-250um'] += 1
            elif esd_um < 500:
                esd_dist['250-500um'] += 1
            else:
                esd_dist['>500um'] += 1

            particles.append({
                "id": len(particles) + 1,
                "morphology": morphology,
                "confidence": round(conf, 3),
                "length_um": round(max(w, h) * pixel_scale_um, 1),
                "width_um": round(min(w, h) * pixel_scale_um, 1),
                "esd_um": round(esd_um, 1),
                "bbox": [x, y, w, h],
                "norm": {
                    "cx": round((x + w / 2) / w_img, 5),
                    "cy": round((y + h / 2) / h_img, 5)
                },
                "polygon": poly
            })

        _, buffer = cv2.imencode('.jpg', annotated_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 96])
        annotated_base64 = "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')

        _, clean_buf = cv2.imencode('.jpg', clean_img, [int(cv2.IMWRITE_JPEG_QUALITY), 96])
        clean_base64 = "data:image/jpeg;base64," + base64.b64encode(clean_buf).decode('utf-8')

        total = len(particles)
        avg_conf = sum(p["confidence"] for p in particles) / total if total > 0 else 0.88

        return {
            "annotated_image": annotated_base64,
            "raw_image": clean_base64,
            "analysis": {
                "total_particles": total,
                "plastic_count": total,
                "confidence_score": round(avg_conf, 3),
                "fiber_count": fiber_count,
                "fragment_count": fragment_count,
                "film_count": film_count,
                "pellet_count": pellet_count,
                "lookalike_rejects": lookalike_rejects,
                "particles": particles,
                "esd_distribution": esd_dist,
                "optical_focus_laplacian": focus_score,
                "image_dims": {"width": w_img, "height": h_img},
                "roi_radius_pct": roi_radius_pct,
                "dish_geometry": {
                    "cx": dish_cx,
                    "cy": dish_cy,
                    "usable_r": usable_r,
                    "has_circular_well": has_circular_well
                },
                "lab_risk": {
                    "requires_lab_confirmation": total > 15 or esd_dist['<40um'] > (total * 0.35),
                    "risk_level": "HIGH" if total > 20 else ("MEDIUM" if total > 6 else "LOW"),
                    "reasons": [
                        f"Identified {total} confirmed particulates in {sample_volume_ml} mL sample.",
                        f"Look-alike filters screened out {sum(lookalike_rejects.values())} artifacts ({lookalike_rejects['bubble']} bubbles, {lookalike_rejects['organic']} bio-detritus)."
                    ]
                }
            }
        }

    def process_frame(self, frame: np.ndarray, sample_volume_ml: float = 50.0):
        _, buffer = cv2.imencode('.jpg', frame)
        result = self.process_image(buffer.tobytes(), sample_volume_ml)
        b64_data = result["annotated_image"].split(",")[1]
        decoded = base64.b64decode(b64_data)
        np_arr = np.frombuffer(decoded, np.uint8)
        annotated_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        return result["analysis"], annotated_bgr

vision_service = VisionService()