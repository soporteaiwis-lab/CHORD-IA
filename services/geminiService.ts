
import { GoogleGenAI } from "@google/genai";
import { SongAnalysis } from "../types";

// Initialize the API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- UTILS ---

const extractJSON = (text: string): any => {
  if (!text) return null;
  
  // 1. Try to find the JSON block marked with markdown
  let jsonString = text.trim();
  const markdownMatch = jsonString.match(/```json\n([\s\S]*?)\n```/);
  if (markdownMatch) {
    jsonString = markdownMatch[1];
  } else {
    // 2. If no markdown, find the outer braces manually
    const firstBrace = jsonString.indexOf('{');
    const lastBrace = jsonString.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1) {
      jsonString = jsonString.substring(firstBrace, lastBrace + 1);
    }
  }

  // 3. Attempt parse
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("JSON Parse Failed. Raw text segment:", jsonString.substring(0, 100) + "...");
    // Fallback: try to cleanup common trailing comma errors if simple parse fails
    try {
        const cleaned = jsonString.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
        return JSON.parse(cleaned);
    } catch (e2) {
        throw new Error("Analysis produced invalid data format. Please try again.");
    }
  }
};

// --- RETRY LOGIC ---
// USING GEMINI 1.5 PRO - The most stable model for complex, structured JSON analysis currently.
const MODEL_ID = "gemini-1.5-pro"; 
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
    // Retry on 503 (Server Overload) or 429 (Rate Limit) or empty response
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
    Role: World-Class Music Theorist & Audio Engineer.
    Task: Analyze this audio (${formattedDuration}) to create a precise, beat-synchronized harmonic map.

    CRITICAL INSTRUCTIONS:
    1. **TIMING PRECISION**: The 'seconds' field must be an EXACT float (e.g., 12.45). Do not round to integers. Sync must be perfect.
    2. **DATA CLEANLINESS**: 
       - NEVER use strings like "none", "null", "N/A", "unknown". 
       - If a chord has no extension, use empty string "".
       - If a chord is in root position, use empty string "" for bass.
    3. **ANALYSIS SCOPE**: Analyze the ENTIRE file from 0:00 to the end.
    4. **FORMAT**: Return ONLY valid JSON.

    JSON STRUCTURE:
    {
      "title": "Song Title",
      "artist": "Artist Name",
      "key": "Key (e.g. C Minor)",
      "bpm": 120,
      "timeSignature": "4/4",
      "complexityLevel": "Intermediate",
      "summary": "Concise harmonic summary.",
      "sections": [
        { "name": "Intro", "startTime": 0.0, "endTime": 8.5, "color": "#475569" }
      ],
      "chords": [
        {
          "timestamp": "0:00",
          "seconds": 0.0,
          "duration": 2.15,
          "root": "C",
          "quality": "m", 
          "extension": "7", 
          "bass": "Eb", 
          "symbol": "Cm7/Eb",
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
      temperature: 0.1, // Very low temp for strict adherence to facts and timing
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
    REQUIREMENT: Provide exact second-by-second harmonic changes. 
    Strict JSON output only. No "none" strings.
    
    Output Schema:
    {
      "title": "string", "artist": "string", "key": "string", "bpm": number, "timeSignature": "string",
      "sections": [{ "name": "string", "startTime": number, "endTime": number }],
      "chords": [{ "seconds": number, "duration": number, "root": "string", "quality": "string", "extension": "string", "bass": "string", "symbol": "string", "confidence": number }]
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
