export const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const;

export function pitchClass(pitch: number): number {
    return ((pitch % 12) + 12) % 12;
}

export function pitchColor(pitch: number, l = 60, s = 90): string {
    const hue = pitchClass(pitch) * 30;
    return `hsl(${hue}, ${s}%, ${l}%)`;
}

const INTERVAL_NAMES = [
    'unison',
    'minor 2nd',
    'major 2nd',
    'minor 3rd',
    'major 3rd',
    'perfect 4th',
    'tritone',
    'perfect 5th',
    'minor 6th',
    'major 6th',
    'minor 7th',
    'major 7th',
    'octave'
];

interface ChordType {
    ivs: number[];
    q: string;
}

const CHORD_TYPES: ChordType[] = [
    { ivs: [0, 4, 7], q: '' },
    { ivs: [0, 3, 7], q: 'm' },
    { ivs: [0, 3, 6], q: 'dim' },
    { ivs: [0, 4, 8], q: 'aug' },
    { ivs: [0, 2, 7], q: 'sus2' },
    { ivs: [0, 5, 7], q: 'sus4' },
    { ivs: [0, 4, 7, 11], q: 'maj7' },
    { ivs: [0, 3, 7, 10], q: 'm7' },
    { ivs: [0, 4, 7, 10], q: '7' },
    { ivs: [0, 3, 6, 9], q: 'dim7' },
    { ivs: [0, 3, 6, 10], q: 'm7♭5' },
    { ivs: [0, 4, 7, 9], q: '6' },
    { ivs: [0, 3, 7, 9], q: 'm6' },
    { ivs: [0, 2, 4, 7], q: 'add9' },
    { ivs: [0, 2, 3, 7], q: 'm(add9)' },
    { ivs: [0, 2, 4, 7, 11], q: 'maj9' },
    { ivs: [0, 2, 3, 7, 10], q: 'm9' },
    { ivs: [0, 2, 4, 7, 10], q: '9' }
];

function arrEq(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

export function identifyInterval(p1: number, p2: number): string {
    const s = Math.abs(p2 - p1);
    if (s <= 12) return INTERVAL_NAMES[s];
    const octs = Math.floor(s / 12);
    const rem = s % 12;
    return rem === 0 ? `${octs} octaves` : `${INTERVAL_NAMES[rem]} + ${octs} oct`;
}

export function identifyChord(pcList: number[], bassPc: number): string | null {
    const unique = [...new Set(pcList)];
    const tryOrder = [bassPc, ...unique.filter((p) => p !== bassPc)];
    for (const root of tryOrder) {
        const ivs = [...new Set(unique.map((pc) => ((pc - root) % 12 + 12) % 12))].sort((a, b) => a - b);
        for (const t of CHORD_TYPES) {
            const target = [...new Set(t.ivs.map((i) => i % 12))].sort((a, b) => a - b);
            if (arrEq(ivs, target)) {
                const name = NOTE_NAMES[root] + t.q;
                return root === bassPc ? name : `${name}/${NOTE_NAMES[bassPc]}`;
            }
        }
    }
    return null;
}

export type ReadoutLabel = 'NOTE' | 'INTERVAL' | 'CHORD' | '—';
export interface Readout {
    label: ReadoutLabel;
    value: string;
    color: string;
}

export function activeReadout(activePitches: number[], idleColor = '#888'): Readout {
    if (activePitches.length === 0) return { label: '—', value: '—', color: idleColor };
    const pcs = [...new Set(activePitches.map(pitchClass))];
    const bassPitch = Math.min(...activePitches);
    const bassPc = pitchClass(bassPitch);

    if (pcs.length === 1) {
        return { label: 'NOTE', value: NOTE_NAMES[pcs[0]], color: pitchColor(pcs[0], 68) };
    }
    if (pcs.length === 2) {
        const sorted = [...activePitches].sort((a, b) => a - b);
        return {
            label: 'INTERVAL',
            value: identifyInterval(sorted[0], sorted[1]),
            color: pitchColor(bassPc, 68)
        };
    }
    const chord = identifyChord(pcs, bassPc);
    const value = chord ?? pcs.sort((a, b) => a - b).map((pc) => NOTE_NAMES[pc]).join(' ');
    return { label: 'CHORD', value, color: pitchColor(bassPc, 68) };
}

export const DIATONIC_STEP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
export const NEEDS_SHARP = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
