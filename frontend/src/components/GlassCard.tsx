import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  glow?: 'cyan' | 'red' | 'emerald' | 'none';
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', glow = 'none' }) => {
  const glowStyles = {
    cyan: 'border-cyan-500/30 shadow-[0_0_25px_rgba(6,182,212,0.1)]',
    red: 'border-rose-500/40 shadow-[0_0_25px_rgba(244,63,94,0.12)]',
    emerald: 'border-emerald-500/30 shadow-[0_0_25px_rgba(16,185,129,0.1)]',
    none: 'border-white/[0.08]'
  };

  return (
    <div className={`relative overflow-hidden rounded-xl bg-slate-900/50 backdrop-blur-md border ${glowStyles[glow]} p-4 transition-all duration-300 ${className}`}>
      <div className="absolute -top-10 -right-10 w-28 h-28 bg-cyan-500/[0.03] rounded-full blur-2xl pointer-events-none" />
      {children}
    </div>
  );
};