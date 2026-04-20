import { DIATONIC_STEP, NEEDS_SHARP, NOTE_NAMES, activeReadout, pitchClass, pitchColor } from './theory';
import type { FretNote, Instrument, TuningName } from './fretting';
import { TUNINGS } from './fretting';
import type { Palette } from './palettes';
import type { RenderCtx } from './modules';

export interface TabOpts {
    notes: FretNote[];
    time: number;
    palette: Palette;
    instrument: Instrument;
    tuning: TuningName;
    zoom: number;
    noteSize: number;
    glitch: number;
    y0: number;
    h: number;
    playheadX: number;
}

export function drawTab(rc: RenderCtx, o: TabOpts) {
    const { ctx } = rc;
    const strings = TUNINGS[o.instrument][o.tuning];
    const nStrings = strings.length;
    const stringGap = o.h / (nStrings + 1);

    // strings
    for (let i = 0; i < nStrings; i++) {
        const y = o.y0 + stringGap * (i + 1);
        ctx.strokeStyle = o.palette.string;
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 1 + (nStrings - i) * 0.25;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(ctx.canvas.width, y);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const pxPerSec = 320 * (o.zoom / 120);
    const ns = o.noteSize;

    for (const n of o.notes) {
        const dx = (n.time - o.time) * pxPerSec + o.playheadX;
        if (dx < -100 || dx > ctx.canvas.width + 100) continue;
        const dy = o.y0 + stringGap * (n.string + 1);
        const noteW = Math.max(ns * 1.4, n.duration * pxPerSec);
        const isActive = o.time >= n.time && o.time <= n.time + n.duration;
        const color = pitchColor(n.pitch, isActive ? 70 : 58);

        ctx.globalAlpha = 0.22;
        ctx.fillStyle = color;
        ctx.fillRect(dx, dy - ns / 2, noteW, ns);
        ctx.globalAlpha = 1;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(dx, dy, ns * 0.9, 0, Math.PI * 2);
        ctx.fill();

        if (isActive) {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(dx, dy, ns * 1.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        if (o.glitch > 0.1 && Math.random() < 0.3) {
            ctx.globalAlpha = 0.45;
            ctx.fillStyle = pitchColor(n.pitch, 60, 70);
            ctx.beginPath();
            ctx.arc(dx + (Math.random() - 0.5) * 3, dy + (Math.random() - 0.5) * 2, ns * 0.9, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        ctx.fillStyle = o.palette.bg;
        ctx.font = `bold ${ns}px "Space Mono", ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(n.fret), dx, dy + 1);
        ctx.textBaseline = 'alphabetic';
    }
}

export interface NotationOpts {
    notes: FretNote[];
    time: number;
    palette: Palette;
    instrument: Instrument;
    zoom: number;
    glitch: number;
    y0: number;
    h: number;
    playheadX: number;
}

export function drawNotation(rc: RenderCtx, o: NotationOpts) {
    const { ctx } = rc;
    const isBass = o.instrument === 'bass';
    const staffY = o.y0 + o.h / 2;
    const lineGap = Math.max(14, o.h / 14);
    const halfGap = lineGap / 2;
    const refStep = isBass ? 22 : 34;

    ctx.strokeStyle = o.palette.string;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 1.2;
    for (let i = -2; i <= 2; i++) {
        const y = staffY + i * lineGap;
        ctx.beginPath();
        ctx.moveTo(140, y);
        ctx.lineTo(ctx.canvas.width - 40, y);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.fillStyle = o.palette.primary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    if (isBass) {
        ctx.font = `${lineGap * 5}px "Noto Music", serif`;
        ctx.fillText('\u{1D122}', 44, staffY + lineGap * 1.1);
    } else {
        ctx.font = `${lineGap * 7.2}px "Noto Music", serif`;
        ctx.fillText('\u{1D11E}', 44, staffY + lineGap * 2.8);
    }
    ctx.restore();

    const yForPitch = (pitch: number) => {
        const pc = pitchClass(pitch);
        const octave = Math.floor(pitch / 12) - 1;
        const totalStep = octave * 7 + DIATONIC_STEP[pc];
        return staffY - (totalStep - refStep) * halfGap;
    };

    const pxPerSec = 320 * (o.zoom / 120);

    for (const n of o.notes) {
        const dx = (n.time - o.time) * pxPerSec + o.playheadX;
        if (dx < -100 || dx > ctx.canvas.width + 100) continue;

        const pc = pitchClass(n.pitch);
        const sharp = NEEDS_SHARP[pc];
        const dy = yForPitch(n.pitch);
        const isActive = o.time >= n.time && o.time <= n.time + n.duration;
        const color = pitchColor(n.pitch, isActive ? 70 : 58);

        const headRx = halfGap * 1.25;
        const headRy = halfGap * 0.95;

        ctx.strokeStyle = o.palette.string;
        ctx.lineWidth = 1;
        const topLineY = staffY - 2 * lineGap;
        const botLineY = staffY + 2 * lineGap;
        if (dy < topLineY - halfGap * 0.5) {
            let ly = topLineY - lineGap;
            while (ly >= dy - halfGap * 0.5) {
                ctx.beginPath();
                ctx.moveTo(dx - headRx - 6, ly);
                ctx.lineTo(dx + headRx + 6, ly);
                ctx.stroke();
                ly -= lineGap;
            }
        } else if (dy > botLineY + halfGap * 0.5) {
            let ly = botLineY + lineGap;
            while (ly <= dy + halfGap * 0.5) {
                ctx.beginPath();
                ctx.moveTo(dx - headRx - 6, ly);
                ctx.lineTo(dx + headRx + 6, ly);
                ctx.stroke();
                ly += lineGap;
            }
        }

        const noteW = n.duration * pxPerSec;
        if (noteW > headRx * 1.2) {
            ctx.globalAlpha = 0.18;
            ctx.fillStyle = color;
            ctx.fillRect(dx, dy - headRy * 0.6, noteW, headRy * 1.2);
            ctx.globalAlpha = 1;
        }

        const stemUp = dy > staffY;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (stemUp) {
            ctx.moveTo(dx + headRx - 1, dy - 1);
            ctx.lineTo(dx + headRx - 1, dy - lineGap * 3.2);
        } else {
            ctx.moveTo(dx - headRx + 1, dy + 1);
            ctx.lineTo(dx - headRx + 1, dy + lineGap * 3.2);
        }
        ctx.stroke();

        ctx.save();
        ctx.translate(dx, dy);
        ctx.rotate(-0.35);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(0, 0, headRx, headRy, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (isActive) {
            ctx.globalAlpha = 0.45;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(dx, dy, headRx * 1.9, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        if (sharp) {
            ctx.fillStyle = color;
            ctx.font = `bold ${lineGap * 1.5}px "Space Mono", ui-monospace, monospace`;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText('♯', dx - headRx - 2, dy);
        }

        if (o.glitch > 0.1 && Math.random() < 0.25) {
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = pitchColor(n.pitch, 65, 70);
            ctx.save();
            ctx.translate(dx + (Math.random() - 0.5) * 3, dy + (Math.random() - 0.5) * 2);
            ctx.rotate(-0.35);
            ctx.beginPath();
            ctx.ellipse(0, 0, headRx, headRy, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            ctx.globalAlpha = 1;
        }
    }
    ctx.textBaseline = 'alphabetic';
}

export interface LegendOpts {
    y: number;
    h: number;
    padX: number;
    activePitches: number[];
}

export function drawLegend(rc: RenderCtx, o: LegendOpts) {
    const { ctx } = rc;
    const gap = 4;
    const totalW = ctx.canvas.width - o.padX * 2;
    const w = (totalW - gap * 11) / 12;
    const active = new Set(o.activePitches.map(pitchClass));

    for (let i = 0; i < 12; i++) {
        const x = o.padX + i * (w + gap);
        const isOn = active.has(i);
        ctx.fillStyle = pitchColor(i, isOn ? 68 : 52, isOn ? 95 : 85);
        ctx.fillRect(x, o.y, w, o.h);

        if (isOn) {
            ctx.save();
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = pitchColor(i, 75);
            ctx.fillRect(x - 2, o.y - 2, w + 4, o.h + 4);
            ctx.restore();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x + 0.75, o.y + 0.75, w - 1.5, o.h - 1.5);
        }

        ctx.fillStyle = 'rgba(0,0,0,0.82)';
        ctx.font = `700 ${Math.round(o.h * 0.52)}px "Silkscreen", ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(NOTE_NAMES[i], x + w / 2, o.y + o.h / 2 + 1);
    }
    ctx.textBaseline = 'alphabetic';
}

export interface ActiveInfoOpts {
    y: number;
    activePitches: number[];
    palette: Palette;
    glitch: number;
}

export function drawActiveInfo(rc: RenderCtx, o: ActiveInfoOpts) {
    const { ctx } = rc;
    const readout = activeReadout(o.activePitches, o.palette.muted);
    const cx = ctx.canvas.width / 2;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = o.palette.string;
    ctx.globalAlpha = 0.6;
    ctx.font = '700 20px "Silkscreen", ui-monospace, monospace';
    ctx.fillText(readout.label, cx, o.y - 28);
    ctx.globalAlpha = 1;

    ctx.fillStyle = readout.color;
    ctx.font = '700 44px "Silkscreen", ui-monospace, monospace';
    ctx.fillText(readout.value, cx, o.y + 10);

    if (o.glitch > 0.1 && readout.label !== '—' && Math.random() < 0.2) {
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = o.palette.secondary;
        ctx.fillText(readout.value, cx + 3, o.y + 10);
        ctx.fillStyle = o.palette.primary;
        ctx.fillText(readout.value, cx - 3, o.y + 10);
        ctx.globalAlpha = 1;
    }
}

export function drawScanlines(rc: RenderCtx, opacity = 0.08) {
    const { ctx } = rc;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = '#000';
    for (let y = 0; y < ctx.canvas.height; y += 4) ctx.fillRect(0, y, ctx.canvas.width, 1);
    ctx.restore();
}

export function drawCornerMarks(rc: RenderCtx, color: string) {
    const { ctx } = rc;
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    const m = 40;
    const p = 20;
    ctx.beginPath();
    ctx.moveTo(p, p + m);
    ctx.lineTo(p, p);
    ctx.lineTo(p + m, p);
    ctx.moveTo(W - p - m, p);
    ctx.lineTo(W - p, p);
    ctx.lineTo(W - p, p + m);
    ctx.moveTo(p, H - p - m);
    ctx.lineTo(p, H - p);
    ctx.lineTo(p + m, H - p);
    ctx.moveTo(W - p - m, H - p);
    ctx.lineTo(W - p, H - p);
    ctx.lineTo(W - p, H - p - m);
    ctx.stroke();
    ctx.restore();
}
