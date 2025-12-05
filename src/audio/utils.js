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

    return {
        name: noteName,
        octave: octave,
        fullName: `${noteName}${octave}`,
        cents: cents,
        frequency: frequency,
        midi: roundedNote
    };
}

/**
 * Simple autocorrelation pitch detection.
 * Ideally we'd use McLeod Pitch Method or YIN for better accuracy, but this is a good start for pure JS.
 */
export function autoCorrelate(buffer, sampleRate) {
    const SIZE = buffer.length;
    let rms = 0;

    for (let i = 0; i < SIZE; i++) {
        const val = buffer[i];
        rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);

    if (rms < 0.001) return -1; // Too quiet (allow very low signals, gate them later)

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
 * Calculates Spectral Centroid (Center of Mass of the spectrum).
 * Indicates "Brightness" or "Timbre". 
 * Higher centroid = Brighter sound (often associated with Belting, Straining, or Head voice depending on context).
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
