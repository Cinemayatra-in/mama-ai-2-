
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../utils/audio';

// Configuration Types
type Language = 'English' | 'Hindi' | 'Tamil' | 'Telugu' | 'Malayalam' | 'Kannada';
type Mode = 'mama' | 'love';

const LANGUAGES: Language[] = ['English', 'Hindi', 'Tamil', 'Telugu', 'Malayalam', 'Kannada'];
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

const LiveChat: React.FC = () => {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTalking, setIsTalking] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  
  // Setup State
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);
  const [selectedMode, setSelectedMode] = useState<Mode>('mama');

  // Refs
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const aiClientRef = useRef<GoogleGenAI | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const userInitiatedDisconnect = useRef<boolean>(false);

  // Helper: Friendly Error Messages
  const getFriendlyErrorMessage = (err: any) => {
    const msg = (err.message || err.toString()).toLowerCase();
    if (msg.includes("401") || msg.includes("unauthenticated") || msg.includes("api key")) {
      return "Authentication failed. Please check your API Key configuration.";
    }
    if (msg.includes("403") || msg.includes("permission denied")) {
      return "Access denied. Your API Key may not have permission to use this model.";
    }
    if (msg.includes("503") || msg.includes("unavailable") || msg.includes("overloaded")) {
      return "Service is temporarily unavailable. Please try again later.";
    }
    if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch")) {
      return "Network error. Please check your internet connection.";
    }
    if (msg.includes("microphone") || msg.includes("media device")) {
      return "Microphone access denied or not found.";
    }
    return `Connection error: ${msg}`;
  };

  // Cleanup
  const stopSession = useCallback(() => {
    userInitiatedDisconnect.current = true;
    
    // Close Audio Contexts
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
      inputAudioContextRef.current.close().catch(console.error);
    }
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
      outputAudioContextRef.current.close().catch(console.error);
    }
    
    // Stop Media Stream Tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Disconnect Nodes
    try {
      processorRef.current?.disconnect();
      inputSourceRef.current?.disconnect();
    } catch (e) {
      console.warn("Error disconnecting audio nodes:", e);
    }

    // Stop all currently playing audio sources
    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) { /* ignore */ }
    });
    sourcesRef.current.clear();

    // Reset Refs
    inputAudioContextRef.current = null;
    outputAudioContextRef.current = null;
    streamRef.current = null;
    processorRef.current = null;
    sessionPromiseRef.current = null;
    nextStartTimeRef.current = 0;
    
    // Reset UI State
    setConnected(false);
    setIsTalking(false);
    setIsRetrying(false);
  }, []);

  // Ensure cleanup on unmount
  useEffect(() => {
    return () => stopSession();
  }, [stopSession]);

  const getSystemInstruction = (lang: Language, mode: Mode) => {
    if (mode === 'mama') {
      return `
        You are "Mama", a wise, warm, and caring Indian man (like a supportive uncle or grandfather). 
        You speak ${lang}. 
        Your tone is grounded, respectful, and wise. 
        You give empathetic advice on life, personal growth, and general ideas.
        CRITICAL: Your voice is MALE. Speak ONLY in ${lang}. Be a good listener.
      `;
    } else {
      return `
        You are "Priya", a sweet, realistic Indian girl. 
        You are helping the user practice "Love Speaking" or simply having a romantic, affectionate conversation.
        You speak ${lang}.
        Your tone is soft, slightly shy but engaging, and very affectionate.
        CRITICAL: Your voice is FEMALE. Speak ONLY in ${lang}. Act like a loving partner or girlfriend.
      `;
    }
  };

  const startSession = async () => {
    if (!selectedLanguage) {
      setError("Please select a language first.");
      return;
    }
    
    setError(null);
    userInitiatedDisconnect.current = false;
    
    try {
      if (!process.env.API_KEY) {
        throw new Error("API Key is missing. Please check your .env file, environment variables, or application configuration.");
      }

      // Initialize SDK
      aiClientRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Initialize Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!inputAudioContextRef.current) {
        inputAudioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
      }
      if (!outputAudioContextRef.current) {
        outputAudioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
      }

      // Get User Media
      if (!streamRef.current || !streamRef.current.active) {
         const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
         streamRef.current = stream;
      }

      // Start Connection Loop
      await connectWithRetry(0);

    } catch (e: any) {
      console.error("Setup Error:", e);
      setError(getFriendlyErrorMessage(e));
      stopSession();
    }
  };

  const connectWithRetry = async (attempt: number) => {
    try {
      if (attempt > 0) {
        setIsRetrying(true);
        setError(`Connection lost. Retrying... (${attempt}/${MAX_RETRIES})`);
      }

      const voiceName = selectedMode === 'mama' ? 'Puck' : 'Kore';
      const instruction = getSystemInstruction(selectedLanguage!, selectedMode);

      console.log(`Starting session (Attempt ${attempt + 1}): Mode=${selectedMode}, Voice=${voiceName}, Lang=${selectedLanguage}`);

      // Establish Connection
      const sessionPromise = aiClientRef.current!.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: async () => {
            console.log('Gemini Live Connected');
            setConnected(true);
            setIsRetrying(false);
            setError(null);
            
            // Resume contexts if suspended
            if (inputAudioContextRef.current?.state === 'suspended') {
              await inputAudioContextRef.current.resume();
            }
            if (outputAudioContextRef.current?.state === 'suspended') {
              await outputAudioContextRef.current.resume();
            }

            if (!inputAudioContextRef.current || !streamRef.current) return;
            
            // Setup Input Pipeline (Recreate nodes to ensure freshness)
            try {
              if (inputSourceRef.current) inputSourceRef.current.disconnect();
              if (processorRef.current) processorRef.current.disconnect();
            } catch (e) { /* ignore disconnect errors */ }

            const source = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
            inputSourceRef.current = source;
            
            const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              
              sessionPromiseRef.current?.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              }).catch((err) => {
                  // Silent catch for send errors during disconnects
              });
            };

            source.connect(processor);
            processor.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const outputCtx = outputAudioContextRef.current;
            if (!outputCtx) return;

            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              setIsTalking(true);
              const currentTime = outputCtx.currentTime;
              if (nextStartTimeRef.current < currentTime) {
                  nextStartTimeRef.current = currentTime;
              }

              try {
                const audioData = base64ToUint8Array(base64Audio);
                const audioBuffer = await decodeAudioData(audioData, outputCtx, 24000, 1);
                
                const source = outputCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputCtx.destination);
                
                source.addEventListener('ended', () => {
                  sourcesRef.current.delete(source);
                  if (sourcesRef.current.size === 0) {
                    setIsTalking(false);
                  }
                });

                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
              } catch (decodeErr) {
                console.error("Audio decode error:", decodeErr);
              }
            }

            if (message.serverContent?.interrupted) {
               console.log("Model interrupted");
               sourcesRef.current.forEach(src => {
                 try { src.stop(); } catch (e) {}
               });
               sourcesRef.current.clear();
               nextStartTimeRef.current = 0;
               setIsTalking(false);
            }
          },
          onclose: (event) => {
            console.log('Gemini Live Closed', event);
            setConnected(false);
            setIsTalking(false);
          },
          onerror: (err) => {
            console.error('Gemini Live WebSocket Error:', err);
            // WebSocket errors usually lead to onclose, but we can flag it here
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: instruction,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } }
          }
        }
      });
      
      sessionPromiseRef.current = sessionPromise;
      await sessionPromise;

    } catch (err: any) {
      console.error(`Connection attempt ${attempt + 1} failed:`, err);
      
      // Determine if we should retry
      const isFatal = 
        err.message?.includes("401") || 
        err.message?.includes("API key") || 
        err.message?.includes("Permission denied");
      
      if (!isFatal && attempt < MAX_RETRIES && !userInitiatedDisconnect.current) {
        setTimeout(() => connectWithRetry(attempt + 1), RETRY_DELAY_MS);
      } else {
        setIsRetrying(false);
        setError(getFriendlyErrorMessage(err));
        stopSession();
      }
    }
  };

  // Render Setup Screen if not connected
  if (!connected && !isRetrying) {
    return (
      <div className="flex flex-col items-center justify-start h-full w-full p-6 text-center overflow-y-auto">
        <h2 className="text-3xl font-bold mb-6 text-[#FFD700] tracking-wide">Configure Your Call</h2>
        
        {/* Language Selection */}
        <div className="w-full max-w-md mb-8">
          <label className="block text-left text-sm uppercase tracking-wider text-gray-400 mb-3">
            1. What language do you speak?
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                onClick={() => setSelectedLanguage(lang)}
                className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                  selectedLanguage === lang
                    ? 'bg-[#FFD700] text-black border-[#FFD700] shadow-[0_0_10px_rgba(255,215,0,0.3)]'
                    : 'bg-[#1a1a1a] text-gray-300 border-[#333] hover:border-[#FFD700]'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        {/* Mode Selection */}
        <div className="w-full max-w-md mb-10">
          <label className="block text-left text-sm uppercase tracking-wider text-gray-400 mb-3">
            2. Choose your Partner
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setSelectedMode('mama')}
              className={`p-6 rounded-xl border flex flex-col items-center justify-center gap-3 transition-all ${
                selectedMode === 'mama'
                  ? 'bg-[#1a1a1a] border-[#FFD700] ring-1 ring-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.2)]'
                  : 'bg-[#0a0a0a] border-[#333] hover:border-gray-500'
              }`}
            >
              <span className="text-4xl">👳🏾‍♂️</span>
              <div className="text-center">
                <div className="font-bold text-[#FFD700]">Talk to Mama</div>
                <div className="text-xs text-gray-400 mt-1">Wise Indian Uncle<br/>(Male Voice)</div>
              </div>
            </button>

            <button
              onClick={() => setSelectedMode('love')}
              className={`p-6 rounded-xl border flex flex-col items-center justify-center gap-3 transition-all ${
                selectedMode === 'love'
                  ? 'bg-[#1a1a1a] border-[#FFD700] ring-1 ring-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.2)]'
                  : 'bg-[#0a0a0a] border-[#333] hover:border-gray-500'
              }`}
            >
              <span className="text-4xl">👩🏾</span>
              <div className="text-center">
                <div className="font-bold text-[#FFD700]">Love Practice</div>
                <div className="text-xs text-gray-400 mt-1">Realistic Girl<br/>(Female Voice)</div>
              </div>
            </button>
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={startSession}
          disabled={!selectedLanguage}
          className={`w-full max-w-xs px-8 py-4 rounded-full font-bold text-lg tracking-widest uppercase transition transform ${
            selectedLanguage
              ? 'bg-[#FFD700] text-black hover:bg-yellow-400 hover:scale-105 shadow-lg shadow-yellow-900/40'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}
        >
          Start Conversation
        </button>

        {error && (
          <div className="mt-6 p-3 bg-red-900/30 border border-red-500 text-red-200 text-sm rounded-lg animate-fade-in">
            {error}
          </div>
        )}
      </div>
    );
  }

  // Active Session View (or Retrying)
  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-6 text-center">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-2 text-[#FFD700]">
          {selectedMode === 'mama' ? 'Talking to Mama' : 'Love Practice'}
        </h2>
        <p className="text-gray-400 text-sm max-w-md mx-auto">
          {selectedMode === 'mama' ? 'Mama is listening...' : 'Priya is listening...'} ({selectedLanguage})
        </p>
      </div>

      <div className={`relative w-48 h-48 flex items-center justify-center rounded-full border-4 border-[#FFD700] transition-all duration-300 ${connected ? 'opacity-100' : 'opacity-50'}`}>
        {connected && (
          <div className={`absolute inset-0 rounded-full bg-[#FFD700] opacity-20 ${isTalking ? 'animate-pulse-gold' : ''}`}></div>
        )}
        <div className="z-10 text-6xl">
          {selectedMode === 'mama' 
             ? (isTalking ? '👳🏾‍♂️' : '👂') 
             : (isTalking ? '👩🏾' : '💕')
          }
        </div>
      </div>
      
      {/* Status / Error Message Display */}
      <div className="h-16 mt-8 flex items-center justify-center">
        {isRetrying ? (
            <span className="text-[#FFD700] animate-pulse">Reconnecting... {error && `(${error})`}</span>
        ) : error ? (
            <span className="text-red-400">{error}</span>
        ) : (
            <span className="text-gray-500 text-sm">Tap "End Call" to finish</span>
        )}
      </div>

      <div className="mt-4 space-y-4">
        <button
          onClick={stopSession}
          className="px-8 py-3 rounded-full border-2 border-red-500 text-red-500 font-bold text-lg hover:bg-red-500 hover:text-white transition"
        >
          End Call
        </button>
      </div>
    </div>
  );
};

export default LiveChat;
