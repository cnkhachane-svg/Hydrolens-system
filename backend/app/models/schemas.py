from pydantic import BaseModel, Field
from typing import List, Optional

class MorphometricsData(BaseModel):
    area_um2: float
    esd_um: float = Field(description="Equivalent Spherical Diameter in micrometers")
    max_feret_um: float = Field(description="Maximum caliper length (length of particle)")
    min_feret_um: float = Field(description="Minimum caliper length (thickness of particle)")
    circularity: float = Field(description="Shape factor: 1.0 is a circle, <0.2 is elongated fiber")
    aspect_ratio: float = Field(description="Length-to-breadth ratio")
    solidity: float = Field(description="Area / Convex Hull Area: distinguishes smooth synthetics from ragged organics")

class ParticleDetection(BaseModel):
    id: int
    classification: str  # 'fiber', 'fragment', 'film', 'pellet', 'organic_debris'
    confidence: float
    is_plastic: bool
    morphometrics: MorphometricsData

class LabRiskEvaluation(BaseModel):
    requires_lab_confirmation: bool
    risk_level: str  # 'LOW', 'MEDIUM', 'HIGH'
    reasons: List[str]
    recommended_lab_test: str

class ScanResult(BaseModel):
    total_particles: int
    plastic_count: int
    organic_debris_filtered: int
    sample_volume_ml: float
    concentration_particles_per_liter: float
    is_calibrated: bool
    um_per_pixel: float
    lab_risk: LabRiskEvaluation
    particles: List[ParticleDetection]

class CalibrationProfile(BaseModel):
    um_per_pixel: float
    reference_object_diameter_mm: float
    detected_diameter_px: float
    is_active: bool