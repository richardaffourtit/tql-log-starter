import { useEffect, useRef, useState, useCallback } from 'react';

export interface AudioState {
    file: File | null;
    url: string | null;
    duration: number;
    currentTime: number;
    playing: boolean;
    buffer: AudioBuffer | null;
}

export interface UseAudio {
    state: AudioState;
    audioEl: HTMLAudioElement | null;
    analyser: AnalyserNode | null;
    destination: MediaStreamAudioDestinationNode | null;
    context: AudioContext | null;
    load: (file: File) => void;
    play: () => void;
    pause: () => void;
    seek: (time: number) => void;
}

export function useAudio(fftSize = 2048): UseAudio {
    const [state, setState] = useState<AudioState>({
        file: null,
        url: null,
        duration: 0,
        currentTime: 0,
        playing: false,
        buffer: null
    });

    const audioElRef = useRef<HTMLAudioElement | null>(null);
    const ctxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const destRef = useRef<MediaStreamAudioDestinationNode | null>(null);
    const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

    const ensureAudio = useCallback(() => {
        if (!audioElRef.current) {
            const el = new Audio();
            el.crossOrigin = 'anonymous';
            el.preload = 'auto';
            audioElRef.current = el;
        }
        if (!ctxRef.current) {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioCtx();
            ctxRef.current = ctx;
            const analyser = ctx.createAnalyser();
            analyser.fftSize = fftSize;
            analyser.smoothingTimeConstant = 0.75;
            analyserRef.current = analyser;
            const dest = ctx.createMediaStreamDestination();
            destRef.current = dest;
            const src = ctx.createMediaElementSource(audioElRef.current!);
            sourceRef.current = src;
            src.connect(analyser);
            analyser.connect(ctx.destination);
            analyser.connect(dest);
        }
        return audioElRef.current!;
    }, [fftSize]);

    const load = useCallback(
        (file: File) => {
            const el = ensureAudio();
            const url = URL.createObjectURL(file);
            el.src = url;
            setState((s) => ({
                ...s,
                file,
                url,
                currentTime: 0,
                playing: false,
                duration: 0,
                buffer: null
            }));
            file.arrayBuffer()
                .then((ab) => ctxRef.current!.decodeAudioData(ab.slice(0)))
                .then((buffer) => setState((s) => ({ ...s, buffer })))
                .catch(() => {});
        },
        [ensureAudio]
    );

    const play = useCallback(() => {
        const el = audioElRef.current;
        if (!el) return;
        ctxRef.current?.resume();
        el.play();
    }, []);

    const pause = useCallback(() => {
        audioElRef.current?.pause();
    }, []);

    const seek = useCallback((t: number) => {
        if (audioElRef.current) audioElRef.current.currentTime = t;
    }, []);

    useEffect(() => {
        const el = audioElRef.current;
        if (!el) return;
        const onMeta = () => setState((s) => ({ ...s, duration: el.duration || 0 }));
        const onTime = () => setState((s) => ({ ...s, currentTime: el.currentTime }));
        const onPlay = () => setState((s) => ({ ...s, playing: true }));
        const onPause = () => setState((s) => ({ ...s, playing: false }));
        el.addEventListener('loadedmetadata', onMeta);
        el.addEventListener('timeupdate', onTime);
        el.addEventListener('play', onPlay);
        el.addEventListener('pause', onPause);
        return () => {
            el.removeEventListener('loadedmetadata', onMeta);
            el.removeEventListener('timeupdate', onTime);
            el.removeEventListener('play', onPlay);
            el.removeEventListener('pause', onPause);
        };
    }, [state.url]);

    return {
        state,
        audioEl: audioElRef.current,
        analyser: analyserRef.current,
        destination: destRef.current,
        context: ctxRef.current,
        load,
        play,
        pause,
        seek
    };
}
