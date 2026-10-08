"use client";
import { useEffect, useRef, useState } from "react";
import type { GuideRealtimeEvent } from "@/lib/guide-realtime";
import { formatGuideLiveEvent, type GuideLiveLine } from "@/lib/guide-live-lines";

type TickerLine = GuideLiveLine & { id: number };

let lineId = 0;
const LINE_TTL_MS = 4000;
const MAX_VISIBLE = 3;

/**
 * Fil d'activité live du guide (dashboard) — les coéquipiers, en trois lignes.
 *
 * Retour user du 08/10/2026 : « l'encart doré au milieu de l'écran, sans photo de profil ».
 * Depuis : carte sur les **jetons de thème** (`bg-elevated` / `border-border` / accent par
 * nature d'event), **avatar Discord** du membre quand l'event en porte un (sinon son
 * initiale), et la phrase vient de la source unique `formatGuideLiveEvent` — le toast de
 * l'overlay dit exactement la même chose.
 *
 * ZÉRO glow, zéro ombre, zéro aplat doré : la position (milieu-droit) reste pilotée par
 * `.guide-live-ticker` dans `guide-styles.css`.
 */
export default function LiveActivityTicker({ events }: { events: GuideRealtimeEvent[] }) {
  const [lines, setLines] = useState<TickerLine[]>([]);
  const seenCountRef = useRef(0);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (events.length <= seenCountRef.current) return;
    const fresh = events.slice(seenCountRef.current);
    seenCountRef.current = events.length;

    const toAdd: TickerLine[] = [];
    fresh.forEach((e) => {
      const line = formatGuideLiveEvent(e);
      if (line) toAdd.push({ ...line, id: ++lineId });
    });
    if (toAdd.length === 0) return;

    setLines((prev) => [...prev, ...toAdd].slice(-MAX_VISIBLE));
    toAdd.forEach((l) => {
      const timer = setTimeout(() => {
        timersRef.current.delete(l.id);
        setLines((prev) => prev.filter((x) => x.id !== l.id));
      }, LINE_TTL_MS);
      timersRef.current.set(l.id, timer);
    });
  }, [events]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  if (lines.length === 0) return null;

  return (
    <div className="guide-live-ticker" aria-live="polite" aria-label="Activité du guide en direct">
      {lines.map((l) => (
        <div
          key={l.id}
          className="flex w-full items-center gap-2 rounded-[6px] border border-border bg-elevated px-2.5 py-2"
        >
          <LiveAvatar line={l} />
          <p className="min-w-0 flex-1 text-[11px] leading-snug">
            <span className="font-semibold text-foreground">{l.name}</span>{" "}
            <span className={ACCENT[l.kind]}>{l.text}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

/** Accent par nature d'event — les jetons du thème, jamais une couleur codée en dur. */
const ACCENT: Record<GuideLiveLine["kind"], string> = {
  step: "text-success",
  milestone: "text-warning",
  presence: "text-info",
};

/** Avatar Discord du membre, sinon son initiale — jamais une image vide. */
function LiveAvatar({ line }: { line: GuideLiveLine }) {
  if (line.avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={line.avatar}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className="h-6 w-6 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border bg-surface text-[10px] font-semibold text-muted-foreground">
      {(line.name || "?").charAt(0).toUpperCase()}
    </span>
  );
}
