import { GoogleGenAI } from "@google/genai";
import { SongAnalysis, AnalysisLevel } from "../types";

// Initialize the API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- ROBUST UTILS ---

const extractJSON = (text: string): any => {
  if (!text) throw new Error("Empty response from AI");
  
  let cleanText = text.trim();
  
  // 1. Remove Markdown Code Blocks
  cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '');
  
  // 2. Find the first '{' and last '}' to isolate JSON
  const firstBrace = cleanText.indexOf('{');
  const lastBrace = cleanText.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleanText = cleanText.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("JSON Parse Failed. Raw text:", text);
    throw new Error("The AI analyzed the song but returned invalid data structure. Please try again.");
  }
};

const getLevelInstructions = (level: AnalysisLevel): string => {
  switch (level) {
    case 'Basic':
      return `
      **MODE: BASIC (BEGINNER)**
      - **Output ONLY Major and Minor Triads**.
      - Simplify complex chords: Gmaj7 -> G, Dm9 -> Dm.
      - NO extensions, NO slash chords.
      `;
    case 'Intermediate':
      return `
      **MODE: INTERMEDIATE**
      - Identify 7th chords (maj7, m7, dom7).
      - Identify distinct Slash Chords.
      - Simplify 9/11/13 extensions to 7ths.
      `;
    case 'Advanced':
      return `
      **MODE: ADVANCED (VIRTUOSO)**
      - **Precise**: 9, 11, 13, #11, b13, alt.
      - **Polychords**: Upper structures.
      - **Inversions**: Exact bass notes.
      `;
    default:
      return "";
  }
};

const COMMON_SCHEMA = `
  STRICT JSON OUTPUT ONLY. NO MARKDOWN.
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

// --- FAILOVER SYSTEM ---

// Priority list of models to try. 
// We start with Flash (fastest/best for audio), then fallback to alternatives.
const AUDIO_MODELS = [
  "gemini-1.5-flash",       // Primary: Fast, large context
  "gemini-1.5-flash-002",   // Secondary: Updated experimental version
  "gemini-1.5-pro"          // Tertiary: Heavy duty, slower but powerful
];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function generateWithFailover(
  contents: any, 
  config: any, 
  attempt = 0
): Promise<any> {
  const modelId = AUDIO_MODELS[attempt];
  
  if (!modelId) {
    throw new Error("All AI models failed to respond. Please check your internet connection or try a smaller file.");
  }

  try {
    console.log(`Attempting analysis with: ${modelId} (Attempt ${attempt + 1}/${AUDIO_MODELS.length})`);
    
    // Explicitly set the model for this request
    const response = await ai.models.generateContent({ 
      model: modelId, 
      contents, 
      config 
    });

    if (!response || !response.text) {
      throw new Error("Empty response");
    }

    return response;

  } catch (error: any) {
    console.warn(`Model ${modelId} failed:`, error.message);
    
    const isRetryable = 
      error.message.includes("429") || 
      error.message.includes("503") || 
      error.message.includes("500") || 
      error.message.includes("busy") ||
      error.message.includes("overloaded") ||
      error.message.includes("not found"); // sometimes implies model unavailable in region

    if (isRetryable && attempt < AUDIO_MODELS.length - 1) {
      console.log(`Switching to backup model...`);
      await delay(1500); // Brief pause before switching
      return generateWithFailover(contents, config, attempt + 1);
    }
    
    // If it's the last model or a fatal error, throw it up
    throw error;
  }
}

// --- PUBLIC METHODS ---

export const analyzeAudioContent = async (base64Data: string, mimeType: string, level: AnalysisLevel, duration: number): Promise<SongAnalysis> => {
  const levelPrompt = getLevelInstructions(level);
  const formattedDuration = `${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')}`;
  
  const prompt = `
    You are an expert Session Musician with Absolute Pitch.
    
    INPUT: Audio File (${formattedDuration}).
    
    TASK: Analyze the harmony beat-by-beat.
    
    STRATEGY:
    1. **Groove**: Find BPM/Time Signature.
    2. **Bass**: Track the Root.
    3. **Harmony**: Determine Quality & Extensions.
    4. **Map**: Intro -> Verse -> Chorus.
    
    ${levelPrompt}

    CRITICAL:
    - Tune to A=440Hz.
    - Analyze FULL DURATION (0:00 to ${formattedDuration}).
    - Do not hallucinate. If silence, skip.

    ${COMMON_SCHEMA}
  `;

  try {
    const contents: any = { 
      parts: [
        { inlineData: { mimeType, data: base64Data } },
        { text: prompt } 
      ] 
    };

    const response = await generateWithFailover(contents, {
      responseMimeType: "application/json",
      temperature: 0.2,
      maxOutputTokens: 8192,
    });

    return extractJSON(response.text);

  } catch (error: any) {
    // Final catch-all for UI
    console.error("Final Analysis Error:", error);
    let msg = error.message || "Unknown error";
    if (msg.includes("429")) msg = "Traffic limit reached. Please wait 1 minute.";
    if (msg.includes("400")) msg = "The audio file might be corrupted or unsupported.";
    throw new Error(msg);
  }
};

export const analyzeSongFromUrl = async (url: string, level: AnalysisLevel): Promise<SongAnalysis> => {
  const levelPrompt = getLevelInstructions(level);
  const modelId = "gemini-1.5-pro"; // Pro is best for text/search reasoning

  const prompt = `
    You are an expert Music Theorist.
    
    TASK: Analyze song at: "${url}"
    
    1. Identify song/artist.
    2. Find accurate studio harmony.
    3. Output JSON.
    
    ${levelPrompt}

    ${COMMON_SCHEMA}
  `;

  try {
    const contents = { parts: [{ text: prompt }] };
    const response = await ai.models.generateContent({
        model: modelId,
        contents,
        config: {
            responseMimeType: "application/json",
            tools: [{ googleSearch: {} }],
            maxOutputTokens: 8192,
        }
    });

    return extractJSON(response.text);
  } catch (error: any) {
    throw new Error("Failed to analyze link: " + error.message);
  }
};