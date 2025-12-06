import { useState, useRef, useEffect } from 'react';
import { Upload, Music, Search, AlertCircle, Play, Check, Settings, LogIn, Youtube, Lock, X } from 'lucide-react';
import { useAudio } from '../audio/AudioContext';
import { searchSongs, getRandomSuggestions } from '../services/SongKeyService'; // Mock
import { YouTubeService } from '../services/YouTubeService'; // YouTube
import ChordDiagram from './ChordDiagram';
import PianoChord from './PianoChord';
import { addChordsToSong } from '../services/ChordService';

// --- SMART COVER COMPONENT ---
// Automatically finds the correct cover art from iTunes (free/public) 
// if the local one is missing or fails heavily.
const SmartCover = ({ song }) => {
    const [src, setSrc] = useState(song.cover);
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        // If we already have a specialized iTunes URL or stable URL, use it
        // Or if we failed before, try to fetch
        if (!src || hasError) {
            // Maybe we want to try fetching immediately if it's a "demo" song to ensure high quality?
            // Let's just try fetching for ALL demo songs to be sure we get the "Right" art.
        }
    }, [song, hasError]);

    // Initial load check
    useEffect(() => {
        const fetchItunesCover = async () => {
            try {
                // Search iTunes for exact "Song + Artist" match for better accuracy
                const term = encodeURIComponent(`${song.title} ${song.artist}`);
                const res = await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=1`);
                const data = await res.json();

                if (data.resultCount > 0) {
                    // Verify the result matches our song (case-insensitive)
                    const result = data.results[0];
                    const titleMatch = result.trackName.toLowerCase().includes(song.title.toLowerCase()) ||
                        song.title.toLowerCase().includes(result.trackName.toLowerCase());
                    const artistMatch = result.artistName.toLowerCase().includes(song.artist.toLowerCase()) ||
                        song.artist.toLowerCase().includes(result.artistName.toLowerCase());

                    if (titleMatch && artistMatch) {
                        // Get 100x100 and upgrade to 600x600 for quality
                        let artwork = result.artworkUrl100?.replace('100x100', '600x600') || result.artworkUrl100;
                        setSrc(artwork);
                    }
                }
            } catch (e) {
                // ignore - will show fallback
            }
        };

        if (song.isDemo) {
            // For demo songs, ALWAYS try to get the fresh iTunes cover to ensure it works
            fetchItunesCover();
        }
    }, [song]);

    return (
        <div className="relative w-full h-full rounded bg-gray-800 shrink-0 overflow-hidden">
            {src ? (
                <img
                    src={src}
                    alt={song.title}
                    className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                    onLoad={() => setIsLoaded(true)}
                    onError={() => { setSrc(null); setHasError(true); }}
                />
            ) : null}

            {/* Gradient Fallback underneath or if no src */}
            <div className={`absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-700 flex items-center justify-center text-gray-500 -z-10`}>
                <Music className="w-8 h-8" />
            </div>
        </div>
    );
};
// -----------------------------

export default function KeyFinderModule() {
    const { handleFileUpload, audioData, setAudioData, isListening, startMic } = useAudio();
    const [dragActive, setDragActive] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const fileInputRef = useRef(null);

    // Settings
    const [showSettings, setShowSettings] = useState(false);
    // User requested "Just YouTube" or just the list. 
    // We will Default to 'mock' (Reference List) but allow YouTube search.
    const [searchSource, setSearchSource] = useState('mock');

    const [youtubeApiKey, setYoutubeApiKey] = useState(localStorage.getItem("youtube_api_key") || "");

    // Active Playback
    const [youtubeVideoId, setYoutubeVideoId] = useState(null);

    // Modal for song info display
    const [selectedSong, setSelectedSong] = useState(null);

    // Instrument toggle for chords
    const [instrument, setInstrument] = useState('guitar'); // 'guitar' or 'piano'

    // Genre filtering
    const [selectedGenre, setSelectedGenre] = useState('All');

    // Initial Load - Reference List
    useEffect(() => {
        // Load the song reference list by default
        let demoData = getRandomSuggestions().map(s => ({
            ...s,
            source: 'mock',
            isDemo: true
        }));

        // Filter by genre if not "All"
        if (selectedGenre !== 'All') {
            demoData = demoData.filter(song => song.genre === selectedGenre);
        }

        setSearchResults(demoData);
    }, [selectedGenre]); // Re-run when genre changes

    // Persist YouTube Key
    useEffect(() => {
        if (youtubeApiKey) localStorage.setItem("youtube_api_key", youtubeApiKey);
    }, [youtubeApiKey]);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    };

    const handleSearch = async (e) => {
        const query = e.target.value;
        setSearchQuery(query);

        // If cleared, reset to Full List
        if (query.length === 0) {
            const demoData = getRandomSuggestions().map(s => ({
                ...s,
                source: 'mock',
                isDemo: true
            }));
            setSearchResults(demoData);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);

        try {
            // Search Local Reference Database
            const localResults = await searchSongs(query);
            const formattedLocal = localResults.map(s => ({ ...s, source: 'mock', isDemo: true }));

            // Search iTunes Global Database for additional songs
            let globalResults = [];
            if (query.length > 2) {
                try {
                    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=50`);
                    const data = await res.json();
                    globalResults = data.results.map(item => ({
                        id: item.trackId,
                        title: item.trackName,
                        artist: item.artistName,
                        cover: item.artworkUrl100?.replace('100x100', '300x300'),
                        key: "Unknown",
                        bpm: "-",
                        source: 'itunes',
                        isDemo: false
                    }));
                } catch (apiErr) {
                    console.warn("iTunes search failed", apiErr);
                }
            }

            // Combine: Local first, then iTunes results
            const localTitles = new Set(formattedLocal.map(s => s.title.toLowerCase()));
            const uniqueGlobal = globalResults.filter(s => !localTitles.has(s.title.toLowerCase()));

            setSearchResults([...formattedLocal, ...uniqueGlobal]);

        } catch (err) {
            console.error(err);
        } finally {
            setIsSearching(false);
        }
    };

    const selectSong = async (song) => {
        // Add chords to song if it doesn't have them
        const songWithChords = addChordsToSong(song);

        // Show modal with song info
        setSelectedSong(songWithChords);

        // Also set the audio data if we have it
        if (song.key && song.key !== "Unknown" && song.key !== "Live Analysis Required") {
            if (setAudioData) {
                setAudioData(prev => ({
                    ...prev,
                    estimatedKey: song.key,
                    voiceType: 'Reference Database'
                }));
            }
        }
    };

    return (
        <>
            {/* SONG INFO MODAL */}
            {selectedSong && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedSong(null)}>
                    <div className="relative max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                        {/* Close Button */}
                        <button
                            onClick={() => setSelectedSong(null)}
                            className="absolute -top-10 right-0 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Modal Card */}
                        <div className="glass-panel p-6 space-y-4 animate-scale-in">
                            {/* Cover Art */}
                            <div className="relative w-full aspect-square rounded-xl overflow-hidden shadow-2xl ring-2 ring-white/20">
                                <div className="w-full h-full">
                                    <SmartCover song={selectedSong} />
                                </div>
                            </div>

                            {/* Song Info */}
                            <div className="text-center space-y-1">
                                <h2 className="text-2xl font-black text-white">{selectedSong.title}</h2>
                                <p className="text-sm text-gray-300">{selectedSong.artist}</p>
                            </div>

                            {/* KEY/BPM Display */}
                            <div className="grid grid-cols-2 gap-3">
                                {/* KEY */}
                                <div className="relative overflow-hidden rounded-lg p-4 bg-gradient-to-br from-purple-600 to-pink-600">
                                    <div className="text-center">
                                        <p className="text-xs font-bold text-white/80 uppercase mb-1">Key</p>
                                        <p className="text-2xl font-black text-white">{selectedSong.key}</p>
                                    </div>
                                </div>

                                {/* BPM */}
                                <div className="relative overflow-hidden rounded-lg p-4 bg-gradient-to-br from-blue-600 to-cyan-600">
                                    <div className="text-center">
                                        <p className="text-xs font-bold text-white/80 uppercase mb-1">BPM</p>
                                        <p className="text-2xl font-black text-white">{selectedSong.bpm}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Chord Progression Section */}
                            {selectedSong.chords && selectedSong.chords.length > 0 && (
                                <div className="space-y-3">
                                    {/* Instrument Toggle */}
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-gray-300 uppercase">Chord Progression</h3>
                                        <div className="flex bg-white/5 rounded-lg p-1">
                                            <button
                                                onClick={() => setInstrument('guitar')}
                                                className={`px-3 py-1 text-xs font-bold rounded transition-all ${instrument === 'guitar'
                                                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                                                    : 'text-gray-400 hover:text-white'
                                                    }`}
                                            >
                                                🎸 Guitar
                                            </button>
                                            <button
                                                onClick={() => setInstrument('piano')}
                                                className={`px-3 py-1 text-xs font-bold rounded transition-all ${instrument === 'piano'
                                                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                                                    : 'text-gray-400 hover:text-white'
                                                    }`}
                                            >
                                                🎹 Piano
                                            </button>
                                        </div>
                                    </div>

                                    {/* Chord Diagrams */}
                                    <div className="grid grid-cols-4 gap-2">
                                        {selectedSong.chords.map((chord, index) => (
                                            <div key={index}>
                                                {instrument === 'guitar' ? (
                                                    <ChordDiagram chord={chord} />
                                                ) : (
                                                    <PianoChord chord={chord} />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* YouTube Link Button */}
                            <button
                                onClick={async () => {
                                    const url = await YouTubeService.getMostViewedVideo(selectedSong.title, selectedSong.artist);
                                    window.open(url, '_blank');
                                }}
                                className="block w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold py-3 px-6 rounded-full transition-all transform hover:scale-105 shadow-lg text-center cursor-pointer"
                            >
                                🎵 Play on YouTube
                            </button>
                        </div>
                    </div>
                </div>
            )
            }

            <div className="flex flex-col items-center justify-center w-full max-w-6xl mx-auto p-6 z-10 animate-fade-in pb-20">
                <h2 className="text-4xl font-bold mb-8 neon-text">Top Songs</h2>

                <div className="w-full flex justify-end items-center mb-4">
                    {/* Just Settings Icon */}
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>

                {/* Settings Panel - Only YouTube */}
                {showSettings && (
                    <div className="w-full mb-6 glass-panel p-4 animate-fade-in">
                        <h3 className="text-lg font-bold mb-4 text-gray-200">Settings</h3>
                        {/* YouTube API */}
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">YouTube Data API Key</label>
                            <div className="flex gap-2">
                                <div className="relative flex-grow">
                                    <span className="absolute left-3 top-2.5 text-gray-500"><Youtube className="w-4 h-4" /></span>
                                    <input
                                        type="password"
                                        value={youtubeApiKey}
                                        onChange={(e) => setYoutubeApiKey(e.target.value)}
                                        placeholder="Paste generic AIza... key here"
                                        className="w-full bg-black/50 border border-gray-700 rounded p-2 pl-9 text-white text-sm focus:border-red-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-1">Required for searching new videos.</p>
                        </div>
                    </div>
                )
                }

                {/* Main Content Area */}
                <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 h-[500px]">

                    {/* Reference List (Left) */}
                    <div className="md:col-span-1 glass-panel flex flex-col overflow-hidden h-full">
                        <div className="p-3 border-b border-white/5 bg-white/5">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                {searchQuery ? "Search Results" : "Top 200 Reference"}
                            </h3>

                            {/* Genre Filter Tabs */}
                            {!searchQuery && (
                                <div className="flex gap-1 mb-2 overflow-x-auto scrollbar-hide pb-2">
                                    {['All', 'Pop', 'Rock', 'R&B', 'Hip-Hop', 'K-pop'].map(genre => (
                                        <button
                                            key={genre}
                                            onClick={() => setSelectedGenre(genre)}
                                            className={`text-xs px-3 py-1 rounded-full whitespace-nowrap transition-all ${selectedGenre === genre
                                                ? 'bg-neon-blue text-white font-bold'
                                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                                }`}
                                        >
                                            {genre}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <input
                                type="text"
                                placeholder="Search songs..."
                                value={searchQuery}
                                onChange={handleSearch}
                                className="w-full bg-gray-950 border border-gray-700 text-white text-sm rounded-lg p-3 focus:outline-none focus:border-white/30 transition-all"
                            />
                        </div>

                        <div className="flex-grow overflow-y-auto p-2 custom-scrollbar">
                            {isSearching ? (
                                <div className="flex items-center justify-center h-full text-gray-500">Searching...</div>
                            ) : searchResults.length > 0 ? (
                                <div className="flex flex-col gap-2">
                                    {searchResults.map((song, idx) => (
                                        <div
                                            key={song.id + idx}
                                            onClick={() => selectSong(song)}
                                            className={`flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer group transition-colors border border-transparent 
                                            ${youtubeVideoId === song.id ? 'bg-white/10 border-red-500/50' : 'hover:border-white/10'}`}
                                        >
                                            {!searchQuery && (
                                                <span className="text-xs font-mono text-gray-500 w-6 text-right">#{idx + 1}</span>
                                            )}

                                            {/* SMART COVER ART */}
                                            <div className="w-12 h-12">
                                                <SmartCover song={song} />
                                            </div>

                                            <div className="flex-grow min-w-0">
                                                <h4 className="font-bold text-sm truncate text-white" dangerouslySetInnerHTML={{ __html: song.title }}></h4>
                                                <p className="text-xs text-gray-400 truncate">{song.artist}</p>
                                            </div>
                                            <div className="text-right">
                                                <div className={`font-bold text-xs ${song.source === 'spotify' ? 'text-green-400' : 'text-red-400'}`}>
                                                    {song.key}
                                                </div>
                                                <div className="text-[10px] text-gray-500">{song.bpm} BPM</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2 text-center p-4">
                                    <Search className="w-8 h-8 opacity-50" />
                                    <p className="text-sm">No results found.</p>
                                </div>
                            )}
                        </div>
                    </div >

                    {/* Right Side: Visualizer / YouTube Player (Hidden mostly if just reference) */}
                    < div className="md:col-span-2 flex flex-col gap-4 h-full" >
                        {/* If YouTube playing */}
                        {
                            youtubeVideoId ? (
                                <div className="w-full aspect-video bg-black rounded-xl overflow-hidden border border-gray-800 shadow-2xl relative group">
                                    <iframe
                                        src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&enablejsapi=1`}
                                        title="YouTube video player"
                                        className="w-full h-full"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    ></iframe>
                                </div>
                            ) : (
                                <div
                                    className={`w-full h-full glass-panel flex flex-col items-center justify-center text-center p-10
                                ${dragActive ? 'border-neon-blue bg-white/5' : ''}
                                transition-all duration-200 border-2 border-dashed border-white/10
                            `}
                                    onDragEnter={handleDrag}
                                    onDragLeave={handleDrag}
                                    onDragOver={handleDrag}
                                    onDrop={handleDrop}
                                >
                                    <Upload className={`w-16 h-16 mb-4 ${dragActive ? 'text-neon-blue' : 'text-gray-600'}`} />
                                    <h3 className="text-2xl font-bold text-gray-300">Drop Audio File</h3>
                                    <p className="text-gray-500 mt-2 mb-6">or select a file to analyze</p>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={(e) => e.target.files[0] && handleFileUpload(e.target.files[0])}
                                        accept="audio/*,video/*"
                                        className="hidden"
                                    />
                                    <button
                                        onClick={() => fileInputRef.current.click()}
                                        className="bg-white/10 hover:bg-white/20 text-white px-8 py-3 rounded-full font-bold transition-all flex items-center gap-2"
                                    >
                                        <Music className="w-4 h-4" /> Select File
                                    </button>
                                </div>
                            )
                        }
                    </div >
                </div >
            </div >
        </>
    );
}
