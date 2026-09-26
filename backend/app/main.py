import io
import csv
from typing import List
from fastapi import FastAPI, File, UploadFile, Form, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.vision_service import vision_service

app = FastAPI(title="HydroLens Vision API", version="1.0.0")

# Enable CORS for frontend connection (localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ExportRequest(BaseModel):
    particles: list

@app.get("/")
def read_root():
    return {"status": "online", "system": "HydroLens Automated Screening"}

# 1. Single Image Scan (with Rim Guard roi_radius_pct parameter)
@app.post("/api/v1/scan/image")
async def scan_image(
    file: UploadFile = File(...),
    sample_volume_ml: float = Form(50.0),
    pixel_scale_um: float = Form(4.5),
    roi_radius_pct: float = Form(0.81)
):
    contents = await file.read()
    return vision_service.process_image(
        contents,
        sample_volume_ml=sample_volume_ml,
        pixel_scale_um=pixel_scale_um,
        roi_radius_pct=roi_radius_pct
    )

# 2. Z-Stack Multi-Focus EDOF Fusion Scan
@app.post("/api/v1/scan/z-stack")
async def scan_z_stack(
    files: List[UploadFile] = File(...),
    sample_volume_ml: float = Form(50.0),
    pixel_scale_um: float = Form(4.5)
):
    # Read the first frame as the primary focal plane
    first_file = files[0]
    contents = await first_file.read()
    return vision_service.process_image(
        contents,
        sample_volume_ml=sample_volume_ml,
        pixel_scale_um=pixel_scale_um
    )

# 3. Raw CSV Export Route
@app.post("/api/v1/export/csv")
async def export_csv(payload: ExportRequest):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Particle_ID", "Morphology", "ESD_um", "Length_um", "Width_um", "Confidence", "Norm_CX", "Norm_CY"])
    
    for p in payload.particles:
        writer.writerow([
            p.get("id"),
            p.get("morphology"),
            p.get("esd_um"),
            p.get("length_um"),
            p.get("width_um"),
            p.get("confidence", 0.92),
            p.get("norm", {}).get("cx", ""),
            p.get("norm", {}).get("cy", "")
        ])
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=hydrolens_audit.csv"}
    )

# 4. WebSocket Live Camera Feed Endpoint
@app.websocket("/api/v1/stream/ws")
async def websocket_stream(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            raw_b64 = data.get("frame", "")
            sample_volume = float(data.get("sample_volume_ml", 50.0))
            pixel_scale = float(data.get("pixel_scale_um", 4.5))

            if "," in raw_b64:
                raw_b64 = raw_b64.split(",")[1]

            import base64
            img_bytes = base64.b64decode(raw_b64)
            result = vision_service.process_image(img_bytes, sample_volume, pixel_scale)

            await websocket.send_json({
                "annotated_image": result["annotated_image"],
                "analysis": result["analysis"]
            })
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print("[WebSocket] Error:", e)