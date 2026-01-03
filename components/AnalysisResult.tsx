import React, { useState, useEffect } from 'react';
import { SongAnalysis, ChordEvent, AudioMetadata } from '../types';

interface AnalysisResultProps {
  analysis: SongAnalysis | null;
  metadata: AudioMetadata | null;
}

const ChordCard: React.FC<{ chord: ChordEvent }> = ({ chord }) => {
  // Determine color based on quality
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
    <div className={`relative flex flex-col p-4 rounded-xl border bg-gradient-to-br ${colorClass} shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:shadow-xl hover:border-opacity-50 group h-full justify-between`}>
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
        body { background-color: #0f172a; color: #e2e8f0; font-family: system-ui, -apple-system, sans-serif; padding: 2rem; }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { color: #818cf8; margin-bottom: 0.5rem; }
        .meta { color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem; border-bottom: 1px solid #334155; padding-bottom: 1rem; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .stat-card { background: #1e293b; padding: 1.5rem; border-radius: 0.75rem; border: 1px solid #334155; }
        .stat-label { color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 0.5rem; }
        .stat-value { font-size: 1.5rem; font-weight: 800; color: #f8fafc; }
        .summary { background: linear-gradient(to right, #1e293b, #0f172a); padding: 2rem; border-radius: 1rem; border: 1px solid #4f46e5; margin-bottom: 2rem; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 1rem; }
        .chord-card { background: #1e293b; border: 1px solid #334155; border-radius: 0.75rem; padding: 1rem; display: flex; flex-direction: column; }
        .time { font-family: monospace; font-size: 0.75rem; color: #64748b; background: #0f172a; padding: 0.2rem 0.4rem; border-radius: 0.25rem; align-self: flex-start; margin-bottom: 0.5rem; }
        .symbol { font-size: 1.5rem; font-weight: 900; color: #e2e8f0; margin-bottom: 0.25rem; }
        .quality { font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; margin-bottom: 0.5rem; }
        .ext { display: inline-block; font-size: 0.7rem; background: #334155; padding: 0.1rem 0.3rem; border-radius: 0.2rem; margin-right: 0.25rem; margin-top: 0.25rem; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${editableTitle}</h1>
        <div class="meta">
            Duration: ${metadata?.duration ? formatDuration(metadata.duration) : 'Unknown'} • Generated by CHORD-IA
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <span class="stat-label">Key</span>
                <span class="stat-value" style="color: #818cf8">${analysis.key}</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">Time Sig</span>
                <span class="stat-value">${analysis.timeSignature}</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">BPM</span>
                <span class="stat-value">${analysis.bpmEstimate || 'N/A'}</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">Complexity</span>
                <span class="stat-value" style="color: #fbbf24">${analysis.complexityLevel}</span>
            </div>
        </div>

        <div class="summary">
            <h3 style="margin-top:0; color: #818cf8">Harmonic Analysis</h3>
            <p style="line-height: 1.6; color: #cbd5e1">${analysis.summary}</p>
        </div>

        <h3 style="margin-bottom: 1rem; border-bottom: 1px solid #334155; padding-bottom: 0.5rem;">Chord Progression</h3>
        <div class="grid">
            ${analysis.chords.map(c => `
                <div class="chord-card">
                    <span class="time">${c.timestamp}</span>
                    <span class="symbol">${c.symbol}</span>
                    <span class="quality">${c.quality}</span>
                    <div>
                        ${c.extensions?.map(e => `<span class="ext">${e}</span>`).join('') || ''}
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${editableTitle.replace(/\s+/g, '_')}_Analysis.html`;
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
               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
               </svg>
               <span>Duration: {formatDuration(metadata.duration)}</span>
             </div>
           )}
        </div>

        <button 
          onClick={handleExport}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 px-5 py-2.5 rounded-xl border border-slate-700 transition-all shadow-lg hover:shadow-indigo-500/10 active:scale-95 whitespace-nowrap"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export HTML
        </button>
      </div>
      
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
            Advanced Harmonic Analysis
          </h3>
          <p className="text-slate-300 leading-relaxed text-lg font-light tracking-wide">{analysis.summary}</p>
          {analysis.modulations.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2 items-center">
              <span className="text-sm text-slate-500 font-semibold mr-2">MODULATIONS:</span>
              {analysis.modulations.map((mod, i) => (
                <span key={i} className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-sm font-medium">
                  {mod}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chords Grid */}
      <div className="mb-6 flex items-end justify-between border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-3xl font-black text-white tracking-tight">Timeline</h3>
          <p className="text-slate-500 text-sm mt-1">Full spectrum chord progression detected</p>
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