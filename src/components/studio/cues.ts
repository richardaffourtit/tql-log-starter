export interface Cue {
    id: string;
    name: string;
    time: number;
    color: string;
}

export function detectSoundStart(
    buffer: AudioBuffer,
    threshold = 0.02,
    windowSec = 0.02
): number {
    const sr = buffer.sampleRate;
    const win = Math.max(1, Math.round(windowSec * sr));
    const step = Math.max(1, Math.round(0.005 * sr));
    const channels = buffer.numberOfChannels;
    const chs: Float32Array[] = [];
    for (let c = 0; c < channels; c++) chs.push(buffer.getChannelData(c));
    const total = buffer.length;
    for (let i = 0; i + win < total; i += step) {
        let sq = 0;
        for (let j = 0; j < win; j++) {
            let v = 0;
            for (let c = 0; c < channels; c++) v += chs[c][i + j];
            v /= channels;
            sq += v * v;
        }
        const rms = Math.sqrt(sq / win);
        if (rms > threshold) return i / sr;
    }
    return 0;
}

export function makeCueId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `cue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
