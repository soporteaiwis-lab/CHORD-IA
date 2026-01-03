import React, { useState, useEffect, useRef } from 'react';
import { SongAnalysis, ChordEvent, AudioMetadata } from '../types';

interface AnalysisResultProps {
  analysis: SongAnalysis | null;
  metadata: AudioMetadata | null;
}

// --- Waveform Player Component ---
const WaveformPlayer: React.FC<{ audioUrl?: string, duration: number, chords: ChordEvent[] }> = ({ audioUrl, duration, chords }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Generate waveform data from audio URL
  useEffect(() => {
    if (!audioUrl) return;

    const fetchAudio = async () => {
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const rawData = audioBuffer.getChannelData(0); // Left channel
        const samples = 200; // Number of bars to draw
        const blockSize = Math.floor(rawData.length / samples);
        const filteredData = [];
        
        for (let i = 0; i < samples; i++) {
          let blockStart = blockSize * i;
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum = sum + Math.abs(rawData[blockStart + j]);
          }
          filteredData.push(sum / blockSize);
        }
        
        // Normalize
        const multiplier = Math.pow(Math.max(...filteredData), -1);
        setWaveformData(filteredData.map(n => n * multiplier));
        setIsLoaded(true);
      } catch (e) {
        console.error("Error decoding audio for waveform", e);
      }
    };

    fetchAudio();
  }, [audioUrl]);

  // Handle Playback Loop for UI updates
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('ended', () => setIsPlaying(false));
    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('ended', () => setIsPlaying(false));
    };
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !audioRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const parseTime = (timeStr: string) => {
    const [min, sec] = timeStr.split(':').map(Number);
    return min * 60 + sec;
  };

  // Find active chord
  const activeChordIndex = chords.findIndex((c, i) => {
    const start = parseTime(c.timestamp);
    const end = chords[i + 1] ? parseTime(chords[i + 1].timestamp) : duration;
    return currentTime >= start && currentTime < end;
  });

  return (
    <div className="bg-slate-900/80 rounded-2xl border border-slate-700 p-6 mb-8 shadow-xl">
      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex justify-between">
        <span>Audio Player & Waveform</span>
        {isLoaded ? <span className="text-emerald-400">Audio Loaded</span> : <span className="text-amber-400 animate-pulse">Loading Audio...</span>}
      </h3>
      
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Waveform Container */}
      <div 
        ref={containerRef}
        onClick={handleSeek}
        className="relative h-32 w-full bg-slate-950 rounded-lg cursor-pointer overflow-hidden border border-slate-800 group"
      >
        {/* Draw Bars */}
        <div className="absolute inset-0 flex items-center justify-between px-1 gap-px">
          {waveformData.map((amp, i) => (
            <div 
              key={i} 
              className="flex-1 bg-indigo-500/40 rounded-full transition-all duration-300"
              style={{ 
                height: `${Math.max(10, amp * 100)}%`,
                opacity: (i / waveformData.length) < (currentTime / duration) ? 1 : 0.3,
                backgroundColor: (i / waveformData.length) < (currentTime / duration) ? '#818cf8' : undefined
              }}
            />
          ))}
        </div>

        {/* Playhead */}
        <div 
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_white] z-10 transition-none pointer-events-none"
          style={{ left: `${(currentTime / duration) * 100}%` }}
        />

        {/* Hover Effect */}
        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mt-4">
        <button 
          onClick={togglePlay}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-full font-bold transition-all shadow-lg hover:shadow-indigo-500/20 active:scale-95"
        >
          {isPlaying ? (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              PAUSE
            </>
          ) : (
             <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
              PLAY
            </>
          )}
        </button>

        <div className="text-right">
           <div className="text-2xl font-mono font-bold text-white">
             {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
           </div>
           {activeChordIndex !== -1 && chords[activeChordIndex] && (
             <div className="text-indigo-400 font-bold text-sm">
               Current: {chords[activeChordIndex].symbol}
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

const ChordCard: React.FC<{ chord: ChordEvent, isActive?: boolean }> = ({ chord, isActive }) => {
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
    <div className={`relative flex flex-col p-4 rounded-xl border bg-gradient-to-br ${colorClass} shadow-lg backdrop-blur-sm transition-all duration-300 group h-full justify-between ${isActive ? 'ring-2 ring-white scale-105 shadow-2xl z-10' : 'hover:scale-105 hover:shadow-xl hover:border-opacity-50'}`}>
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
        <div class="subtitle">Generated by CHORD-IA BETA 1.0</div>

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
      
      {/* Waveform Player */}
      {metadata?.audioUrl && metadata?.duration && (
        <WaveformPlayer 
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

      {/* Chords Grid */}
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