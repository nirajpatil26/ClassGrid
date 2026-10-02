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

  // Ensure native Google button renders if we mount when SDK is already ready
  useEffect(() => {
    if (!currentUser && typeof window !== 'undefined' && window.google?.accounts?.id) {
      const container = document.getElementById('google-signin-btn-container');
      if (container && !container.hasChildNodes()) {
        try {
          window.google.accounts.id.renderButton(container, {
            type: 'standard',
            theme: 'filled_black',
            size: 'medium',
            text: 'signin_with',
            shape: 'pill',
            logo_alignment: 'left',
          });
        } catch (e) {
          console.warn('Google renderButton error', e);
        }
      }
    }
  }, [currentUser]);
  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date());

  return (
    <header className="sticky top-0 z-30 bg-[#08070d]/95 backdrop-blur-md border-b border-fuchsia-950/80 px-3 sm:px-4 py-2.5 sm:py-3 shadow-[0_4px_20px_rgba(217,70,239,0.05)]">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-y-3 gap-x-2">
        {/* Left: Brand & Institution */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-fuchsia-600 via-pink-600 to-rose-600 p-[1px] shadow-[0_0_12px_rgba(217,70,239,0.4)] shrink-0">
            <div className="w-full h-full bg-[#0d0a17] rounded-[11px] flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-fuchsia-400" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-bold text-xs sm:text-sm tracking-tight text-white truncate">
                {institution || 'ClassGrid'}
              </span>
              {semester && (
                <span className="hidden sm:inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-fuchsia-950/60 text-fuchsia-300 border border-fuchsia-800/40 truncate">
                  {semester}
                </span>
              )}
            </div>
            <div className="text-[10px] sm:text-xs text-slate-300 flex items-center gap-1.5 truncate mt-0.5">
              <span className="px-1.5 py-0.2 rounded-full bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40 text-[8px] sm:text-[9px] font-black uppercase tracking-wider shadow-[0_0_6px_rgba(217,70,239,0.3)]">
                TODAY
              </span>
              <span className="font-medium text-slate-300 truncate">{todayFormatted}</span>
            </div>
          </div>
        </div>

        {/* Center: Division & Batch Selectors (Drops to second line on mobile) */}
        {divisions.length > 0 && (
          <div className="flex items-center gap-1.5 order-3 sm:order-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {/* Division Selector */}
            <div className="relative flex items-center flex-1 sm:flex-none">
              <Layers className="w-3.5 h-3.5 text-fuchsia-400 absolute left-2.5 pointer-events-none" />
              <select
                value={activeDivisionId}
                onChange={(e) => onSelectDivision(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs font-semibold rounded-lg bg-[#120f1f] border border-fuchsia-900/50 text-fuchsia-100 focus:outline-none focus:border-fuchsia-500 appearance-none cursor-pointer hover:bg-fuchsia-950/40 transition-colors shadow-2xs"
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

            {/* Lab Group / Batch Selector */}
            {availableGroups.length > 0 && (
              <div className="relative flex items-center flex-1 sm:flex-none">
                <Users className="w-3.5 h-3.5 text-pink-400 absolute left-2.5 pointer-events-none" />
                <select
                  value={activeGroupId}
                  onChange={(e) => onSelectGroup?.(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 text-xs font-bold rounded-lg bg-[#150d24] border border-pink-700/60 text-pink-200 focus:outline-none focus:border-pink-500 appearance-none cursor-pointer hover:bg-pink-950/40 transition-colors shadow-[0_0_10px_rgba(244,114,182,0.15)]"
                  aria-label="Select Lab Group / Batch"
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

        {/* Right: Actions (Upload, Settings, Auth) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 order-2 sm:order-3">
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white shadow-[0_0_12px_rgba(217,70,239,0.35)] transition-all active:scale-95"
            title="Upload New Timetable PDF"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Upload PDF</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg bg-[#120f1f] hover:bg-fuchsia-950/40 text-slate-400 hover:text-fuchsia-300 border border-fuchsia-950 hover:border-fuchsia-800/60 transition-colors"
            title="Settings"
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
            <div className="h-8 flex items-center shrink-0 min-w-[120px] ml-1 overflow-hidden rounded-lg">
              <div id="google-signin-btn-container" className="scale-90 origin-right sm:scale-100" />
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
