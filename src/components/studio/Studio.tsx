import React, { useEffect, useRef, useState } from 'react';
import { useAudio } from './useAudio';
import { useScore } from './useScore';
import {
    CANVAS_H,
    CANVAS_W,
    applyGlitch,
    applyTileMosh,
    drawBackground,
    drawPianoRoll,
    drawScoreStrip,
    drawSpectrum,
    drawTitle,
    drawWaveform,
    drawWordmark
} from './modules';
import type { RenderCtx } from './modules';

interface Layout {
    bgA: string;
    bgB: string;
    bgAngle: number;
    title: string;
    subtitle: string;
    titleColor: string;
    showWordmark: boolean;
    wordmarkVariant: 'brand' | 'white';
    wordmarkSize: number;
    wordmarkY: number;
    byline: string;
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
    tileMosh: number;
    showWaveform: boolean;
    showSpectrum: boolean;
    showScore: boolean;
    showPianoRoll: boolean;
    showTitle: boolean;
    audioBpm: number;
    syncOffset: number;
    autoFollowScrollSpeed: boolean;
}

const DEFAULT_LAYOUT: Layout = {
    bgA: '#e46ca0',
    bgB: '#8fc9a0',
    bgAngle: 135,
    title: '',
    subtitle: '',
    titleColor: '#ffffff',
    showWordmark: true,
    wordmarkVariant: 'white',
    wordmarkSize: 120,
    wordmarkY: 260,
    byline: 'by g00dweird',
    scoreScrollSpeed: 260,
    scoreOffset: 0,
    scoreY: 520,
    scoreH: 360,
    spectrumY: 1500,
    spectrumH: 360,
    spectrumColor: '#7b2bff',
    waveformColor: '#ffffff',
    pianoRollWindow: 6,
    glitch: 0,
    tileMosh: 0,
    showWaveform: true,
    showSpectrum: true,
    showScore: true,
    showPianoRoll: true,
    showTitle: false,
    audioBpm: 120,
    syncOffset: 0,
    autoFollowScrollSpeed: true
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
    const tapTimesRef = useRef<number[]>([]);

    useEffect(() => {
        if (score.state.detectedBpm && score.state.kind === 'midi') {
            setLayout((s) => ({ ...s, audioBpm: score.state.detectedBpm }));
        }
    }, [score.state.detectedBpm, score.state.kind]);

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
            if (layout.showTitle && layout.title) {
                drawTitle(rc, {
                    title: layout.title,
                    subtitle: layout.subtitle,
                    color: layout.titleColor
                });
            }
            if (layout.showWordmark) {
                drawWordmark(rc, {
                    y: layout.wordmarkY,
                    size: layout.wordmarkSize,
                    variant: layout.wordmarkVariant,
                    byline: layout.byline
                });
            }

            const midiBpm = score.state.detectedBpm || 120;
            const tempoScale = midiBpm / (layout.audioBpm || midiBpm);
            const syncedTime = (audio.state.currentTime - layout.syncOffset) / tempoScale;

            if (layout.showScore && score.scoreImage && score.scoreImageSize) {
                const effectiveScroll = layout.autoFollowScrollSpeed
                    ? layout.scoreScrollSpeed / tempoScale
                    : layout.scoreScrollSpeed;
                drawScoreStrip(rc, {
                    image: score.scoreImage,
                    imageW: score.scoreImageSize.w,
                    imageH: score.scoreImageSize.h,
                    y0: layout.scoreY,
                    h: layout.scoreH,
                    time: audio.state.currentTime - layout.syncOffset,
                    scrollSpeed: effectiveScroll,
                    offset: layout.scoreOffset,
                    showCursor: true
                });
            }

            if (layout.showPianoRoll && score.state.kind === 'midi' && score.state.notes.length) {
                drawPianoRoll(rc, {
                    notes: score.state.notes,
                    y0: layout.scoreY,
                    h: layout.scoreH,
                    time: syncedTime,
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
            if (layout.tileMosh > 0) {
                applyTileMosh(ctx, layout.tileMosh, audio.state.currentTime);
            }

            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [layout, audio.analyser, score.scoreImage, score.scoreImageSize, score.state.notes, score.state.kind, score.state.detectedBpm, audio.state.currentTime]);

    const handleTap = () => {
        const now = performance.now();
        const arr = tapTimesRef.current;
        if (arr.length && now - arr[arr.length - 1] > 2500) arr.length = 0;
        arr.push(now);
        if (arr.length > 6) arr.shift();
        if (arr.length >= 2) {
            const intervals: number[] = [];
            for (let i = 1; i < arr.length; i++) intervals.push(arr[i] - arr[i - 1]);
            const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const bpm = Math.round(60000 / avg);
            if (bpm > 30 && bpm < 300) update('audioBpm', bpm);
        }
    };
    const resetTempo = () => update('audioBpm', score.state.detectedBpm || 120);
    const syncNow = () => update('syncOffset', audio.state.currentTime);

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
                    <Toggle
                        label="Show contentmint wordmark"
                        checked={layout.showWordmark}
                        onChange={(v) => update('showWordmark', v)}
                    />
                    <Row>
                        <Field label="Wordmark style">
                            <select
                                className="inp"
                                value={layout.wordmarkVariant}
                                onChange={(e) =>
                                    update('wordmarkVariant', e.target.value as 'brand' | 'white')
                                }
                            >
                                <option value="white">White (over gradient)</option>
                                <option value="brand">Brand (black + purple)</option>
                            </select>
                        </Field>
                        <Field label={`Size (${layout.wordmarkSize})`}>
                            <input
                                type="range"
                                min={60}
                                max={220}
                                value={layout.wordmarkSize}
                                onChange={(e) => update('wordmarkSize', parseInt(e.target.value))}
                            />
                        </Field>
                        <Field label={`Y (${layout.wordmarkY})`}>
                            <input
                                type="range"
                                min={80}
                                max={CANVAS_H - 200}
                                value={layout.wordmarkY}
                                onChange={(e) => update('wordmarkY', parseInt(e.target.value))}
                            />
                        </Field>
                    </Row>
                    <Row>
                        <Field label="Byline">
                            <input
                                className="inp"
                                value={layout.byline}
                                onChange={(e) => update('byline', e.target.value)}
                            />
                        </Field>
                    </Row>
                    <Toggle
                        label="Custom title"
                        checked={layout.showTitle}
                        onChange={(v) => update('showTitle', v)}
                    />
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
                        <Field label="Title color">
                            <input
                                type="color"
                                value={layout.titleColor}
                                onChange={(e) => update('titleColor', e.target.value)}
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
                    <Row>
                        <button
                            className="btn"
                            onClick={() => {
                                update('bgA', '#e46ca0');
                                update('bgB', '#8fc9a0');
                                update('bgAngle', 135);
                            }}
                        >
                            Pink → Green
                        </button>
                        <button
                            className="btn"
                            onClick={() => {
                                update('bgA', '#ffffff');
                                update('bgB', '#ffffff');
                            }}
                        >
                            White
                        </button>
                        <button
                            className="btn"
                            onClick={() => {
                                update('bgA', '#0b0b0b');
                                update('bgB', '#1a1a1a');
                            }}
                        >
                            Black
                        </button>
                    </Row>
                </Panel>

                <Panel title="3b. Time / tempo lock">
                    <p className="text-xs opacity-70">
                        MIDI detected: <strong>{score.state.detectedBpm || '—'} BPM</strong>
                        {score.state.kind === 'midi' && score.state.notes.length
                            ? ` · ${score.state.notes.length} notes`
                            : ''}
                    </p>
                    <Row>
                        <Field label={`Audio BPM (${layout.audioBpm})`}>
                            <input
                                type="range"
                                min={40}
                                max={240}
                                step={0.5}
                                value={layout.audioBpm}
                                onChange={(e) => update('audioBpm', parseFloat(e.target.value))}
                            />
                        </Field>
                        <Field label="Exact BPM">
                            <input
                                className="inp"
                                type="number"
                                min={40}
                                max={240}
                                step={0.1}
                                value={layout.audioBpm}
                                onChange={(e) => update('audioBpm', parseFloat(e.target.value) || 120)}
                            />
                        </Field>
                        <Field label="Actions">
                            <div className="flex gap-2">
                                <button className="btn" onClick={handleTap}>
                                    Tap tempo
                                </button>
                                <button className="btn" onClick={resetTempo}>
                                    Reset
                                </button>
                            </div>
                        </Field>
                    </Row>
                    <Row>
                        <Field label={`Sync offset (${layout.syncOffset.toFixed(3)}s)`}>
                            <input
                                type="range"
                                min={-10}
                                max={10}
                                step={0.001}
                                value={layout.syncOffset}
                                onChange={(e) => update('syncOffset', parseFloat(e.target.value))}
                            />
                        </Field>
                        <Field label="Sync actions">
                            <div className="flex gap-2">
                                <button
                                    className="btn"
                                    onClick={syncNow}
                                    disabled={!audio.state.url}
                                    title="Align MIDI start to current audio position"
                                >
                                    Sync now
                                </button>
                                <button className="btn" onClick={() => update('syncOffset', 0)}>
                                    Zero
                                </button>
                            </div>
                        </Field>
                        <Field label="Score strip">
                            <Toggle
                                label="Follow tempo"
                                checked={layout.autoFollowScrollSpeed}
                                onChange={(v) => update('autoFollowScrollSpeed', v)}
                            />
                        </Field>
                    </Row>
                    <p className="text-xs opacity-60">
                        Tempo lock rescales MIDI note times by <code>detectedBPM ÷ audioBPM</code> so the
                        piano roll and AlphaTab strip track the uploaded audio exactly. Use Tap Tempo on
                        the audio downbeat, then Sync Now at bar 1 to lock position.
                    </p>
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
                    <Field label={`RGB-shift slices (${layout.glitch.toFixed(2)})`}>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={layout.glitch}
                            onChange={(e) => update('glitch', parseFloat(e.target.value))}
                        />
                    </Field>
                    <Field label={`Tile mosh (${layout.tileMosh.toFixed(2)})`}>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={layout.tileMosh}
                            onChange={(e) => update('tileMosh', parseFloat(e.target.value))}
                        />
                    </Field>
                    <p className="text-xs opacity-60">
                        Tile mosh chops the frame into a grid and displaces random cells with RGB bleed —
                        matches the g00dweird glitch-grid look. Heavy values reduce framerate.
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
