import React, { useState } from 'react';
import type { Division, AttendanceRecord } from '../types/timetable';
import { StorageService } from '../services/storage';
import { 
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck, 
  Target, 
  Calendar, 
  Check, 
  X, 
  Ban,
  History
} from 'lucide-react';
import { formatFriendlyDate } from '../utils/dateUtils';

interface AttendanceViewProps {
  division: Division;
  attendanceRecords: AttendanceRecord[];
  targetPercentage?: number;
  onUpdateTarget?: (target: number) => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  division,
  attendanceRecords,
  targetPercentage = 75,
  onUpdateTarget,
}) => {
  const [currentTarget, setCurrentTarget] = useState(targetPercentage);

  const stats = StorageService.calculateStats(
    division,
    attendanceRecords,
    currentTarget
  );

  const totalAttended = stats.reduce((sum, s) => sum + s.attended, 0);
  const totalConducted = stats.reduce((sum, s) => sum + s.totalConducted, 0);
  const overallPercentage =
    totalConducted > 0 ? Math.round((totalAttended / totalConducted) * 100) : 100;

  const isOverallSafe = overallPercentage >= currentTarget;

  const handleTargetChange = (newTarget: number) => {
    setCurrentTarget(newTarget);
    if (onUpdateTarget) onUpdateTarget(newTarget);
  };

  // Recent attendance history for this division sorted by date descending
  const recentDivisionLogs = attendanceRecords
    .filter((r) => r.divisionId === division.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-4">
      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Overall Percentage */}
        <div className="p-4 rounded-xl bg-[#0c0a15] border border-fuchsia-950/80 shadow-[0_0_15px_rgba(217,70,239,0.06)] space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Overall Attendance</span>
            {isOverallSafe ? (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                On Track
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-rose-400 font-bold">
                <AlertTriangle className="w-3.5 h-3.5" />
                Shortage
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-white tracking-tight">
              {overallPercentage}%
            </span>
            <span className="text-xs text-fuchsia-300/80 font-mono">
              ({totalAttended} / {totalConducted} classes)
            </span>
          </div>
          <div className="w-full bg-[#160f24] h-2 rounded-full overflow-hidden mt-2 border border-fuchsia-950/60">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isOverallSafe ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-gradient-to-r from-rose-500 to-fuchsia-600 shadow-[0_0_10px_rgba(244,63,94,0.5)]'
              }`}
              style={{ width: `${Math.min(overallPercentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Classes Attended vs Missed */}
        <div className="p-4 rounded-xl bg-[#0c0a15] border border-fuchsia-950/80 shadow-[0_0_15px_rgba(217,70,239,0.06)] flex flex-col justify-between">
          <span className="text-xs text-slate-300 font-semibold">Class Breakdown</span>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div className="bg-[#120f20] p-2.5 rounded-lg border border-fuchsia-950/70">
              <span className="text-[11px] text-slate-400 block font-medium">Attended</span>
              <span className="text-lg font-black font-mono text-emerald-400">
                {totalAttended}
              </span>
            </div>
            <div className="bg-[#120f20] p-2.5 rounded-lg border border-fuchsia-950/70">
              <span className="text-[11px] text-slate-400 block font-medium">Missed</span>
              <span className="text-lg font-black font-mono text-rose-400">
                {totalConducted - totalAttended}
              </span>
            </div>
          </div>
        </div>

        {/* Target Slider */}
        <div className="p-4 rounded-xl bg-[#0c0a15] border border-fuchsia-950/80 shadow-[0_0_15px_rgba(217,70,239,0.06)] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-fuchsia-400" />
              Target Goal
            </span>
            <span className="font-mono font-black text-fuchsia-300 text-sm bg-fuchsia-950/70 px-2 py-0.5 rounded border border-fuchsia-800/50">
              {currentTarget}%
            </span>
          </div>
          <input
            type="range"
            min={60}
            max={90}
            step={5}
            value={currentTarget}
            onChange={(e) => handleTargetChange(Number(e.target.value))}
            className="w-full h-2 bg-[#170e24] rounded-lg appearance-none cursor-pointer accent-fuchsia-500"
          />
          <div className="flex justify-between text-[10px] text-fuchsia-400/80 font-mono">
            <span>60%</span>
            <span>75%</span>
            <span>90%</span>
          </div>
        </div>
      </div>

      {/* Subject-Wise Analytics */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span className="font-medium text-slate-300">
            Subject-Wise Attendance ({stats.length} subjects)
          </span>
          <span>Target: {currentTarget}%</span>
        </div>

        {stats.length === 0 ? (
          <div className="text-center py-10 rounded-xl bg-slate-900/40 border border-slate-800/60 text-slate-400 text-xs">
            No subjects found in this division timetable.
          </div>
        ) : (
          <div className="space-y-2.5">
            {stats.map((s) => {
              const isSafe = s.percentage >= currentTarget;
              return (
                <div
                  key={s.subjectCode}
                  className="p-3.5 rounded-xl bg-[#0c0a15] border border-fuchsia-950/80 hover:border-fuchsia-800/60 transition-all shadow-2xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    {/* Subject info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-xs font-bold text-fuchsia-400">
                          {s.subjectCode}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {s.attended} of {s.totalConducted} classes attended
                        </span>
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                        {s.subjectName}
                      </h4>
                    </div>

                    {/* Percentage & Bunk status */}
                    <div className="shrink-0 flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-fuchsia-950/70">
                      <div className="text-left sm:text-right">
                        <span
                          className={`font-mono text-lg font-black ${
                            isSafe ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {s.totalConducted > 0 ? `${s.percentage}%` : 'N/A'}
                        </span>
                      </div>

                      {/* Safe / Deficit badge */}
                      <div>
                        {s.totalConducted === 0 ? (
                          <span className="text-[11px] text-slate-400 bg-[#120f20] px-2.5 py-0.5 rounded border border-fuchsia-950">
                            No sessions yet
                          </span>
                        ) : isSafe ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-600/50 shadow-[0_0_8px_rgba(34,197,94,0.2)]">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {s.targetSafeOrDeficit > 0
                              ? `Can skip ${s.targetSafeOrDeficit} ${
                                  s.targetSafeOrDeficit === 1 ? 'class' : 'classes'
                                }`
                              : 'At target limit'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-950/50 px-2.5 py-1 rounded-lg border border-rose-600/50 shadow-[0_0_8px_rgba(244,63,94,0.2)]">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {`Attend ${Math.abs(s.targetSafeOrDeficit)} more ${
                              Math.abs(s.targetSafeOrDeficit) === 1 ? 'class' : 'classes'
                            }`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-[#160f24] h-1.5 rounded-full overflow-hidden mt-3 border border-fuchsia-950/60">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isSafe ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-rose-500 to-fuchsia-600'
                      }`}
                      style={{
                        width: `${s.totalConducted > 0 ? Math.min(s.percentage, 100) : 100}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Date-Aware Attendance Logs (Know What Happened When) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span className="font-bold text-white flex items-center gap-1.5">
            <History className="w-4 h-4 text-fuchsia-400" />
            <span>Attendance History Log (Date-by-Date)</span>
          </span>
          <span className="text-[11px] text-fuchsia-300/80 font-mono">
            {recentDivisionLogs.length} total entries recorded
          </span>
        </div>

        {recentDivisionLogs.length === 0 ? (
          <div className="text-center py-8 rounded-xl bg-[#0c0a15] border border-fuchsia-950/70 text-slate-400 text-xs">
            No attendance entries marked yet. Tap "Present" or "Absent" on any class in Today's View to start logging dates.
          </div>
        ) : (
          <div className="space-y-2">
            {recentDivisionLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-[#0c0a15] border border-fuchsia-950/70 hover:border-fuchsia-900/60 flex items-center justify-between gap-3 text-xs transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-[#140f22] border border-fuchsia-950 flex items-center justify-center shrink-0">
                    {log.status === 'present' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                    ) : log.status === 'absent' ? (
                      <X className="w-3.5 h-3.5 text-rose-400 stroke-[2.5]" />
                    ) : (
                      <Ban className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white truncate">
                        {log.subjectName}
                      </span>
                      <span className="text-[10px] font-mono text-fuchsia-300/80">
                        ({log.subjectCode})
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3 text-fuchsia-400" />
                      <span>{formatFriendlyDate(log.date)}</span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      log.status === 'present'
                        ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-600/60 shadow-[0_0_8px_rgba(34,197,94,0.3)]'
                        : log.status === 'absent'
                        ? 'bg-rose-950/70 text-rose-300 border border-rose-600/60 shadow-[0_0_8px_rgba(244,63,94,0.3)]'
                        : 'bg-[#181126] text-slate-300 border border-fuchsia-950'
                    }`}
                  >
                    {log.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
