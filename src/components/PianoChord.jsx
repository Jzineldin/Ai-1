import React from 'react';

// Piano chord note positions within one octave (C=0, C#=1, D=2, ..., B=11)
// Each chord shows root, third, and fifth
const PIANO_CHORDS = {
    // Major chords (Root, Major 3rd, Perfect 5th)
    'C': { notes: [0, 4, 7], name: 'C Major' },      // C, E, G
    'D': { notes: [2, 6, 9], name: 'D Major' },      // D, F#, A
    'E': { notes: [4, 8, 11], name: 'E Major' },     // E, G#, B
    'F': { notes: [5, 9, 0], name: 'F Major' },      // F, A, C
    'G': { notes: [7, 11, 2], name: 'G Major' },     // G, B, D
    'A': { notes: [9, 1, 4], name: 'A Major' },      // A, C#, E
    'B': { notes: [11, 3, 6], name: 'B Major' },     // B, D#, F#
    'C#': { notes: [1, 5, 8], name: 'C# Major' },    // C#, F, G#
    'Db': { notes: [1, 5, 8], name: 'Db Major' },    // Db, F, Ab (enharmonic to C#)
    'Eb': { notes: [3, 7, 10], name: 'Eb Major' },   // Eb, G, Bb
    'F#': { notes: [6, 10, 1], name: 'F# Major' },   // F#, A#, C#
    'Gb': { notes: [6, 10, 1], name: 'Gb Major' },   // Gb, Bb, Db (enharmonic to F#)
    'G#': { notes: [8, 0, 3], name: 'G# Major' },    // G#, C, D#
    'Ab': { notes: [8, 0, 3], name: 'Ab Major' },    // Ab, C, Eb (enharmonic to G#)
    'Bb': { notes: [10, 2, 5], name: 'Bb Major' },   // Bb, D, F

    // Minor chords (Root, Minor 3rd, Perfect 5th)
    'Am': { notes: [9, 0, 4], name: 'A Minor' },     // A, C, E
    'Bm': { notes: [11, 2, 6], name: 'B Minor' },    // B, D, F#
    'Cm': { notes: [0, 3, 7], name: 'C Minor' },     // C, Eb, G
    'Dm': { notes: [2, 5, 9], name: 'D Minor' },     // D, F, A
    'Em': { notes: [4, 7, 11], name: 'E Minor' },    // E, G, B
    'Fm': { notes: [5, 8, 0], name: 'F Minor' },     // F, Ab, C
    'Gm': { notes: [7, 10, 2], name: 'G Minor' },    // G, Bb, D
    'C#m': { notes: [1, 4, 8], name: 'C# Minor' },   // C#, E, G#
    'Ebm': { notes: [3, 6, 10], name: 'Eb Minor' },  // Eb, Gb, Bb
    'F#m': { notes: [6, 9, 1], name: 'F# Minor' },   // F#, A, C#
    'G#m': { notes: [8, 11, 3], name: 'G# Minor' },  // G#, B, D#
    'Bbm': { notes: [10, 1, 5], name: 'Bb Minor' },  // Bb, Db, F
};

export default function PianoChord({ chord }) {
    const chordData = PIANO_CHORDS[chord];

    if (!chordData) {
        return (
            <div className="flex flex-col items-center p-3 bg-white/5 rounded-lg">
                <span className="text-sm font-bold text-white mb-2">{chord}</span>
                <div className="text-xs text-gray-400">Chord not found</div>
            </div>
        );
    }

    const { notes, name } = chordData;
    const whiteKeys = [0, 2, 4, 5, 7, 9, 11]; // C, D, E, F, G, A, B
    const blackKeys = [1, 3, 6, 8, 10]; // C#, D#, F#, G#, A#

    const isNoteActive = (note) => notes.includes(note);

    return (
        <div className="flex flex-col items-center p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
            <span className="text-sm font-bold text-white mb-2">{chord}</span>

            {/* Piano Keyboard */}
            <div className="relative" style={{ width: '90px', height: '60px' }}>
                {/* White keys */}
                <div className="flex absolute bottom-0">
                    {whiteKeys.map((note, index) => (
                        <div
                            key={`white-${note}`}
                            className={`border border-gray-600 ${isNoteActive(note)
                                    ? 'bg-green-400'
                                    : 'bg-white'
                                }`}
                            style={{
                                width: '12px',
                                height: '50px',
                                borderRadius: '0 0 2px 2px',
                            }}
                        />
                    ))}
                </div>

                {/* Black keys */}
                <div className="flex absolute top-0 left-0">
                    {[1, 3, null, 6, 8, 10].map((note, index) => (
                        note !== null ? (
                            <div
                                key={`black-${note}`}
                                className={`border border-gray-800 ${isNoteActive(note)
                                        ? 'bg-green-500'
                                        : 'bg-gray-900'
                                    }`}
                                style={{
                                    width: '8px',
                                    height: '30px',
                                    marginLeft: index === 0 ? '8px' : '4px',
                                    borderRadius: '0 0 2px 2px',
                                    position: 'relative',
                                    zIndex: 10,
                                }}
                            />
                        ) : (
                            <div key={`gap-${index}`} style={{ width: '12px' }} />
                        )
                    ))}
                </div>
            </div>

            <span className="text-[10px] text-gray-400 mt-1">{name}</span>
        </div>
    );
}
