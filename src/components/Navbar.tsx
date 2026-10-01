import React from 'react';
import { Calendar, Layers, Upload, Settings, Users } from 'lucide-react';
import type { Division } from '../types/timetable';

interface NavbarProps {
  institution?: string;
  semester?: string;
  divisions: Division[];
  activeDivisionId: string;
  onSelectDivision: (id: string) => void;
  availableGroups?: string[];
  activeGroupId?: string;
  onSelectGroup?: (group: string) => void;
  onOpenUpload: () => void;
  onOpenSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  institution,
  semester,
  divisions,
  activeDivisionId,
  onSelectDivision,
  availableGroups = [],
  activeGroupId = 'All',
  onSelectGroup,
  onOpenUpload,
  onOpenSettings,
}) => {
  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date());

  return (
    <header className="sticky top-0 z-30 bg-[#08070d]/95 backdrop-blur-md border-b border-fuchsia-950/80 px-4 py-3 shadow-[0_4px_20px_rgba(217,70,239,0.05)]">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        {/* Left: Brand & Institution */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-600 via-pink-600 to-rose-600 p-[1px] shadow-[0_0_12px_rgba(217,70,239,0.4)] shrink-0">
            <div className="w-full h-full bg-[#0d0a17] rounded-[11px] flex items-center justify-center">
              <Calendar className="w-4 h-4 text-fuchsia-400" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-white truncate">
                {institution || 'ClassGrid'}
              </span>
              {semester && (
                <span className="hidden sm:inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-fuchsia-950/60 text-fuchsia-300 border border-fuchsia-800/40">
                  {semester}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-300 flex items-center gap-1.5 truncate mt-0.5">
              <span className="px-1.5 py-0.2 rounded-full bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40 text-[9px] font-black uppercase tracking-wider shadow-[0_0_6px_rgba(217,70,239,0.3)]">
                TODAY
              </span>
              <span className="font-medium text-slate-300">{todayFormatted}</span>
            </div>
          </div>
        </div>

        {/* Right: Division Selector & Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {divisions.length > 0 && (
            <div className="flex items-center gap-1.5">
              {/* Division Selector */}
              <div className="relative flex items-center">
                <Layers className="w-3.5 h-3.5 text-fuchsia-400 absolute left-2.5 pointer-events-none" />
                <select
                  value={activeDivisionId}
                  onChange={(e) => onSelectDivision(e.target.value)}
                  className="pl-8 pr-7 py-1.5 text-xs font-semibold rounded-lg bg-[#120f1f] border border-fuchsia-900/50 text-fuchsia-100 focus:outline-none focus:border-fuchsia-500 appearance-none cursor-pointer hover:bg-fuchsia-950/40 transition-colors shadow-2xs"
                  aria-label="Select Division"
                >
                  {divisions.map((div) => (
                    <option key={div.id} value={div.id} className="bg-[#120f1f] text-slate-100">
                      {div.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-2 text-fuchsia-400 text-[10px]">▼</div>
              </div>

              {/* Lab Group / Batch Selector (e.g. Q1, Q2, Q3) */}
              {availableGroups.length > 0 && (
                <div className="relative flex items-center">
                  <Users className="w-3.5 h-3.5 text-pink-400 absolute left-2.5 pointer-events-none" />
                  <select
                    value={activeGroupId}
                    onChange={(e) => onSelectGroup?.(e.target.value)}
                    className="pl-8 pr-7 py-1.5 text-xs font-bold rounded-lg bg-[#150d24] border border-pink-700/60 text-pink-200 focus:outline-none focus:border-pink-500 appearance-none cursor-pointer hover:bg-pink-950/40 transition-colors shadow-[0_0_10px_rgba(244,114,182,0.15)]"
                    aria-label="Select Lab Group / Batch"
                    title="Select your practical lab group"
                  >
                    <option value="All" className="bg-[#120f1f] text-slate-100 font-semibold">
                      All Batches
                    </option>
                    {availableGroups.map((grp) => (
                      <option key={grp} value={grp} className="bg-[#120f1f] text-pink-200 font-bold">
                        Group {grp}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-2 text-pink-400 text-[10px]">▼</div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white shadow-[0_0_12px_rgba(217,70,239,0.35)] transition-all active:scale-95"
            title="Upload New Timetable PDF"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Upload PDF</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg bg-[#120f1f] hover:bg-fuchsia-950/40 text-slate-400 hover:text-fuchsia-300 border border-fuchsia-950 hover:border-fuchsia-800/60 transition-colors"
            title="Settings & API Key"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
