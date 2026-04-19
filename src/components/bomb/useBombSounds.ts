/**
 * useBombSounds — Web Audio API synthesis for Sigil Bomb
 * No external files needed, everything is synthesized on the fly.
 */
"use client";
import { useRef, useCallback } from "react";

export function useBombSounds() {
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
            g.gain.setValueAtTime(0.18, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
            o.start(ctx.currentTime);
            o.stop(ctx.currentTime + 0.08);
        } catch (_) {}
    }, []);

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
            g.gain.setValueAtTime(0.35, ctx.currentTime);
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
            gn.gain.setValueAtTime(0.4, ctx.currentTime);
            src.connect(gn);
            gn.connect(ctx.destination);
            src.start(ctx.currentTime);
        } catch (_) {}
    }, []);

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
            g.gain.setValueAtTime(1.5, ctx.currentTime);
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
            subG.gain.setValueAtTime(1.2, ctx.currentTime);
            subG.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            sub.connect(subG);
            subG.connect(ctx.destination);
            sub.start(ctx.currentTime);
            sub.stop(ctx.currentTime + 0.3);
        } catch (_) {}
    }, []);

    /** Word success — bright chime */
    const playSuccess = useCallback(() => {
        try {
            const ctx = getCtx();
            [523, 659, 784].forEach((freq, i) => {
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.type = "sine";
                o.frequency.value = freq;
                g.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.07);
                g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.07 + 0.2);
                o.connect(g);
                g.connect(ctx.destination);
                o.start(ctx.currentTime + i * 0.07);
                o.stop(ctx.currentTime + i * 0.07 + 0.2);
            });
        } catch (_) {}
    }, []);

    return { playTick, playUrgentTick, playExplosion, playSuccess };
}
