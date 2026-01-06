
import React, { useState } from 'react';

interface LoginProps {
  onLogin: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  // Pre-filled default values as requested
  const [username, setUsername] = useState('soporte.aiwis@gmail.com');
  const [password, setPassword] = useState('aiwis');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.toLowerCase().trim();
    const cleanPass = password.trim();

    if (cleanUser === 'soporte.aiwis@gmail.com' && cleanPass === 'aiwis') {
      onLogin();
    } else {
      setError('Invalid credentials. Please use the default support account.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] px-4">
      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl p-8 rounded-3xl border border-indigo-500/30 shadow-2xl shadow-indigo-500/20 animate-fade-in relative overflow-hidden">
        
        {/* Background glow */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-indigo-500 rounded-full blur-3xl opacity-20"></div>
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-32 h-32 bg-purple-500 rounded-full blur-3xl opacity-20"></div>

        <div className="relative z-10 text-center mb-8">
          <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 mb-2">
            CHORD-IA
          </h1>
          <p className="text-slate-400 text-sm font-medium tracking-wide uppercase">
            Advanced Harmony Intelligence
          </p>
        </div>

        <form onSubmit={handleLogin} className="relative z-10 space-y-6">
          <div>
            <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">User Access</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              placeholder="Username"
            />
          </div>
          
          <div>
            <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Security Key</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              placeholder="•••••"
            />
          </div>

          {error && (
            <div className="text-red-400 text-xs bg-red-900/20 p-2 rounded border border-red-500/30 text-center">
              {error}
            </div>
          )}

          <button 
            type="submit"
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/25 transition-all transform active:scale-95"
          >
            ENTER PLATFORM
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-500 mb-2">Default Credentials:</p>
          <div className="inline-flex flex-col gap-1 text-xs font-mono text-indigo-400 bg-indigo-900/10 px-4 py-2 rounded-lg border border-indigo-500/20">
            <span>User: <strong>soporte.aiwis@gmail.com</strong></span>
            <span>Pass: <strong>aiwis</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
