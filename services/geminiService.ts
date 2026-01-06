
import { GoogleGenAI } from "@google/genai";
import { SongAnalysis, AnalysisLevel } from "../types";

// Initialize the API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- UTILS ---

const extractJSON = (text: string): any => {
  if (!text) throw new Error("Empty response from AI");
  
  let cleanText = text.trim();
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

const MODEL_ID = "gemini-3-flash-preview"; 
const MAX_RETRIES = 3;
const BASE_DELAY = 2000;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function generateWithRetry(
  contents: any, 
  config: any, 
  retries = 0
): Promise<any> {
  try {
    console.log(`Analyzing with ${MODEL_ID} (Attempt ${retries + 1})`);
    return await ai.models.generateContent({ model: MODEL_ID, contents, config });
  } catch (error: any) {
    const msg = error.message || error.toString();
    const isTransient = msg.includes("503") || msg.includes("429") || msg.includes("Busy") || msg.includes("Overloaded");
    
    if (isTransient && retries < MAX_RETRIES) {
      const waitTime = BASE_DELAY * Math.pow(2, retries);
      console.warn(`Service Busy. Retrying in ${waitTime}ms...`);
      await delay(waitTime);
      return generateWithRetry(contents, config, retries + 1);
    }
    throw error;
  }
}

// --- PUBLIC METHODS ---

export const analyzeAudioContent = async (base64Data: string, mimeType: string, level: AnalysisLevel, duration: number): Promise<SongAnalysis> => {
  const levelPrompt = getLevelInstructions(level);
  const formattedDuration = `${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')}`;
  
  // Reinforced prompt to address pitch shifting issues
  const prompt = `
    Role: Absolute Pitch Audio Analyzer (Virtuoso Ear).
    INPUT: Audio File (${formattedDuration}).
    TASK: Extract harmonic chord progression.
    
    CRITICAL INSTRUCTION ON TUNING:
    - **STRICTLY ANCHOR TO STANDARD PITCH A4 = 440Hz.** 
    - **DO NOT SHIFT PITCH.** A common error is detecting the key a semitone or whole tone too high (e.g., detecting C# when it is C). 
    - Verify the lowest bass frequencies to ground the root. 
    - If the audio is slightly detuned (e.g., old recording), calibrate to the closest standard pitch, but do not transpose the entire progression up.

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
    const contents: any = { 
      parts: [
        { inlineData: { mimeType, data: base64Data } },
        { text: prompt } 
      ] 
    };

    const response = await generateWithRetry(contents, {
      responseMimeType: "application/json",
      temperature: 0.1, // Lower temperature for more deterministic/accurate analysis
      maxOutputTokens: 8192,
    });

    return extractJSON(response.text);

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
  
  const prompt = `
    Role: Music Theorist.
    TASK: Analyze song at URL: "${url}"
    
    CRITICAL: Ensure the key is detected based on standard Concert Pitch (A=440Hz). Do not transpose up/down.
    
    1. Identify song/artist.
    2. Get studio harmony.
    3. Output JSON.
    
    ${levelPrompt}

    ${COMMON_SCHEMA}
  `;

  try {
    const contents = { parts: [{ text: prompt }] };
    const response = await generateWithRetry(contents, {
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }],
        maxOutputTokens: 8192,
    });

    return extractJSON(response.text);
  } catch (error: any) {
    throw new Error("Link analysis failed: " + error.message);
  }
};
