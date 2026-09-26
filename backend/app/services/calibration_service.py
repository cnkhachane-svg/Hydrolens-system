import cv2
import numpy as np
import os
import json
from app.core.config import settings
from app.models.schemas import CalibrationProfile

class CalibrationService:
    def __init__(self):
        self.profile_path = os.path.join(settings.CALIBRATION_DIR, "active_profile.json")
        os.makedirs(settings.CALIBRATION_DIR, exist_ok=True)
        self.current_profile = self._load_profile()

    def _load_profile(self) -> CalibrationProfile:
        if os.path.exists(self.profile_path):
            try:
                with open(self.profile_path, "r") as f:
                    data = json.load(f)
                    return CalibrationProfile(**data)
            except Exception:
                pass
        # Default fallback uncalibrated baseline (assumes typical 1080p mobile macro field)
        return CalibrationProfile(
            um_per_pixel=5.0,
            reference_object_diameter_mm=1.0,
            detected_diameter_px=200.0,
            is_active=False
        )

    def calibrate_from_fiducial(self, image_bytes: bytes, reference_diameter_mm: float) -> CalibrationProfile:
        """
        Locates a circular reference marker or coin edge to derive um/pixel.
        """
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (9, 9), 2)

        circles = cv2.HoughCircles(
            blurred, cv2.HOUGH_GRADIENT, dp=1.2, minDist=100,
            param1=50, param2=30, minRadius=20, maxRadius=600
        )

        if circles is not None:
            circles = np.round(circles[0, :]).astype("int")
            diameter_px = float(circles[0][2] * 2)
            um_per_pixel = (reference_diameter_mm * 1000.0) / diameter_px
            
            profile = CalibrationProfile(
                um_per_pixel=round(um_per_pixel, 3),
                reference_object_diameter_mm=reference_diameter_mm,
                detected_diameter_px=round(diameter_px, 1),
                is_active=True
            )
            self._save_profile(profile)
            return profile

        # If circle detection fails, mark as manual calibration needed
        profile = CalibrationProfile(
            um_per_pixel=4.5,
            reference_object_diameter_mm=reference_diameter_mm,
            detected_diameter_px=0.0,
            is_active=False
        )
        return profile

    def _save_profile(self, profile: CalibrationProfile):
        self.current_profile = profile
        with open(self.profile_path, "w") as f:
            json.dump(profile.model_dump(), f, indent=2)

calibration_service = CalibrationService()