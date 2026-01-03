import { GoogleGenAI, Type } from "@google/genai";
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

// Define strict schema to ensure valid JSON output from Gemini
const songAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    key: { type: Type.STRING, description: "The key of the song (e.g. 'Eb Minor')" },
    timeSignature: { type: Type.STRING, description: "Time signature (e.g. '4/4')" },
    bpmEstimate: { type: Type.STRING, description: "Estimated BPM" },
    modulations: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "List of key modulations" 
    },
    complexityLevel: { 
      type: Type.STRING, 
      description: "Complexity level: 'Simple', 'Intermediate', 'Advanced', or 'Jazz/Complex'" 
    },
    summary: { type: Type.STRING, description: "Harmonic analysis summary" },
    chords: {
      type: Type.ARRAY,
      description: "List of chord events covering the entire duration",
      items: {
        type: Type.OBJECT,
        properties: {
          timestamp: { type: Type.STRING, description: "Timestamp (e.g. '0:05')" },
          symbol: { type: Type.STRING, description: "Full chord symbol (e.g. Cmaj13)" },
          quality: { type: Type.STRING, description: "Chord quality (Major, Minor, etc)" },
          extensions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Extensions (9, 11, 13, etc)" },
          bassNote: { type: Type.STRING, description: "Bass note for inversions (optional)", nullable: true },
          confidence: { type: Type.NUMBER, description: "Confidence score 0-100" }
        },
        required: ["timestamp", "symbol", "quality", "confidence"]
      }
    }
  },
  required: ["key", "timeSignature", "chords", "complexityLevel", "summary"]
};

export const analyzeAudioContent = async (base64Data: string, mimeType: string): Promise<SongAnalysis> => {
  try {
    const modelId = "gemini-2.0-flash-exp"; 

    const prompt = `
      You are a virtuoso Jazz Professor and Music Theorist.
      
      TASK: ANALYZE THE **ENTIRE** AUDIO FILE FROM BEGINNING TO THE VERY END.
      
      CRITICAL INSTRUCTIONS:
      1. **FULL DURATION**: The chords array MUST cover 100% of the song length. Do not stop early. If the song is 5 minutes long, the last timestamp must be around 5:00.
      2. **PRECISION**: Detect complex chords (9, 11, 13, alt), inversions, and modulations.
      3. **FORMAT**: Output strictly adhering to the JSON schema provided.
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
        responseSchema: songAnalysisSchema,
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
    const modelId = "gemini-2.0-flash-exp"; 

    const prompt = `
      You are a world-class Music Theorist.
      
      I have a URL: "${url}"
      
      STEP 1: Use Google Search to find the exact Title, Artist, and Version (Live/Studio).
      STEP 2: Once identified, retrieve your internal theoretical knowledge about this specific recording.
      STEP 3: Generate a harmonic analysis for the **FULL DURATION** of the song.
      
      INSTRUCTIONS:
      - Cover the entire song duration from start to finish.
      - If it is a Google Drive link, try to identify the song from the filename in the title/metadata if possible.
      - Return ONLY the JSON object matching the schema.
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts: [{ text: prompt }] },
      config: {
        // Note: responseSchema is sometimes unstable with tools in experimental models, 
        // but we use it here to force structure. If it fails, the extractJSON helper acts as backup.
        tools: [{ googleSearch: {} }], 
        responseMimeType: "application/json",
        responseSchema: songAnalysisSchema, 
        temperature: 0.1,
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