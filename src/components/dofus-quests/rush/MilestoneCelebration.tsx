"use client";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles, Star } from "lucide-react";

// ─── Micro-célébration S6 : burst doré + label à la validation d'un bloc ──────
// Purement visuel, auto-fermé par le parent (RushTimelineClient) via AnimatePresence.
// O15 : qui demande « réduire les animations » garde le label, pas les éclats.
const SPARKS = Array.from({ length: 12 }, (_, i) => i);

export function MilestoneCelebrationBurst({ title, tint }: { title: string; tint?: string }) {
  const reduceMotion = useReducedMotion();
  const color = tint || "var(--da-amber, #d4a853)";
  return (
    <div className="pointer-events-none fixed inset-0 z-[var(--z-celebration,9999)] flex items-center justify-center overflow-hidden">
      {/* Éclats radiaux */}
      <div className="absolute inset-0 flex items-center justify-center">
        {!reduceMotion && SPARKS.map((i) => {
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
        className="relative px-6 py-3.5 rounded-full border bg-background/85 shadow-2xl"
        style={{ borderColor: `${color}45` }}
        initial={{ opacity: 0, scale: 0.8, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 6 }}
        transition={{ duration: reduceMotion ? 0 : 0.4, ease: "easeOut" }}
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4" style={{ color }} />
          <span className="da-title text-sm" style={{ color }}>
            {title}
          </span>
          <Star className="w-4 h-4 fill-current" style={{ color }} />
        </div>
        <div className="text-center text-xs text-muted-foreground font-semibold mt-1">Bloc validé ✦</div>
      </motion.div>
    </div>
  );
}
