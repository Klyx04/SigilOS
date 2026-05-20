/**
 * useBombSounds — Web Audio API synthesis for Sigil Bomb
 * No external files needed, everything is synthesized on the fly.
 */
"use client";
import { useRef, useCallback } from "react";

export function useBombSounds(masterVolume: number = 0.5, tickVolume: number = 0.5) {
    const ctxRef = useRef<AudioContext | null>(null);

    const getCtx = () => {
        if (!ctxRef.current) {
            ctxRef.current = new AudioContext();
        }
        // Resume if suspended (browser policy)
        if (ctxRef.current.state === "suspended") {
            ctxRef.current.resume();
        }
        return ctxRef.current;
    };

    /** Normal tick — short, clean click */
    const playTick = useCallback(() => {
        try {
            const ctx = getCtx();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g);
            g.connect(ctx.destination);
            o.frequency.setValueAtTime(880, ctx.currentTime);
            o.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.08);
            g.gain.setValueAtTime(0.18 * masterVolume * tickVolume, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
            o.start(ctx.currentTime);
            o.stop(ctx.currentTime + 0.08);
        } catch (_) {}
    }, [masterVolume, tickVolume]);

    /** Urgent tick — deeper, harder, lower pitch for last 3 seconds */
    const playUrgentTick = useCallback(() => {
        try {
            const ctx = getCtx();
            // Main tick tone
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "square";
            o.connect(g);
            g.connect(ctx.destination);
            o.frequency.setValueAtTime(220, ctx.currentTime);
            o.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.12);
            g.gain.setValueAtTime(0.35 * masterVolume * tickVolume, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
            o.start(ctx.currentTime);
            o.stop(ctx.currentTime + 0.15);

            // Click layer
            const buf = ctx.createBuffer(1, ctx.sampleRate * 0.02, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
            const src = ctx.createBufferSource();
            src.buffer = buf;
            const gn = ctx.createGain();
            gn.gain.setValueAtTime(0.4 * masterVolume * tickVolume, ctx.currentTime);
            src.connect(gn);
            gn.connect(ctx.destination);
            src.start(ctx.currentTime);
        } catch (_) {}
    }, [masterVolume, tickVolume]);

    /** Explosion — Roublard bomb bam */
    const playExplosion = useCallback(() => {
        try {
            const ctx = getCtx();
            const duration = 1.2;
            const bufLen = ctx.sampleRate * duration;
            const buf = ctx.createBuffer(2, bufLen, ctx.sampleRate);

            for (let ch = 0; ch < 2; ch++) {
                const data = buf.getChannelData(ch);
                for (let i = 0; i < bufLen; i++) {
                    // White noise decaying exponentially
                    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 2.5);
                }
            }

            const src = ctx.createBufferSource();
            src.buffer = buf;

            // Low-pass filter for "boom" character
            const lp = ctx.createBiquadFilter();
            lp.type = "lowpass";
            lp.frequency.setValueAtTime(800, ctx.currentTime);
            lp.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + duration);

            // Gain envelope
            const g = ctx.createGain();
            g.gain.setValueAtTime(1.5 * masterVolume, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

            src.connect(lp);
            lp.connect(g);
            g.connect(ctx.destination);
            src.start(ctx.currentTime);
            src.stop(ctx.currentTime + duration);

            // Sub bass thump
            const sub = ctx.createOscillator();
            const subG = ctx.createGain();
            sub.type = "sine";
            sub.frequency.setValueAtTime(80, ctx.currentTime);
            sub.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.3);
            subG.gain.setValueAtTime(1.2 * masterVolume, ctx.currentTime);
            subG.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            sub.connect(subG);
            subG.connect(ctx.destination);
            sub.start(ctx.currentTime);
            sub.stop(ctx.currentTime + 0.3);
        } catch (_) {}
    }, [masterVolume]);

    /** Word success — bright chime */
    const playSuccess = useCallback(() => {
        try {
            const ctx = getCtx();
            [523, 659, 784].forEach((freq, i) => {
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.type = "sine";
                o.frequency.value = freq;
                g.gain.setValueAtTime(0.12 * masterVolume, ctx.currentTime + i * 0.07);
                g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.07 + 0.2);
                o.connect(g);
                g.connect(ctx.destination);
                o.start(ctx.currentTime + i * 0.07);
                o.stop(ctx.currentTime + i * 0.07 + 0.2);
            });
        } catch (_) {}
    }, [masterVolume]);

    /**
     * Double Kill — Two ascending notes, punchy
     * Triggered on 2 consecutive words found
     */
    const playDoubleKill = useCallback(() => {
        try {
            const ctx = getCtx();
            [660, 880].forEach((freq, i) => {
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.type = "triangle";
                o.frequency.value = freq;
                g.gain.setValueAtTime(0.22 * masterVolume, ctx.currentTime + i * 0.09);
                g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.09 + 0.25);
                o.connect(g);
                g.connect(ctx.destination);
                o.start(ctx.currentTime + i * 0.09);
                o.stop(ctx.currentTime + i * 0.09 + 0.25);
            });
        } catch (_) {}
    }, [masterVolume]);

    /**
     * Triple Kill — Three notes going up, dramatic
     * Triggered on 3 consecutive words found
     */
    const playTripleKill = useCallback(() => {
        try {
            const ctx = getCtx();
            [523, 659, 1047].forEach((freq, i) => {
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.type = "sawtooth";
                o.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
                o.frequency.exponentialRampToValueAtTime(freq * 1.05, ctx.currentTime + i * 0.1 + 0.18);
                g.gain.setValueAtTime(0.18 * masterVolume, ctx.currentTime + i * 0.1);
                g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.3);
                o.connect(g);
                g.connect(ctx.destination);
                o.start(ctx.currentTime + i * 0.1);
                o.stop(ctx.currentTime + i * 0.1 + 0.3);
            });
        } catch (_) {}
    }, [masterVolume]);

    /**
     * Rampage — Big ascending sweep + bass hit
     * Triggered on 5 consecutive words found
     */
    const playRampage = useCallback(() => {
        try {
            const ctx = getCtx();
            // Sweeping ascending arp
            [440, 554, 659, 880, 1100].forEach((freq, i) => {
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.type = "square";
                o.frequency.setValueAtTime(freq * 0.8, ctx.currentTime + i * 0.07);
                o.frequency.exponentialRampToValueAtTime(freq, ctx.currentTime + i * 0.07 + 0.12);
                g.gain.setValueAtTime(0.15 * masterVolume, ctx.currentTime + i * 0.07);
                g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.07 + 0.25);
                o.connect(g);
                g.connect(ctx.destination);
                o.start(ctx.currentTime + i * 0.07);
                o.stop(ctx.currentTime + i * 0.07 + 0.25);
            });
            // Deep bass punch after arp
            const sub = ctx.createOscillator();
            const subG = ctx.createGain();
            sub.type = "sine";
            sub.frequency.setValueAtTime(100, ctx.currentTime + 0.45);
            sub.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.8);
            subG.gain.setValueAtTime(0.8 * masterVolume, ctx.currentTime + 0.45);
            subG.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
            sub.connect(subG);
            subG.connect(ctx.destination);
            sub.start(ctx.currentTime + 0.45);
            sub.stop(ctx.currentTime + 0.8);
        } catch (_) {}
    }, [masterVolume]);

    /**
     * Godlike — Epic fanfare, rare sound for huge streaks (10+)
     */
    const playGodlike = useCallback(() => {
        try {
            const ctx = getCtx();
            // Two-octave power chord + rising sweep
            [[261, 329, 392, 523], [523, 659, 784, 1047]].forEach((chord, chordIdx) => {
                chord.forEach((freq, noteIdx) => {
                    const o = ctx.createOscillator();
                    const g = ctx.createGain();
                    o.type = "sine";
                    o.frequency.setValueAtTime(freq, ctx.currentTime + chordIdx * 0.35 + noteIdx * 0.02);
                    g.gain.setValueAtTime(0.1 * masterVolume, ctx.currentTime + chordIdx * 0.35);
                    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + chordIdx * 0.35 + 0.6);
                    o.connect(g);
                    g.connect(ctx.destination);
                    o.start(ctx.currentTime + chordIdx * 0.35 + noteIdx * 0.02);
                    o.stop(ctx.currentTime + chordIdx * 0.35 + 0.7);
                });
            });
            // Sub boom
            const sub = ctx.createOscillator();
            const subG = ctx.createGain();
            sub.type = "sine";
            sub.frequency.setValueAtTime(60, ctx.currentTime + 0.6);
            sub.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 1.2);
            subG.gain.setValueAtTime(1.0 * masterVolume, ctx.currentTime + 0.6);
            subG.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
            sub.connect(subG);
            subG.connect(ctx.destination);
            sub.start(ctx.currentTime + 0.6);
            sub.stop(ctx.currentTime + 1.2);
        } catch (_) {}
    }, [masterVolume]);

    /**
     * Sudden Death — Dramatic alarm / siren
     */
    const playSuddenDeath = useCallback(() => {
        try {
            const ctx = getCtx();
            const duration = 2.0;
            
            // Siren sweep
            for (let i = 0; i < 2; i++) {
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.type = i === 0 ? "sawtooth" : "square";
                o.frequency.setValueAtTime(440, ctx.currentTime);
                o.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.4);
                o.frequency.linearRampToValueAtTime(440, ctx.currentTime + 0.8);
                o.frequency.linearRampToValueAtTime(880, ctx.currentTime + 1.2);
                o.frequency.linearRampToValueAtTime(440, ctx.currentTime + 1.6);
                
                g.gain.setValueAtTime(0.08 * masterVolume, ctx.currentTime);
                g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
                
                o.connect(g);
                g.connect(ctx.destination);
                o.start(ctx.currentTime);
                o.stop(ctx.currentTime + duration);
            }
            
            // Sub impact
            const sub = ctx.createOscillator();
            const subG = ctx.createGain();
            sub.frequency.setValueAtTime(60, ctx.currentTime);
            sub.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.5);
            subG.gain.setValueAtTime(0.8 * masterVolume, ctx.currentTime);
            subG.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            sub.connect(subG);
            subG.connect(ctx.destination);
            sub.start(ctx.currentTime);
            sub.stop(ctx.currentTime + 0.5);
        } catch (_) {}
    }, [masterVolume]);

    return { playTick, playUrgentTick, playExplosion, playSuccess, playDoubleKill, playTripleKill, playRampage, playGodlike, playSuddenDeath };
}
