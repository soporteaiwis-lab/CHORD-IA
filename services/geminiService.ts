import { GoogleGenAI } from "@google/genai";
import { SongAnalysis, AnalysisLevel } from "../types";

// Initialize the API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Robust JSON extractor
const extractJSON = (text: string): any => {
  if (!text) throw new Error("Empty response from AI");
  try {
    return JSON.parse(text);
  } catch (e) {
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    try {
      return JSON.parse(cleanText);
    } catch (e2) {
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e3) {
           console.error("JSON Parse Error (Regex):", e3);
        }
      }
      throw new Error("Could not parse AI response as JSON.");
    }
  }
};

const getLevelInstructions = (level: AnalysisLevel): string => {
  switch (level) {
    case 'Basic':
      return `
      **MODE: BASIC (BEGINNER)**
      - **Output ONLY Major and Minor Triads**.
      - Simplify complex chords:
        - Gmaj7 -> G
        - Dm9 -> Dm
        - A7sus4 -> A
      - DO NOT show extensions or slash chords.
      `;
    case 'Intermediate':
      return `
      **MODE: INTERMEDIATE**
      - Identify 7th chords (maj7, m7, dom7).
      - Identify Slash Chords (e.g., C/G, D/F#) only if the bass is distinct.
      - Simplify upper extensions (9, 11, 13) into their base 7th chord.
      `;
    case 'Advanced':
      return `
      **MODE: ADVANCED (VIRTUOSO)**
      - **Precise Detection**: 9, 11, 13, #11, b13, alt, dim7, m7b5.
      - **Polychords**: Detect upper structures.
      - **Bass**: Exact inversion tracking.
      `;
    default:
      return "";
  }
};

const COMMON_SCHEMA = `
  STRICT JSON OUTPUT FORMAT:
  {
    "key": "string (e.g. 'Ab Major')",
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

// RETRY LOGIC CONSTANTS
const MAX_RETRIES = 3;
const BASE_DELAY = 2000; // 2 seconds

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function generateWithRetry(
  modelId: string, 
  contents: any, 
  config: any, 
  retries = 0
): Promise<any> {
  try {
    return await ai.models.generateContent({ model: modelId, contents, config });
  } catch (error: any) {
    const msg = error.message || error.toString();
    const isTransient = msg.includes("503") || msg.includes("429") || msg.includes("Service Unavailable") || msg.includes("Busy");
    
    if (isTransient && retries < MAX_RETRIES) {
      const waitTime = BASE_DELAY * Math.pow(2, retries); // Exponential backoff: 2s, 4s, 8s
      console.warn(`Gemini Service Busy. Retrying in ${waitTime}ms... (Attempt ${retries + 1}/${MAX_RETRIES})`);
      await delay(waitTime);
      return generateWithRetry(modelId, contents, config, retries + 1);
    }
    throw error;
  }
}

export const analyzeAudioContent = async (base64Data: string, mimeType: string, level: AnalysisLevel, duration: number): Promise<SongAnalysis> => {
  const levelPrompt = getLevelInstructions(level);
  const formattedDuration = `${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')}`;
  
  // We use gemini-1.5-flash for AUDIO. It is significantly more stable for large audio files than Pro.
  const modelId = "gemini-1.5-flash"; 

  const prompt = `
    You are an expert Session Musician with Absolute Pitch.
    
    INPUT: Audio File (${formattedDuration}).
    
    TASK: Perform a beat-by-beat harmonic analysis.
    
    STRATEGY (Chain of Thought):
    1. **Listen to the GROOVE**: Establish the BPM and Time Signature.
    2. **Listen to the BASS**: Identify the Root movement.
    3. **Listen to the HARMONY**: Identify the Chord Quality (Major/Minor) and Color (Extensions).
    4. **Map the Sections**: Intro -> Verse -> Chorus.
    
    ${levelPrompt}

    CRITICAL RULES:
    - **A=440Hz Standard Tuning**.
    - **Full Duration**: Ensure chords are detected from 0:00 to ${formattedDuration}.
    - **No Hallucinations**: If there is silence, do not output chords.
    - **Accuracy**: Do not just repeat a loop. Listen to variations.

    ${COMMON_SCHEMA}
  `;

  console.log(`Analyzing audio with ${modelId} (Duration: ${formattedDuration})...`);

  try {
    const contents: any = { 
      parts: [
        { inlineData: { mimeType, data: base64Data } },
        { text: prompt } 
      ] 
    };

    const response = await generateWithRetry(modelId, contents, {
      responseMimeType: "application/json",
      temperature: 0.1, // Low temp for precision
      maxOutputTokens: 8192,
    });

    return extractJSON(response.text);

  } catch (error: any) {
    handleGeminiError(error);
    throw error;
  }
};

export const analyzeSongFromUrl = async (url: string, level: AnalysisLevel): Promise<SongAnalysis> => {
  const levelPrompt = getLevelInstructions(level);

  // For Text/Search based analysis, Pro is better.
  const modelId = "gemini-1.5-pro"; 

  const prompt = `
    You are an expert Music Theorist.
    
    TASK: Analyze the song at this URL: "${url}"
    
    1. Identify the song accurately.
    2. Retrieve the official studio harmony.
    3. Convert to JSON format.
    
    ${levelPrompt}

    ${COMMON_SCHEMA}
  `;

  try {
    const contents = { parts: [{ text: prompt }] };
    const response = await generateWithRetry(modelId, contents, {
      responseMimeType: "application/json",
      tools: [{ googleSearch: {} }],
      maxOutputTokens: 8192,
    });

    return extractJSON(response.text);
  } catch (error: any) {
    handleGeminiError(error);
    throw error;
  }
};

const handleGeminiError = (error: any) => {
    console.error("Gemini Analysis Error:", error);
    const errorMessage = error.message || error.toString();
    
    if (errorMessage.includes("404") || errorMessage.includes("not found")) {
      throw new Error("Service Busy: Google AI is currently overloaded. We are retrying...");
    }
    if (errorMessage.includes("429")) {
      throw new Error("Rate Limit: Too many requests. Please wait a moment.");
    }
    if (errorMessage.includes("500") || errorMessage.includes("503")) {
      throw new Error("Server Error: Google AI internal error. Please try again.");
    }
};