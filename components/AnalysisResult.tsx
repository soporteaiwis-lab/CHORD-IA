import React, { useState, useEffect, useRef } from 'react';
import { SongAnalysis, ChordEvent, AudioMetadata } from '../types';

interface AnalysisResultProps {
  analysis: SongAnalysis | null;
  metadata: AudioMetadata | null;
}

// --- Helper Functions ---
const parseTime = (timeStr: string) => {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
};

// --- Player Controls Icons ---
const Icons = {
  Play: () => <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>,
  Pause: () => <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>,
  Stop: () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>,
  SkipStart: () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>,
  SkipEnd: () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>,
  Rewind10: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" /></svg>,
  Forward10: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" /></svg>,
  VolumeHigh: () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>,
  VolumeMute: () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
};

// --- Interactive Player Component ---
const EnhancedAudioPlayer: React.FC<{ audioUrl?: string, duration: number, chords: ChordEvent[] }> = ({ audioUrl, duration, chords }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Parse all chord timestamps once
  const parsedChords = React.useMemo(() => {
    return chords.map(c => ({ ...c, seconds: parseTime(c.timestamp) }));
  }, [chords]);

  // Generate waveform
  useEffect(() => {
    if (!audioUrl) return;
    const fetchAudio = async () => {
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const rawData = audioBuffer.getChannelData(0);
        const samples = 150; 
        const blockSize = Math.floor(rawData.length / samples);
        const filteredData = [];
        for (let i = 0; i < samples; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum = sum + Math.abs(rawData[blockSize * i + j]);
          }
          filteredData.push(sum / blockSize);
        }
        const multiplier = Math.pow(Math.max(...filteredData), -1);
        setWaveformData(filteredData.map(n => n * multiplier));
        setIsLoaded(true);
      } catch (e) {
        console.error("Waveform Error", e);
      }
    };
    fetchAudio();
  }, [audioUrl]);

  // Audio Events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const handleEnd = () => { setIsPlaying(false); setCurrentTime(0); };
    
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('ended', handleEnd);
    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('ended', handleEnd);
    };
  }, []);

  // Controls
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  const seek = (time: number) => {
    if (audioRef.current) {
      const newTime = Math.max(0, Math.min(time, duration));
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const skip = (seconds: number) => seek(currentTime + seconds);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (audioRef.current) audioRef.current.volume = newVol;
    setIsMuted(newVol === 0);
  };

  const toggleMute = () => {
    if (audioRef.current) {
      const newMute = !isMuted;
      setIsMuted(newMute);
      audioRef.current.muted = newMute;
      if (!newMute && volume === 0) {
        setVolume(0.5);
        audioRef.current.volume = 0.5;
      }
    }
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    seek(pct * duration);
  };

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-indigo-500/30 p-6 mb-8 shadow-2xl backdrop-blur-sm relative overflow-hidden">
      
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-24 bg-indigo-500/10 blur-[80px] rounded-full pointer-events-none"></div>

      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* --- SCROLLING CHORD TIMELINE --- */}
      <div className="relative h-40 w-full mb-6 overflow-hidden border-b border-slate-800 mask-image-gradient">
        {/* Center Marker Line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-indigo-500/50 z-20 shadow-[0_0_15px_rgba(99,102,241,0.8)]"></div>
        
        {/* Track Container */}
        <div className="absolute inset-0 flex items-center">
            {parsedChords.map((chord, i) => {
               // Calculate position: 0 is center.
               // Scale: 100px per second for smooth scrolling
               const PIXELS_PER_SECOND = 120;
               const offsetSeconds = chord.seconds - currentTime;
               const leftPos = `calc(50% + ${offsetSeconds * PIXELS_PER_SECOND}px)`;
               
               // Determine style based on position
               const distance = Math.abs(offsetSeconds);
               const isPast = offsetSeconds < -0.5;
               const isFuture = offsetSeconds > 0.5;
               const isActive = !isPast && !isFuture;
               
               // Only render chords within a reasonable window to save DOM performance
               if (distance > 10) return null;

               return (
                 <div 
                    key={i}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-75 flex flex-col items-center justify-center p-4 rounded-xl"
                    style={{ 
                        left: leftPos,
                        opacity: isActive ? 1 : Math.max(0.1, 1 - distance / 4),
                        transform: `translate(-50%, -50%) scale(${isActive ? 1.3 : 0.8})`,
                        filter: isActive ? 'drop-shadow(0 0 15px rgba(99, 102, 241, 0.5))' : 'grayscale(100%)',
                        zIndex: isActive ? 10 : 1
                    }}
                 >
                    <div className={`text-4xl font-black tracking-tighter ${isActive ? 'text-white' : 'text-slate-500'}`}>
                        {chord.symbol}
                    </div>
                    <div className={`text-xs uppercase font-bold mt-1 ${isActive ? 'text-indigo-400' : 'text-slate-600'}`}>
                        {chord.quality}
                    </div>
                    {chord.bassNote && (
                        <div className="text-xs text-slate-500 mt-1 border-t border-slate-700 w-full text-center">
                            /{chord.bassNote}
                        </div>
                    )}
                 </div>
               );
            })}
        </div>
        
        {/* Gradient Masks for edges */}
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-slate-900 to-transparent z-10 pointer-events-none"></div>
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-slate-900 to-transparent z-10 pointer-events-none"></div>
      </div>


      {/* --- WAVEFORM SCRUBBER --- */}
      <div 
        ref={containerRef}
        onClick={handleWaveformClick}
        className="relative h-16 w-full bg-slate-950 rounded-lg cursor-pointer overflow-hidden border border-slate-800 group mb-6"
      >
        <div className="absolute inset-0 flex items-center justify-between px-1 gap-px">
          {waveformData.map((amp, i) => (
            <div 
              key={i} 
              className="flex-1 bg-indigo-500/40 rounded-full transition-all duration-300"
              style={{ 
                height: `${Math.max(15, amp * 100)}%`,
                opacity: (i / waveformData.length) < (currentTime / duration) ? 1 : 0.3,
                backgroundColor: (i / waveformData.length) < (currentTime / duration) ? '#818cf8' : undefined
              }}
            />
          ))}
        </div>
        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      </div>


      {/* --- CONTROL DECK --- */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-slate-950/50 p-4 rounded-xl border border-white/5">
        
        {/* Time Display */}
        <div className="text-2xl font-mono font-bold text-white tabular-nums w-24">
             {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
        </div>

        {/* Playback Buttons */}
        <div className="flex items-center gap-3">
             <button onClick={() => seek(0)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors" title="Start">
                 <Icons.SkipStart />
             </button>
             <button onClick={() => skip(-10)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors" title="-10s">
                 <Icons.Rewind10 />
             </button>
             
             {/* STOP */}
             <button onClick={stop} className="p-3 text-slate-200 hover:text-red-400 bg-slate-800 hover:bg-slate-700 rounded-full transition-all shadow-lg" title="Stop">
                 <Icons.Stop />
             </button>

             {/* PLAY/PAUSE - BIG BUTTON */}
             <button 
                onClick={togglePlay}
                className="p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg shadow-indigo-500/40 transform hover:scale-105 active:scale-95 transition-all"
             >
                {isPlaying ? <Icons.Pause /> : <Icons.Play />}
             </button>

             <button onClick={() => skip(10)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors" title="+10s">
                 <Icons.Forward10 />
             </button>
             <button onClick={() => seek(duration)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors" title="End">
                 <Icons.SkipEnd />
             </button>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-3 w-48">
             <button onClick={toggleMute} className="text-slate-400 hover:text-white">
                 {isMuted || volume === 0 ? <Icons.VolumeMute /> : <Icons.VolumeHigh />}
             </button>
             <input 
               type="range" 
               min="0" 
               max="1" 
               step="0.01" 
               value={isMuted ? 0 : volume} 
               onChange={handleVolumeChange}
               className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
             />
        </div>

      </div>
    </div>
  );
};

// --- Standard Static Card ---
const ChordCard: React.FC<{ chord: ChordEvent }> = ({ chord }) => {
  let colorClass = "border-slate-700 from-slate-800 to-slate-900";
  let textClass = "text-slate-200";
  let accentClass = "bg-slate-700";

  const quality = chord.quality.toLowerCase();
  const symbolLength = chord.symbol.length;

  if (quality.includes('major')) {
    colorClass = "border-emerald-500/30 from-emerald-900/20 to-slate-900";
    textClass = "text-emerald-400";
    accentClass = "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
  } else if (quality.includes('minor') && !quality.includes('dim')) {
    colorClass = "border-blue-500/30 from-blue-900/20 to-slate-900";
    textClass = "text-blue-400";
    accentClass = "bg-blue-500/20 text-blue-300 border-blue-500/30";
  } else if (quality.includes('dim') || quality.includes('half')) {
    colorClass = "border-purple-500/30 from-purple-900/20 to-slate-900";
    textClass = "text-purple-400";
    accentClass = "bg-purple-500/20 text-purple-300 border-purple-500/30";
  } else if (quality.includes('dom') || quality.includes('aug') || quality.includes('alt') || symbolLength > 4) {
    colorClass = "border-amber-500/30 from-amber-900/20 to-slate-900";
    textClass = "text-amber-400";
    accentClass = "bg-amber-500/20 text-amber-300 border-amber-500/30";
  }

  const titleSize = symbolLength > 7 ? "text-xl" : symbolLength > 4 ? "text-2xl" : "text-3xl";

  return (
    <div className={`relative flex flex-col p-4 rounded-xl border bg-gradient-to-br ${colorClass} shadow-lg backdrop-blur-sm transition-all duration-300 group h-full justify-between hover:scale-105 hover:shadow-xl hover:border-opacity-50`}>
      <div className="flex justify-between items-start mb-2">
         <span className="text-xs text-slate-500 font-mono bg-slate-950/50 px-2 py-0.5 rounded border border-slate-800">{chord.timestamp}</span>
         <span className="text-[10px] text-slate-600 group-hover:text-slate-400 transition-colors">{chord.confidence}%</span>
      </div>
      
      <div className="flex flex-col my-2">
        <div className="flex items-baseline flex-wrap gap-x-1">
            <span className={`${titleSize} font-black tracking-tight ${textClass} break-words leading-tight`}>
                {chord.symbol}
            </span>
        </div>
        {chord.bassNote && !chord.symbol.includes(`/${chord.bassNote}`) && (
             <span className="text-sm text-slate-400 font-medium mt-1 border-t border-slate-700/50 pt-1">
                 Bass: {chord.bassNote}
             </span>
        )}
      </div>
      
      <div className="space-y-2 mt-auto">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium truncate opacity-70">
            {chord.quality}
        </div>

        {chord.extensions && chord.extensions.length > 0 && (
            <div className="flex flex-wrap gap-1">
                {chord.extensions.map((ext, i) => (
                <span key={i} className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${accentClass}`}>
                    {ext}
                </span>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};

export const AnalysisResult: React.FC<AnalysisResultProps> = ({ analysis, metadata }) => {
  const [editableTitle, setEditableTitle] = useState(metadata?.fileName || "Untitled Analysis");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (metadata?.fileName) {
      setEditableTitle(metadata.fileName);
    }
  }, [metadata]);

  if (!analysis) return null;

  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const handleExport = () => {
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>CHORD-IA Analysis: ${editableTitle}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #f1f5f9; padding: 40px; max-width: 900px; margin: 0 auto; }
          h1 { color: #818cf8; border-bottom: 2px solid #3730a3; padding-bottom: 15px; margin-bottom: 5px; }
          .subtitle { color: #64748b; font-size: 0.9em; margin-bottom: 30px; }
          .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin: 30px 0; }
          .card { background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
          .label { font-size: 0.75em; text-transform: uppercase; color: #94a3b8; font-weight: bold; letter-spacing: 0.05em; }
          .value { font-size: 1.5em; font-weight: bold; color: #e2e8f0; margin-top: 5px; }
          .summary-container { background: #1e293b; padding: 30px; border-radius: 12px; border-left: 5px solid #818cf8; margin-bottom: 40px; }
          .summary-title { font-size: 1.1em; font-weight: bold; color: #fff; margin-bottom: 10px; }
          .summary-text { line-height: 1.7; color: #cbd5e1; }
          table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 20px; border: 1px solid #334155; border-radius: 12px; overflow: hidden; }
          th { text-align: left; background: #0f172a; color: #94a3b8; padding: 15px; font-weight: 600; text-transform: uppercase; font-size: 0.8em; letter-spacing: 0.05em; border-bottom: 1px solid #334155; }
          td { padding: 15px; border-bottom: 1px solid #334155; background: #1e293b; color: #e2e8f0; }
          tr:last-child td { border-bottom: none; }
          tr:nth-child(even) td { background: #182335; }
          .chord-symbol { font-weight: 900; color: #818cf8; font-size: 1.2em; }
          .footer { margin-top: 60px; text-align: center; color: #475569; font-size: 0.85em; padding-top: 20px; border-top: 1px solid #1e293b; }
          @media print {
            body { background: white; color: black; padding: 20px; }
            .card, .summary-container, table, td, th { border-color: #e2e8f0; background: white !important; color: black !important; }
            .summary-container { border-left-color: #4338ca; }
            h1, .chord-symbol { color: #4338ca !important; }
            .meta-grid { gap: 10px; }
          }
        </style>
      </head>
      <body>
        <h1>${editableTitle}</h1>
        <div class="subtitle">Generated by CHORD-IA BETA 2.0</div>

        <div class="meta-grid">
          <div class="card">
            <div class="label">Key</div>
            <div class="value">${analysis.key}</div>
          </div>
          <div class="card">
            <div class="label">BPM Estimate</div>
            <div class="value">${analysis.bpmEstimate || 'N/A'}</div>
          </div>
          <div class="card">
            <div class="label">Time Signature</div>
            <div class="value">${analysis.timeSignature}</div>
          </div>
          <div class="card">
            <div class="label">Complexity</div>
            <div class="value">${analysis.complexityLevel}</div>
          </div>
        </div>

        <div class="summary-container">
          <div class="summary-title">Harmonic Summary</div>
          <div class="summary-text">${analysis.summary}</div>
        </div>

        <h3 style="color: #e2e8f0; border-bottom: 1px solid #334155; padding-bottom: 10px; margin-bottom: 20px;">Detailed Chord Progression</h3>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Symbol</th>
              <th>Quality</th>
              <th>Extensions</th>
              <th>Bass Note</th>
            </tr>
          </thead>
          <tbody>
            ${analysis.chords.map(c => `
              <tr>
                <td style="font-family: monospace; color: #94a3b8;">${c.timestamp}</td>
                <td class="chord-symbol">${c.symbol}</td>
                <td>${c.quality}</td>
                <td>${c.extensions?.map(e => `<span style="display:inline-block; padding: 2px 6px; border-radius: 4px; background: #334155; font-size: 0.8em; margin-right: 4px;">${e}</span>`).join('') || '-'}</td>
                <td>${c.bassNote || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          Analysis generated by CHORD-IA (Powered by Gemini 3 Flash Preview) • AIWIS.CL
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${editableTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_analysis.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto mt-12 px-4 animate-fade-in pb-20">
      
      {/* Top Metadata Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900/60 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl mb-8 gap-4">
        <div className="flex-1 w-full">
           <div className="flex items-center gap-3 mb-1">
             {isEditing ? (
               <input 
                 type="text" 
                 value={editableTitle}
                 onChange={(e) => setEditableTitle(e.target.value)}
                 onBlur={() => setIsEditing(false)}
                 onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
                 autoFocus
                 className="bg-slate-800 text-2xl font-bold text-white px-2 py-1 rounded outline-none border border-indigo-500 w-full"
               />
             ) : (
               <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditing(true)}>
                  <h2 className="text-2xl font-bold text-white truncate max-w-lg" title="Click to edit">
                    {editableTitle}
                  </h2>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
               </div>
             )}
           </div>
           {metadata?.duration && (
             <div className="flex items-center gap-2 text-sm text-slate-400 font-mono">
               <span>Duration: {formatDuration(metadata.duration)}</span>
             </div>
           )}
        </div>
        
        {/* Export Button */}
        <button 
          onClick={handleExport}
          className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 shadow-md flex items-center gap-2 transition-all active:scale-95 text-sm font-semibold"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export Report
        </button>
      </div>
      
      {/* Enhanced Interactive Player (Replacing old WaveformPlayer) */}
      {metadata?.audioUrl && metadata?.duration && (
        <EnhancedAudioPlayer 
          audioUrl={metadata.audioUrl} 
          duration={metadata.duration} 
          chords={analysis.chords}
        />
      )}

      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-white/5 shadow-xl">
          <div className="text-xs text-indigo-300 uppercase tracking-widest font-bold mb-2">Key Center</div>
          <div className="text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 drop-shadow-sm truncate">
            {analysis.key}
          </div>
        </div>
        <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-white/5 shadow-xl">
          <div className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-2">Time Signature</div>
          <div className="text-3xl lg:text-4xl font-black text-white">
            {analysis.timeSignature}
          </div>
        </div>
        <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-white/5 shadow-xl">
          <div className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-2">Complexity</div>
          <div className={`text-xl lg:text-2xl font-bold ${
            analysis.complexityLevel.includes('Jazz') ? 'text-pink-400' : 
            analysis.complexityLevel === 'Advanced' ? 'text-amber-400' : 
            'text-emerald-400'
          }`}>
            {analysis.complexityLevel}
          </div>
        </div>
        <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-white/5 shadow-xl">
          <div className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-2">BPM Estimate</div>
          <div className="text-3xl lg:text-2xl font-bold text-white">
            {analysis.bpmEstimate || "N/A"}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="relative bg-gradient-to-r from-slate-900 to-slate-900/80 rounded-2xl border border-indigo-500/20 p-8 mb-10 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-indigo-500 rounded-full blur-3xl opacity-20"></div>
        <div className="relative z-10">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-400" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"/></svg>
            Harmonic Summary
          </h3>
          <p className="text-slate-300 leading-relaxed text-lg font-light tracking-wide">{analysis.summary}</p>
        </div>
      </div>

      {/* Static Chords Grid (Preserved) */}
      <div className="mb-6 flex items-end justify-between border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-3xl font-black text-white tracking-tight">Timeline</h3>
          <p className="text-slate-500 text-sm mt-1">Full spectrum chord progression</p>
        </div>
        <span className="text-xs font-mono text-indigo-400 bg-indigo-900/20 px-3 py-1 rounded-full border border-indigo-900/50">
          {analysis.chords.length} EVENTS
        </span>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {analysis.chords.map((chord, idx) => (
          <ChordCard key={idx} chord={chord} />
        ))}
      </div>
    </div>
  );
};