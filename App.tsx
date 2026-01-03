import React, { useState } from 'react';
import { Hero } from './components/Hero';
import { AudioInput } from './components/AudioInput';
import { AnalysisResult } from './components/AnalysisResult';
import { analyzeAudioContent, analyzeSongFromUrl } from './services/geminiService';
import { AnalysisStatus, SongAnalysis, AudioMetadata, AnalysisLevel } from './types';

const App: React.FC = () => {
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [analysis, setAnalysis] = useState<SongAnalysis | null>(null);
  const [metadata, setMetadata] = useState<AudioMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Helper to convert Blob/File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error("Failed to convert file to base64"));
        }
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
        const objectUrl = URL.createObjectURL(file);
        const audio = new Audio();
        audio.onloadedmetadata = () => {
            resolve(audio.duration);
        };
        audio.onerror = () => {
            resolve(0);
        };
        audio.src = objectUrl;
    });
  };

  const getCorrectMimeType = (file: File): string => {
    if (file.type && file.type.startsWith('audio/')) {
        return file.type;
    }
    const name = file.name.toLowerCase();
    if (name.endsWith('.mp3')) return 'audio/mp3';
    if (name.endsWith('.wav')) return 'audio/wav';
    if (name.endsWith('.m4a')) return 'audio/mp4'; 
    if (name.endsWith('.flac')) return 'audio/flac';
    if (name.endsWith('.ogg')) return 'audio/ogg';
    if (name.endsWith('.aac')) return 'audio/aac';
    return 'audio/mp3';
  };

  const processAudio = async (file: File, level: AnalysisLevel) => {
    setStatus(AnalysisStatus.PROCESSING_AUDIO);
    setError(null);
    setAnalysis(null);
    setMetadata(null);

    try {
      const fileUrl = URL.createObjectURL(file);
      const [base64Data, duration] = await Promise.all([
          fileToBase64(file),
          getAudioDuration(file)
      ]);
      
      setMetadata({
          fileName: file.name.replace(/\.[^/.]+$/, ""),
          duration: duration,
          audioUrl: fileUrl 
      });

      const mimeType = getCorrectMimeType(file);
      
      setStatus(AnalysisStatus.ANALYZING_AI);
      
      const result = await analyzeAudioContent(base64Data, mimeType, level, duration);
      
      setAnalysis(result);
      setStatus(AnalysisStatus.COMPLETE);

    } catch (err: any) {
      console.error(err);
      setStatus(AnalysisStatus.ERROR);
      setError(err instanceof Error ? err.message : "An unexpected error occurred during analysis.");
    }
  };

  const processLink = async (url: string, level: AnalysisLevel) => {
    setStatus(AnalysisStatus.ANALYZING_AI);
    setError(null);
    setAnalysis(null);
    
    let fileName = "Online Link";
    try {
        const urlObj = new URL(url);
        fileName = urlObj.hostname;
    } catch(e) {}

    setMetadata({
        fileName: fileName,
        duration: 0 
    });

    try {
      const result = await analyzeSongFromUrl(url, level);
      setAnalysis(result);
      setStatus(AnalysisStatus.COMPLETE);
    } catch (err: any) {
      console.error(err);
      setStatus(AnalysisStatus.ERROR);
      setError(err instanceof Error ? err.message : "Failed to analyze link.");
    }
  };

  const handleAudioReady = (file: File, level: AnalysisLevel) => {
    processAudio(file, level);
  };

  const handleLinkReady = (url: string, level: AnalysisLevel) => {
    processLink(url, level);
  }

  const handleReset = () => {
    setStatus(AnalysisStatus.IDLE);
    setAnalysis(null);
    setMetadata(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed flex flex-col justify-between">
      <div>
        <Hero />
        
        <main className="container mx-auto px-4 pb-12 relative z-10">
          
          {status === AnalysisStatus.IDLE && (
            <AudioInput 
              onAudioReady={handleAudioReady} 
              onLinkReady={handleLinkReady}
              status={status} 
            />
          )}

          {status === AnalysisStatus.PROCESSING_AUDIO && (
            <div className="text-center mt-20">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent mb-4"></div>
              <p className="text-indigo-300 text-lg font-medium">Preparing Audio...</p>
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
              <h2 className="text-2xl font-bold text-white mb-2">Analyzing Harmonics...</h2>
              <div className="text-slate-400 space-y-2">
                <p>Gemini 3 Flash Preview is listening to the audio...</p>
                <p className="text-xs text-indigo-400">
                  Detecting modulations and chord extensions.
                </p>
              </div>
            </div>
          )}

          {status === AnalysisStatus.ERROR && (
            <div className="text-center mt-12 max-w-md mx-auto animate-fade-in">
              <div className="bg-red-900/20 border border-red-500/50 text-red-200 p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-bold mb-2">Analysis Failed</h3>
                <p className="text-sm opacity-90 leading-relaxed">{error}</p>
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
              <AnalysisResult analysis={analysis} metadata={metadata} />
            </div>
          )}

        </main>
      </div>

      <footer className="py-12 text-center text-slate-600 text-sm border-t border-slate-900 bg-slate-950/30 backdrop-blur-sm mt-auto">
        <div className="flex flex-col items-center gap-3">
          <p className="font-semibold text-indigo-400/90 mb-2">CHORD-IA Powered by Gemini 3 Flash Preview</p>
          
          <div className="flex flex-col items-center gap-1">
            <p className="text-slate-400">
              Created by <strong className="text-slate-200">Armin Salazar San Martin</strong> • <span className="text-indigo-500 font-bold tracking-widest">AIWIS</span>
            </p>
            <p className="text-xs text-slate-500">
              Based on an original idea by <span className="text-slate-400">Diego Vega Arancibia</span>
            </p>
          </div>

          <div className="mt-6 flex gap-6 text-xs font-mono text-slate-600">
             <a href="https://www.aiwis.cl" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400 transition-colors border-b border-transparent hover:border-indigo-400">WWW.AIWIS.CL</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;