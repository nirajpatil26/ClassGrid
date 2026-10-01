export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export type SlotType = 'lecture' | 'lab' | 'tutorial' | 'break';

export interface TimetableSlot {
  id: string;
  day: DayOfWeek;
  startTime: string; // e.g. "09:00"
  endTime: string;   // e.g. "10:00"
  subjectCode: string;
  subjectName: string;
  room: string;      // Classroom / Lab number
  faculty?: string;
  type: SlotType;
  batch?: string;    // e.g. "All", "B1", "B2"
}

export interface Division {
  id: string;
  name: string;      // e.g. "Division A", "CSE-3A"
  slots: TimetableSlot[];
}

export interface Timetable {
  id: string;
  title: string;
  institution?: string;
  semester?: string;
  academicYear?: string;
  divisions: Division[];
  createdAt: string;
  updatedAt: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'cancelled';

export interface AttendanceRecord {
  id: string;
  date: string;          // YYYY-MM-DD
  slotId: string;
  subjectCode: string;
  subjectName: string;
  status: AttendanceStatus;
  divisionId: string;
}

export interface LectureNote {
  id: string;
  date: string;          // YYYY-MM-DD
  slotId: string;
  subjectCode: string;
  subjectName: string;
  room?: string;
  topicTaught: string;   // What was taught in the lecture
  homework?: string;
  divisionId: string;
  createdAt: number;
}

export interface SubjectStats {
  subjectCode: string;
  subjectName: string;
  totalConducted: number;
  attended: number;
  absent: number;
  cancelled: number;
  percentage: number;
  targetSafeOrDeficit: number; // Positive: can miss X classes, Negative: need to attend X classes to reach target
}
