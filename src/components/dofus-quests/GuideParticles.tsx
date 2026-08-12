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
  color: string;
};

const COLORS = ["#fbbf24", "#34d399", "#60a5fa", "#a78bfa"];

/**
 * Effet d'ambiance du guide — braises Dofus (or / émeraude / saphir) + halos doux.
 * Performance avant tout :
 *  - zéro shadowBlur (très coûteux), halos pré-rendus offscreen (drawImage léger),
 *  - ~52 particules desktop / 24 mobile, devicePixelRatio plafonné à 2,
 *  - pointer-events none, respecte prefers-reduced-motion, désactivable (menu Options).
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

    // Halo doré pré-rendu (dégradé radial) — créé UNE fois, dessiné via drawImage (léger).
    const halo = document.createElement("canvas");
    halo.width = 96;
    halo.height = 96;
    const hctx = halo.getContext("2d");
    if (hctx) {
      const g = hctx.createRadialGradient(48, 48, 4, 48, 48, 48);
      g.addColorStop(0, "rgba(251, 191, 36, 0.28)");
      g.addColorStop(1, "rgba(251, 191, 36, 0)");
      hctx.fillStyle = g;
      hctx.fillRect(0, 0, 96, 96);
    }

    const spawn = (): Particle => ({
      x: Math.random() * w,
      y: h + 20 + Math.random() * h,
      r: 0.9 + Math.random() * 1.7,
      vy: 0.18 + Math.random() * 0.5,
      vx: (Math.random() - 0.5) * 0.22,
      opacity: 0.07 + Math.random() * 0.2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.005 + Math.random() * 0.01,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    });

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = w < 768 ? 24 : 52;
      particles = Array.from({ length: count }, spawn);
    };
    resize();
    window.addEventListener("resize", resize);

    const tick = (now: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "screen";
      for (const p of particles) {
        p.y -= p.vy;
        p.x += p.vx + Math.sin(now * 0.0004 + p.phase) * 0.09;
        if (p.y < -18) Object.assign(p, spawn());
        const o = p.opacity * (0.55 + 0.45 * Math.sin(now * p.speed + p.phase));
        if (o <= 0.02) continue;
        ctx.globalAlpha = Math.max(0, o);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        // Halo doux uniquement sur les grosses braises (immersion, coût maîtrisé).
        if (p.r > 2.1) {
          ctx.drawImage(halo, p.x - 36, p.y - 36, 72, 72);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
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
