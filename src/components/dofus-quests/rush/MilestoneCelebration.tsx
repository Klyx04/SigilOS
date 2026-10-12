"use client";
import { motion } from "framer-motion";
import { Sparkles, Star } from "lucide-react";

// ─── Micro-célébration S6 : burst doré + label à la validation d'un bloc ──────
// Purement visuel, auto-fermé par le parent (RushTimelineClient) via AnimatePresence.
const SPARKS = Array.from({ length: 12 }, (_, i) => i);

export function MilestoneCelebrationBurst({ title, tint }: { title: string; tint?: string }) {
  const color = tint || "#d4a853";
  return (
    <div className="pointer-events-none fixed inset-0 z-[var(--z-celebration,9999)] flex items-center justify-center overflow-hidden">
      {/* Éclats radiaux */}
      <div className="absolute inset-0 flex items-center justify-center">
        {SPARKS.map((i) => {
          const angle = (i / SPARKS.length) * Math.PI * 2;
          const dist = 130 + (i % 3) * 45;
          const x = Math.cos(angle) * dist;
          const y = Math.sin(angle) * dist;
          return (
            <motion.span
              key={i}
              className="absolute"
              initial={{ opacity: 1, x: 0, y: 0, scale: 0.4 }}
              animate={{ opacity: 0, x, y, scale: 1.1 }}
              transition={{ duration: 0.9, ease: "easeOut", delay: i * 0.025 }}
            >
              <Sparkles className="w-5 h-5" style={{ color }} />
            </motion.span>
          );
        })}
      </div>

      {/* Label « Bloc validé ✦ » */}
      <motion.div
        className="relative px-6 py-3.5 rounded-full border bg-zinc-950/85 backdrop-blur-sm shadow-2xl"
        style={{ borderColor: `${color}45` }}
        initial={{ opacity: 0, scale: 0.8, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 6 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4" style={{ color }} />
          <span className="font-[family-name:var(--font-cinzel)] font-black uppercase tracking-[0.12em] text-sm" style={{ color }}>
            {title}
          </span>
          <Star className="w-4 h-4 fill-current" style={{ color }} />
        </div>
        <div className="text-center text-xs text-zinc-400 font-semibold mt-1">Bloc validé ✦</div>
      </motion.div>
    </div>
  );
}
