from typing import List
from app.models.schemas import ParticleDetection, LabRiskEvaluation
from app.core.config import settings

class RiskAssessmentService:
    @staticmethod
    def evaluate(particles: List[ParticleDetection], optical_limit_um: float = settings.DEFAULT_OPTICAL_LIMIT_UM) -> LabRiskEvaluation:
        if not particles:
            return LabRiskEvaluation(
                requires_lab_confirmation=False,
                risk_level="LOW",
                reasons=[],
                recommended_lab_test="None Required"
            )

        plastic_particles = [p for p in particles if p.is_plastic]
        total_plastics = len(plastic_particles)

        if total_plastics == 0:
            return LabRiskEvaluation(
                requires_lab_confirmation=False,
                risk_level="LOW",
                reasons=["No plastic particulates detected; high concentration of natural debris/sediment."],
                recommended_lab_test="None Required"
            )

        reasons: List[str] = []
        borderline_conf_count = 0
        sub_resolution_count = 0

        for p in plastic_particles:
            # Check 1: Uncertainty zone
            if 0.40 <= p.confidence < 0.70:
                borderline_conf_count += 1
            
            # Check 2: Physical dimension near lens optical limit
            if p.morphometrics.min_feret_um > 0 and p.morphometrics.min_feret_um < optical_limit_um:
                sub_resolution_count += 1

        borderline_ratio = borderline_conf_count / total_plastics
        sub_res_ratio = sub_resolution_count / total_plastics

        if borderline_ratio > 0.30:
            reasons.append(f"{round(borderline_ratio * 100)}% of candidate particles exhibit borderline optical confidence (40-70%).")

        if sub_res_ratio > 0.20:
            reasons.append(f"{round(sub_res_ratio * 100)}% of particles fall below reliable optical resolving limit (<{optical_limit_um} µm).")

        requires_lab = len(reasons) > 0
        risk_level = "HIGH" if len(reasons) >= 2 else ("MEDIUM" if len(reasons) == 1 else "LOW")

        recommended_test = (
            "Micro-Raman Spectroscopy or ATR-FTIR (Polymer Matrix Verification)" 
            if requires_lab else "Standard Optical Record"
        )

        return LabRiskEvaluation(
            requires_lab_confirmation=requires_lab,
            risk_level=risk_level,
            reasons=reasons,
            recommended_lab_test=recommended_test
        )

risk_service = RiskAssessmentService()