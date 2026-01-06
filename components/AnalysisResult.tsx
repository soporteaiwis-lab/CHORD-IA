
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SongAnalysis, ChordEvent, AudioMetadata, AnalysisLevel } from '../types';

interface AnalysisResultProps {
  analysis: SongAnalysis | null;
  metadata: AudioMetadata | null;
}

// --- Dynamic Complexity Logic ---
const getDisplayChord = (chord: ChordEvent, level: AnalysisLevel): string => {
  if (level === 'Advanced') return chord.symbol; // Full: "Cm7/G"
  
  // Basic: Root + Quality (simplified)
  let base = chord.root;
  const q = chord.quality.toLowerCase();
  
  if (q === 'min' || q === 'm' || q === 'minor') base += 'm';
  else if (q === 'dim') base += 'dim';
  else if (q === 'aug') base += 'aug';
  // Major triads usually just the root in pop notation, or 'maj' if explicit preference.
  // We'll stick to just Root for Major.

  if (level === 'Basic') return base; 

  // Intermediate: Root + Quality + Extension + Slash
  // E.g. Cm7 (no slash) or C/G (triad slash) or Cm7/G
  let inter = base;
  if (chord.extension) inter += chord.extension; // Add 7, 9 etc
  if (chord.bass && chord.bass !== chord.root) inter += `/${chord.bass}`;
  
  return inter;
};

// --- Player Component ---
const MoisesPlayer: React.FC<{ 
  audioUrl?: string, 
  duration: number, 
  analysis: SongAnalysis 
}> = ({ audioUrl, duration, analysis }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [transpose, setTranspose] = useState(0); // Visual only for now
  
  // View State
  const [complexity, setComplexity] = useState<AnalysisLevel>('Intermediate');
  const [showMetronome, setShowMetronome] = useState(false);

  // Metronome Logic
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef<number>(0);
  const timerIDRef = useRef<number | null>(null);

  // --- AUDIO SYNC LOOP ---
  useEffect(() => {
    let animationFrameId: number;
    
    const tick = () => {
      if (audioRef.current && !audioRef.current.paused) {
        setCurrentTime(audioRef.current.currentTime);
        animationFrameId = requestAnimationFrame(tick);
      }
    };

    if (isPlaying) {
      animationFrameId = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying]);

  // --- METRONOME SCHEDULER (Intelligent) ---
  // Using Lookahead scheduler for solid timing even if main thread is busy
  const scheduleClick = () => {
    if (!audioRef.current || !isPlaying || !showMetronome) return;
    
    // Lazy init audio context
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') audioContextRef.current.resume();

    const ctx = audioContextRef.current;
    const lookahead = 25.0; // ms
    const scheduleAheadTime = 0.1; // sec
    
    // Calculate Beat Duration based on BPM and Playback Rate
    const bpm = analysis.bpm || 120;
    const secondsPerBeat = (60.0 / bpm) / playbackRate;

    // Current Audio Time mapped to AudioContext Time
    // We assume the audio started recently. To be perfectly "intelligent",
    // we should re-align nextNoteTimeRef to the nearest measure start 
    // whenever the chord changes or section changes to prevent drift.
    
    // Simple scheduler for now:
    while (nextNoteTimeRef.current < ctx.currentTime + scheduleAheadTime) {
      // Play Click
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      // High pitch for downbeat (every 4 beats assuming 4/4), Low for others
      // Since we don't have perfect measure map, we just do a click track
      osc.frequency.value = 1000;
      gain.gain.value = 0.2;
      
      osc.start(nextNoteTimeRef.current);
      osc.stop(nextNoteTimeRef.current + 0.05);

      nextNoteTimeRef.current += secondsPerBeat;
    }
    
    timerIDRef.current = window.setTimeout(scheduleClick, lookahead);
  };

  useEffect(() => {
    if (isPlaying && showMetronome) {
        // Reset scheduler anchor when play starts
        if (audioContextRef.current) {
           nextNoteTimeRef.current = audioContextRef.current.currentTime + 0.05;
           scheduleClick();
        }
    } else {
        if (timerIDRef.current) window.clearTimeout(timerIDRef.current);
    }
    return () => { if (timerIDRef.current) window.clearTimeout(timerIDRef.current); };
  }, [isPlaying, showMetronome, playbackRate]);


  // --- HANDLERS ---
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleSpeed = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rate = parseFloat(e.target.value);
    setPlaybackRate(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
  };

  // --- RENDERING HELPERS ---
  
  // Get active items
  const activeSection = analysis.sections?.find(s => currentTime >= s.startTime && currentTime < s.endTime);
  const activeChord = analysis.chords?.find(c => currentTime >= c.seconds && currentTime < (c.seconds + c.duration));

  // Timeline Constants
  const PIXELS_PER_SEC = 100 * playbackRate; // Zoom scales with speed slightly? No, keep constant for muscle memory.
  // Actually, keeping fixed pixels ensures visual consistency.
  const FIXED_PPS = 150; 

  return (
    <div className="w-full max-w-5xl mx-auto bg-slate-900 rounded-3xl border border-slate-700 overflow-hidden shadow-2xl relative">
      <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} />
      
      {/* 1. VISUALIZER TRACKS */}
      <div className="relative bg-slate-950 h-64 overflow-hidden border-b border-slate-800">
         
         {/* Center Playhead */}
         <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-indigo-500 z-50 shadow-[0_0_15px_indigo]"></div>
         <div className="absolute left-1/2 top-4 -translate-x-1/2 bg-indigo-600 text-[10px] font-bold px-2 py-0.5 rounded-full text-white z-50">NOW</div>

         {/* Moving Container */}
         <div 
           className="absolute top-0 bottom-0 left-1/2 will-change-transform"
           style={{ transform: `translateX(${-currentTime * FIXED_PPS}px)` }}
         >
            {/* SECTIONS LAYER */}
            <div className="absolute top-0 h-8 w-[20000px] flex">
               {analysis.sections?.map((section, i) => (
                 <div 
                    key={i}
                    className="h-full flex items-center px-2 text-[10px] font-bold uppercase tracking-wider text-white/80 border-r border-white/10 truncate"
                    style={{ 
                        position: 'absolute',
                        left: `${section.startTime * FIXED_PPS}px`,
                        width: `${(section.endTime - section.startTime) * FIXED_PPS}px`,
                        backgroundColor: section.color || '#334155'
                    }}
                 >
                    {section.name}
                 </div>
               ))}
            </div>

            {/* CHORDS LAYER */}
            <div className="absolute top-12 bottom-0 w-[20000px]">
               {analysis.chords.map((chord, i) => {
                 const isActive = activeChord === chord;
                 return (
                   <div 
                     key={i}
                     className={`absolute top-8 flex items-center justify-center border-l border-white/10 transition-all duration-200 ${isActive ? 'opacity-100 scale-110 z-10' : 'opacity-40 grayscale'}`}
                     style={{
                        left: `${chord.seconds * FIXED_PPS}px`,
                        width: `${chord.duration * FIXED_PPS}px`,
                        height: '120px'
                     }}
                   >
                      <div className={`text-center ${isActive ? 'text-white' : 'text-slate-400'}`}>
                         <div className="text-4xl font-black tracking-tight">{getDisplayChord(chord, complexity)}</div>
                         {isActive && <div className="text-xs font-mono text-indigo-400 mt-2">{chord.timestamp}</div>}
                      </div>
                   </div>
                 );
               })}
            </div>
         </div>
         
         {/* Gradient Fade Edges */}
         <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-slate-900 to-transparent z-40 pointer-events-none"></div>
         <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-slate-900 to-transparent z-40 pointer-events-none"></div>
      </div>

      {/* 2. CONTROL DECK (Moises Style) */}
      <div className="p-6 bg-slate-900">
         
         {/* Timeline Slider */}
         <div className="flex items-center gap-4 mb-6">
            <span className="text-xs font-mono text-slate-400 w-10 text-right">{Math.floor(currentTime/60)}:{Math.floor(currentTime%60).toString().padStart(2,'0')}</span>
            <input 
              type="range" 
              min={0} 
              max={duration} 
              step={0.01} 
              value={currentTime} 
              onChange={handleSeek}
              className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
            />
            <span className="text-xs font-mono text-slate-400 w-10">{Math.floor(duration/60)}:{Math.floor(duration%60).toString().padStart(2,'0')}</span>
         </div>

         {/* Main Controls Grid */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            
            {/* Left: View Options */}
            <div className="flex flex-col gap-3">
               <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Complexity</span>
                  <div className="flex bg-slate-800 rounded-lg p-1">
                     {(['Basic', 'Intermediate', 'Advanced'] as AnalysisLevel[]).map(lvl => (
                        <button
                          key={lvl}
                          onClick={() => setComplexity(lvl)}
                          className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${complexity === lvl ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                           {lvl.slice(0,3)}
                        </button>
                     ))}
                  </div>
               </div>
               
               <div className="flex items-center gap-2">
                   <span className="text-[10px] font-bold text-slate-500 uppercase">Speed: {playbackRate}x</span>
                   <input 
                     type="range" min={0.5} max={1.5} step={0.1} 
                     value={playbackRate} 
                     onChange={handleSpeed}
                     className="w-24 h-1 bg-slate-700 rounded-lg appearance-none accent-indigo-500"
                   />
               </div>
            </div>

            {/* Center: Transport */}
            <div className="flex justify-center items-center gap-6">
               <button onClick={() => { if(audioRef.current) audioRef.current.currentTime -= 5 }} className="text-slate-400 hover:text-white">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" /></svg>
               </button>
               
               <button 
                 onClick={togglePlay}
                 className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-white/20"
               >
                  {isPlaying ? (
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                  ) : (
                    <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  )}
               </button>

               <button onClick={() => { if(audioRef.current) audioRef.current.currentTime += 5 }} className="text-slate-400 hover:text-white">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" /></svg>
               </button>
            </div>

            {/* Right: Tools */}
            <div className="flex flex-col items-end gap-3">
                <button 
                  onClick={() => setShowMetronome(!showMetronome)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${showMetronome ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                >
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                   Smart Click
                </button>
                <div className="flex items-center gap-2">
                   <span className="text-xs text-slate-500 font-bold">Key: {analysis.key}</span>
                   {/* Transpose UI only - Audio pitch shifting requires WebAudio buffer source which complicates streaming big files */}
                </div>
            </div>

         </div>
      </div>
    </div>
  );
};

export const AnalysisResult: React.FC<AnalysisResultProps> = ({ analysis, metadata }) => {
  if (!analysis) return null;

  return (
    <div className="max-w-7xl mx-auto mt-8 px-4 pb-24">
      {/* Title Header */}
      <div className="text-center mb-8">
         <h1 className="text-3xl font-black text-white">{analysis.title || metadata?.fileName}</h1>
         <p className="text-slate-400">{analysis.artist || 'Unknown Artist'} • {analysis.bpm} BPM • {analysis.timeSignature}</p>
      </div>

      {metadata?.audioUrl && (
        <MoisesPlayer 
           audioUrl={metadata.audioUrl} 
           duration={metadata.duration} 
           analysis={analysis} 
        />
      )}
      
      {/* Summary Box */}
      <div className="mt-12 bg-slate-900/50 p-6 rounded-2xl border border-white/5">
         <h3 className="text-lg font-bold text-white mb-2">Harmonic Insights</h3>
         <p className="text-slate-300 leading-relaxed">{analysis.summary}</p>
      </div>
    </div>
  );
};
