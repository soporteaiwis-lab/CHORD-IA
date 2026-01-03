import { GoogleGenAI } from "@google/genai";
import { SongAnalysis } from "../types";

// Initialize the API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Robust JSON extractor that handles markdown code blocks and partial text
const extractJSON = (text: string): any => {
  if (!text) throw new Error("Empty response from AI");
  
  try {
    // 1. Try parsing directly
    return JSON.parse(text);
  } catch (e) {
    // 2. Try cleaning markdown code blocks
    let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
      return JSON.parse(cleanText);
    } catch (e2) {
      // 3. Regex search for the first '{' and last '}' to capture the main object
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e3) {
           console.error("JSON Parse Error (Regex):", e3);
        }
      }
      console.error("Failed text:", text);
      throw new Error("Could not parse AI response as JSON. The model generated invalid output.");
    }
  }
};

const COMMON_PROMPT_INSTRUCTIONS = `
  OUTPUT REQUIREMENTS:
  Return ONLY a valid JSON object. Do not include any conversational text, intro, or outro.
  
  The JSON must match this structure exactly:
  {
    "key": "string (e.g. 'Eb Minor', 'C# Dorian')",
    "timeSignature": "string (e.g. '4/4')",
    "bpmEstimate": "string",
    "modulations": ["string (key names)"],
    "complexityLevel": "string ('Simple', 'Intermediate', 'Advanced', or 'Jazz/Complex')",
    "summary": "string (harmonic analysis summary)",
    "chords": [
      {
        "timestamp": "string (e.g. '0:05', '5:45')",
        "symbol": "string (FULL COMPLEX SYMBOL e.g. Cmaj13(#11))",
        "quality": "string",
        "extensions": ["string"],
        "bassNote": "string (or null)",
        "confidence": number (0-100)
      }
    ]
  }

  CRITICAL HARMONIC RULES:
  1. **TONALITY ACCURACY**: Listen carefully to the bass and the third. Distinguish clearly between Major (Happy/Bright) and Minor (Sad/Dark). DO NOT CONFUSE RELATIVE MAJORS/MINORS (e.g., C Minor vs Eb Major).
  2. **FULL DURATION**: The chords array must cover the entire song length (100%).
  3. **NO SIMPLIFICATION**: If it is a Cmaj13(#11), output "Cmaj13(#11)", NOT "Cmaj7". Detect all tensions (b9, #9, #11, b13, alt).
  4. **EXTENSIONS**: Listen for 9, 11, 13, b9, #9, #11, b13, alt.
  5. **INVERSIONS**: Slash chords are mandatory (e.g. F/A).
`;

export const analyzeAudioContent = async (base64Data: string, mimeType: string): Promise<SongAnalysis> => {
  try {
    // Using the PRO model for maximum reasoning capability on music theory
    const modelId = "gemini-2.0-pro-exp-02-05"; 

    const prompt = `
      You are a world-renowned Jazz Professor with Perfect Pitch.
      
      TASK: Perform a deep harmonic analysis of the attached audio file.
      
      INSTRUCTIONS:
      1. **Listen to the entire file** from start to finish.
      2. **Determine the Tonal Center**: Is it Minor or Major? Listen to the cadence.
      3. **Identify Modulations**: Note every key change.
      4. **Detect Complex Harmony**: Look for secondary dominants, tritone substitutions, and modal interchange.
      5. **Output**: Generate the JSON structure defined below.
      
      ${COMMON_PROMPT_INSTRUCTIONS}
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json", 
        // We do NOT use responseSchema here intentionally. 
        // Strict schemas can degrade the quality of complex reasoning in Pro models.
        // We rely on the prompt and the model's intelligence to produce valid JSON.
        temperature: 0.2,
        maxOutputTokens: 65536 
      }
    });

    const rawText = response.text;
    return extractJSON(rawText) as SongAnalysis;

  } catch (error: any) {
    handleGeminiError(error);
    throw error;
  }
};

export const analyzeSongFromUrl = async (url: string): Promise<SongAnalysis> => {
  try {
    const modelId = "gemini-2.0-pro-exp-02-05"; 

    const prompt = `
      You are a world-class Music Theorist.
      
      I have a URL: "${url}"
      
      STEP 1: Use Google Search to find the exact Title, Artist, and Version (Live/Studio).
      STEP 2: Once identified, retrieve your internal theoretical knowledge about this specific recording.
      STEP 3: Generate a harmonic analysis for the **FULL DURATION** of the song.
      
      ${COMMON_PROMPT_INSTRUCTIONS}
      
      If the link is a Google Drive link, use the filename to identify the song.
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts: [{ text: prompt }] },
      config: {
        tools: [{ googleSearch: {} }], 
        // responseMimeType: "application/json", // Sometimes conflicts with tools in Pro, rely on prompt
        temperature: 0.1,
        maxOutputTokens: 65536 
      }
    });

    const rawText = response.text;
    if (!rawText) throw new Error("The AI could not analyze this link.");
    
    return extractJSON(rawText) as SongAnalysis;

  } catch (error: any) {
    handleGeminiError(error);
    throw error;
  }
};

const handleGeminiError = (error: any) => {
    console.error("Gemini Analysis Error:", error);
    const errorMessage = error.message || error.toString();
    
    if (errorMessage.includes("404")) {
      throw new Error("Model Unavailable: The selected AI model is currently busy or not found.");
    }
    if (errorMessage.includes("429")) {
      throw new Error("Traffic Limit: Too many requests. Please wait 10 seconds and try again.");
    }
    if (errorMessage.includes("500") || errorMessage.includes("503")) {
      throw new Error("Server Error: Google AI encountered an internal error. Please retry.");
    }
};