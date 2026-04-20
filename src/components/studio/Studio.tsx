import React, { useEffect, useRef, useState } from 'react';
import { useAudio } from './useAudio';
import { useScore } from './useScore';
import { useStems, type StemRole } from './useStems';
import {
    CANVAS_H,
    CANVAS_W,
    activePitchesAt,
    applyGlitch,
    applyTileMosh,
    drawBackground,
    drawCutMarkers,
    drawPianoRoll,
    drawReadout,
    drawScoreStrip,
    drawSpectrum,
    drawStemLanes,
    drawTitle,
    drawWaveform,
    drawWordmark
} from './modules';
import type { StemLane } from './modules';
import type { RenderCtx } from './modules';
import { detectSoundStart, makeCueId, type Cue } from './cues';
import { activeReadout } from './theory';
import { detectPitchesFromFft, smoothPitches } from './audioAnalyze';
import { cutsFromBpm, detectOnsets, type AutocutMode } from './autocut';
import { fetchArchiveItem, parseArchiveUrl, type VideoSource } from '../../lib/sourceLibrary';
import {
    PLATFORMS,
    buildCaptionPack,
    buildDeployPath,
    buildFilename,
    buildSidecarJson,
    formatCaption,
    newMetadata,
    type ClipMetadata,
    type Platform
} from '../../lib/metadata';

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
    colorizePianoRoll: boolean;
    showReadout: boolean;
    readoutY: number;
    readoutSize: number;
    showStemLanes: boolean;
    stemLanesY: number;
    stemLanesH: number;
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
    autoFollowScrollSpeed: true,
    colorizePianoRoll: true,
    showReadout: true,
    readoutY: 1180,
    readoutSize: 120,
    showStemLanes: false,
    stemLanesY: 960,
    stemLanesH: 420
};

export default function Studio() {
    const audio = useAudio();
    const score = useScore();
    const stems = useStems();
    const stemFreqRef = useRef<Map<string, Uint8Array>>(new Map());
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
    const [cues, setCues] = useState<Cue[]>([]);
    const [alignRefCueId, setAlignRefCueId] = useState<string | null>(null);
    const [alignTargetTime, setAlignTargetTime] = useState(2);
    const [exportDuration, setExportDuration] = useState(0);
    const [alignEnabled, setAlignEnabled] = useState(false);
    const recordTimerRef = useRef<number>(0);
    const recordStartRef = useRef(0);
    const audioPitchesRef = useRef<number[]>([]);
    const audioPitchAgeRef = useRef<Map<number, number>>(new Map());
    const recordPlanRef = useRef<{
        exportStart: number;
        preRoll: number;
        sourceStart: number;
        totalOut: number;
        kicked: boolean;
    } | null>(null);
    const [recordTime, setRecordTime] = useState(0);
    const [autocutMode, setAutocutMode] = useState<AutocutMode>('bpm');
    const [autocutResolution, setAutocutResolution] = useState(0.5);
    const [autocutBarsPerCut, setAutocutBarsPerCut] = useState(4);
    const [cutMarkers, setCutMarkers] = useState<number[]>([]);
    const [showCutMarkers, setShowCutMarkers] = useState(true);
    const [archiveUrl, setArchiveUrl] = useState('');
    const [archiveSource, setArchiveSource] = useState<VideoSource | null>(null);
    const [archiveStatus, setArchiveStatus] = useState<string | null>(null);
    const [deploy, setDeploy] = useState({
        project: 'untitled',
        variant: 'main',
        platform: 'tiktok' as Platform,
        caption: '',
        hashtags: '',
        credits: ''
    });
    const [lastMeta, setLastMeta] = useState<ClipMetadata | null>(null);
    const [sidecarUrl, setSidecarUrl] = useState<string | null>(null);

    useEffect(() => {
        const buf = audio.state.buffer;
        if (!buf) return;
        const t = detectSoundStart(buf);
        setCues((list) => {
            const filtered = list.filter((c) => c.id !== 'sound-start');
            return [
                ...filtered,
                { id: 'sound-start', name: 'Sound start', time: t, color: '#7b2bff' }
            ].sort((a, b) => a.time - b.time);
        });
        setAlignRefCueId((cur) => cur ?? 'sound-start');
    }, [audio.state.buffer]);

    useEffect(() => {
        if (score.state.detectedBpm && score.state.kind === 'midi') {
            setLayout((s) => ({ ...s, audioBpm: score.state.detectedBpm }));
        }
    }, [score.state.detectedBpm, score.state.kind]);

    useEffect(() => {
        if (!audio.context) return;
        const targets: AudioNode[] = [audio.context.destination];
        if (audio.destination) targets.push(audio.destination);
        stems.attachContext(audio.context, targets);
    }, [audio.context, audio.destination, stems]);

    const lastStemSeekRef = useRef(0);
    useEffect(() => {
        if (!stems.state.tracks.length) return;
        if (audio.state.playing) {
            stems.start(audio.state.currentTime);
            lastStemSeekRef.current = audio.state.currentTime;
        } else {
            stems.stop();
        }
    }, [audio.state.playing, stems.state.tracks.length]);

    useEffect(() => {
        if (!stems.state.tracks.length || !audio.state.playing) return;
        const drift = Math.abs(audio.state.currentTime - lastStemSeekRef.current);
        if (drift > 0.4) {
            stems.start(audio.state.currentTime);
            lastStemSeekRef.current = audio.state.currentTime;
        } else {
            lastStemSeekRef.current = audio.state.currentTime;
        }
    }, [audio.state.currentTime]);

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
            const plan = recordPlanRef.current;
            const sourceTime = plan
                ? recordTime + plan.exportStart
                : audio.state.currentTime;
            const syncedTime = (sourceTime - layout.syncOffset) / tempoScale;

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
                    time: sourceTime - layout.syncOffset,
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
                    color: '#4ade80',
                    colorize: layout.colorizePianoRoll
                });
            }

            if (showCutMarkers && cutMarkers.length) {
                drawCutMarkers(rc, {
                    markers: cutMarkers,
                    y0: layout.scoreY,
                    h: layout.scoreH,
                    time: sourceTime,
                    window: layout.pianoRollWindow
                });
            }

            if (layout.showReadout) {
                let active: number[] = [];
                if (score.state.kind === 'midi' && score.state.notes.length) {
                    active = activePitchesAt(score.state.notes, syncedTime);
                } else if (rc.freq && audio.analyser) {
                    const sr = audio.analyser.context.sampleRate;
                    const fftSize = audio.analyser.fftSize;
                    const detected = detectPitchesFromFft(rc.freq, sr, fftSize).map((p) => p.midi);
                    audioPitchesRef.current = smoothPitches(
                        audioPitchesRef.current,
                        detected,
                        6,
                        audioPitchAgeRef.current
                    );
                    active = audioPitchesRef.current;
                }
                if (active.length) {
                    const readout = activeReadout(active);
                    drawReadout(rc, {
                        readout,
                        y: layout.readoutY,
                        size: layout.readoutSize
                    });
                }
            }

            if (layout.showSpectrum) {
                drawSpectrum(rc, layout.spectrumY, layout.spectrumH, layout.spectrumColor);
            }

            if (layout.showWaveform) {
                drawWaveform(rc, layout.spectrumY + layout.spectrumH / 2 - 80, 160, layout.waveformColor);
            }

            if (layout.showStemLanes && stems.state.tracks.length) {
                const lanes: StemLane[] = stems.state.tracks.map((t) => {
                    const a = stems.analysers.get(t.id);
                    if (!a) return { label: t.name, color: t.color, freq: null };
                    let buf = stemFreqRef.current.get(t.id);
                    if (!buf || buf.length !== a.frequencyBinCount) {
                        buf = new Uint8Array(new ArrayBuffer(a.frequencyBinCount));
                        stemFreqRef.current.set(t.id, buf);
                    }
                    a.getByteFrequencyData(buf as Uint8Array<ArrayBuffer>);
                    return { label: t.name, color: t.color, freq: buf };
                });
                drawStemLanes(rc, {
                    lanes,
                    y0: layout.stemLanesY,
                    h: layout.stemLanesH
                });
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
    }, [layout, audio.analyser, score.scoreImage, score.scoreImageSize, score.state.notes, score.state.kind, score.state.detectedBpm, audio.state.currentTime, recordTime, cutMarkers, showCutMarkers, stems.state.tracks, stems.analysers]);

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

    const refCue = cues.find((c) => c.id === alignRefCueId) ?? null;
    const useAlignment = alignEnabled && !!refCue;
    const previewExportStart = useAlignment ? refCue!.time - alignTargetTime : 0;
    const previewPreRoll = useAlignment && previewExportStart < 0 ? -previewExportStart : 0;
    const previewTail =
        useAlignment && exportDuration > 0
            ? exportDuration
            : Math.max(0, (audio.state.duration || 0) - Math.max(0, previewExportStart));

    const startRecord = () => {
        if (!canvasRef.current || !audio.destination) return;
        const exportStart = useAlignment ? refCue!.time - alignTargetTime : 0;
        const preRoll = useAlignment && exportStart < 0 ? -exportStart : 0;
        const sourceStart = Math.max(0, exportStart);
        const totalOut =
            useAlignment && exportDuration > 0
                ? exportDuration
                : Math.max(0, (audio.state.duration || 0) - sourceStart);

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
            const refCueForMeta = useAlignment ? refCue : null;
            const meta = newMetadata({
                project: deploy.project,
                variant: deploy.variant,
                platform: deploy.platform,
                cueAlignment: refCueForMeta
                    ? {
                          refCueName: refCueForMeta.name,
                          refCueTime: refCueForMeta.time,
                          alignTargetTime
                      }
                    : undefined,
                tempo: {
                    audioBpm: layout.audioBpm,
                    detectedBpm: score.state.detectedBpm,
                    syncOffset: layout.syncOffset
                },
                duration: totalOut,
                preRoll,
                sourceStart,
                title: layout.title || undefined,
                subtitle: layout.subtitle || undefined,
                caption: deploy.caption || undefined,
                hashtags: deploy.hashtags
                    .split(/[\s,]+/)
                    .map((s) => s.replace(/^#/, ''))
                    .filter(Boolean),
                credits: deploy.credits
                    .split(/[\n,]+/)
                    .map((s) => s.trim())
                    .filter(Boolean),
                sourceFiles: {
                    audio: audio.state.file?.name,
                    score: score.state.fileName ?? undefined,
                    archiveId: archiveSource?.id
                },
                cutMarkers: cutMarkers.length ? cutMarkers : undefined
            });
            setLastMeta(meta);
            const jsonBlob = new Blob([buildSidecarJson(meta)], { type: 'application/json' });
            setSidecarUrl(URL.createObjectURL(jsonBlob));
        };

        audio.pause();
        audio.seek(sourceStart);
        recordPlanRef.current = { exportStart, preRoll, sourceStart, totalOut, kicked: preRoll <= 0 };
        recordStartRef.current = performance.now() / 1000;
        setRecordTime(0);
        rec.start(250);
        recorderRef.current = rec;
        setRecording(true);

        if (preRoll <= 0) audio.play();

        const loop = () => {
            const plan = recordPlanRef.current;
            if (!plan) return;
            const elapsed = performance.now() / 1000 - recordStartRef.current;
            setRecordTime(elapsed);
            if (!plan.kicked && elapsed >= plan.preRoll) {
                audio.play();
                plan.kicked = true;
            }
            if (plan.totalOut > 0 && elapsed >= plan.totalOut) {
                stopRecord();
                return;
            }
            recordTimerRef.current = requestAnimationFrame(loop);
        };
        recordTimerRef.current = requestAnimationFrame(loop);
    };

    const stopRecord = () => {
        cancelAnimationFrame(recordTimerRef.current);
        recorderRef.current?.stop();
        recorderRef.current = null;
        recordPlanRef.current = null;
        setRecording(false);
        setRecordTime(0);
        audio.pause();
    };

    const update = <K extends keyof Layout>(k: K, v: Layout[K]) => setLayout((s) => ({ ...s, [k]: v }));

    const addCueAtPlayhead = () => {
        const t = audio.state.currentTime;
        setCues((list) =>
            [
                ...list,
                {
                    id: makeCueId(),
                    name: `Cue ${list.length + 1}`,
                    time: t,
                    color: '#e46ca0'
                }
            ].sort((a, b) => a.time - b.time)
        );
    };
    const removeCue = (id: string) => {
        setCues((list) => list.filter((c) => c.id !== id));
        if (alignRefCueId === id) setAlignRefCueId(null);
    };
    const renameCue = (id: string, name: string) => {
        setCues((list) => list.map((c) => (c.id === id ? { ...c, name } : c)));
    };
    const retimeCue = (id: string, time: number) => {
        setCues((list) =>
            list.map((c) => (c.id === id ? { ...c, time } : c)).sort((a, b) => a.time - b.time)
        );
    };
    const redetectSoundStart = () => {
        const buf = audio.state.buffer;
        if (!buf) return;
        const t = detectSoundStart(buf);
        setCues((list) =>
            list
                .map((c) => (c.id === 'sound-start' ? { ...c, time: t } : c))
                .sort((a, b) => a.time - b.time)
        );
    };

    const generateAutocut = () => {
        const duration = audio.state.duration || 0;
        const startCue = cues.find((c) => c.id === 'sound-start');
        const startTime = startCue?.time ?? 0;
        if (autocutMode === 'bpm') {
            setCutMarkers(cutsFromBpm(layout.audioBpm, autocutBarsPerCut, startTime, duration));
        } else if (autocutMode === 'onsets') {
            const buf = audio.state.buffer;
            if (!buf) return;
            setCutMarkers(detectOnsets(buf, { resolution: autocutResolution }));
        } else if (autocutMode === 'sections') {
            setCutMarkers([]);
        } else {
            setCutMarkers([]);
        }
    };
    const clearCutMarkers = () => setCutMarkers([]);
    const addCutAtPlayhead = () =>
        setCutMarkers((m) => [...m, audio.state.currentTime].sort((a, b) => a - b));

    const fetchArchive = async () => {
        const id = parseArchiveUrl(archiveUrl);
        if (!id) {
            setArchiveStatus('Could not parse archive.org URL or identifier.');
            return;
        }
        setArchiveStatus(`Fetching ${id}…`);
        try {
            const src = await fetchArchiveItem(id);
            if (!src) {
                setArchiveStatus(`No playable video found for ${id}.`);
                setArchiveSource(null);
                return;
            }
            setArchiveSource(src);
            setArchiveStatus(null);
        } catch (err) {
            setArchiveStatus(`Fetch failed: ${(err as Error).message}`);
        }
    };

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
                    <div className="flex flex-col gap-2 items-center">
                        <a
                            className="btn"
                            href={downloadUrl}
                            download={lastMeta ? buildFilename(lastMeta) : 'music-content.webm'}
                        >
                            Download WebM
                        </a>
                        {lastMeta && sidecarUrl && (
                            <>
                                <a
                                    className="btn"
                                    href={sidecarUrl}
                                    download={buildFilename(lastMeta, 'json')}
                                >
                                    Download sidecar JSON
                                </a>
                                <code className="text-[10px] opacity-60 break-all max-w-[320px]">
                                    {buildDeployPath(lastMeta)}
                                </code>
                                <button
                                    className="btn"
                                    onClick={() => {
                                        const pack = buildCaptionPack(lastMeta);
                                        navigator.clipboard.writeText(formatCaption(pack));
                                    }}
                                >
                                    Copy caption pack
                                </button>
                            </>
                        )}
                    </div>
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

                <Panel title="3c. Cues & export alignment">
                    <p className="text-xs opacity-70">
                        Drop cues and pick one as the alignment reference. Every export lines that cue
                        up to the same output timestamp, so multi-video posts cut cleanly on TikTok.
                    </p>
                    <Row>
                        <Field label="Add cues">
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    className="btn"
                                    onClick={addCueAtPlayhead}
                                    disabled={!audio.state.url}
                                >
                                    Cue at playhead
                                </button>
                                <button
                                    className="btn"
                                    onClick={redetectSoundStart}
                                    disabled={!audio.state.buffer}
                                >
                                    Re-detect sound start
                                </button>
                            </div>
                        </Field>
                    </Row>
                    {cues.length === 0 && (
                        <p className="text-xs opacity-60">
                            No cues yet. Load audio to auto-detect the sound start.
                        </p>
                    )}
                    <ul className="space-y-2">
                        {cues.map((c) => (
                            <li
                                key={c.id}
                                className="flex items-center gap-2 bg-white/5 rounded-md p-2"
                            >
                                <span
                                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ background: c.color }}
                                />
                                <input
                                    className="inp flex-1"
                                    value={c.name}
                                    onChange={(e) => renameCue(c.id, e.target.value)}
                                />
                                <input
                                    className="inp"
                                    style={{ width: 100 }}
                                    type="number"
                                    step={0.001}
                                    min={0}
                                    value={c.time.toFixed(3)}
                                    onChange={(e) => retimeCue(c.id, parseFloat(e.target.value) || 0)}
                                />
                                <button
                                    className="btn"
                                    onClick={() => audio.seek(c.time)}
                                    title="Seek audio to this cue"
                                >
                                    ▶
                                </button>
                                <label className="flex items-center gap-1 text-xs">
                                    <input
                                        type="radio"
                                        name="align-ref-cue"
                                        checked={alignRefCueId === c.id}
                                        onChange={() => setAlignRefCueId(c.id)}
                                    />
                                    ref
                                </label>
                                <button className="btn" onClick={() => removeCue(c.id)}>
                                    ×
                                </button>
                            </li>
                        ))}
                    </ul>
                    <div className="h-px bg-white/10 my-1" />
                    <Toggle
                        label="Align exports to reference cue"
                        checked={alignEnabled}
                        onChange={setAlignEnabled}
                    />
                    <Row>
                        <Field label={`Cue hits output at (${alignTargetTime.toFixed(2)}s)`}>
                            <input
                                type="range"
                                min={0}
                                max={30}
                                step={0.1}
                                value={alignTargetTime}
                                onChange={(e) => setAlignTargetTime(parseFloat(e.target.value))}
                            />
                        </Field>
                        <Field label={`Total output length (${exportDuration.toFixed(1)}s)`}>
                            <input
                                type="range"
                                min={0}
                                max={120}
                                step={0.5}
                                value={exportDuration}
                                onChange={(e) => setExportDuration(parseFloat(e.target.value))}
                            />
                        </Field>
                        <Field label="Output length (exact)">
                            <input
                                className="inp"
                                type="number"
                                min={0}
                                step={0.1}
                                value={exportDuration}
                                onChange={(e) =>
                                    setExportDuration(parseFloat(e.target.value) || 0)
                                }
                            />
                        </Field>
                    </Row>
                    <p className="text-xs opacity-70 font-mono">
                        {useAlignment
                            ? `pre-roll ${previewPreRoll.toFixed(2)}s · source start ${Math.max(0, previewExportStart).toFixed(2)}s · total ${previewTail.toFixed(2)}s`
                            : 'Alignment off — exports use natural start.'}
                    </p>
                    <p className="text-xs opacity-60">
                        If the cue sits before the target output time, the export pre-rolls with
                        silence + background only so the cue lands at exactly {alignTargetTime.toFixed(2)}
                        s in every render. Set output length to 0 for natural duration.
                    </p>
                </Panel>

                <Panel title="3d. Autocut">
                    <p className="text-xs opacity-70">
                        Generate cut markers the Video Studio renders as vertical lines on the piano
                        roll. Feeds batch-export (one clip per cut-to-cut segment — coming next).
                    </p>
                    <Row>
                        <Field label="Mode">
                            <select
                                className="inp"
                                value={autocutMode}
                                onChange={(e) => setAutocutMode(e.target.value as AutocutMode)}
                            >
                                <option value="manual">Manual (tap to add)</option>
                                <option value="bpm">BPM · bars per cut</option>
                                <option value="onsets">Autodetect drops / onsets</option>
                                <option value="sections">Sections (stub)</option>
                            </select>
                        </Field>
                        {autocutMode === 'bpm' && (
                            <Field label={`Bars per cut (${autocutBarsPerCut})`}>
                                <input
                                    type="range"
                                    min={1}
                                    max={32}
                                    step={1}
                                    value={autocutBarsPerCut}
                                    onChange={(e) => setAutocutBarsPerCut(parseInt(e.target.value))}
                                />
                            </Field>
                        )}
                        {autocutMode === 'onsets' && (
                            <Field label={`Resolution (${autocutResolution.toFixed(2)})`}>
                                <input
                                    type="range"
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    value={autocutResolution}
                                    onChange={(e) =>
                                        setAutocutResolution(parseFloat(e.target.value))
                                    }
                                />
                            </Field>
                        )}
                        <Field label="Actions">
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    className="btn"
                                    onClick={generateAutocut}
                                    disabled={
                                        !audio.state.url ||
                                        (autocutMode === 'onsets' && !audio.state.buffer)
                                    }
                                >
                                    Generate
                                </button>
                                {autocutMode === 'manual' && (
                                    <button
                                        className="btn"
                                        onClick={addCutAtPlayhead}
                                        disabled={!audio.state.url}
                                    >
                                        Add @ playhead
                                    </button>
                                )}
                                <button className="btn" onClick={clearCutMarkers}>
                                    Clear
                                </button>
                            </div>
                        </Field>
                    </Row>
                    <Toggle
                        label="Show cut markers on piano roll"
                        checked={showCutMarkers}
                        onChange={setShowCutMarkers}
                    />
                    <p className="text-xs opacity-70 font-mono">
                        {cutMarkers.length
                            ? `${cutMarkers.length} markers · first ${cutMarkers[0].toFixed(2)}s · last ${cutMarkers[cutMarkers.length - 1].toFixed(2)}s`
                            : 'No markers yet.'}
                    </p>
                </Panel>

                <Panel title="3e. Archive.org source">
                    <p className="text-xs opacity-70">
                        Paste an archive.org URL or identifier — contentmint pulls the MP4 /
                        WebM + metadata. Once staged, the autocut markers define segments to slice.
                    </p>
                    <Row>
                        <Field label="Archive.org URL or identifier">
                            <input
                                className="inp"
                                placeholder="https://archive.org/details/… or identifier"
                                value={archiveUrl}
                                onChange={(e) => setArchiveUrl(e.target.value)}
                            />
                        </Field>
                        <Field label="Actions">
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    className="btn"
                                    onClick={fetchArchive}
                                    disabled={!archiveUrl.trim()}
                                >
                                    Fetch
                                </button>
                                <a className="btn" href="/tools/sources" target="_blank" rel="noopener">
                                    Library →
                                </a>
                            </div>
                        </Field>
                    </Row>
                    {archiveStatus && <p className="text-xs opacity-70">{archiveStatus}</p>}
                    {archiveSource && (
                        <div className="flex gap-3 items-start bg-white/5 rounded-md p-2">
                            {archiveSource.thumbnail && (
                                <img
                                    src={archiveSource.thumbnail}
                                    alt=""
                                    className="w-24 rounded"
                                />
                            )}
                            <div className="text-xs space-y-1 flex-1">
                                <div className="font-semibold">{archiveSource.title}</div>
                                {archiveSource.author && (
                                    <div className="opacity-70">by {archiveSource.author}</div>
                                )}
                                {archiveSource.duration && (
                                    <div className="opacity-70">
                                        {archiveSource.duration.toFixed(1)}s
                                    </div>
                                )}
                                <div className="flex gap-2 flex-wrap">
                                    <a
                                        className="btn"
                                        href={archiveSource.pageUrl}
                                        target="_blank"
                                        rel="noopener"
                                    >
                                        Open
                                    </a>
                                    <a
                                        className="btn"
                                        href={archiveSource.videoUrl}
                                        target="_blank"
                                        rel="noopener"
                                    >
                                        Direct MP4
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}
                </Panel>

                <Panel title="3f. Deploy metadata">
                    <p className="text-xs opacity-70">
                        Every export ships with a sidecar JSON + deploy-path so variants stay organized
                        across platforms. Filename = <code>{'{project}_{platform}_{variant}_{stamp}.webm'}</code>.
                    </p>
                    <Row>
                        <Field label="Project">
                            <input
                                className="inp"
                                value={deploy.project}
                                onChange={(e) => setDeploy((d) => ({ ...d, project: e.target.value }))}
                            />
                        </Field>
                        <Field label="Variant">
                            <input
                                className="inp"
                                value={deploy.variant}
                                onChange={(e) => setDeploy((d) => ({ ...d, variant: e.target.value }))}
                                placeholder="main, hook, loop-a…"
                            />
                        </Field>
                        <Field label="Platform">
                            <select
                                className="inp"
                                value={deploy.platform}
                                onChange={(e) =>
                                    setDeploy((d) => ({ ...d, platform: e.target.value as Platform }))
                                }
                            >
                                {PLATFORMS.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.label} · {p.aspect} · {p.maxDurationSec}s
                                    </option>
                                ))}
                            </select>
                        </Field>
                    </Row>
                    <Row>
                        <Field label="Caption">
                            <textarea
                                className="inp"
                                rows={2}
                                value={deploy.caption}
                                onChange={(e) => setDeploy((d) => ({ ...d, caption: e.target.value }))}
                            />
                        </Field>
                        <Field label="Hashtags (comma or space)">
                            <input
                                className="inp"
                                value={deploy.hashtags}
                                onChange={(e) => setDeploy((d) => ({ ...d, hashtags: e.target.value }))}
                                placeholder="glitch, monoVoice, contentmint"
                            />
                        </Field>
                        <Field label="Credits (newline or comma)">
                            <input
                                className="inp"
                                value={deploy.credits}
                                onChange={(e) => setDeploy((d) => ({ ...d, credits: e.target.value }))}
                                placeholder="prod. g00dweird · mix by …"
                            />
                        </Field>
                    </Row>
                    <p className="text-xs opacity-60">
                        {(() => {
                            const p = PLATFORMS.find((x) => x.id === deploy.platform);
                            return p ? p.notes : '';
                        })()}
                    </p>
                </Panel>

                <Panel title="3g. Stems (multi-file)">
                    <p className="text-xs opacity-70">
                        Drop multiple bounced stems (Ableton exports, drums / bass / vocals / keys,
                        etc.). They play in lockstep with the master audio — each gets its own
                        analyser, color, and visualizer lane.
                    </p>
                    <MultiFileInput
                        accept="audio/*"
                        onFiles={(fs) => void stems.loadFiles(fs)}
                        label={
                            stems.state.tracks.length
                                ? `${stems.state.tracks.length} stem(s) loaded — add more`
                                : 'Choose stem audio files'
                        }
                    />
                    {stems.state.tracks.length > 0 && (
                        <ul className="space-y-1.5">
                            {stems.state.tracks.map((t) => (
                                <li
                                    key={t.id}
                                    className="flex items-center gap-2 bg-white/5 rounded-md p-2"
                                >
                                    <span
                                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{ background: t.color }}
                                    />
                                    <input
                                        className="inp"
                                        style={{ width: 160 }}
                                        value={t.name}
                                        onChange={(e) => stems.rename(t.id, e.target.value)}
                                    />
                                    <select
                                        className="inp"
                                        style={{ width: 110 }}
                                        value={t.role}
                                        onChange={(e) =>
                                            stems.setRole(t.id, e.target.value as StemRole)
                                        }
                                    >
                                        {['drums', 'bass', 'vocals', 'keys', 'guitar', 'synth', 'fx', 'other'].map(
                                            (r) => (
                                                <option key={r} value={r}>
                                                    {r}
                                                </option>
                                            )
                                        )}
                                    </select>
                                    <input
                                        type="range"
                                        min={0}
                                        max={1.5}
                                        step={0.01}
                                        value={t.gain}
                                        onChange={(e) => stems.setGain(t.id, parseFloat(e.target.value))}
                                        className="flex-1"
                                    />
                                    <button
                                        className="btn"
                                        onClick={() => stems.toggleMute(t.id)}
                                        style={{
                                            background: t.muted ? 'rgba(228,108,160,0.3)' : undefined
                                        }}
                                    >
                                        M
                                    </button>
                                    <button
                                        className="btn"
                                        onClick={() => stems.toggleSolo(t.id)}
                                        style={{
                                            background: t.solo ? 'rgba(143,201,160,0.3)' : undefined
                                        }}
                                    >
                                        S
                                    </button>
                                    <button className="btn" onClick={() => stems.remove(t.id)}>
                                        ×
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <Toggle
                        label="Show stem lanes on canvas"
                        checked={layout.showStemLanes}
                        onChange={(v) => update('showStemLanes', v)}
                    />
                    <Row>
                        <Field label={`Lanes Y (${layout.stemLanesY})`}>
                            <input
                                type="range"
                                min={0}
                                max={CANVAS_H - 200}
                                value={layout.stemLanesY}
                                onChange={(e) => update('stemLanesY', parseInt(e.target.value))}
                            />
                        </Field>
                        <Field label={`Lanes H (${layout.stemLanesH})`}>
                            <input
                                type="range"
                                min={120}
                                max={900}
                                value={layout.stemLanesH}
                                onChange={(e) => update('stemLanesH', parseInt(e.target.value))}
                            />
                        </Field>
                    </Row>
                    <p className="text-xs opacity-60">
                        Stems retrigger on seek (drift &gt; 0.4s). Mute / solo like a DAW — solo on any
                        stem mutes the rest automatically.
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

                <Panel title="4b. Note / chord readout">
                    <Toggle
                        label="Pitch-class colored notes"
                        checked={layout.colorizePianoRoll}
                        onChange={(v) => update('colorizePianoRoll', v)}
                    />
                    <Toggle
                        label="Show live NOTE / INTERVAL / CHORD readout"
                        checked={layout.showReadout}
                        onChange={(v) => update('showReadout', v)}
                    />
                    <Row>
                        <Field label={`Readout Y (${layout.readoutY})`}>
                            <input
                                type="range"
                                min={200}
                                max={CANVAS_H - 260}
                                value={layout.readoutY}
                                onChange={(e) => update('readoutY', parseInt(e.target.value))}
                            />
                        </Field>
                        <Field label={`Readout size (${layout.readoutSize})`}>
                            <input
                                type="range"
                                min={60}
                                max={200}
                                value={layout.readoutSize}
                                onChange={(e) => update('readoutSize', parseInt(e.target.value))}
                            />
                        </Field>
                    </Row>
                    <p className="text-xs opacity-60">
                        Color follows the 12 chromatic pitch classes. Single note → NOTE, two pitches →
                        INTERVAL, three+ → CHORD with slash-bass when inverted.
                    </p>
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

function MultiFileInput({
    accept,
    onFiles,
    label
}: {
    accept: string;
    onFiles: (fs: File[]) => void;
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
                multiple
                className="hidden"
                onChange={(e) => {
                    const fs = Array.from(e.target.files ?? []);
                    if (fs.length) onFiles(fs);
                    e.target.value = '';
                }}
            />
        </div>
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
