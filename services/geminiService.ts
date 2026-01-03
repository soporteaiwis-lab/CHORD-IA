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
  OUTPUT FORMAT:
  Return ONLY a valid JSON object. No intro, no outro, no markdown formatting outside the JSON block.
  
  Structure:
  {
    "key": "string (e.g. 'C Minor', 'F# Major')",
    "timeSignature": "string",
    "bpmEstimate": "string",
    "modulations": ["string"],
    "complexityLevel": "string ('Simple', 'Intermediate', 'Advanced', 'Jazz/Complex')",
    "summary": "string",
    "chords": [
      {
        "timestamp": "string (e.g. '0:00')",
        "symbol": "string (e.g. Cm9, G7alt)",
        "quality": "string",
        "extensions": ["string"],
        "bassNote": "string (optional)",
        "confidence": number
      }
    ]
  }

  CRITICAL MUSIC THEORY RULES:
  1. **MAJOR VS MINOR CHECK**: Before naming the key or chord, listen to the 3rd interval. 
     - 3 semitones = Minor (Sad/Dark). 
     - 4 semitones = Major (Happy/Bright).
     - **DO NOT** default to Major if the song feels "Pop" but uses minor intervals.
  2. **FULL DURATION**: Analyze from 0:00 to the very last second.
  3. **SPECIFICITY**: Prefer "Cadd9" over "C". Prefer "G7b9" over "G7".
  4. **Slash Chords**: Always identify the bass note if it differs from the root (e.g., C/E).
`;

export const analyzeAudioContent = async (base64Data: string, mimeType: string): Promise<SongAnalysis> => {
  try {
    // Switching to FLASH model for high stability and availability.
    // It handles audio very well and avoids the "Model Unavailable" errors of the Pro/Exp models.
    const modelId = "gemini-2.0-flash-exp"; 

    const prompt = `
      Role: You are an expert Audio Engineer and Jazz Theorist with Absolute Pitch.
      
      Task: Analyze the harmonic structure of the provided audio file.
      
      Step-by-Step Execution:
      1. **Listen to the Bass**: Identify the root movement.
      2. **Listen to the Quality**: Is the chord Major, Minor, Diminished, or Augmented? (Check the 3rd and 5th).
      3. **Listen for Color**: Are there 7ths, 9ths, 11ths, 13ths, or altered tensions?
      4. **Determine Key**: Identify the tonic center. Be careful with relative minors (e.g., don't confuse Eb Major with C Minor).
      5. **Timeline**: Map chords to timestamps for the **entire duration** of the file.
      
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
        temperature: 0.1, // Low temperature for factual/theoretical precision
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
    const modelId = "gemini-2.0-flash-exp"; 

    const prompt = `
      Role: You are a world-class Music Theorist.
      
      Task: Analyze the harmony of the song found at this URL: "${url}"
      
      Execution:
      1. Use Google Search to identify the exact song version.
      2. Retrieve the accurate chord progression from your knowledge base.
      3. **Verification**: Double-check the Key. Is it truly Major or Minor? (e.g. "Get Lucky" is B Dorian/Minor, not D Major).
      4. Generate the JSON analysis for the full song duration.
      
      ${COMMON_PROMPT_INSTRUCTIONS}
      
      Note: If the URL is a Google Drive link, identify the song from the filename/title.
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts: [{ text: prompt }] },
      config: {
        tools: [{ googleSearch: {} }], 
        responseMimeType: "application/json",
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
    
    if (errorMessage.includes("404") || errorMessage.includes("not found")) {
      throw new Error("Service Busy: The AI model is currently under high load. Please try again in a moment.");
    }
    if (errorMessage.includes("429")) {
      throw new Error("Traffic Limit: Too many requests. Please wait 10 seconds and try again.");
    }
    if (errorMessage.includes("500") || errorMessage.includes("503")) {
      throw new Error("Server Error: Google AI encountered an internal error. Please retry.");
    }
};