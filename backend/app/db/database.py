from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime, Text
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DB_PATH = BASE_DIR / "hydrolens.db"

engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class ScanAudit(Base):
    __tablename__ = "scan_audits"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    sample_volume_ml = Column(Float, default=50.0)
    pixel_scale_um = Column(Float, default=4.5)
    total_particles = Column(Integer, default=0)
    particles_per_liter = Column(Float, default=0.0)
    confidence_score = Column(Float, default=0.0)
    fiber_count = Column(Integer, default=0)
    fragment_count = Column(Integer, default=0)
    film_count = Column(Integer, default=0)
    pellet_count = Column(Integer, default=0)
    risk_level = Column(String, default="LOW")
    requires_lab_confirmation = Column(Integer, default=0)
    particles_json = Column(Text, default="[]")
    annotated_thumbnail = Column(Text, nullable=True)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()