"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { GuideRealtimeEvent } from "@/lib/guide-realtime";
import { formatGuideLiveEvent, type GuideLiveLine } from "@/lib/guide-live-lines";

type LiveToast = GuideLiveLine & { id: number };

let toastId = 0;
/** 3 s : le temps de lire un pseudo et un nom de quête sans quitter le jeu des yeux. */
const TOAST_TTL_MS = 3000;
const MAX_VISIBLE = 2;

/**
 * Toast de l'overlay : « [avatar] Arakne a validé « L'Éternelle Moisson » » (3 s).
 *
 * Deux choix qui viennent de la mesure :
 *  1. **Rendu DANS l'overlay**, pas par `toast()` de Sonner : Sonner monte ses toasts sur
 *     `document.body` du document PRINCIPAL ; dans une fenêtre Document Picture-in-Picture,
 *     ils s'afficheraient derrière le jeu, hors de la fenêtre. Ici le toast suit donc la
 *     fenêtre PiP comme le reste de l'overlay.
 *  2. **Même phrase que le fil du dashboard** (`formatGuideLiveEvent`, source unique) : le
 *     toast ne réinvente pas le libellé d'un event.
 *
 * Zéro ombre, zéro flou : filet + surface, comme les autres cartes de l'overlay.
 */
export function RushOverlayLiveToast({ events }: { events: GuideRealtimeEvent[] }) {
  const [toasts, setToasts] = useState<LiveToast[]>([]);
  const seenRef = useRef(0);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (events.length <= seenRef.current) return;
    const fresh = events.slice(seenRef.current);
    seenRef.current = events.length;

    const added: LiveToast[] = [];
    for (const e of fresh) {
      const line = formatGuideLiveEvent(e);
      if (line) added.push({ ...line, id: ++toastId });
    }
    if (added.length === 0) return;

    setToasts((prev) => [...prev, ...added].slice(-MAX_VISIBLE));
    added.forEach((t) => {
      const timer = setTimeout(() => {
        timersRef.current.delete(t.id);
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, TOAST_TTL_MS);
      timersRef.current.set(t.id, timer);
    });
  }, [events]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      // `pointer-events-none` : un toast ne vole jamais un clic destiné à la quête dessous.
      className="pointer-events-none absolute bottom-3 left-3 z-[60] flex max-w-[19rem] flex-col gap-1.5"
      aria-live="polite"
      aria-label="Activité des coéquipiers"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-2 rounded-[6px] border border-border bg-elevated px-2.5 py-2"
        >
          {t.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={t.avatar}
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="h-6 w-6 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border bg-surface text-[10px] font-semibold text-muted-foreground">
              {(t.name || "?").charAt(0).toUpperCase()}
            </span>
          )}
          <p className="min-w-0 flex-1 text-[11px] leading-snug">
            <span className="font-semibold text-foreground">{t.name}</span>{" "}
            <span className={cn(ACCENT[t.kind])}>{t.text}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

const ACCENT: Record<GuideLiveLine["kind"], string> = {
  step: "text-success",
  milestone: "text-warning",
  presence: "text-info",
};
