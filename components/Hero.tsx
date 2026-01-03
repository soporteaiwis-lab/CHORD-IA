import React from 'react';

export const Hero: React.FC = () => {
  return (
    <div className="relative overflow-hidden py-12 text-center sm:py-24">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(45rem_50rem_at_top,theme(colors.indigo.900),theme(colors.slate.950))] opacity-50" />
      <div className="absolute inset-y-0 right-1/2 -z-10 mr-16 w-[200%] origin-bottom-left skew-x-[-30deg] bg-slate-950 shadow-xl shadow-indigo-600/10 ring-1 ring-indigo-50/5 sm:mr-28 lg:mr-0 lg:w-full lg:origin-center lg:-skew-x-[30deg]" />
      
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
            CHORD-IA
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-300">
            Advanced AI Harmony Analysis. Detect complex chords, modulations, and tensions from any audio source with virtuoso precision.
          </p>
        </div>
      </div>
    </div>
  );
};