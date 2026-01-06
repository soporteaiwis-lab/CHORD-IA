
import { GoogleGenAI } from "@google/genai";
import { SongAnalysis } from "../types";

// Initialize the API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- UTILS ---

const extractJSON = (text: string): any => {
  if (!text) throw new Error("Empty response from AI");
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
    console.error("JSON Parse Failed:", text);
    throw new Error("Analysis failed to produce valid JSON data.");
  }
};

// --- RETRY LOGIC ---
// CHANGED: Using PRO model for complex reasoning and better timing accuracy
const MODEL_ID = "gemini-3-pro-preview"; 
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
    Role: World-Class Audio Engineer & Music Theorist.
    Task: Perform a forensic harmonic analysis of this audio (${formattedDuration}).

    CRITICAL: WE NEED ABSOLUTE TIMING PRECISION.
    1. **Sync**: Do not approximate to the measure. If a chord anticipates the beat by 0.1s, mark it exactly.
    2. **Drift Check**: Ensure the timestamps do not drift. The final chord must match the audio end.
    3. **Cleanup**: NEVER return the string "none", "null", "undefined" for any field. If a field is empty, return an empty string "".

    INSTRUCTIONS FOR CHORD FIELDS:
    - **root**: C, C#, Db, etc.
    - **quality**: 'm' (minor), 'maj' (major), 'dim' (diminished), 'aug' (augmented), 'sus4', 'sus2', 'dom' (dominant). NO "major" or "minor" long form.
    - **extension**: '7', '9', '11', '13', 'maj7', 'm7'. Leave EMPTY "" if it's a triad.
    - **bass**: The bass note if inverted. Leave EMPTY "" if root position.
    - **symbol**: The pro-level symbol (e.g. "Bbmaj9/D").

    OUTPUT JSON SCHEMA:
    {
      "title": "Song Title",
      "artist": "Artist",
      "key": "Key (e.g. C Minor)",
      "bpm": number (exact integer, e.g. 124),
      "timeSignature": "4/4",
      "complexityLevel": "Intermediate",
      "summary": "Brief harmonic summary.",
      "sections": [
        { "name": "Intro", "startTime": 0.0, "endTime": 10.5, "color": "#475569" }
      ],
      "chords": [
        {
          "timestamp": "0:00",
          "seconds": 0.0,
          "duration": 2.5,
          "root": "C",
          "quality": "m", 
          "extension": "7", 
          "bass": "Eb", 
          "symbol": "Cm7/Eb",
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
      // Thinking Config allows the model to "listen" closer before generating (Pro model feature)
      // We set a budget to allow it to process the timeline logic
      thinkingConfig: { thinkingBudget: 2048 }, 
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
    REQUIREMENT: Provide exact second-by-second harmonic changes. Use standard chord notation.
    NO "none" strings in output. Use empty strings for missing values.
    
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
