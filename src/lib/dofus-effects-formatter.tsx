import React from "react";
import { cn } from "@/lib/utils";

/**
 * Palette sémantique officielle Dofus (sobre, conforme design system SigilOS) :
 * - Neutre : text-stone-300 / text-zinc-300
 * - Terre : text-amber-500 / text-amber-600
 * - Feu : text-rose-400 / text-red-400
 * - Eau : text-sky-400 / text-blue-400
 * - Air : text-emerald-400 / text-teal-400
 */
export function formatDofusEffectLine(text: string): React.ReactNode {
  if (!text) return null;

  // Détection des éléments dans la chaîne
  const lower = text.toLowerCase();
  let elementColor = "text-foreground/90";
  let elementBadge = null;

  if (lower.includes("air")) {
    elementColor = "text-emerald-400";
    elementBadge = "/assets/dofus/stats/air.png";
  } else if (lower.includes("terre")) {
    elementColor = "text-amber-500";
    elementBadge = "/assets/dofus/stats/terre.png";
  } else if (lower.includes("feu")) {
    elementColor = "text-rose-400";
    elementBadge = "/assets/dofus/stats/feu.png";
  } else if (lower.includes("eau")) {
    elementColor = "text-sky-400";
    elementBadge = "/assets/dofus/stats/eau.png";
  } else if (lower.includes("neutre")) {
    elementColor = "text-stone-300";
    elementBadge = "/assets/dofus/stats/neutre.png";
  } else if (/retrait\s*pa|\besquive\s*pa\b/i.test(text)) {
    elementBadge = "/assets/dofus/stats/retraitPA.png";
  } else if (/retrait\s*pm|\besquive\s*pm\b/i.test(text)) {
    elementBadge = "/assets/dofus/stats/retraitPM.png";
  } else if (/\bpa\b/i.test(text)) {
    elementBadge = "/assets/dofus/stats/pa.png";
  } else if (/\bpm\b/i.test(text)) {
    elementBadge = "/assets/dofus/stats/pm.png";
  } else if (lower.includes("vie") || lower.includes("soin") || lower.includes("heal")) {
    elementColor = "text-emerald-300";
    elementBadge = "/assets/dofus/stats/vie.png";
  }

  // Découpage : repérer les valeurs de jets "100 à 140", "-100 Fuite", "1 tour"
  const durationMatch = text.match(/\s*-\s*(\d+\s*tours?|infini)\s*$/i);
  const mainPart = durationMatch ? text.slice(0, durationMatch.index).trim() : text;
  const durationPart = durationMatch ? durationMatch[1] : null;

  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      {elementBadge && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={elementBadge}
          alt=""
          className="w-3.5 h-3.5 object-contain inline-block shrink-0 opacity-90"
          loading="lazy"
        />
      )}
      <span className={cn("font-medium", elementColor)}>{mainPart}</span>
      {durationPart && (
        <span className="font-mono text-[10px] text-muted-foreground/75 px-1 py-0.2 rounded bg-surface/50 border border-border/40 shrink-0">
          {durationPart}
        </span>
      )}
    </span>
  );
}
