import { GoogleGenAI } from "@google/genai";
import { SongAnalysis } from "../types";

// Initialize the API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- UTILS ---

const extractJSON = (text: string): any => {
  if (!text) return null; // Handle empty text gracefully
  let cleanText = text.trim();
  // Aggressive cleanup to ensure valid JSON
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
    throw new Error("Analysis produced invalid data format.");
  }
};

// --- RETRY LOGIC ---
// Updated to gemini-3-pro-preview for complex music theory tasks
const MODEL_ID = "gemini-3-pro-preview"; 
const MAX_RETRIES = 3;
const BASE_DELAY = 2000;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function generateWithRetry(contents: any, config: any, retries = 0): Promise<any> {
  try {
    const result = await ai.models.generateContent({ model: MODEL_ID, contents, config });
    // Validation: Ensure we actually got text back
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
  
  const prompt = `
    Role: Virtuoso Music Theorist & Audio Engineer.
    Task: Analyze this audio file (${formattedDuration}) to create a perfect beat-synchronized harmonic map.

    CRITICAL INSTRUCTIONS:
    1. **TIMING IS EVERYTHING**: The \`seconds\` field must be EXACT (float). Do not round to the nearest bar. If a chord changes at 12.45s, write 12.45.
    2. **NO 'NONE' VALUES**: Never use "none", "null", or "N/A". If a field (like extension or bass) is not present, use an empty string "".
    3. **COMPLETE ANALYSIS**: Analyze from 0:00 to the very end. Do not stop early.
    4. **ACCURACY**: Verify against the audio waveform. Catch syncopations and anticipations.

    OUTPUT JSON SCHEMA (Strict adherence required):
    {
      "title": "Song Title",
      "artist": "Artist",
      "key": "Key (e.g. Eb Major)",
      "bpm": number (integer),
      "timeSignature": "4/4",
      "complexityLevel": "Advanced",
      "summary": "Technical harmonic summary describing modulations and techniques used.",
      "sections": [
        { "name": "Intro", "startTime": 0.0, "endTime": 12.0, "color": "#475569" }
      ],
      "chords": [
        {
          "timestamp": "0:00",
          "seconds": 0.0,
          "duration": 2.45,
          "root": "E",
          "quality": "maj", 
          "extension": "", 
          "bass": "G#", 
          "symbol": "E/G#",
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
      temperature: 0.2, // Low temperature for factual precision
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
    REQUIREMENT: Provide exact second-by-second harmonic changes. Use standard chord notation.
    NO "none" strings. Use empty strings "" for missing values.
    
    Output JSON compatible with this schema:
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