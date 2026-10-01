import React, { useState } from 'react';
import type { LectureNote, Division } from '../types/timetable';

import { BookOpen, Search, Filter, Calendar, MapPin, Trash2, Download } from 'lucide-react';
import { formatFriendlyDate } from '../utils/dateUtils';

interface NotesArchiveViewProps {
  division: Division;
  notes: LectureNote[];
  onDeleteNote: (id: string) => void;
}

export const NotesArchiveView: React.FC<NotesArchiveViewProps> = ({
  division,
  notes,
  onDeleteNote,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');

  // Filter notes for this division
  const divisionNotes = notes.filter((n) => n.divisionId === division.id);

  // Collect unique subjects from notes
  const subjectsSet = new Set<string>();
  divisionNotes.forEach((n) => subjectsSet.add(n.subjectCode));
  const uniqueSubjects = Array.from(subjectsSet);

  const filteredNotes = divisionNotes
    .filter((n) => {
      if (selectedSubject !== 'all' && n.subjectCode !== selectedSubject) return false;
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        n.topicTaught.toLowerCase().includes(query) ||
        n.subjectName.toLowerCase().includes(query) ||
        n.subjectCode.toLowerCase().includes(query) ||
        (n.homework && n.homework.toLowerCase().includes(query))
      );
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  const handleExportMarkdown = () => {
    if (filteredNotes.length === 0) return;

    let md = `# Lecture Notes & Topics Taught — ${division.name}\n`;
    md += `Exported on: ${new Date().toLocaleDateString()}\n\n---\n\n`;

    filteredNotes.forEach((n) => {
      md += `### ${n.subjectCode}: ${n.subjectName}\n`;
      md += `- **Date:** ${n.date} ${n.room ? `| **Room:** ${n.room}` : ''}\n`;
      md += `- **Topics Taught:**\n  ${n.topicTaught}\n`;
      if (n.homework) {
        md += `- **Assignment / Prep:** ${n.homework}\n`;
      }
      md += `\n---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Lecture_Notes_${division.name.replace(/\s+/g, '_')}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-slate-400" />
            Lecture Notes & Topics Log
          </h2>
          <p className="text-xs text-slate-400">
            Recorded syllabus topics, notes, and homework from your daily lectures.
          </p>
        </div>

        {/* Export Notes Button */}
        {filteredNotes.length > 0 && (
          <button
            onClick={handleExportMarkdown}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Notes (.md)</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search topics taught, formulas, keywords..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-600 transition-colors"
          />
        </div>

        {/* Subject Filter */}
        {uniqueSubjects.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="text-xs py-1.5 px-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All Subjects</option>
              {uniqueSubjects.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Notes List */}
      <div className="space-y-3">
        {filteredNotes.length === 0 ? (
          <div className="text-center py-12 rounded-xl bg-slate-900/30 border border-slate-800 text-slate-400 space-y-2">
            <BookOpen className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-sm font-medium text-slate-300">No lecture notes recorded yet</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Tap <span className="text-slate-300 font-medium">"+ Lecture Notes"</span> on any class card in the Today view to record what was taught.
            </p>
          </div>
        ) : (
          filteredNotes.map((note) => {
            const dateFormatted = formatFriendlyDate(note.date);
            const isTodayNote = dateFormatted.startsWith('Today');

            return (
              <div
                key={note.id}
                className={`p-4 rounded-xl border transition-all shadow-2xs space-y-2.5 ${
                  isTodayNote
                    ? 'bg-slate-900/90 border-indigo-700/60 ring-1 ring-indigo-500/30'
                    : 'bg-[#0f1118] border-slate-800/90 hover:border-slate-700/80'
                }`}
              >
                {/* Note Header: Subject, Date, Room */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-semibold text-slate-400">
                        {note.subjectCode}
                      </span>
                      <span className="text-xs font-medium text-slate-300 truncate">
                        {note.subjectName}
                      </span>
                      {isTodayNote && (
                        <span className="px-1.5 py-0.2 rounded-full bg-indigo-500 text-white text-[9px] font-bold uppercase">
                          Today
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                      <span className={`flex items-center gap-1 ${isTodayNote ? 'text-indigo-300 font-semibold' : ''}`}>
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {dateFormatted}
                      </span>
                      {note.room && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {note.room}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => {
                      if (confirm('Delete this lecture note?')) {
                        onDeleteNote(note.id);
                      }
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors"
                    title="Delete Note"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Topics Taught */}
                <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800/80 text-xs text-slate-200 leading-relaxed">
                  <span className="block text-[11px] font-medium text-slate-400 mb-1">
                    Topics Covered:
                  </span>
                  <p className="whitespace-pre-wrap">{note.topicTaught}</p>
                </div>

                {/* Homework / Prep */}
                {note.homework && (
                  <div className="text-xs text-slate-400 px-1 flex items-start gap-1.5">
                    <span className="font-medium text-slate-400 shrink-0">Homework / Prep:</span>
                    <span className="text-slate-300">{note.homework}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
