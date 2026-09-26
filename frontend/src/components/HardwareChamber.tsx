import React from 'react';
import { Cpu, Activity, Download, CheckCircle2, AlertTriangle, Play, Square, Loader2 } from 'lucide-react';

interface HardwareChamberProps {
  children: React.ReactNode;
  isStreaming: boolean;
  onToggleStream: () => void;
  onScanSample: () => void;
  isScanning?: boolean;
  inferenceSpeedMs: number;
  sampleVolumeMl: number;
  onSampleVolumeChange: (vol: number) => void;
  calibrated: boolean;
  scaleUmPerPx: number;
  onOpenCalibration: () => void;
  onExportReport: () => void;
}

export const HardwareChamber: React.FC<HardwareChamberProps> = ({
  children,
  isStreaming,
  onToggleStream,
  onScanSample,
  isScanning = false,
  inferenceSpeedMs,
  sampleVolumeMl,
  onSampleVolumeChange,
  calibrated,
  scaleUmPerPx,
  onOpenCalibration,
  onExportReport
}) => {
  const handleScanClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isScanning && onScanSample) {
      onScanSample();
    }
  };

  const handleToggleStreamClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (onToggleStream) {
      onToggleStream();
    }
  };

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, #242933 0%, #161a22 35%, #0d1017 100%)',
        boxShadow: '0 30px 90px rgba(0,0,0,0.95), inset 0 2px 3px rgba(255,255,255,0.15)',
        fontFamily: "'Roboto', sans-serif"
      }}
      className="rounded-3xl border-2 border-slate-600/80 p-5 w-full h-full flex flex-col justify-between select-none overflow-hidden"
    >
      {/* Top Instrumentation Header */}
      <header className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0 gap-4">
        <div className="flex items-center space-x-3 shrink-0">
          <div className="flex items-center space-x-2.5 px-4 py-2 rounded-xl bg-black/60 border border-white/15 text-sm font-mono text-cyan-400 font-black shadow-inner">
            <Cpu className="w-5 h-5 text-cyan-400 shrink-0" />
            <span>CUDA:0 (RTX ACCELERATED)</span>
          </div>

          <div className="flex items-center space-x-2.5 px-4 py-2 rounded-xl bg-white/5 border border-white/15 text-sm text-slate-200 font-semibold">
            <Activity className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>
              LATENCY: <strong className="text-emerald-400 font-mono text-base font-black">{inferenceSpeedMs.toFixed(1)} ms</strong>
            </span>
          </div>

          <div className="px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-400/40 text-sm text-cyan-300 font-black font-mono">
            MODEL: YOLOV8-SEG
          </div>
        </div>

        <h1 className="text-xl xl:text-2xl font-black tracking-wider text-slate-100 uppercase drop-shadow-md text-center truncate">
          HydroLens | Microplastics Screening System
        </h1>

        {/* Live Sample Volume Configuration & Export */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className="flex items-center space-x-2.5 bg-black/60 px-4 py-2 rounded-xl border border-white/15">
            <span className="text-sm uppercase text-slate-200 font-black">Sample Vol:</span>
            <input
              type="number"
              min="1"
              max="1000"
              value={sampleVolumeMl}
              onChange={(e) => onSampleVolumeChange(Math.max(1, Number(e.target.value)))}
              className="w-16 bg-white/15 text-cyan-300 font-mono font-black text-sm px-2 py-1 rounded border border-white/20 focus:outline-none focus:border-cyan-400 text-center"
            />
            <span className="text-sm font-mono font-bold text-slate-400">mL</span>
          </div>

          <button
            type="button"
            onClick={onExportReport}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-black text-slate-100 transition cursor-pointer active:scale-95 shadow-md"
            title="Download Metrology Audit Report"
          >
            <Download className="w-5 h-5 text-cyan-400" />
            <span>EXPORT AUDIT</span>
          </button>
        </div>
      </header>

      {/* Main Viewport & Telemetry Bay */}
      <main className="flex-1 flex flex-row gap-5 my-3.5 min-h-0">
        {children}
      </main>

      {/* Bottom Telemetry & Trigger Bar */}
      <footer className="pt-4 border-t border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-5">
          <button
            type="button"
            onClick={onOpenCalibration}
            className={`flex items-center space-x-2.5 px-6 py-3 rounded-2xl text-sm font-black tracking-wider border-2 transition-all cursor-pointer active:scale-95 ${
              calibrated
                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/25'
                : 'bg-amber-500/15 border-amber-500/50 text-amber-300 animate-pulse hover:bg-amber-500/25'
            }`}
          >
            {calibrated ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>SCALE CALIBRATED: {scaleUmPerPx.toFixed(1)} µm/px</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5" />
                <span>UNCALIBRATED (CLICK TO SET SCALE)</span>
              </>
            )}
          </button>

          <span className="text-sm text-slate-300 font-mono">
            Diffraction Limit: <strong className="text-cyan-300 font-black">40 µm</strong> | Metrology Standard: <strong className="text-cyan-300 font-black">ISO/DIS 24187</strong>
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3.5">
          <button
            type="button"
            onClick={handleToggleStreamClick}
            className={`flex items-center space-x-2.5 px-6 py-3.5 rounded-2xl text-sm font-black tracking-wider uppercase border-2 transition-all cursor-pointer active:scale-95 ${
              isStreaming
                ? 'bg-rose-500/25 hover:bg-rose-500/35 border-rose-400 text-rose-200 shadow-[0_0_25px_rgba(244,63,94,0.45)]'
                : 'bg-white/10 hover:bg-white/20 border-white/20 text-slate-100'
            }`}
          >
            {isStreaming ? (
              <>
                <Square className="w-4 h-4 fill-rose-400 text-rose-400" />
                <span>Stop Cam</span>
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-ping ml-1" />
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-cyan-400 text-cyan-400" />
                <span>Live Cam</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleScanClick}
            disabled={isScanning || isStreaming}
            className={`flex items-center justify-center space-x-2.5 px-9 py-3.5 rounded-2xl text-base font-black tracking-widest uppercase transition-all duration-200 border-2 cursor-pointer select-none active:scale-95 ${
              isScanning || isStreaming
                ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400/40 cursor-not-allowed shadow-none'
                : 'bg-cyan-500/25 hover:bg-cyan-500/40 border-cyan-400 text-cyan-200 shadow-[0_0_35px_rgba(6,182,212,0.45)] hover:shadow-[0_0_45px_rgba(6,182,212,0.65)]'
            }`}
          >
            {isScanning ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                <span>ANALYZING...</span>
              </>
            ) : (
              <span>SCAN SAMPLE</span>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
};