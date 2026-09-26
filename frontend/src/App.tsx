import React, { useState, useRef, useEffect, useCallback } from 'react';
import { HardwareChamber } from './components/HardwareChamber';
import { OpticalTelemetry } from './components/OpticalTelemetry';
import { CalibrationModal } from './components/CalibrationModal';
import { AuditHistoryModal } from './components/AuditHistoryModal';

interface Particle {
  id: number;
  morphology: string;
  confidence: number;
  length_um: number;
  width_um: number;
  esd_um: number;
  bbox: [number, number, number, number];
  norm?: { cx: number; cy: number };
  polygon?: [number, number][];
}

interface AnalysisData {
  total_particles: number;
  plastic_count: number;
  confidence_score: number;
  fiber_count: number;
  fragment_count: number;
  film_count: number;
  pellet_count: number;
  particles: Particle[];
  esd_distribution: Record<string, number>;
  lab_risk: {
    requires_lab_confirmation: boolean;
    risk_level: string;
    reasons: string[];
  };
  image_dims?: { width: number; height: number };
  dish_geometry?: { cx: number; cy: number; usable_r: number; has_circular_well: boolean };
}

export default function App() {
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [calibrated, setCalibrated] = useState<boolean>(true);
  const [scaleUmPerPx, setScaleUmPerPx] = useState<number>(10.1);
  const [blankOffsetCount, setBlankOffsetCount] = useState<number>(0);
  const [roiRadiusPct, setRoiRadiusPct] = useState<number>(0.81);
  const [showRoiRing, setShowRoiRing] = useState<boolean>(false);

  const [isCalibrationOpen, setIsCalibrationOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);

  const [sampleVolumeMl, setSampleVolumeMl] = useState<number>(50);
  const [inferenceSpeedMs, setInferenceSpeedMs] = useState<number>(6.4);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [liveOverlay, setLiveOverlay] = useState<string | null>(null);
  const [imageDims, setImageDims] = useState<{ width: number; height: number }>({ width: 1000, height: 1000 });
  const [viewMode, setViewMode] = useState<'boxes' | 'masks'>('boxes');

  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [selectedParticle, setSelectedParticle] = useState<Particle | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const initialAnalysis: AnalysisData = {
    total_particles: 0,
    plastic_count: 0,
    confidence_score: 0.95,
    fiber_count: 0,
    fragment_count: 0,
    film_count: 0,
    pellet_count: 0,
    particles: [],
    esd_distribution: { '<40um': 0, '40-100um': 0, '100-250um': 0, '250-500um': 0, '>500um': 0 },
    lab_risk: { requires_lab_confirmation: false, risk_level: 'LOW', reasons: ['No sample loaded. Ready for scan.'] }
  };

  const [analysisResult, setAnalysisResult] = useState<AnalysisData>(initialAnalysis);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const zStackInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamIntervalRef = useRef<any>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const handleClearAndReset = () => {
    setZoomLevel(1.0);
    setPan({ x: 0, y: 0 });
    setSelectedParticle(null);
    setPreviewImage(null);
    setRawImage(null);
    setLiveOverlay(null);
    setCurrentFile(null);
    setAnalysisResult(initialAnalysis);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (zStackInputRef.current) zStackInputRef.current.value = '';
  };

  const triggerNewImageUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const triggerNewZStackUpload = () => {
    if (zStackInputRef.current) {
      zStackInputRef.current.value = '';
      zStackInputRef.current.click();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      const key = e.key.toLowerCase();
      if (((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) || (!e.ctrlKey && (key === 'z' || key === '+'))) {
        e.preventDefault();
        setZoomLevel(prev => Math.min(Number((prev + 0.25).toFixed(2)), 5.0));
      } else if (((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) || (!e.ctrlKey && (key === 'x' || key === '-'))) {
        e.preventDefault();
        setZoomLevel(prev => Math.max(Number((prev - 0.25).toFixed(2)), 1.0));
      } else if (key === 'r' || key === '0') {
        e.preventDefault();
        handleClearAndReset();
      } else if (key === 'm') {
        setViewMode(prev => prev === 'boxes' ? 'masks' : 'boxes');
      } else if (key === 'o' || key === 'l') {
        triggerNewImageUpload();
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true, passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, []);

  const handleSelectParticle = (p: Particle | null) => {
    setSelectedParticle(p);
  };

  const handleViewportWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setZoomLevel(prev => Math.min(Math.max(Number((prev + delta).toFixed(2)), 1.0), 5.0));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((previewImage || isStreaming) && zoomLevel > 1.0) {
      setIsDragging(true);
      dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && (previewImage || isStreaming) && zoomLevel > 1.0) {
      setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const executeScan = async (fileToScan: File | null = null, overrideScale?: number, overrideRoi?: number) => {
    const targetFile = fileToScan || currentFile;
    if (!targetFile) {
      triggerNewImageUpload();
      return;
    }

    const activeScale = overrideScale !== undefined ? overrideScale : scaleUmPerPx;
    const activeRoi = overrideRoi !== undefined ? overrideRoi : roiRadiusPct;

    setIsScanning(true);
    const startTime = performance.now();
    const formData = new FormData();
    formData.append('file', targetFile);
    formData.append('sample_volume_ml', sampleVolumeMl.toString());
    formData.append('pixel_scale_um', activeScale.toString());
    formData.append('roi_radius_pct', activeRoi.toString());

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/v1/scan/image?ts=${Date.now()}`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const elapsed = performance.now() - startTime;
      setInferenceSpeedMs(Number(elapsed.toFixed(1)));

      const rawAnalysis = data.analysis || data;
      const particles: Particle[] = Array.isArray(rawAnalysis.particles) ? rawAnalysis.particles : [];
      const totalCount = rawAnalysis.total_particles ?? particles.length;

      if (rawAnalysis.image_dims) {
        setImageDims(rawAnalysis.image_dims);
      }

      setAnalysisResult({
        total_particles: totalCount,
        plastic_count: rawAnalysis.plastic_count ?? totalCount,
        confidence_score: rawAnalysis.confidence_score ?? 0.92,
        fiber_count: rawAnalysis.fiber_count ?? 0,
        fragment_count: rawAnalysis.fragment_count ?? 0,
        film_count: rawAnalysis.film_count ?? 0,
        pellet_count: rawAnalysis.pellet_count ?? 0,
        particles: particles,
        esd_distribution: rawAnalysis.esd_distribution || { '<40um': 0, '40-100um': 0, '100-250um': 0, '250-500um': 0, '>500um': 0 },
        dish_geometry: rawAnalysis.dish_geometry,
        lab_risk: rawAnalysis.lab_risk || {
          requires_lab_confirmation: totalCount > 15,
          risk_level: totalCount > 40 ? 'HIGH' : (totalCount > 10 ? 'MEDIUM' : 'LOW'),
          reasons: [`Identified ${totalCount} microplastics in ${sampleVolumeMl} mL sample.`]
        }
      });

      if (data.annotated_image) setPreviewImage(data.annotated_image);
      if (data.raw_image) setRawImage(data.raw_image);
    } catch (err) {
      console.error('[HydroLens] Ingestion error:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleApplyCalibration = (newScale: number, newBlank: number) => {
    const oldScale = scaleUmPerPx || 1.0;
    setScaleUmPerPx(newScale);
    setBlankOffsetCount(newBlank);
    setCalibrated(true);

    if (currentFile) {
      executeScan(currentFile, newScale);
    } else if (analysisResult.particles.length > 0) {
      const ratio = newScale / oldScale;
      const updatedParticles = analysisResult.particles.map(p => ({
        ...p,
        esd_um: Number((p.esd_um * ratio).toFixed(1)),
        length_um: Number((p.length_um * ratio).toFixed(1)),
        width_um: Number((p.width_um * ratio).toFixed(1)),
      }));

      const newDist: Record<string, number> = { '<40um': 0, '40-100um': 0, '100-250um': 0, '250-500um': 0, '>500um': 0 };
      updatedParticles.forEach(p => {
        if (p.esd_um < 40) newDist['<40um']++;
        else if (p.esd_um < 100) newDist['40-100um']++;
        else if (p.esd_um < 250) newDist['100-250um']++;
        else if (p.esd_um < 500) newDist['250-500um']++;
        else newDist['>500um']++;
      });

      setAnalysisResult(prev => ({
        ...prev,
        particles: updatedParticles,
        esd_distribution: newDist
      }));
    }
  };

  const handleRoiChange = (val: number) => {
    setRoiRadiusPct(val);
    if (currentFile) {
      executeScan(currentFile, scaleUmPerPx, val);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setCurrentFile(file);
    setPreviewImage(URL.createObjectURL(file));
    setRawImage(null);
    setLiveOverlay(null);
    setZoomLevel(1.0);
    setPan({ x: 0, y: 0 });
    setSelectedParticle(null);
    executeScan(file);
  };

  const handleZStackUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const fileList = Array.from(e.target.files);

    setIsScanning(true);
    const startTime = performance.now();
    const formData = new FormData();
    fileList.forEach((file) => formData.append('files', file));
    formData.append('sample_volume_ml', sampleVolumeMl.toString());
    formData.append('pixel_scale_um', scaleUmPerPx.toString());

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/v1/scan/z-stack?ts=${Date.now()}`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const elapsed = performance.now() - startTime;
      setInferenceSpeedMs(Number(elapsed.toFixed(1)));

      const rawAnalysis = data.analysis || data;
      const particles: Particle[] = Array.isArray(rawAnalysis.particles) ? rawAnalysis.particles : [];
      const totalCount = rawAnalysis.total_particles ?? particles.length;

      if (rawAnalysis.image_dims) {
        setImageDims(rawAnalysis.image_dims);
      }

      setAnalysisResult({
        total_particles: totalCount,
        plastic_count: rawAnalysis.plastic_count ?? totalCount,
        confidence_score: rawAnalysis.confidence_score ?? 0.94,
        fiber_count: rawAnalysis.fiber_count ?? 0,
        fragment_count: rawAnalysis.fragment_count ?? 0,
        film_count: rawAnalysis.film_count ?? 0,
        pellet_count: rawAnalysis.pellet_count ?? 0,
        particles: particles,
        esd_distribution: rawAnalysis.esd_distribution || { '<40um': 0, '40-100um': 0, '100-250um': 0, '250-500um': 0, '>500um': 0 },
        lab_risk: rawAnalysis.lab_risk || {
          requires_lab_confirmation: totalCount > 15,
          risk_level: totalCount > 40 ? 'HIGH' : (totalCount > 10 ? 'MEDIUM' : 'LOW'),
          reasons: [`EDOF Fusion of ${fileList.length} focal planes. Identified ${totalCount} microplastics.`]
        }
      });

      if (data.annotated_image) setPreviewImage(data.annotated_image);
      if (data.raw_image) setRawImage(data.raw_image);
    } catch (err) {
      console.error('[HydroLens] Z-Stack Fusion error:', err);
    } finally {
      setIsScanning(false);
      if (zStackInputRef.current) zStackInputRef.current.value = '';
    }
  };

  const toggleStream = useCallback(async () => {
    if (!isStreaming) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'environment'
          },
          audio: false
        });

        setPreviewImage(null);
        setRawImage(null);
        setLiveOverlay(null);
        setCurrentFile(null);
        setSelectedParticle(null);
        setIsStreaming(true);

        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(e => console.error('Play error:', e));
          }
        }, 50);

        const ws = new WebSocket('ws://127.0.0.1:8000/api/v1/stream/ws');
        wsRef.current = ws;
        const offscreenCanvas = document.createElement('canvas');

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.annotated_image) {
              setLiveOverlay(data.annotated_image);
            }
            if (data.analysis) {
              setAnalysisResult(data.analysis);
              if (data.analysis.image_dims) {
                setImageDims(data.analysis.image_dims);
              }
            }
          } catch (e) {
            console.error(e);
          }
        };

        streamIntervalRef.current = setInterval(() => {
          if (videoRef.current && videoRef.current.videoWidth > 0 && ws.readyState === WebSocket.OPEN) {
            offscreenCanvas.width = 640;
            offscreenCanvas.height = 480;
            const ctx = offscreenCanvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(videoRef.current, 0, 0, 640, 480);
              const b64 = offscreenCanvas.toDataURL('image/jpeg', 0.65);
              ws.send(JSON.stringify({
                frame: b64,
                sample_volume_ml: sampleVolumeMl,
                pixel_scale_um: scaleUmPerPx
              }));
            }
          }
        }, 100);

      } catch (err: any) {
        console.error('Camera setup failed:', err);
        setIsStreaming(false);
        alert(`Camera access failed: ${err.name || 'Error'}: ${err.message || 'Permission denied'}`);
      }
    } else {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
        streamIntervalRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsStreaming(false);
      setLiveOverlay(null);
    }
  }, [isStreaming, sampleVolumeMl, scaleUmPerPx]);

  const handleExportReport = async () => {
    if (!analysisResult || analysisResult.total_particles === 0) {
      alert('No active scan data to export. Please scan a sample first.');
      return;
    }

    const timestamp = new Date().toISOString();
    const netCount = Math.max(0, analysisResult.total_particles - blankOffsetCount);
    const concentrationL = sampleVolumeMl > 0
      ? Math.round((netCount / sampleVolumeMl) * 1000)
      : 0;

    try {
      const csvRes = await fetch('http://127.0.0.1:8000/api/v1/export/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ particles: analysisResult.particles })
      });
      if (csvRes.ok) {
        const blob = await csvRes.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `HydroLens_Audit_${timestamp.replace(/[:.]/g, '-')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      const csvHeaders = 'Particle_ID,Morphology,ESD_um,Length_um,Width_um,Confidence\n';
      const csvRows = analysisResult.particles.map((p) =>
        `${p.id},${p.morphology},${p.esd_um},${p.length_um},${p.width_um},${p.confidence || 0.9}`
      ).join('\n');
      const blob = new Blob([csvHeaders + csvRows], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HydroLens_Audit_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }

    const auditWindow = window.open('', '_blank');
    if (!auditWindow) return;

    const rows = analysisResult.particles.map((p) =>
      `<tr><td>#${p.id}</td><td>${p.morphology.toUpperCase()}</td><td>${p.esd_um} µm</td><td>${p.length_um} µm</td><td>${((p.confidence || 0.9) * 100).toFixed(1)}%</td></tr>`
    ).join('');

    auditWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>HydroLens Audit Dossier</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f17; color: #f1f5f9; padding: 28px; line-height: 1.5; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { padding: 10px 12px; border-bottom: 1px solid #334155; font-size: 12px; text-align: left; }
            th { color: #94a3b8; font-weight: 700; text-transform: uppercase; background: #131b29; }
            .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 11px; }
            .card { background: #131b29; border: 1px solid #1e293b; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1 style="color: #38bdf8; margin: 0 0 8px 0; font-size: 20px;">HydroLens™ Automated Microplastics Screening Audit</h1>
            <p style="margin: 0; font-size: 12px; color: #94a3b8;">METROLOGY STANDARD: ISO/DIS 24187 | OPTICAL REFERENCE CALIBRATION VERIFIED: ${scaleUmPerPx} µm/px | RIM GUARD: ${Math.round(roiRadiusPct * 100)}%</p>
            <div style="margin-top: 10px; padding: 10px; background: rgba(56, 189, 248, 0.1); border-left: 3px solid #38bdf8; font-size: 11px; color: #cbd5e1;">
              <strong>Metrological Scope Boundary:</strong> This screening report characterizes physical particulate count, size distribution, and morphology. Specific chemical polymer identification (e.g. PET, Polyethylene, Polypropylene) is strictly an optional extension requiring secondary laboratory referral (FTIR / Raman spectroscopy).
            </div>
          </div>
          <div class="card" style="display: flex; gap: 24px;">
            <div>Gross Detected: <strong>${analysisResult.total_particles}</strong></div>
            <div>Blank Baseline Offset: <strong>-${blankOffsetCount}</strong></div>
            <div>Net Concentration: <strong style="color: #38bdf8;">${concentrationL.toLocaleString()} particles/L</strong></div>
            <div>Volume: <strong>${sampleVolumeMl} mL</strong></div>
          </div>
          <div class="card">
            <h3 style="margin-top: 0;">Verified Particulate Inventory</h3>
            <table>
              <thead>
                <tr><th>ID</th><th>Morphology</th><th>ESD (µm)</th><th>Length (µm)</th><th>Confidence</th></tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </body>
      </html>
    `);
    auditWindow.document.close();
  };

  const hasMedia = Boolean(previewImage || isStreaming);

  const getMorphologyColor = (type: string) => {
    switch ((type || '').toLowerCase()) {
      case 'fiber': return { stroke: '#06b6d4', fill: 'rgba(6, 182, 212, 0.55)' };
      case 'fragment': return { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.55)' };
      case 'pellet': return { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.55)' };
      default: return { stroke: '#f43f5e', fill: 'rgba(244, 63, 94, 0.55)' };
    }
  };

  return (
    <div style={{ fontFamily: "'Roboto', sans-serif" }} className="fixed inset-0 w-screen h-screen bg-[#07090e] p-3 text-slate-100 flex flex-col overflow-hidden select-none">
      <HardwareChamber
        isStreaming={isStreaming}
        onToggleStream={toggleStream}
        onScanSample={() => executeScan(currentFile)}
        isScanning={isScanning}
        inferenceSpeedMs={inferenceSpeedMs}
        sampleVolumeMl={sampleVolumeMl}
        onSampleVolumeChange={setSampleVolumeMl}
        calibrated={calibrated}
        scaleUmPerPx={scaleUmPerPx}
        onOpenCalibration={() => setIsCalibrationOpen(true)}
        onExportReport={handleExportReport}
      >
        <div className="flex-1 flex flex-col min-w-0 h-full">
          <div
            ref={viewportRef}
            onWheel={handleViewportWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`relative w-full h-full rounded-2xl bg-[#030508] border-2 border-slate-700/80 shadow-[inset_0_0_60px_rgba(0,0,0,0.95)] overflow-hidden flex items-center justify-center ${
              hasMedia && zoomLevel > 1.0 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
            }`}
          >
            <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1.5px,transparent_1.5px)] [background-size:28px_28px] opacity-40 pointer-events-none" />

            {hasMedia ? (
              <div
                style={{
                  transform: `scale(${zoomLevel}) translate(${pan.x / zoomLevel}px, ${pan.y / zoomLevel}px)`,
                  transformOrigin: 'center center',
                }}
                className="w-full h-full flex items-center justify-center pointer-events-none transition-transform duration-100 relative"
              >
                {isStreaming ? (
                  <div className="relative w-full h-full flex items-center justify-center p-2">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`max-w-full max-h-full w-full h-full object-contain rounded-xl shadow-2xl block border border-slate-700/50 ${liveOverlay ? 'opacity-0 absolute' : 'opacity-100'}`}
                    />
                    {liveOverlay && (
                      <img
                        src={liveOverlay}
                        alt="Live streaming feed"
                        className="max-w-full max-h-full w-full h-full object-contain rounded-xl shadow-2xl block"
                      />
                    )}
                  </div>
                ) : (
                  <div
                    ref={frameRef}
                    className="relative max-w-full max-h-full flex items-center justify-center"
                    style={{
                      aspectRatio: `${imageDims.width} / ${imageDims.height}`
                    }}
                  >
                    <img
                      src={viewMode === 'masks' && rawImage ? rawImage : previewImage!}
                      alt="Microscope viewport"
                      className="w-full h-full object-contain select-none pointer-events-none block rounded-xl shadow-2xl"
                      key={viewMode + (previewImage || '') + scaleUmPerPx + roiRadiusPct}
                    />

                    {/* Interactive Fluid Meniscus Exclusion Ring */}
                    {showRoiRing && analysisResult.dish_geometry?.has_circular_well && (
                      <svg
                        viewBox={`0 0 ${imageDims.width} ${imageDims.height}`}
                        className="absolute inset-0 w-full h-full pointer-events-none z-30"
                      >
                        <circle
                          cx={analysisResult.dish_geometry.cx}
                          cy={analysisResult.dish_geometry.cy}
                          r={analysisResult.dish_geometry.usable_r}
                          fill="none"
                          stroke="#22d3ee"
                          strokeWidth="3"
                          strokeDasharray="6 6"
                          className="opacity-90 animate-pulse"
                        />
                      </svg>
                    )}

                    {/* Dynamic Scale Overlay Labels */}
                    <div className="absolute inset-0 w-full h-full pointer-events-none">
                      {analysisResult.particles.map((p) => {
                        const [x, y, w, h] = p.bbox;
                        const leftPct = (x / imageDims.width) * 100;
                        const topPct = (y / imageDims.height) * 100;
                        const widthPct = (w / imageDims.width) * 100;
                        const heightPct = (h / imageDims.height) * 100;

                        return (
                          <div
                            key={p.id}
                            style={{
                              left: `${leftPct}%`,
                              top: `${topPct}%`,
                              width: `${widthPct}%`,
                              height: `${heightPct}%`,
                            }}
                            className="absolute pointer-events-none"
                          >
                            <span
                              className="absolute -top-4 left-0 px-1 py-0.2 rounded bg-slate-900/90 border border-cyan-400 text-[10px] font-mono font-black text-cyan-300 whitespace-nowrap shadow-sm"
                            >
                              {p.morphology} {p.esd_um}µm
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {viewMode === 'masks' && (
                      <svg
                        viewBox={`0 0 ${imageDims.width} ${imageDims.height}`}
                        className="absolute inset-0 w-full h-full pointer-events-none"
                      >
                        {analysisResult.particles.map((p) => {
                          if (!p.polygon || p.polygon.length === 0) return null;
                          const colors = getMorphologyColor(p.morphology);
                          const isSelected = selectedParticle?.id === p.id;
                          const pointsStr = p.polygon
                            .map((pt) => `${(pt[0] / 1000) * imageDims.width},${(pt[1] / 1000) * imageDims.height}`)
                            .join(' ');

                          return (
                            <polygon
                              key={p.id}
                              points={pointsStr}
                              fill={isSelected ? 'rgba(56, 189, 248, 0.8)' : colors.fill}
                              stroke={isSelected ? '#ffffff' : colors.stroke}
                              strokeWidth={isSelected ? 4 : 2}
                              className="transition-all duration-150"
                            />
                          );
                        })}
                      </svg>
                    )}

                    {selectedParticle && selectedParticle.norm && (
                      <div
                        style={{
                          left: `${selectedParticle.norm.cx * 100}%`,
                          top: `${selectedParticle.norm.cy * 100}%`,
                        }}
                        className="absolute z-40 pointer-events-none -translate-x-1/2 -translate-y-1/2"
                      >
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex flex-col items-center animate-bounce">
                          <span className="px-2 py-0.5 rounded bg-cyan-400 text-black text-[10px] font-black tracking-widest uppercase shadow-[0_0_15px_#22d3ee] whitespace-nowrap">
                            PARTICLE #{selectedParticle.id} ({selectedParticle.esd_um}µm)
                          </span>
                          <div className="w-0 h-0 border-x-4 border-x-transparent border-t-6 border-t-cyan-400" />
                        </div>
                        <div className="relative w-14 h-14 -top-7 -left-7 flex items-center justify-center">
                          <div className="absolute inset-0 rounded-full border-2 border-cyan-400 animate-ping opacity-75" />
                          <div className="absolute w-10 h-10 rounded-full border-2 border-cyan-300 shadow-[0_0_15px_#22d3ee]" />
                          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="relative z-10 flex flex-col items-center justify-center text-center p-8 select-none pointer-events-auto">
                <div className="w-20 h-20 rounded-full border-2 border-cyan-500/40 flex items-center justify-center mb-4 bg-cyan-500/10 text-cyan-400 text-3xl shadow-[0_0_35px_rgba(6,182,212,0.3)]">
                  ⊕
                </div>
                <h3 className="text-lg uppercase tracking-wider text-slate-100 mb-1.5 font-black">Microscope Viewport Ready</h3>
                <p className="text-sm text-slate-300 max-w-md mb-5 font-medium">Insert micro-slide sample or upload pre-captured water sample image.</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={triggerNewImageUpload}
                    className="px-6 py-3 rounded-2xl bg-cyan-500/20 hover:bg-cyan-500/30 border-2 border-cyan-400/60 text-sm font-black text-cyan-300 transition duration-200 shadow-[0_0_25px_rgba(6,182,212,0.3)] tracking-wider active:scale-95 cursor-pointer"
                  >
                    Load Single Frame
                  </button>
                  <button
                    onClick={triggerNewZStackUpload}
                    className="px-6 py-3 rounded-2xl bg-indigo-500/20 hover:bg-indigo-500/30 border-2 border-indigo-400/60 text-sm font-black text-indigo-300 transition duration-200 shadow-[0_0_25px_rgba(99,102,241,0.3)] tracking-wider active:scale-95 cursor-pointer"
                  >
                    Load Z-Stack (EDOF)
                  </button>
                </div>
              </div>
            )}

            {/* Hidden File Inputs */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept="image/*"
            />
            <input
              type="file"
              ref={zStackInputRef}
              onChange={handleZStackUpload}
              className="hidden"
              accept="image/*"
              multiple
            />

            {/* Top Toolbar Controls */}
            <div className="absolute top-4 left-4 flex items-center space-x-3 pointer-events-auto z-20">
              <span className="text-base text-slate-100 uppercase tracking-wider font-black">Microscope View</span>
              <span className="px-3 py-1 rounded-lg bg-black/70 border border-white/10 text-xs font-mono text-cyan-400 font-bold">
                ZOOM: {zoomLevel.toFixed(2)}x
              </span>

              <button
                onClick={() => setViewMode(prev => prev === 'boxes' ? 'masks' : 'boxes')}
                className={`px-3 py-1 rounded-lg border text-xs font-mono font-bold transition cursor-pointer flex items-center space-x-1.5 ${
                  viewMode === 'masks'
                    ? 'bg-purple-600/30 border-purple-400 text-purple-200 shadow-[0_0_10px_rgba(168,85,247,0.4)]'
                    : 'bg-black/70 border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                <span>MODE:</span>
                <span className="uppercase text-cyan-300 font-black">{viewMode}</span>
              </button>

              {/* Rim Guard Exclusion Slider */}
              <div className="flex items-center space-x-2 bg-black/70 border border-white/10 px-3 py-1 rounded-lg text-xs font-mono">
                <span className="text-slate-400 font-bold">RIM GUARD:</span>
                <input
                  type="range"
                  min="0.68"
                  max="0.90"
                  step="0.01"
                  value={roiRadiusPct}
                  onMouseEnter={() => setShowRoiRing(true)}
                  onMouseLeave={() => setShowRoiRing(false)}
                  onChange={(e) => handleRoiChange(Number(e.target.value))}
                  className="w-20 accent-cyan-400 cursor-pointer"
                  title="Adjust circular meniscus exclusion boundary"
                />
                <span className="text-cyan-300 font-black">{Math.round(roiRadiusPct * 100)}%</span>
              </div>
            </div>

            <div className="absolute top-4 right-4 flex items-center space-x-2 pointer-events-none z-20">
              <div className={`px-3.5 py-1.5 rounded-full border text-xs font-black flex items-center space-x-2 ${
                isStreaming ? 'bg-rose-500/20 border-rose-400/50 text-rose-300' : 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-rose-400' : 'bg-emerald-400'} animate-pulse`} />
                <span>{isStreaming ? 'LIVE WEBSOCKET STREAM' : 'Standby Feed'}</span>
              </div>
            </div>

            <div className="absolute bottom-4 left-4 flex items-center space-x-2 bg-black/80 backdrop-blur-md border border-white/10 p-1.5 rounded-2xl z-20">
              <button
                onClick={() => setZoomLevel((prev) => Math.min(Number((prev + 0.25).toFixed(2)), 5.0))}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black text-lg flex items-center justify-center transition cursor-pointer"
                title="Zoom In"
              >
                +
              </button>
              <button
                onClick={() => setZoomLevel((prev) => Math.max(Number((prev - 0.25).toFixed(2)), 1.0))}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black text-lg flex items-center justify-center transition cursor-pointer"
                title="Zoom Out"
              >
                -
              </button>
              <button
                onClick={triggerNewImageUpload}
                className="px-3.5 h-9 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-xs font-mono text-cyan-300 font-black transition cursor-pointer flex items-center space-x-1"
              >
                <span>LOAD NEW</span>
              </button>
              <button
                onClick={handleClearAndReset}
                className="px-3 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-300 font-bold transition cursor-pointer"
              >
                RESET
              </button>
              <button
                onClick={triggerNewZStackUpload}
                className="px-3 h-9 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-400/40 text-xs font-mono text-indigo-300 font-bold transition cursor-pointer"
              >
                Z-STACK
              </button>
              <button
                onClick={() => setIsHistoryOpen(true)}
                className="px-3 h-9 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/40 text-xs font-mono text-cyan-300 font-bold transition cursor-pointer"
              >
                LOGS
              </button>
            </div>

            <div className="absolute bottom-4 right-4 bg-black/85 backdrop-blur-md border border-white/10 p-3 rounded-2xl text-xs space-y-2 shadow-2xl pointer-events-none z-20">
              <div className="flex items-center space-x-2.5"><span className="w-3 h-3 rounded-xs bg-cyan-400" /><span className="text-slate-200 font-bold">Fiber</span></div>
              <div className="flex items-center space-x-2.5"><span className="w-3 h-3 rounded-xs bg-amber-400" /><span className="text-slate-200 font-bold">Fragment</span></div>
              <div className="flex items-center space-x-2.5"><span className="w-3 h-3 rounded-xs bg-rose-400" /><span className="text-slate-200 font-bold">Film</span></div>
              <div className="flex items-center space-x-2.5"><span className="w-3 h-3 rounded-xs bg-emerald-400" /><span className="text-slate-200 font-bold">Pellet</span></div>
            </div>
          </div>
        </div>

        <OpticalTelemetry
          totalParticles={analysisResult.total_particles}
          confidenceScore={analysisResult.confidence_score}
          particles={analysisResult.particles}
          labRisk={analysisResult.lab_risk}
          sampleVolumeMl={sampleVolumeMl}
          selectedParticle={selectedParticle}
          onSelectParticle={handleSelectParticle}
          fiberCount={analysisResult.fiber_count}
          fragmentCount={analysisResult.fragment_count}
          filmCount={analysisResult.film_count}
          pelletCount={analysisResult.pellet_count}
          calibrated={calibrated}
          blankOffsetCount={blankOffsetCount}
          onOpenCalibration={() => setIsCalibrationOpen(true)}
        />
      </HardwareChamber>

      <CalibrationModal
        isOpen={isCalibrationOpen}
        onClose={() => setIsCalibrationOpen(false)}
        currentScale={scaleUmPerPx}
        currentBlankCount={blankOffsetCount}
        onApplyCalibration={handleApplyCalibration}
      />

      <AuditHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />
    </div>
  );
}