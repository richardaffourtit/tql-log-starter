import { useEffect, useRef, useState, useCallback } from 'react';
import * as alphaTab from '@coderline/alphatab';
import { Midi } from '@tonejs/midi';

export type ScoreKind = 'alphatab' | 'midi';

export interface MidiNoteEvent {
    time: number;
    duration: number;
    midi: number;
    velocity: number;
    track: number;
}

export interface ScoreState {
    kind: ScoreKind | null;
    fileName: string | null;
    midi: Midi | null;
    notes: MidiNoteEvent[];
    midiDuration: number;
    ready: boolean;
    error: string | null;
}

const INITIAL: ScoreState = {
    kind: null,
    fileName: null,
    midi: null,
    notes: [],
    midiDuration: 0,
    ready: false,
    error: null
};

export interface UseScore {
    state: ScoreState;
    containerRef: React.RefObject<HTMLDivElement>;
    api: alphaTab.AlphaTabApi | null;
    load: (file: File) => Promise<void>;
    scoreImage: HTMLImageElement | null;
    scoreImageSize: { w: number; h: number } | null;
}

function detectKind(name: string): ScoreKind {
    const lower = name.toLowerCase();
    if (lower.endsWith('.mid') || lower.endsWith('.midi')) return 'midi';
    return 'alphatab';
}

async function svgToImage(svgString: string): Promise<{ img: HTMLImageElement; w: number; h: number }> {
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('svg load failed'));
        img.src = url;
    });
    return { img, w: img.naturalWidth || 1200, h: img.naturalHeight || 600 };
}

export function useScore(): UseScore {
    const [state, setState] = useState<ScoreState>(INITIAL);
    const containerRef = useRef<HTMLDivElement>(null);
    const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);
    const [scoreImage, setScoreImage] = useState<HTMLImageElement | null>(null);
    const [scoreImageSize, setScoreImageSize] = useState<{ w: number; h: number } | null>(null);

    const ensureApi = useCallback(() => {
        if (apiRef.current) return apiRef.current;
        if (!containerRef.current) return null;
        const settings: any = {
            core: {
                engine: 'svg',
                logLevel: 0
            },
            display: {
                layoutMode: 'horizontal',
                staveProfile: 'scoretab'
            },
            player: {
                enablePlayer: false,
                enableCursor: false,
                enableUserInteraction: false
            }
        };
        const api = new alphaTab.AlphaTabApi(containerRef.current, settings);
        apiRef.current = api;
        api.renderFinished.on(() => {
            const container = containerRef.current;
            if (!container) return;
            const svgs = container.querySelectorAll('svg');
            if (!svgs.length) return;
            let totalW = 0;
            let maxH = 0;
            const parts: string[] = [];
            svgs.forEach((svg) => {
                const rect = svg.getBoundingClientRect();
                const w = Math.round(svg.viewBox.baseVal.width || rect.width || 0);
                const h = Math.round(svg.viewBox.baseVal.height || rect.height || 0);
                totalW += w;
                maxH = Math.max(maxH, h);
                parts.push(new XMLSerializer().serializeToString(svg));
            });
            if (!totalW) return;
            let x = 0;
            const inner = svgs.length
                ? Array.from(svgs)
                      .map((svg) => {
                          const w = Math.round(svg.viewBox.baseVal.width || svg.getBoundingClientRect().width || 0);
                          const h = Math.round(svg.viewBox.baseVal.height || svg.getBoundingClientRect().height || 0);
                          const s = new XMLSerializer().serializeToString(svg);
                          const stripped = s.replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
                          const out = `<g transform="translate(${x},0)">${stripped}</g>`;
                          x += w;
                          return out;
                      })
                      .join('')
                : parts.join('');
            const composed = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${maxH}" viewBox="0 0 ${totalW} ${maxH}">${inner}</svg>`;
            svgToImage(composed).then(({ img, w, h }) => {
                setScoreImage(img);
                setScoreImageSize({ w, h });
                setState((s) => ({ ...s, ready: true }));
            });
        });
        api.error.on((e: any) => {
            setState((s) => ({ ...s, error: String(e?.message || e) }));
        });
        return api;
    }, []);

    const load = useCallback(
        async (file: File) => {
            const kind = detectKind(file.name);
            setState({ ...INITIAL, kind, fileName: file.name });
            setScoreImage(null);
            setScoreImageSize(null);

            if (kind === 'midi') {
                const buf = await file.arrayBuffer();
                const midi = new Midi(buf);
                const notes: MidiNoteEvent[] = [];
                midi.tracks.forEach((t, ti) => {
                    t.notes.forEach((n) => {
                        notes.push({
                            time: n.time,
                            duration: n.duration,
                            midi: n.midi,
                            velocity: n.velocity,
                            track: ti
                        });
                    });
                });
                notes.sort((a, b) => a.time - b.time);
                setState({
                    kind: 'midi',
                    fileName: file.name,
                    midi,
                    notes,
                    midiDuration: midi.duration,
                    ready: true,
                    error: null
                });
                return;
            }

            const api = ensureApi();
            if (!api) {
                setState((s) => ({ ...s, error: 'AlphaTab container not mounted' }));
                return;
            }
            const buf = await file.arrayBuffer();
            api.load(new Uint8Array(buf));
        },
        [ensureApi]
    );

    useEffect(() => {
        return () => {
            apiRef.current?.destroy();
            apiRef.current = null;
        };
    }, []);

    return {
        state,
        containerRef,
        api: apiRef.current,
        load,
        scoreImage,
        scoreImageSize
    };
}
