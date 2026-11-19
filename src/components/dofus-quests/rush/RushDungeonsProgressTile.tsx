"use client";

import { cn } from "@/lib/utils";

/**
 * Tuile « Progression Donjons » du bandeau Rush (dashboard et guide public).
 *
 * Le compteur est en **exigences** (un groupe « au choix » = 1), jamais en donjons
 * uniques : 100 donjons portent 202 occurrences et 175 exigences (mesure du
 * 19/11/2026). Le picto est l'asset réel du jeu, pas un glyphe générique.
 */
export function RushDungeonsProgressTile({
  done,
  total,
  onClick,
  locale = "fr",
  className,
}: {
  done: number;
  total: number;
  onClick: () => void;
  locale?: "fr" | "en";
  className?: string;
}) {
  const label = locale === "en" ? "Dungeon progress" : "Progression Donjons";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label} : ${done} ${locale === "en" ? "of" : "sur"} ${total}`}
      title={
        locale === "en"
          ? "All dungeons of the route: what is done, what is left, by step and by member"
          : "Tous les donjons de la route : ce qui est fait, ce qui reste, par étape et par membre"
      }
      className={cn(
        "-mx-1 flex min-w-0 items-center gap-2.5 rounded-[4px] px-1 py-1 text-left transition-colors",
        "hover:bg-elevated focus-visible:outline-2 focus-visible:outline-success/50",
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/dofus-ui/pictos/donjon.png"
        alt=""
        aria-hidden="true"
        loading="lazy"
        className="h-8 w-8 shrink-0 object-contain"
      />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <span className="block truncate text-xs font-semibold tabular-nums text-foreground">
          {done} / {total}
        </span>
      </div>
    </button>
  );
}
