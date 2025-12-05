import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { autoCorrelate, getNoteFromFrequency, getSpectralCentroid } from './utils';
import { analyzeVoiceType } from './VoiceTypeAnalyzer';
import { KeyFinder } from './KeyFinder';
import { VibratoDetector } from './VibratoDetector';

const AudioContextState = createContext(null);

export function AudioProvider({ children }) {
    const [isListening, setIsListening] = useState(false);
    const [sourceType, setSourceType] = useState('mic'); // 'mic' or 'file'
    const [availableDevices, setAvailableDevices] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState('default');

    // Audio Settings
    const [inputGain, setInputGain] = useState(1.0);
    const [noiseGateThreshold, setNoiseGateThreshold] = useState(0.01);

    const [audioData, setAudioData] = useState({
        frequency: 0,
        note: '-',
        cents: 0,
        voiceType: 'Silence',
        voiceTypeColor: 'text-gray-500',
        volume: 0,
        estimatedKey: '-'
    });

    const audioCtxRef = useRef(null);
    const analyzerRef = useRef(null);
    const gainNodeRef = useRef(null);
    const sourceRef = useRef(null);
    const rafIdRef = useRef(null);
    const keyFinderRef = useRef(new KeyFinder());
    const vibratoRef = useRef(new VibratoDetector());

    // For visualizer
    const [freqData, setFreqData] = useState(new Uint8Array(0));

    useEffect(() => {
        getDevices();
        navigator.mediaDevices.addEventListener('devicechange', getDevices);
        return () => {
            stopListening();
            navigator.mediaDevices.removeEventListener('devicechange', getDevices);
        }
    }, []);

    const getDevices = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(device => device.kind === 'audioinput');
            setAvailableDevices(audioInputs);
        } catch (err) {
            console.error("Error fetching devices", err);
        }
    };

    const startMic = async () => {
        if (audioCtxRef.current) await audioCtxRef.current.close();

        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        analyzerRef.current = audioCtxRef.current.createAnalyser();
        analyzerRef.current.fftSize = 2048;

        // Create Gain Node
        gainNodeRef.current = audioCtxRef.current.createGain();
        gainNodeRef.current.gain.value = inputGain;
        try {
            // Attempt with preferred constraints (disable processing for raw audio)
            const constraints = {
                audio: {
                    deviceId: selectedDeviceId !== 'default' ? { exact: selectedDeviceId } : undefined,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            sourceRef.current = audioCtxRef.current.createMediaStreamSource(stream);
            initAudio();
        } catch (err) {
            console.warn("Preferred mic constraints failed, falling back to default.", err);
            try {
                // Fallback: Default settings
                const fallbackConstraints = {
                    audio: {
                        deviceId: selectedDeviceId !== 'default' ? { exact: selectedDeviceId } : undefined
                    }
                };
                const stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
                sourceRef.current = audioCtxRef.current.createMediaStreamSource(stream);
                initAudio();
            } catch (fatalErr) {
                console.error("Microphone access denied completely", fatalErr);
                alert("Could not access microphone. Please check permissions.");
            }
        }
    };

    const initAudio = () => {
        // Graph: Source -> Gain -> Analyzer -> Destination (if file) / Default (if mic, don't connect to destination)
        sourceRef.current.connect(gainNodeRef.current);
        gainNodeRef.current.connect(analyzerRef.current);

        setSourceType('mic');
        setIsListening(true);
        keyFinderRef.current.reset();
        vibratoRef.current.reset();
        updateLoop();
    };

    // Update gain when state changes
    useEffect(() => {
        if (gainNodeRef.current) {
            gainNodeRef.current.gain.value = inputGain;
        }
    }, [inputGain]);

    const handleFileUpload = async (file) => {
        stopListening();

        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        analyzerRef.current = audioCtxRef.current.createAnalyser();
        analyzerRef.current.fftSize = 2048;

        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioCtxRef.current.decodeAudioData(arrayBuffer);

        sourceRef.current = audioCtxRef.current.createBufferSource();
        sourceRef.current.buffer = audioBuffer;
        sourceRef.current.connect(analyzerRef.current);
        analyzerRef.current.connect(audioCtxRef.current.destination); // Connect to speakers

        sourceRef.current.start(0);
        setSourceType('file');
        setIsListening(true);
        keyFinderRef.current.reset();
        vibratoRef.current.reset();

        sourceRef.current.onended = () => setIsListening(false);
        updateLoop();
    };

    const stopListening = () => {
        if (sourceRef.current) {
            try { sourceRef.current.stop(); } catch (e) { /* ignore */ }
            sourceRef.current.disconnect();
        }
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        setIsListening(false);
    };

    const updateLoop = () => {
        if (!analyzerRef.current) return;

        const bufferLength = analyzerRef.current.fftSize;
        const timeDomainData = new Float32Array(bufferLength);
        const frequencyData = new Uint8Array(analyzerRef.current.frequencyBinCount);

        analyzerRef.current.getFloatTimeDomainData(timeDomainData);
        analyzerRef.current.getByteFrequencyData(frequencyData);

        // Update Visualizer Data using a copy to avoid render issues
        setFreqData(new Uint8Array(frequencyData));

        // Pitch Detection
        const frequency = autoCorrelate(timeDomainData, audioCtxRef.current.sampleRate);
        const centroid = getSpectralCentroid(frequencyData, audioCtxRef.current.sampleRate);

        let noteInfo = null;
        let voiceTypeData = { type: 'Silence', confidence: 0, color: 'text-gray-500', isStraining: false };

        // Calculate Volume (RMS)
        let rms = 0;
        for (let i = 0; i < timeDomainData.length; i++) rms += timeDomainData[i] * timeDomainData[i];
        rms = Math.sqrt(rms / timeDomainData.length);

        // Noise Gate: Configurable
        if (frequency !== -1 && rms > noiseGateThreshold) {
            noteInfo = getNoteFromFrequency(frequency);
            if (noteInfo) {
                voiceTypeData = analyzeVoiceType(frequency, centroid, rms, 'male'); // Default to male for now, make configurable later
                keyFinderRef.current.processNote(noteInfo.midi % 12);
                vibratoRef.current.update(frequency, performance.now());
            }
        }

        const vibratoStats = vibratoRef.current.analyze();

        // Update Key Estimate every 60 frames (approx 1 sec) roughly, or just every frame (computationally cheap)
        const estimatedKey = keyFinderRef.current.estimateKey();

        setAudioData({
            frequency: frequency !== -1 ? Math.round(frequency) : 0,
            note: noteInfo ? noteInfo.name + noteInfo.octave : '-',
            cents: noteInfo ? noteInfo.cents : 0,
            exactMidi: noteInfo ? noteInfo.midi + (noteInfo.cents / 100) : null,
            voiceType: voiceTypeData.type,
            voiceTypeColor: voiceTypeData.color,
            volume: rms,
            estimatedKey: estimatedKey,
            vibrato: vibratoStats
        });

        rafIdRef.current = requestAnimationFrame(updateLoop);
    };

    return (
        <AudioContextState.Provider value={{
            isListening,
            startMic,
            stopListening,
            handleFileUpload,
            audioData,
            freqData,
            sourceType,
            availableDevices,
            selectedDeviceId,
            setSelectedDeviceId,
            inputGain,
            setInputGain,
            noiseGateThreshold,
            setNoiseGateThreshold
        }}>
            {children}
        </AudioContextState.Provider>
    );
}

export const useAudio = () => useContext(AudioContextState);
