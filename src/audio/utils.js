export const NOTE_STRINGS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const A4_FREQ = 440;

/**
 * Converts frequency (Hz) to the nearest musical note and cents deviation.
 */
export function getNoteFromFrequency(frequency) {
    if (!frequency || frequency < 20) return null;

    const noteNum = 12 * (Math.log(frequency / A4_FREQ) / Math.log(2)) + 69;
    const roundedNote = Math.round(noteNum);
    const cents = Math.floor((noteNum - roundedNote) * 100);

    const noteName = NOTE_STRINGS[roundedNote % 12];
    const octave = Math.floor(roundedNote / 12) - 1;

    const targetFrequency = A4_FREQ * Math.pow(2, (roundedNote - 69) / 12);

    return {
        name: noteName,
        octave: octave,
        fullName: `${noteName}${octave}`,
        cents: cents,
        frequency: frequency,
        targetFrequency: targetFrequency,
        midi: roundedNote
    };
}

/**
 * Simple autocorrelation pitch detection.
 */
export function autoCorrelate(buffer, sampleRate) {
    const SIZE = buffer.length;
    let rms = 0;

    for (let i = 0; i < SIZE; i++) {
        const val = buffer[i];
        rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);

    if (rms < 0.001) return -1; // Too quiet

    let r1 = 0, r2 = SIZE - 1, thres = 0.2;
    for (let i = 0; i < SIZE / 2; i++) {
        if (Math.abs(buffer[i]) < thres) { r1 = i; break; }
    }
    for (let i = 1; i < SIZE / 2; i++) {
        if (Math.abs(buffer[SIZE - i]) < thres) { r2 = SIZE - i; break; }
    }

    const buf2 = buffer.slice(r1, r2);
    const c = new Array(buf2.length).fill(0);

    for (let i = 0; i < buf2.length; i++) {
        for (let j = 0; j < buf2.length - i; j++) {
            c[i] = c[i] + buf2[j] * buf2[j + i];
        }
    }

    let d = 0;
    while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < buf2.length; i++) {
        if (c[i] > maxval) {
            maxval = c[i];
            maxpos = i;
        }
    }
    let T0 = maxpos;

    // Parabolic interpolation
    const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a) T0 = T0 - b / (2 * a);

    return sampleRate / T0;
}

/**
 * Calculates Spectral Centroid.
 */
export function getSpectralCentroid(frequencyData, sampleRate) {
    let numerator = 0;
    let denominator = 0;
    const binSize = sampleRate / (frequencyData.length * 2);

    for (let i = 0; i < frequencyData.length; i++) {
        const magnitude = frequencyData[i];
        const frequency = i * binSize;
        numerator += frequency * magnitude;
        denominator += magnitude;
    }

    if (denominator === 0) return 0;
    return numerator / denominator;
}


/**
 * Detects BPM from an AudioBuffer.
 */
export async function detectBPM(audioBuffer) {
    try {
        const channelData = audioBuffer.getChannelData(0); // Use first channel
        const sampleRate = audioBuffer.sampleRate;

        // 1. Calculate volume peaks
        const windowSize = Math.floor(sampleRate * 0.05);
        let peaks = [];
        for (let i = 0; i < channelData.length; i += windowSize) {
            let max = 0;
            for (let j = 0; j < windowSize && i + j < channelData.length; j++) {
                const vol = Math.abs(channelData[i + j]);
                if (vol > max) max = vol;
            }
            peaks.push(max);
        }

        // 2. Find significantly high peaks (beats)
        const sortedPeaks = [...peaks].sort((a, b) => b - a);
        const threshold = sortedPeaks[Math.floor(peaks.length * 0.3)] * 0.8;

        const beatIndices = [];
        for (let i = 0; i < peaks.length; i++) {
            if (peaks[i] > threshold) {
                if (beatIndices.length === 0 || i - beatIndices[beatIndices.length - 1] > 4) {
                    beatIndices.push(i);
                }
            }
        }

        // 3. Calculate intervals
        const intervals = [];
        for (let i = 1; i < beatIndices.length; i++) {
            const interval = beatIndices[i] - beatIndices[i - 1];
            intervals.push(interval);
        }

        // 4. Find most common interval (mode)
        const counts = {};
        intervals.forEach(interval => {
            const rounded = Math.round(interval);
            counts[rounded] = (counts[rounded] || 0) + 1;
        });

        let maxCount = 0;
        let commonInterval = 0;
        for (const interval in counts) {
            if (counts[interval] > maxCount) {
                maxCount = counts[interval];
                commonInterval = Number(interval);
            }
        }

        if (commonInterval === 0) return 0;

        let bpm = Math.round(60 / (commonInterval * 0.05));

        while (bpm < 70) bpm *= 2;
        while (bpm > 180) bpm /= 2;

        return Math.round(bpm);

    } catch (e) {
        console.error("BPM Detection failed", e);
        return 0;
    }
}

/**
 * Detects Pitch Range using Histogram Analysis.
 * Filters out notes that occur less than 0.5% of the time (noise).
 */
export function detectPitchRange(audioBuffer) {
    try {
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const windowSize = 2048;
        const hopSize = 8192; // ~0.18s

        const midiCounts = {}; // Histogram of MIDI notes
        let totalVoicedFrames = 0;

        // Loop buffer
        for (let i = 0; i < channelData.length; i += hopSize) {
            const chunk = channelData.slice(i, i + windowSize);
            if (chunk.length < windowSize) break;

            // RMS check
            let rms = 0;
            for (let j = 0; j < chunk.length; j++) rms += chunk[j] * chunk[j];
            rms = Math.sqrt(rms / windowSize);

            if (rms > 0.02) {
                const frequency = autoCorrelate(chunk, sampleRate);
                if (frequency !== -1 && frequency > 70 && frequency < 1100) {
                    const note = getNoteFromFrequency(frequency);
                    if (note) {
                        midiCounts[note.midi] = (midiCounts[note.midi] || 0) + 1;
                        totalVoicedFrames++;
                    }
                }
            }
        }

        if (totalVoicedFrames < 10) return null;

        // Filter: Ignore notes appearing < 0.5% of the time (noise blips)
        const threshold = totalVoicedFrames * 0.005;
        const validMidis = Object.keys(midiCounts)
            .map(Number)
            .filter(midi => midiCounts[midi] > threshold);

        if (validMidis.length === 0) return null;

        validMidis.sort((a, b) => a - b);
        const minMidi = validMidis[0];
        const maxMidi = validMidis[validMidis.length - 1];

        // Convert back to frequency/note for return
        const minFreq = A4_FREQ * Math.pow(2, (minMidi - 69) / 12);
        const maxFreq = A4_FREQ * Math.pow(2, (maxMidi - 69) / 12);

        return {
            minFreq: minFreq,
            maxFreq: maxFreq,
            minNote: getNoteFromFrequency(minFreq),
            maxNote: getNoteFromFrequency(maxFreq)
        };
    } catch (e) {
        console.error("Range detection failed", e);
        return null;
    }
}

/**
 * Maps a frequency range to potential voice types.
 */
export function getVoiceTypesFromRange(minFreq, maxFreq) {
    const types = [];

    if (minFreq < 100) types.push("Bass");
    if (minFreq < 130 && maxFreq > 300) types.push("Baritone");
    if (minFreq < 160 && maxFreq > 400) types.push("Tenor");
    if (minFreq > 160 && maxFreq > 500) types.push("Alto");
    if (minFreq > 240) types.push("Soprano");

    if (types.length === 0) return ["General"];

    return types.slice(0, 2);
}
