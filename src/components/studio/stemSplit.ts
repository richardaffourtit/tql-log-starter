import type { InferenceSession } from 'onnxruntime-web';

export type StemName = 'drums' | 'bass' | 'vocals' | 'other';

export interface Stems {
    sampleRate: number;
    drums: Float32Array[];
    bass: Float32Array[];
    vocals: Float32Array[];
    other: Float32Array[];
}

export interface DemixerOptions {
    modelUrl: string;
    onProgress?: (pct: number) => void;
}

export interface Demixer {
    split(buffer: AudioBuffer): Promise<Stems>;
    dispose(): void;
}

async function loadOrt() {
    const ort = await import('onnxruntime-web');
    return ort;
}

export async function createDemixer(opts: DemixerOptions): Promise<Demixer> {
    const ort = await loadOrt();
    const session: InferenceSession = await ort.InferenceSession.create(opts.modelUrl, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all'
    });

    return {
        async split(buffer: AudioBuffer): Promise<Stems> {
            const sr = buffer.sampleRate;
            const channels = Math.min(2, buffer.numberOfChannels);
            const left = buffer.getChannelData(0);
            const right = channels > 1 ? buffer.getChannelData(1) : left;

            const segLen = 44100 * 10;
            const hopLen = 44100 * 8;
            const total = buffer.length;
            const out: Record<StemName, Float32Array[]> = {
                drums: [new Float32Array(total), new Float32Array(total)],
                bass: [new Float32Array(total), new Float32Array(total)],
                vocals: [new Float32Array(total), new Float32Array(total)],
                other: [new Float32Array(total), new Float32Array(total)]
            };

            let start = 0;
            while (start < total) {
                const end = Math.min(total, start + segLen);
                const segL = new Float32Array(segLen);
                const segR = new Float32Array(segLen);
                segL.set(left.subarray(start, end));
                segR.set(right.subarray(start, end));

                const input = new ort.Tensor('float32', concat(segL, segR), [1, 2, segLen]);
                const result = await session.run({ input });

                const stems: StemName[] = ['drums', 'bass', 'vocals', 'other'];
                stems.forEach((name, i) => {
                    const data = result[Object.keys(result)[i]].data as Float32Array;
                    for (let s = start; s < end; s++) {
                        out[name][0][s] = data[s - start];
                        out[name][1][s] = data[segLen + (s - start)];
                    }
                });

                opts.onProgress?.(Math.min(1, end / total));
                start += hopLen;
                await Promise.resolve();
            }

            return { sampleRate: sr, ...out };
        },
        dispose() {
            session.release();
        }
    };
}

function concat(a: Float32Array, b: Float32Array): Float32Array {
    const out = new Float32Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
}

export function stemToAudioBuffer(
    ctx: AudioContext,
    channels: Float32Array[],
    sampleRate: number
): AudioBuffer {
    const buf = ctx.createBuffer(channels.length, channels[0].length, sampleRate);
    channels.forEach((ch, i) => buf.copyToChannel(ch as Float32Array<ArrayBuffer>, i));
    return buf;
}
