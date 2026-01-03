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
      **MODE: BASIC / BEGINNER (STRICT)**
      - **OUTPUT ONLY TRIADS**: Major or Minor chords ONLY.
      - **ABSOLUTELY NO EXTENSIONS**: Do not output 7, 9, 11, 13, sus, dim, aug.
      - **NO SLASH CHORDS**: Output just the root chord (e.g. if C/E, output C).
      - **EXAMPLE**: If the harmony is Gmaj7 -> Em9 -> Cmaj7, you MUST output: G -> Em -> C.
      - **GOAL**: Match the simplicity of basic chord charts (like Moises basic mode).
      `;
    case 'Intermediate':
      return `
      **MODE: INTERMEDIATE**
      - Identify basic extensions: 7ths (maj7, min7, 7) and sus4/sus2.
      - Identify slash chords (inversions) if they are prominent (e.g., D/F#).
      - Ignore upper structures (9, 11, 13) unless essential to the song's identity.
      `;
    case 'Advanced':
      return `
      **MODE: ADVANCED / JAZZ**
      - FULL SPECTRUM ANALYSIS.
      - Detect specific extensions: 9, 11, 13, #11, b13, alt.
      - Exact qualities: Augmented, Diminished, Half-Diminished.
      - Detect Polychords and complex voicings.
      `;
    default:
      return "";
  }
};

const COMMON_SCHEMA = `
  Output MUST be valid JSON matching this structure:
  {
    "key": "string (e.g. 'G Major')",
    "timeSignature": "string",
    "bpmEstimate": "string",
    "modulations": ["string"],
    "complexityLevel": "string",
    "summary": "string",
    "chords": [
      {
        "timestamp": "string (e.g. '0:00', '1:45')",
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
  
  // 1. Try the PRO model first (Best reasoning for theory)
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
        temperature: 0.0, // Zero temperature for maximum determinism and accuracy
        maxOutputTokens: 65536
      }
    });

    return extractJSON(response.text);

  } catch (error: any) {
    console.warn("Gemini Pro failed, falling back to Flash:", error.message);
    
    // 2. Fallback to FLASH model (Best for audio handling if Pro fails)
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
          temperature: 0.0, // Zero temperature
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

export const analyzeAudioContent = async (base64Data: string, mimeType: string, level: AnalysisLevel, duration: number): Promise<SongAnalysis> => {
  const levelPrompt = getLevelInstructions(level);
  const formattedDuration = `${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')}`;
  
  const prompt = `
    You are an expert Audio Engineer and Music Theorist with Absolute Pitch (A=440Hz).
    
    INPUT METADATA:
    - Total Duration: ${formattedDuration} (${Math.round(duration)} seconds).
    
    TASK: 
    Perform a high-precision harmonic analysis of the provided audio file.
    
    ${levelPrompt}

    CRITICAL INSTRUCTIONS FOR ACCURACY:
    1. **TUNING CHECK**: Calibrate your listening to Standard Tuning (A=440Hz). Do not transpose. 
       - *Common Error Warning*: Do not confuse a Perfect 5th (e.g., G Major vs D Major) or Relative Minor (G Major vs E Minor). 
       - Listen to the Bass Guitar carefully to define the root.
    
    2. **FULL COVERAGE (MANDATORY)**:
       - You MUST detect chords for the ENTIRE duration of the file.
       - The last chord event timestamp must be close to ${formattedDuration}.
       - Do not stop analyzing in the middle.
    
    3. **TIMING**:
       - Provide chord changes exactly where they happen.
       - If a chord holds for 4 bars, do not repeat it unnecessarily, but ensure the timeline is clear.

    4. **OUTPUT VALIDATION**:
       - Verify: Does the analysis start with the correct Key Center?
       - Verify: Does the analysis end at the end of the file?

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
    STEP 2: Retrieve the OFFICIAL studio chord progression for this track.
    STEP 3: Generate the JSON analysis.

    ${levelPrompt}

    INSTRUCTIONS:
    - Ensure the chords span the full length of the song.
    - Be precise with Key detection (Major vs Minor).
    
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