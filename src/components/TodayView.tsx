import React, { useState } from 'react';
import { 
  Clock, 
  MapPin, 
  User, 
  Check, 
  X, 
  Ban, 
  FileText, 
  Sparkles, 
  Calendar as CalendarIcon,
  Grid,
  Radio,
  Users
} from 'lucide-react';
import type { 
  Division, 
  DayOfWeek, 
  TimetableSlot, 
  AttendanceRecord, 
  LectureNote, 
  AttendanceStatus 
} from '../types/timetable';
import { getCurrentWeekDates, formatFriendlyDate } from '../utils/dateUtils';

interface TodayViewProps {
  division: Division;
  attendanceRecords: AttendanceRecord[];
  lectureNotes: LectureNote[];
  availableGroups?: string[];
  activeGroupId?: string;
  onSelectGroup?: (group: string) => void;
  onMarkAttendance: (
    date: string,
    slotId: string,
    subjectCode: string,
    subjectName: string,
    status: AttendanceStatus
  ) => void;
  onOpenNoteModal: (slot: TimetableSlot, date: string) => void;
  onSwitchToWeekly: () => void;
}

export const TodayView: React.FC<TodayViewProps> = ({
  division,
  attendanceRecords,
  lectureNotes,
  availableGroups = [],
  activeGroupId = 'All',
  onSelectGroup,
  onMarkAttendance,
  onOpenNoteModal,
  onSwitchToWeekly,
}) => {
  const weekDays = getCurrentWeekDates();
  const todayDayInfo = weekDays.find((w) => w.isToday) || weekDays[0];

  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(todayDayInfo.day);
  const [animationState, setAnimationState] = useState<{
    slotId: string;
    status: 'present' | 'absent' | 'cancelled';
  } | null>(null);

  // Get active week day info
  const activeDayInfo = weekDays.find((w) => w.day === selectedDay) || todayDayInfo;
  const selectedDate = activeDayInfo.dateStr;
  const isViewingToday = activeDayInfo.isToday;

  // Filter slots for selected day
  const daySlots = division.slots
    .filter((slot) => slot.day === selectedDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Quick helper to get attendance status for slot
  const getSlotAttendance = (slotId: string, date: string = selectedDate) => {
    return attendanceRecords.find(
      (r) => r.slotId === slotId && r.date === date && r.divisionId === division.id
    );
  };

  const isSlotCancelled = (slotId: string, date: string = selectedDate) => {
    return getSlotAttendance(slotId, date)?.status === 'cancelled';
  };

  // Quick helper to get lecture note for slot
  const getSlotNote = (slotId: string, date: string = selectedDate) => {
    return lectureNotes.find(
      (n) => n.slotId === slotId && n.date === date && n.divisionId === division.id
    );
  };

  // Tomorrow info helper
  const todayIndex = weekDays.findIndex((w) => w.isToday);
  const tomorrowInfo =
    todayIndex >= 0 && todayIndex < weekDays.length - 1
      ? weekDays[todayIndex + 1]
      : null;

  // Determine ongoing and next slot for today
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let currentSlot: TimetableSlot | null = null;
  let nextSlot: TimetableSlot | null = null;
  let nextSlotContextLabel = '';

  if (isViewingToday) {
    for (const slot of daySlots) {
      const [startH, startM] = slot.startTime.split(':').map(Number);
      const [endH, endM] = slot.endTime.split(':').map(Number);
      const startMin = startH * 60 + startM;
      const endMin = endH * 60 + endM;

      // When a slot is marked as cancelled, skip it from ongoing or upcoming
      if (isSlotCancelled(slot.id, selectedDate)) {
        continue;
      }

      if (currentMinutes >= startMin && currentMinutes < endMin && !currentSlot) {
        currentSlot = slot;
      } else if (currentMinutes < startMin && !nextSlot) {
        nextSlot = slot;
      }
    }

    // If no more classes are active/upcoming today, check tomorrow's upcoming class
    if (!currentSlot && !nextSlot && tomorrowInfo) {
      const tomorrowSlots = division.slots
        .filter((s) => s.day === tomorrowInfo.day)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      const firstTomorrowSlot = tomorrowSlots.find(
        (s) => !isSlotCancelled(s.id, tomorrowInfo.dateStr)
      );
      if (firstTomorrowSlot) {
        nextSlot = firstTomorrowSlot;
        nextSlotContextLabel = 'Tomorrow';
      }
    }
  }

  // Store ongoing slot ID to avoid ternary narrowing issues in JSX
  const ongoingSlotId = currentSlot?.id || null;

  // When viewing tomorrow or another day, find the next non-cancelled slot of that day
  let upcomingSlotForSelectedDay: TimetableSlot | null = null;
  if (!isViewingToday) {
    upcomingSlotForSelectedDay =
      daySlots.find((s) => !isSlotCancelled(s.id, selectedDate)) || null;
  }

  const handleAttendanceClick = (
    date: string,
    slotId: string,
    subjectCode: string,
    subjectName: string,
    status: AttendanceStatus
  ) => {
    setAnimationState({ slotId, status });
    setTimeout(() => {
      setAnimationState((curr) => (curr?.slotId === slotId ? null : curr));
    }, 950);
    onMarkAttendance(date, slotId, subjectCode, subjectName, status);
  };

  return (
    <div className="space-y-4">
      {/* Top Controls: Day selector + View toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-1">
        {/* Day Pills with Calendar Dates & Today Highlight */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 sm:pb-0 scrollbar-none">
          {weekDays.map((wDay) => {
            const isSelected = wDay.day === selectedDay;
            return (
              <button
                key={wDay.day}
                onClick={() => setSelectedDay(wDay.day)}
                className={`relative px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? wDay.isToday
                      ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white font-bold shadow-[0_0_15px_rgba(217,70,239,0.5)] ring-1 ring-fuchsia-400'
                      : 'bg-fuchsia-950/90 text-fuchsia-200 border border-fuchsia-500/80 font-bold shadow-[0_0_10px_rgba(217,70,239,0.25)]'
                    : wDay.isToday
                    ? 'bg-fuchsia-950/40 text-fuchsia-300 border border-fuchsia-800/60 hover:bg-fuchsia-900/50 shadow-2xs'
                    : 'bg-[#0e0c18] text-slate-400 hover:text-fuchsia-200 border border-fuchsia-950/70 hover:border-fuchsia-900/50'
                }`}
              >
                <span>{wDay.shortWeekday}</span>
                <span className={`text-[10px] font-mono ${isSelected ? 'opacity-90' : 'text-slate-500'}`}>
                  {wDay.dayNumber}
                </span>
                {wDay.isToday && (
                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-fuchsia-400 text-slate-950 uppercase tracking-tight shadow-[0_0_6px_rgba(232,121,249,0.8)]">
                    Today
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* View Grid Switcher */}
        <button
          onClick={onSwitchToWeekly}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#0e0c18] text-fuchsia-300 hover:text-white border border-fuchsia-950 hover:border-fuchsia-800/60 transition-all shadow-2xs hover:shadow-[0_0_10px_rgba(217,70,239,0.2)]"
        >
          <Grid className="w-3.5 h-3.5 text-fuchsia-400" />
          <span>Full Week Grid</span>
        </button>
      </div>

      {/* Lab Group / Batch Quick Selector */}
      {availableGroups.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 shrink-0 uppercase tracking-wider">
            <Users className="w-3.5 h-3.5 text-pink-400" />
            Lab Batch:
          </span>
          <button
            type="button"
            onClick={() => onSelectGroup?.('All')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 ${
              activeGroupId === 'All'
                ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-[0_0_10px_rgba(236,72,153,0.4)] font-bold'
                : 'bg-[#120d20] text-slate-400 hover:text-pink-300 border border-fuchsia-950/70'
            }`}
          >
            All Batches
          </button>
          {availableGroups.map((grp) => (
            <button
              key={grp}
              type="button"
              onClick={() => onSelectGroup?.(grp)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${
                activeGroupId === grp
                  ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-[0_0_12px_rgba(236,72,153,0.45)] ring-1 ring-pink-400'
                  : 'bg-[#120d20] text-pink-300/80 hover:text-pink-200 border border-pink-950/80 hover:border-pink-800/60'
              }`}
            >
              Group {grp}
            </button>
          ))}
        </div>
      )}

      {/* Prominently Highlighted TODAY Hero Section (Deep Obsidian & Magenta Glow) */}
      {isViewingToday ? (
        <div className="p-4 rounded-xl bg-gradient-to-r from-[#170e28]/90 via-[#0e0c1a]/95 to-[#07050e] border border-fuchsia-500/40 shadow-[0_0_25px_rgba(217,70,239,0.18)] space-y-3 relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-60 h-60 bg-fuchsia-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Date & Division Bar */}
          <div className="flex items-center justify-between text-xs border-b border-fuchsia-900/40 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-fuchsia-200 font-bold">
                <CalendarIcon className="w-4 h-4 text-fuchsia-400" />
                {todayDayInfo.fullDate}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white text-[10px] font-black uppercase tracking-wider shadow-[0_0_8px_rgba(217,70,239,0.5)]">
                TODAY
              </span>
            </div>
            <span className="text-fuchsia-300/80 font-semibold text-[11px] bg-fuchsia-950/60 px-2 py-0.5 rounded-md border border-fuchsia-900/40">
              {division.name}
            </span>
          </div>

          {/* Live Lecture Status */}
          {currentSlot ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <Radio className="w-3.5 h-3.5" />
                  <span>Class Happening Now</span>
                </div>
                <h3 className="text-base font-bold text-white tracking-tight truncate">
                  {currentSlot.subjectName}
                </h3>
                <p className="text-xs text-slate-300 font-mono">
                  {currentSlot.startTime} - {currentSlot.endTime} • {currentSlot.subjectCode}
                  {currentSlot.faculty && ` • Prof: ${currentSlot.faculty}`}
                </p>
              </div>

              {/* Classroom Badge - Prominent Magenta Obsidian */}
              <div className="shrink-0 flex sm:flex-col items-center sm:items-end justify-between gap-2 bg-[#1b102e] border border-fuchsia-700/70 px-4 py-2 rounded-xl shadow-[0_0_12px_rgba(217,70,239,0.25)]">
                <span className="text-[10px] uppercase font-bold text-fuchsia-300 tracking-wider">
                  Classroom
                </span>
                <span className="font-mono text-base sm:text-lg font-black text-white flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-fuchsia-400" />
                  {currentSlot.room}
                </span>
              </div>
            </div>
          ) : nextSlot ? (
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-fuchsia-300 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-fuchsia-400" />
                  {nextSlotContextLabel
                    ? `Up Next (${nextSlotContextLabel}) at ${nextSlot.startTime}`
                    : `Up Next at ${nextSlot.startTime}`}
                </span>
                <h4 className="text-xs sm:text-sm font-semibold text-white truncate mt-0.5">
                  {nextSlot.subjectName} ({nextSlot.subjectCode})
                </h4>
                {nextSlot.faculty && (
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {nextSlot.startTime} - {nextSlot.endTime} • Prof: {nextSlot.faculty}
                  </p>
                )}
              </div>
              <div className="shrink-0 flex sm:flex-col items-center sm:items-end justify-between gap-1 bg-[#160e26] border border-fuchsia-800/80 px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold text-fuchsia-200 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-fuchsia-300 tracking-wider">
                  Classroom
                </span>
                <span className="flex items-center gap-1 text-sm font-black text-white">
                  <MapPin className="w-3.5 h-3.5 text-fuchsia-400" />
                  {nextSlot.room}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-2 text-xs text-slate-300 font-medium">
              {daySlots.length > 0
                ? daySlots.every((s) => isSlotCancelled(s.id, selectedDate))
                  ? `All scheduled lectures cancelled for today in ${division.name}!`
                  : `All scheduled lectures completed for today in ${division.name}!`
                : `No classes scheduled for today in ${division.name}.`}
            </div>
          )}
        </div>
      ) : (
        /* Viewing Other Day Hero Banner */
        <div className="p-4 rounded-xl bg-gradient-to-r from-[#170e28]/90 via-[#0e0c1a]/95 to-[#07050e] border border-fuchsia-900/60 shadow-[0_0_20px_rgba(217,70,239,0.12)] space-y-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-60 h-60 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Date & Day Header */}
          <div className="flex items-center justify-between text-xs border-b border-fuchsia-900/40 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-fuchsia-200 font-bold">
                <CalendarIcon className="w-4 h-4 text-fuchsia-400" />
                {activeDayInfo.fullDate}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-fuchsia-300 border border-fuchsia-800/40 text-[10px] font-black uppercase tracking-wider">
                {activeDayInfo.day === tomorrowInfo?.day ? 'TOMORROW' : activeDayInfo.shortWeekday}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-fuchsia-300/80 font-semibold text-[11px] bg-fuchsia-950/60 px-2 py-0.5 rounded-md border border-fuchsia-900/40">
                {division.name}
              </span>
              <button
                onClick={() => setSelectedDay(todayDayInfo.day)}
                className="text-[11px] font-semibold text-fuchsia-400 hover:text-fuchsia-300 underline ml-1"
              >
                Jump to Today
              </button>
            </div>
          </div>

          {/* Upcoming Status for that Day */}
          {upcomingSlotForSelectedDay ? (
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-fuchsia-300 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-fuchsia-400" />
                  Up Next at {upcomingSlotForSelectedDay.startTime}
                </span>
                <h4 className="text-xs sm:text-sm font-semibold text-white truncate mt-0.5">
                  {upcomingSlotForSelectedDay.subjectName} ({upcomingSlotForSelectedDay.subjectCode})
                </h4>
                {upcomingSlotForSelectedDay.faculty && (
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {upcomingSlotForSelectedDay.startTime} - {upcomingSlotForSelectedDay.endTime} • Prof: {upcomingSlotForSelectedDay.faculty}
                  </p>
                )}
              </div>
              <div className="shrink-0 flex sm:flex-col items-center sm:items-end justify-between gap-1 bg-[#1b102e] border border-fuchsia-700/70 px-3.5 py-1.5 rounded-xl shadow-[0_0_12px_rgba(217,70,239,0.25)]">
                <span className="text-[10px] uppercase font-bold text-fuchsia-300 tracking-wider">
                  Classroom
                </span>
                <span className="font-mono text-sm sm:text-base font-black text-white flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-fuchsia-400" />
                  {upcomingSlotForSelectedDay.room}
                </span>
              </div>
            </div>
          ) : daySlots.length > 0 ? (
            <div className="text-center py-2 text-xs text-amber-300/90 font-medium bg-amber-950/20 rounded-lg border border-amber-800/30">
              All scheduled lectures cancelled for {activeDayInfo.day} in {division.name}!
            </div>
          ) : (
            <div className="text-center py-2 text-xs text-slate-300 font-medium">
              No classes scheduled for {activeDayInfo.day} in {division.name}.
            </div>
          )}
        </div>
      )}

      {/* Slots List Header with Date */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
            <span>{activeDayInfo.fullDate}</span>
            <span className="text-slate-500 font-normal">
              ({daySlots.length} {daySlots.length === 1 ? 'class' : 'classes'})
            </span>
          </span>
          <span className="text-[11px] text-slate-400 font-medium">{division.name}</span>
        </div>

        {daySlots.length === 0 ? (
          <div className="text-center py-12 rounded-xl bg-slate-900/40 border border-slate-800/60 text-slate-400 space-y-2">
            <CalendarIcon className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-sm font-medium text-slate-300">No classes scheduled</p>
            <p className="text-xs text-slate-400">No lectures on {activeDayInfo.day}.</p>
          </div>
        ) : (
          daySlots.map((slot) => {
            const attendance = getSlotAttendance(slot.id);
            const note = getSlotNote(slot.id);
            const isCancelled = attendance?.status === 'cancelled';
            const isOngoing = isViewingToday && ongoingSlotId === slot.id && !isCancelled;
            const isAnimating = animationState?.slotId === slot.id;
            const animStatus = animationState?.status;

            return (
              <div
                key={slot.id}
                className={`relative rounded-xl border transition-all duration-300 ${
                  isCancelled
                    ? 'bg-[#08070d]/60 border-slate-800/80 opacity-50 hover:opacity-85'
                    : isOngoing
                    ? 'bg-[#150d24] border-fuchsia-500/80 shadow-[0_0_20px_rgba(217,70,239,0.25)] ring-1 ring-fuchsia-500/50'
                    : isAnimating && animStatus === 'present'
                    ? 'bg-[#0f1614] border-emerald-500/70 shadow-[0_0_20px_rgba(34,197,94,0.3)] ring-1 ring-emerald-500/40'
                    : isAnimating && animStatus === 'absent'
                    ? 'bg-[#170e14] border-rose-500/70 shadow-[0_0_20px_rgba(244,63,94,0.3)] ring-1 ring-rose-500/40'
                    : 'bg-[#0c0a15] border-fuchsia-950/70 hover:border-fuchsia-900/60 shadow-2xs'
                } ${isAnimating && animStatus === 'cancelled' ? 'animate-cancelled-settle' : ''}`}
              >
                {/* Floating Tactile Attendance Feedback Pill */}
                {isAnimating && (
                  <div className="absolute -top-3.5 right-4 z-20 pointer-events-none animate-float-feedback">
                    {animStatus === 'present' ? (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 text-slate-950 font-black text-xs shadow-[0_0_16px_rgba(34,197,94,0.85)] tracking-wide">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Present! +1</span>
                      </span>
                    ) : animStatus === 'absent' ? (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-600 text-white font-black text-xs shadow-[0_0_16px_rgba(244,63,94,0.85)] tracking-wide">
                        <X className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Missed</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 text-amber-300 border border-amber-600/70 font-black text-xs shadow-[0_0_16px_rgba(245,158,11,0.35)] tracking-wide">
                        <Ban className="w-3.5 h-3.5 text-amber-400 stroke-[2.5]" />
                        <span>Cancelled / Off</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Main Card Header */}
                <div className="p-3.5 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    {/* Time & Subject info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-medium text-slate-400 flex items-center gap-1">
                          <Clock className={`w-3 h-3 ${isCancelled ? 'text-slate-500' : 'text-fuchsia-400'}`} />
                          {slot.startTime} - {slot.endTime}
                        </span>
                        <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded ${
                          isCancelled ? 'bg-slate-800 text-slate-400 border border-slate-700/60' : 'bg-[#160f24] text-fuchsia-300 border border-fuchsia-900/40'
                        }`}>
                          {slot.type}
                        </span>
                        {slot.batch && slot.batch !== 'All' && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-fuchsia-950/70 text-fuchsia-300 border border-fuchsia-800/40">
                            Batch {slot.batch}
                          </span>
                        )}
                        {isCancelled ? (
                          <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-tight flex items-center gap-1">
                            <Ban className="w-2.5 h-2.5 text-amber-400" />
                            Cancelled
                          </span>
                        ) : isOngoing ? (
                          <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40 uppercase shadow-[0_0_8px_rgba(217,70,239,0.3)]">
                            Ongoing
                          </span>
                        ) : null}
                      </div>

                      <h4 className={`text-sm font-bold tracking-tight leading-snug transition-all ${
                        isCancelled
                          ? 'line-through text-slate-400 decoration-slate-500/80 decoration-2'
                          : 'text-white'
                      }`}>
                        {slot.subjectName}
                      </h4>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-400">
                        <span className="font-mono text-fuchsia-300/80 font-medium">
                          {slot.subjectCode}
                        </span>
                        {slot.faculty && (
                          <span className="flex items-center gap-1 text-slate-400">
                            <User className="w-3 h-3 text-fuchsia-400" />
                            {slot.faculty}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* CLASSROOM NO. BADGE */}
                    <div className="shrink-0 flex flex-col items-end">
                      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-colors ${
                        isCancelled
                          ? 'bg-slate-900/60 border-slate-800 text-slate-500'
                          : 'bg-[#170e28] border-fuchsia-800/60 text-fuchsia-100 shadow-[0_0_10px_rgba(217,70,239,0.15)]'
                      }`}>
                        <MapPin className={`w-3.5 h-3.5 ${isCancelled ? 'text-slate-500' : 'text-fuchsia-400'}`} />
                        <span className={`font-mono text-xs font-black tracking-tight ${isCancelled ? 'line-through text-slate-500' : ''}`}>
                          {slot.room}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Attendance Marker Row */}
                  <div className="mt-3 pt-3 border-t border-fuchsia-950/60 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-slate-400 mr-1 hidden sm:inline">
                        Attendance:
                      </span>
                      {/* Present Button */}
                      <button
                        onClick={() =>
                          handleAttendanceClick(
                            selectedDate,
                            slot.id,
                            slot.subjectCode,
                            slot.subjectName,
                            'present'
                          )
                        }
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
                          attendance?.status === 'present'
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/70 shadow-[0_0_12px_rgba(34,197,94,0.35)] font-bold'
                            : 'bg-[#120f1e] text-slate-400 hover:text-emerald-300 hover:bg-emerald-950/30 border border-fuchsia-950'
                        } ${isAnimating && animStatus === 'present' ? 'animate-present-pop' : ''}`}
                        title="Mark Present (Attended)"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Present</span>
                      </button>

                      {/* Absent Button */}
                      <button
                        onClick={() =>
                          handleAttendanceClick(
                            selectedDate,
                            slot.id,
                            slot.subjectCode,
                            slot.subjectName,
                            'absent'
                          )
                        }
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
                          attendance?.status === 'absent'
                            ? 'bg-rose-950/80 text-rose-300 border border-rose-500/70 shadow-[0_0_12px_rgba(244,63,94,0.35)] font-bold'
                            : 'bg-[#120f1e] text-slate-400 hover:text-rose-300 hover:bg-rose-950/30 border border-fuchsia-950'
                        } ${isAnimating && animStatus === 'absent' ? 'animate-absent-wobble' : ''}`}
                        title="Mark Absent (Missed)"
                      >
                        <X className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Absent</span>
                      </button>

                      {/* Cancelled Button */}
                      <button
                        onClick={() =>
                          handleAttendanceClick(
                            selectedDate,
                            slot.id,
                            slot.subjectCode,
                            slot.subjectName,
                            'cancelled'
                          )
                        }
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
                          attendance?.status === 'cancelled'
                            ? 'bg-slate-800 text-amber-300 border border-amber-600/70 shadow-[0_0_12px_rgba(245,158,11,0.25)] font-bold'
                            : 'bg-[#120f1e] text-slate-500 hover:text-amber-300 hover:bg-amber-950/20 border border-fuchsia-950'
                        } ${isAnimating && animStatus === 'cancelled' ? 'animate-cancelled-settle' : ''}`}
                        title="Class Cancelled / Holiday"
                      >
                        <Ban className="w-3.5 h-3.5 text-amber-400" />
                        <span>Cancelled</span>
                      </button>
                    </div>

                    {/* Lecture Notes Button */}
                    <button
                      onClick={() => onOpenNoteModal(slot, selectedDate)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        note
                          ? 'bg-fuchsia-950/70 text-fuchsia-300 border border-fuchsia-700/60 hover:bg-fuchsia-900/60 shadow-[0_0_8px_rgba(217,70,239,0.2)]'
                          : 'bg-[#120f1e] text-slate-400 hover:text-fuchsia-200 hover:bg-fuchsia-950/30 border border-fuchsia-950'
                      }`}
                    >
                      <FileText className="w-3 h-3 text-fuchsia-400" />
                      <span>{note ? 'Edit Note' : '+ Add Note'}</span>
                    </button>
                  </div>

                  {/* If Lecture Note exists: Display preview with date */}
                  {note && (
                    <div className="mt-2.5 p-2.5 rounded-lg bg-[#140f22]/90 border border-fuchsia-900/40 text-xs text-slate-300 space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-medium">
                        <span className="flex items-center gap-1 text-fuchsia-300">
                          <Sparkles className="w-3 h-3 text-fuchsia-400" />
                          What was taught on {formatFriendlyDate(note.date)}:
                        </span>
                      </div>
                      <p className="text-slate-200 leading-relaxed font-normal">
                        {note.topicTaught}
                      </p>
                      {note.homework && (
                        <p className="text-[11px] text-slate-400 pt-1 border-t border-fuchsia-950/70">
                          <span className="font-semibold text-fuchsia-200">Prep / Assignment:</span>{' '}
                          {note.homework}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
