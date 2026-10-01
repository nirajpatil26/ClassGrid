import * as pdfjsLib from 'pdfjs-dist';
import type { Timetable, TimetableSlot, Division, DayOfWeek, SlotType } from '../types/timetable';
import { DEFAULT_BACKEND_GEMINI_KEY, type VisionProvider } from './storage';

// Ensure PDF.js worker is ready
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export interface VisionConfig {
  provider: VisionProvider;
  apiKey: string;
  model?: string;
  customEndpoint?: string;
}

export interface VisionScanResult {
  success: boolean;
  timetable?: Timetable;
  error?: string;
}

export const PROVIDER_INFO: Record<
  VisionProvider,
  {
    name: string;
    description: string;
    endpoint: string;
    proxyEndpoint?: string;
    defaultModel: string;
    models: string[];
    keyHelpUrl: string;
    keyPlaceholder: string;
    requiresKey: boolean;
  }
> = {
  gemini: {
    name: 'Google Gemini (Recommended)',
    description: 'Native timetable analysis powered by Gemini 3.8 Flash.',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    defaultModel: 'gemini-3.8-flash',
    models: ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'],
    keyHelpUrl: 'https://aistudio.google.com/app/apikey',
    keyPlaceholder: 'AIzaSy...',
    requiresKey: true,
  },
  groq: {
    name: 'Groq Cloud (Fast & Free)',
    description: 'Free Vision AI tier, very fast processing (~2-3s). Zero credit card required.',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    proxyEndpoint: '/proxy/groq/openai/v1/chat/completions',
    defaultModel: 'llama-3.2-11b-vision-preview',
    models: ['llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview'],
    keyHelpUrl: 'https://console.groq.com/keys',
    keyPlaceholder: 'gsk_...',
    requiresKey: true,
  },
  openrouter: {
    name: 'OpenRouter (Free Vision Models)',
    description: 'Includes 100% free Qwen 2.5 VL and Llama 3.2 Vision. No credit card needed.',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    proxyEndpoint: '/proxy/openrouter/api/v1/chat/completions',
    defaultModel: 'qwen/qwen-2.5-vl-72b-instruct:free',
    models: [
      'qwen/qwen-2.5-vl-72b-instruct:free',
      'meta-llama/llama-3.2-11b-vision-instruct:free',
      'openrouter/free',
    ],
    keyHelpUrl: 'https://openrouter.ai/keys',
    keyPlaceholder: 'sk-or-v1-...',
    requiresKey: true,
  },
  ollama: {
    name: 'Ollama (100% Local AI)',
    description: 'Runs completely on your PC with zero API keys and 100% privacy.',
    endpoint: 'http://localhost:11434/v1/chat/completions',
    defaultModel: 'llama3.2-vision',
    models: ['llama3.2-vision', 'minicpm-v', 'llava'],
    keyHelpUrl: 'https://ollama.com',
    keyPlaceholder: 'No key needed for local Ollama',
    requiresKey: false,
  },
  custom: {
    name: 'Custom OpenAI-Compatible Vision API',
    description: 'Connect any vision-capable OpenAI-compatible model endpoint.',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o'],
    keyHelpUrl: '',
    keyPlaceholder: 'API Key...',
    requiresKey: true,
  },
};

const SYSTEM_TIMETABLE_PROMPT = `You are a specialized AI assistant designed to extract college/university timetables from documents, images, and PDF scans.
Your task is to analyze the timetable grid and accurately identify:
1. Division / Branch / Section names (e.g. "Division Q", "Division A", "CSE-3A"). If only one schedule exists, name it "Division A".
2. Day of the week for every scheduled lecture: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday.
3. Start and End times formatted in 24-hr format "HH:MM" (e.g. "09:00", "10:00", "11:15", "14:00").
4. Subject Code (e.g. "CS301", "AM-I") and Subject Name (e.g. "Data Structures", "Applied Maths").
5. CLASSROOM / LAB NUMBER: Look carefully inside each timetable cell or footnote for room identifiers (e.g. "Room 302", "LH-1", "Lab 4", "Hall 201"). This is crucial so students know which classroom to go to!
6. Slot Type: "lecture", "lab", "tutorial", or "break".
7. Faculty: Teacher's name or initials if present.

CRITICAL REQUIREMENTS FOR FULL-WEEK & MULTI-PAGE EXTRACTION:
- MULTI-PAGE DOCUMENTS: The user document may contain MULTIPLE pages. Often, each page represents a separate day of the week (e.g. Page 1 = Monday, Page 2 = Tuesday, Page 3 = Wednesday, Page 4 = Thursday, Page 5 = Friday, Page 6 = Saturday).
- YOU MUST PROCESS AND EXTRACT SLOTS FROM EVERY SINGLE PAGE PROVIDED. NEVER STOP AFTER PAGE 2 OR 3!
- COMPLETE ALL DAYS: You MUST output slots for ALL days present in the timetable: Monday, Tuesday, Wednesday, Thursday, Friday, and Saturday. Do NOT skip Thursday, Friday, or Saturday under any circumstances!
- COMBINE INTO DIVISIONS: Group all slots from all days into their respective division's "slots" array.

Return ONLY a valid JSON object strictly matching this schema with NO extra markdown or explanations:
{
  "title": "College Timetable Title",
  "institution": "College Name",
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
          "faculty": "Prof. Sharma",
          "type": "lecture"
        }
      ]
    }
  ]
}`;

export const VisionScannerService = {
  /**
   * Convert File into raw base64 string
   */
  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  },

  /**
   * Convert an image File into a base64 Data URL
   */
  async readImageAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  },

  /**
   * Render PDF pages into high-res JPEG Data URLs using HTML5 Canvas & PDF.js
   */
  /**
   * Render PDF pages into high-res JPEG Data URLs using HTML5 Canvas & PDF.js
   */
  async renderPdfPagesToImages(
    file: File,
    maxPages: number = 12,
    onProgress?: (msg: string) => void
  ): Promise<string[]> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      useSystemFonts: true,
    }).promise;

    const pagesToRender = Math.min(pdf.numPages, maxPages);
    const images: string[] = [];

    for (let pageNum = 1; pageNum <= pagesToRender; pageNum++) {
      onProgress?.(`Rendering timetable page ${pageNum} of ${pagesToRender} into high-res frame...`);
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const context = canvas.getContext('2d');
      if (!context) continue;

      await (page.render as any)({
        canvas,
        canvasContext: context,
        viewport,
      }).promise;

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      images.push(dataUrl);
    }

    return images;
  },

  /**
   * Automatically process input file (PDF or Image) into base64 visual frames
   */
  async fileToVisualFrames(
    file: File,
    onProgress?: (msg: string) => void
  ): Promise<string[]> {
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(file.name);
    if (isImage) {
      const dataUrl = await this.readImageAsDataUrl(file);
      return [dataUrl];
    }
    return await this.renderPdfPagesToImages(file, 12, onProgress);
  },

  /**
   * Query the Gemini API to get available models for this specific API key
   */
  async getAvailableGeminiModels(apiKey: string): Promise<string[]> {
    try {
      const cleanKey = apiKey.trim().replace(/^['"]|['"]$/g, '');
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`
      );
      if (!response.ok) return [];
      const data = await response.json();
      if (!Array.isArray(data?.models)) return [];
      return data.models
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => m.name.replace(/^models\//, ''));
    } catch {
      return [];
    }
  },

  /**
   * Scan timetable with Google Gemini API (supporting 3.8 Flash, 2.5 Flash, 1.5 Flash)
   */
  async scanWithGemini(
    file: File,
    apiKey: string,
    requestedModel?: string,
    onProgress?: (msg: string) => void
  ): Promise<VisionScanResult> {
    const cleanKey = (apiKey || DEFAULT_BACKEND_GEMINI_KEY).trim().replace(/^['"]|['"]$/g, '');

    if (!cleanKey) {
      return {
        success: false,
        error: 'Please enter your Google Gemini API Key. You can get a free key at https://aistudio.google.com/app/apikey',
      };
    }

    try {
      onProgress?.('Validating Gemini API access & models...');
      
      // Step 1: Pre-validate API key & fetch accessible models
      let availableModels: string[] = [];
      try {
        const checkRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`
        );

        if (!checkRes.ok) {
          const errData = await checkRes.json().catch(() => ({}));
          const msg = errData?.error?.message || `HTTP ${checkRes.status} ${checkRes.statusText}`;

          if (
            checkRes.status === 400 ||
            checkRes.status === 403 ||
            msg.toLowerCase().includes('api_key_invalid') ||
            msg.toLowerCase().includes('not valid')
          ) {
            return {
              success: false,
              error: `Invalid Google Gemini API key: "${msg}". Please obtain a valid key from https://aistudio.google.com/app/apikey`,
            };
          }
        } else {
          const data = await checkRes.json();
          if (Array.isArray(data?.models)) {
            availableModels = data.models
              .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
              .map((m: any) => m.name.replace(/^models\//, ''));
          }
        }
      } catch (err: any) {
        // Network warning
        console.warn('Could not pre-fetch Gemini models:', err);
      }

      onProgress?.('Rendering timetable pages into visual frames...');
      const frames = await this.fileToVisualFrames(file, onProgress);

      if (frames.length === 0) {
        return {
          success: false,
          error: 'Could not render timetable file into images for visual scanning.',
        };
      }

      // Build parts with image frames
      const imageParts = frames.map((dataUrl) => {
        const base64Only = dataUrl.split(',')[1] || dataUrl;
        return {
          inline_data: {
            mime_type: 'image/jpeg',
            data: base64Only,
          },
        };
      });

      // Prepare prioritized list of models
      const defaultCandidates = [
        requestedModel,
        'gemini-3.8-flash',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-1.5-flash-8b',
        'gemini-1.5-pro',
      ].filter(Boolean) as string[];

      // If availableModels was returned, place accessible models first
      const prioritizedModels: string[] = [];
      if (availableModels.length > 0) {
        defaultCandidates.forEach((cand) => {
          if (availableModels.includes(cand) && !prioritizedModels.includes(cand)) {
            prioritizedModels.push(cand);
          }
        });
        // Also add any other flash models found
        availableModels.forEach((m) => {
          if (m.includes('flash') && !prioritizedModels.includes(m)) {
            prioritizedModels.push(m);
          }
        });
      }

      // Add remaining fallbacks
      defaultCandidates.forEach((cand) => {
        if (!prioritizedModels.includes(cand)) {
          prioritizedModels.push(cand);
        }
      });

      let lastError = '';

      for (const model of prioritizedModels) {
        try {
          onProgress?.(`Analyzing schedule, divisions & classrooms with ${model}...`);
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;

          // Try first with response_mime_type: 'application/json'
          let response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    ...imageParts,
                    {
                      text: `${SYSTEM_TIMETABLE_PROMPT}\n\nAnalyze these visual timetable pages and extract all divisions, days, times, subjects, and classroom numbers into the exact JSON format specified.`,
                    },
                  ],
                },
              ],
              generationConfig: {
                response_mime_type: 'application/json',
                temperature: 0.1,
                maxOutputTokens: 8192,
              },
            }),
          });

          // If 400 bad request due to response_mime_type, retry without it
          if (!response.ok && response.status === 400) {
            const errPeek = await response.clone().json().catch(() => ({}));
            const peekMsg = errPeek?.error?.message || '';
            if (
              peekMsg.toLowerCase().includes('response_mime_type') ||
              peekMsg.toLowerCase().includes('generationconfig')
            ) {
              response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  contents: [
                    {
                      parts: [
                        ...imageParts,
                        {
                          text: `${SYSTEM_TIMETABLE_PROMPT}\n\nAnalyze these visual timetable pages and extract all divisions, days, times, subjects, and classroom numbers into the exact JSON format specified.`,
                        },
                      ],
                    },
                  ],
                  generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 8192,
                  },
                }),
              });
            }
          }

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const msg = errData?.error?.message || `HTTP ${response.status} ${response.statusText}`;
            lastError = `Google Gemini (${model}): ${msg}`;

            // If it's a hard auth failure or quota exhausted, stop immediately
            if (
              msg.toLowerCase().includes('api_key_invalid') ||
              msg.toLowerCase().includes('not valid') ||
              response.status === 403
            ) {
              return {
                success: false,
                error: `Gemini API key error: ${msg}. Please verify your key at https://aistudio.google.com/app/apikey`,
              };
            }

            if (response.status === 429 || msg.toLowerCase().includes('quota')) {
              return {
                success: false,
                error: `Gemini quota exceeded: ${msg}. Wait a minute or switch to Groq Cloud / OpenRouter in the modal.`,
              };
            }

            // Try next model if it's a 404 (model not found)
            continue;
          }

          const data = await response.json();
          const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

          if (!candidateText || !candidateText.trim()) {
            lastError = `No timetable text returned by ${model}.`;
            continue;
          }

          onProgress?.('Extracting and verifying schedule data...');
          const jsonStart = candidateText.indexOf('{');
          const jsonEnd = candidateText.lastIndexOf('}');
          if (jsonStart === -1 || jsonEnd === -1) {
            lastError = 'Invalid JSON schedule format returned by Gemini.';
            continue;
          }

          const parsedJson = JSON.parse(candidateText.substring(jsonStart, jsonEnd + 1));
          const timetable = this.normalizeExtractedData(parsedJson, file.name);

          return {
            success: true,
            timetable,
          };
        } catch (err: any) {
          lastError = err.message || String(err);
        }
      }

      return {
        success: false,
        error: lastError || 'Failed to scan timetable with Google Gemini.',
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'An unexpected error occurred during Gemini scanning.',
      };
    }
  },

  /**
   * Scan timetable with Vision AI (Gemini / Groq / OpenRouter / Ollama / Custom)
   */
  async scanTimetableWithVision(
    file: File,
    config: VisionConfig,
    onProgress?: (msg: string) => void
  ): Promise<VisionScanResult> {
    if (config.provider === 'gemini') {
      return this.scanWithGemini(file, config.apiKey, config.model, onProgress);
    }

    const providerMeta = PROVIDER_INFO[config.provider] || PROVIDER_INFO.gemini;

    if (providerMeta.requiresKey && (!config.apiKey || !config.apiKey.trim())) {
      return {
        success: false,
        error: `Please provide your ${providerMeta.name} API key. You can get one at ${providerMeta.keyHelpUrl}`,
      };
    }

    try {
      onProgress?.('Preparing timetable images for visual AI analysis...');
      const frames = await this.fileToVisualFrames(file, onProgress);

      if (frames.length === 0) {
        return {
          success: false,
          error: 'Could not extract or render images from the uploaded timetable file.',
        };
      }

      onProgress?.(
        `Analyzing schedule layout, subjects & classroom numbers with ${providerMeta.name}...`
      );

      const model = config.model || providerMeta.defaultModel;

      let endpoint = providerMeta.endpoint;
      if (typeof window !== 'undefined' && providerMeta.proxyEndpoint) {
        const isLocal =
          window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1';
        if (isLocal) {
          endpoint = providerMeta.proxyEndpoint;
        }
      }
      if (config.provider === 'custom' && config.customEndpoint) {
        endpoint = config.customEndpoint;
      }

      const userContent: any[] = [
        {
          type: 'text',
          text: 'Extract the college timetable schedule, division names, days, times, subjects, and classroom/lab numbers from these timetable images.',
        },
      ];

      frames.forEach((frame) => {
        userContent.push({
          type: 'image_url',
          image_url: {
            url: frame,
          },
        });
      });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      const effectiveKey = config.apiKey?.trim() || (config.provider === 'ollama' ? 'ollama' : '');
      if (effectiveKey) {
        headers['Authorization'] = `Bearer ${effectiveKey}`;
      }

      if (config.provider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://classgrid.local';
        headers['X-Title'] = 'ClassGrid Timetable';
      }

      const requestBody: any = {
        model,
        messages: [
          { role: 'system', content: SYSTEM_TIMETABLE_PROMPT },
          { role: 'user', content: userContent },
        ],
        temperature: 0.1,
        max_tokens: 8192,
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const detailedMsg =
          errJson?.error?.message ||
          errJson?.message ||
          `HTTP ${response.status}: ${response.statusText}`;

        return {
          success: false,
          error: `${providerMeta.name} Error: ${detailedMsg}`,
        };
      }

      const data = await response.json();
      const rawText = data?.choices?.[0]?.message?.content || '';

      if (!rawText.trim()) {
        return {
          success: false,
          error: 'No text response received from visual model.',
        };
      }

      onProgress?.('Extracting and verifying timetable slots...');

      const jsonStart = rawText.indexOf('{');
      const jsonEnd = rawText.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) {
        return {
          success: false,
          error: 'Model response did not contain a valid JSON schedule.',
        };
      }

      const cleanJson = rawText.substring(jsonStart, jsonEnd + 1);
      const parsedData = JSON.parse(cleanJson);

      const timetable = this.normalizeExtractedData(parsedData, file.name);

      return {
        success: true,
        timetable,
      };
    } catch (err: any) {
      console.error('Vision scanning exception:', err);
      return {
        success: false,
        error:
          err.message ||
          'Failed to communicate with the vision model. Check your internet connection or API key.',
      };
    }
  },

  normalizeExtractedData(raw: any, fileName: string): Timetable {
    const timetableId = `tt_vis_${Date.now()}`;
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
        const slotType: SlotType = validTypes.includes(rawSlot?.type)
          ? rawSlot.type
          : 'lecture';

        return {
          id: `slot_vis_${dIdx}_${sIdx}_${Date.now()}`,
          day,
          startTime: String(rawSlot?.startTime || '09:00').trim(),
          endTime: String(rawSlot?.endTime || '10:00').trim(),
          subjectCode: String(rawSlot?.subjectCode || 'SUB').trim(),
          subjectName: String(
            rawSlot?.subjectName || rawSlot?.subjectCode || 'General Class'
          ).trim(),
          room: String(rawSlot?.room || 'Room 302').trim(),
          faculty: rawSlot?.faculty ? String(rawSlot.faculty).trim() : undefined,
          type: slotType,
          batch: rawSlot?.batch ? String(rawSlot.batch).trim() : undefined,
        };
      });

      return {
        id: `div_vis_${dIdx}_${Date.now()}`,
        name: divName,
        slots,
      };
    });

    if (divisions.length === 0) {
      divisions.push({
        id: `div_vis_0_${Date.now()}`,
        name: 'Division A',
        slots: [],
      });
    }

    return {
      id: timetableId,
      title: raw?.title || fileName.replace(/\.[^/.]+$/, ''),
      institution: raw?.institution || 'College Schedule',
      divisions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },
};
