
import { GoogleGenAI, Type } from "@google/genai";
import { SongAnalysis } from "../types";

// Initialize the API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- CONFIGURATION ---
// Using the latest recommended model for complex reasoning
const MODEL_ID = "gemini-3-pro-preview"; 

// --- SCHEMA DEFINITION ---
// This enforces the AI to return ONLY valid JSON matching this structure.
const chordSchema = {
  type: Type.OBJECT,
  properties: {
    timestamp: { type: Type.STRING, description: "Display string like 0:00" },
    seconds: { type: Type.NUMBER, description: "Exact start time in seconds (float)" },
    duration: { type: Type.NUMBER, description: "Duration in seconds" },
    root: { type: Type.STRING, description: "Root note (e.g., C, F#)" },
    quality: { type: Type.STRING, description: "Quality (m, maj, dim, aug, dom)" },
    extension: { type: Type.STRING, description: "Extension (7, 9, 11) or empty string" },
    bass: { type: Type.STRING, description: "Bass note if inverted, or empty string" },
    symbol: { type: Type.STRING, description: "Full chord symbol (e.g., Cm7/Eb)" },
    confidence: { type: Type.NUMBER },
  },
  required: ["seconds", "duration", "root", "quality", "symbol"]
};

const sectionSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    startTime: { type: Type.NUMBER },
    endTime: { type: Type.NUMBER },
    color: { type: Type.STRING },
  },
  required: ["name", "startTime", "endTime"]
};

const analysisResponseSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    artist: { type: Type.STRING },
    key: { type: Type.STRING },
    bpm: { type: Type.INTEGER },
    timeSignature: { type: Type.STRING },
    complexityLevel: { type: Type.STRING },
    summary: { type: Type.STRING },
    sections: { type: Type.ARRAY, items: sectionSchema },
    chords: { type: Type.ARRAY, items: chordSchema },
  },
  required: ["title", "key", "bpm", "timeSignature", "sections", "chords", "summary"]
};

// --- UTILS ---

const extractJSON = (text: string): any => {
  if (!text) return null;
  // With responseSchema, the text should be pure JSON, but we keep a safety check
  try {
    return JSON.parse(text);
  } catch (e) {
    // Fallback cleanup if the model somehow ignores schema (unlikely with gemini-3)
    console.warn("Raw JSON parse failed, attempting cleanup", text.substring(0, 50));
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText);
  }
};

// --- RETRY LOGIC ---
const MAX_RETRIES = 3;
const BASE_DELAY = 2000;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function generateWithRetry(contents: any, config: any, retries = 0): Promise<any> {
  try {
    const result = await ai.models.generateContent({ model: MODEL_ID, contents, config });
    if (!result.text) {
      throw new Error("Model returned empty response");
    }
    return result;
  } catch (error: any) {
    console.error(`Attempt ${retries + 1} failed:`, error);
    // Retry on 503 (Server Overload) or 429 (Rate Limit)
    if (retries < MAX_RETRIES) {
      await delay(BASE_DELAY * Math.pow(2, retries));
      return generateWithRetry(contents, config, retries + 1);
    }
    throw error;
  }
}

// --- MAIN ANALYSIS ---

export const analyzeAudioContent = async (base64Data: string, mimeType: string, duration: number): Promise<SongAnalysis> => {
  const formattedDuration = `${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')}`;
  
  const prompt = `
    Role: World-Class Music Theorist.
    Task: Analyze this audio (${formattedDuration}).

    INSTRUCTIONS:
    1. **Precision**: 'seconds' must be exact floats. 'bpm' must be integer.
    2. **Format**: NO "none", "null", or "N/A" strings. Use empty strings "" for missing values.
    3. **Scope**: Analyze the FULL audio.
    
    Output strictly matches the provided JSON schema.
  `;

  try {
    const contents: any = { 
      parts: [
        { inlineData: { mimeType, data: base64Data } },
        { text: prompt } 
      ] 
    };

    // We use responseSchema to guarantee valid JSON and avoid 404s from deprecated models
    const response = await generateWithRetry(contents, {
      responseMimeType: "application/json",
      responseSchema: analysisResponseSchema,
      maxOutputTokens: 8192,
      temperature: 0.1,
    });

    const data = extractJSON(response.text);
    if (!data) throw new Error("Parsed data was null");
    return data;

  } catch (error: any) {
    console.error("Analysis Error:", error);
    throw new Error(error.message || "Analysis failed.");
  }
};

export const analyzeSongFromUrl = async (url: string): Promise<SongAnalysis> => {
  const prompt = `
    Role: Music Theorist. Analyze URL: "${url}".
    REQUIREMENT: Provide exact second-by-second harmonic changes.
    
    Output strictly matches this JSON structure:
    {
      "title": "string", "artist": "string", "key": "string", "bpm": number, "timeSignature": "string",
      "sections": [{ "name": "string", "startTime": number, "endTime": number }],
      "chords": [{ "seconds": number, "duration": number, "root": "string", "quality": "string", "extension": "string", "bass": "string", "symbol": "string", "confidence": number }],
      "summary": "string", "complexityLevel": "string"
    }
  `;

  try {
    const contents = { parts: [{ text: prompt }] };
    // Google Search tool can't always be used with responseSchema in strict mode, 
    // so we rely on prompt engineering for the URL link analysis, but use the new Model ID.
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
