import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { autoCorrelate, getNoteFromFrequency, getSpectralCentroid, detectBPM, detectPitchRange, getVoiceTypesFromRange } from './utils';
import { analyzeVoiceType } from './VoiceTypeAnalyzer';
import { KeyFinder, detectKeyFromBuffer } from './KeyFinder';
import { VibratoDetector } from './VibratoDetector';

const AudioContextState = createContext(null);

export function AudioProvider({ children }) {
    const [isListening, setIsListening] = useState(false);
    const [sourceType, setSourceType] = useState('idle'); // 'mic', 'file', or 'idle'
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
        targetFrequency: 0,
        targetFrequency: 0,
        estimatedKey: '-',
        bpm: 0,
        pitchRange: null,
        detectedVoiceTypes: []
    });

    const audioCtxRef = useRef(null);
    const analyzerRef = useRef(null);
    const gainNodeRef = useRef(null);
    const sourceRef = useRef(null);
    const rafIdRef = useRef(null);
    const keyFinderRef = useRef(new KeyFinder());
    const vibratoRef = useRef(new VibratoDetector());
    const bpmRef = useRef(0);
    const rangeRef = useRef(null);
    const voiceTypesRef = useRef([]);
    const keyRef = useRef(null); // Static key for files

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

        // Create a silent gain node (volume = 0) to allow processing without audio output
        const silentGain = audioCtxRef.current.createGain();
        silentGain.gain.value = 0; // Mute the audio

        sourceRef.current.connect(analyzerRef.current);
        analyzerRef.current.connect(silentGain);
        silentGain.connect(audioCtxRef.current.destination); // Connect to speakers but muted

        sourceRef.current.start(0);
        setSourceType('file');
        setIsListening(true);
        keyFinderRef.current.reset();
        vibratoRef.current.reset();
        bpmRef.current = 0;
        rangeRef.current = null;
        voiceTypesRef.current = [];
        keyRef.current = null;

        // Calculate Static Key
        keyRef.current = detectKeyFromBuffer(audioBuffer);

        // Calculate BPM async
        detectBPM(audioBuffer).then(bpm => {
            bpmRef.current = bpm;
        });

        // Calculate Pitch Range Sync (it's fast enough or allows async? It's synchronous loop)
        // We can run it here
        const range = detectPitchRange(audioBuffer);
        if (range) {
            rangeRef.current = range;
            voiceTypesRef.current = getVoiceTypesFromRange(range.minFreq, range.maxFreq);
        }

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

    // State for stabilizers
    const voiceTypeBufferRef = useRef({ currentType: 'Silence', bufferLength: 0, candidate: null });
    const pitchBufferRef = useRef({ lastFreq: 0, stableFreq: 0, frames: 0 });

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
        let frequency = autoCorrelate(timeDomainData, audioCtxRef.current.sampleRate);
        const centroid = getSpectralCentroid(frequencyData, audioCtxRef.current.sampleRate);

        let noteInfo = null;
        let voiceTypeData = { type: 'Silence', confidence: 0, color: 'text-gray-500', isStraining: false };

        // Calculate Volume (RMS)
        let rms = 0;
        for (let i = 0; i < timeDomainData.length; i++) rms += timeDomainData[i] * timeDomainData[i];
        rms = Math.sqrt(rms / timeDomainData.length);

        // Noise Gate: INCREASED default to avoid random C6 noise (0.01 -> 0.02)
        // Also reject extremely high frequencies (> 2000Hz) that act as noise in human voice context often
        if (frequency !== -1 && rms > Math.max(noiseGateThreshold, 0.02) && frequency < 2000) {

            // PITCH SMOOTHING (Simple Low-Pass / Outlier Rejection)
            // If jump is huge (> 1 octave) in 1 frame, ignore it unless it stays
            const ratio = frequency / (pitchBufferRef.current.stableFreq || frequency);
            if (pitchBufferRef.current.stableFreq > 0 && (ratio > 2.2 || ratio < 0.45)) {
                // Outlier detected? Check if it's sustained
                pitchBufferRef.current.frames++;
                if (pitchBufferRef.current.frames < 5) { // Wait 5 frames to confirm new note
                    frequency = pitchBufferRef.current.stableFreq; // Stick to old
                } else {
                    pitchBufferRef.current.stableFreq = frequency; // Accept jump
                    pitchBufferRef.current.frames = 0;
                }
            } else {
                pitchBufferRef.current.stableFreq = frequency;
                pitchBufferRef.current.frames = 0;
            }

            noteInfo = getNoteFromFrequency(pitchBufferRef.current.stableFreq);

            if (noteInfo) {
                // Raw Voice Type Analysis
                const rawVoiceData = analyzeVoiceType(pitchBufferRef.current.stableFreq, centroid, rms, 'male');

                // VOICE TYPE SMOOTHING (Debounce)
                // Require 10 frames (approx 160ms) of consistent result to switch type
                if (rawVoiceData.type !== voiceTypeBufferRef.current.candidate) {
                    voiceTypeBufferRef.current.candidate = rawVoiceData.type;
                    voiceTypeBufferRef.current.bufferLength = 0;
                } else {
                    voiceTypeBufferRef.current.bufferLength++;
                }

                if (voiceTypeBufferRef.current.bufferLength > 10) {
                    voiceTypeBufferRef.current.currentType = rawVoiceData.type;
                    // Keep color/data synced
                    voiceTypeData = rawVoiceData;
                } else {
                    // Return previous stable type but keep measuring
                    voiceTypeData = {
                        ...rawVoiceData,
                        type: voiceTypeBufferRef.current.currentType,
                        color: rawVoiceData.color // Allow color to update for feedback? No, keep it stable
                    };
                    // Actually, let's just stick to the old textual type to stop flickering
                    analyzeVoiceType(pitchBufferRef.current.stableFreq, centroid, rms, 'male'); // re-run or just mock?
                    // Better: Just use the stabilized type string, determining color might be tricky if we don't re-run logic.
                    // For simplicity, we just use the rawData but OVERRIDE the type name.
                    voiceTypeData.type = voiceTypeBufferRef.current.currentType;
                }

                if (sourceType !== 'file') {
                    keyFinderRef.current.processNote(noteInfo.midi % 12);
                }
                vibratoRef.current.update(pitchBufferRef.current.stableFreq, performance.now());
            }
        } else {
            // Silence logic resets buffers?
            // Maybe not, to allow legato breathing.
            pitchBufferRef.current.frames = 0;
            voiceTypeBufferRef.current.bufferLength = 0;
        }

        const vibratoStats = vibratoRef.current.analyze();
        const estimatedKey = (sourceType === 'file' && keyRef.current)
            ? keyRef.current
            : keyFinderRef.current.estimateKey();

        setAudioData({
            frequency: frequency !== -1 ? Math.round(frequency) : 0,
            note: noteInfo ? noteInfo.name + noteInfo.octave : '-',
            cents: noteInfo ? noteInfo.cents : 0,
            exactMidi: noteInfo ? noteInfo.midi + (noteInfo.cents / 100) : null,
            targetFrequency: noteInfo ? noteInfo.targetFrequency : 0,
            voiceType: voiceTypeData.type,
            voiceTypeColor: voiceTypeData.color,
            volume: rms,
            estimatedKey: estimatedKey,

            vibrato: vibratoStats,
            bpm: bpmRef.current,
            pitchRange: rangeRef.current,
            detectedVoiceTypes: voiceTypesRef.current
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
