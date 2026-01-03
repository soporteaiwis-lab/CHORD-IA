import React from 'react';
import { SongAnalysis, ChordEvent } from '../types';

interface AnalysisResultProps {
  analysis: SongAnalysis | null;
}

const ChordCard: React.FC<{ chord: ChordEvent }> = ({ chord }) => {
  // Determine color based on quality
  let colorClass = "border-slate-700 bg-slate-800/50";
  let textClass = "text-slate-200";

  if (chord.quality.toLowerCase().includes('major')) {
    colorClass = "border-emerald-500/30 bg-emerald-900/10";
    textClass = "text-emerald-400";
  } else if (chord.quality.toLowerCase().includes('minor')) {
    colorClass = "border-blue-500/30 bg-blue-900/10";
    textClass = "text-blue-400";
  } else if (chord.quality.toLowerCase().includes('dim') || chord.quality.toLowerCase().includes('half')) {
    colorClass = "border-purple-500/30 bg-purple-900/10";
    textClass = "text-purple-400";
  } else if (chord.quality.toLowerCase().includes('dom') || chord.quality.toLowerCase().includes('aug')) {
    colorClass = "border-amber-500/30 bg-amber-900/10";
    textClass = "text-amber-400";
  }

  return (
    <div className={`flex flex-col p-3 rounded-lg border ${colorClass} transition-all hover:scale-105 hover:bg-slate-800`}>
      <span className="text-xs text-slate-500 font-mono mb-1">{chord.timestamp}</span>
      <div className="flex items-baseline gap-1">
        <span className={`text-xl font-bold ${textClass}`}>{chord.symbol}</span>
        {chord.bassNote && <span className="text-sm text-slate-400">/{chord.bassNote}</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {chord.extensions?.map((ext, i) => (
          <span key={i} className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
            {ext}
          </span>
        ))}
      </div>
    </div>
  );
};

export const AnalysisResult: React.FC<AnalysisResultProps> = ({ analysis }) => {
  if (!analysis) return null;

  return (
    <div className="max-w-6xl mx-auto mt-12 px-4 animate-fade-in pb-20">
      
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800">
          <div className="text-sm text-slate-400 uppercase tracking-widest mb-2">Key Center</div>
          <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 to-purple-400">
            {analysis.key}
          </div>
        </div>
        <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800">
          <div className="text-sm text-slate-400 uppercase tracking-widest mb-2">Signature</div>
          <div className="text-3xl font-bold text-white">
            {analysis.timeSignature}
          </div>
        </div>
        <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800">
          <div className="text-sm text-slate-400 uppercase tracking-widest mb-2">Complexity</div>
          <div className={`text-xl font-bold ${
            analysis.complexityLevel.includes('Jazz') ? 'text-pink-500' : 
            analysis.complexityLevel === 'Advanced' ? 'text-amber-500' : 
            'text-emerald-500'
          }`}>
            {analysis.complexityLevel}
          </div>
        </div>
        <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800">
          <div className="text-sm text-slate-400 uppercase tracking-widest mb-2">Modulations</div>
          <div className="text-lg font-medium text-white">
            {analysis.modulations.length > 0 ? analysis.modulations.join(', ') : 'None'}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 mb-8">
        <h3 className="text-lg font-semibold text-white mb-3">AI Theory Analysis</h3>
        <p className="text-slate-300 leading-relaxed">{analysis.summary}</p>
      </div>

      {/* Chords Grid */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-2xl font-bold text-white">Detected Progression</h3>
        <span className="text-xs text-slate-500 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
          {analysis.chords.length} Events
        </span>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {analysis.chords.map((chord, idx) => (
          <ChordCard key={idx} chord={chord} />
        ))}
      </div>
    </div>
  );
};