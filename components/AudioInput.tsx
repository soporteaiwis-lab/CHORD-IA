
import React, { useState, useRef } from 'react';
import { AnalysisStatus, UserTier } from '../types';

interface AudioInputProps {
  onAudioReady: (file: File) => void;
  onLinkReady: (url: string) => void;
  status: AnalysisStatus;
  userTier: UserTier;
}

type Tab = 'upload' | 'mic' | 'link';

export const AudioInput: React.FC<AudioInputProps> = ({ onAudioReady, onLinkReady, status, userTier }) => {
  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [linkUrl, setLinkUrl] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getMaxSize = () => {
    switch(userTier) {
      case 'Premier': return 19.5 * 1024 * 1024;
      case 'Pro': return 15 * 1024 * 1024;
      case 'Basic': default: return 9.5 * 1024 * 1024;
    }
  };

  const MAX_FILE_SIZE = getMaxSize();
  const MAX_SIZE_LABEL = `${(MAX_FILE_SIZE / 1024 / 1024).toFixed(1)}MB`;
  const isDisabled = status !== AnalysisStatus.IDLE && status !== AnalysisStatus.COMPLETE && status !== AnalysisStatus.ERROR;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      e.target.value = '';
      if (file.size > MAX_FILE_SIZE) {
        alert(`File too large for ${userTier}. Limit: ${MAX_SIZE_LABEL}`);
        return;
      }
      onAudioReady(file);
    }
  };

  const triggerFileSelect = () => fileInputRef.current?.click();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size > MAX_FILE_SIZE) { alert("Recording too long."); return; }
        const file = new File([blob], "live_recording.webm", { type: 'audio/webm' });
        onAudioReady(file);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      const startTime = Date.now();
      timerRef.current = window.setInterval(() => setRecordingTime(Math.floor((Date.now() - startTime) / 1000)), 1000);
    } catch (err) {
      alert("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrl.trim()) return;
    onLinkReady(linkUrl);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-white/10 shadow-2xl max-w-4xl mx-auto mt-8 relative overflow-hidden">
      
      <div className="flex justify-between items-start mb-6">
        <div>
           <h2 className="text-xl font-bold text-white">Audio Source</h2>
           <p className="text-xs text-slate-400">Select how you want to analyze the harmony.</p>
        </div>
        <div className="text-right">
             <div className={`inline-block px-3 py-1.5 rounded-lg text-xs font-bold border ${userTier === 'Premier' ? 'bg-amber-500/10 border-amber-500/50 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                {userTier} • {MAX_SIZE_LABEL}
             </div>
        </div>
      </div>

      <div className="flex justify-center mb-8 border-b border-white/5 pb-1">
        <div className="flex space-x-8">
          {['upload', 'mic', 'link'].map(tab => (
             <button 
               key={tab}
               onClick={() => setActiveTab(tab as Tab)}
               disabled={isDisabled || isRecording}
               className={`pb-3 text-sm font-bold uppercase transition-all border-b-2 ${activeTab === tab ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
             >
               {tab === 'link' ? 'YouTube/Link' : tab === 'mic' ? 'Microphone' : 'File Upload'}
             </button>
          ))}
        </div>
      </div>

      <div className="min-h-[220px] flex items-center justify-center">
        
        {activeTab === 'upload' && (
          <div className="w-full animate-fade-in text-center">
             <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" ref={fileInputRef} disabled={isDisabled} />
             <button onClick={triggerFileSelect} className="bg-white hover:bg-slate-200 text-slate-900 px-8 py-3 rounded-xl text-sm font-bold tracking-wide shadow-lg transition-all">
                SELECT AUDIO FILE
             </button>
             <p className="text-xs text-slate-500 mt-4">Supports MP3, WAV, M4A, FLAC</p>
          </div>
        )}

        {activeTab === 'mic' && (
          <div className="w-full flex flex-col items-center animate-fade-in">
             {isRecording && <div className="text-red-400 text-3xl font-mono font-bold mb-4">{formatTime(recordingTime)}</div>}
             <button 
               onClick={isRecording ? stopRecording : startRecording} 
               className={`px-8 py-3 rounded-xl text-sm font-bold tracking-wide shadow-lg transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-slate-900'}`}
             >
               {isRecording ? 'STOP & ANALYZE' : 'START RECORDING'}
             </button>
          </div>
        )}

        {activeTab === 'link' && (
          <div className="w-full animate-fade-in max-w-lg">
             <form onSubmit={handleLinkSubmit} className="flex flex-col gap-4">
                <input 
                  type="url"
                  placeholder="https://..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-3 px-4 text-white focus:border-indigo-500 focus:outline-none"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  disabled={isDisabled}
                />
                <button type="submit" disabled={isDisabled || !linkUrl} className="bg-gradient-to-r from-pink-600 to-indigo-600 text-white py-3 rounded-xl font-bold">
                  ANALYZE LINK
                </button>
             </form>
          </div>
        )}

      </div>
    </div>
  );
};
