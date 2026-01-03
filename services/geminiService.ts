import { GoogleGenAI, Type, Schema } from "@google/genai";
import { SongAnalysis } from "../types";

// Initialize the API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    key: { type: Type.STRING, description: "The tonal center or key of the piece (e.g., 'C Major', 'F# Minor')." },
    timeSignature: { type: Type.STRING, description: "The detected time signature (e.g., '4/4', '6/8')." },
    bpmEstimate: { type: Type.STRING, description: "An estimated tempo range (e.g., '120 bpm')." },
    modulations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of keys modulated to during the excerpt, if any."
    },
    complexityLevel: {
      type: Type.STRING,
      enum: ["Simple", "Intermediate", "Advanced", "Jazz/Complex"],
      description: "Overall harmonic complexity."
    },
    summary: { type: Type.STRING, description: "A brief music theory analysis of the progression and style." },
    chords: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          timestamp: { type: Type.STRING, description: "Approximate time or bar number (e.g., '0:05' or 'Bar 1')." },
          symbol: { type: Type.STRING, description: "The chord symbol (e.g., 'Cmaj9', 'G7b13', 'Ddim7')." },
          quality: { type: Type.STRING, description: "Quality (Major, Minor, Dominant, Diminished, Augmented, Half-Dim)." },
          extensions: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "List of tensions/extensions found (e.g., '9', '#11', 'b13')."
          },
          bassNote: { type: Type.STRING, description: "Bass note if inversion (e.g., 'G' for C/G). Leave empty if root position." },
          confidence: { type: Type.NUMBER, description: "Confidence level 0-100." }
        },
        required: ["timestamp", "symbol", "quality", "confidence"]
      }
    }
  },
  required: ["key", "timeSignature", "chords", "complexityLevel", "summary"]
};

export const analyzeAudioContent = async (base64Data: string, mimeType: string): Promise<SongAnalysis> => {
  try {
    // Using the specialized native audio model for best results
    const modelId = "gemini-2.5-flash-native-audio-preview-09-2025"; 

    const prompt = `
      Act as a world-class music theorist and virtuoso with perfect pitch. 
      Analyze the provided audio file.
      
      Task:
      1. Identify the global Key and Time Signature.
      2. Detect any modulations (key changes).
      3. List the chords chronologically. Be extremely precise. 
      4. Listen for complex harmonies: 7ths, 9ths, 11ths, 13ths, alterations (b5, #5, b9, #9), diminished, augmented, and inversions (Slash chords).
      5. Determine the harmonic complexity level.
      
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
        systemInstruction: "You are CHORD-IA, an advanced AI music theory engine. Your goal is absolute harmonic accuracy.",
        temperature: 0.2 // Low temperature for more deterministic/accurate analysis
      }
    });

    if (!response.text) {
      throw new Error("No analysis generated from the model.");
    }

    const data = JSON.parse(response.text) as SongAnalysis;
    return data;

  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    // Extract meaningful error message
    const errorMessage = error.message || error.toString();
    if (errorMessage.includes("400")) {
      throw new Error("Bad Request: The audio file might be corrupted or the format is unsupported.");
    }
    if (errorMessage.includes("413")) {
      throw new Error("File Too Large: The audio file exceeds the size limit for processing.");
    }
    if (errorMessage.includes("404")) {
      throw new Error("Model Not Found: The AI service is temporarily unavailable.");
    }
    throw new Error(`Analysis failed: ${errorMessage}`);
  }
};