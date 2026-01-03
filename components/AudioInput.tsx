import React, { useState, useRef, useCallback } from 'react';
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
    <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl p-8 border border-slate-800 shadow-2xl max-w-4xl mx-auto mt-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* File Upload Section */}
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-xl p-8 hover:border-indigo-500 transition-colors group">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-500 group-hover:text-indigo-400 mb-4 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <label className="cursor-pointer text-center">
            <span className="block text-lg font-semibold text-white mb-1">Upload Audio File</span>
            <span className="block text-sm text-slate-400 mb-4">MP3, WAV, M4A, WEBM (Max 9MB)</span>
            <input 
              type="file" 
              accept="audio/*" 
              onChange={handleFileUpload} 
              className="hidden" 
              disabled={isDisabled}
            />
            <span className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${isDisabled ? 'bg-slate-800 text-slate-500' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>
              Select File
            </span>
          </label>
        </div>

        {/* Recording Section */}
        <div className="flex flex-col items-center justify-center border-2 border-slate-700 bg-slate-900 rounded-xl p-8">
          <div className={`relative flex items-center justify-center w-20 h-20 rounded-full mb-6 ${isRecording ? 'animate-pulse bg-red-500/20' : 'bg-slate-800'}`}>
            {isRecording ? (
               <div className="h-8 w-8 bg-red-500 rounded-sm"></div>
            ) : (
               <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </div>
          
          <div className="text-center">
            {isRecording ? (
              <div className="mb-4">
                <span className="text-red-400 font-mono text-xl animate-pulse">● REC {formatTime(recordingTime)}</span>
              </div>
            ) : (
              <h3 className="text-lg font-semibold text-white mb-4">Record Microphone</h3>
            )}
            
            {!isRecording ? (
              <button 
                onClick={startRecording} 
                disabled={isDisabled}
                className={`px-6 py-2 rounded-full font-medium transition-all ${isDisabled ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'}`}
              >
                Start Recording
              </button>
            ) : (
              <button 
                onClick={stopRecording}
                className="px-6 py-2 rounded-full font-medium bg-slate-700 hover:bg-slate-600 text-white transition-all border border-slate-600"
              >
                Stop & Analyze
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};