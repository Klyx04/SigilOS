"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { Loader2, X } from "lucide-react";
import { getMonsterFicheBySegment } from "@/server/actions/game-data-actions";
import type { MonsterFichePayload } from "@/components/succes/MonsterFicheView";

/**
 * La fiche est **lourde** (paliers, sorts, butin, simulation) : on la charge à
 * la demande pour ne pas alourdir le guide ni la PiP tant que personne n'ouvre
 * la fiche d'un monstre.
 */
const MonsterFicheView = dynamic(
    () => import("@/components/succes/MonsterFicheView").then((mod) => mod.MonsterFicheView),
    {
        ssr: false,
        loading: () => (
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Chargement de la fiche…
            </div>
        ),
    }
);

/**
 * Fiche **interne** d'un monstre, ouverte depuis un tag de combat du guide Rush.
 *
 * Même source unique que `/bestiaire/<slug>` et que l'onglet « Monstres » du
 * module Succès (`getMonsterFicheBySegment` → `MonsterFicheView`) : le membre
 * reste dans le guide, le visiteur reçoit le lien public.
 *
 * Le modal vit **dans** le portail du guide (comme le détail de quête) : pas de
 * Radix, pas de portail vers `<body>`, donc le thème de la PiP est conservé.
 *
 * ⚠️ Mesure du 25/11/2026 : le tag de combat est rendu dans une carte
 * (`transform`/`stacking context`). Un `position: fixed` posé **dans** cette carte
 * reste relatif à son ancêtre : les quêtes et l'aside passaient au-dessus de la fiche.
 * On porte donc la fiche dans le `<body>` du **document propriétaire** (page hôte ou
 * PiP) via un marqueur, ce qui conserve le thème et couvre réellement la surface.
 */
export function RushMonsterFicheModal({
    slug,
    name,
    onClose,
}: {
    slug: string;
    name: string;
    onClose: () => void;
}) {
    const [fiche, setFiche] = useState<MonsterFichePayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const markerRef = useRef<HTMLSpanElement>(null);
    const [host, setHost] = useState<HTMLElement | null>(null);

    useEffect(() => {
        const doc = markerRef.current?.ownerDocument ?? document;
        setHost(doc.body);
    }, []);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        setError(null);
        getMonsterFicheBySegment(slug)
            .then((result) => {
                if (!alive) return;
                if (result.success && result.data) setFiche(result.data);
                else setError("Fiche indisponible pour le moment.");
            })
            .catch(() => {
                if (alive) setError("Fiche indisponible pour le moment.");
            })
            .finally(() => {
                if (alive) setLoading(false);
            });
        return () => {
            alive = false;
        };
    }, [slug]);

    useEffect(() => {
        const doc = host?.ownerDocument ?? document;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        doc.addEventListener("keydown", onKey);
        return () => doc.removeEventListener("keydown", onKey);
    }, [host, onClose]);

    return (
        <>
            <span ref={markerRef} hidden />
            {host
                ? createPortal(
                    <div
                        className="fixed inset-0 z-[130] flex items-center justify-center p-3"
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Fiche de ${name}`}
                    >
            <button
                type="button"
                aria-label="Fermer la fiche"
                onClick={onClose}
                className="fixed inset-0 bg-black/70"
            />
            <div className="relative z-10 flex max-h-[calc(100dvh-2rem)] w-[min(72rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[6px] border border-border-strong bg-elevated">
                <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-3.5 py-2.5">
                    <div className="min-w-0">
                        <p className="text-[11px] text-muted-foreground">Fiche du monstre</p>
                        <h3 className="truncate text-[14px] font-semibold text-foreground">{name}</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Fermer la fiche"
                        className="-mr-1 -mt-1 shrink-0 rounded-[4px] p-1.5 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                    {loading && (
                        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            Chargement de la fiche…
                        </div>
                    )}
                    {error && !loading && (
                        <p className="text-[12px] text-danger" role="alert">
                            {error}
                        </p>
                    )}
                    {fiche && !loading && <MonsterFicheView fiche={fiche} locale="fr" />}
                </div>
            </div>
                    </div>,
                    host
                )
                : null}
        </>
    );
}
