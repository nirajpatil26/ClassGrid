import React, { useState, useEffect } from 'react';
import { X, BookOpen, Trash2, Check } from 'lucide-react';
import type { TimetableSlot, LectureNote } from '../types/timetable';


interface LectureNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot: TimetableSlot | null;
  date: string; // YYYY-MM-DD
  divisionId: string;
  existingNote?: LectureNote;
  onSaveNote: (note: Omit<LectureNote, 'id' | 'createdAt'>) => void;
  onDeleteNote?: (id: string) => void;
}

export const LectureNoteModal: React.FC<LectureNoteModalProps> = ({
  isOpen,
  onClose,
  slot,
  date,
  divisionId,
  existingNote,
  onSaveNote,
  onDeleteNote,
}) => {
  const [topicTaught, setTopicTaught] = useState('');
  const [homework, setHomework] = useState('');

  useEffect(() => {
    if (existingNote) {
      setTopicTaught(existingNote.topicTaught || '');
      setHomework(existingNote.homework || '');
    } else {
      setTopicTaught('');
      setHomework('');
    }
  }, [existingNote, isOpen]);

  if (!isOpen || !slot) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicTaught.trim()) return;

    onSaveNote({
      date,
      slotId: slot.id,
      subjectCode: slot.subjectCode,
      subjectName: slot.subjectName,
      room: slot.room,
      topicTaught: topicTaught.trim(),
      homework: homework.trim() ? homework.trim() : undefined,
      divisionId,
    });
    onClose();
  };

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date + 'T00:00:00'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div 
        className="w-full max-w-lg bg-[#11131a] border border-slate-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-300">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                Lecture Notes & Topics
              </h2>
              <p className="text-xs text-slate-400">
                {formattedDate} • {slot.startTime} - {slot.endTime}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Subject & Classroom banner */}
        <div className="px-5 py-3 bg-[#0d0e14] border-b border-slate-800/60 flex items-center justify-between text-xs">
          <div className="min-w-0 pr-2">
            <span className="font-mono text-slate-400 mr-2 font-semibold">
              {slot.subjectCode}
            </span>
            <span className="text-slate-200 font-medium truncate">
              {slot.subjectName}
            </span>
          </div>
          <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 font-mono text-[11px] text-slate-200">
            <span className="text-slate-400">Room:</span>
            <span className="font-semibold text-slate-100">{slot.room}</span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              What was taught in this lecture? <span className="text-slate-500">*</span>
            </label>
            <textarea
              value={topicTaught}
              onChange={(e) => setTopicTaught(e.target.value)}
              placeholder="e.g. Covered Chapter 3: Binary Search Trees, AVL balance factors, and node rotations with practice problems..."
              rows={4}
              required
              className="w-full text-xs rounded-lg bg-slate-900 border border-slate-800 p-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600 resize-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Homework / Assignment / Next Class Prep (Optional)
            </label>
            <input
              type="text"
              value={homework}
              onChange={(e) => setHomework(e.target.value)}
              placeholder="e.g. Read section 3.4; solve problem set 2 for Monday"
              className="w-full text-xs rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600 transition-colors"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-2">
            <div>
              {existingNote && onDeleteNote && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Delete this lecture note?')) {
                      onDeleteNote(existingNote.id);
                      onClose();
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors border border-rose-900/40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-medium rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!topicTaught.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg bg-slate-200 text-slate-900 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                Save Note
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
