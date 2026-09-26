import React, { useState } from 'react';
import { Target, Check, X, FileCheck2, Beaker, ArrowRight, ArrowLeft, ShieldCheck } from 'lucide-react';

interface CalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentScale: number;
  onApplyCalibration: (newScale: number, blankCount: number) => void;
  currentBlankCount?: number;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({
  isOpen,
  onClose,
  currentScale,
  onApplyCalibration,
  currentBlankCount = 0
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [scaleInput, setScaleInput] = useState<number>(currentScale);
  const [blankCountInput, setBlankCountInput] = useState<number>(currentBlankCount);
  const [selectedStandard, setSelectedStandard] = useState<string>('grid-100');

  if (!isOpen) return null;

  const handleApply = () => {
    onApplyCalibration(scaleInput, blankCountInput);
    onClose();
    setStep(1);
  };

  const handlePresetSelect = (preset: string) => {
    setSelectedStandard(preset);
    if (preset === 'grid-100') setScaleInput(4.5);
    else if (preset === 'grid-50') setScaleInput(2.25);
    else if (preset === 'beads-10') setScaleInput(10.1);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-[#0c1017] border-2 border-slate-700 rounded-3xl w-full max-w-xl p-6 text-slate-100 shadow-2xl space-y-6">
        
        {/* Header Bay */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-wider text-white">
                Optical Calibration & Blank Control SOP
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                ISO/DIS 24187 Quality Assurance Gate
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Step Indicator */}
        <div className="grid grid-cols-3 gap-2">
          <div className={`h-1.5 rounded-full transition-colors ${step >= 1 ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-slate-800'}`} />
          <div className={`h-1.5 rounded-full transition-colors ${step >= 2 ? 'bg-indigo-400 shadow-[0_0_8px_#818cf8]' : 'bg-slate-800'}`} />
          <div className={`h-1.5 rounded-full transition-colors ${step === 3 ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-800'}`} />
        </div>

        {/* STEP 1: Spatial Scale Target */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-cyan-400 tracking-wider">
              <FileCheck2 className="w-4 h-4" />
              <span>Step 1: Select Spatial Resolution Standard</span>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => handlePresetSelect('grid-100')}
                className={`p-3 rounded-xl border text-left transition ${
                  selectedStandard === 'grid-100'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                    : 'bg-black/40 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                <div className="text-xs font-black">100 µm Grid</div>
                <div className="text-[10px] text-slate-400 mt-1">4.5 µm/px</div>
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect('grid-50')}
                className={`p-3 rounded-xl border text-left transition ${
                  selectedStandard === 'grid-50'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                    : 'bg-black/40 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                <div className="text-xs font-black">50 µm Micrometer</div>
                <div className="text-[10px] text-slate-400 mt-1">2.25 µm/px</div>
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect('beads-10')}
                className={`p-3 rounded-xl border text-left transition ${
                  selectedStandard === 'beads-10'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                    : 'bg-black/40 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                <div className="text-xs font-black">Macro Chamber</div>
                <div className="text-[10px] text-slate-400 mt-1">10.1 µm/px</div>
              </button>
            </div>

            <div className="p-3.5 bg-black/50 border border-slate-800 rounded-2xl flex items-center justify-between">
              <span className="text-xs text-slate-300 font-bold uppercase">Conversion Factor:</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.05"
                  min="0.1"
                  value={scaleInput}
                  onChange={(e) => setScaleInput(Math.max(0.1, Number(e.target.value)))}
                  className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-sm font-mono font-black text-cyan-300 text-right focus:outline-none focus:border-cyan-400"
                />
                <span className="text-xs font-mono text-slate-400">µm/px</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: DI Water Blank Reference Control */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-indigo-400 tracking-wider">
              <Beaker className="w-4 h-4" />
              <span>Step 2: Blank Control Baseline Subtraction</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Standard operating protocols mandate measuring an environmental blank (filtered deionized water) in the chamber before evaluating test aliquots. Any baseline particulate count will be deducted from your final concentration.
            </p>

            <div className="p-4 rounded-2xl bg-black/60 border border-indigo-500/30 flex items-center justify-between">
              <div>
                <div className="text-xs font-black text-slate-200 uppercase">Blank Particulate Count</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Particles registered during pure DI water pre-run</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={blankCountInput}
                  onChange={(e) => setBlankCountInput(Math.max(0, Number(e.target.value)))}
                  className="w-20 bg-slate-900 border border-indigo-500/50 rounded-lg px-2 py-1.5 text-base font-mono font-black text-indigo-300 text-center focus:outline-none focus:border-indigo-400"
                />
                <span className="text-xs text-slate-400">counts</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Quality Gate Lock */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-emerald-400 tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>Step 3: Verification & Concentration Release</span>
            </div>
            
            <div className="p-4 rounded-2xl bg-black/60 border border-emerald-500/30 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-300">
                <span>Spatial Scale:</span>
                <strong className="text-cyan-400">{scaleInput} µm/px</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Blank Offset:</span>
                <strong className="text-indigo-400">-{blankCountInput} particles</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Diffraction Boundary:</span>
                <strong className="text-slate-400">≥ 40 µm ESD</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Polymer Scope:</span>
                <strong className="text-amber-400">Morphology Only (FTIR Optional)</strong>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 italic">
              Clicking below confirms the instrument is optical-standard aligned and unlocks real-time particle concentration reporting (particles/L).
            </p>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => (prev - 1) as any)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-800 hover:bg-white/5 text-xs font-bold text-slate-400 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : <div />}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => (prev + 1) as any)}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-300 text-xs font-black tracking-wider uppercase transition"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleApply}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500/25 hover:bg-emerald-500/35 border-2 border-emerald-400 text-emerald-200 text-xs font-black tracking-wider uppercase transition shadow-[0_0_20px_rgba(16,185,129,0.3)]"
            >
              <Check className="w-4 h-4" />
              <span>Verify & Unlock Concentration</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};