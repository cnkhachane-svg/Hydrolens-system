import cv2
import numpy as np
from typing import List

class FocusStacker:
    @classmethod
    def fuse_stack(cls, image_bytes_list: List[bytes]) -> np.ndarray:
        """Fuses multiple Z-slices with Gaussian weight smoothing to eliminate boundary noise and cutouts."""
        images = []
        for b in image_bytes_list:
            np_arr = np.frombuffer(b, np.uint8)
            decoded = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            if decoded is not None:
                images.append(decoded)

        if not images:
            raise ValueError("No valid image slices passed for Z-stacking.")
        if len(images) == 1:
            return images[0]

        h, w = images[0].shape[:2]
        aligned_images = [cv2.resize(im, (w, h)) for im in images]

        sharpness_maps = []
        for img in aligned_images:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            blurred = cv2.GaussianBlur(gray, (7, 7), 0)
            lap = cv2.Laplacian(blurred, cv2.CV_64F, ksize=3)
            energy = cv2.GaussianBlur(np.abs(lap), (21, 21), 0)
            sharpness_maps.append(energy)

        stack = np.stack(sharpness_maps, axis=-1) + 1e-4
        weights = stack / np.sum(stack, axis=-1, keepdims=True)

        fused = np.zeros_like(aligned_images[0], dtype=np.float32)
        for idx, img in enumerate(aligned_images):
            w_layer = weights[:, :, idx, np.newaxis]
            fused += img.astype(np.float32) * w_layer

        return np.clip(fused, 0, 255).astype(np.uint8)

focus_stacker = FocusStacker()