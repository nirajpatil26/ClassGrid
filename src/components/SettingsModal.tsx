import React, { useState } from 'react';
import { 
  X, 
  Settings, 
  Smartphone, 
  Trash2, 
  Check, 
  Download
} from 'lucide-react';
import { StorageService, type AppSettings } from '../services/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsSaved,
}) => {
  const [settings, setSettings] = useState<AppSettings>(() => StorageService.getSettings());
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.saveSettings(settings);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onSettingsSaved();
      onClose();
    }, 700);
  };

  const handleExportBackup = () => {
    const data = {
      timetables: StorageService.getTimetables(),
      attendance: StorageService.getAttendance(),
      lectureNotes: StorageService.getNotes(),
      settings: StorageService.getSettings(),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ClassGrid_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResetData = () => {
    if (
      confirm(
        'Are you sure you want to reset all data (attendance records, lecture notes, custom timetables)? This cannot be undone.'
      )
    ) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div 
        className="w-full max-w-md bg-[#11131a] border border-slate-800 rounded-xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-[#0c0e14]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-200">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">App Settings</h2>
              <p className="text-xs text-slate-400">AI scanning, targets & offline backups</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">

          {/* Target Attendance */}
          <div className="space-y-1.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <div className="flex items-center justify-between text-xs">
              <label className="font-medium text-slate-200">
                Target Attendance Goal: <span className="font-mono text-emerald-400 font-bold">{settings.targetAttendance}%</span>
              </label>
            </div>
            <input
              type="range"
              min={60}
              max={95}
              step={5}
              value={settings.targetAttendance}
              onChange={(e) => setSettings({ ...settings, targetAttendance: Number(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-slate-300 mt-2"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>60%</span>
              <span>75% (Standard)</span>
              <span>95%</span>
            </div>
          </div>

          {/* Backup / Export */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
            <div className="text-xs">
              <span className="font-medium text-slate-200 block">Backup App Data</span>
              <span className="text-[11px] text-slate-400">Export schedule, attendance, and notes</span>
            </div>
            <button
              type="button"
              onClick={handleExportBackup}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>

          {/* Mobile Offline Install Guide */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-medium text-slate-200">
              <Smartphone className="w-3.5 h-3.5 text-slate-400" />
              <span>Install to Mobile (PWA)</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Open the app address in <strong>Chrome</strong> (Android) or <strong>Safari</strong> (iPhone), tap the browser menu, and tap <span className="text-slate-300 font-medium">"Add to Home Screen"</span>.
            </p>
          </div>

          {/* Danger Zone: Reset Data */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <button
              type="button"
              onClick={handleResetData}
              className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 hover:underline py-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Reset All
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-medium rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white transition-colors"
              >
                {savedSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Saved
                  </>
                ) : (
                  'Save Settings'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
