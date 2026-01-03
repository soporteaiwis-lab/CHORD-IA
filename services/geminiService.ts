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

// Helper to clean Markdown code blocks from JSON response
const cleanJson = (text: string) => {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

export const analyzeAudioContent = async (base64Data: string, mimeType: string): Promise<SongAnalysis> => {
  try {
    // Using gemini-2.0-flash-exp which is highly capable of multimodal analysis and currently available in AI Studio
    const modelId = "gemini-2.0-flash-exp"; 

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
        temperature: 0.1 // Lower temperature for more consistent, analytical results
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