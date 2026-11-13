"use client";

/**
 * Toast du Rush Live visiteur — **même DA et même emplacement** que les toasts locaux de
 * l'overlay (`RushOverlayLiveToast`) : surface `bg-elevated`, filet `border-border`, 3 s,
 * 2 visibles, `pointer-events-none`.
 *
 * Pourquoi un composant distinct : le flux public ne porte pas la même charge utile que
 * l'interne (pas d'étape, pas d'avatar — un bloc et un pseudo). La phrase reste minimale et
 * vient d'un événement **déjà validé** par la règle pure côté client (`parsePublicRushLiveFrame`).
 *
 * `inPip` : dans une fenêtre Document PiP, le toast est positionné dans la fenêtre flottante
 * (comme celui de l'overlay), pas derrière le jeu.
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { PublicRushLiveEvent } from "@/lib/public-rush-live";

type LiveToast = PublicRushLiveEvent & { toastId: number };

let toastCounter = 0;
/** 3 s : le temps de lire un pseudo et un nom de bloc sans quitter le jeu des yeux. */
const TOAST_TTL_MS = 3000;
const MAX_VISIBLE = 2;

export function PublicRushLiveToast({
    events,
    inPip = false,
}: {
    events: PublicRushLiveEvent[];
    inPip?: boolean;
}) {
    const [toasts, setToasts] = useState<LiveToast[]>([]);
    /** Curseur par identifiant (le flux est plafonné : une longueur n'avancerait plus). */
    const seenRef = useRef<number | null>(null);
    const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

    useEffect(() => {
        // Premier rendu (ouverture de la PiP comprise) : on ne rejoue pas l'historique.
        if (seenRef.current === null) {
            seenRef.current = events.length > 0 ? events[events.length - 1].id : 0;
            return;
        }
        const fresh = events.filter((event) => event.id > (seenRef.current ?? 0));
        if (fresh.length === 0) return;
        seenRef.current = fresh[fresh.length - 1].id;

        const added = fresh.map((event) => ({ ...event, toastId: ++toastCounter }));
        setToasts((prev) => [...prev, ...added].slice(-MAX_VISIBLE));

        added.forEach((toastItem) => {
            const timer = setTimeout(() => {
                timersRef.current.delete(toastItem.toastId);
                setToasts((prev) => prev.filter((item) => item.toastId !== toastItem.toastId));
            }, TOAST_TTL_MS);
            timersRef.current.set(toastItem.toastId, timer);
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
            className={cn(
                // `pointer-events-none` : un toast ne vole jamais un clic destiné au guide dessous.
                "pointer-events-none z-[60] flex w-[min(18rem,calc(100vw-1.5rem))] flex-col gap-1.5",
                inPip ? "absolute bottom-3 left-3" : "fixed bottom-3 left-3"
            )}
            aria-live="polite"
            aria-label="Activité des visiteurs de ton serveur"
        >
            {toasts.map((toastItem) => (
                <div
                    key={toastItem.toastId}
                    className="flex items-center gap-2 rounded-[6px] border border-border bg-elevated px-2.5 py-2"
                >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border bg-surface text-[10px] font-semibold text-muted-foreground">
                        {(toastItem.pseudo || "?").charAt(0).toUpperCase()}
                    </span>
                    <p className="min-w-0 flex-1 text-[11px] leading-snug">
                        <span className="font-semibold text-foreground">{toastItem.pseudo}</span>{" "}
                        <span className={toastItem.kind === "dofus" ? "text-warning" : "text-success"}>
                            {toastItem.kind === "dofus"
                                ? `a obtenu ${toastItem.title}`
                                : `a validé ${toastItem.title}`}
                        </span>
                    </p>
                </div>
            ))}
        </div>
    );
}
