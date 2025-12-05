import { useAudio } from '../audio/AudioContext';
import Visualizer from './Visualizer';
import { Mic, Upload, Activity, Music } from 'lucide-react';
import { useRef } from 'react';
import VibratoGraph from './VibratoGraph';

export default function Dashboard() {
    const {
        isListening,
        startMic,
        stopListening,
        handleFileUpload,
        audioData,
        freqData,
        availableDevices,
        selectedDeviceId,
        setSelectedDeviceId,
        inputGain,
        setInputGain,
        noiseGateThreshold,
        setNoiseGateThreshold
    } = useAudio();
    const fileInputRef = useRef(null);

    return (
        <div className="min-h-screen bg-black text-white p-8 flex flex-col items-center justify-center relative overflow-hidden">
            {/* Background ambient light */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-900 rounded-full blur-[150px] opacity-20 pointer-events-none"></div>

            <header className="z-10 mb-12 text-center">
                <h1 className="text-5xl font-bold mb-2 neon-text tracking-tighter">SINGERS DREAMS</h1>
                <p className="text-gray-400">Professional Voice Analysis & Key Detection</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-6xl z-10">
                {/* Main Pitch Display */}
                <div className="glass-panel p-8 flex flex-col items-center justify-center aspect-square md:aspect-auto neon-border transition-all duration-300">
                    <div className="text-center mb-6">
                        <h2 className="text-gray-400 uppercase tracking-widest text-sm mb-2">Current Note</h2>
                        <div className={`text-9xl font-bold transition-colors duration-200 ${audioData.voiceTypeColor}`}>
                            {audioData.note}
                        </div>
                        <div className="mt-2 text-xl font-mono text-gray-300">
                            {audioData.frequency} Hz
                        </div>
                    </div>

                    {/* Cents deviation meter */}
                    <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden mb-4 relative">
                        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white z-10"></div>
                        <div
                            className="h-full transition-all duration-100 ease-linear"
                            style={{
                                width: '10%',
                                backgroundColor: Math.abs(audioData.cents) < 10 ? '#00ff00' : audioData.cents < 0 ? '#3b82f6' : '#ef4444',
                                marginLeft: `${50 + (audioData.cents / 50) * 50}%`,
                                opacity: audioData.note === '-' ? 0 : 1
                            }}
                        ></div>
                    </div>
                    <span className="text-sm text-gray-400">{audioData.cents > 0 ? `+${audioData.cents}` : audioData.cents} cents</span>
                </div>

                {/* Info & Visualizer */}
                <div className="flex flex-col gap-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="glass-panel p-6 flex flex-col items-center justify-center">
                            <Activity className="w-8 h-8 mb-2 text-purple-400" />
                            <span className="text-gray-400 text-sm uppercase">Voice Type</span>
                            <span className={`text-2xl font-bold mt-1 ${audioData.voiceTypeColor}`}>{audioData.voiceType}</span>
                        </div>
                        <div className="glass-panel p-6 flex flex-col items-center justify-center">
                            <Music className="w-8 h-8 mb-2 text-cyan-400" />
                            <span className="text-gray-400 text-sm uppercase">Detailed Key</span>
                            <span className="text-2xl font-bold mt-1 text-cyan-400">{audioData.estimatedKey}</span>
                        </div>
                    </div>

                    {/* Vibrato Meter */}
                    <div className="glass-panel p-4 flex items-center justify-between relative overflow-hidden">
                        <div className="z-10">
                            <h3 className="text-gray-400 text-sm uppercase mb-1">Vibrato</h3>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-2xl font-bold ${audioData.vibrato?.isVibrato ? 'text-green-400' : 'text-gray-600'}`}>
                                    {audioData.vibrato?.isVibrato ? audioData.vibrato.rate : '--'}
                                </span>
                                <span className="text-sm text-gray-500">Hz</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                Depth: {audioData.vibrato?.isVibrato ? audioData.vibrato.depth : 0} cents
                            </div>
                            <div className={`text-xs font-bold mt-1 uppercase tracking-wide ${audioData.vibrato?.color}`}>
                                {audioData.vibrato?.isVibrato ? audioData.vibrato.quality : ''}
                            </div>
                        </div>


                        {/* Wave Visual (Real-time Graph) */}
                        <div className="w-48 h-16 relative flex items-center justify-center bg-black/20 rounded-lg overflow-hidden border border-white/5">
                            <VibratoGraph
                                pitch={audioData.exactMidi}
                                isActive={audioData.frequency > 50}
                            />
                        </div>
                    </div>

                    {/* Visualizer Area */}
                    <div className="glass-panel flex-grow p-4 min-h-[200px] relative">
                        <Visualizer data={freqData} />
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="z-10 mt-12 flex flex-col md:flex-row gap-6 items-center">
                {/* Device Selector */}
                <div className="flex flex-col gap-2 w-full md:w-64">
                    <label className="text-gray-400 text-xs uppercase tracking-wider pl-2">Input Device</label>
                    <select
                        value={selectedDeviceId}
                        onChange={(e) => {
                            setSelectedDeviceId(e.target.value);
                            if (isListening) {
                                stopListening();
                                // Optional: Restart immediately or let user restart?
                                // Let's just stop it so they can restart with new device
                            }
                        }}
                        className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg p-3 focus:border-cyan-500 focus:outline-none transition-colors"
                    >
                        <option value="default">Default</option>
                        {availableDevices.map(device => (
                            <option key={device.deviceId} value={device.deviceId}>
                                {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Audio Settings */}
                <div className="flex gap-4 items-center">
                    <div className="flex flex-col gap-2 w-32">
                        <label className="text-gray-400 text-xs uppercase tracking-wider pl-2 flex justify-between">
                            <span>Gain</span>
                            <span className="text-cyan-400">{inputGain.toFixed(1)}x</span>
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="5"
                            step="0.1"
                            value={inputGain}
                            onChange={(e) => setInputGain(parseFloat(e.target.value))}
                            className="w-full accent-cyan-500 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                    <div className="flex flex-col gap-2 w-32">
                        <label className="text-gray-400 text-xs uppercase tracking-wider pl-2 flex justify-between">
                            <span>Gate</span>
                            <span className="text-red-400">{noiseGateThreshold.toFixed(3)}</span>
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="0.1"
                            step="0.001"
                            value={noiseGateThreshold}
                            onChange={(e) => setNoiseGateThreshold(parseFloat(e.target.value))}
                            className="w-full accent-red-500 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                </div>

                <button
                    onClick={isListening ? stopListening : startMic}
                    className={`flex items-center gap-2 px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 
                    ${isListening ? 'bg-red-500 hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 'bg-cyan-500 hover:bg-cyan-600 shadow-[0_0_20px_rgba(6,182,212,0.5)]'}`}
                >
                    <Mic className="w-6 h-6" />
                    {isListening ? "Stop Listening" : "Start Mic"}
                </button>

                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-8 py-4 rounded-full font-bold text-lg bg-gray-800 hover:bg-gray-700 transition-all duration-300 border border-gray-600"
                >
                    <Upload className="w-6 h-6" />
                    Upload File
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="audio/*,video/*"
                    onChange={(e) => {
                        if (e.target.files[0]) handleFileUpload(e.target.files[0]);
                    }}
                />
            </div>
        </div>
    )
}
