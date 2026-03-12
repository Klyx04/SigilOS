"use client";

import { useEffect, useRef, useCallback } from "react";

interface Particle {
    x: number; y: number;
    vx: number; vy: number;
    radius: number;
    alpha: number;
    color: string;
}

function spawnBurst(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, count = 30) {
    const particles: Particle[] = Array.from({ length: count }, () => ({
        x, y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8 - 3,
        radius: Math.random() * 4 + 2,
        alpha: 1,
        color,
    }));

    let frame: number;
    const animate = () => {
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.15;
            p.alpha -= 0.025;
            if (p.alpha <= 0) return;
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
        if (particles.some(p => p.alpha > 0)) {
            frame = requestAnimationFrame(animate);
        } else {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
}

export type BonusType = "eniripsa_captures_ogrest" | "incarnation_captures_ogrest" | null;

interface Props {
    bonus: BonusType;
    onDone?: () => void;
}

export function ParticleCanvas({ bonus, onDone }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const cleanupRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (!bonus || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        const color = bonus === "eniripsa_captures_ogrest" ? "#00D4F0" : "#E53E3E";
        const count = bonus === "eniripsa_captures_ogrest" ? 50 : 35;

        if (cleanupRef.current) cleanupRef.current();
        cleanupRef.current = spawnBurst(ctx, cx, cy, color, count);

        // Second burst for Éniripsa (more spectacular)
        if (bonus === "eniripsa_captures_ogrest") {
            setTimeout(() => spawnBurst(ctx, cx - 60, cy - 40, "#FFD700", 20), 150);
            setTimeout(() => spawnBurst(ctx, cx + 60, cy - 40, "#FFD700", 20), 300);
        }

        const timer = setTimeout(() => onDone?.(), 1500);
        return () => {
            clearTimeout(timer);
            cleanupRef.current?.();
        };
    }, [bonus, onDone]);

    if (!bonus) return null;

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none z-[40]"
        />
    );
}
