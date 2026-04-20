import { useCallback, useEffect, useRef, useState } from 'react';

export type StemRole = 'drums' | 'bass' | 'vocals' | 'other' | 'keys' | 'guitar' | 'synth' | 'fx';

export interface StemTrack {
    id: string;
    name: string;
    role: StemRole;
    buffer: AudioBuffer;
    color: string;
    muted: boolean;
    solo: boolean;
    gain: number;
}

export interface StemsState {
    tracks: StemTrack[];
    ready: boolean;
}

export interface UseStems {
    state: StemsState;
    analysers: Map<string, AnalyserNode>;
    loadFiles: (files: File[]) => Promise<void>;
    remove: (id: string) => void;
    toggleMute: (id: string) => void;
    toggleSolo: (id: string) => void;
    setGain: (id: string, g: number) => void;
    setRole: (id: string, role: StemRole) => void;
    rename: (id: string, name: string) => void;
    attachContext: (ctx: AudioContext, targets: AudioNode[]) => void;
    start: (offsetSec: number, atCtxTime?: number) => void;
    stop: () => void;
}

const ROLE_COLORS: Record<StemRole, string> = {
    drums: '#ff6a3d',
    bass: '#3ab3ff',
    vocals: '#e46ca0',
    keys: '#a855f7',
    guitar: '#ffd166',
    synth: '#8fc9a0',
    fx: '#00e0c0',
    other: '#ffffff'
};

function guessRole(name: string): StemRole {
    const n = name.toLowerCase();
    if (/drum|kick|snare|hat|perc|beat/.test(n)) return 'drums';
    if (/bass|sub|808/.test(n)) return 'bass';
    if (/voc|vox|lead|sing|acap/.test(n)) return 'vocals';
    if (/key|piano|rhodes|pad/.test(n)) return 'keys';
    if (/guit|gtr/.test(n)) return 'guitar';
    if (/synth|saw|pluck/.test(n)) return 'synth';
    if (/fx|riser|impact|fill/.test(n)) return 'fx';
    return 'other';
}

function makeId() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `stem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function useStems(): UseStems {
    const [state, setState] = useState<StemsState>({ tracks: [], ready: false });
    const ctxRef = useRef<AudioContext | null>(null);
    const targetsRef = useRef<AudioNode[]>([]);
    const analysersRef = useRef<Map<string, AnalyserNode>>(new Map());
    const gainsRef = useRef<Map<string, GainNode>>(new Map());
    const sourcesRef = useRef<Map<string, AudioBufferSourceNode>>(new Map());
    const tracksRef = useRef<StemTrack[]>([]);

    useEffect(() => {
        tracksRef.current = state.tracks;
    }, [state.tracks]);

    const attachContext = useCallback((ctx: AudioContext, targets: AudioNode[]) => {
        ctxRef.current = ctx;
        targetsRef.current = targets;
        for (const t of tracksRef.current) {
            ensureNodes(t);
        }
    }, []);

    const ensureNodes = (t: StemTrack) => {
        const ctx = ctxRef.current;
        if (!ctx) return;
        if (!analysersRef.current.has(t.id)) {
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 1024;
            analyser.smoothingTimeConstant = 0.7;
            const gain = ctx.createGain();
            gain.gain.value = t.muted ? 0 : t.gain;
            gain.connect(analyser);
            const targets = targetsRef.current.length ? targetsRef.current : [ctx.destination];
            for (const tgt of targets) analyser.connect(tgt);
            analysersRef.current.set(t.id, analyser);
            gainsRef.current.set(t.id, gain);
        }
    };

    const applyMixing = useCallback(() => {
        const tracks = tracksRef.current;
        const anySolo = tracks.some((t) => t.solo);
        for (const t of tracks) {
            const g = gainsRef.current.get(t.id);
            if (!g) continue;
            const active = anySolo ? t.solo : !t.muted;
            g.gain.value = active ? t.gain : 0;
        }
    }, []);

    useEffect(() => {
        applyMixing();
    }, [state.tracks, applyMixing]);

    const loadFiles = useCallback(async (files: File[]) => {
        if (!files.length) return;
        let ctx = ctxRef.current;
        if (!ctx) {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            ctx = new AudioCtx();
            ctxRef.current = ctx;
        }
        const decoded: StemTrack[] = [];
        for (const f of files) {
            try {
                const ab = await f.arrayBuffer();
                const buffer = await ctx.decodeAudioData(ab.slice(0));
                const role = guessRole(f.name);
                const track: StemTrack = {
                    id: makeId(),
                    name: f.name.replace(/\.[^.]+$/, ''),
                    role,
                    buffer,
                    color: ROLE_COLORS[role],
                    muted: false,
                    solo: false,
                    gain: 1
                };
                decoded.push(track);
            } catch {
                // skip files that fail to decode
            }
        }
        decoded.forEach(ensureNodes);
        setState((s) => ({ ready: true, tracks: [...s.tracks, ...decoded] }));
    }, []);

    const remove = useCallback((id: string) => {
        const src = sourcesRef.current.get(id);
        src?.stop();
        sourcesRef.current.delete(id);
        analysersRef.current.get(id)?.disconnect();
        gainsRef.current.get(id)?.disconnect();
        analysersRef.current.delete(id);
        gainsRef.current.delete(id);
        setState((s) => ({ ...s, tracks: s.tracks.filter((t) => t.id !== id) }));
    }, []);

    const toggleMute = useCallback((id: string) => {
        setState((s) => ({
            ...s,
            tracks: s.tracks.map((t) => (t.id === id ? { ...t, muted: !t.muted } : t))
        }));
    }, []);
    const toggleSolo = useCallback((id: string) => {
        setState((s) => ({
            ...s,
            tracks: s.tracks.map((t) => (t.id === id ? { ...t, solo: !t.solo } : t))
        }));
    }, []);
    const setGain = useCallback((id: string, g: number) => {
        setState((s) => ({
            ...s,
            tracks: s.tracks.map((t) => (t.id === id ? { ...t, gain: g } : t))
        }));
    }, []);
    const setRole = useCallback((id: string, role: StemRole) => {
        setState((s) => ({
            ...s,
            tracks: s.tracks.map((t) =>
                t.id === id ? { ...t, role, color: ROLE_COLORS[role] } : t
            )
        }));
    }, []);
    const rename = useCallback((id: string, name: string) => {
        setState((s) => ({
            ...s,
            tracks: s.tracks.map((t) => (t.id === id ? { ...t, name } : t))
        }));
    }, []);

    const stop = useCallback(() => {
        for (const [, src] of sourcesRef.current) {
            try {
                src.stop();
            } catch {
                // already stopped
            }
            src.disconnect();
        }
        sourcesRef.current.clear();
    }, []);

    const start = useCallback(
        (offsetSec: number, atCtxTime?: number) => {
            const ctx = ctxRef.current;
            if (!ctx) return;
            stop();
            const when = atCtxTime ?? ctx.currentTime + 0.02;
            for (const t of tracksRef.current) {
                const analyser = analysersRef.current.get(t.id);
                const gain = gainsRef.current.get(t.id);
                if (!analyser || !gain) continue;
                const src = ctx.createBufferSource();
                src.buffer = t.buffer;
                src.connect(gain);
                const safeOffset = Math.max(0, Math.min(offsetSec, t.buffer.duration - 0.001));
                src.start(when, safeOffset);
                sourcesRef.current.set(t.id, src);
            }
        },
        [stop]
    );

    return {
        state,
        analysers: analysersRef.current,
        loadFiles,
        remove,
        toggleMute,
        toggleSolo,
        setGain,
        setRole,
        rename,
        attachContext,
        start,
        stop
    };
}
