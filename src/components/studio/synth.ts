import type { Instrument } from './fretting';

interface SynthProfile {
    wave1: OscillatorType;
    wave2: OscillatorType;
    detune: number;
    cutoff: number;
    q: number;
    decay: number;
    gain: number;
}

const PROFILES: Record<Instrument, SynthProfile> = {
    guitar: { wave1: 'sawtooth', wave2: 'triangle', detune: -7, cutoff: 2600, q: 3, decay: 0.9, gain: 0.22 },
    bass: { wave1: 'sawtooth', wave2: 'sine', detune: -5, cutoff: 800, q: 2, decay: 1.1, gain: 0.3 },
    uke: { wave1: 'triangle', wave2: 'square', detune: -3, cutoff: 3400, q: 2.5, decay: 0.55, gain: 0.18 },
    guitar7: { wave1: 'sawtooth', wave2: 'triangle', detune: -7, cutoff: 2400, q: 3, decay: 0.95, gain: 0.22 }
};

interface Voice {
    osc1: OscillatorNode;
    osc2: OscillatorNode;
    gain: GainNode;
}

export interface SourceNote {
    time: number;
    duration: number;
    pitch: number;
}

export class Synth {
    ctx: AudioContext | null = null;
    master: GainNode | null = null;
    analyser: AnalyserNode | null = null;
    dest: MediaStreamAudioDestinationNode | null = null;
    voices: Voice[] = [];
    volume = 0.5;

    ensure(): AudioContext {
        if (this.ctx) return this.ctx;
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.75;
        this.dest = this.ctx.createMediaStreamDestination();
        this.master.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
        this.analyser.connect(this.dest);
        return this.ctx;
    }

    setVolume(v: number) {
        this.volume = v;
        if (this.master) this.master.gain.value = v;
    }

    async resume() {
        if (this.ctx?.state === 'suspended') await this.ctx.resume();
    }

    playVoice(pitch: number, duration: number, atTime: number, instrument: Instrument) {
        if (!this.ctx || !this.master) return;
        const prof = PROFILES[instrument] ?? PROFILES.guitar;
        const freq = 440 * Math.pow(2, (pitch - 69) / 12);

        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        osc1.type = prof.wave1;
        osc2.type = prof.wave2;
        osc1.frequency.value = freq;
        osc2.frequency.value = freq;
        osc2.detune.value = prof.detune;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.value = prof.q;
        filter.frequency.setValueAtTime(prof.cutoff * 1.6, atTime);
        filter.frequency.exponentialRampToValueAtTime(prof.cutoff * 0.4, atTime + prof.decay);

        const gain = this.ctx.createGain();
        const peak = prof.gain;
        const sustain = Math.min(duration, 2.5);
        const release = 0.25;
        gain.gain.setValueAtTime(0.0001, atTime);
        gain.gain.exponentialRampToValueAtTime(peak, atTime + 0.006);
        gain.gain.exponentialRampToValueAtTime(peak * 0.35, atTime + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, atTime + sustain + release);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(this.master);

        const stopAt = atTime + sustain + release + 0.05;
        osc1.start(atTime);
        osc2.start(atTime);
        osc1.stop(stopAt);
        osc2.stop(stopAt);

        const voice: Voice = { osc1, osc2, gain };
        this.voices.push(voice);
        osc1.onended = () => {
            this.voices = this.voices.filter((v) => v !== voice);
        };
    }

    scheduleFrom(notes: SourceNote[], fromTime: number, instrument: Instrument, lookahead = 0.05) {
        this.clear();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        for (const n of notes) {
            if (n.time + n.duration < fromTime - 0.05) continue;
            const startAt = now + (n.time - fromTime) + lookahead;
            if (startAt < now) continue;
            this.playVoice(n.pitch, n.duration, startAt, instrument);
        }
    }

    clear() {
        if (!this.ctx) {
            this.voices = [];
            return;
        }
        const t = this.ctx.currentTime;
        for (const v of this.voices) {
            try {
                v.gain.gain.cancelScheduledValues(t);
                v.gain.gain.setTargetAtTime(0, t, 0.01);
                v.osc1.stop(t + 0.05);
                v.osc2.stop(t + 0.05);
            } catch {
                /* noop */
            }
        }
        this.voices = [];
    }
}
