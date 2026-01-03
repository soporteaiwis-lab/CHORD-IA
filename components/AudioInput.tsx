import React, { useState, useRef } from 'react';
import { AnalysisStatus } from '../types';

interface AudioInputProps {
  onAudioReady: (file: File) => void;
  onLinkReady: (url: string) => void;
  status: AnalysisStatus;
}

const MAX_FILE_SIZE = 9.5 * 1024 * 1024; 
type Tab = 'upload' | 'mic' | 'link';

export const AudioInput: React.FC<AudioInputProps> = ({ onAudioReady, onLinkReady, status }) => {
  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [linkUrl, setLinkUrl] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const isDisabled = status !== AnalysisStatus.IDLE && status !== AnalysisStatus.COMPLETE && status !== AnalysisStatus.ERROR;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      e.target.value = ''; // Reset

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
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size > MAX_FILE_SIZE) {
           alert("Recording is too long. Please record a shorter clip.");
           return;
        }
        const file = new File([blob], "live_recording.webm", { type: 'audio/webm' });
        onAudioReady(file);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      const startTime = Date.now();
      timerRef.current = window.setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access denied. Please check permissions.");
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
    <div className="bg-slate-900/50 backdrop-blur-xl rounded-3xl p-6 md:p-10 border border-white/10 shadow-2xl max-w-4xl mx-auto mt-12 relative overflow-hidden transition-all duration-500">
      
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 rounded-3xl pointer-events-none">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[100px]"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 blur-[100px]"></div>
      </div>

      {/* Tabs */}
      <div className="flex justify-center mb-8 bg-slate-950/50 p-1.5 rounded-full w-fit mx-auto border border-white/5">
        <button 
          onClick={() => setActiveTab('upload')}
          disabled={isDisabled || isRecording}
          className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${activeTab === 'upload' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25' : 'text-slate-400 hover:text-white'}`}
        >
          Upload File
        </button>
        <button 
          onClick={() => setActiveTab('mic')}
          disabled={isDisabled}
          className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${activeTab === 'mic' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25' : 'text-slate-400 hover:text-white'}`}
        >
          Microphone
        </button>
        <button 
          onClick={() => setActiveTab('link')}
          disabled={isDisabled || isRecording}
          className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${activeTab === 'link' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25' : 'text-slate-400 hover:text-white'}`}
        >
          YouTube/Link
        </button>
      </div>

      <div className="min-h-[250px] flex items-center justify-center">
        
        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="w-full animate-fade-in">
             <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-2xl p-8 hover:border-indigo-400 hover:bg-slate-800/30 transition-all duration-300 group">
              <div className="p-4 rounded-full bg-slate-800 mb-4 group-hover:scale-110 transition-transform shadow-xl">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <label className="cursor-pointer text-center w-full">
                <span className="block text-xl font-bold text-white mb-2">Select Audio File</span>
                <span className="block text-sm text-slate-400 mb-6 max-w-xs mx-auto">
                   Supports MP3, WAV, M4A, FLAC from Device, iCloud, or Google Drive
                </span>
                <input 
                  type="file" 
                  // Expanded accept list for better mobile compatibility (Android/iOS)
                  accept="audio/*, .mp3, .wav, .m4a, .ogg, .flac, .aac, .wma, application/ogg" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                  disabled={isDisabled}
                />
                <span className={`inline-block px-8 py-3 rounded-xl text-sm font-bold tracking-wide shadow-lg shadow-indigo-500/20 transition-all transform active:scale-95 ${isDisabled ? 'bg-slate-800 text-slate-500' : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white'}`}>
                  BROWSE FILES
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Microphone Tab */}
        {activeTab === 'mic' && (
          <div className="w-full flex flex-col items-center animate-fade-in">
             <div className={`relative flex items-center justify-center w-32 h-32 rounded-full mb-8 transition-all duration-500 ${isRecording ? 'scale-110' : ''}`}>
               {isRecording && (
                  <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20"></div>
               )}
               <div className={`absolute inset-0 rounded-full ${isRecording ? 'bg-red-500/20' : 'bg-slate-800 border border-slate-700'}`}></div>
               
               {isRecording ? (
                 <div className="h-10 w-10 bg-red-500 rounded sm shadow-[0_0_20px_rgba(239,68,68,0.6)] animate-pulse"></div>
               ) : (
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-indigo-400 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
               )}
            </div>
            
            <div className="text-center w-full relative z-10">
              {isRecording ? (
                <div className="mb-6">
                  <span className="text-red-400 font-mono text-3xl font-bold tabular-nums tracking-widest">{formatTime(recordingTime)}</span>
                  <p className="text-slate-400 text-sm mt-2">Recording in progress...</p>
                </div>
              ) : (
                <p className="text-slate-400 text-sm mb-6 max-w-xs mx-auto">Use your device microphone for real-time analysis.</p>
              )}
              
              {!isRecording ? (
                <button 
                  onClick={startRecording} 
                  disabled={isDisabled}
                  className={`px-8 py-3 rounded-xl text-sm font-bold tracking-wide transition-all transform active:scale-95 shadow-lg ${isDisabled ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-white hover:bg-slate-200 text-slate-900'}`}
                >
                  START RECORDING
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
        )}

        {/* Link Tab */}
        {activeTab === 'link' && (
          <div className="w-full animate-fade-in max-w-lg">
             <form onSubmit={handleLinkSubmit} className="flex flex-col gap-4">
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                   <label className="block text-sm font-medium text-slate-300 mb-2 ml-1">Paste Song Link</label>
                   <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                      </div>
                      <input 
                        type="url"
                        placeholder="https://open.spotify.com/track/..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        required
                        disabled={isDisabled}
                      />
                   </div>
                   <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                      <strong>Note:</strong> Works with YouTube, Spotify, and SoundCloud links. The AI will identify the song from the link and perform a theoretical analysis based on its knowledge base.
                   </p>
                </div>

                <button 
                  type="submit"
                  disabled={isDisabled || !linkUrl}
                  className={`w-full py-3.5 rounded-xl text-sm font-bold tracking-wide shadow-lg transition-all transform active:scale-95 ${isDisabled || !linkUrl ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white shadow-indigo-500/20'}`}
                >
                  ANALYZE LINK
                </button>
             </form>
          </div>
        )}

      </div>
    </div>
  );
};