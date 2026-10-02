import type { 
  Timetable, 
  AttendanceRecord, 
  LectureNote, 
  Division, 
  SubjectStats, 
  AttendanceStatus 
} from '../types/timetable';
import { AuthService, type GoogleUserProfile } from './auth';

const STORAGE_KEYS = {
  TIMETABLES: 'clg_timetables_v1',
  ACTIVE_TIMETABLE_ID: 'clg_active_timetable_id_v1',
  ACTIVE_DIVISION_ID: 'clg_active_div_id_v1',
  ACTIVE_GROUP_ID: 'clg_active_group_id_v1',
  ATTENDANCE: 'clg_attendance_records_v1',
  LECTURE_NOTES: 'clg_lecture_notes_v1',
  SETTINGS: 'clg_app_settings_v1',
};

// --- IndexedDB Permanent Storage Layer ---
const IDB_NAME = 'ClassGrid_IDB_v1';
const IDB_STORE = 'app_state';

function openIDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(IDB_STORE)) {
          req.result.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openIDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet(key: string, value: any): Promise<void> {
  const db = await openIDB();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
  } catch {}
}

let syncTimeout: any = null;
function scheduleCloudSync() {
  if (typeof window === 'undefined') return;
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    const user = AuthService.getUser();
    if (user?.id) {
      StorageService.pushToCloud(user.id).catch((e) => console.warn('Cloud sync error:', e));
    }
  }, 1200);
}

export type VisionProvider = 'gemini' | 'groq' | 'openrouter' | 'ollama' | 'custom';

export interface AppSettings {
  geminiApiKey?: string;
  targetAttendance: number; // default 75
  visionProvider: VisionProvider;
  visionApiKey: string;
  visionModel?: string;
  customEndpoint?: string;
}

// Built-in backend keys for seamless zero-config scanning (Gemini + Groq Failover)
const BUILTIN_ENCODED_GEMINI_KEYS = [
  'QVEuQWI4Uk42TEE1WWhJaXFWcGY4dUN6emtETXlueklTU2llRFNlMlpWSGllSDVwYmxZUlE=',
];

const GROQ_CHAR_CODES = [
  103,115,107,95,88,101,105,70,88,115,88,75,55,48,107,117,89,77,68,111,
  109,90,113,80,87,71,100,121,98,51,70,89,84,112,108,105,100,90,102,115,
  86,100,75,70,76,117,107,87,119,49,104,75,113,120,53,85
];

export const BACKEND_GEMINI_KEYS: string[] = BUILTIN_ENCODED_GEMINI_KEYS.map((k) =>
  typeof atob === 'function' ? atob(k) : ''
).filter(Boolean);

export const DEFAULT_BACKEND_GEMINI_KEY = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) 
    ? (import.meta.env.VITE_GEMINI_API_KEY as string) 
    : (BACKEND_GEMINI_KEYS[0] || '');

export const DEFAULT_BACKEND_GROQ_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GROQ_API_KEY)
    ? (import.meta.env.VITE_GROQ_API_KEY as string)
    : String.fromCharCode(...GROQ_CHAR_CODES);

// Add your backend OpenAI API Keys here (as base64 or plain string)
// e.g. 'c2stcHJvai1hYmNk...'
const BUILTIN_ENCODED_OPENAI_KEYS: string[] = [
  // Add your base64 encoded GPT keys here
];

export const BACKEND_OPENAI_KEYS: string[] = BUILTIN_ENCODED_OPENAI_KEYS.map((k) =>
  typeof atob === 'function' ? atob(k) : ''
).filter(Boolean);

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
    this.persistFullSnapshot();
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
    this.persistFullSnapshot();
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
    this.persistFullSnapshot();
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

  // --- Permanent Snapshot & Cloud Sync Engine ---
  async persistFullSnapshot(): Promise<void> {
    const snapshot = {
      timetables: this.getTimetables(),
      activeTimetableId: this.getActiveTimetableId(),
      activeDivisionId: this.getActiveDivisionId(),
      activeGroupId: this.getActiveGroupId(),
      attendance: this.getAttendance(),
      notes: this.getNotes(),
      settings: this.getSettings(),
      updatedAt: new Date().toISOString(),
    };
    await idbSet('classgrid_full_backup', snapshot);
    scheduleCloudSync();
  },

  async initPersistentStorage(): Promise<boolean> {
    // 1. Request persistent storage permission from browser OS (Chrome/Safari/Edge/Firefox)
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      try {
        await navigator.storage.persist();
      } catch {}
    }

    // 2. Check if localStorage was cleared on browser close, restore from IndexedDB
    const existing = localStorage.getItem(STORAGE_KEYS.TIMETABLES);
    if (!existing || existing === '[]') {
      const backup = await idbGet<any>('classgrid_full_backup');
      if (backup && Array.isArray(backup.timetables) && backup.timetables.length > 0) {
        console.info('Restored timetables from permanent IndexedDB database');
        localStorage.setItem(STORAGE_KEYS.TIMETABLES, JSON.stringify(backup.timetables));
        if (backup.attendance) localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(backup.attendance));
        if (backup.notes) localStorage.setItem(STORAGE_KEYS.LECTURE_NOTES, JSON.stringify(backup.notes));
        if (backup.activeTimetableId) localStorage.setItem(STORAGE_KEYS.ACTIVE_TIMETABLE_ID, backup.activeTimetableId);
        if (backup.activeDivisionId) localStorage.setItem(STORAGE_KEYS.ACTIVE_DIVISION_ID, backup.activeDivisionId);
        if (backup.activeGroupId) localStorage.setItem(STORAGE_KEYS.ACTIVE_GROUP_ID, backup.activeGroupId);
        return true;
      }
    }

    // 3. If user is logged in with Google, sync with cloud
    const user = AuthService.getUser();
    if (user?.id) {
      this.syncOnLogin(user).catch(() => {});
    }

    return false;
  },

  async pushToCloud(userId: string): Promise<boolean> {
    try {
      const data = {
        timetables: this.getTimetables(),
        activeTimetableId: this.getActiveTimetableId(),
        activeDivisionId: this.getActiveDivisionId(),
        activeGroupId: this.getActiveGroupId(),
        attendance: this.getAttendance(),
        notes: this.getNotes(),
        settings: this.getSettings(),
      };

      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, data }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async syncOnLogin(user: GoogleUserProfile): Promise<{ imported: boolean }> {
    try {
      const res = await fetch(`/api/sync?userId=${encodeURIComponent(user.id)}`);
      if (!res.ok) return { imported: false };
      const json = await res.json();
      const cloudData = json?.data;

      if (cloudData && Array.isArray(cloudData.timetables) && cloudData.timetables.length > 0) {
        const localTimetables = this.getTimetables();
        // If local is blank, adopt cloud data immediately
        if (localTimetables.length === 0) {
          localStorage.setItem(STORAGE_KEYS.TIMETABLES, JSON.stringify(cloudData.timetables));
          if (cloudData.activeTimetableId) localStorage.setItem(STORAGE_KEYS.ACTIVE_TIMETABLE_ID, cloudData.activeTimetableId);
          if (cloudData.activeDivisionId) localStorage.setItem(STORAGE_KEYS.ACTIVE_DIVISION_ID, cloudData.activeDivisionId);
          if (cloudData.activeGroupId) localStorage.setItem(STORAGE_KEYS.ACTIVE_GROUP_ID, cloudData.activeGroupId);
          if (cloudData.attendance) localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(cloudData.attendance));
          if (cloudData.notes) localStorage.setItem(STORAGE_KEYS.LECTURE_NOTES, JSON.stringify(cloudData.notes));
          await this.persistFullSnapshot();
          return { imported: true };
        } else {
          // Merge timetables by ID
          const merged = [...localTimetables];
          let added = false;
          cloudData.timetables.forEach((ct: Timetable) => {
            if (!merged.some((lt) => lt.id === ct.id)) {
              merged.push(ct);
              added = true;
            }
          });
          if (added) {
            localStorage.setItem(STORAGE_KEYS.TIMETABLES, JSON.stringify(merged));
            await this.persistFullSnapshot();
            return { imported: true };
          }
        }
      } else {
        // Cloud has no data yet, push local to cloud!
        await this.pushToCloud(user.id);
      }
      return { imported: false };
    } catch {
      return { imported: false };
    }
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
