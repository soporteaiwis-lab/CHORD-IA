export enum AnalysisStatus {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  PROCESSING_AUDIO = 'PROCESSING_AUDIO',
  ANALYZING_AI = 'ANALYZING_AI',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR',
}

export type AnalysisLevel = 'Basic' | 'Intermediate' | 'Advanced';

export interface ChordEvent {
  timestamp: string;
  symbol: string;
  quality: string; // e.g., Major, Minor, Diminished, Augmented
  extensions?: string[]; // e.g., 7, 9, 11, 13, #5, b9
  bassNote?: string; // Inversions
  confidence: number;
}

export interface SongAnalysis {
  key: string;
  timeSignature: string;
  bpmEstimate?: string;
  modulations: string[];
  complexityLevel: 'Simple' | 'Intermediate' | 'Advanced' | 'Jazz/Complex';
  chords: ChordEvent[];
  summary: string;
}

export interface AudioMetadata {
  fileName: string;
  duration: number; // in seconds
  audioUrl?: string; // URL for the audio blob/file for playback
}

export interface AudioState {
  blob: Blob | null;
  url: string | null;
  base64: string | null;
  mimeType: string;
}