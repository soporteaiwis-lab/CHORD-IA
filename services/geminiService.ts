
import { GoogleGenAI } from "@google/genai";
import { SongAnalysis } from "../types";

// Initialize the API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- CONFIGURATION ---
// Using gemini-2.0-flash-exp: The perfect balance of intelligence, speed, and availability (No 404s).
const MODEL_ID = "gemini-2.0-flash-exp"; 

// --- UTILS ---

// The "Old Faithful" Extractor - Robust against markdown, conversational text, and whitespace
const extractJSON = (text: string): any => {
  if (!text) return null;
  
  let jsonString = text.trim();

  // 1. Clean Markdown code blocks if present
  if (jsonString.includes('```')) {
    jsonString = jsonString.replace(/```json/g, '').replace(/```/g, '');
  }

  // 2. Find the outer braces to ignore any intro/outro text
  const firstBrace = jsonString.indexOf('{');
  const lastBrace = jsonString.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1) {
    jsonString = jsonString.substring(firstBrace, lastBrace + 1);
  }

  // 3. Manual cleanup for common JSON errors before parsing
  // Ensure property names are double-quoted (fixes the specific error from your screenshot)
  jsonString = jsonString.replace(/(\w+):/g, '"$1":'); 
  
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("JSON Parse Failed. Raw text:", text);
    // Last ditch effort: simple cleanup of trailing commas
    try {
        const cleaned = jsonString.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
        return JSON.parse(cleaned);
    } catch (e2) {
        throw new Error("Analysis produced invalid data format.");
    }
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
  
  // We use the specific "Schema definition" inside the prompt instead of the config object.
  // This is often more reliable for preventing "Structure" errors in the API.
  const prompt = `
    Role: Virtuoso Music Theorist.
    Task: Analyze this audio (${formattedDuration}) and return a JSON object.

    CRITICAL RULES:
    1. **Output ONLY valid JSON**. No markdown formatting, no conversation.
    2. **Timing**: 'seconds' must be exact floats (e.g. 12.45).
    3. **Values**: No "none" or "null" strings. Use "" for empty values.
    
    JSON STRUCTURE TO FOLLOW:
    {
      "title": "string",
      "artist": "string",
      "key": "string",
      "bpm": 120,
      "timeSignature": "4/4",
      "complexityLevel": "Advanced",
      "summary": "string",
      "sections": [
        { "name": "Intro", "startTime": 0.0, "endTime": 10.0, "color": "#hex" }
      ],
      "chords": [
        {
          "timestamp": "0:00",
          "seconds": 0.0,
          "duration": 2.5,
          "root": "C",
          "quality": "maj",
          "extension": "7",
          "bass": "",
          "symbol": "Cmaj7",
          "confidence": 1.0
        }
      ]
    }
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
      temperature: 0.2,
      maxOutputTokens: 8192,
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
    Return ONLY valid JSON matching this structure:
    {
      "title": "string", "artist": "string", "key": "string", "bpm": number, "timeSignature": "string",
      "sections": [{ "name": "string", "startTime": number, "endTime": number }],
      "chords": [{ "seconds": number, "duration": number, "root": "string", "quality": "string", "extension": "string", "bass": "string", "symbol": "string", "confidence": number }],
      "summary": "string", "complexityLevel": "string"
    }
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
