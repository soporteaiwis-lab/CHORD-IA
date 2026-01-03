import { GoogleGenAI, Type, Schema } from "@google/genai";
import { SongAnalysis } from "../types";

// Initialize the API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    key: { type: Type.STRING, description: "The specific tonal center (e.g., 'Eb Dorian', 'C# Major', 'G Harmonic Minor')." },
    timeSignature: { type: Type.STRING, description: "The detected time signature (e.g., '4/4', '12/8', '5/4')." },
    bpmEstimate: { type: Type.STRING, description: "Accurate tempo estimate." },
    modulations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of all key changes found."
    },
    complexityLevel: {
      type: Type.STRING,
      enum: ["Simple", "Intermediate", "Advanced", "Jazz/Complex"],
      description: "Harmonic complexity rating."
    },
    summary: { type: Type.STRING, description: "Detailed theoretical analysis of harmonic movement, voice leading, and substitutions used." },
    chords: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          timestamp: { type: Type.STRING, description: "Exact timestamp (e.g., '0:05')." },
          symbol: { type: Type.STRING, description: "THE FULL, COMPLEX CHORD SYMBOL (e.g., 'F#maj13(#11)', 'Eb7(alt)', 'C/Bb'). Do not simplify." },
          quality: { type: Type.STRING, description: "Detailed quality (e.g. Dominant 7th alt, Minor 11, Major 9)." },
          extensions: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "List of all intervals present (9, 11, 13, b9, #9, #11, b13, etc)."
          },
          bassNote: { type: Type.STRING, description: "Specific bass note for inversions or slash chords." },
          confidence: { type: Type.NUMBER, description: "Confidence 0-100." }
        },
        required: ["timestamp", "symbol", "quality", "confidence"]
      }
    }
  },
  required: ["key", "timeSignature", "chords", "complexityLevel", "summary"]
};

// Helper to clean Markdown code blocks from JSON response
const cleanJson = (text: string) => {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

export const analyzeAudioContent = async (base64Data: string, mimeType: string): Promise<SongAnalysis> => {
  try {
    // We stick to gemini-2.0-flash-exp for high reliability and multimodal capabilities
    const modelId = "gemini-2.0-flash-exp"; 

    const prompt = `
      You are an expert Professor of Jazz Harmony and Music Theory with absolute pitch.
      
      YOUR TASK: Perform a highly advanced harmonic analysis of the provided audio.
      
      STRICT RULES FOR CHORD DETECTION:
      1. **DO NOT SIMPLIFY CHORDS.** This is for advanced musicians.
      2. If you hear a C Major chord with a 7th, 9th, and sharp 11th, output "Cmaj13(#11)", NOT just "C" or "Cmaj7".
      3. **DETECT TENSIONS:** Listen specifically for 9ths, 11ths, 13ths, and alterations (b9, #9, #11/b5, b13/#5).
      4. **INVERSIONS:** If the bass is playing E on a C chord, output "C/E".
      5. **SPECIFIC QUALITIES:** Distinguish between 'dim7', 'm7b5' (half-dim), 'aug7', 'sus4', 'sus2'.
      6. **FUNCTIONAL HARMONY:** In the summary, analyze the progression using Roman Numerals (e.g., "ii-V-I in Ab", "Tritone substitution").
      
      Provide the most granular, precise, and complex analysis possible.
      
      Return the data strictly in the requested JSON format.
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
        responseSchema: analysisSchema,
        systemInstruction: "You are CHORD-IA. You are a virtuoso music analyst. You never output simple chords if complex extensions exist. You always provide the full extended jazz symbol.",
        temperature: 0.1 // Keep temperature low to force adherence to the audio facts
      }
    });

    const rawText = response.text;

    if (!rawText) {
      throw new Error("No analysis generated from the model.");
    }

    const cleanedText = cleanJson(rawText);
    const data = JSON.parse(cleanedText) as SongAnalysis;
    return data;

  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    
    // Improved error mapping
    const errorMessage = error.message || error.toString();
    
    if (errorMessage.includes("404")) {
      throw new Error("Model Not Found: Please check if 'gemini-2.0-flash-exp' is available in your region/project.");
    }
    if (errorMessage.includes("429")) {
      throw new Error("Quota Exceeded: The API rate limit has been reached. Please wait a moment.");
    }
    if (errorMessage.includes("500") || errorMessage.includes("503")) {
      throw new Error("Service Error: Google AI is experiencing temporary issues. Try again.");
    }

    throw new Error(`Analysis failed: ${errorMessage}`);
  }
};