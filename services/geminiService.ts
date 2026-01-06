import { GoogleGenerativeAI } from "@google/generative-ai";
// Asegúrate de que tus tipos existen en esta ruta
import { SongAnalysis, AnalysisLevel } from "../types"; 

// --- CONFIGURACIÓN DE API (CORREGIDO PARA VITE) ---
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.error("Falta la API Key. Asegúrate de tener VITE_GEMINI_API_KEY en tu archivo .env");
}

// Inicializamos el cliente con la librería estándar
const genAI = new GoogleGenerativeAI(API_KEY);

// Usamos Flash 1.5: Es rápido, estable y soporta audio nativamente
//const MODEL_ID = "gemini-1.5-flash-001";
const MODEL_ID = "gemini-2.0-flash-exp"; 

// --- UTILS ---

const extractJSON = (text: string): any => {
  if (!text) throw new Error("Empty response from AI");
  
  let cleanText = text.trim();
  // Limpiamos los bloques de código Markdown que suele poner Gemini
  cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '');
  
  const firstBrace = cleanText.indexOf('{');
  const lastBrace = cleanText.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleanText = cleanText.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("JSON Parse Failed. Raw text:", text);
    throw new Error("Analysis failed to produce valid JSON data. Please try again.");
  }
};

const getLevelInstructions = (level: AnalysisLevel): string => {
  switch (level) {
    case 'Basic':
      return `
      **MODE: BASIC**
      - Output ONLY Major/Minor Triads.
      - Simplify Gmaj7 -> G, Dm9 -> Dm.
      `;
    case 'Intermediate':
      return `
      **MODE: INTERMEDIATE**
      - Identify 7th chords.
      - Identify slash chords.
      `;
    case 'Advanced':
      return `
      **MODE: ADVANCED**
      - Detect extensions (9, 11, 13).
      - Detect altered dominants.
      - Exact bass inversions.
      `;
    default:
      return "";
  }
};

const COMMON_SCHEMA = `
  STRICT JSON OUTPUT ONLY.
  {
    "key": "string",
    "timeSignature": "string",
    "bpmEstimate": "string",
    "modulations": ["string"],
    "complexityLevel": "string",
    "summary": "string",
    "chords": [
      {
        "timestamp": "string (e.g. '0:00')",
        "symbol": "string",
        "quality": "string",
        "extensions": ["string"],
        "bassNote": "string",
        "confidence": number
      }
    ]
  }
`;

// --- RETRY LOGIC ---

const MAX_RETRIES = 3;
const BASE_DELAY = 2000;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function generateWithRetry(
  model: any,
  parts: any[], 
  generationConfig: any, 
  retries = 0
): Promise<any> {
  try {
    console.log(`Analyzing with ${MODEL_ID} (Attempt ${retries + 1})`);
    
    // Llamada estándar a la API
    const result = await model.generateContent({
      contents: [{ role: "user", parts: parts }],
      generationConfig: generationConfig
    });

    return result.response;

  } catch (error: any) {
    const msg = error.message || error.toString();
    // Detectamos errores temporales para reintentar
    const isTransient = msg.includes("503") || msg.includes("429") || msg.includes("Busy") || msg.includes("Overloaded") || msg.includes("fetch failed");
    
    if (isTransient && retries < MAX_RETRIES) {
      const waitTime = BASE_DELAY * Math.pow(2, retries);
      console.warn(`Service Busy. Retrying in ${waitTime}ms...`);
      await delay(waitTime);
      return generateWithRetry(model, parts, generationConfig, retries + 1);
    }
    throw error;
  }
}

// --- PUBLIC METHODS ---

export const analyzeAudioContent = async (base64Data: string, mimeType: string, level: AnalysisLevel, duration: number): Promise<SongAnalysis> => {
  const levelPrompt = getLevelInstructions(level);
  const formattedDuration = `${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')}`;
  
  const promptText = `
    Role: Absolute Pitch Audio Analyzer (Virtuoso Ear).
    INPUT: Audio File (${formattedDuration}).
    TASK: Extract harmonic chord progression.
    
    CRITICAL INSTRUCTION ON TUNING:
    - **STRICTLY ANCHOR TO STANDARD PITCH A4 = 440Hz.** - **DO NOT SHIFT PITCH.** A common error is detecting the key a semitone or whole tone too high. 
    - Verify the lowest bass frequencies to ground the root. 

    STEPS:
    1. Detect BPM & Key (Verify against 440Hz reference).
    2. Track Root Movement.
    3. Identify Chord Quality.
    
    ${levelPrompt}

    RULES:
    - Analyze from 0:00 to ${formattedDuration}.
    - If modulation occurs, list it in "modulations".
    
    ${COMMON_SCHEMA}
  `;

  try {
    // Obtenemos el modelo
    const model = genAI.getGenerativeModel({ model: MODEL_ID });

    // Preparamos las partes (Audio + Texto)
    const parts = [
      { inlineData: { mimeType: mimeType, data: base64Data } },
      { text: promptText }
    ];

    const response = await generateWithRetry(model, parts, {
      responseMimeType: "application/json",
      temperature: 0.1, // Baja temperatura para análisis musical preciso
    });

    return extractJSON(response.text());

  } catch (error: any) {
    console.error("Analysis Error:", error);
    let msg = error.message || "Unknown error";
    if (msg.includes("404")) msg = "Model unavailable. Please try again later.";
    if (msg.includes("429")) msg = "Server traffic high. Please wait a moment.";
    throw new Error(msg);
  }
};

export const analyzeSongFromUrl = async (url: string, level: AnalysisLevel): Promise<SongAnalysis> => {
  const levelPrompt = getLevelInstructions(level);
  
  const promptText = `
    Role: Music Theorist.
    TASK: Analyze song at URL: "${url}"
    
    CRITICAL: Ensure the key is detected based on standard Concert Pitch (A=440Hz).
    
    1. Identify song/artist.
    2. Get studio harmony.
    3. Output JSON.
    
    ${levelPrompt}

    ${COMMON_SCHEMA}
  `;

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_ID });
    const parts = [{ text: promptText }];

    const response = await generateWithRetry(model, parts, {
        responseMimeType: "application/json",
    });

    return extractJSON(response.text());
  } catch (error: any) {
    throw new Error("Link analysis failed: " + error.message);
  }
};