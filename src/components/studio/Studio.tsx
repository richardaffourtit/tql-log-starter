import React, { useEffect, useRef, useState } from 'react';
import { useAudio } from './useAudio';
import { useScore } from './useScore';
import {
    CANVAS_H,
    CANVAS_W,
    applyGlitch,
    drawBackground,
    drawPianoRoll,
    drawScoreStrip,
    drawSpectrum,
    drawTitle,
    drawWaveform
} from './modules';
import type { RenderCtx } from './modules';

interface Layout {
    bgA: string;
    bgB: string;
    bgAngle: number;
    title: string;
    subtitle: string;
    scoreScrollSpeed: number;
    scoreOffset: number;
    scoreY: number;
    scoreH: number;
    spectrumY: number;
    spectrumH: number;
    spectrumColor: string;
    waveformColor: string;
    pianoRollWindow: number;
    glitch: number;
    showWaveform: boolean;
    showSpectrum: boolean;
    showScore: boolean;
    showPianoRoll: boolean;
}

const DEFAULT_LAYOUT: Layout = {
    bgA: '#101828',
    bgB: '#355c7d',
    bgAngle: 135,
    title: 'Untitled',
    subtitle: '',
    scoreScrollSpeed: 260,
    scoreOffset: 0,
    scoreY: 420,
    scoreH: 360,
    spectrumY: 1500,
    spectrumH: 360,
    spectrumColor: '#f67280',
    waveformColor: '#ffffff',
    pianoRollWindow: 6,
    glitch: 0,
    showWaveform: true,
    showSpectrum: true,
    showScore: true,
    showPianoRoll: true
};

export default function Studio() {
    const audio = useAudio();
    const score = useScore();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef<number>(0);
    const freqArrRef = useRef<Uint8Array | null>(null);
    const waveArrRef = useRef<Uint8Array | null>(null);
    const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT);
    const [recording, setRecording] = useState(false);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunks = useRef<Blob[]>([]);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = CANVAS_W;
        canvas.height = CANVAS_H;
        const ctx = canvas.getContext('2d')!;

        const tick = () => {
            const a = audio.analyser;
            if (a) {
                if (!freqArrRef.current || freqArrRef.current.length !== a.frequencyBinCount)
                    freqArrRef.current = new Uint8Array(new ArrayBuffer(a.frequencyBinCount));
                if (!waveArrRef.current || waveArrRef.current.length !== a.fftSize)
                    waveArrRef.current = new Uint8Array(new ArrayBuffer(a.fftSize));
                a.getByteFrequencyData(freqArrRef.current as Uint8Array<ArrayBuffer>);
                a.getByteTimeDomainData(waveArrRef.current as Uint8Array<ArrayBuffer>);
            }
            const rc: RenderCtx = {
                ctx,
                time: audio.state.currentTime,
                freq: freqArrRef.current,
                wave: waveArrRef.current
            };

            drawBackground(rc, { a: layout.bgA, b: layout.bgB, angle: layout.bgAngle });
            drawTitle(rc, { title: layout.title, subtitle: layout.subtitle });

            if (layout.showScore && score.scoreImage && score.scoreImageSize) {
                drawScoreStrip(rc, {
                    image: score.scoreImage,
                    imageW: score.scoreImageSize.w,
                    imageH: score.scoreImageSize.h,
                    y0: layout.scoreY,
                    h: layout.scoreH,
                    time: audio.state.currentTime,
                    scrollSpeed: layout.scoreScrollSpeed,
                    offset: layout.scoreOffset,
                    showCursor: true
                });
            }

            if (layout.showPianoRoll && score.state.kind === 'midi' && score.state.notes.length) {
                drawPianoRoll(rc, {
                    notes: score.state.notes,
                    y0: layout.scoreY,
                    h: layout.scoreH,
                    time: audio.state.currentTime,
                    window: layout.pianoRollWindow,
                    color: '#4ade80'
                });
            }

            if (layout.showSpectrum) {
                drawSpectrum(rc, layout.spectrumY, layout.spectrumH, layout.spectrumColor);
            }

            if (layout.showWaveform) {
                drawWaveform(rc, layout.spectrumY + layout.spectrumH / 2 - 80, 160, layout.waveformColor);
            }

            if (layout.glitch > 0) {
                applyGlitch(ctx, layout.glitch, audio.state.currentTime);
            }

            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [layout, audio.analyser, score.scoreImage, score.scoreImageSize, score.state.notes, score.state.kind, audio.state.currentTime]);

    const handleAudio = (f: File) => audio.load(f);
    const handleScore = (f: File) => void score.load(f);

    const startRecord = () => {
        if (!canvasRef.current || !audio.destination) return;
        const canvasStream = canvasRef.current.captureStream(60);
        const audioTracks = audio.destination.stream.getAudioTracks();
        const combined = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
        recordedChunks.current = [];
        const rec = new MediaRecorder(combined, {
            mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
                ? 'video/webm;codecs=vp9,opus'
                : 'video/webm'
        });
        rec.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunks.current.push(e.data);
        };
        rec.onstop = () => {
            const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
            setDownloadUrl(URL.createObjectURL(blob));
        };
        rec.start(250);
        recorderRef.current = rec;
        setRecording(true);
        audio.seek(0);
        audio.play();
    };

    const stopRecord = () => {
        recorderRef.current?.stop();
        recorderRef.current = null;
        setRecording(false);
        audio.pause();
    };

    const update = <K extends keyof Layout>(k: K, v: Layout[K]) => setLayout((s) => ({ ...s, [k]: v }));

    return (
        <div className="grid grid-cols-1 xl:grid-cols-[auto_1fr] gap-8">
            <div className="flex flex-col items-center gap-4">
                <div
                    className="relative bg-black rounded-xl overflow-hidden"
                    style={{ width: 360, height: 640 }}
                >
                    <canvas
                        ref={canvasRef}
                        className="absolute inset-0 w-full h-full"
                        style={{ imageRendering: 'auto' }}
                    />
                </div>
                <div className="flex gap-2">
                    {audio.state.playing ? (
                        <button className="btn" onClick={audio.pause}>
                            Pause
                        </button>
                    ) : (
                        <button className="btn" onClick={audio.play} disabled={!audio.state.url}>
                            Play
                        </button>
                    )}
                    <button
                        className="btn"
                        onClick={recording ? stopRecord : startRecord}
                        disabled={!audio.state.url}
                    >
                        {recording ? 'Stop Export' : 'Record → WebM'}
                    </button>
                </div>
                {audio.state.url && (
                    <input
                        type="range"
                        min={0}
                        max={audio.state.duration || 0}
                        step={0.01}
                        value={audio.state.currentTime}
                        onChange={(e) => audio.seek(parseFloat(e.target.value))}
                        className="w-80"
                    />
                )}
                {downloadUrl && (
                    <a className="btn" href={downloadUrl} download="music-content.webm">
                        Download WebM
                    </a>
                )}
            </div>

            <div className="space-y-6">
                <Panel title="1. Audio">
                    <FileInput
                        accept="audio/*"
                        onFile={handleAudio}
                        label={audio.state.file?.name || 'Choose audio file'}
                    />
                    {audio.state.duration > 0 && (
                        <p className="text-sm opacity-70">Duration: {audio.state.duration.toFixed(2)}s</p>
                    )}
                </Panel>

                <Panel title="2. Score (MIDI / MusicXML / GuitarPro)">
                    <FileInput
                        accept=".mid,.midi,.xml,.musicxml,.mxl,.gp,.gp3,.gp4,.gp5,.gpx,.gp7"
                        onFile={handleScore}
                        label={score.state.fileName || 'Choose score file'}
                    />
                    <p className="text-sm opacity-70">
                        Loaded: {score.state.fileName ?? '—'}{' '}
                        {score.state.kind ? `(${score.state.kind})` : ''}{' '}
                        {score.state.ready ? '· ready' : score.state.fileName ? '· loading…' : ''}
                    </p>
                    {score.state.error && (
                        <p className="text-sm text-red-400">Error: {score.state.error}</p>
                    )}
                    <div
                        ref={score.containerRef}
                        className="bg-white rounded-lg text-black min-h-[80px] max-h-[220px] overflow-auto p-2"
                    />
                </Panel>

                <Panel title="3. Layout">
                    <Row>
                        <Field label="Title">
                            <input
                                className="inp"
                                value={layout.title}
                                onChange={(e) => update('title', e.target.value)}
                            />
                        </Field>
                        <Field label="Subtitle">
                            <input
                                className="inp"
                                value={layout.subtitle}
                                onChange={(e) => update('subtitle', e.target.value)}
                            />
                        </Field>
                    </Row>
                    <Row>
                        <Field label="BG A">
                            <input
                                type="color"
                                value={layout.bgA}
                                onChange={(e) => update('bgA', e.target.value)}
                            />
                        </Field>
                        <Field label="BG B">
                            <input
                                type="color"
                                value={layout.bgB}
                                onChange={(e) => update('bgB', e.target.value)}
                            />
                        </Field>
                        <Field label="Angle">
                            <input
                                type="range"
                                min={0}
                                max={360}
                                value={layout.bgAngle}
                                onChange={(e) => update('bgAngle', parseInt(e.target.value))}
                            />
                        </Field>
                    </Row>
                </Panel>

                <Panel title="4. Score strip">
                    <Toggle
                        label="Show notation strip"
                        checked={layout.showScore}
                        onChange={(v) => update('showScore', v)}
                    />
                    <Toggle
                        label="Show MIDI piano roll"
                        checked={layout.showPianoRoll}
                        onChange={(v) => update('showPianoRoll', v)}
                    />
                    <Row>
                        <Field label={`Scroll speed (${layout.scoreScrollSpeed})`}>
                            <input
                                type="range"
                                min={40}
                                max={800}
                                value={layout.scoreScrollSpeed}
                                onChange={(e) => update('scoreScrollSpeed', parseInt(e.target.value))}
                            />
                        </Field>
                        <Field label={`Offset (${layout.scoreOffset.toFixed(2)}s)`}>
                            <input
                                type="range"
                                min={-10}
                                max={10}
                                step={0.05}
                                value={layout.scoreOffset}
                                onChange={(e) => update('scoreOffset', parseFloat(e.target.value))}
                            />
                        </Field>
                    </Row>
                    <Row>
                        <Field label={`Strip Y (${layout.scoreY})`}>
                            <input
                                type="range"
                                min={0}
                                max={CANVAS_H - 120}
                                value={layout.scoreY}
                                onChange={(e) => update('scoreY', parseInt(e.target.value))}
                            />
                        </Field>
                        <Field label={`Strip H (${layout.scoreH})`}>
                            <input
                                type="range"
                                min={120}
                                max={900}
                                value={layout.scoreH}
                                onChange={(e) => update('scoreH', parseInt(e.target.value))}
                            />
                        </Field>
                        <Field label={`Piano window (${layout.pianoRollWindow}s)`}>
                            <input
                                type="range"
                                min={2}
                                max={16}
                                step={0.5}
                                value={layout.pianoRollWindow}
                                onChange={(e) => update('pianoRollWindow', parseFloat(e.target.value))}
                            />
                        </Field>
                    </Row>
                </Panel>

                <Panel title="5. Visualizer">
                    <Toggle
                        label="Spectrum bars"
                        checked={layout.showSpectrum}
                        onChange={(v) => update('showSpectrum', v)}
                    />
                    <Toggle
                        label="Waveform"
                        checked={layout.showWaveform}
                        onChange={(v) => update('showWaveform', v)}
                    />
                    <Row>
                        <Field label="Spectrum color">
                            <input
                                type="color"
                                value={layout.spectrumColor}
                                onChange={(e) => update('spectrumColor', e.target.value)}
                            />
                        </Field>
                        <Field label="Waveform color">
                            <input
                                type="color"
                                value={layout.waveformColor}
                                onChange={(e) => update('waveformColor', e.target.value)}
                            />
                        </Field>
                    </Row>
                    <Row>
                        <Field label={`Visualizer Y (${layout.spectrumY})`}>
                            <input
                                type="range"
                                min={0}
                                max={CANVAS_H - 120}
                                value={layout.spectrumY}
                                onChange={(e) => update('spectrumY', parseInt(e.target.value))}
                            />
                        </Field>
                        <Field label={`Visualizer H (${layout.spectrumH})`}>
                            <input
                                type="range"
                                min={60}
                                max={800}
                                value={layout.spectrumH}
                                onChange={(e) => update('spectrumH', parseInt(e.target.value))}
                            />
                        </Field>
                    </Row>
                </Panel>

                <Panel title="6. Glitch / moshing">
                    <Field label={`Strength (${layout.glitch.toFixed(2)})`}>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={layout.glitch}
                            onChange={(e) => update('glitch', parseFloat(e.target.value))}
                        />
                    </Field>
                    <p className="text-xs opacity-60">
                        Applies RGB-shift slices, feedback blending, and scanlines each frame. Heavy values
                        reduce framerate.
                    </p>
                </Panel>
            </div>

            <style>{`
                .inp { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 0.375rem; padding: 0.35rem 0.55rem; color: white; width: 100%; }
                .inp:focus { outline: 2px solid var(--color-primary); }
            `}</style>
        </div>
    );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-xl p-5 bg-white/5 border border-white/10 space-y-3">
            <h3 className="text-lg font-semibold">{title}</h3>
            {children}
        </section>
    );
}

function Row({ children }: { children: React.ReactNode }) {
    return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-75">{label}</span>
            {children}
        </label>
    );
}

function Toggle({
    label,
    checked,
    onChange
}: {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
            {label}
        </label>
    );
}

function FileInput({
    accept,
    onFile,
    label
}: {
    accept: string;
    onFile: (f: File) => void;
    label: string;
}) {
    const ref = useRef<HTMLInputElement>(null);
    return (
        <div className="flex gap-2 items-center">
            <button className="btn" onClick={() => ref.current?.click()}>
                Browse
            </button>
            <span className="text-sm opacity-75 truncate">{label}</span>
            <input
                ref={ref}
                type="file"
                accept={accept}
                className="hidden"
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onFile(f);
                }}
            />
        </div>
    );
}
