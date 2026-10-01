import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { BottomNav, type ActiveTab } from './components/BottomNav';
import { TodayView } from './components/TodayView';
import { WeeklyGridView } from './components/WeeklyGridView';
import { RoomFinderView } from './components/RoomFinderView';
import { AttendanceView } from './components/AttendanceView';
import { NotesArchiveView } from './components/NotesArchiveView';
import { LectureNoteModal } from './components/LectureNoteModal';
import { UploadModal } from './components/UploadModal';
import { SettingsModal } from './components/SettingsModal';
import { StorageService } from './services/storage';
import type { 
  Timetable, 
  TimetableSlot, 
  AttendanceRecord, 
  LectureNote, 
  AttendanceStatus 
} from './types/timetable';
import { CalendarDays, MapPin, CheckSquare, BookOpen } from 'lucide-react';


export const App: React.FC = () => {
  // --- Core State ---
  const [timetables, setTimetables] = useState<Timetable[]>(() => StorageService.getTimetables());
  const [activeTimetableId, setActiveTimetableId] = useState<string>(() => StorageService.getActiveTimetableId());
  const [activeDivisionId, setActiveDivisionId] = useState<string>(() => StorageService.getActiveDivisionId());
  
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => StorageService.getAttendance());
  const [lectureNotes, setLectureNotes] = useState<LectureNote[]>(() => StorageService.getNotes());
  const [targetPercentage, setTargetPercentage] = useState<number>(() => StorageService.getSettings().targetAttendance || 75);

  // Navigation State
  const [activeTab, setActiveTab] = useState<ActiveTab>('today');
  const [scheduleSubView, setScheduleSubView] = useState<'today' | 'weekly'>('today');

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeNoteSlot, setActiveNoteSlot] = useState<{ slot: TimetableSlot; date: string } | null>(null);

  // Active Timetable and Division objects
  const activeTimetable = timetables.find((t) => t.id === activeTimetableId) || timetables[0];
  const activeDivision =
    activeTimetable?.divisions.find((d) => d.id === activeDivisionId) ||
    activeTimetable?.divisions[0] || {
      id: 'div-fallback',
      name: 'Default Division',
      slots: [],
    };

  // Ensure activeDivisionId stays synchronized if timetable changes
  useEffect(() => {
    if (activeTimetable && !activeTimetable.divisions.some((d) => d.id === activeDivisionId)) {
      if (activeTimetable.divisions[0]) {
        setActiveDivisionId(activeTimetable.divisions[0].id);
        StorageService.setActiveDivisionId(activeTimetable.divisions[0].id);
      }
    }
  }, [activeTimetable, activeDivisionId]);

  // Handlers
  const handleSelectDivision = (divId: string) => {
    setActiveDivisionId(divId);
    StorageService.setActiveDivisionId(divId);
  };

  const handleMarkAttendance = (
    date: string,
    slotId: string,
    subjectCode: string,
    subjectName: string,
    status: AttendanceStatus
  ) => {
    const updated = StorageService.recordAttendance(
      date,
      slotId,
      subjectCode,
      subjectName,
      status,
      activeDivision.id
    );
    setAttendanceRecords([...updated]);
  };

  const handleSaveLectureNote = (noteData: Omit<LectureNote, 'id' | 'createdAt'>) => {
    StorageService.saveLectureNote(noteData);
    setLectureNotes([...StorageService.getNotes()]);
  };

  const handleDeleteLectureNote = (id: string) => {
    StorageService.deleteLectureNote(id);
    setLectureNotes([...StorageService.getNotes()]);
  };

  const handleTimetableImported = (newTimetable: Timetable) => {
    setTimetables(StorageService.getTimetables());
    setActiveTimetableId(newTimetable.id);
    if (newTimetable.divisions[0]) {
      setActiveDivisionId(newTimetable.divisions[0].id);
    }
    setActiveTab('today');
    setScheduleSubView('today');
  };

  return (
    <div className="min-h-screen bg-[#050508] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,20,90,0.15),rgba(255,255,255,0))] text-slate-100 flex flex-col font-sans pb-20 sm:pb-8 selection:bg-fuchsia-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        institution={activeTimetable?.institution || activeTimetable?.title}
        semester={activeTimetable?.semester}
        divisions={activeTimetable?.divisions || []}
        activeDivisionId={activeDivision.id}
        onSelectDivision={handleSelectDivision}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-4 sm:py-6">
        {/* Desktop Tabs Bar */}
        <div className="hidden sm:flex items-center gap-1.5 p-1 rounded-xl bg-[#0e0c16]/90 border border-fuchsia-950/80 mb-5 max-w-fit shadow-[0_0_15px_rgba(217,70,239,0.08)]">
          <button
            onClick={() => setActiveTab('today')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'today'
                ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white font-semibold shadow-[0_0_12px_rgba(217,70,239,0.4)]'
                : 'text-slate-400 hover:text-fuchsia-200 hover:bg-fuchsia-950/30'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Schedule</span>
          </button>

          <button
            onClick={() => setActiveTab('rooms')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'rooms'
                ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white font-semibold shadow-[0_0_12px_rgba(217,70,239,0.4)]'
                : 'text-slate-400 hover:text-fuchsia-200 hover:bg-fuchsia-950/30'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Classrooms</span>
          </button>

          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'attendance'
                ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white font-semibold shadow-[0_0_12px_rgba(217,70,239,0.4)]'
                : 'text-slate-400 hover:text-fuchsia-200 hover:bg-fuchsia-950/30'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Attendance</span>
          </button>

          <button
            onClick={() => setActiveTab('notes')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'notes'
                ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white font-semibold shadow-[0_0_12px_rgba(217,70,239,0.4)]'
                : 'text-slate-400 hover:text-fuchsia-200 hover:bg-fuchsia-950/30'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Lecture Notes Log</span>
          </button>
        </div>

        {/* Tab View Content */}
        {activeTab === 'today' && (
          <div>
            {scheduleSubView === 'today' ? (
              <TodayView
                division={activeDivision}
                attendanceRecords={attendanceRecords}
                lectureNotes={lectureNotes}
                onMarkAttendance={handleMarkAttendance}
                onOpenNoteModal={(slot, date) => setActiveNoteSlot({ slot, date })}
                onSwitchToWeekly={() => setScheduleSubView('weekly')}
              />
            ) : (
              <WeeklyGridView
                division={activeDivision}
                onBackToToday={() => setScheduleSubView('today')}
                onSelectSlot={(slot) => {
                  const todayIso = new Date().toISOString().split('T')[0];
                  setActiveNoteSlot({ slot, date: todayIso });
                }}
              />
            )}
          </div>
        )}

        {activeTab === 'rooms' && (
          <RoomFinderView
            divisions={activeTimetable?.divisions || []}
            activeDivisionId={activeDivision.id}
          />
        )}

        {activeTab === 'attendance' && (
          <AttendanceView
            division={activeDivision}
            attendanceRecords={attendanceRecords}
            targetPercentage={targetPercentage}
            onUpdateTarget={(val) => {
              setTargetPercentage(val);
              const settings = StorageService.getSettings();
              settings.targetAttendance = val;
              StorageService.saveSettings(settings);
            }}
          />
        )}

        {activeTab === 'notes' && (
          <NotesArchiveView
            division={activeDivision}
            notes={lectureNotes}
            onDeleteNote={handleDeleteLectureNote}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'today') setScheduleSubView('today');
        }}
        pendingNotesCount={0}
      />

      {/* Modals */}
      {/* Lecture Note Logging Modal */}
      {activeNoteSlot && (
        <LectureNoteModal
          isOpen={!!activeNoteSlot}
          slot={activeNoteSlot.slot}
          date={activeNoteSlot.date}
          divisionId={activeDivision.id}
          existingNote={lectureNotes.find(
            (n) =>
              n.slotId === activeNoteSlot.slot.id &&
              n.date === activeNoteSlot.date &&
              n.divisionId === activeDivision.id
          )}
          onClose={() => setActiveNoteSlot(null)}
          onSaveNote={handleSaveLectureNote}
          onDeleteNote={handleDeleteLectureNote}
        />
      )}

      {/* Timetable PDF Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onTimetableImported={handleTimetableImported}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsSaved={() => {
          setTargetPercentage(StorageService.getSettings().targetAttendance || 75);
        }}
      />
    </div>
  );
};

export default App;
