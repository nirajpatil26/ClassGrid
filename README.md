# ClassGrid — 100% Offline College Timetable, Attendance & Lecture Notes

A clean, mobile-first Progressive Web Application (PWA) built for college students. It runs **completely offline without any external APIs, cloud services, or internet access**.

---

## 🔒 100% Offline & Private
- **Zero External APIs**: No Google API, OpenAI API, or cloud keys required.
- **On-Device PDF Parsing**: Uses client-side WebAssembly / PDF.js to extract text, coordinate positions, days, times, and classroom numbers directly inside your browser.
- **Device-Local Storage**: Your timetable, attendance records, and lecture notes never leave your phone or computer.

---

## 🚀 Key Features

1. **Offline PDF Timetable Ingestion**:
   - Drag & drop any college timetable PDF.
   - The on-device engine parses pages locally, extracts divisions, days, time slots, and classroom numbers.
   - **Interactive Review Mode**: Immediately inspect extracted classes, adjust classroom numbers or times, and add any custom slots before saving.

2. **Offline Paste / Text Parser**:
   - If you copied your timetable from your university portal, student ERP, or WhatsApp, simply paste the text and it organizes it into days and slots.

3. **Prominent Classroom Numbers**:
   - Every class card features a high-visibility classroom/lab badge (e.g., `Room 302`, `Lab 3`, `LH-101`).
   - Dedicated **Classrooms** explorer to view room occupancy and check which rooms are in use or free.

4. **1-Tap Attendance Tracker**:
   - Mark **Present**, **Absent**, or **Cancelled** for each class right from today's schedule.
   - Subject-wise attendance percentages with safe bunk / recovery class calculator vs. your target goal (default $75\%$).

5. **"What Was Taught" Lecture Notes**:
   - Log topics covered in class and upcoming homework.
   - Search notes archive and export to Markdown (`.md`) before exams.

6. **Offline Backup & Share (JSON)**:
   - Export your entire schedule, attendance, and notes to a `.json` backup file.
   - Share the `.json` file with classmates so they can import the division timetable in 1 second!

---

## 📱 How to Run & Install on Mobile

### 1. Start Local Server
```bash
cd college-timetable-app
npm run dev
```

### 2. Open on Your Phone
Connect your phone to the same Wi-Fi network:
1. Open the network URL shown in your terminal (e.g. `http://192.168.25.101:5173/`).
2. In **Chrome** (Android) or **Safari** (iOS), tap the browser menu $\rightarrow$ **"Add to Home Screen"** or **"Install App"**.
3. It installs with a native icon and functions **100% offline** — no cellular data or Wi-Fi needed once loaded.
