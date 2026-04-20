export type Instrument = 'guitar' | 'bass' | 'uke' | 'guitar7';
export type TuningName = 'standard' | 'dropd' | 'dadgad' | 'openG' | 'halfdown';

export const INSTRUMENT_LABEL: Record<Instrument, string> = {
    guitar: 'guitar · 6 string',
    bass: 'bass · 4 string',
    uke: 'ukulele · 4 string',
    guitar7: 'guitar · 7 string'
};

export const TUNING_LABEL: Record<TuningName, string> = {
    standard: 'standard',
    dropd: 'drop d',
    dadgad: 'dadgad',
    openG: 'open g',
    halfdown: 'eb standard'
};

export const TUNINGS: Record<Instrument, Record<TuningName, number[]>> = {
    guitar: {
        standard: [40, 45, 50, 55, 59, 64],
        dropd: [38, 45, 50, 55, 59, 64],
        dadgad: [38, 45, 50, 55, 57, 62],
        openG: [38, 43, 50, 55, 59, 62],
        halfdown: [39, 44, 49, 54, 58, 63]
    },
    bass: {
        standard: [28, 33, 38, 43],
        dropd: [26, 33, 38, 43],
        dadgad: [28, 33, 38, 43],
        openG: [28, 33, 38, 43],
        halfdown: [27, 32, 37, 42]
    },
    uke: {
        standard: [67, 60, 64, 69],
        dropd: [67, 60, 64, 69],
        dadgad: [67, 60, 64, 69],
        openG: [67, 60, 64, 69],
        halfdown: [67, 60, 64, 69]
    },
    guitar7: {
        standard: [35, 40, 45, 50, 55, 59, 64],
        dropd: [35, 38, 45, 50, 55, 59, 64],
        dadgad: [35, 38, 45, 50, 55, 57, 62],
        openG: [35, 38, 43, 50, 55, 59, 62],
        halfdown: [34, 39, 44, 49, 54, 58, 63]
    }
};

export interface FretNote {
    time: number;
    duration: number;
    pitch: number;
    velocity?: number;
    string: number;
    fret: number;
}

export interface SourceNote {
    time: number;
    duration: number;
    pitch: number;
    velocity?: number;
}

export function assignStrings(
    notes: SourceNote[],
    instrument: Instrument,
    tuning: TuningName,
    maxFret = 22
): FretNote[] {
    const strings = TUNINGS[instrument][tuning];
    return notes.map((n) => {
        let best: { string: number; fret: number; cost: number } | null = null;
        for (let s = strings.length - 1; s >= 0; s--) {
            const fret = n.pitch - strings[s];
            if (fret >= 0 && fret <= maxFret) {
                const cost = fret + (strings.length - s) * 0.1;
                if (!best || cost < best.cost) best = { string: s, fret, cost };
            }
        }
        if (!best) {
            const mid = Math.floor(strings.length / 2);
            let p = n.pitch;
            while (p < strings[mid]) p += 12;
            while (p > strings[mid] + maxFret) p -= 12;
            best = { string: mid, fret: Math.max(0, Math.min(maxFret, p - strings[mid])), cost: 999 };
        }
        return { ...n, string: best.string, fret: best.fret };
    });
}
