import React, { useState, useRef, useEffect } from 'react';
import { Calendar, Layers, Upload, Settings, Users, LogOut, CheckCircle2 } from 'lucide-react';
import type { Division } from '../types/timetable';
import type { GoogleUserProfile } from '../services/auth';

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
  currentUser?: GoogleUserProfile | null;
  onSignIn?: () => void;
  onSignOut?: () => void;
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
  currentUser,
  onSignIn,
  onSignOut,
}) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
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

          {/* Google Profile or Sign In Button */}
          {currentUser ? (
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="relative rounded-full p-[1.5px] bg-gradient-to-r from-fuchsia-500 via-pink-500 to-rose-500 focus:outline-none transition-transform active:scale-95 shadow-[0_0_10px_rgba(217,70,239,0.3)] block"
                title={`${currentUser.name} (${currentUser.email}) - Cloud Sync Active`}
              >
                <img
                  src={currentUser.picture || 'https://lh3.googleusercontent.com/a/default-user'}
                  alt={currentUser.name}
                  className="w-7 h-7 rounded-full object-cover bg-slate-800"
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#08070d] rounded-full" />
              </button>

              {/* Profile Dropdown */}
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl bg-[#0f0b1a] border border-fuchsia-900/70 shadow-[0_10px_35px_rgba(0,0,0,0.8)] p-3 text-xs z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="flex items-center gap-2.5 pb-2.5 border-b border-fuchsia-950/80">
                    <img
                      src={currentUser.picture}
                      alt={currentUser.name}
                      className="w-9 h-9 rounded-full object-cover border border-fuchsia-800/80 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate text-xs">{currentUser.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{currentUser.email}</p>
                    </div>
                  </div>

                  <div className="py-2.5 flex items-center justify-between text-[11px] text-emerald-400">
                    <span className="flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Cloud Sync Active
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  </div>

                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      onSignOut?.();
                    }}
                    className="w-full mt-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-900/50 font-semibold transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onSignIn}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#140f24] hover:bg-[#1f1538] border border-fuchsia-800/60 text-fuchsia-200 text-xs font-semibold shadow-2xs transition-all active:scale-95"
              title="Sign in with Google for cloud sync"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.14z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.14C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.59H1.25C.45 8.18 0 10.02 0 12s.45 3.82 1.25 5.41l4.03-3.14z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.59l4.03 3.14c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span className="hidden sm:inline">Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
