"use client";
import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  opacity: number;
  phase: number;
  speed: number;
};

/**
 * Effet d'ambiance du guide : fines braises dorées qui montent lentement.
 * - Canvas léger, ~36 particules desktop / 18 mobile, opacité faible.
 * - Désactivable (toggle du menu Options) + respecte prefers-reduced-motion.
 * - pointer-events none, mix-blend-mode screen : ne bloque jamais la lecture.
 */
export default function GuideParticles({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let particles: Particle[] = [];

    const spawn = (): Particle => ({
      x: Math.random() * w,
      y: h + 10 + Math.random() * h,
      r: 0.8 + Math.random() * 1.1,
      vy: 0.15 + Math.random() * 0.35,
      vx: (Math.random() - 0.5) * 0.15,
      opacity: 0.1 + Math.random() * 0.18,
      phase: Math.random() * Math.PI * 2,
      speed: 0.004 + Math.random() * 0.008,
    });

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = w < 768 ? 18 : 36;
      particles = Array.from({ length: count }, spawn);
    };
    resize();
    window.addEventListener("resize", resize);

    const tick = (now: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#fbbf24";
      for (const p of particles) {
        p.y -= p.vy;
        p.x += p.vx;
        if (p.y < -10) Object.assign(p, spawn());
        const o = p.opacity * (0.6 + 0.4 * Math.sin(now * p.speed + p.phase));
        ctx.globalAlpha = Math.max(0, o);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [active]);

  if (!active) return null;
  return <canvas ref={canvasRef} className="guide-particles" aria-hidden="true" />;
}
