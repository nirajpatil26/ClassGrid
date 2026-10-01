import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  Sparkles, 
  AlertCircle, 
  Check, 
  Plus, 
  Trash2, 
  MapPin, 
  Layers,
  ClipboardList,
  FileCode,
  ExternalLink,
  Key,
  Cpu,
  ImageIcon
} from 'lucide-react';
import { OfflinePdfParserService } from '../services/offlinePdfParser';
import { 
  VisionScannerService, 
  PROVIDER_INFO, 
  type VisionConfig 
} from '../services/visionScanner';
import { StorageService, type VisionProvider } from '../services/storage';
import type { Timetable, TimetableSlot, DayOfWeek } from '../types/timetable';
import { SAMPLE_TIMETABLE } from '../data/sampleTimetable';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTimetableImported: (timetable: Timetable) => void;
}

type ImportTab = 'vision' | 'offline' | 'paste' | 'json';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onTimetableImported,
}) => {
  const [activeTab, setActiveTab] = useState<ImportTab>('vision');
  const [file, setFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  // Vision AI configuration state
  const [provider, setProvider] = useState<VisionProvider>('groq');
  const [apiKey, setApiKey] = useState('');

  // Review & Edit extracted slots before saving
  const [parsedTimetable, setParsedTimetable] = useState<Timetable | null>(null);

  // Text Paste Tab state
  const [pastedText, setPastedText] = useState('');
  const [divisionName, setDivisionName] = useState('Division A');

  // File Inputs
  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const settings = StorageService.getSettings();
      const defaultProvider = settings.visionProvider || 'gemini';
      setProvider(defaultProvider);
      setApiKey(
        defaultProvider === 'gemini'
          ? (settings.geminiApiKey || settings.visionApiKey || '')
          : (settings.visionApiKey || '')
      );
      setErrorMessage('');
      setStatusMessage('');
      setFile(null);
      setParsedTimetable(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      const isValid = 
        selected.type === 'application/pdf' || 
        selected.type.startsWith('image/') ||
        /\.(pdf|png|jpe?g|webp)$/i.test(selected.name);

      if (isValid) {
        setFile(selected);
        setErrorMessage('');
      } else {
        setErrorMessage('Please select a PDF document or image (PNG, JPG, WEBP).');
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selected = e.dataTransfer.files[0];
      const isValid = 
        selected.type === 'application/pdf' || 
        selected.type.startsWith('image/') ||
        /\.(pdf|png|jpe?g|webp)$/i.test(selected.name);

      if (isValid) {
        setFile(selected);
        setErrorMessage('');
      } else {
        setErrorMessage('Please select a PDF document or image (PNG, JPG, WEBP).');
      }
    }
  };

  // Run AI Vision Scan (Groq / OpenRouter / Ollama)
  const handleStartVisionScan = async () => {
    if (!file) {
      setErrorMessage('Please choose or drop a timetable PDF or image first.');
      return;
    }

    const providerMeta = PROVIDER_INFO[provider];
    if (providerMeta.requiresKey && !apiKey.trim()) {
      setErrorMessage(`Please enter your ${providerMeta.name} API key below (it's 100% free with no credit card required).`);
      return;
    }

    // Save key to settings automatically
    const currentSettings = StorageService.getSettings();
    StorageService.saveSettings({
      ...currentSettings,
      visionProvider: provider,
      visionApiKey: apiKey.trim(),
      geminiApiKey: provider === 'gemini' ? apiKey.trim() : currentSettings.geminiApiKey,
    });

    setIsScanning(true);
    setErrorMessage('');
    setStatusMessage('Preparing timetable images...');

    try {
      const config: VisionConfig = {
        provider,
        apiKey: apiKey.trim(),
      };

      const result = await VisionScannerService.scanTimetableWithVision(
        file,
        config,
        (msg) => setStatusMessage(msg)
      );

      if (result.success && result.timetable) {
        setParsedTimetable(result.timetable);
        setStatusMessage('Scan complete! Review your timetable below.');
      } else {
        setErrorMessage(result.error || 'Failed to analyze timetable with AI Vision.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during AI vision scanning.');
    } finally {
      setIsScanning(false);
    }
  };

  // Run 100% Offline PDF Scan (fallback)
  const handleStartOfflineScan = async () => {
    if (!file) {
      setErrorMessage('Please select a timetable PDF file.');
      return;
    }

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setErrorMessage('Offline parsing only works with PDF files. For images, please use the AI Vision Scan tab.');
      return;
    }

    setIsScanning(true);
    setErrorMessage('');
    setStatusMessage('Reading PDF text and cells locally...');

    try {
      const result = await OfflinePdfParserService.parsePdfOffline(file);

      if (result.success && result.timetable) {
        setParsedTimetable(result.timetable);
        setStatusMessage('Scan complete! Review your timetable below.');
      } else {
        setErrorMessage(result.error || 'Failed to read PDF offline.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during offline PDF scan.');
    } finally {
      setIsScanning(false);
    }
  };

  // Parse Pasted Text
  const handleParsePastedText = () => {
    if (!pastedText.trim()) {
      setErrorMessage('Please paste your timetable text.');
      return;
    }

    const slots = OfflinePdfParserService.parsePastedText(pastedText);

    const newTimetable: Timetable = {
      id: `tt_paste_${Date.now()}`,
      title: `${divisionName} Timetable`,
      institution: 'Custom Schedule',
      divisions: [
        {
          id: `div_paste_${Date.now()}`,
          name: divisionName,
          slots: slots.length > 0 ? slots : OfflinePdfParserService.generateFallbackSlotsFromText(pastedText),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setParsedTimetable(newTimetable);
  };

  // JSON File Import
  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed && Array.isArray(parsed.divisions)) {
            setParsedTimetable(parsed);
            setErrorMessage('');
          } else {
            setErrorMessage('Invalid timetable JSON file structure.');
          }
        } catch {
          setErrorMessage('Could not parse JSON file.');
        }
      };
      reader.readAsText(e.target.files[0]);
    }
  };

  // Save parsed timetable to storage and finish
  const handleConfirmTimetable = () => {
    if (!parsedTimetable) return;

    StorageService.addOrUpdateTimetable(parsedTimetable);
    StorageService.setActiveTimetableId(parsedTimetable.id);
    if (parsedTimetable.divisions[0]) {
      StorageService.setActiveDivisionId(parsedTimetable.divisions[0].id);
    }
    onTimetableImported(parsedTimetable);
    onClose();
  };

  // Slot editing in preview
  const handleUpdateSlot = (
    divIndex: number,
    slotId: string,
    field: keyof TimetableSlot,
    value: string
  ) => {
    if (!parsedTimetable) return;
    const updated = { ...parsedTimetable };
    const div = updated.divisions[divIndex];
    const slot = div.slots.find((s) => s.id === slotId);
    if (slot) {
      (slot as any)[field] = value;
      setParsedTimetable({ ...updated });
    }
  };

  const handleDeleteSlot = (divIndex: number, slotId: string) => {
    if (!parsedTimetable) return;
    const updated = { ...parsedTimetable };
    updated.divisions[divIndex].slots = updated.divisions[divIndex].slots.filter((s) => s.id !== slotId);
    setParsedTimetable({ ...updated });
  };

  const handleAddSlot = (divIndex: number) => {
    if (!parsedTimetable) return;
    const updated = { ...parsedTimetable };
    updated.divisions[divIndex].slots.push({
      id: `slot_custom_${Date.now()}`,
      day: 'Monday',
      startTime: '09:00',
      endTime: '10:00',
      subjectCode: 'NEW',
      subjectName: 'New Subject',
      room: 'Room 302',
      type: 'lecture',
    });
    setParsedTimetable({ ...updated });
  };

  const handleLoadSample = () => {
    StorageService.addOrUpdateTimetable(SAMPLE_TIMETABLE);
    StorageService.setActiveTimetableId(SAMPLE_TIMETABLE.id);
    StorageService.setActiveDivisionId(SAMPLE_TIMETABLE.divisions[0].id);
    onTimetableImported(SAMPLE_TIMETABLE);
    onClose();
  };

  const activeProviderMeta = PROVIDER_INFO[provider];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div 
        className="w-full max-w-2xl bg-[#11131a] border border-slate-800 rounded-xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-[#0c0e14]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-100">
                  {parsedTimetable ? 'Review Extracted Timetable' : 'Import College Timetable'}
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/60 font-medium">
                  AI Vision Powered
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {parsedTimetable
                  ? 'Verify classroom numbers, divisions, and times before saving'
                  : 'Fast AI scanning using Groq or OpenRouter (No Google Gemini needed)'}
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

        {/* Tab Strip (Only if not in review mode) */}
        {!parsedTimetable && (
          <div className="flex items-center border-b border-slate-800/80 px-5 pt-2 bg-[#0e1017] gap-4 text-xs font-medium overflow-x-auto">
            <button
              onClick={() => setActiveTab('vision')}
              className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'vision'
                  ? 'border-indigo-400 text-indigo-300 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Vision Scan (Recommended)</span>
            </button>

            <button
              onClick={() => setActiveTab('offline')}
              className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'offline'
                  ? 'border-slate-300 text-slate-100 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Offline Parser</span>
            </button>

            <button
              onClick={() => setActiveTab('paste')}
              className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'paste'
                  ? 'border-slate-300 text-slate-100 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Paste Text</span>
            </button>

            <button
              onClick={() => setActiveTab('json')}
              className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'json'
                  ? 'border-slate-300 text-slate-100 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>JSON Backup</span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[72vh] overflow-y-auto">
          {/* Review & Edit Mode */}
          {parsedTimetable ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-900/60 rounded-lg border border-slate-800 text-xs">
                <div>
                  <span className="font-semibold text-slate-200">{parsedTimetable.title}</span>
                  <span className="text-slate-400 ml-2">
                    ({parsedTimetable.divisions.reduce((sum, d) => sum + d.slots.length, 0)} total classes detected)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setParsedTimetable(null)}
                  className="text-xs text-slate-400 hover:text-slate-200 underline text-left"
                >
                  Upload different timetable
                </button>
              </div>

              {parsedTimetable.divisions.map((div, dIdx) => (
                <div key={div.id} className="space-y-2 border border-slate-800 rounded-xl p-3 bg-[#0c0e14]">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={div.name}
                        onChange={(e) => {
                          const updated = { ...parsedTimetable };
                          updated.divisions[dIdx].name = e.target.value;
                          setParsedTimetable({ ...updated });
                        }}
                        className="font-semibold text-xs text-slate-100 bg-slate-900 px-2 py-1 rounded border border-slate-800 focus:outline-none focus:border-slate-600"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddSlot(dIdx)}
                      className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Add Class
                    </button>
                  </div>

                  {div.slots.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-400">
                      No slots detected in this division. Tap "+ Add Class" above.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {div.slots.map((slot) => (
                        <div
                          key={slot.id}
                          className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80 flex flex-wrap items-center gap-2 text-xs"
                        >
                          {/* Day */}
                          <select
                            value={slot.day}
                            onChange={(e) =>
                              handleUpdateSlot(dIdx, slot.id, 'day', e.target.value as DayOfWeek)
                            }
                            className="bg-slate-800 text-slate-200 py-1 px-1.5 rounded border border-slate-700 text-xs focus:outline-none"
                          >
                            {DAYS.map((d) => (
                              <option key={d} value={d}>
                                {d.substring(0, 3)}
                              </option>
                            ))}
                          </select>

                          {/* Time */}
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={slot.startTime}
                              onChange={(e) =>
                                handleUpdateSlot(dIdx, slot.id, 'startTime', e.target.value)
                              }
                              placeholder="09:00"
                              className="w-14 bg-slate-800 text-slate-200 font-mono py-1 px-1.5 rounded border border-slate-700 text-center text-xs focus:outline-none"
                            />
                            <span className="text-slate-500">-</span>
                            <input
                              type="text"
                              value={slot.endTime}
                              onChange={(e) =>
                                handleUpdateSlot(dIdx, slot.id, 'endTime', e.target.value)
                              }
                              placeholder="10:00"
                              className="w-14 bg-slate-800 text-slate-200 font-mono py-1 px-1.5 rounded border border-slate-700 text-center text-xs focus:outline-none"
                            />
                          </div>

                          {/* Subject Code & Name */}
                          <input
                            type="text"
                            value={slot.subjectCode}
                            onChange={(e) =>
                              handleUpdateSlot(dIdx, slot.id, 'subjectCode', e.target.value)
                            }
                            placeholder="Code"
                            className="w-16 bg-slate-800 text-slate-200 font-mono py-1 px-1.5 rounded border border-slate-700 text-center text-xs focus:outline-none"
                          />

                          <input
                            type="text"
                            value={slot.subjectName}
                            onChange={(e) =>
                              handleUpdateSlot(dIdx, slot.id, 'subjectName', e.target.value)
                            }
                            placeholder="Subject Name"
                            className="flex-1 min-w-[120px] bg-slate-800 text-slate-200 py-1 px-2 rounded border border-slate-700 text-xs focus:outline-none"
                          />

                          {/* Classroom Number */}
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-indigo-400 shrink-0" />
                            <input
                              type="text"
                              value={slot.room}
                              onChange={(e) =>
                                handleUpdateSlot(dIdx, slot.id, 'room', e.target.value)
                              }
                              placeholder="Room / Hall"
                              className="w-24 bg-slate-800 text-slate-200 font-mono font-semibold py-1 px-2 rounded border border-indigo-700/50 text-xs focus:outline-none focus:border-indigo-500"
                              title="Classroom or Lab number"
                            />
                          </div>

                          {/* Delete Slot */}
                          <button
                            type="button"
                            onClick={() => handleDeleteSlot(dIdx, slot.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors ml-auto"
                            title="Remove class"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : activeTab === 'vision' ? (
            /* AI Vision Tab */
            <div className="space-y-4">
              {/* File Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  isDragOver
                    ? 'border-indigo-400 bg-indigo-950/20'
                    : file
                    ? 'border-indigo-600/60 bg-indigo-950/10'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-900/30'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf,image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-950/60 border border-indigo-800/80 flex items-center justify-center text-indigo-300">
                      {file.type === 'application/pdf' ? (
                        <FileText className="w-5 h-5" />
                      ) : (
                        <ImageIcon className="w-5 h-5" />
                      )}
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-xs font-semibold text-slate-200 truncate max-w-xs">
                        {file.name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {(file.size / 1024).toFixed(1)} KB • Click to choose a different file
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-10 h-10 mx-auto rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-200">
                        Drop college timetable PDF or Image (PNG, JPG)
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Understands complex grids, divisions, times, and maps classroom numbers accurately.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* AI Provider Config */}
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-slate-200">
                    <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Vision AI Provider</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Powered by AI Vision
                  </span>
                </div>

                {/* Provider Selector */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {(['gemini', 'groq', 'openrouter', 'ollama'] as VisionProvider[]).map((prov) => (
                    <button
                      key={prov}
                      type="button"
                      onClick={() => setProvider(prov)}
                      className={`p-2 rounded-lg border text-left transition-all ${
                        provider === prov
                          ? 'border-indigo-500/80 bg-indigo-950/40 text-indigo-200 font-semibold'
                          : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                      }`}
                    >
                      <div className="text-[11px] font-medium leading-tight">
                        {prov === 'gemini'
                          ? 'Google Gemini'
                          : prov === 'groq'
                          ? 'Groq Cloud'
                          : prov === 'openrouter'
                          ? 'OpenRouter'
                          : 'Ollama (Local)'}
                      </div>
                      <div className="text-[9px] text-slate-500 mt-0.5">
                        {prov === 'gemini'
                          ? 'Gemini 3.8 Flash'
                          : prov === 'groq'
                          ? 'Free & Fast'
                          : prov === 'openrouter'
                          ? 'Free Models'
                          : 'No key needed'}
                      </div>
                    </button>
                  ))}
                </div>

                {/* API Key Input */}
                {activeProviderMeta.requiresKey ? (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <label className="text-slate-300 flex items-center gap-1">
                        <Key className="w-3 h-3 text-slate-400" />
                        <span>{activeProviderMeta.name} API Key:</span>
                      </label>
                      {activeProviderMeta.keyHelpUrl && (
                        <a
                          href={activeProviderMeta.keyHelpUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 underline"
                        >
                          Get Free Key <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={activeProviderMeta.keyPlaceholder}
                      className="w-full text-xs font-mono rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                    <p className="text-[10px] text-slate-400">
                      Keys are saved only in your local browser storage. Groq and OpenRouter provide generous free tiers with 0 credit card.
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 pt-1">
                    Ollama runs completely locally on your PC at <code className="font-mono text-slate-300">http://localhost:11434</code>. Make sure Ollama has a vision model installed (e.g. <code className="font-mono text-slate-300">ollama run llama3.2-vision</code>).
                  </p>
                )}
              </div>

              {isScanning && (
                <div className="p-3.5 rounded-lg bg-indigo-950/30 border border-indigo-900/60 flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
                  <div className="text-xs text-indigo-200 font-medium">
                    {statusMessage}
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'offline' ? (
            /* Offline PDF Tab */
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  isDragOver
                    ? 'border-slate-400 bg-slate-800/30'
                    : file
                    ? 'border-slate-600 bg-slate-900/60'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-900/30'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-xs font-semibold text-slate-200 truncate max-w-xs">
                        {file.name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {(file.size / 1024).toFixed(1)} KB • Click to change file
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-10 h-10 mx-auto rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-200">
                        Choose or drop college timetable PDF
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Offline regex parser directly on device. Works best with clean digital PDFs.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {isScanning && (
                <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin shrink-0" />
                  <div className="text-xs text-slate-300 font-medium">
                    {statusMessage}
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'paste' ? (
            /* Paste Tab */
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Division Name
                </label>
                <input
                  type="text"
                  value={divisionName}
                  onChange={(e) => setDivisionName(e.target.value)}
                  placeholder="e.g. Division A, CSE-3A"
                  className="w-full text-xs rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-slate-100 focus:outline-none focus:border-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Paste Schedule Text / Syllabus Table
                </label>
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste raw timetable lines here, for example:&#10;Monday 09:00 - 10:00 CS301 Data Structures Room 302&#10;Monday 10:00 - 11:00 CS302 Database Systems Room 302"
                  rows={6}
                  className="w-full text-xs font-mono rounded-lg bg-slate-900 border border-slate-800 p-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-600 resize-none"
                />
              </div>
            </div>
          ) : (
            /* JSON Tab */
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Import a timetable JSON file previously exported from ClassGrid or shared by a classmate:
              </p>
              <input
                ref={jsonFileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleJsonUpload}
                className="block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
              />
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-900/60 flex items-start gap-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-800/60">
            {!parsedTimetable ? (
              <button
                type="button"
                onClick={handleLoadSample}
                className="px-3 py-2 text-xs font-medium rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800/80 transition-colors text-center"
              >
                Load Demo Schedule
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-3.5 py-2 text-xs font-medium rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>

              {parsedTimetable ? (
                <button
                  type="button"
                  onClick={handleConfirmTimetable}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Timetable</span>
                </button>
              ) : activeTab === 'vision' ? (
                <button
                  type="button"
                  onClick={handleStartVisionScan}
                  disabled={isScanning || !file}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {isScanning
                      ? 'Analyzing with AI...'
                      : provider === 'gemini'
                      ? 'Scan with Gemini AI'
                      : 'Scan with AI Vision'}
                  </span>
                </button>
              ) : activeTab === 'offline' ? (
                <button
                  type="button"
                  onClick={handleStartOfflineScan}
                  disabled={isScanning || !file}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-200 text-slate-900 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{isScanning ? 'Scanning...' : 'Scan PDF (Offline)'}</span>
                </button>
              ) : activeTab === 'paste' ? (
                <button
                  type="button"
                  onClick={handleParsePastedText}
                  disabled={!pastedText.trim()}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-200 text-slate-900 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Parse Text</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
