
import React from 'react';
import { UserTier } from '../types';

interface PricingPlansProps {
  currentTier: UserTier;
  onSelectTier: (tier: UserTier) => void;
  onClose: () => void;
}

export const PricingPlans: React.FC<PricingPlansProps> = ({ currentTier, onSelectTier, onClose }) => {
  const tiers = [
    {
      name: 'Basic',
      id: 'Basic',
      price: 'Free',
      limit: '9.5 MB',
      features: [
        { name: 'Basic Triad Analysis', available: true },
        { name: 'Root Movement Detection', available: true },
        { name: 'Extensions (7, 9, 13)', available: false },
        { name: 'Complex Jazz Harmony', available: false },
        { name: 'Priority Processing', available: false },
      ],
      color: 'border-slate-600'
    },
    {
      name: 'Pro',
      id: 'Pro',
      price: '$9.99/mo',
      limit: '15 MB',
      features: [
        { name: 'Basic Triad Analysis', available: true },
        { name: 'Root Movement Detection', available: true },
        { name: 'Extensions (7ths)', available: true },
        { name: 'Complex Jazz Harmony', available: false },
        { name: 'Priority Processing', available: true },
      ],
      color: 'border-indigo-500 shadow-indigo-500/20'
    },
    {
      name: 'Premier',
      id: 'Premier',
      price: '$19.99/mo',
      limit: '19.5 MB',
      features: [
        { name: 'Basic Triad Analysis', available: true },
        { name: 'Root Movement Detection', available: true },
        { name: 'Full Extensions (9, 11, 13)', available: true },
        { name: 'Complex Jazz Harmony', available: true },
        { name: 'Priority Processing', available: true },
      ],
      color: 'border-amber-500 shadow-amber-500/20'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
      <div className="max-w-5xl w-full bg-slate-900 rounded-3xl border border-slate-700 p-8 relative overflow-y-auto max-h-[90vh]">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
        >
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center mb-10">
          <h2 className="text-3xl font-black text-white mb-2">Upgrade Your Analysis</h2>
          <p className="text-slate-400">Unlock larger files and deeper harmonic intelligence.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {tiers.map((tier) => {
            const isSelected = currentTier === tier.id;
            const isPremier = tier.id === 'Premier';
            
            return (
              <div 
                key={tier.name}
                className={`relative flex flex-col p-6 rounded-2xl border-2 transition-all duration-300 ${isSelected ? `bg-slate-800 scale-105 ${tier.color}` : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}
              >
                {isPremier && (
                   <div className="absolute top-0 right-0 bg-amber-500 text-black text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-lg">
                     BEST VALUE
                   </div>
                )}

                <div className="mb-4">
                  <h3 className={`text-xl font-bold ${tier.id === 'Premier' ? 'text-amber-400' : tier.id === 'Pro' ? 'text-indigo-400' : 'text-slate-300'}`}>
                    {tier.name}
                  </h3>
                  <div className="text-3xl font-black text-white mt-2">{tier.price}</div>
                  <div className="text-sm text-slate-500 mt-1">File Limit: {tier.limit}</div>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-sm">
                      {feature.available ? (
                        <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      ) : (
                        <svg className="w-5 h-5 text-slate-700 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                      )}
                      <span className={feature.available ? 'text-slate-300' : 'text-slate-600'}>{feature.name}</span>
                    </li>
                  ))}
                </ul>

                <button 
                  onClick={() => {
                      onSelectTier(tier.id as UserTier);
                      onClose();
                  }}
                  className={`w-full py-3 rounded-xl font-bold transition-all ${
                    isSelected 
                    ? 'bg-slate-700 text-white cursor-default' 
                    : tier.id === 'Premier' 
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black shadow-lg shadow-amber-500/20' 
                        : tier.id === 'Pro' 
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white' 
                            : 'bg-slate-800 hover:bg-slate-700 text-white'
                  }`}
                >
                  {isSelected ? 'Current Plan' : 'Select Plan'}
                </button>
              </div>
            );
          })}
        </div>
        
        <div className="mt-8 text-center text-xs text-slate-500">
           Note: Direct file analysis is limited to ~19.5MB due to browser constraints. Larger files require Cloud Storage integration (Enterprise).
        </div>
      </div>
    </div>
  );
};
