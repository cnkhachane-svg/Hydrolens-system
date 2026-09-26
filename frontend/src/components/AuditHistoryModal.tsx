import React, { useEffect, useState } from 'react';

interface AuditRecord {
  id: number;
  timestamp: string;
  sample_volume_ml: number;
  total_particles: number;
  particles_per_liter: number;
  confidence_score: number;
  fiber_count: number;
  fragment_count: number;
  film_count: number;
  pellet_count: number;
  risk_level: string;
  requires_lab_confirmation: boolean;
}

interface AuditHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuditHistoryModal: React.FC<AuditHistoryModalProps> = ({ isOpen, onClose }) => {
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      fetch('http://127.0.0.1:8000/api/v1/audits')
        .then(res => res.json())
        .then(data => setAudits(Array.isArray(data) ? data : []))
        .catch(err => console.error("Failed to fetch audits:", err))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-4xl max-h-[85vh] bg-[#0c121e] border-2 border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700/80 bg-[#080d17]">
          <div>
            <h2 className="text-lg font-black uppercase tracking-wider text-cyan-400">
              ISO/DIS 24187 Compliance Scan Log
            </h2>
            <p className="text-xs text-slate-400">Persistent SQLite database records of all verified runs</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-auto p-5">
          {isLoading ? (
            <div className="py-20 text-center text-cyan-400 font-mono text-sm animate-pulse">
              Reading SQLite Audit Ledger...
            </div>
          ) : audits.length === 0 ? (
            <div className="py-20 text-center text-slate-500 text-sm">
              No historical screening audits recorded yet. Run a scan to log your first session.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Session</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Volume</th>
                  <th className="py-2.5 px-3">Count</th>
                  <th className="py-2.5 px-3">Concentration</th>
                  <th className="py-2.5 px-3">Morphology (F/Fr/Fl/P)</th>
                  <th className="py-2.5 px-3">ISO Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {audits.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-3 font-bold text-cyan-300">#{a.id}</td>
                    <td className="py-3 px-3 text-slate-400">{a.timestamp}</td>
                    <td className="py-3 px-3">{a.sample_volume_ml} mL</td>
                    <td className="py-3 px-3 font-bold text-white">{a.total_particles}</td>
                    <td className="py-3 px-3 text-cyan-400">{a.particles_per_liter} / L</td>
                    <td className="py-3 px-3 text-slate-300">
                      {a.fiber_count} / {a.fragment_count} / {a.film_count} / {a.pellet_count}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        a.requires_lab_confirmation 
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' 
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}>
                        {a.risk_level}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#080d17] flex justify-between items-center text-xs text-slate-400">
          <span>Target Standard: ISO/DIS 24187 Technical Specification</span>
          <button 
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold cursor-pointer transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};