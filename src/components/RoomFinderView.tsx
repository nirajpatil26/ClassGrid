import React, { useState } from 'react';
import type { Division, DayOfWeek, TimetableSlot } from '../types/timetable';
import { MapPin, Search, Clock, CheckCircle2, AlertCircle } from 'lucide-react';


interface RoomFinderViewProps {
  divisions: Division[];
  activeDivisionId: string;
}

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const RoomFinderView: React.FC<RoomFinderViewProps> = ({ divisions }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');

  // Collect all unique rooms across all divisions
  const roomsMap = new Map<string, { room: string; slots: { divisionName: string; slot: TimetableSlot }[] }>();

  divisions.forEach((div) => {
    div.slots.forEach((slot) => {
      const roomKey = slot.room.trim();
      if (!roomKey) return;
      if (!roomsMap.has(roomKey)) {
        roomsMap.set(roomKey, { room: roomKey, slots: [] });
      }
      roomsMap.get(roomKey)!.slots.push({
        divisionName: div.name,
        slot,
      });
    });
  });

  const allRooms = Array.from(roomsMap.values()).sort((a, b) => a.room.localeCompare(b.room));

  const filteredRooms = allRooms.filter((r) =>
    r.room.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Check current time occupancy
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const todayDayName = DAYS[(now.getDay() + 6) % 7];

  return (
    <div className="space-y-4">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400" />
            Classroom & Lab Occupancy
          </h2>
          <p className="text-xs text-slate-400">
            Check classroom allocations, ongoing classes, and room availability.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-fuchsia-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search room (e.g. 302, Lab 4)..."
            className="w-full sm:w-56 pl-8 pr-3 py-1.5 rounded-lg bg-[#0e0c18] border border-fuchsia-950 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 transition-colors shadow-2xs"
          />
        </div>
      </div>

      {/* Day Selector */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {DAYS.map((day) => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              selectedDay === day
                ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-[0_0_10px_rgba(217,70,239,0.35)]'
                : 'bg-[#0e0c18] text-slate-400 hover:text-fuchsia-200 border border-fuchsia-950/70'
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      {/* Room Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredRooms.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400 bg-[#0c0a15] rounded-xl border border-fuchsia-950/70">
            No classrooms found matching "{searchQuery}"
          </div>
        ) : (
          filteredRooms.map(({ room, slots }) => {
            // Filter slots for selected day
            const daySlots = slots
              .filter((item) => item.slot.day === selectedDay)
              .sort((a, b) => a.slot.startTime.localeCompare(b.slot.startTime));

            // Check current occupancy if viewing today
            let currentOccupant: { divisionName: string; slot: TimetableSlot } | null = null;
            if (selectedDay === todayDayName) {
              for (const item of daySlots) {
                const [startH, startM] = item.slot.startTime.split(':').map(Number);
                const [endH, endM] = item.slot.endTime.split(':').map(Number);
                const startMin = startH * 60 + startM;
                const endMin = endH * 60 + endM;
                if (currentMinutes >= startMin && currentMinutes < endMin) {
                  currentOccupant = item;
                  break;
                }
              }
            }

            return (
              <div
                key={room}
                className="rounded-xl bg-[#0c0a15] border border-fuchsia-950/80 overflow-hidden hover:border-fuchsia-900/60 transition-all shadow-2xs"
              >
                {/* Room Header */}
                <div className="p-3.5 bg-[#120e20] border-b border-fuchsia-950/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#181128] border border-fuchsia-900/60 flex items-center justify-center text-fuchsia-400 font-mono text-xs font-bold">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h3 className="font-mono text-sm font-bold text-white">
                        {room}
                      </h3>
                      <span className="text-[11px] text-fuchsia-300/70">
                        {daySlots.length} {daySlots.length === 1 ? 'class' : 'classes'} on {selectedDay}
                      </span>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  {selectedDay === todayDayName && (
                    <div>
                      {currentOccupant ? (
                        <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-400 border border-amber-800/50 font-medium">
                          <AlertCircle className="w-3 h-3" />
                          In Use
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          Free Now
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Slots inside this room */}
                <div className="p-3 space-y-2">
                  {daySlots.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-400">
                      No classes scheduled in this room on {selectedDay}.
                    </div>
                  ) : (
                    daySlots.map(({ divisionName, slot }, idx) => (
                      <div
                        key={`${slot.id}_${idx}`}
                        className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-slate-400 font-medium flex items-center gap-1 text-[11px]">
                              <Clock className="w-3 h-3" />
                              {slot.startTime} - {slot.endTime}
                            </span>
                            <span className="text-[10px] px-1.5 rounded bg-slate-800 text-slate-400 font-mono">
                              {divisionName}
                            </span>
                          </div>
                          <div className="font-semibold text-slate-200 truncate">
                            {slot.subjectName}
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="font-mono text-[11px] text-slate-400 font-medium block">
                            {slot.subjectCode}
                          </span>
                          {slot.faculty && (
                            <span className="text-[10px] text-slate-400 truncate max-w-[100px] block">
                              {slot.faculty}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
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
