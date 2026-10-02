import * as pdfjsLib from 'pdfjs-dist';
import type { Timetable, TimetableSlot, Division, DayOfWeek, SlotType } from '../types/timetable';
import { 
  DEFAULT_BACKEND_GEMINI_KEY, 
  BACKEND_GEMINI_KEYS, 
  DEFAULT_BACKEND_GROQ_KEY, 
  type VisionProvider 
} from './storage';
import { detectSlotBatch } from '../utils/groupUtils';

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
    models: ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-3.1-flash-lite'],
    keyHelpUrl: 'https://aistudio.google.com/app/apikey',
    keyPlaceholder: 'AIzaSy...',
    requiresKey: true,
  },
  groq: {
    name: 'Groq Cloud (Fast & Free)',
    description: 'Ultra-fast LPU timetable extraction (~1-2s). Zero credit card required.',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    proxyEndpoint: '/proxy/groq/openai/v1/chat/completions',
    defaultModel: 'openai/gpt-oss-120b',
    models: ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'],
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
    name: 'OpenAI GPT / Custom Vision API',
    description: 'Use OpenAI GPT-4o-mini / GPT-4o or any other OpenAI-compatible vision endpoint.',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o'],
    keyHelpUrl: 'https://platform.openai.com/api-keys',
    keyPlaceholder: 'sk-proj-...',
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
8. BATCH / PRACTICAL GROUP (CRITICAL):
   - In college timetables, numbers or suffixes attached to subjects (e.g. "DECO-1" and "DECO-2", "CN-1" and "CN-2", "Q1", "Q2", "B1", "B2") DO NOT mean they are different subjects!
   - They represent PRACTICAL LAB GROUPS / BATCHES inside the division!
   - For example, if Division is "Q", "DECO-1" is Group Q1, and "DECO-2" is Group Q2.
   - For every such slot:
     * Set clean "subjectCode": "DECO"
     * Set "subjectName": "DECO Lab"
     * Set "type": "lab"
     * Set "batch": "Q1" (for DECO-1) or "Q2" (for DECO-2)
   - For regular lectures attended by all students, set "batch": "All".

CRITICAL REQUIREMENTS FOR FULL-WEEK & MULTI-PAGE EXTRACTION:
- ABSOLUTELY NO SKIPPING: You MUST extract EVERY SINGLE lecture, lab, and tutorial present in the image/document. Do NOT skip any slots or abbreviate your response.
- COMPLETE ALL DAYS: You MUST output slots for ALL days present (Monday, Tuesday, Wednesday, Thursday, Friday, Saturday). If a day has 8 classes, you must output exactly 8 slots for that day.
- MULTI-PAGE DOCUMENTS: The user document may contain MULTIPLE pages. Often, each page represents a separate day of the week (e.g. Page 1 = Monday, Page 2 = Tuesday, Page 3 = Wednesday, Page 4 = Thursday, Page 5 = Friday, Page 6 = Saturday).
- YOU MUST PROCESS AND EXTRACT SLOTS FROM EVERY SINGLE PAGE PROVIDED. NEVER STOP EARLY!
- COMBINE INTO DIVISIONS: Group all slots from all days into their respective division's "slots" array.

Return ONLY a valid JSON object strictly matching this schema with NO extra markdown or explanations:
{
  "title": "College Timetable Title",
  "institution": "College Name",
  "divisions": [
    {
      "name": "Division Q",
      "slots": [
        {
          "day": "Monday",
          "startTime": "09:00",
          "endTime": "10:00",
          "subjectCode": "CS301",
          "subjectName": "Data Structures",
          "room": "Room 302",
          "faculty": "Prof. Sharma",
          "type": "lecture",
          "batch": "All"
        },
        {
          "day": "Monday",
          "startTime": "11:15",
          "endTime": "13:15",
          "subjectCode": "DECO",
          "subjectName": "DECO Lab",
          "room": "Lab 2",
          "faculty": "Prof. Patel",
          "type": "lab",
          "batch": "Q1"
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
      onProgress?.(`Rendering timetable page ${pageNum} of ${pagesToRender} into optimized frame...`);
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.35 });

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

      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
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

      // Prepare prioritized list of active models (excluding deprecated 1.5/2.0/2.5 models)
      const isDeprecated = (m?: string) => Boolean(m && /1\.5|2\.0|2\.5/.test(m));
      const defaultCandidates = [
        requestedModel,
        'gemini-3.8-flash',
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3-flash-preview',
        'gemini-3.1-flash-lite',
      ].filter((m): m is string => Boolean(m) && !isDeprecated(m));

      // If availableModels was returned, place accessible models first
      const prioritizedModels: string[] = [];
      if (availableModels.length > 0) {
        defaultCandidates.forEach((cand) => {
          if (availableModels.includes(cand) && !prioritizedModels.includes(cand) && !isDeprecated(cand)) {
            prioritizedModels.push(cand);
          }
        });
        // Also add any other active flash models found
        availableModels.forEach((m) => {
          if (m.includes('flash') && !m.includes('tts') && !m.includes('image') && !prioritizedModels.includes(m) && !isDeprecated(m)) {
            prioritizedModels.push(m);
          }
        });
      }

      // Add remaining fallbacks
      defaultCandidates.forEach((cand) => {
        if (!prioritizedModels.includes(cand) && !isDeprecated(cand)) {
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

            // If it's a hard auth failure (invalid key), stop immediately
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

            // If rate-limited / quota exhausted / high demand on this model, DO NOT abort!
            // Automatically try next model in the pool (e.g. gemini-3.6-flash, 3.5-flash)
            if (response.status === 429 || msg.toLowerCase().includes('quota') || response.status === 503) {
              onProgress?.(`${model} limit reached, switching to backup Gemini engine...`);
              continue;
            }

            // Try next model if it's a 404 or other issue
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

  /**
   * Fast Digital PDF Text Extractor
   * Checks if the PDF contains machine-readable text to skip heavy vision rendering.
   */
  async extractPdfText(file: File): Promise<{ text: string; hasDigitalText: boolean }> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer,
        useSystemFonts: true,
      }).promise;

      let combined = '';
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        for (const item of textContent.items as any[]) {
          if (item?.str) combined += item.str + ' ';
        }
        combined += '\n';
      }

      const clean = combined.trim();
      const hasDays = /\b(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(clean);
      const hasTimes = /\b\d{1,2}[:.]\d{2}\b/.test(clean);
      const hasTimetableKeywords = /\b(time|table|schedule|dept|room|batch|slot|class|div|semester|sem)\b/i.test(clean);
      const hasDigitalText = clean.length > 40 && (hasDays || hasTimes || hasTimetableKeywords);

      return { text: clean, hasDigitalText };
    } catch {
      return { text: '', hasDigitalText: false };
    }
  },

  /**
   * Process digital timetable text with Groq Cloud LPU
   * Runs in ~1 second, consumes zero vision tokens, and has generous free rate limits.
   */
  async scanWithGroqText(
    text: string,
    apiKey: string,
    fileName: string = 'Timetable',
    onProgress?: (msg: string) => void
  ): Promise<VisionScanResult> {
    const groqModels = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'];
    const prompt = `${SYSTEM_TIMETABLE_PROMPT}\n\nHere is the text extracted from the college timetable document:\n\n${text.substring(0, 30000)}\n\nExtract all divisions, days, slots, subjects, rooms, faculty, and lab groups into the required JSON format.`;

    let lastGroqError = '';

    for (const model of groqModels) {
      try {
        onProgress?.(`Processing schedule with Groq LPU (${model})...`);

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content: 'You extract college timetables into structured JSON according to the schema provided. Only output valid JSON matching the format.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.1,
          })
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          lastGroqError = err?.error?.message || `Groq HTTP ${response.status}`;
          continue;
        }

        const data = await response.json();
        const rawContent = data.choices?.[0]?.message?.content;
        if (!rawContent) {
          lastGroqError = `No content returned by Groq (${model}).`;
          continue;
        }

        const jsonStart = rawContent.indexOf('{');
        const jsonEnd = rawContent.lastIndexOf('}');
        if (jsonStart === -1 || jsonEnd === -1) {
          lastGroqError = 'Groq response did not contain a valid JSON schedule.';
          continue;
        }

        const cleanJson = rawContent.substring(jsonStart, jsonEnd + 1);
        const parsedData = JSON.parse(cleanJson);
        const timetable = this.normalizeExtractedData(parsedData, fileName);

        return {
          success: true,
          timetable,
        };
      } catch (err: any) {
        lastGroqError = err.message || String(err);
      }
    }

    throw new Error(lastGroqError || 'Failed to process schedule with Groq.');
  },

  /**
   * Resilient Multi-Key Auto-Failover Scanner
   * Combines digital text extraction (Groq) with Gemini Key Pool failover.
   */
  async scanWithAutoFailover(
    file: File,
    onProgress?: (msg: string) => void
  ): Promise<VisionScanResult> {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const groqKey = DEFAULT_BACKEND_GROQ_KEY;
    const geminiKeys = BACKEND_GEMINI_KEYS.length > 0 ? BACKEND_GEMINI_KEYS : [DEFAULT_BACKEND_GEMINI_KEY];

    // --- PHASE 1: Gemini Key Pool with Automatic Failover (for images or visual PDFs) ---
    // Vision AI is highly prioritized because timetables are tabular grids.
    // Text extraction destroys spatial layout, leading to terrible parsing by text models.
    let lastError = '';
    for (let i = 0; i < geminiKeys.length; i++) {
      const key = geminiKeys[i];
      const keyLabel = i === 0 ? 'Gemini AI Vision' : `Backup Gemini Key (${i + 1})`;
      onProgress?.(`Analyzing timetable grid with ${keyLabel}...`);

      try {
        const result = await this.scanWithGemini(file, key, 'gemini-3.8-flash', onProgress);
        // Ensure Gemini extracted a reasonable number of slots before accepting it blindly
        const totalSlots = result.timetable?.divisions.reduce((sum, d) => sum + d.slots.length, 0) || 0;
        
        if (result.success && result.timetable) {
          if (totalSlots > 2) {
            return result;
          } else {
            lastError = `Extracted only ${totalSlots} classes. Trying backup method...`;
          }
        } else if (result.error) {
          lastError = result.error;
        }
      } catch (err: any) {
        lastError = err.message || 'Network error';
      }
    }

    // --- PHASE 2: Fallback to Groq Digital Text if Vision fails (e.g. Rate Limit) ---
    if (isPdf && groqKey) {
      onProgress?.('Vision scanning unavailable. Falling back to text inspection...');
      const { text, hasDigitalText } = await this.extractPdfText(file);

      if (hasDigitalText || text.length > 40) {
        try {
          onProgress?.('Text detected! Running fast Groq analysis... (Accuracy may be lower for grids)');
          const result = await this.scanWithGroqText(text, groqKey, file.name, onProgress);
          if (result.success && result.timetable && result.timetable.divisions.some(d => d.slots.length > 0)) {
            return result;
          }
        } catch (groqErr) {
          console.warn('Groq text scan fallback failed...', groqErr);
        }
      }
    }


    return {
      success: false,
      error: lastError || 'All AI engines were busy. Please try again in 30 seconds.',
    };
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

        const batchInfo = detectSlotBatch(
          String(rawSlot?.subjectCode || 'SUB'),
          String(rawSlot?.subjectName || rawSlot?.subjectCode || 'General Class'),
          rawSlot?.batch ? String(rawSlot.batch) : undefined,
          divName
        );

        const validTypes: SlotType[] = ['lecture', 'lab', 'tutorial', 'break'];
        const slotType: SlotType = batchInfo.isLab
          ? 'lab'
          : validTypes.includes(rawSlot?.type)
          ? rawSlot.type
          : 'lecture';

        return {
          id: `slot_vis_${dIdx}_${sIdx}_${Date.now()}`,
          day,
          startTime: String(rawSlot?.startTime || '09:00').trim(),
          endTime: String(rawSlot?.endTime || '10:00').trim(),
          subjectCode: batchInfo.subjectCode,
          subjectName: batchInfo.subjectName,
          room: String(rawSlot?.room || 'Room 302').trim(),
          faculty: rawSlot?.faculty ? String(rawSlot.faculty).trim() : undefined,
          type: slotType,
          batch: batchInfo.batch,
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
