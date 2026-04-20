const MIN_FREQ = 55;
const MAX_FREQ = 2200;

export interface DetectedPitch {
    midi: number;
    magnitude: number;
}

export function detectPitchesFromFft(
    freq: Uint8Array,
    sampleRate: number,
    fftSize: number,
    options: { maxPitches?: number; threshold?: number } = {}
): DetectedPitch[] {
    const { maxPitches = 4, threshold = 110 } = options;
    const binHz = sampleRate / fftSize;
    const minBin = Math.max(1, Math.floor(MIN_FREQ / binHz));
    const maxBin = Math.min(freq.length - 2, Math.ceil(MAX_FREQ / binHz));

    const peaks: { bin: number; mag: number }[] = [];
    for (let i = minBin; i <= maxBin; i++) {
        const v = freq[i];
        if (v < threshold) continue;
        if (v > freq[i - 1] && v >= freq[i + 1]) {
            peaks.push({ bin: i, mag: v });
        }
    }
    if (!peaks.length) return [];

    peaks.sort((a, b) => b.mag - a.mag);
    const picked: { bin: number; mag: number }[] = [];
    for (const p of peaks) {
        let dup = false;
        for (const q of picked) {
            const r = p.bin / q.bin;
            if (r > 0.98 && r < 1.02) {
                dup = true;
                break;
            }
            if ((Math.abs(r - 2) < 0.04 || Math.abs(r - 3) < 0.04) && p.mag < q.mag * 0.9) {
                dup = true;
                break;
            }
        }
        if (!dup) picked.push(p);
        if (picked.length >= maxPitches) break;
    }

    const seen = new Set<number>();
    const out: DetectedPitch[] = [];
    for (const p of picked) {
        const freqHz = p.bin * binHz;
        const midi = Math.round(69 + 12 * Math.log2(freqHz / 440));
        if (midi < 24 || midi > 108) continue;
        if (seen.has(midi)) continue;
        seen.add(midi);
        out.push({ midi, magnitude: p.mag });
    }
    return out;
}

export function smoothPitches(
    prev: number[],
    current: number[],
    hysteresisFrames: number,
    ageMap: Map<number, number>
): number[] {
    const currentSet = new Set(current);
    for (const m of current) ageMap.set(m, hysteresisFrames);
    for (const m of prev) {
        if (!currentSet.has(m)) {
            const age = (ageMap.get(m) ?? 0) - 1;
            if (age > 0) {
                ageMap.set(m, age);
                currentSet.add(m);
            } else {
                ageMap.delete(m);
            }
        }
    }
    return Array.from(currentSet);
}
