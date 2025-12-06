import { useState } from 'react';
import { AudioProvider } from './audio/AudioContext';
import Dashboard from './components/Dashboard';
import KeyFinderModule from './components/KeyFinderModule';
import { Mic2, Search } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'keyfinder'

  return (
    <AudioProvider>
      <div className="min-h-screen text-white selection:bg-cyan-500/30">

        {/* Top Header - iPhone Style */}
        <nav className="fixed top-0 left-0 right-0 z-40 px-6 py-4 flex items-center justify-center bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
          <h1 className="text-lg font-bold neon-text tracking-tighter drop-shadow-md pointer-events-auto bg-black/20 backdrop-blur-md px-4 py-1 rounded-full border border-white/5">
            SINGERS DREAMS
          </h1>
        </nav>

        {/* Content Area */}
        <div className="pt-0 pb-32 min-h-screen">
          {activeTab === 'dashboard' ? <Dashboard /> : <KeyFinderModule />}
        </div>

        {/* Bottom Floating Dock - iOS Style */}
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-sm px-4">
          <div className="flex bg-black/60 backdrop-blur-2xl rounded-full p-1.5 border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)] ring-1 ring-white/10 justify-between">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-full text-xs font-bold transition-all duration-300
                    ${activeTab === 'dashboard'
                  ? 'bg-gradient-to-r from-cyan-500/90 to-blue-600/90 text-white shadow-lg shadow-cyan-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <Mic2 className="w-4 h-4" />
              Live
            </button>
            <button
              onClick={() => setActiveTab('keyfinder')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-full text-xs font-bold transition-all duration-300
                    ${activeTab === 'keyfinder'
                  ? 'bg-gradient-to-r from-purple-500/90 to-pink-600/90 text-white shadow-lg shadow-purple-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <Search className="w-4 h-4" />
              Finder
            </button>
          </div>
        </div>

      </div>
    </AudioProvider>
  );
}

export default App;
