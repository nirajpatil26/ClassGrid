import React, { useState } from 'react';
import type { Division, TimetableSlot } from '../types/timetable';
import { MapPin, ArrowLeft, Filter, Calendar, Clock } from 'lucide-react';
import { getCurrentWeekDates, isSlotHappeningNow } from '../utils/dateUtils';

interface WeeklyGridViewProps {
  division: Division;
  onBackToToday: () => void;
  onSelectSlot?: (slot: TimetableSlot) => void;
}

export const WeeklyGridView: React.FC<WeeklyGridViewProps> = ({
  division,
  onBackToToday,
  onSelectSlot,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const weekDays = getCurrentWeekDates();
  const todayInfo = weekDays.find((w) => w.isToday) || weekDays[0];

  const filteredSlots = division.slots.filter((s) => {
    if (filterType === 'all') return true;
    return s.type === filterType;
  });

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              onClick={onBackToToday}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Today's View</span>
            </button>
            <h2 className="text-sm font-semibold text-slate-100">
              Weekly Timetable — {division.name}
            </h2>
          </div>
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              Week of {weekDays[0]?.shortDate} – {weekDays[weekDays.length - 1]?.shortDate}
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-indigo-300 font-medium">
              Today is {todayInfo.fullDate}
            </span>
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-fuchsia-400" />
          <div className="flex items-center gap-1 bg-[#0e0c18] p-1 rounded-lg border border-fuchsia-950/80">
            {['all', 'lecture', 'lab'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2.5 py-1 rounded text-xs font-semibold capitalize transition-all ${
                  filterType === type
                    ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-[0_0_10px_rgba(217,70,239,0.35)]'
                    : 'text-slate-400 hover:text-fuchsia-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid container with horizontal scroll for mobile and desktop */}
      <div className="rounded-xl border border-fuchsia-950/80 bg-[#08060f] overflow-hidden shadow-[0_0_20px_rgba(217,70,239,0.08)]">
        <div className="overflow-x-auto">
          <div className="min-w-[820px]">
            {/* Table Header: Days with Dates & Today Highlight */}
            <div className="grid grid-cols-6 border-b border-fuchsia-950 bg-[#0d0a17] text-xs font-semibold text-center divide-x divide-fuchsia-950/70">
              {weekDays.map((weekDay) => {
                return (
                  <div
                    key={weekDay.day}
                    className={`py-3 px-2 transition-colors ${
                      weekDay.isToday
                        ? 'bg-fuchsia-950/40 text-fuchsia-200 border-b-2 border-fuchsia-500 shadow-[inset_0_-2px_10px_rgba(217,70,239,0.2)]'
                        : 'text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="font-bold">{weekDay.day}</span>
                      {weekDay.isToday && (
                        <span className="px-1.5 py-0.2 rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white text-[9px] font-black tracking-wider uppercase shadow-[0_0_8px_rgba(217,70,239,0.6)]">
                          Today
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-[11px] font-mono mt-0.5 ${
                        weekDay.isToday ? 'text-fuchsia-300 font-bold' : 'text-slate-400'
                      }`}
                    >
                      {weekDay.shortDate}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Days Columns View */}
            <div className="grid grid-cols-6 divide-x divide-fuchsia-950/70 min-h-[480px]">
              {weekDays.map((weekDay) => {
                const daySlots = filteredSlots
                  .filter((s) => s.day === weekDay.day)
                  .sort((a, b) => a.startTime.localeCompare(b.startTime));

                return (
                  <div
                    key={weekDay.day}
                    className={`p-2.5 space-y-2.5 transition-colors ${
                      weekDay.isToday
                        ? 'bg-fuchsia-950/15 ring-1 ring-inset ring-fuchsia-500/20'
                        : 'bg-[#08060f]'
                    }`}
                  >
                    {daySlots.length === 0 ? (
                      <div className="text-center py-12 text-[11px] text-slate-500">
                        No classes scheduled
                      </div>
                    ) : (
                      daySlots.map((slot) => {
                        const isLive = weekDay.isToday && isSlotHappeningNow(slot.startTime, slot.endTime);

                        return (
                          <div
                            key={slot.id}
                            onClick={() => onSelectSlot && onSelectSlot(slot)}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer group shadow-2xs ${
                              isLive
                                ? 'bg-[#190e2b] border-fuchsia-500 ring-1 ring-fuchsia-400 shadow-[0_0_15px_rgba(217,70,239,0.35)]'
                                : weekDay.isToday
                                ? 'bg-[#120d20] border-fuchsia-900/60 hover:border-fuchsia-600'
                                : 'bg-[#0e0c18] border-fuchsia-950/70 hover:border-fuchsia-900/60'
                            }`}
                          >
                            {/* Live Badge */}
                            {isLive && (
                              <div className="flex items-center gap-1 text-[9px] font-black text-emerald-400 tracking-wider uppercase mb-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                <span>Live Now</span>
                              </div>
                            )}

                            {/* Time & Slot Type */}
                            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                              <span className="font-mono font-medium flex items-center gap-1 text-slate-300">
                                <Clock className="w-2.5 h-2.5 text-fuchsia-400" />
                                {slot.startTime} - {slot.endTime}
                              </span>
                              <span className="uppercase text-[9px] font-semibold px-1 py-0.2 rounded bg-[#170e24] text-fuchsia-300 border border-fuchsia-900/40">
                                {slot.type}
                              </span>
                            </div>

                            {/* Subject Title */}
                            <div className="font-bold text-xs text-white line-clamp-2 leading-tight">
                              {slot.subjectName}
                            </div>

                            {/* Subject Code */}
                            <div className="text-[11px] text-fuchsia-300/80 font-mono mt-0.5 truncate">
                              {slot.subjectCode}
                            </div>

                            {/* Classroom Number prominently displayed */}
                            <div className="mt-2 pt-1.5 border-t border-fuchsia-950/60 flex items-center justify-between">
                              <div
                                className={`flex items-center gap-1 text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-lg border ${
                                  weekDay.isToday
                                    ? 'bg-[#1a0e2b] border-fuchsia-700/70 text-fuchsia-200'
                                    : 'bg-[#140f22] border-fuchsia-900/50 text-slate-200'
                                }`}
                              >
                                <MapPin className="w-3 h-3 text-fuchsia-400" />
                                <span>{slot.room}</span>
                              </div>
                              {slot.batch && slot.batch !== 'All' && (
                                <span className="text-[10px] text-fuchsia-400/80 font-mono">
                                  B:{slot.batch}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
