// Generate common chord progressions based on song key
// This provides chord progressions for songs that don't have them in the database

const KEY_TO_CHORDS = {
    // Major keys - I, IV, V, vi progression (most common)
    'C Major': ['C', 'F', 'G', 'Am'],
    'D Major': ['D', 'G', 'A', 'Bm'],
    'E Major': ['E', 'A', 'B', 'C#'],
    'F Major': ['F', 'Bb', 'C', 'Dm'],
    'G Major': ['G', 'C', 'D', 'Em'],
    'A Major': ['A', 'D', 'E', 'F#'],
    'B Major': ['B', 'E', 'F#', 'G#'],
    'Bb Major': ['Bb', 'Eb', 'F', 'Gm'],
    'Eb Major': ['Eb', 'Ab', 'Bb', 'Cm'],
    'Ab Major': ['Ab', 'Db', 'Eb', 'Fm'],
    'Db Major': ['Db', 'Gb', 'Ab', 'Bbm'],
    'Gb Major': ['Gb', 'B', 'Db', 'Ebm'],
    'F# Major': ['F#', 'B', 'C#', 'D#'],
    'C# Major': ['C#', 'F#', 'G#', 'A#'],

    // Minor keys - i, iv, v, VI progression (common in minor)
    'A Minor': ['Am', 'Dm', 'Em', 'F'],
    'E Minor': ['Em', 'Am', 'Bm', 'C'],
    'B Minor': ['Bm', 'Em', 'F#', 'G'],
    'F# Minor': ['F#', 'Bm', 'C#', 'D'],
    'C# Minor': ['C#', 'F#', 'G#', 'A'],
    'G# Minor': ['G#', 'C#', 'D#', 'E'],
    'D# Minor': ['D#', 'G#', 'A#', 'B'],
    'D Minor': ['Dm', 'Gm', 'Am', 'Bb'],
    'G Minor': ['Gm', 'Cm', 'Dm', 'Eb'],
    'C Minor': ['C', 'Fm', 'Gm', 'Ab'],
    'F Minor': ['Fm', 'Bbm', 'Cm', 'Db'],
    'Bb Minor': ['Bbm', 'Ebm', 'Fm', 'Gb'],
    'Eb Minor': ['Ebm', 'Abm', 'Bbm', 'B'],
    'Ab Minor': ['Abm', 'Dbm', 'Ebm', 'E'],
};

/**
 * Generate chord progression for a song based on its key
 * @param {string} key - The musical key (e.g., "C Major", "A Minor")
 * @returns {string[]} Array of chord names
 */
export function generateChordProgression(key) {
    // Return predefined progression if available
    if (KEY_TO_CHORDS[key]) {
        return KEY_TO_CHORDS[key];
    }

    // Fallback: return generic C Major progression
    return ['C', 'G', 'Am', 'F'];
}

/**
 * Add chord progression to a song object if it doesn't have one
 * @param {object} song - Song object with at least a 'key' property
 * @returns {object} Song object with chords added
 */
export function addChordsToSong(song) {
    // If song already has chords, return as is
    if (song.chords && song.chords.length > 0) {
        return song;
    }

    // If song has a valid key, generate chords
    if (song.key && song.key !== 'Unknown' && song.key !== '-') {
        return {
            ...song,
            chords: generateChordProgression(song.key)
        };
    }

    // No valid key, return without chords
    return song;
}
