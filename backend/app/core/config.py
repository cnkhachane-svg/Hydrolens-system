import os
import torch
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=True)

    PROJECT_NAME: str = "HydroLens Microplastics Analyzer"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    WEIGHTS_DIR: str = os.path.join(BASE_DIR, "weights")
    CALIBRATION_DIR: str = os.path.join(BASE_DIR, "data", "calibration")
    
    DEVICE: str = "cuda" if torch.cuda.is_available() else "cpu"
    
    DEFAULT_OPTICAL_LIMIT_UM: float = 40.0
    DEFAULT_CONFIDENCE_THRESHOLD: float = 0.35

settings = Settings()