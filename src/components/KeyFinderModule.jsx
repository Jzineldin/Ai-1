import { useState, useRef, useEffect } from 'react';
import { Upload, Music, Search, AlertCircle, Play, Check, Settings, LogIn, Youtube, Lock, X, Wand2 } from 'lucide-react';
import { useAudio } from '../audio/AudioContext';
import { searchSongs, getRandomSuggestions } from '../services/SongKeyService'; // Mock
import { YouTubeService } from '../services/YouTubeService'; // YouTube
import ChordDiagram from './ChordDiagram';
import PianoChord from './PianoChord';
import { addChordsToSong, transposeProgression } from '../services/ChordService';

// --- SMART COVER COMPONENT ---
// Automatically finds the correct cover art from iTunes (free/public) 
// if the local one is missing or fails heavily.
// --- GLOBAL REQUEST QUEUE (LIFO) ---
// Prevents "thundering herd" and prioritizes what user is looking at NOW.
const coverQueue = [];
let queueProcessing = false;

const processQueue = async () => {
    if (queueProcessing) return;
    queueProcessing = true;

    while (coverQueue.length > 0) {
        // LIFO: Take from END (most recently added = currently on screen)
        const task = coverQueue.pop();

        // Check if task is still valid (could add cancellation logic here if needed)
        // For now, simpler is better. Just run it.
        await task.run();

        // Wait 300ms before next request to be kind to iTunes API
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    queueProcessing = false;
};

const enqueueCoverFetch = (task) => {
    // Add to end
    coverQueue.push(task);
    processQueue();
};

// --- DETERMINISTIC FALLBACK HELPERS ---
const gradients = [
    'from-pink-500 to-rose-600',
    'from-purple-600 to-indigo-600',
    'from-cyan-500 to-blue-600',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-red-600',
    'from-fuchsia-600 to-purple-600',
    'from-blue-600 to-indigo-700'
];

const getGradient = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return gradients[Math.abs(hash) % gradients.length];
};

const getInitials = (title) => {
    return title
        .split(' ')
        .map(word => word[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
};

// --- SMART COVER COMPONENT ---
const SmartCover = ({ song }) => {
    // 1. Try to get from Cache First
    const cacheKey = `cover_${song.artist}_${song.title}`;
    const [src, setSrc] = useState(() => {
        return localStorage.getItem(cacheKey) || song.cover;
    });

    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [isQueued, setIsQueued] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const containerRef = useRef(null);
    const retryTimeoutRef = useRef(null);

    // 2. Intersection Observer (Lazy Load)
    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                setIsVisible(true);
                observer.disconnect();
            }
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // 3. Queue Fetch if Visible & No Source
    useEffect(() => {
        if (isVisible && song.isDemo && !src && !hasError && !isQueued) {
            setIsQueued(true);

            enqueueCoverFetch({
                run: async () => {
                    // Double check before network call
                    if (localStorage.getItem(cacheKey)) return;
                    // Optimization: If user scrolled away really fast, maybe skip?
                    // But LIFO logic handles priority, so let's just fetch to populate cache.

                    try {
                        // Try YouTube first (higher quality, better matching)
                        let artwork = null;
                        try {
                            artwork = await YouTubeService.getCoverArt(song.title, song.artist);
                        } catch (ytErr) {
                            console.warn('YouTube cover fetch failed, using iTunes fallback');
                        }

                        // Fallback to iTunes if YouTube fails
                        if (!artwork) {
                            const cleanArtist = song.artist.replace(/\s(ft\.|feat\.\|&).*$/i, '');
                            const term = encodeURIComponent(`${song.title} ${cleanArtist}`);

                            const res = await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=10`);
                            const data = await res.json();

                            if (data.resultCount > 0) {
                                const match = data.results.find(item =>
                                    item.trackName.toLowerCase().includes(song.title.toLowerCase()) ||
                                    song.title.toLowerCase().includes(item.trackName.toLowerCase())
                                );

                                if (match) {
                                    artwork = match.artworkUrl100?.replace('100x100', '300x300') || match.artworkUrl100;
                                }
                            }
                        }

                        if (artwork) {
                            setSrc(artwork);
                            localStorage.setItem(cacheKey, artwork);
                            setRetryCount(0); // Reset retry count on success
                        } else {
                            setHasError(true);
                        }
                    } catch (e) {
                        setHasError(true);
                    }
                }
            });
        }
    }, [isVisible, song, src, hasError, isQueued, cacheKey]);

    // 4. Auto-retry failed cover art loads
    useEffect(() => {
        if (hasError && retryCount < 3) {
            // Exponential backoff: 2s, 4s, 8s
            const delay = Math.pow(2, retryCount + 1) * 1000;

            retryTimeoutRef.current = setTimeout(() => {
                setRetryCount(prev => prev + 1);
                setHasError(false);
                setIsQueued(false); // Trigger re-fetch
            }, delay);
        }

        return () => {
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
        };
    }, [hasError, retryCount]);

    const handleRetry = (e) => {
        e.stopPropagation();
        setHasError(false);
        setIsQueued(false); // Allows effect to re-queue
    };

    // Memoize gradient to prevent flickering
    const bgGradient = useRef(getGradient(song.title + song.artist)).current;
    const initials = useRef(getInitials(song.title)).current;

    return (
        <div
            ref={containerRef}
            className="relative w-full aspect-square rounded bg-gray-800 shrink-0 overflow-hidden group cursor-pointer"
            onClick={!src ? handleRetry : undefined}
            title={!src ? "Click to retry loading cover" : ""}
        >
            {/* Custom Aesthetic Fallback - Always visible as background */}
            <div className={`absolute inset-0 bg-gradient-to-br ${bgGradient} flex items-center justify-center`}>
                {isQueued && !src && !hasError ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                    <span className="text-white/40 font-black text-xs tracking-tighter transform -rotate-6 select-none overlay-text">
                        {initials}
                    </span>
                )}
            </div>

            {/* Image layer on top */}
            {src && (
                <img
                    src={src}
                    alt={song.title}
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onLoad={() => setIsLoaded(true)}
                    onError={() => {
                        setSrc(null);
                        setIsLoaded(false);
                        setHasError(true);
                        localStorage.removeItem(cacheKey);
                    }}
                    loading="eager"
                />
            )}

            {/* Retry overlay */}
            {!src && !isQueued && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity z-10">
                    <p className="text-[8px] text-white font-bold uppercase tracking-wider">Retry</p>
                </div>
            )}
        </div>
    );
};
// -----------------------------

export default function KeyFinderModule() {
    const { handleFileUpload, audioData, setAudioData, isListening, startMic, stopListening, sourceType } = useAudio();
    const [dragActive, setDragActive] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const fileInputRef = useRef(null);
    const [loading, setLoading] = useState(false);

    const onFileSelect = async (file) => {
        if (!file) return;
        setLoading(true);
        try {
            await handleFileUpload(file);
        } catch (e) {
            console.error(e);
        }
        // Small delay to let the animation show (and let audio context initialize)
        setTimeout(() => setLoading(false), 1500);
    };

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
    const [transposeSteps, setTransposeSteps] = useState(0);

    // Reset transpose when song changes & Auto-Smart Capo
    useEffect(() => {
        setTransposeSteps(0);

        // AUTO SMART CAPO: If we have a song, try to find the easiest key immediately
        // We need to wait a tick for the state to settle? No, we can just calculate it.
        // But we need the 'findSmartCapo' logic which depends on selectedSong state or arg.
        // Let's call a helper immediately if selectedSong exists.
        if (selectedSong && selectedSong.chords && instrument === 'guitar') {
            const bestStep = calculateSmartCapoStep(selectedSong.chords);
            if (bestStep !== 0) {
                setTransposeSteps(bestStep);
            }
        }
    }, [selectedSong, instrument]);

    // Independent helper (moved out or duplicated for effect usage without dependency cycle)
    const calculateSmartCapoStep = (chords) => {
        const openRoots = ['C', 'G', 'D', 'A', 'E'];
        // Try offsets from -5 to +6
        for (let i = -5; i <= 6; i++) {
            const testChords = transposeProgression(chords, i);
            if (!testChords[0]) continue;
            const firstChordRoot = testChords[0].replace(/m|dim|aug|7|sus.*/, '');
            // Prefer G or C or D over others
            if (openRoots.includes(firstChordRoot)) {
                return i;
            }
        }
        return 0;
    };

    // Helper to find "easy" guitar key (User Triggered)
    const findSmartCapo = () => {
        if (!selectedSong || !selectedSong.chords) return;
        const bestStep = calculateSmartCapoStep(selectedSong.chords);
        setTransposeSteps(bestStep);
    };

    // Compute transposed chords
    const currentChords = selectedSong ? transposeProgression(selectedSong.chords, transposeSteps) : [];

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

        // JUST 100 SONGS LIMIT
        demoData = demoData.slice(0, 100);

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
                    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=100`);
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in p-4" onClick={() => setSelectedSong(null)}>
                    <div className="relative max-w-md w-full max-h-[85vh] overflow-y-auto custom-scrollbar rounded-3xl" onClick={(e) => e.stopPropagation()}>
                        {/* Close Button */}
                        <button
                            onClick={() => setSelectedSong(null)}
                            className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-all backdrop-blur-md"
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
                                    {/* Instrument Toggle & Transpose */}
                                    <div className="flex flex-col gap-3">
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

                                        {/* Transpose Controls */}
                                        <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setTransposeSteps(s => s - 1)}
                                                    className="w-8 h-8 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 font-bold"
                                                >-</button>
                                                <div className="text-center min-w-[60px]">
                                                    <div className="text-xs text-gray-400 uppercase">Transpose</div>
                                                    <div className={`font-bold ${transposeSteps !== 0 ? 'text-neon-blue' : 'text-white'}`}>
                                                        {transposeSteps > 0 ? `+${transposeSteps}` : transposeSteps}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setTransposeSteps(s => s + 1)}
                                                    className="w-8 h-8 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 font-bold"
                                                >+</button>
                                            </div>

                                            {/* Capo Helper Button */}
                                            <button
                                                onClick={findSmartCapo}
                                                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-xs font-bold hover:shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all flex items-center gap-2"
                                            >
                                                ✨ Magic Capo
                                            </button>
                                        </div>

                                        {/* Capo Instruction */}
                                        {transposeSteps !== 0 && instrument === 'guitar' && (
                                            <div className="text-center p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-300 text-sm font-bold animate-pulse">
                                                {transposeSteps < 0
                                                    ? `Capo ${Math.abs(transposeSteps)} • Play standard shapes`
                                                    : `Tune Down ${transposeSteps} semitones (or use chords on higher frets)`}
                                            </div>
                                        )}
                                    </div>

                                    {/* Chord Diagrams */}
                                    <div className="grid grid-cols-4 gap-2">
                                        {currentChords.map((chord, index) => (
                                            <div key={index + transposeSteps}>
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

                            {/* YouTube Music Link Button */}
                            <button
                                onClick={async () => {
                                    const url = await YouTubeService.getMostViewedVideo(selectedSong.title, selectedSong.artist);
                                    window.open(url, '_blank');
                                }}
                                className="block w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold py-3 px-6 rounded-full transition-all transform hover:scale-105 shadow-lg text-center cursor-pointer"
                            >
                                🎵 Play on YouTube Music
                            </button>
                        </div>
                    </div>
                </div>
            )
            }

            <div className="flex flex-col items-center justify-center w-full max-w-6xl mx-auto px-4 pt-24 pb-32 md:p-6 md:pt-28 z-10 animate-fade-in">
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
                            ) : loading ? (
                                <div className="w-full h-full glass-panel flex flex-col items-center justify-center text-center p-10">
                                    <div className="relative w-20 h-20 mb-6">
                                        <div className="absolute inset-0 rounded-full border-4 border-white/10"></div>
                                        <div className="absolute inset-0 rounded-full border-4 border-t-transparent border-l-transparent border-r-transparent border-b-cyan-500 animate-spin"></div>
                                        {/* Inner pulse */}
                                        <div className="absolute inset-0 m-auto w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 animate-pulse"></div>
                                    </div>
                                    <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 animate-pulse">
                                        Analyzing Audio...
                                    </h3>
                                    <p className="text-gray-500 mt-2 text-sm">Detecting Key & BPM</p>
                                </div>
                            ) : sourceType === 'file' ? (
                                <div className="w-full h-full glass-panel flex flex-col items-center justify-center text-center p-10 relative overflow-hidden animate-fade-in">
                                    <button
                                        onClick={() => {
                                            stopListening();
                                            setLoading(false);
                                        }}
                                        className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                        title="Close Results"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>

                                    <h3 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-8">
                                        Analysis Complete
                                    </h3>

                                    <div className="grid grid-cols-2 gap-4 w-full max-w-lg mb-6">
                                        {/* Key */}
                                        <div className="bg-white/5 p-6 rounded-2xl border border-white/10 hover:border-neon-blue/50 transition-colors group">
                                            <div className="text-gray-400 text-xs uppercase tracking-wider mb-2 group-hover:text-neon-blue transition-colors">Key</div>
                                            <div className="text-4xl font-bold text-white tracking-tight">
                                                {audioData.estimatedKey || '-'}
                                            </div>
                                        </div>

                                        {/* BPM */}
                                        <div className="bg-white/5 p-6 rounded-2xl border border-white/10 hover:border-purple-500/50 transition-colors group">
                                            <div className="text-gray-400 text-xs uppercase tracking-wider mb-2 group-hover:text-purple-500 transition-colors">BPM</div>
                                            <div className="text-4xl font-bold text-purple-400 tracking-tight">
                                                {audioData.bpm || '--'}
                                            </div>
                                        </div>

                                        {/* Range */}
                                        <div className="bg-white/5 p-6 rounded-2xl border border-white/10 hover:border-pink-500/50 transition-colors group">
                                            <div className="text-gray-400 text-xs uppercase tracking-wider mb-2 group-hover:text-pink-500 transition-colors">Range</div>
                                            <div className="text-3xl font-bold text-white tracking-tight break-words">
                                                {audioData.pitchRange ?
                                                    `${audioData.pitchRange.minNote.fullName} - ${audioData.pitchRange.maxNote.fullName}`
                                                    : '-'}
                                            </div>
                                        </div>

                                        {/* Voice Type */}
                                        <div className="bg-white/5 p-6 rounded-2xl border border-white/10 hover:border-cyan-500/50 transition-colors flex flex-col justify-center">
                                            <div className="text-gray-400 text-xs uppercase tracking-wider mb-2 group-hover:text-cyan-500 transition-colors">Voice Type</div>
                                            <div className="text-2xl font-bold text-cyan-400 leading-tight">
                                                {audioData.detectedVoiceTypes.length > 0 ? audioData.detectedVoiceTypes.join(' / ') : '-'}
                                            </div>
                                        </div>
                                    </div>
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
                                    onDrop={(e) => {
                                        handleDrag(e);
                                        onFileSelect(e.dataTransfer.files[0]);
                                    }}
                                >
                                    <Upload className={`w-16 h-16 mb-4 ${dragActive ? 'text-neon-blue' : 'text-gray-600'}`} />
                                    <h3 className="text-2xl font-bold text-gray-300">Drop Audio File</h3>
                                    <p className="text-gray-500 mt-2 mb-6">or select a file to analyze</p>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={(e) => onFileSelect(e.target.files[0])}
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
