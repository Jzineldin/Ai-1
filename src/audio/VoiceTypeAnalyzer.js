/**
 * Heuristic Voice Type Classifier
 * Uses fundamental frequency (pitch) to estimate register.
 * NOTE: This is an approximation. Real voice classification requires timbre analysis and physical examination.
 * 
 * Approximate Ranges (very general):
 * - Chest: Lowest part of range (e.g., G2-E4 for men, G3-A4 for women)
 * - Mix: Middle transition (e.g., E4-A4 for men, A4-D5 for women)
 * - Head: Upper part of range (e.g., A4+ for men, D5+ for women)
 * 
 * We will use a "General" preset for now, but really this should be calibrated to the user.
 */

/* eslint-disable no-unused-vars */

export function analyzeVoiceType(pitch, centroid, volume, gender = 'male') {
    if (!pitch || pitch < 50) return { type: 'Silence', confidence: 0, isStraining: false };

    // Adjusted Thresholds
    // Men often mix well up to C5 (523Hz) or even higher
    const thresholds = gender === 'female'
        ? { chestHigh: 440, mixHigh: 880 } // A4 - A5 (Female mix is huge)
        : { chestHigh: 330, mixHigh: 540 }; // E4 - ~C#5 (Male mix extension)

    let result = { type: 'Unknown', confidence: 0, color: 'text-gray-500', isStraining: false };

    // 1. Classification
    if (pitch < thresholds.chestHigh) {
        result = { type: 'Chest Voice', confidence: 0.9, color: 'text-blue-400' };

        // Detect "Pressed Chest" if very bright low down
        if (centroid > 2500) result.type = "Heavy Chest (Pressed)";

        // Detect Low Head Voice / Falsetto (Breathy/Hooty)
        // Chest voice is naturally rich in harmonics. If the sound is "pure" (low centroid),
        // it is likely Head Voice produced at a lower pitch.
        // Heuristic: Centroid is close to fundamental (few overtones).
        if (centroid < pitch * 4.5) {
            result = { type: 'Head Voice', confidence: 0.7, color: 'text-pink-300' };
        }
    }
    else if (pitch < thresholds.mixHigh) {
        // TRANSITION ZONE: E4 - C#5
        // This is key. Mix vs Head depends on TIMBRE (Centroid/Brightness) and Power.

        // Head voice is usually "pure" (fewer overtones) -> Lower Centroid relative to pitch
        // Mix/Belt is "buzzy" (lots of overtones) -> Higher Centroid

        // Heuristic: If it's loud and bright, it's Mix. If it's pure/darker, it's Head.
        const isBright = centroid > 3000;
        const isLoud = volume > 0.05;

        if (isBright && isLoud) {
            // It's a Mix
            if (centroid < 4000) {
                result = { type: 'Heavy Mix', confidence: 0.8, color: 'text-purple-500' };
            } else {
                result = { type: 'Light Mix', confidence: 0.8, color: 'text-purple-300' };
            }
        }
        else {
            // Quieter or Darker -> Head Voice / Falsetto
            result = { type: 'Head Voice', confidence: 0.8, color: 'text-pink-400' };

            // If it's REALLY bright but quiet, it's likely a weird reinforced falsetto, still Head.
        }

        // Overwrite if it's smack in the middle and decently powerful -> Balanced Mix
        if (volume > 0.08 && centroid > 2500 && centroid < 4000) {
            result = { type: 'Balanced Mix', confidence: 0.8, color: 'text-purple-400' };
        }
    }
    else {
        // Very High Pitch (> C#5 for men)
        // Usually Head, unless Super Head / Whistle OR a crazy high belt
        if (volume > 0.2 && centroid > 4000) {
            result = { type: 'High Belt (Mix)', confidence: 0.6, color: 'text-red-400' };
        } else {
            result = { type: 'Head Voice', confidence: 0.9, color: 'text-pink-400' };
        }
    }

    // 3. Strain Detection
    // Absolute thresholds for safety
    if (volume > 0.35 && centroid > 5500) {
        result.isStraining = true;
    }

    // Relative strain
    if (pitch > thresholds.mixHigh && volume > 0.25 && centroid > 5000) {
        result.isStraining = true;
    }

    if (result.isStraining) {
        result.color = 'text-red-500 animate-pulse';
        result.type += ' (Strained)';
    }

    return result;
}
