import React from 'react';
import { SongAnalysis, ChordEvent } from '../types';

interface AnalysisResultProps {
  analysis: SongAnalysis | null;
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
    // Dominant or Complex/Altered chords get the "gold/amber" treatment
    colorClass = "border-amber-500/30 from-amber-900/20 to-slate-900";
    textClass = "text-amber-400";
    accentClass = "bg-amber-500/20 text-amber-300 border-amber-500/30";
  }

  // Dynamic font sizing for complex chords
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

export const AnalysisResult: React.FC<AnalysisResultProps> = ({ analysis }) => {
  if (!analysis) return null;

  return (
    <div className="max-w-7xl mx-auto mt-12 px-4 animate-fade-in pb-20">
      
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