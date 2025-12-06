import React from 'react';

// Guitar chord finger positions (Low E to High E: strings 0-5)
// null = muted, 0 = open, 1-5 = fret number
const GUITAR_CHORDS = {
    'C': { fingers: [null, 3, 2, 0, 1, 0], name: 'C Major' },
    'D': { fingers: [null, null, 0, 2, 3, 2], name: 'D Major' },
    'E': { fingers: [0, 2, 2, 1, 0, 0], name: 'E Major' },
    'F': { fingers: [1, 3, 3, 2, 1, 1], name: 'F Major', barre: 1 },
    'G': { fingers: [3, 2, 0, 0, 0, 3], name: 'G Major' },
    'A': { fingers: [null, 0, 2, 2, 2, 0], name: 'A Major' },
    'B': { fingers: [null, 2, 4, 4, 4, 2], name: 'B Major', barre: 2 },
    'Am': { fingers: [null, 0, 2, 2, 1, 0], name: 'A Minor' },
    'Dm': { fingers: [null, null, 0, 2, 3, 1], name: 'D Minor' },
    'Em': { fingers: [0, 2, 2, 0, 0, 0], name: 'E Minor' },
    'Fm': { fingers: [1, 3, 3, 1, 1, 1], name: 'F Minor', barre: 1 },
    'Gm': { fingers: [3, 5, 5, 3, 3, 3], name: 'G Minor', barre: 3 },
    'Bm': { fingers: [null, 2, 4, 4, 3, 2], name: 'B Minor', barre: 2 },
    'Cm': { fingers: [null, 3, 5, 5, 4, 3], name: 'C Minor', barre: 3 },
    'C#': { fingers: [null, 4, 6, 6, 6, 4], name: 'C# Major', barre: 4 },
    'F#': { fingers: [2, 4, 4, 3, 2, 2], name: 'F# Major', barre: 2 },
    'G#': { fingers: [4, 6, 6, 5, 4, 4], name: 'G# Major', barre: 4 },
    'Bb': { fingers: [null, 1, 3, 3, 3, 1], name: 'Bb Major', barre: 1 },
    'Eb': { fingers: [null, null, 1, 3, 4, 3], name: 'Eb Major' },
    'Ab': { fingers: [4, 6, 6, 5, 4, 4], name: 'Ab Major', barre: 4 },
    'Db': { fingers: [null, 4, 6, 6, 6, 4], name: 'Db Major', barre: 4 },
    'Gb': { fingers: [2, 4, 4, 3, 2, 2], name: 'Gb Major', barre: 2 },
};

export default function ChordDiagram({ chord }) {
    const chordData = GUITAR_CHORDS[chord];

    if (!chordData) {
        return (
            <div className="flex flex-col items-center p-3 bg-white/5 rounded-lg">
                <span className="text-sm font-bold text-white mb-2">{chord}</span>
                <div className="text-xs text-gray-400">Chord not found</div>
            </div>
        );
    }

    const { fingers, name, barre } = chordData;
    const strings = 6;
    const frets = 5;

    return (
        <div className="flex flex-col items-center p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
            <span className="text-sm font-bold text-white mb-2">{chord}</span>

            {/* Guitar Fretboard */}
            <svg width="80" height="100" viewBox="0 0 80 100" className="mb-1">
                {/* Strings (vertical lines) */}
                {[...Array(strings)].map((_, i) => (
                    <line
                        key={`string-${i}`}
                        x1={15 + i * 10}
                        y1="10"
                        x2={15 + i * 10}
                        y2="90"
                        stroke="#666"
                        strokeWidth="1"
                    />
                ))}

                {/* Frets (horizontal lines) */}
                {[...Array(frets + 1)].map((_, i) => (
                    <line
                        key={`fret-${i}`}
                        x1="15"
                        y1={10 + i * 16}
                        x2="65"
                        y2={10 + i * 16}
                        stroke={i === 0 ? '#fff' : '#666'}
                        strokeWidth={i === 0 ? '3' : '1'}
                    />
                ))}

                {/* Barre indicator */}
                {barre && (
                    <rect
                        x="15"
                        y={10 + barre * 16 - 6}
                        width="50"
                        height="4"
                        fill="#10b981"
                        rx="2"
                    />
                )}

                {/* Finger positions */}
                {fingers.map((fret, stringIndex) => {
                    if (fret === null) {
                        // X mark for muted string
                        return (
                            <text
                                key={`finger-${stringIndex}`}
                                x={15 + stringIndex * 10}
                                y="6"
                                fontSize="8"
                                fill="#ef4444"
                                textAnchor="middle"
                            >
                                ×
                            </text>
                        );
                    } else if (fret === 0) {
                        // O mark for open string
                        return (
                            <circle
                                key={`finger-${stringIndex}`}
                                cx={15 + stringIndex * 10}
                                cy="5"
                                r="3"
                                fill="none"
                                stroke="#10b981"
                                strokeWidth="1.5"
                            />
                        );
                    } else {
                        // Finger position dot
                        return (
                            <circle
                                key={`finger-${stringIndex}`}
                                cx={15 + stringIndex * 10}
                                cy={10 + fret * 16 - 8}
                                r="4"
                                fill="#10b981"
                            />
                        );
                    }
                })}
            </svg>

            <span className="text-[10px] text-gray-400">{name}</span>
        </div>
    );
}
