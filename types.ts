
export enum AnalysisStatus {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  PROCESSING_AUDIO = 'PROCESSING_AUDIO',
  ANALYZING_AI = 'ANALYZING_AI',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR',
}

export type AnalysisLevel = 'Basic' | 'Intermediate' | 'Advanced'; // Now used for UI View only
export type UserTier = 'Basic' | 'Pro' | 'Premier';

export interface SectionEvent {
  name: string; // "Intro", "Verse 1", "Chorus"
  startTime: number; // Seconds
  endTime: number; // Seconds
  color?: string; // Hex code suggestion
}

export interface ChordEvent {
  timestamp: string; // Display string "0:00"
  seconds: number;   // Exact start time in seconds
  duration: number;  // Duration in seconds
  
  // Decomposed parts for dynamic filtering
  root: string;       // "C"
  quality: string;    // "m", "maj", "dim"
  extension: string;  // "7", "9", "11" (empty if none)
  bass: string;       // "G" (empty if root position)
  
  symbol: string;     // Full string "Cm9/G" (Advanced view)
  confidence: number;
}

export interface SongAnalysis {
  title: string;
  artist: string;
  key: string;
  bpm: number;
  timeSignature: string;
  complexityLevel: string;
  
  sections: SectionEvent[];
  chords: ChordEvent[];
  
  summary: string;
}

export interface AudioMetadata {
  fileName: string;
  duration: number;
  audioUrl?: string;
}
