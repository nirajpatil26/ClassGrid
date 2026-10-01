import type { 
  Timetable, 
  AttendanceRecord, 
  LectureNote, 
  Division, 
  SubjectStats, 
  AttendanceStatus 
} from '../types/timetable';

const STORAGE_KEYS = {
  TIMETABLES: 'clg_timetables_v1',
  ACTIVE_TIMETABLE_ID: 'clg_active_timetable_id_v1',
  ACTIVE_DIVISION_ID: 'clg_active_div_id_v1',
  ACTIVE_GROUP_ID: 'clg_active_group_id_v1',
  ATTENDANCE: 'clg_attendance_records_v1',
  LECTURE_NOTES: 'clg_lecture_notes_v1',
  SETTINGS: 'clg_app_settings_v1',
};

export type VisionProvider = 'gemini' | 'groq' | 'openrouter' | 'ollama' | 'custom';

export interface AppSettings {
  geminiApiKey?: string;
  targetAttendance: number; // default 75
  visionProvider: VisionProvider;
  visionApiKey: string;
  visionModel?: string;
  customEndpoint?: string;
}

// Built-in backend key for seamless zero-config scanning (supports Gemini 3.8 Flash & 2.5 Pro)
const BUILTIN_ENCODED_KEY = 'QVEuQWI4Uk42S3ZMckVLZEpNZUE2dTViMEdjUnMxbjg1ZzdlWThvUkZnRDRYV3ZndW9aQkE=';
export const DEFAULT_BACKEND_GEMINI_KEY = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) 
    ? (import.meta.env.VITE_GEMINI_API_KEY as string) 
    : (typeof atob === 'function' ? atob(BUILTIN_ENCODED_KEY) : '');

export const StorageService = {
  // --- Timetables ---
  getTimetables(): Timetable[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TIMETABLES);
      if (!data) {
        return [];
      }
      const parsed = JSON.parse(data);
      // If user only has the legacy sample timetable, treat as empty so new/existing users start blank
      if (Array.isArray(parsed) && parsed.length === 1 && parsed[0].id === 'sample-timetable-1') {
        return [];
      }
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Failed to load timetables from localStorage', e);
      return [];
    }
  },

  saveTimetables(timetables: Timetable[]): void {
    localStorage.setItem(STORAGE_KEYS.TIMETABLES, JSON.stringify(timetables));
  },

  addOrUpdateTimetable(timetable: Timetable): void {
    const all = this.getTimetables();
    const index = all.findIndex((t) => t.id === timetable.id);
    if (index >= 0) {
      all[index] = timetable;
    } else {
      all.push(timetable);
    }
    this.saveTimetables(all);
  },

  getActiveTimetableId(): string {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_TIMETABLE_ID);
    if (saved && saved !== 'sample-timetable-1') return saved;
    const all = this.getTimetables();
    return all[0]?.id || '';
  },

  setActiveTimetableId(id: string): void {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TIMETABLE_ID, id);
  },

  getActiveDivisionId(): string {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_DIVISION_ID);
    if (saved) return saved;
    const timetables = this.getTimetables();
    const active = timetables.find((t) => t.id === this.getActiveTimetableId()) || timetables[0];
    return active?.divisions[0]?.id || '';
  },

  setActiveDivisionId(id: string): void {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_DIVISION_ID, id);
  },

  getActiveGroupId(): string {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_GROUP_ID) || 'All';
  },

  setActiveGroupId(group: string): void {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_GROUP_ID, group);
  },

  // --- Attendance ---
  getAttendance(): AttendanceRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveAttendance(records: AttendanceRecord[]): void {
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(records));
  },

  recordAttendance(
    date: string,
    slotId: string,
    subjectCode: string,
    subjectName: string,
    status: AttendanceStatus,
    divisionId: string
  ): AttendanceRecord[] {
    const records = this.getAttendance();
    const existingIndex = records.findIndex(
      (r) => r.date === date && r.slotId === slotId && r.divisionId === divisionId
    );

    if (existingIndex >= 0) {
      // Toggle or change
      if (records[existingIndex].status === status) {
        // Tap same again removes it
        records.splice(existingIndex, 1);
      } else {
        records[existingIndex].status = status;
      }
    } else {
      records.push({
        id: `${date}_${slotId}_${divisionId}`,
        date,
        slotId,
        subjectCode,
        subjectName,
        status,
        divisionId,
      });
    }

    this.saveAttendance(records);
    return records;
  },

  // --- Lecture Notes ("What was taught") ---
  getNotes(): LectureNote[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LECTURE_NOTES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveNotes(notes: LectureNote[]): void {
    localStorage.setItem(STORAGE_KEYS.LECTURE_NOTES, JSON.stringify(notes));
  },

  saveLectureNote(note: Omit<LectureNote, 'id' | 'createdAt'>): LectureNote {
    const notes = this.getNotes();
    const existingIndex = notes.findIndex(
      (n) => n.date === note.date && n.slotId === note.slotId && n.divisionId === note.divisionId
    );

    let updatedNote: LectureNote;
    if (existingIndex >= 0) {
      updatedNote = {
        ...notes[existingIndex],
        ...note,
        createdAt: Date.now(),
      };
      notes[existingIndex] = updatedNote;
    } else {
      updatedNote = {
        ...note,
        id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: Date.now(),
      };
      notes.unshift(updatedNote);
    }

    this.saveNotes(notes);
    return updatedNote;
  },

  deleteLectureNote(id: string): void {
    const notes = this.getNotes().filter((n) => n.id !== id);
    this.saveNotes(notes);
  },

  // --- Settings ---
  getSettings(): AppSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      const parsed = data ? JSON.parse(data) : {};
      let apiKey = parsed.visionApiKey || parsed.geminiApiKey || DEFAULT_BACKEND_GEMINI_KEY;
      // If the saved key was a pre-configured backend key, always update to the latest DEFAULT_BACKEND_GEMINI_KEY
      if (typeof apiKey === 'string' && (apiKey.startsWith('AQ.') || !apiKey)) {
        apiKey = DEFAULT_BACKEND_GEMINI_KEY;
      }
      return {
        targetAttendance: parsed.targetAttendance ?? 75,
        visionProvider: 'gemini',
        visionApiKey: apiKey,
        visionModel: parsed.visionModel ?? 'gemini-3.8-flash',
        customEndpoint: parsed.customEndpoint ?? '',
        geminiApiKey: apiKey,
      };
    } catch {
      return {
        targetAttendance: 75,
        visionProvider: 'gemini',
        visionApiKey: DEFAULT_BACKEND_GEMINI_KEY,
        visionModel: 'gemini-3.8-flash',
        customEndpoint: '',
        geminiApiKey: DEFAULT_BACKEND_GEMINI_KEY,
      };
    }
  },

  saveSettings(settings: AppSettings): void {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  // --- Analytics & Statistics ---
  calculateStats(
    division: Division,
    attendanceRecords: AttendanceRecord[],
    targetPercent: number = 75
  ): SubjectStats[] {
    // Collect unique subjects in the active division
    const subjectMap = new Map<string, { name: string; codes: Set<string> }>();

    division.slots.forEach((s) => {
      if (s.type === 'break') return;
      if (!subjectMap.has(s.subjectCode)) {
        subjectMap.set(s.subjectCode, { name: s.subjectName, codes: new Set() });
      }
    });

    const divRecords = attendanceRecords.filter((r) => r.divisionId === division.id);

    const stats: SubjectStats[] = [];

    subjectMap.forEach((meta, code) => {
      const subjectRecords = divRecords.filter((r) => r.subjectCode === code);
      const attended = subjectRecords.filter((r) => r.status === 'present').length;
      const absent = subjectRecords.filter((r) => r.status === 'absent').length;
      const cancelled = subjectRecords.filter((r) => r.status === 'cancelled').length;
      const totalConducted = attended + absent; // cancelled classes don't penalize

      const percentage = totalConducted > 0 ? Math.round((attended / totalConducted) * 100) : 100;

      // Safe bunk or deficit calculation
      // If P >= Target: how many can I miss while staying >= Target?
      // (attended) / (total + x) >= target/100  =>  x <= (100*attended - target*total) / target
      // If P < Target: how many must I attend consecutively to reach Target?
      // (attended + y) / (total + y) >= target/100 => y >= (target*total - 100*attended) / (100 - target)
      let targetSafeOrDeficit = 0;
      if (totalConducted === 0) {
        targetSafeOrDeficit = 0;
      } else if (percentage >= targetPercent) {
        // Can miss X classes
        targetSafeOrDeficit = Math.floor(
          (100 * attended - targetPercent * totalConducted) / targetPercent
        );
      } else {
        // Deficit: must attend X classes
        targetSafeOrDeficit = -Math.ceil(
          (targetPercent * totalConducted - 100 * attended) / (100 - targetPercent)
        );
      }

      stats.push({
        subjectCode: code,
        subjectName: meta.name,
        totalConducted,
        attended,
        absent,
        cancelled,
        percentage,
        targetSafeOrDeficit,
      });
    });

    return stats;
  },
};
