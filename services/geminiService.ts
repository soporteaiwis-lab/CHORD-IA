
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
    Role: World-Class Music Theory AI & Audio Engineer.
    Task: Perform a deep structural and harmonic analysis of this audio file (${formattedDuration}).

    CRITICAL REQUIREMENTS:
    1. **SYNC PRECISION**: You MUST define the exact \`seconds\` (float) start time and \`duration\` for EVERY chord. Do not just list them per bar. If a chord changes on beat 3, mark the exact second it happens.
    2. **PITCH STANDARD**: Anchor strictly to A=440Hz. Do not transpose. Verify bass frequencies.
    3. **SECTIONS**: Identify musical structure (Intro, Verse, Pre-Chorus, Chorus, Bridge, Solo, Outro).
    4. **COMPONENTS**: Decompose chords so the frontend can filter complexity (Root, Quality, Extension, Bass).

    OUTPUT JSON SCHEMA:
    {
      "title": "Song Title Estimate",
      "artist": "Artist Estimate",
      "key": "string (e.g. Cm)",
      "bpm": number (exact integer estimate),
      "timeSignature": "string (e.g. 4/4)",
      "complexityLevel": "string",
      "summary": "Brief harmonic analysis summary.",
      "sections": [
        { "name": "Intro", "startTime": 0.0, "endTime": 15.5, "color": "#1e293b" }
      ],
      "chords": [
        {
          "timestamp": "0:00",
          "seconds": 0.0,
          "duration": 4.5,
          "root": "C",
          "quality": "min", 
          "extension": "7", 
          "bass": "G", 
          "symbol": "Cm7/G",
          "confidence": 0.95
        }
      ]
    }
    
    *Notes on "quality"*: Use standard notation: 'maj', 'min', 'dim', 'aug', 'sus4', 'dom'.
    *Notes on "extension"*: 7, 9, 11, 13, maj7, add9. Leave empty string if triad.
    *Notes on "bass"*: Leave empty string if root position.
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
      temperature: 0.1, // Lowest temperature for max precision
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
    
    Output JSON compatible with this schema (Strictly A=440Hz):
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
