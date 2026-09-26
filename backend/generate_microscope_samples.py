import os
import cv2
import numpy as np
import random

OUT_DIR = r"training\dataset\images\test"
os.makedirs(OUT_DIR, exist_ok=True)

def generate_multi_morphology_sample(index):
    h, w = 1024, 1024
    
    # 1. Base slide background (dark-field / illuminated glass filter membrane)
    img = np.full((h, w, 3), 16, dtype=np.uint8)
    
    # Vignette & glass filter texture
    cv2.circle(img, (w // 2, h // 2), 480, (26, 32, 42), -1)
    noise = np.random.normal(0, 3, (h, w, 3)).astype(np.int16)
    img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)

    # -------------------------------------------------------------
    # 2. PELLETS / MICROBEADS (High Circularity, Spherical Gradient)
    # -------------------------------------------------------------
    num_pellets = random.randint(1, 3)
    for _ in range(num_pellets):
        cx, cy = random.randint(200, 800), random.randint(200, 800)
        radius = random.randint(12, 35)
        # Spherical bead shading
        for r in range(radius, 0, -1):
            factor = 1.0 - (r / radius) * 0.5
            color = (int(180 * factor), int(220 * factor), int(250 * factor))
            cv2.circle(img, (cx, cy), r, color, -1, lineType=cv2.LINE_AA)

    # -------------------------------------------------------------
    # 3. FRAGMENTS (Angular, Irregular Sharp Edges, Low Circularity)
    # -------------------------------------------------------------
    num_fragments = random.randint(2, 4)
    for _ in range(num_fragments):
        cx, cy = random.randint(200, 800), random.randint(200, 800)
        radius = random.randint(15, 45)
        vertices = random.randint(5, 9)
        poly_pts = []
        for angle in np.linspace(0, 2 * np.pi, vertices, endpoint=False):
            r = radius * random.uniform(0.5, 1.5)
            poly_pts.append([int(cx + r * np.cos(angle)), int(cy + r * np.sin(angle))])
        pts_arr = np.array(poly_pts, np.int32).reshape((-1, 1, 2))
        
        # Opaque plastic color (polypropylene / polyethylene tone)
        frag_color = random.choice([
            (40, 180, 240),   # Yellow/Amber fragment
            (220, 220, 230),  # White weathered PE
            (180, 120, 60)    # Blue weathered fragment
        ])
        cv2.fillPoly(img, [pts_arr], color=frag_color, lineType=cv2.LINE_AA)

    # -------------------------------------------------------------
    # 4. FILMS / SHEETS (Thin 2D semi-transparent polygons)
    # -------------------------------------------------------------
    num_films = random.randint(1, 2)
    for _ in range(num_films):
        overlay = img.copy()
        cx, cy = random.randint(250, 750), random.randint(250, 750)
        size = random.randint(50, 110)
        pts = np.array([
            [cx - size + random.randint(-15, 15), cy - size // 2 + random.randint(-10, 10)],
            [cx + size // 2 + random.randint(-20, 20), cy - size + random.randint(-10, 10)],
            [cx + size + random.randint(-15, 15), cy + size // 3 + random.randint(-15, 15)],
            [cx - size // 3 + random.randint(-10, 10), cy + size + random.randint(-20, 20)],
        ], np.int32).reshape((-1, 1, 2))
        
        # Semi-transparent film overlay (alpha blend)
        cv2.fillPoly(overlay, [pts], (230, 200, 210), lineType=cv2.LINE_AA)
        cv2.polylines(overlay, [pts], True, (255, 230, 240), 2, lineType=cv2.LINE_AA)
        cv2.addWeighted(overlay, 0.45, img, 0.55, 0, img)

    # -------------------------------------------------------------
    # 5. FIBERS (Thin, Curvilinear Threads)
    # -------------------------------------------------------------
    num_fibers = random.randint(1, 3)
    for _ in range(num_fibers):
        pts = []
        sx, sy = random.randint(200, 800), random.randint(200, 800)
        pts.append((sx, sy))
        for _ in range(random.randint(4, 7)):
            sx += random.randint(-70, 70)
            sy += random.randint(-70, 70)
            pts.append((sx, sy))
        pts_arr = np.array(pts, np.int32).reshape((-1, 1, 2))
        fiber_color = random.choice([(255, 120, 30), (50, 230, 255), (100, 70, 250)])
        cv2.polylines(img, [pts_arr], False, fiber_color, thickness=random.randint(2, 3), lineType=cv2.LINE_AA)

    # Microscope focal blur
    img = cv2.GaussianBlur(img, (3, 3), 0)

    filename = os.path.join(OUT_DIR, f"water_sample_{index:02d}.jpg")
    cv2.imwrite(filename, img)
    print(f"Generated multi-morphology sample: {filename}")

for i in range(1, 16):
    generate_multi_morphology_sample(i)

print("\nSuccessfully generated 15 multi-morphology water samples (fibers, fragments, pellets, films).")