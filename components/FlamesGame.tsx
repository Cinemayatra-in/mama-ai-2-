import React, { useState } from 'react';
import { FlamesResult } from '../types';

const FlamesGame: React.FC = () => {
  const [name1, setName1] = useState('');
  const [name2, setName2] = useState('');
  const [result, setResult] = useState<FlamesResult | null>(null);

  const calculateFlames = () => {
    if (!name1.trim() || !name2.trim()) return;

    const n1 = name1.toLowerCase().replace(/\s+/g, '').split('');
    const n2 = name2.toLowerCase().replace(/\s+/g, '').split('');

    // Remove common characters
    for (let i = 0; i < n1.length; i++) {
      const index = n2.indexOf(n1[i]);
      if (index !== -1) {
        n1[i] = '*'; // Mark as removed
        n2[index] = '*';
      }
    }

    const count = n1.filter(c => c !== '*').length + n2.filter(c => c !== '*').length;
    
    const flames = ['Friends', 'Lovers', 'Affection', 'Marriage', 'Enemies', 'Siblings'];
    const descriptions = [
      "A solid friendship is the foundation of everything good.",
      "Passion is in the air! A romantic connection.",
      "There is a sweet fondness and liking between you two.",
      "Destiny points towards a lifelong commitment.",
      "Uh oh! You might rub each other the wrong way.",
      "A bond as deep as family, or soulmates in disguise."
    ];

    // FLAMES Logic: simple modulo for this demo, 
    // real FLAMES usually iterates removing letters, but modulo is common for simple web apps
    // Correct FLAMES elimination logic:
    let flameArr = [...flames];
    let step = 0;
    
    // Traditional elimination logic
    /* 
       Usually FLAMES removes the Nth item repeatedly. 
       For simplicity and UX speed in this demo, we use (count % 6) logic 
       or the standard elimination if needed. Let's use simple modulo for predictable 'web toy' behavior
       unless user specifically wants strict recursive elimination.
       Let's use (count % 6) mapping for simplicity.
    */
    
    // Actually, let's do the proper elimination to be authentic to the "Game" feel
    // Length > 0 check
    let splitFlames = ['F', 'L', 'A', 'M', 'E', 'S'];
    let finalChar = '';
    
    if (count > 0) {
        let activeFlames = [...splitFlames];
        let idx = 0;
        while(activeFlames.length > 1) {
            idx = (idx + count - 1) % activeFlames.length;
            activeFlames.splice(idx, 1);
        }
        finalChar = activeFlames[0];
    } else {
        // Same names -> usually implies something special or 'Siblings' depending on region.
        finalChar = 'S'; 
    }

    let status = '';
    let desc = '';
    
    switch(finalChar) {
        case 'F': status = 'Friends'; desc = descriptions[0]; break;
        case 'L': status = 'Lovers'; desc = descriptions[1]; break;
        case 'A': status = 'Affection'; desc = descriptions[2]; break;
        case 'M': status = 'Marriage'; desc = descriptions[3]; break;
        case 'E': status = 'Enemies'; desc = descriptions[4]; break;
        case 'S': status = 'Siblings'; desc = descriptions[5]; break;
        default: status = 'Unknown'; desc = "The stars are confused.";
    }

    setResult({ status, description: desc, score: count });
  };

  const reset = () => {
    setName1('');
    setName2('');
    setResult(null);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-6 text-[#FFD700]">
      <h2 className="text-3xl font-bold mb-8 tracking-widest border-b-2 border-[#FFD700] pb-2">FLAMES</h2>
      
      {!result ? (
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2">
            <label className="text-sm uppercase tracking-wider opacity-80">Your Name</label>
            <input
              type="text"
              value={name1}
              onChange={(e) => setName1(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#333] focus:border-[#FFD700] rounded-lg p-4 text-white outline-none transition"
              placeholder="Enter name..."
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm uppercase tracking-wider opacity-80">Partner's Name</label>
            <input
              type="text"
              value={name2}
              onChange={(e) => setName2(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#333] focus:border-[#FFD700] rounded-lg p-4 text-white outline-none transition"
              placeholder="Enter name..."
            />
          </div>

          <button
            onClick={calculateFlames}
            className="w-full mt-8 bg-[#FFD700] text-black font-bold py-4 rounded-lg hover:bg-yellow-400 transition transform active:scale-95 uppercase tracking-widest"
          >
            Calculate Relationship
          </button>
        </div>
      ) : (
        <div className="text-center animate-fade-in space-y-6 max-w-md">
          <div className="text-6xl mb-4">
             {result.status === 'Lovers' || result.status === 'Marriage' ? '❤️' : 
              result.status === 'Enemies' ? '⚔️' : 
              result.status === 'Friends' ? '🤝' : '✨'}
          </div>
          <h3 className="text-4xl font-bold text-white">{result.status}</h3>
          <p className="text-lg opacity-90 leading-relaxed">{result.description}</p>
          <div className="mt-8 text-sm text-gray-500">
             Overlap Score: {result.score}
          </div>
          <button
            onClick={reset}
            className="mt-8 px-8 py-3 border border-[#FFD700] text-[#FFD700] rounded-full hover:bg-[#FFD700] hover:text-black transition"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};

export default FlamesGame;
