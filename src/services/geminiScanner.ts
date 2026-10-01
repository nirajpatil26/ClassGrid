import type { Timetable, TimetableSlot, Division, DayOfWeek, SlotType } from '../types/timetable';


export interface ScanResult {
  success: boolean;
  timetable?: Timetable;
  error?: string;
}

export const GeminiScannerService = {
  /**
   * Convert a File or Blob into base64 string
   */
  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // strip data:*/*;base64,
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  },

  /**
   * Call Gemini 2.5 Flash / 1.5 Flash to scan and understand the PDF timetable
   */
  async parseTimetablePdf(file: File, apiKey: string): Promise<ScanResult> {
    if (!apiKey || apiKey.trim() === '') {
      return {
        success: false,
        error: 'Please provide a valid Gemini API Key to scan the PDF.',
      };
    }

    try {
      const base64Data = await this.fileToBase64(file);

      const prompt = `You are an expert college timetable analyzer. 
Analyze this college timetable PDF thoroughly. College timetables often feature complex grids, merged cells, multiple divisions/sections, practical lab batches, and classroom/hall codes.

Carefully extract every division, day, time slot, subject, and especially the CLASSROOM / LAB NUMBER.
Valid days of the week: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday.
Valid slot types: lecture, lab, tutorial, break.

Requirements:
1. Identify all divisions/classes (e.g. "Division A", "CSE 3rd Year - Div B", "Mechanical Section 1").
2. Extract the classroom number (e.g. "Room 302", "LH-101", "Lab 4", "Auditorium", "GF-12") for every lecture/lab.
3. Normalize start and end times to standard 24-hour format "HH:MM" (e.g. "09:00", "13:30").
4. Return ONLY valid JSON adhering strictly to this schema:
{
  "title": "Document Title or Timetable Name",
  "institution": "College / University / Department name if visible",
  "semester": "Semester / Term",
  "academicYear": "Academic Year",
  "divisions": [
    {
      "name": "Division A",
      "slots": [
        {
          "day": "Monday",
          "startTime": "09:00",
          "endTime": "10:00",
          "subjectCode": "CS301",
          "subjectName": "Data Structures",
          "room": "Room 302",
          "faculty": "Dr. Smith",
          "type": "lecture",
          "batch": "All"
        }
      ]
    }
  ]
}`;

      // Try gemini-3.8-flash first, then gemini-2.5-flash and gemini-1.5-flash as fallback
      const models = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
      let lastError = '';

      for (const model of models) {
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      inline_data: {
                        mime_type: file.type || 'application/pdf',
                        data: base64Data,
                      },
                    },
                    {
                      text: prompt,
                    },
                  ],
                },
              ],
              generationConfig: {
                response_mime_type: 'application/json',
                temperature: 0.1,
              },
            }),
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const msg = errData?.error?.message || `HTTP ${response.status} ${response.statusText}`;
            lastError = `Model ${model} error: ${msg}`;
            continue; // try next model
          }

          const data = await response.json();
          const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

          if (!candidateText) {
            lastError = 'No text returned from Gemini model.';
            continue;
          }

          const parsed = JSON.parse(candidateText);

          // Format and sanitize into our Timetable schema
          const validatedTimetable = this.normalizeExtractedData(parsed, file.name);
          return {
            success: true,
            timetable: validatedTimetable,
          };
        } catch (err: any) {
          lastError = err.message || String(err);
        }
      }

      return {
        success: false,
        error: lastError || 'Failed to extract timetable from PDF.',
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'An unexpected error occurred while reading the PDF file.',
      };
    }
  },

  /**
   * Normalize and add persistent IDs
   */
  normalizeExtractedData(raw: any, fileName: string): Timetable {
    const timetableId = `tt_${Date.now()}`;
    const validDays: DayOfWeek[] = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];

    const rawDivisions = Array.isArray(raw?.divisions) ? raw.divisions : [];

    const divisions: Division[] = rawDivisions.map((rawDiv: any, dIdx: number) => {
      const divId = `div_${dIdx}_${Date.now()}`;
      const divName = rawDiv?.name || `Division ${String.fromCharCode(65 + dIdx)}`;

      const rawSlots = Array.isArray(rawDiv?.slots) ? rawDiv.slots : [];
      const slots: TimetableSlot[] = rawSlots.map((rawSlot: any, sIdx: number) => {
        let day: DayOfWeek = 'Monday';
        if (rawSlot?.day) {
          const matched = validDays.find(
            (d) => d.toLowerCase() === String(rawSlot.day).trim().toLowerCase()
          );
          if (matched) day = matched;
        }

        const validTypes: SlotType[] = ['lecture', 'lab', 'tutorial', 'break'];
        const slotType: SlotType = validTypes.includes(rawSlot?.type) ? rawSlot.type : 'lecture';

        return {
          id: `slot_${dIdx}_${sIdx}_${Date.now()}`,
          day,
          startTime: rawSlot?.startTime || '09:00',
          endTime: rawSlot?.endTime || '10:00',
          subjectCode: rawSlot?.subjectCode || 'SUB',
          subjectName: rawSlot?.subjectName || rawSlot?.subjectCode || 'General Session',
          room: rawSlot?.room || 'TBD Room',
          faculty: rawSlot?.faculty || undefined,
          type: slotType,
          batch: rawSlot?.batch || 'All',
        };
      });

      return {
        id: divId,
        name: divName,
        slots,
      };
    });

    // If no divisions found, create at least one fallback
    if (divisions.length === 0) {
      divisions.push({
        id: `div_0_${Date.now()}`,
        name: 'General Division',
        slots: [],
      });
    }

    return {
      id: timetableId,
      title: raw?.title || fileName.replace(/\.[^/.]+$/, ''),
      institution: raw?.institution || 'College Schedule',
      semester: raw?.semester || '',
      academicYear: raw?.academicYear || '',
      divisions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },
};
