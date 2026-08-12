"use client";
import { useEffect, useRef, useState } from "react";
import type { GuideRealtimeEvent } from "@/lib/guide-realtime";

type TickerLine = { id: number; text: string; kind: "step" | "milestone" };

let lineId = 0;
const LINE_TTL_MS = 4000;
const MAX_VISIBLE = 3;

function eventToText(e: GuideRealtimeEvent): string | null {
  switch (e.type) {
    case "step:validated":
      return `${e.userName} a validé ${e.subGuideRef} · étape ${e.stepNumber}`;
    case "step:validated:batch":
      return `${e.userName} a validé ${e.count} étapes dans ${e.subGuideRef}`;
    case "milestone:completed":
      return `${e.userName} a validé le jalon « ${e.milestoneTitle} »`;
    default:
      return null; // presence:join/leave → pas d'activité à afficher
  }
}

/**
 * Fil d'activité live du guide (Phase F).
 *
 * File FIFO de 3 lignes max, chaque ligne disparaît après 4s.
 * ZÉRO glow : fond var(--guide-surface), bordure var(--guide-green) à 20%.
 * Alimenté par les events step:validated / milestone:completed du hook
 * useGuidePresence.
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
    fresh.forEach(e => {
      const text = eventToText(e);
      if (text) toAdd.push({ id: ++lineId, text, kind: e.type === "milestone:completed" ? "milestone" : "step" });
    });
    if (toAdd.length === 0) return;

    setLines(prev => [...prev, ...toAdd].slice(-MAX_VISIBLE));
    toAdd.forEach(l => {
      const timer = setTimeout(() => {
        timersRef.current.delete(l.id);
        setLines(prev => prev.filter(x => x.id !== l.id));
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
      {lines.map(l => (
        <div key={l.id} className={`guide-live-line${l.kind === "milestone" ? " milestone" : ""}`}>
          {l.text}
        </div>
      ))}
    </div>
  );
}
