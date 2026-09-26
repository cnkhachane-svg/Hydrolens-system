import io
import csv
import json
from datetime import datetime
from typing import List
from fastapi import APIRouter, UploadFile, File, Form, WebSocket, WebSocketDisconnect, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.services.vision_service import vision_service
from app.services.focus_stacker import focus_stacker
from app.db.database import get_db, ScanAudit
import cv2

router = APIRouter()

@router.post("/scan/image")
async def scan_image(
    file: UploadFile = File(...),
    sample_volume_ml: float = Form(50.0),
    pixel_scale_um: float = Form(4.5),
    db: Session = Depends(get_db)
):
    contents = await file.read()
    result = vision_service.process_image(
        file_bytes=contents,
        sample_volume_ml=sample_volume_ml,
        pixel_scale_um=pixel_scale_um
    )
    
    analysis = result.get("analysis", {})
    total = analysis.get("total_particles", 0)
    conc = round((total / max(sample_volume_ml, 1.0)) * 1000.0, 1)
    lab_risk = analysis.get("lab_risk", {})

    audit = ScanAudit(
        sample_volume_ml=sample_volume_ml,
        pixel_scale_um=pixel_scale_um,
        total_particles=total,
        particles_per_liter=conc,
        confidence_score=analysis.get("confidence_score", 0.0),
        fiber_count=analysis.get("fiber_count", 0),
        fragment_count=analysis.get("fragment_count", 0),
        film_count=analysis.get("film_count", 0),
        pellet_count=analysis.get("pellet_count", 0),
        risk_level=lab_risk.get("risk_level", "LOW"),
        requires_lab_confirmation=1 if lab_risk.get("requires_lab_confirmation") else 0,
        particles_json=json.dumps(analysis.get("particles", [])),
        annotated_thumbnail=result.get("annotated_image")[:500] if result.get("annotated_image") else None
    )
    db.add(audit)
    db.commit()
    db.refresh(audit)

    result["analysis"]["audit_id"] = audit.id
    return result

@router.post("/scan/z-stack")
async def scan_z_stack(
    files: List[UploadFile] = File(...),
    sample_volume_ml: float = Form(50.0),
    pixel_scale_um: float = Form(4.5),
    db: Session = Depends(get_db)
):
    """Processes multiple focal depth slices into an Extended Depth of Field (EDOF) composite and runs inference."""
    raw_slices = [await f.read() for f in files]
    fused_bgr = focus_stacker.fuse_stack(raw_slices)
    
    # Encode fused composite back to JPEG bytes for the vision service
    _, encoded = cv2.imencode('.jpg', fused_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 96])
    fused_bytes = encoded.tobytes()

    result = vision_service.process_image(
        file_bytes=fused_bytes,
        sample_volume_ml=sample_volume_ml,
        pixel_scale_um=pixel_scale_um
    )
    result["analysis"]["z_slices_stacked"] = len(files)

    analysis = result.get("analysis", {})
    total = analysis.get("total_particles", 0)
    conc = round((total / max(sample_volume_ml, 1.0)) * 1000.0, 1)
    lab_risk = analysis.get("lab_risk", {})

    audit = ScanAudit(
        sample_volume_ml=sample_volume_ml,
        pixel_scale_um=pixel_scale_um,
        total_particles=total,
        particles_per_liter=conc,
        confidence_score=analysis.get("confidence_score", 0.0),
        fiber_count=analysis.get("fiber_count", 0),
        fragment_count=analysis.get("fragment_count", 0),
        film_count=analysis.get("film_count", 0),
        pellet_count=analysis.get("pellet_count", 0),
        risk_level=lab_risk.get("risk_level", "LOW"),
        requires_lab_confirmation=1 if lab_risk.get("requires_lab_confirmation") else 0,
        particles_json=json.dumps(analysis.get("particles", [])),
        annotated_thumbnail=result.get("annotated_image")[:500] if result.get("annotated_image") else None
    )
    db.add(audit)
    db.commit()
    db.refresh(audit)

    result["analysis"]["audit_id"] = audit.id
    return result

@router.get("/audits")
def get_audit_history(db: Session = Depends(get_db)):
    audits = db.query(ScanAudit).order_by(ScanAudit.id.desc()).limit(30).all()
    return [{
        "id": a.id,
        "timestamp": a.timestamp.strftime("%Y-%m-%d %H:%M:%S UTC"),
        "sample_volume_ml": a.sample_volume_ml,
        "total_particles": a.total_particles,
        "particles_per_liter": a.particles_per_liter,
        "confidence_score": a.confidence_score,
        "fiber_count": a.fiber_count,
        "fragment_count": a.fragment_count,
        "film_count": a.film_count,
        "pellet_count": a.pellet_count,
        "risk_level": a.risk_level,
        "requires_lab_confirmation": bool(a.requires_lab_confirmation)
    } for a in audits]

@router.websocket("/stream/ws")
async def stream_screening(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            message = await websocket.receive_text()
            data = json.loads(message)
            frame_b64 = data.get("frame")
            sample_vol = float(data.get("sample_volume_ml", 50.0))
            scale_um = float(data.get("pixel_scale_um", 4.5))

            if frame_b64:
                if "," in frame_b64:
                    frame_b64 = frame_b64.split(",")[1]
                import base64
                raw_bytes = base64.b64decode(frame_b64)
                analysis_result = vision_service.process_image(
                    file_bytes=raw_bytes,
                    sample_volume_ml=sample_vol,
                    pixel_scale_um=scale_um
                )
                await websocket.send_json(analysis_result)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.send_json({"error": str(e)})

@router.post("/export/csv")
async def export_csv_report(data: dict):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Particle ID", "Morphology", "Confidence", "Length (um)", "Width (um)", "ESD (um)", "ISO Fraction"])
    
    particles = data.get("particles", [])
    for p in particles:
        esd = p.get("esd_um", 0)
        iso_bin = "<40um" if esd < 40 else ("40-100um" if esd < 100 else ("100-250um" if esd < 250 else ("250-500um" if esd < 500 else ">500um")))
        writer.writerow([
            p.get("id"),
            p.get("morphology"),
            p.get("confidence"),
            p.get("length_um"),
            p.get("width_um"),
            esd,
            iso_bin
        ])
        
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=hydrolens_audit_{int(datetime.utcnow().timestamp())}.csv"}
    )