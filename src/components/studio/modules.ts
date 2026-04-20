import type { MidiNoteEvent } from './useScore';
import { pitchColor, type Readout } from './theory';

export const CANVAS_W = 1080;
export const CANVAS_H = 1920;

export interface RenderCtx {
    ctx: CanvasRenderingContext2D;
    time: number;
    freq: Uint8Array | null;
    wave: Uint8Array | null;
}

export interface BackgroundStyle {
    a: string;
    b: string;
    angle: number;
}

export function drawBackground(rc: RenderCtx, bg: BackgroundStyle) {
    const { ctx } = rc;
    const rad = (bg.angle * Math.PI) / 180;
    const x = Math.cos(rad) * CANVAS_W;
    const y = Math.sin(rad) * CANVAS_H;
    const g = ctx.createLinearGradient(CANVAS_W / 2 - x / 2, CANVAS_H / 2 - y / 2, CANVAS_W / 2 + x / 2, CANVAS_H / 2 + y / 2);
    g.addColorStop(0, bg.a);
    g.addColorStop(1, bg.b);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

export function drawSpectrum(rc: RenderCtx, y0: number, h: number, color: string) {
    const { ctx, freq } = rc;
    if (!freq) return;
    const bars = 64;
    const step = Math.floor(freq.length / bars);
    const barW = CANVAS_W / bars;
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowBlur = 20;
    ctx.shadowColor = color;
    for (let i = 0; i < bars; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += freq[i * step + j];
        const avg = sum / step / 255;
        const bh = avg * h;
        ctx.fillRect(i * barW + 2, y0 + h - bh, barW - 4, bh);
    }
    ctx.restore();
}

export function drawWaveform(rc: RenderCtx, y0: number, h: number, color: string) {
    const { ctx, wave } = rc;
    if (!wave) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.shadowBlur = 12;
    ctx.shadowColor = color;
    ctx.beginPath();
    const mid = y0 + h / 2;
    for (let i = 0; i < wave.length; i++) {
        const x = (i / (wave.length - 1)) * CANVAS_W;
        const v = (wave[i] - 128) / 128;
        const y = mid + v * (h / 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
}

export interface ScoreStripOpts {
    image: HTMLImageElement;
    imageW: number;
    imageH: number;
    y0: number;
    h: number;
    time: number;
    scrollSpeed: number;
    offset: number;
    showCursor: boolean;
}

export function drawScoreStrip(rc: RenderCtx, opts: ScoreStripOpts) {
    const { ctx } = rc;
    const { image, imageW, imageH, y0, h, time, scrollSpeed, offset, showCursor } = opts;
    const scale = h / imageH;
    const drawnW = imageW * scale;
    const scrollPx = (time + offset) * scrollSpeed * scale;
    const startX = CANVAS_W * 0.15 - scrollPx;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y0, CANVAS_W, h);
    ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, y0, CANVAS_W, h);
    ctx.drawImage(image, 0, 0, imageW, imageH, startX, y0, drawnW, h);
    if (showCursor) {
        ctx.fillStyle = 'rgba(246,114,128,0.55)';
        ctx.fillRect(CANVAS_W * 0.15 - 3, y0, 6, h);
    }
    ctx.restore();
}

export interface PianoRollOpts {
    notes: MidiNoteEvent[];
    y0: number;
    h: number;
    time: number;
    window: number;
    minMidi?: number;
    maxMidi?: number;
    color: string;
    colorize?: boolean;
}

export function drawPianoRoll(rc: RenderCtx, opts: PianoRollOpts) {
    const { ctx } = rc;
    const { notes, y0, h, time, window, color, colorize } = opts;
    let minMidi = opts.minMidi ?? 24;
    let maxMidi = opts.maxMidi ?? 96;
    if (!opts.minMidi || !opts.maxMidi) {
        let lo = Infinity;
        let hi = -Infinity;
        for (const n of notes) {
            if (n.midi < lo) lo = n.midi;
            if (n.midi > hi) hi = n.midi;
        }
        if (lo !== Infinity) {
            minMidi = Math.max(0, lo - 2);
            maxMidi = Math.min(127, hi + 2);
        }
    }
    const range = Math.max(1, maxMidi - minMidi);
    const pxPerSec = CANVAS_W / window;
    const playhead = CANVAS_W * 0.25;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y0, CANVAS_W, h);
    ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, y0, CANVAS_W, h);

    for (const n of notes) {
        const x = playhead + (n.time - time) * pxPerSec;
        const w = Math.max(2, n.duration * pxPerSec);
        if (x + w < 0 || x > CANVAS_W) continue;
        const yN = y0 + h - ((n.midi - minMidi) / range) * h;
        const noteH = Math.max(3, h / range - 1);
        const active = time >= n.time && time < n.time + n.duration;
        const fill = colorize ? pitchColor(n.midi, active ? 72 : 58) : color;
        ctx.fillStyle = fill;
        ctx.shadowColor = fill;
        ctx.shadowBlur = active ? 14 : 6;
        ctx.globalAlpha = 0.5 + 0.5 * n.velocity;
        ctx.fillRect(x, yN - noteH / 2, w, noteH);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(playhead, y0);
    ctx.lineTo(playhead, y0 + h);
    ctx.stroke();
    ctx.restore();
}

export interface ReadoutOpts {
    readout: Readout;
    y: number;
    size?: number;
}

export function drawReadout(rc: RenderCtx, opts: ReadoutOpts) {
    const { ctx } = rc;
    const { readout, y } = opts;
    const size = opts.size ?? 96;
    const labelSize = Math.round(size * 0.34);
    const padX = 36;
    const padY = 22;

    ctx.save();
    ctx.font = `600 ${labelSize}px Inter, sans-serif`;
    const labelW = ctx.measureText(readout.label).width;
    ctx.font = `800 ${size}px Inter, sans-serif`;
    const valueW = ctx.measureText(readout.value).width;
    const boxW = Math.max(labelW + padX * 2, valueW + padX * 2);
    const boxH = labelSize + size + padY * 2 + 8;
    const x = (CANVAS_W - boxW) / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeStyle = readout.color;
    ctx.lineWidth = 4;
    const r = 18;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + boxW, y, x + boxW, y + boxH, r);
    ctx.arcTo(x + boxW, y + boxH, x, y + boxH, r);
    ctx.arcTo(x, y + boxH, x, y, r);
    ctx.arcTo(x, y, x + boxW, y, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.fillStyle = readout.color;
    ctx.font = `600 ${labelSize}px Inter, sans-serif`;
    ctx.fillText(readout.label, CANVAS_W / 2, y + padY);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = readout.color;
    ctx.shadowBlur = 22;
    ctx.font = `800 ${size}px Inter, sans-serif`;
    ctx.fillText(readout.value, CANVAS_W / 2, y + padY + labelSize + 8);
    ctx.restore();
}

export function activePitchesAt(notes: MidiNoteEvent[], time: number): number[] {
    const out: number[] = [];
    for (const n of notes) {
        if (time >= n.time && time < n.time + n.duration) out.push(n.midi);
    }
    return out;
}

export interface TitleOpts {
    title: string;
    subtitle?: string;
    color?: string;
}

export function drawTitle(rc: RenderCtx, opts: TitleOpts) {
    const { ctx } = rc;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = opts.color || '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 12;
    ctx.font = '700 72px Inter, sans-serif';
    ctx.fillText(opts.title, CANVAS_W / 2, 180);
    if (opts.subtitle) {
        ctx.font = '500 36px Inter, sans-serif';
        ctx.globalAlpha = 0.85;
        ctx.fillText(opts.subtitle, CANVAS_W / 2, 240);
    }
    ctx.restore();
}

export interface WordmarkOpts {
    y: number;
    size: number;
    variant: 'brand' | 'white';
    byline?: string;
}

export function drawWordmark(rc: RenderCtx, opts: WordmarkOpts) {
    const { ctx } = rc;
    const { y, size, variant, byline } = opts;
    ctx.save();
    ctx.font = `800 ${size}px Inter, sans-serif`;
    ctx.textBaseline = 'alphabetic';

    const content = 'content';
    const mint = 'mint';
    const contentW = ctx.measureText(content).width;
    const mintW = ctx.measureText(mint).width;
    const totalW = contentW + mintW;
    const startX = (CANVAS_W - totalW) / 2;

    if (variant === 'brand') {
        ctx.fillStyle = '#0b0b0b';
        ctx.fillText(content, startX, y);
        const grad = ctx.createLinearGradient(startX + contentW, 0, startX + totalW, 0);
        grad.addColorStop(0, '#7b2bff');
        grad.addColorStop(1, '#a855f7');
        ctx.fillStyle = grad;
        ctx.fillText(mint, startX + contentW, y);
    } else {
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowBlur = 18;
        ctx.fillText(content + mint, (CANVAS_W - ctx.measureText(content + mint).width) / 2, y);
    }

    if (byline) {
        ctx.shadowBlur = 0;
        ctx.font = `500 ${Math.round(size * 0.26)}px Inter, sans-serif`;
        ctx.fillStyle = variant === 'brand' ? 'rgba(11,11,11,0.7)' : 'rgba(255,255,255,0.85)';
        const bW = ctx.measureText(byline).width;
        ctx.fillText(byline, (CANVAS_W - bW) / 2, y + size * 0.35);
    }
    ctx.restore();
}

export function applyGlitch(ctx: CanvasRenderingContext2D, strength: number, time: number) {
    if (strength <= 0) return;
    const s = Math.min(1, strength);
    const slices = 6 + Math.floor(s * 8);
    const maxShift = 30 * s;
    const snap = ctx.canvas;
    const image = ctx.getImageData(0, 0, snap.width, snap.height);
    const off = document.createElement('canvas');
    off.width = snap.width;
    off.height = snap.height;
    const octx = off.getContext('2d')!;
    octx.putImageData(image, 0, 0);

    ctx.save();
    ctx.clearRect(0, 0, snap.width, snap.height);
    for (let i = 0; i < slices; i++) {
        const y = (i / slices) * snap.height + ((Math.sin(time * 4 + i) * 20 * s) | 0);
        const h = snap.height / slices + 4;
        const dx = (Math.sin(time * 9 + i * 1.3) * maxShift) | 0;
        ctx.drawImage(off, 0, y, snap.width, h, dx, y, snap.width, h);
    }
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.35 * s;
    ctx.drawImage(off, Math.sin(time * 7) * 12 * s, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(off, -Math.sin(time * 7) * 12 * s, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.08 * s;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < snap.height; i += 3) {
        ctx.fillRect(0, i, snap.width, 1);
    }
    ctx.restore();
}

export function applyTileMosh(ctx: CanvasRenderingContext2D, strength: number, time: number) {
    if (strength <= 0) return;
    const s = Math.min(1, strength);
    const snap = ctx.canvas;
    const off = document.createElement('canvas');
    off.width = snap.width;
    off.height = snap.height;
    const octx = off.getContext('2d')!;
    octx.drawImage(snap, 0, 0);

    const cols = 18;
    const rows = 32;
    const tw = snap.width / cols;
    const th = snap.height / rows;
    const seed = Math.floor(time * 6);
    const rand = (i: number) => {
        const x = Math.sin((i + seed) * 12.9898) * 43758.5453;
        return x - Math.floor(x);
    };

    ctx.save();
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const idx = r * cols + c;
            if (rand(idx) > 1 - s * 0.5) {
                const dx = (rand(idx + 7) - 0.5) * 120 * s;
                const dy = (rand(idx + 13) - 0.5) * 40 * s;
                ctx.drawImage(off, c * tw, r * th, tw, th, c * tw + dx, r * th + dy, tw, th);
            }
        }
    }
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.5 * s;
    ctx.drawImage(off, 6 * s, 0);
    ctx.fillStyle = '#ff0040';
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.15 * s;
    ctx.drawImage(off, -6 * s, 0);
    ctx.restore();
}
