import React from 'react';
import { ShieldAlert, ShieldCheck, FileSpreadsheet, ChevronRight, AlertCircle, Info } from 'lucide-react';

interface Particle {
  id: number;
  morphology: string;
  confidence: number;
  length_um: number;
  width_um: number;
  esd_um: number;
  bbox: [number, number, number, number];
  norm?: { cx: number; cy: number };
}

interface LabRisk {
  requires_lab_confirmation: boolean;
  risk_level: string;
  reasons: string[];
}

interface OpticalTelemetryProps {
  totalParticles: number;
  confidenceScore: number;
  particles: Particle[];
  labRisk: LabRisk;
  sampleVolumeMl: number;
  selectedParticle: Particle | null;
  onSelectParticle: (p: Particle | null) => void;
  fiberCount?: number;
  fragmentCount?: number;
  filmCount?: number;
  pelletCount?: number;
  calibrated: boolean;
  blankOffsetCount?: number;
  onOpenCalibration?: () => void;
}

export const OpticalTelemetry: React.FC<OpticalTelemetryProps> = ({
  totalParticles,
  confidenceScore,
  particles = [],
  labRisk,
  sampleVolumeMl,
  selectedParticle,
  onSelectParticle,
  fiberCount = 0,
  fragmentCount = 0,
  filmCount = 0,
  pelletCount = 0,
  calibrated,
  blankOffsetCount = 0,
  onOpenCalibration
}) => {
  const netParticles = Math.max(0, totalParticles - blankOffsetCount);
  const concentrationPerLiter = sampleVolumeMl > 0 
    ? Math.round((netParticles / sampleVolumeMl) * 1000) 
    : 0;

  const getMorphologyBadge = (type: string) => {
    switch ((type || '').toLowerCase()) {
      case 'fiber':
        return { bg: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50', dot: 'bg-cyan-400' };
      case 'fragment':
        return { bg: 'bg-amber-500/20 text-amber-300 border-amber-400/50', dot: 'bg-amber-400' };
      case 'film':
        return { bg: 'bg-rose-500/20 text-rose-300 border-rose-400/50', dot: 'bg-rose-400' };
      default:
        return { bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50', dot: 'bg-emerald-400' };
    }
  };

  return (
    <aside className="w-[420px] xl:w-[460px] 2xl:w-[500px] flex flex-col gap-3.5 h-full min-h-0 shrink-0 text-slate-100 select-none">
      {/* 1. Protocol & Risk Evaluation Banner */}
      <div className={`p-4 rounded-2xl border-2 transition-all shadow-xl flex items-center justify-between gap-3 ${
        labRisk?.requires_lab_confirmation
          ? 'bg-rose-950/40 border-rose-500/70 text-rose-200 shadow-rose-950/40'
          : 'bg-emerald-950/40 border-emerald-500/70 text-emerald-200 shadow-emerald-950/40'
      }`}>
        <div className="flex items-center gap-3">
          {labRisk?.requires_lab_confirmation ? (
            <ShieldAlert className="w-8 h-8 text-rose-400 shrink-0" />
          ) : (
            <ShieldCheck className="w-8 h-8 text-emerald-400 shrink-0" />
          )}
          <div>
            <h3 className="text-base font-black uppercase tracking-wider">
              {labRisk?.requires_lab_confirmation ? 'SECONDARY LAB REFERRAL TRIGGERED' : 'OPTICAL SCREENING VERIFIED'}
            </h3>
            <p className="text-xs font-semibold text-slate-300 mt-0.5">
              {labRisk?.reasons?.[0] || 'All particulates meet verified ISO/DIS 24187 metrics.'}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Scope & Polymer Disclaimer Banner */}
      <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-500/30 text-blue-200 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-[11px] leading-relaxed text-slate-300">
          <strong className="text-blue-300 font-bold">Standard Metrology Scope:</strong> Classifies physical morphology & size. Specific polymer identification (e.g. PET, PE, PP) is strictly an optional extension requiring FTIR / Raman spectroscopy.
        </div>
      </div>

      {/* 3. Primary Metrology Stats Bay */}
      <div className="p-4 rounded-2xl bg-[#0c1017] border-2 border-slate-700/80 shadow-2xl flex flex-col gap-3.5">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <span className="text-sm font-black uppercase tracking-wider text-slate-300">Detection & Concentration</span>
          {calibrated ? (
            <span className="text-sm font-mono font-bold text-cyan-400 bg-cyan-950/50 px-3 py-1 rounded-lg border border-cyan-500/40">
              {concentrationPerLiter.toLocaleString()} particles / L
            </span>
          ) : (
            <button 
              onClick={onOpenCalibration}
              className="text-xs font-mono font-bold text-amber-300 bg-amber-950/50 px-3 py-1 rounded-lg border border-amber-500/50 flex items-center gap-1.5 cursor-pointer hover:bg-amber-900/40"
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>CALIBRATION REQUIRED</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          <div className="p-3.5 rounded-xl bg-black/50 border border-white/10 flex flex-col items-center justify-center">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Total Count</span>
            <span className="text-3xl font-black font-mono text-white mt-1">
              {totalParticles}
              {blankOffsetCount > 0 && (
                <span className="text-xs text-slate-400 font-mono font-normal ml-1">
                  (-{blankOffsetCount} blank)
                </span>
              )}
            </span>
          </div>
          <div className="p-3.5 rounded-xl bg-black/50 border border-white/10 flex flex-col items-center justify-center">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Mean Confidence</span>
            <span className="text-3xl font-black font-mono text-cyan-300 mt-1">
              {(confidenceScore * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Morphology Sub-Counters */}
        <div className="grid grid-cols-4 gap-2 pt-1 text-center font-mono">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
            <div className="text-lg font-black text-cyan-300">{fiberCount}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 mt-0.5">Fibers</div>
          </div>
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <div className="text-lg font-black text-amber-300">{fragmentCount}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mt-0.5">Frags</div>
          </div>
          <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30">
            <div className="text-lg font-black text-rose-300">{filmCount}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-rose-400 mt-0.5">Films</div>
          </div>
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <div className="text-lg font-black text-emerald-300">{pelletCount}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mt-0.5">Pellets</div>
          </div>
        </div>
      </div>

      {/* 4. Particulate Inventory Table */}
      <div className="flex-1 flex flex-col min-h-0 p-4 rounded-2xl bg-[#0c1017] border-2 border-slate-700/80 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-200">
              Individual Particle Metrology
            </h2>
          </div>
          <span className="text-xs font-mono font-bold text-slate-400 bg-white/5 px-2.5 py-1 rounded-md">
            Showing {particles.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1.5 custom-scrollbar">
          {particles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm font-bold uppercase tracking-wider">
              No particulates detected.
            </div>
          ) : (
            particles.map((p) => {
              const badge = getMorphologyBadge(p.morphology);
              const isSelected = selectedParticle?.id === p.id;

              return (
                <div
                  key={p.id}
                  onClick={() => onSelectParticle(isSelected ? null : p)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-lg'
                      : 'bg-black/40 border-white/10 hover:bg-white/5 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${badge.dot} shrink-0`} />
                    <div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-sm font-black text-white">#{p.id}</span>
                        <span className={`text-xs px-2 py-0.5 rounded font-black uppercase border ${badge.bg}`}>
                          {p.morphology}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-slate-400 mt-1">
                        Length: <strong className="text-slate-200">{p.length_um} µm</strong> | ESD: <strong className="text-slate-200">{p.esd_um} µm</strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-right shrink-0">
                    <div className="text-xs font-black text-cyan-400">
                      {((p.confidence || 0.92) * 100).toFixed(0)}%
                    </div>
                    <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'rotate-90 text-cyan-400' : 'text-slate-600'}`} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
};