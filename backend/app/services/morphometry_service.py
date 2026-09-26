import cv2
import numpy as np
from app.models.schemas import MorphometricsData

class MorphometryService:
    def __init__(self, um_per_pixel: float = 1.0):
        self.um_per_pixel = um_per_pixel

    def set_scale(self, um_per_pixel: float):
        self.um_per_pixel = um_per_pixel

    def analyze_mask(self, binary_mask: np.ndarray) -> MorphometricsData:
        """
        Calculates exact metric dimensions on a binary segmentation mask.
        """
        contours, _ = cv2.findContours(binary_mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return MorphometricsData(
                area_um2=0.0, esd_um=0.0, max_feret_um=0.0,
                min_feret_um=0.0, circularity=0.0, aspect_ratio=1.0, solidity=0.0
            )

        cnt = max(contours, key=cv2.contourArea)
        area_px = cv2.contourArea(cnt)
        perimeter_px = cv2.arcLength(cnt, True)

        if area_px < 1.0 or perimeter_px == 0:
            return MorphometricsData(
                area_um2=0.0, esd_um=0.0, max_feret_um=0.0,
                min_feret_um=0.0, circularity=0.0, aspect_ratio=1.0, solidity=0.0
            )

        # 1. Equivalent Spherical Diameter (ESD)
        radius_px = np.sqrt(area_px / np.pi)
        esd_um = (2.0 * radius_px) * self.um_per_pixel

        # 2. Min Area Bounding Box for Feret Diameters
        rect = cv2.minAreaRect(cnt)
        w_px, h_px = rect[1]
        length_px = max(w_px, h_px)
        breadth_px = min(w_px, h_px)

        max_feret_um = length_px * self.um_per_pixel
        min_feret_um = breadth_px * self.um_per_pixel

        # 3. Shape Descriptors
        circularity = (4.0 * np.pi * area_px) / (perimeter_px ** 2) if perimeter_px > 0 else 0.0
        aspect_ratio = (length_px / breadth_px) if breadth_px > 0 else 1.0

        # 4. Convex Hull Solidity
        hull = cv2.convexHull(cnt)
        hull_area = cv2.contourArea(hull)
        solidity = float(area_px) / hull_area if hull_area > 0 else 1.0

        return MorphometricsData(
            area_um2=round(float(area_px * (self.um_per_pixel ** 2)), 2),
            esd_um=round(float(esd_um), 2),
            max_feret_um=round(float(max_feret_um), 2),
            min_feret_um=round(float(min_feret_um), 2),
            circularity=round(float(circularity), 3),
            aspect_ratio=round(float(aspect_ratio), 2),
            solidity=round(float(solidity), 3)
        )