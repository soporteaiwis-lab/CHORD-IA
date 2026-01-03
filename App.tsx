import React, { useState, useEffect } from 'react';
import { Hero } from './components/Hero';
import { AudioInput } from './components/AudioInput';
import { AnalysisResult } from './components/AnalysisResult';
import { analyzeAudioContent } from './services/geminiService';
import { AnalysisStatus, SongAnalysis } from './types';

const App: React.FC = () => {
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [analysis, setAnalysis] = useState<SongAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Helper to convert Blob/File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // Remove "data:audio/xyz;base64," prefix
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error("Failed to convert file to base64"));
        }
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const processAudio = async (file: File) => {
    setStatus(AnalysisStatus.PROCESSING_AUDIO);
    setError(null);
    setAnalysis(null);

    try {
      const base64Data = await fileToBase64(file);
      // Ensure we pass a valid mime type or fallback to mp3 which is generally safe
      const mimeType = file.type || 'audio/mp3'; 

      setStatus(AnalysisStatus.ANALYZING_AI);
      
      const result = await analyzeAudioContent(base64Data, mimeType);
      
      setAnalysis(result);
      setStatus(AnalysisStatus.COMPLETE);

    } catch (err: any) {
      console.error(err);
      setStatus(AnalysisStatus.ERROR);
      // Use the actual error message which contains useful info now
      setError(err instanceof Error ? err.message : "An unexpected error occurred during analysis.");
    }
  };

  const handleAudioReady = (file: File) => {
    processAudio(file);
  };

  const handleReset = () => {
    setStatus(AnalysisStatus.IDLE);
    setAnalysis(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">
      <Hero />
      
      <main className="container mx-auto px-4 pb-12 relative z-10">
        
        {status === AnalysisStatus.IDLE && (
           <AudioInput onAudioReady={handleAudioReady} status={status} />
        )}

        {status === AnalysisStatus.PROCESSING_AUDIO && (
          <div className="text-center mt-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent mb-4"></div>
            <p className="text-indigo-300 text-lg font-medium">Processing Audio File...</p>
          </div>
        )}

        {status === AnalysisStatus.ANALYZING_AI && (
          <div className="text-center mt-20 max-w-lg mx-auto bg-slate-900/80 p-8 rounded-2xl border border-indigo-500/30 shadow-2xl shadow-indigo-500/20">
            <div className="flex justify-center mb-6">
              <div className="flex space-x-2">
                <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce"></div>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">CHORD-IA is listening...</h2>
            <p className="text-slate-400">
              Detecting harmonic structures, calculating tension intervals, and identifying modulations. This might take a moment.
            </p>
          </div>
        )}

        {status === AnalysisStatus.ERROR && (
           <div className="text-center mt-12 max-w-md mx-auto animate-fade-in">
             <div className="bg-red-900/20 border border-red-500/50 text-red-200 p-6 rounded-xl shadow-lg">
               <h3 className="text-xl font-bold mb-2">Analysis Failed</h3>
               <p className="text-sm opacity-90">{error}</p>
             </div>
             <button 
               onClick={handleReset}
               className="mt-6 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full transition-colors border border-slate-700"
             >
               Try Again
             </button>
           </div>
        )}

        {status === AnalysisStatus.COMPLETE && analysis && (
          <div className="relative">
             <div className="sticky top-4 z-50 flex justify-end mb-4 pointer-events-none">
                <button 
                  onClick={handleReset}
                  className="pointer-events-auto bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-full shadow-lg shadow-indigo-500/30 font-medium transition-all transform hover:scale-105"
                >
                  New Analysis
                </button>
             </div>
             <AnalysisResult analysis={analysis} />
          </div>
        )}

      </main>

      <footer className="py-8 text-center text-slate-600 text-sm border-t border-slate-900 mt-12">
        <p>CHORD-IA Powered by Gemini 2.5 Flash Native Audio • Audio Intelligence</p>
      </footer>
    </div>
  );
};

export default App;