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
      **STRICT CONSTRAINT: BASIC MODE**
      1. Output **ONLY TRIADS** (Major/Minor).
      2. **Forbidden**: 7ths, 9ths, sus, dim, aug, slash chords.
      3. **Simplification**: If you hear 'Gmaj7', output 'G'. If you hear 'Cm9', output 'Cm'.
      4. **Goal**: Create a chord sheet for a beginner campfire guitarist.
      `;
    case 'Intermediate':
      return `
      **CONSTRAINT: INTERMEDIATE MODE**
      1. Identify **7th chords** (maj7, min7, 7).
      2. Identify **Slash chords** (inversions) e.g., C/G.
      3. Ignore upper extensions (9, 11, 13) unless they are the main melody note.
      `;
    case 'Advanced':
      return `
      **CONSTRAINT: ADVANCED JAZZ MODE**
      1. **Micro-Analysis**: Detect every extension (9, 11, 13, #11, b13, alt).
      2. **Exact Quality**: Distinguish between dim7, m7b5, aug7.
      3. **Polychords**: Identify complex upper structures.
      `;
    default:
      return "";
  }
};

const COMMON_SCHEMA = `
  Return raw JSON only. No markdown formatting.
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

// Helper to handle the API call
async function generateAnalysis(
  prompt: string, 
  base64Data?: string, 
  mimeType?: string,
  tools?: any[]
): Promise<SongAnalysis> {
  
  // We use gemini-1.5-pro-latest because it has the best long-context audio handling
  // and is less prone to "hallucinating" generic chords than the experimental 2.0 models on large files.
  const modelId = "gemini-1.5-pro-latest";
  
  console.log(`Analyzing with ${modelId}...`);

  try {
    const contents: any = { parts: [{ text: prompt }] };
    if (base64Data && mimeType) {
      contents.parts.unshift({ inlineData: { mimeType, data: base64Data } });
    }

    const response = await ai.models.generateContent({
      model: modelId,
      contents,
      config: {
        responseMimeType: "application/json",
        tools: tools,
        temperature: 0.2, // Slight temp needed for audio interpretation
        maxOutputTokens: 8192, // High token limit for long chord lists
      }
    });

    return extractJSON(response.text);

  } catch (error: any) {
    handleGeminiError(error);
    throw error;
  }
}

export const analyzeAudioContent = async (base64Data: string, mimeType: string, level: AnalysisLevel, duration: number): Promise<SongAnalysis> => {
  const levelPrompt = getLevelInstructions(level);
  const formattedDuration = `${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')}`;
  
  const prompt = `
    Role: You are a dedicated Audio Signal Processing AI. 
    
    INPUT DATA:
    - Audio File Length: ${formattedDuration}
    
    TASK:
    Extract the harmonic chord progression from the provided audio stream.
    
    CRITICAL INSTRUCTIONS (DO NOT HALLUCINATE):
    1. **IGNORE INTERNAL KNOWLEDGE**: Do not attempt to guess the song name or use existing database knowledge. Analyze *only* the sound waves provided in this request.
    2. **LISTEN TO THE BASS**: The bass frequency (40Hz-200Hz) determines the root note.
    3. **LISTEN TO THE MIDS**: The 3rd and 7th intervals (200Hz-1kHz) determine the quality (Major/Minor).
    4. **FULL DURATION**: You MUST provide chord timestamps from 0:00 up to ${formattedDuration}. Do not stop early.
    
    ${levelPrompt}

    OUTPUT FORMAT:
    ${COMMON_SCHEMA}
  `;

  return generateAnalysis(prompt, base64Data, mimeType);
};

export const analyzeSongFromUrl = async (url: string, level: AnalysisLevel): Promise<SongAnalysis> => {
  const levelPrompt = getLevelInstructions(level);

  const prompt = `
    Role: Music Theorist.
    
    TASK: Analyze the chord progression of the song at this URL: "${url}"
    
    1. Identify the exact version (Studio, Live, or Cover).
    2. Retrieve the *accurate* sheet music data.
    3. Convert it to the requested format.
    
    ${levelPrompt}

    ${COMMON_SCHEMA}
  `;

  return generateAnalysis(prompt, undefined, undefined, [{ googleSearch: {} }]);
};

const handleGeminiError = (error: any) => {
    console.error("Gemini Analysis Error:", error);
    const errorMessage = error.message || error.toString();
    
    if (errorMessage.includes("404") || errorMessage.includes("not found")) {
      throw new Error("Service Busy: The AI models are currently under high load. Please try again.");
    }
    if (errorMessage.includes("429")) {
      throw new Error("Traffic Limit: Too many requests. Please wait 10 seconds and try again.");
    }
    if (errorMessage.includes("500") || errorMessage.includes("503")) {
      throw new Error("Server Error: Google AI encountered an internal error. Please retry.");
    }
};