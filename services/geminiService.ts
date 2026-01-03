import { GoogleGenAI } from "@google/genai";
import { SongAnalysis } from "../types";

// Initialize the API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Robust JSON extractor that finds the JSON object within any text
const extractJSON = (text: string): any => {
  try {
    // 1. Try parsing directly
    return JSON.parse(text);
  } catch (e) {
    // 2. Try cleaning markdown code blocks
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    try {
      return JSON.parse(cleanText);
    } catch (e2) {
      // 3. Regex search for the first '{' and last '}'
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

export const analyzeAudioContent = async (base64Data: string, mimeType: string): Promise<SongAnalysis> => {
  try {
    // Using gemini-2.0-flash-exp which is currently the SOTA for audio analysis in the API
    const modelId = "gemini-2.0-flash-exp"; 

    const prompt = `
      You are a virtuoso Jazz Professor and Music Theorist.
      
      TASK: ANALYZE THE **ENTIRE** AUDIO FILE FROM BEGINNING TO THE VERY END.
      DO NOT STOP at 2 or 3 minutes. Analyze every single measure until the audio finishes.
      
      OUTPUT REQUIREMENTS:
      Return ONLY a valid JSON object. Do not include any conversational text outside the JSON.
      
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

      CRITICAL ANALYSIS RULES:
      1. **FULL DURATION**: The chords array must cover the entire song length. If the song is 6 minutes, I expect chords at the 5:50 mark.
      2. **NO SIMPLIFICATION**: If it is a Cmaj13(#11), output "Cmaj13(#11)", NOT "Cmaj7".
      3. **EXTENSIONS**: Listen for 9, 11, 13, b9, #9, #11, b13, alt.
      4. **INVERSIONS**: Slash chords are mandatory (e.g. F/A).
      5. **DENSITY**: Provide a chord event for every significant harmonic change.
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
        temperature: 0.2,
        maxOutputTokens: 8192 // CRITICAL: Increased limit to ensure full song analysis fits in response
      }
    });

    const rawText = response.text;

    if (!rawText) {
      throw new Error("The AI returned an empty response. Please try again with a clearer audio file.");
    }

    const data = extractJSON(rawText) as SongAnalysis;
    
    // Basic validation of the returned data
    if (!data.chords || !Array.isArray(data.chords)) {
      throw new Error("AI response missing chord data.");
    }

    return data;

  } catch (error: any) {
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

    throw new Error(`Analysis failed: ${errorMessage}`);
  }
};