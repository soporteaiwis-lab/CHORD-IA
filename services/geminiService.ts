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
      **MODE: BASIC / BEGINNER**
      - SIMPLIFY ALL CHORDS to simple Triads (Major or Minor).
      - IGNORE extensions (7, 9, 11, 13).
      - Example: If you hear "Gmaj9", output "G". If you hear "Cm7", output "Cm".
      - Focus strictly on the root movement and basic quality.
      `;
    case 'Intermediate':
      return `
      **MODE: INTERMEDIATE**
      - Identify 7th chords (Major 7, Minor 7, Dominant 7).
      - Identify standard Slash chords (inversions).
      - Ignore complex upper extensions (9, 11, 13) unless they define the sound.
      `;
    case 'Advanced':
      return `
      **MODE: ADVANCED / JAZZ**
      - DETAILED ANALYSIS. Detect specific extensions: 9, 11, 13, #11, b13, alt.
      - Exact specific chord qualities (Augmented, Diminished, Half-Diminished).
      - Detect Polychords and complex voicings.
      `;
    default:
      return "";
  }
};

const COMMON_SCHEMA = `
  Output MUST be valid JSON matching this structure:
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
        "bassNote": "string (optional)",
        "confidence": number
      }
    ]
  }
`;

// Helper to handle the API call with fallback logic
async function generateWithFallback(
  prompt: string, 
  base64Data?: string, 
  mimeType?: string,
  tools?: any[]
): Promise<SongAnalysis> {
  
  // 1. Try the PRO model first (Best reasoning)
  try {
    console.log("Attempting analysis with Gemini 2.0 Pro...");
    const modelId = "gemini-2.0-pro-exp-02-05";
    
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
        temperature: 0.1,
        maxOutputTokens: 65536
      }
    });

    return extractJSON(response.text);

  } catch (error: any) {
    console.warn("Gemini Pro failed, falling back to Flash:", error.message);
    
    // 2. Fallback to FLASH model (Best stability)
    try {
      const modelId = "gemini-2.0-flash-exp";
      
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
          temperature: 0.1, 
          maxOutputTokens: 65536
        }
      });
      
      return extractJSON(response.text);
    } catch (finalError: any) {
      handleGeminiError(finalError);
      throw finalError;
    }
  }
}

export const analyzeAudioContent = async (base64Data: string, mimeType: string, level: AnalysisLevel): Promise<SongAnalysis> => {
  const levelPrompt = getLevelInstructions(level);
  
  const prompt = `
    You are an expert Music Theorist.
    
    TASK: Analyze the audio file completely from start to finish.
    
    ${levelPrompt}

    CRITICAL INSTRUCTIONS FOR ACCURACY:
    1. **FIRST 10 SECONDS**: Listen extremely carefully to the first few chords. Identify the TONIC correctly.
       - Do not confuse Relative Minor with Major (e.g. C vs Am).
       - Do not confuse Dominant with Tonic.
    2. **FULL DURATION**: The 'chords' array MUST cover the entire timeline of the song.
    3. **TIMING**: Provide accurate timestamps.
    
    ${COMMON_SCHEMA}
  `;

  return generateWithFallback(prompt, base64Data, mimeType);
};

export const analyzeSongFromUrl = async (url: string, level: AnalysisLevel): Promise<SongAnalysis> => {
  const levelPrompt = getLevelInstructions(level);

  const prompt = `
    You are an expert Music Theorist.
    
    URL: "${url}"
    
    STEP 1: Identify the song (Title, Artist, Version).
    STEP 2: Recall the accurate harmony for this specific track.
    STEP 3: Generate the JSON analysis.

    ${levelPrompt}
    
    ${COMMON_SCHEMA}
  `;

  return generateWithFallback(prompt, undefined, undefined, [{ googleSearch: {} }]);
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