
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SongAnalysis, ChordEvent, AudioMetadata, AnalysisLevel } from '../types';

interface AnalysisResultProps {
  analysis: SongAnalysis | null;
  metadata: AudioMetadata | null;
}

// --- Dynamic Complexity Logic ---
const getDisplayChord = (chord: ChordEvent, level: AnalysisLevel): string => {
  if (level === 'Advanced') return chord.symbol; 
  
  let base = chord.root;
  const q = chord.quality.toLowerCase();
  
  if (q.includes('min') || q === 'm') base += 'm';
  else if (q.includes('dim')) base += 'dim';
  else if (q.includes('aug')) base += 'aug';

  if (level === 'Basic') return base; 

  let inter = base;
  if (chord.extension) inter += chord.extension;
  if (chord.bass && chord.bass !== chord.root) inter += `/${chord.bass}`;
  
  return inter;
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
  const [complexity, setComplexity] = useState<AnalysisLevel>('Intermediate');
  const [showMetronome, setShowMetronome] = useState(false);

  // Metronome State
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextClickTimeRef = useRef<number>(0);
  const schedulerTimerRef = useRef<number | null>(null);

  // --- AUDIO SYNC LOOP ---
  useEffect(() => {
    let animationFrameId: number;
    
    const tick = () => {
      if (audioRef.current && !audioRef.current.paused) {
        const time = audioRef.current.currentTime;
        setCurrentTime(time);
        onTimeUpdate(time); // Sync parent table
        animationFrameId = requestAnimationFrame(tick);
      }
    };

    if (isPlaying) {
      animationFrameId = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, onTimeUpdate]);

  // --- INTELLIGENT METRONOME ---
  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  // Schedule clicks ahead of time
  const scheduleClicks = () => {
    if (!audioContextRef.current || !isPlaying || !showMetronome) return;

    const ctx = audioContextRef.current;
    const lookahead = 25.0; // How frequently to call scheduling (ms)
    const scheduleAheadTime = 0.1; // How far ahead to schedule audio (sec)

    const bpm = analysis.bpm || 120;
    // Calculate beat duration based on Speed
    const secondsPerBeat = (60.0 / bpm) / playbackRate;

    while (nextClickTimeRef.current < ctx.currentTime + scheduleAheadTime) {
      // Create Oscillator for click
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);

      // Simple Click: High pitch on beat
      osc.frequency.value = 1200;
      gain.gain.value = 0.15;
      
      osc.start(nextClickTimeRef.current);
      osc.stop(nextClickTimeRef.current + 0.05);

      // Advance time
      nextClickTimeRef.current += secondsPerBeat;
    }

    schedulerTimerRef.current = window.setTimeout(scheduleClicks, lookahead);
  };

  useEffect(() => {
    if (isPlaying && showMetronome) {
        // Sync Metronome anchor to current Audio Time
        if (audioContextRef.current) {
           // We need to sync the "AudioContext Time" to the "Media Element Time"
           // This is approximate but effective for a metronome
           nextClickTimeRef.current = audioContextRef.current.currentTime + 0.05;
           scheduleClicks();
        }
    } else {
        if (schedulerTimerRef.current) clearTimeout(schedulerTimerRef.current);
    }
    return () => { if (schedulerTimerRef.current) clearTimeout(schedulerTimerRef.current); };
  }, [isPlaying, showMetronome, playbackRate]);


  // --- HANDLERS ---
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        initAudioContext(); // Initialize audio context on user gesture
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
      onTimeUpdate(time);
      // Reset metronome scheduler
      if (audioContextRef.current) {
          nextClickTimeRef.current = audioContextRef.current.currentTime + 0.1;
      }
    }
  };

  const handleSpeed = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rate = parseFloat(e.target.value);
    setPlaybackRate(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
  };

  // --- RENDERING HELPERS ---
  const activeChord = analysis.chords?.find(c => currentTime >= c.seconds && currentTime < (c.seconds + c.duration));
  const FIXED_PPS = 120; 

  return (
    <div className="w-full max-w-6xl mx-auto bg-slate-900 rounded-3xl border border-slate-700 overflow-hidden shadow-2xl relative mb-12">
      <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} />
      
      {/* 1. VISUALIZER TRACKS */}
      <div className="relative bg-slate-950 h-72 overflow-hidden border-b border-slate-800">
         
         {/* Center Playhead */}
         <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-indigo-500 z-50 shadow-[0_0_15px_indigo]"></div>
         <div className="absolute left-1/2 top-4 -translate-x-1/2 bg-indigo-600 text-[10px] font-bold px-2 py-0.5 rounded-full text-white z-50">NOW</div>

         {/* Moving Container */}
         <div 
           className="absolute top-0 bottom-0 left-1/2 will-change-transform"
           style={{ transform: `translateX(${-currentTime * FIXED_PPS}px)` }}
         >
            {/* SECTIONS LAYER */}
            <div className="absolute top-0 h-8 flex">
               {analysis.sections?.map((section, i) => (
                 <div 
                    key={i}
                    className="h-full flex items-center px-3 text-[10px] font-bold uppercase tracking-wider text-white/90 border-r border-white/20 truncate"
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
            <div className="absolute top-10 bottom-0">
               {analysis.chords.map((chord, i) => {
                 const isActive = activeChord === chord;
                 // Ensure width is at least 2px to be visible
                 const width = Math.max(2, chord.duration * FIXED_PPS);
                 return (
                   <div 
                     key={i}
                     className={`absolute top-0 bottom-0 flex flex-col justify-center items-center border-l border-white/10 transition-all duration-150 group hover:bg-white/5 ${isActive ? 'bg-white/10 backdrop-blur-sm z-20' : ''}`}
                     style={{
                        left: `${chord.seconds * FIXED_PPS}px`,
                        width: `${width}px`
                     }}
                   >
                      <div className={`text-center px-2 transition-transform duration-200 ${isActive ? 'scale-125' : 'scale-100 opacity-60'}`}>
                         <div className={`font-black tracking-tighter ${isActive ? 'text-white text-3xl' : 'text-slate-400 text-xl'}`}>
                            {getDisplayChord(chord, complexity)}
                         </div>
                         {isActive && <div className="text-[10px] font-mono text-indigo-400 mt-1">{chord.timestamp}</div>}
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

      {/* 2. CONTROL DECK */}
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
                  <span className="text-[10px] font-bold text-slate-500 uppercase">View</span>
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

            {/* Right: Tools */}
            <div className="flex flex-col items-end gap-3">
                <button 
                  onClick={() => setShowMetronome(!showMetronome)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${showMetronome ? 'bg-indigo-600 text-white shadow-[0_0_10px_indigo]' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                   Smart Click
                </button>
                <div className="flex items-center gap-2">
                   <span className="text-xs text-slate-500 font-bold">Key: {analysis.key}</span>
                </div>
            </div>

         </div>
      </div>
    </div>
  );
};

export const AnalysisResult: React.FC<AnalysisResultProps> = ({ analysis, metadata }) => {
  const [currentTime, setCurrentTime] = useState(0);

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
           onTimeUpdate={setCurrentTime}
        />
      )}
      
      {/* RESTORED: Harmonic Grid Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left: Summary */}
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

        {/* Right: Detailed Table */}
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
                          <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Analysis</th>
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
                                     {chord.symbol}
                                  </span>
                               </td>
                               <td className="p-4 text-slate-400">
                                  <span className="capitalize">{chord.quality}</span>
                                  {chord.extension && <span className="ml-2 text-xs bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">{chord.extension}</span>}
                               </td>
                               <td className="p-4 text-slate-400 font-mono">
                                  {chord.bass || '-'}
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
