export type AutocutMode = 'manual' | 'bpm' | 'onsets' | 'sections';

export interface AutocutConfig {
    mode: AutocutMode;
    bpm: number;
    barsPerCut: number;
    resolution: number;
    startTime: number;
    endTime: number;
}

export function cutsFromBpm(
    bpm: number,
    barsPerCut: number,
    startTime: number,
    endTime: number,
    beatsPerBar = 4
): number[] {
    if (bpm <= 0 || barsPerCut <= 0 || endTime <= startTime) return [];
    const secondsPerBeat = 60 / bpm;
    const secondsPerCut = secondsPerBeat * beatsPerBar * barsPerCut;
    const cuts: number[] = [];
    for (let t = startTime; t <= endTime + 1e-6; t += secondsPerCut) {
        cuts.push(Math.round(t * 1000) / 1000);
    }
    return cuts;
}

export interface OnsetOptions {
    resolution: number;
    frameSize?: number;
    hopSize?: number;
    minGapSec?: number;
}

export function detectOnsets(buffer: AudioBuffer, opts: OnsetOptions): number[] {
    const res = Math.min(1, Math.max(0, opts.resolution));
    const frameSize = opts.frameSize ?? 2048;
    const hopSize = opts.hopSize ?? 512;
    const minGap = opts.minGapSec ?? 0.12;
    const sr = buffer.sampleRate;
    const channels = buffer.numberOfChannels;
    const chs: Float32Array[] = [];
    for (let c = 0; c < channels; c++) chs.push(buffer.getChannelData(c));

    const mono = new Float32Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
        let v = 0;
        for (let c = 0; c < channels; c++) v += chs[c][i];
        mono[i] = v / channels;
    }

    const numFrames = Math.max(0, Math.floor((buffer.length - frameSize) / hopSize));
    const flux = new Float32Array(numFrames);
    const prevMag = new Float32Array(frameSize / 2);
    const frame = new Float32Array(frameSize);
    const windowFn = new Float32Array(frameSize);
    for (let i = 0; i < frameSize; i++) {
        windowFn[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (frameSize - 1));
    }

    for (let f = 0; f < numFrames; f++) {
        const start = f * hopSize;
        for (let i = 0; i < frameSize; i++) frame[i] = mono[start + i] * windowFn[i];
        const mag = magnitudeSpectrum(frame);
        let sum = 0;
        for (let k = 0; k < mag.length; k++) {
            const diff = mag[k] - prevMag[k];
            if (diff > 0) sum += diff;
            prevMag[k] = mag[k];
        }
        flux[f] = sum;
    }

    let max = 0;
    for (let i = 0; i < flux.length; i++) if (flux[i] > max) max = flux[i];
    if (!max) return [];
    for (let i = 0; i < flux.length; i++) flux[i] /= max;

    const winRad = Math.max(4, Math.round(20 * (1 - res * 0.6)));
    const threshold = 0.18 + (1 - res) * 0.55;
    const minGapFrames = Math.round((minGap * sr) / hopSize);

    const onsets: number[] = [];
    let lastOnset = -Infinity;
    for (let i = 0; i < flux.length; i++) {
        let localMax = true;
        for (let j = Math.max(0, i - winRad); j <= Math.min(flux.length - 1, i + winRad); j++) {
            if (flux[j] > flux[i]) {
                localMax = false;
                break;
            }
        }
        if (!localMax) continue;
        if (flux[i] < threshold) continue;
        if (i - lastOnset < minGapFrames) continue;
        lastOnset = i;
        onsets.push(Math.round(((i * hopSize) / sr) * 1000) / 1000);
    }
    return onsets;
}

function magnitudeSpectrum(signal: Float32Array): Float32Array {
    const n = signal.length;
    const half = n / 2;
    const re = new Float32Array(n);
    const im = new Float32Array(n);
    re.set(signal);
    fftInPlace(re, im);
    const mag = new Float32Array(half);
    for (let k = 0; k < half; k++) mag[k] = Math.hypot(re[k], im[k]);
    return mag;
}

function fftInPlace(re: Float32Array, im: Float32Array) {
    const n = re.length;
    let j = 0;
    for (let i = 1; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
            [re[i], re[j]] = [re[j], re[i]];
            [im[i], im[j]] = [im[j], im[i]];
        }
    }
    for (let size = 2; size <= n; size <<= 1) {
        const half = size >> 1;
        const ang = (-2 * Math.PI) / size;
        const wRe = Math.cos(ang);
        const wIm = Math.sin(ang);
        for (let i = 0; i < n; i += size) {
            let cRe = 1;
            let cIm = 0;
            for (let k = 0; k < half; k++) {
                const tRe = cRe * re[i + k + half] - cIm * im[i + k + half];
                const tIm = cRe * im[i + k + half] + cIm * re[i + k + half];
                re[i + k + half] = re[i + k] - tRe;
                im[i + k + half] = im[i + k] - tIm;
                re[i + k] += tRe;
                im[i + k] += tIm;
                const nRe = cRe * wRe - cIm * wIm;
                cIm = cRe * wIm + cIm * wRe;
                cRe = nRe;
            }
        }
    }
}

export function sectionCuts(_buffer: AudioBuffer, _resolution: number): number[] {
    return [];
}
