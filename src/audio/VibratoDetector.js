export class VibratoDetector {
    constructor() {
        this.pitchBuffer = []; // Store { time: number, pitch: number }
        this.bufferDuration = 1000; // 1 second analysis window
        this.lastUpdateTime = 0;
    }

    update(pitch, currentTime) { // currentTime in ms
        // Prune old data
        const cutoff = currentTime - this.bufferDuration;
        this.pitchBuffer = this.pitchBuffer.filter(p => p.time > cutoff);

        // Add new pitch (ignore silence/invalid)
        if (pitch && pitch > 50) {
            this.pitchBuffer.push({ time: currentTime, pitch });
        }

        // Need enough data points to detect ~5Hz oscillation (at least 200ms)
        if (this.pitchBuffer.length < 10) return { isVibrato: false, rate: 0, depth: 0 };
    }

    analyze() {
        if (this.pitchBuffer.length < 20) return { isVibrato: false, rate: 0, depth: 0 };

        // 1. Calculate Mean Pitch to find center line
        const pitches = this.pitchBuffer.map(p => p.pitch);
        const meanPitch = pitches.reduce((a, b) => a + b, 0) / pitches.length;

        // 2. Calculate Zero Crossings (oscillating around mean)
        let crossings = 0;
        let lastSign = 0;

        // Center the signal
        const centered = pitches.map(p => p - meanPitch);

        for (let i = 0; i < centered.length; i++) {
            const sign = Math.sign(centered[i]);
            if (sign !== lastSign && sign !== 0) {
                if (lastSign !== 0) crossings++;
                lastSign = sign;
            }
        }

        // 3. Calculate Amplitude/Depth (Standard Deviation or Range)
        let sumSqDiff = 0;
        let minP = Infinity, maxP = -Infinity;

        for (let p of pitches) {
            sumSqDiff += Math.pow(p - meanPitch, 2);
            minP = Math.min(minP, p);
            maxP = Math.max(maxP, p);
        }
        const stdDev = Math.sqrt(sumSqDiff / pitches.length);
        const depthCents = 1200 * Math.log2(maxP / minP); // Convert ratio to cents range

        // 4. Calculate Frequency (Rate)
        // Rate = (Crossings / 2) / (TimeSpan in seconds)
        const startTime = this.pitchBuffer[0].time;
        const endTime = this.pitchBuffer[this.pitchBuffer.length - 1].time;
        const durationSec = (endTime - startTime) / 1000;

        if (durationSec < 0.2) return { isVibrato: false, rate: 0, depth: 0 };

        const rate = (crossings / 2) / durationSec;

        // 5. Detection Logic
        // Typical Vibrato: 4Hz - 8Hz. Widened slightly to catch beginner vibrato.
        const isRateValid = rate >= 3.0 && rate <= 9.0;
        const isDepthValid = depthCents > 10 && depthCents < 250;

        let quality = "None";
        let color = "text-gray-500";

        if (isRateValid && isDepthValid) {
            if (rate >= 5.5 && rate <= 7.5 && depthCents >= 30 && depthCents <= 120) {
                quality = "Great!";
                color = "text-green-400";
            } else if (rate > 7.5) {
                quality = "Too Fast";
                color = "text-yellow-400";
            } else if (rate < 5.0) {
                quality = "Too Slow (Wobble)";
                color = "text-yellow-400";
            } else if (depthCents < 30) {
                quality = "Shallow";
                color = "text-blue-300";
            } else {
                quality = "OK";
                color = "text-blue-400";
            }
        }

        return {
            isVibrato: isRateValid && isDepthValid,
            rate: isRateValid ? rate.toFixed(1) : 0,
            depth: depthCents.toFixed(0),
            quality,
            color
        };
    }

    reset() {
        this.pitchBuffer = [];
    }
}
