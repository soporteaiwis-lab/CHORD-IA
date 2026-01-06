
import React, { useEffect, useRef, useState } from 'react';

interface TunerProps {
  onClose: () => void;
}

const NOTE_STRINGS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const Tuner: React.FC<TunerProps> = ({ onClose }) => {
  const [note, setNote] = useState<string>("--");
  const [cents, setCents] = useState<number>(0);
  const [frequency, setFrequency] = useState<number>(0);
  const [isActive, setIsActive] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const requestRef = useRef<number | null>(null);

  // Autocorrelation algorithm to detect pitch
  const autoCorrelate = (buf: Float32Array, sampleRate: number) => {
    let size = buf.length;
    let rms = 0;

    for (let i = 0; i < size; i++) {
      const val = buf[i];
      rms += val * val;
    }
    rms = Math.sqrt(rms / size);

    // Noise gate
    if (rms < 0.01) return -1;

    let r1 = 0, r2 = size - 1, thres = 0.2;
    for (let i = 0; i < size / 2; i++) {
      if (Math.abs(buf[i]) < thres) { r1 = i; break; }
    }
    for (let i = 1; i < size / 2; i++) {
      if (Math.abs(buf[size - i]) < thres) { r2 = size - i; break; }
    }

    buf = buf.slice(r1, r2);
    size = buf.length;

    const c = new Array(size).fill(0);
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size - i; j++) {
        c[i] = c[i] + buf[j] * buf[j + i];
      }
    }

    let d = 0;
    while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < size; i++) {
      if (c[i] > maxval) {
        maxval = c[i];
        maxpos = i;
      }
    }
    let T0 = maxpos;

    // Parabolic interpolation for better precision
    const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a) T0 = T0 - b / (2 * a);

    return sampleRate / T0;
  };

  const updatePitch = () => {
    if (!analyserRef.current || !audioContextRef.current) return;
    
    const buffer = new Float32Array(2048); // Size suitable for pitch detection
    analyserRef.current.getFloatTimeDomainData(buffer);
    
    const freq = autoCorrelate(buffer, audioContextRef.current.sampleRate);

    if (freq !== -1) {
      const noteNum = 12 * (Math.log(freq / 440) / Math.log(2)) + 69;
      const noteIndex = Math.round(noteNum) % 12;
      const closestNote = NOTE_STRINGS[noteIndex];
      
      // Calculate cents deviation
      const closestNoteFreq = 440 * Math.pow(2, (Math.round(noteNum) - 69) / 12);
      const centDiff = Math.floor(1200 * Math.log2(freq / closestNoteFreq));

      setFrequency(Math.round(freq));
      setNote(closestNote);
      setCents(centDiff);
    }

    requestRef.current = requestAnimationFrame(updatePitch);
  };

  const startTuner = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 4096; // Higher resolution
      
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);
      
      setIsActive(true);
      updatePitch();
    } catch (err) {
      console.error("Tuner Error", err);
      alert("Microphone access is required for the tuner.");
    }
  };

  const stopTuner = () => {
    if (sourceRef.current) sourceRef.current.disconnect();
    if (audioContextRef.current) audioContextRef.current.close();
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    setIsActive(false);
  };

  useEffect(() => {
    startTuner();
    return () => stopTuner();
  }, []);

  // Visual calculations
  const needleRotation = Math.max(-45, Math.min(45, cents)); // Clamp between -45 and 45 degrees
  const isInTune = Math.abs(cents) < 5;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 rounded-3xl border border-slate-700 p-8 shadow-2xl">
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
        >
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-black text-white uppercase tracking-widest">Calibration Tuner</h2>
          <p className="text-slate-500 text-xs mt-1">Standard Concert Pitch A = 440Hz</p>
        </div>

        {/* Display */}
        <div className="flex flex-col items-center justify-center mb-8">
           <div className={`text-8xl font-black mb-4 transition-colors ${isInTune ? 'text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]' : 'text-white'}`}>
             {note || "--"}
           </div>
           <div className="flex items-center gap-4 text-slate-400 font-mono">
              <span className="bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">{frequency} Hz</span>
              <span className={`px-3 py-1 rounded-lg border ${isInTune ? 'bg-emerald-900/30 border-emerald-500/30 text-emerald-400' : 'bg-slate-800 border-slate-700'}`}>
                {cents > 0 ? '+' : ''}{cents} cents
              </span>
           </div>
        </div>

        {/* Needle Gauge */}
        <div className="relative h-32 w-full overflow-hidden mb-6">
          {/* Arc */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-32 border-[20px] border-slate-800 rounded-t-full border-b-0"></div>
          
          {/* Center Marker */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-8 bg-emerald-500 z-10"></div>
          
          {/* Needle */}
          <div 
            className="absolute bottom-0 left-1/2 w-1 h-28 bg-white origin-bottom rounded-full transition-transform duration-100 ease-out z-20 shadow-[0_0_10px_white]"
            style={{ transform: `translateX(-50%) rotate(${needleRotation}deg)` }}
          ></div>
          
          {/* Labels */}
          <div className="absolute bottom-2 left-10 text-xs font-bold text-slate-600">-50</div>
          <div className="absolute bottom-2 right-10 text-xs font-bold text-slate-600">+50</div>
        </div>

        <div className="text-center">
            <div className={`inline-block px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-all ${isInTune ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-500'}`}>
                {isInTune ? 'PERFECTLY TUNED' : 'TUNING...'}
            </div>
        </div>

      </div>
    </div>
  );
};
