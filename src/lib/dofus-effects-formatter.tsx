import React from "react";
import { cn } from "@/lib/utils";
import { cleanDofusText, damageLinesFromEffects } from "@/lib/dofus-spells";

export { cleanDofusText };

const ELEMENT_THEMES: Record<string, { label: string; icon: string; textClass: string }> = {
  neutre: { label: "Neutre", icon: "/assets/dofus/stats/neutre.png", textClass: "text-stone-300" },
  terre: { label: "Terre", icon: "/assets/dofus/stats/terre.png", textClass: "text-amber-500" },
  feu: { label: "Feu", icon: "/assets/dofus/stats/feu.png", textClass: "text-rose-400" },
  eau: { label: "Eau", icon: "/assets/dofus/stats/eau.png", textClass: "text-sky-400" },
  air: { label: "Air", icon: "/assets/dofus/stats/air.png", textClass: "text-emerald-400" },
};

/**
 * Pastilles condensées des jets de dégâts et poussée d'un sort (pour l'en-tête de carte).
 * Affiche : 🔥 8-11 · 💧 8-11 · 💨 4 cases
 */
export function SpellDamageSummaryChips({
  effectDetails,
  className,
}: {
  effectDetails?: any[];
  className?: string;
}) {
  const { lines, push } = damageLinesFromEffects(effectDetails);
  if (lines.length === 0 && push === null) return null;

  return (
    <span className={cn("inline-flex items-center gap-1.5 flex-wrap font-mono text-[10px]", className)}>
      {lines.map((l) => {
        const theme = ELEMENT_THEMES[l.element] ?? ELEMENT_THEMES.neutre;
        const rangeText = l.min === l.max ? `${l.min}` : `${l.min}-${l.max}`;
        return (
          <span
            key={l.element}
            className={cn(
              "inline-flex items-center gap-0.5 font-bold tabular-nums px-1 py-px rounded bg-surface/80 border border-border/50",
              theme.textClass
            )}
            title={`${theme.label} : ${rangeText}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={theme.icon} alt="" className="w-3 h-3 object-contain inline shrink-0" />
            <span>{rangeText}</span>
          </span>
        );
      })}
      {push !== null && push > 0 && (
        <span
          className="inline-flex items-center gap-0.5 font-bold tabular-nums px-1 py-px rounded bg-surface/80 border border-border/50 text-muted-foreground"
          title={`Poussée : ${push} case${push > 1 ? "s" : ""}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/dofus/stats/pm.png" alt="" className="w-3 h-3 object-contain inline shrink-0 opacity-70" />
          <span>{push} {push > 1 ? "cases" : "case"}</span>
        </span>
      )}
    </span>
  );
}

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

  // Nettoyage préalable des scories Unity ({{~ps}}, etc.)
  const cleaned = cleanDofusText(text);

  // Détection des éléments dans la chaîne
  const lower = cleaned.toLowerCase();
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
  } else if (/retrait\s*pa|\besquive\s*pa\b/i.test(cleaned)) {
    elementBadge = "/assets/dofus/stats/retraitPA.png";
  } else if (/retrait\s*pm|\besquive\s*pm\b/i.test(cleaned)) {
    elementBadge = "/assets/dofus/stats/retraitPM.png";
  } else if (/\bpa\b/i.test(cleaned)) {
    elementBadge = "/assets/dofus/stats/pa.png";
  } else if (/\bpm\b/i.test(cleaned)) {
    elementBadge = "/assets/dofus/stats/pm.png";
  } else if (lower.includes("vie") || lower.includes("soin") || lower.includes("heal")) {
    elementColor = "text-emerald-300";
    elementBadge = "/assets/dofus/stats/vie.png";
  }

  // Découpage : repérer les valeurs de jets "100 à 140", "-100 Fuite", "1 tour"
  const durationMatch = cleaned.match(/\s*-\s*(\d+\s*tours?|infini)\s*$/i);
  const mainPart = durationMatch ? cleaned.slice(0, durationMatch.index).trim() : cleaned;
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
