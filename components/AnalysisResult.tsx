
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SongAnalysis, ChordEvent, AudioMetadata, AnalysisLevel } from '../types';

interface AnalysisResultProps {
  analysis: SongAnalysis | null;
  metadata: AudioMetadata | null;
}

// --- ULTIMATE STRING CLEANER ---
const cleanStr = (str: any) => {
  if (!str) return '';
  const s = String(str).trim().toLowerCase();
  if (['none', 'null', 'undefined', 'n/a', 'nan'].includes(s)) return '';
  return String(str).trim();
};

const getDisplayChord = (chord: ChordEvent, level: AnalysisLevel): string => {
  const root = cleanStr(chord.root);
  let quality = cleanStr(chord.quality);
  let extension = cleanStr(chord.extension);
  let bass = cleanStr(chord.bass);
  
  // Normalize quality
  if (quality === 'minor' || quality === 'min') quality = 'm';
  if (quality === 'major' || quality === 'maj') quality = ''; // Standard notation: Cmaj -> C
  
  // Safety: If it's a simple triad, prevent "C7" if strictly Basic
  if (level === 'Basic') {
    return `${root}${quality}`; 
  }

  if (level === 'Intermediate') {
    // Show 7ths/9ths but ignore bass inversions if simpler reading is desired
    return `${root}${quality}${extension}`;
  }

  // Advanced: Show everything
  // Prefer the pre-calculated symbol if it looks valid
  const symbol = cleanStr(chord.symbol);
  if (symbol && symbol.length < 12 && !symbol.includes('none')) return symbol;

  // Fallback construction
  return `${root}${quality}${extension}${bass && bass !== root ? `/${bass}` : ''}`;
};

// --- Player Component ---
const MoisesPlayer: React.FC<{ 
  audioUrl?: string, 
  duration: number, 
  analysis: SongAnalysis,
  onTimeUpdate: (time: number) => void
}> = ({ audioUrl, duration, analysis, onTimeUpdate }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  
  // View State
  const [complexity, setComplexity] = useState<AnalysisLevel>('Advanced');
  const [showMetronome, setShowMetronome] = useState(false);

  // Constants
  const FIXED_PPS = 150; // Pixels Per Second
  
  // --- GRID CALCULATION ---
  const gridMarkers = useMemo(() => {
    if (!analysis.bpm || !analysis.timeSignature) return [];
    
    const bpm = analysis.bpm;
    const [beatsPerBar] = analysis.timeSignature.split('/').map(Number);
    const secondsPerBeat = 60 / bpm;
    const markers = [];
    
    // Create markers slightly beyond duration to cover fade out
    for (let t = 0; t < duration + 5; t += secondsPerBeat) {
      const beatIndex = Math.round(t / secondsPerBeat);
      const isMeasureStart = beatIndex % beatsPerBar === 0;
      markers.push({
        time: t,
        type: isMeasureStart ? 'measure' : 'beat',
        label: isMeasureStart ? `${Math.floor(beatIndex / beatsPerBar) + 1}` : null
      });
    }
    return markers;
  }, [analysis.bpm, analysis.timeSignature, duration]);

  // --- AUDIO SYNC LOOP ---
  useEffect(() => {
    let animationFrameId: number;
    const tick = () => {
      if (audioRef.current && !audioRef.current.paused) {
        const time = audioRef.current.currentTime;
        setCurrentTime(time);
        onTimeUpdate(time);
        animationFrameId = requestAnimationFrame(tick);
      }
    };
    if (isPlaying) animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, onTimeUpdate]);

  // --- PHASE-LOCKED METRONOME ---
  // This approach is much more stable than previous ones. 
  // It checks "Are we at a beat?" relative to audio time, rather than scheduling blindly.
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextClickTimeRef = useRef<number>(0);
  const schedulerTimerRef = useRef<number | null>(null);

  const scheduleClicks = () => {
    if (!audioContextRef.current || !isPlaying || !showMetronome || !audioRef.current) return;

    const ctx = audioContextRef.current;
    const lookahead = 25.0; // ms
    const scheduleAheadTime = 0.1; // sec
    
    // IMPORTANT: Re-calculate strict sync based on Audio Element current time
    // This prevents drift over time.
    const bpm = analysis.bpm || 120;
    const secondsPerBeat = (60.0 / bpm); // Base beat duration
    const secondsPerBeatScaled = secondsPerBeat / playbackRate; // Adjusted for speed

    // Current Audio Time
    const currentAudioTime = audioRef.current.currentTime;
    
    // AudioContext time corresponding to "Now"
    const ctxNow = ctx.currentTime;
    
    // If we drifted or seeked, reset the next click target
    // Find the next beat that hasn't happened yet relative to audio time
    const nextBeatIndex = Math.ceil(currentAudioTime / secondsPerBeat);
    const nextBeatAudioTime = nextBeatIndex * secondsPerBeat;
    
    // The delay from "now" until that beat happens (scaled by playback rate)
    const timeUntilNextBeat = (nextBeatAudioTime - currentAudioTime) / playbackRate;
    
    // Expected AudioContext time for that click
    const targetCtxTime = ctxNow + timeUntilNextBeat;

    // If our scheduled time is way off (seek happened), snap to the calculated target
    if (Math.abs(nextClickTimeRef.current - targetCtxTime) > 0.2) {
       nextClickTimeRef.current = targetCtxTime;
    }

    // Schedule queue
    while (nextClickTimeRef.current < ctx.currentTime + scheduleAheadTime) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      // Metronome Sound
      osc.frequency.value = 1000;
      gain.gain.value = 0.15;
      
      osc.start(nextClickTimeRef.current);
      osc.stop(nextClickTimeRef.current + 0.05);

      // Advance one beat
      nextClickTimeRef.current += secondsPerBeatScaled;
    }

    schedulerTimerRef.current = window.setTimeout(scheduleClicks, lookahead);
  };

  useEffect(() => {
    if (isPlaying && showMetronome) {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioContextRef.current.state === 'suspended') audioContextRef.current.resume();
        
        // Initial Snap
        nextClickTimeRef.current = audioContextRef.current.currentTime; 
        scheduleClicks();
    } else {
        if (schedulerTimerRef.current) clearTimeout(schedulerTimerRef.current);
    }
    return () => { if (schedulerTimerRef.current) clearTimeout(schedulerTimerRef.current); };
  }, [isPlaying, showMetronome, playbackRate]);


  // --- CONTROLS ---
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
      onTimeUpdate(time);
      // Reset metronome scheduler triggers automatically via effect/logic
    }
  };

  const activeChord = analysis.chords?.find(c => currentTime >= c.seconds && currentTime < (c.seconds + c.duration));

  return (
    <div className="w-full max-w-6xl mx-auto bg-slate-900 rounded-3xl border border-slate-700 overflow-hidden shadow-2xl relative mb-12">
      <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} />
      
      {/* --- VISUALIZER AREA --- */}
      <div className="relative bg-slate-950 h-80 overflow-hidden border-b border-slate-800 select-none">
         
         {/* PLAYHEAD (Fixed Center) */}
         <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-indigo-500 z-50 shadow-[0_0_15px_indigo]"></div>
         <div className="absolute left-1/2 top-4 -translate-x-1/2 bg-indigo-600 text-[10px] font-bold px-2 py-0.5 rounded-full text-white z-50 shadow-lg">NOW</div>

         {/* MOVING CANVAS */}
         <div 
           className="absolute top-0 bottom-0 left-1/2 will-change-transform"
           style={{ transform: `translate3d(${-currentTime * FIXED_PPS}px, 0, 0)` }}
         >
            {/* 1. GRID LAYER (Background) */}
            <div className="absolute top-0 bottom-0 pointer-events-none">
              {gridMarkers.map((marker, i) => {
                 // Optimization: Only render markers near the viewport
                 if (Math.abs(marker.time - currentTime) > 10) return null; 
                 return (
                    <div 
                      key={i}
                      className={`absolute top-0 bottom-0 border-r ${marker.type === 'measure' ? 'border-slate-700 w-0.5' : 'border-slate-800/40 w-px'}`}
                      style={{ left: `${marker.time * FIXED_PPS}px` }}
                    >
                      {marker.type === 'measure' && (
                        <div className="absolute bottom-2 right-1 text-[10px] font-mono text-slate-600">
                          {marker.label}
                        </div>
                      )}
                    </div>
                 );
              })}
            </div>

            {/* 2. SECTIONS LAYER (Top) */}
            <div className="absolute top-0 h-8 flex border-b border-slate-800">
               {analysis.sections?.map((section, i) => (
                 <div 
                    key={i}
                    className="h-full flex items-center px-3 text-[10px] font-bold uppercase tracking-wider text-white/90 border-r border-white/20 truncate"
                    style={{ 
                        position: 'absolute',
                        left: `${section.startTime * FIXED_PPS}px`,
                        width: `${Math.max((section.endTime - section.startTime) * FIXED_PPS, 1)}px`,
                        backgroundColor: section.color || '#334155'
                    }}
                 >
                    {section.name}
                 </div>
               ))}
            </div>

            {/* 3. CHORDS LAYER (Main) */}
            <div className="absolute top-12 bottom-8">
               {analysis.chords.map((chord, i) => {
                 // Optimization: Only render chords near viewport
                 if (chord.seconds > currentTime + 10 || (chord.seconds + chord.duration) < currentTime - 10) return null;

                 const isActive = activeChord === chord;
                 const chordName = getDisplayChord(chord, complexity);
                 const width = Math.max(2, chord.duration * FIXED_PPS);
                 
                 return (
                   <div 
                     key={i}
                     className={`absolute top-0 bottom-0 flex flex-col justify-center items-center border-l border-white/10 transition-all duration-100 ${isActive ? 'bg-white/5 backdrop-blur-sm z-20 shadow-[0_0_30px_rgba(255,255,255,0.05)]' : ''}`}
                     style={{
                        left: `${chord.seconds * FIXED_PPS}px`,
                        width: `${width}px`
                     }}
                   >
                      <div className={`text-center px-2 transition-transform duration-200 ${isActive ? 'scale-110' : 'scale-100 opacity-70'}`}>
                         <div className={`font-black tracking-tighter ${isActive ? 'text-white text-4xl drop-shadow-md' : 'text-slate-500 text-2xl'}`}>
                            {chordName}
                         </div>
                         {isActive && (
                            <div className="mt-2 flex flex-col gap-0.5 animate-fade-in">
                                {cleanStr(chord.quality) && <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-widest">{cleanStr(chord.quality)}</span>}
                                {cleanStr(chord.bass) && cleanStr(chord.bass) !== cleanStr(chord.root) && <span className="text-[10px] text-slate-400 border-t border-slate-600 pt-0.5">/{cleanStr(chord.bass)}</span>}
                            </div>
                         )}
                      </div>
                   </div>
                 );
               })}
            </div>
         </div>
         
         {/* EDGES FADE */}
         <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-slate-900 via-slate-900/80 to-transparent z-40 pointer-events-none"></div>
         <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-slate-900 via-slate-900/80 to-transparent z-40 pointer-events-none"></div>
      </div>

      {/* --- CONTROL DECK --- */}
      <div className="p-6 bg-slate-900">
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

         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <div className="flex flex-col gap-3">
               <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase w-12">Level</span>
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
                   <span className="text-[10px] font-bold text-slate-500 uppercase w-12">Speed</span>
                   <input 
                     type="range" min={0.5} max={1.5} step={0.1} 
                     value={playbackRate} 
                     onChange={(e) => { const r = parseFloat(e.target.value); setPlaybackRate(r); if(audioRef.current) audioRef.current.playbackRate = r; }}
                     className="w-24 h-1 bg-slate-700 rounded-lg appearance-none accent-indigo-500"
                   />
                   <span className="text-[10px] font-mono text-slate-400">{playbackRate}x</span>
               </div>
            </div>

            <div className="flex justify-center items-center gap-6">
               <button onClick={() => { if(audioRef.current) { const t = audioRef.current.currentTime - 5; audioRef.current.currentTime = t; setCurrentTime(t); } }} className="text-slate-400 hover:text-white">
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
               <button onClick={() => { if(audioRef.current) { const t = audioRef.current.currentTime + 5; audioRef.current.currentTime = t; setCurrentTime(t); } }} className="text-slate-400 hover:text-white">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" /></svg>
               </button>
            </div>

            <div className="flex flex-col items-end gap-3">
                <button 
                  onClick={() => setShowMetronome(!showMetronome)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${showMetronome ? 'bg-indigo-600 text-white shadow-[0_0_10px_indigo]' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                   Smart Click
                </button>
                <div className="flex items-center gap-2">
                   <span className="text-xs text-slate-500 font-bold bg-slate-800 px-2 py-1 rounded">Key: {analysis.key}</span>
                   <span className="text-xs text-slate-500 font-bold bg-slate-800 px-2 py-1 rounded">{analysis.bpm} BPM</span>
                   <span className="text-xs text-slate-500 font-bold bg-slate-800 px-2 py-1 rounded">{analysis.timeSignature}</span>
                </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export const AnalysisResult: React.FC<AnalysisResultProps> = ({ analysis, metadata }) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [complexity, setComplexity] = useState<AnalysisLevel>('Advanced');

  if (!analysis) return null;

  return (
    <div className="max-w-7xl mx-auto mt-8 px-4 pb-24">
      {/* Title Header */}
      <div className="text-center mb-8">
         <h1 className="text-3xl font-black text-white">{analysis.title || metadata?.fileName}</h1>
         <p className="text-slate-400">{analysis.artist || 'Unknown Artist'}</p>
      </div>

      {metadata?.audioUrl && (
        <MoisesPlayer 
           audioUrl={metadata.audioUrl} 
           duration={metadata.duration} 
           analysis={analysis} 
           onTimeUpdate={setCurrentTime}
        />
      )}
      
      {/* Harmonic Grid Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
           <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5">
              <h3 className="text-lg font-bold text-white mb-2">Harmonic Insights</h3>
              <p className="text-slate-300 leading-relaxed text-sm">{analysis.summary}</p>
           </div>
           
           <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Structure</h3>
              <div className="space-y-2">
                 {analysis.sections?.map((sec, i) => (
                    <div key={i} className="flex justify-between items-center text-sm border-b border-white/5 pb-2 last:border-0">
                       <span className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: sec.color || '#475569' }}></span>
                          <span className="text-white font-medium">{sec.name}</span>
                       </span>
                       <span className="font-mono text-slate-500">{Math.floor(sec.startTime/60)}:{Math.floor(sec.startTime%60).toString().padStart(2,'0')}</span>
                    </div>
                 ))}
              </div>
           </div>
        </div>

        <div className="lg:col-span-2">
           <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
              <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                 <h3 className="text-lg font-bold text-white">Harmonic Timeline</h3>
                 <span className="text-xs bg-indigo-900/30 text-indigo-400 px-2 py-1 rounded border border-indigo-500/30 font-mono">
                    A=440Hz
                 </span>
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                 <table className="w-full text-left text-sm">
                    <thead className="bg-slate-950 sticky top-0 z-10 shadow-lg">
                       <tr>
                          <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Time</th>
                          <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Chord</th>
                          <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Quality</th>
                          <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Bass</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                       {analysis.chords.map((chord, i) => {
                          const isActive = currentTime >= chord.seconds && currentTime < (chord.seconds + chord.duration);
                          return (
                            <tr 
                              key={i} 
                              className={`transition-colors ${isActive ? 'bg-indigo-900/20' : 'hover:bg-slate-800/50'} ${isActive ? 'border-l-4 border-indigo-500' : 'border-l-4 border-transparent'}`}
                            >
                               <td className={`p-4 font-mono whitespace-nowrap ${isActive ? 'text-indigo-300 font-bold' : 'text-slate-400'}`}>
                                  {chord.timestamp} <span className="text-[10px] opacity-50 ml-1">({chord.seconds}s)</span>
                               </td>
                               <td className="p-4">
                                  <span className={`text-lg font-black ${isActive ? 'text-white' : 'text-slate-200'}`}>
                                     {getDisplayChord(chord, 'Advanced')}
                                  </span>
                               </td>
                               <td className="p-4 text-slate-400">
                                  <span className="capitalize">{cleanStr(chord.quality) || 'Maj'}</span>
                                  {cleanStr(chord.extension) && <span className="ml-2 text-xs bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">{cleanStr(chord.extension)}</span>}
                               </td>
                               <td className="p-4 text-slate-400 font-mono">
                                  {cleanStr(chord.bass) || '-'}
                               </td>
                            </tr>
                          );
                       })}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
