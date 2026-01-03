import React, { useState, useRef } from 'react';
import { AnalysisStatus } from '../types';

interface AudioInputProps {
  onAudioReady: (file: File) => void;
  status: AnalysisStatus;
}

// 9.5 MB limit to be safe (Base64 adds ~33% overhead, keeping it under 20MB payload limit)
const MAX_FILE_SIZE = 9.5 * 1024 * 1024; 

export const AudioInput: React.FC<AudioInputProps> = ({ onAudioReady, status }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Reset input value so same file can be selected again if needed
      e.target.value = '';

      if (file.size > MAX_FILE_SIZE) {
        alert("File is too large. Please upload an audio file smaller than 9.5MB for AI processing.");
        return;
      }
      onAudioReady(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        // Check recording size approx
        if (blob.size > MAX_FILE_SIZE) {
           alert("Recording is too long/large. Please record a shorter clip.");
           return;
        }
        const file = new File([blob], "recording.webm", { type: 'audio/webm' });
        onAudioReady(file);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      // Timer
      const startTime = Date.now();
      timerRef.current = window.setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access denied or not available.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        setRecordingTime(0);
      }
    }
  };

  const isDisabled = status !== AnalysisStatus.IDLE && status !== AnalysisStatus.COMPLETE && status !== AnalysisStatus.ERROR;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl rounded-3xl p-10 border border-white/10 shadow-2xl max-w-5xl mx-auto mt-12 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 rounded-3xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[100px]"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 blur-[100px]"></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        
        {/* File Upload Section */}
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-2xl p-8 hover:border-indigo-400 hover:bg-slate-800/30 transition-all duration-300 group h-64">
          <div className="p-4 rounded-full bg-slate-800 mb-4 group-hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <label className="cursor-pointer text-center w-full">
            <span className="block text-xl font-bold text-white mb-2">Upload Audio</span>
            <span className="block text-sm text-slate-400 mb-6">MP3, WAV, M4A (Max 9MB)</span>
            <input 
              type="file" 
              accept="audio/*" 
              onChange={handleFileUpload} 
              className="hidden" 
              disabled={isDisabled}
            />
            <span className={`inline-block px-8 py-3 rounded-xl text-sm font-bold tracking-wide shadow-lg shadow-indigo-500/20 transition-all transform active:scale-95 ${isDisabled ? 'bg-slate-800 text-slate-500' : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white'}`}>
              SELECT FILE
            </span>
          </label>
        </div>

        {/* Recording Section */}
        <div className="flex flex-col items-center justify-center border-2 border-white/5 bg-gradient-to-b from-slate-800/50 to-slate-900/50 rounded-2xl p-8 h-64 relative overflow-hidden">
          
          <div className={`relative flex items-center justify-center w-24 h-24 rounded-full mb-6 transition-all duration-500 ${isRecording ? 'scale-110' : ''}`}>
             {isRecording && (
                <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20"></div>
             )}
             <div className={`absolute inset-0 rounded-full ${isRecording ? 'bg-red-500/20' : 'bg-slate-800'}`}></div>
             
             {isRecording ? (
               <div className="h-8 w-8 bg-red-500 rounded sm shadow-[0_0_15px_rgba(239,68,68,0.5)]"></div>
             ) : (
               <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-indigo-400 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
             )}
          </div>
          
          <div className="text-center w-full relative z-10">
            {isRecording ? (
              <div className="mb-4">
                <span className="text-red-400 font-mono text-2xl font-bold tabular-nums tracking-widest">{formatTime(recordingTime)}</span>
              </div>
            ) : (
              <h3 className="text-xl font-bold text-white mb-4">Record Live</h3>
            )}
            
            {!isRecording ? (
              <button 
                onClick={startRecording} 
                disabled={isDisabled}
                className={`px-8 py-3 rounded-xl text-sm font-bold tracking-wide transition-all transform active:scale-95 ${isDisabled ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'}`}
              >
                START MIC
              </button>
            ) : (
              <button 
                onClick={stopRecording}
                className="px-8 py-3 rounded-xl text-sm font-bold tracking-wide bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/30 transition-all transform active:scale-95"
              >
                STOP & ANALYZE
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};