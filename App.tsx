import React, { useState } from 'react';
import Welcome from './components/Welcome';
import LiveChat from './components/LiveChat';
import FlamesGame from './components/FlamesGame';
import { AppView } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.WELCOME);

  const handleWelcomeComplete = () => {
    setCurrentView(AppView.CHAT);
  };

  const renderContent = () => {
    switch (currentView) {
      case AppView.WELCOME:
        return <Welcome onComplete={handleWelcomeComplete} />;
      case AppView.CHAT:
        return <LiveChat />;
      case AppView.FLAMES:
        return <FlamesGame />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-black text-[#FFD700] flex flex-col font-poppins overflow-hidden">
      {/* Header - Only show after welcome */}
      {currentView !== AppView.WELCOME && (
        <header className="p-4 flex justify-between items-center border-b border-[#333] bg-black/50 backdrop-blur-sm sticky top-0 z-50">
          <h1 className="text-xl font-bold tracking-wider">MAMA AI</h1>
          <div className="text-xs text-gray-500">v2.5 Live</div>
        </header>
      )}

      {/* Main Content Area */}
      <main className="flex-grow relative">
        {renderContent()}
      </main>

      {/* Navigation - Only show after welcome */}
      {currentView !== AppView.WELCOME && (
        <nav className="p-4 pb-8 border-t border-[#333] bg-black z-50">
          <div className="flex justify-center space-x-6">
            <button
              onClick={() => setCurrentView(AppView.CHAT)}
              className={`px-6 py-2 rounded-full transition-all duration-300 ${
                currentView === AppView.CHAT
                  ? 'bg-[#FFD700] text-black font-bold shadow-[0_0_15px_rgba(255,215,0,0.4)]'
                  : 'border border-[#333] text-gray-400 hover:border-[#FFD700] hover:text-[#FFD700]'
              }`}
            >
              Voice Chat
            </button>
            <button
              onClick={() => setCurrentView(AppView.FLAMES)}
              className={`px-6 py-2 rounded-full transition-all duration-300 ${
                currentView === AppView.FLAMES
                  ? 'bg-[#FFD700] text-black font-bold shadow-[0_0_15px_rgba(255,215,0,0.4)]'
                  : 'border border-[#333] text-gray-400 hover:border-[#FFD700] hover:text-[#FFD700]'
              }`}
            >
              Flames Game
            </button>
          </div>
        </nav>
      )}
    </div>
  );
};

export default App;
