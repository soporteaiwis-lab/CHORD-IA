
import { GoogleGenAI } from "@google/genai";
import { SongAnalysis } from "../types";

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
    console.error("JSON Parse Failed:", text);
    throw new Error("Analysis failed to produce valid JSON data.");
  }
};

// --- RETRY LOGIC ---
const MODEL_ID = "gemini-3-flash-preview"; 
const MAX_RETRIES = 3;
const BASE_DELAY = 2000;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function generateWithRetry(contents: any, config: any, retries = 0): Promise<any> {
  try {
    return await ai.models.generateContent({ model: MODEL_ID, contents, config });
  } catch (error: any) {
    if (retries < MAX_RETRIES && (error.message?.includes("503") || error.message?.includes("429"))) {
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
    Task: Analyze the audio file (${formattedDuration}) and extract the EXACT Harmonic Rhythm.

    CRITICAL INSTRUCTIONS FOR SYNC:
    1. **MICRO-TIMING IS REQUIRED**: Do NOT just list one chord per bar. If a chord changes on the 'and' of beat 4, or if there is a passing chord for 0.5 seconds, YOU MUST LIST IT.
    2. **EXACT TIMESTAMPS**: The \`seconds\` field must be the precise float value (e.g., 12.45) where the audio changes harmony.
    3. **PITCH STANDARD**: Anchor strictly to A=440Hz. Verify bass frequencies to determine inversions.
    4. **SECTIONS**: Identify Intro, Verses, Choruses, Bridges with exact start/end times.

    OUTPUT JSON SCHEMA (Strictly follow this):
    {
      "title": "Song Title",
      "artist": "Artist",
      "key": "string",
      "bpm": number,
      "timeSignature": "string",
      "complexityLevel": "string",
      "summary": "Technical harmonic summary.",
      "sections": [
        { "name": "Intro", "startTime": 0.0, "endTime": 12.5, "color": "#334155" }
      ],
      "chords": [
        {
          "timestamp": "0:00",
          "seconds": 0.0,
          "duration": 2.5,
          "root": "C",
          "quality": "maj", 
          "extension": "9", 
          "bass": "E", 
          "symbol": "Cmaj9/E",
          "confidence": 0.99
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
      temperature: 0.1, // Zero temp for max analytical precision
      maxOutputTokens: 8192,
    });

    return extractJSON(response.text);
  } catch (error: any) {
    console.error("Analysis Error:", error);
    throw new Error(error.message || "Analysis failed.");
  }
};

export const analyzeSongFromUrl = async (url: string): Promise<SongAnalysis> => {
  const prompt = `
    Role: Music Theorist. Analyze URL: "${url}".
    REQUIREMENT: Provide exact second-by-second harmonic changes. Do not simplify to 1 chord per bar if there are more.
    
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
