"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Menu de filtre natif `<details>` — mais **exclusif**.
 *
 * Défaut mesuré le 06/11/2026 (capture utilisateur) : deux `<details>` voisins peuvent être
 * ouverts **en même temps**, et leurs panneaux se chevauchent (« filtre bug chevauche »).
 * Trois règles, et elles suffisent :
 *  · `name` (standard HTML) → ouvrir un menu ferme les autres du même groupe ;
 *  · un clic hors du menu le referme ;
 *  · `Échap` le referme et rend le focus au déclencheur.
 *
 * Le client ne porte **que le comportement** : les liens du panneau arrivent en `children`,
 * rendus côté serveur — le catalogue des classes et des métiers ne part pas dans le bundle.
 */
export function FilterMenu({
    icon,
    label,
    children,
}: {
    icon?: string;
    label: string;
    children: ReactNode;
}) {
    const ref = useRef<HTMLDetailsElement>(null);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            setOpen(false);
            ref.current?.querySelector("summary")?.focus();
        };
        const onPointerDown = (event: PointerEvent) => {
            if (!ref.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("pointerdown", onPointerDown);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.removeEventListener("pointerdown", onPointerDown);
        };
    }, [open]);

    return (
        <details
            ref={ref}
            name="visiteurs-filtres"
            open={open}
            onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
            className="relative"
        >
            <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-foreground [&::-webkit-details-marker]:hidden">
                {icon ? (
                    <Image
                        src={icon}
                        alt=""
                        width={20}
                        height={20}
                        aria-hidden="true"
                        className="h-5 w-5 shrink-0 object-contain"
                    />
                ) : null}
                {label}
                <span className="text-[0.7em] text-muted-foreground" aria-hidden="true">
                    ▾
                </span>
            </summary>
            {/* Sur grand écran le panneau s'ancre à droite : à `left-0`, le dernier menu
                débordait de la fenêtre (mesuré à 1 024 et 1 440 px). */}
            <div className="reg-panel absolute left-0 top-[calc(100%+0.5rem)] z-50 max-h-80 w-[min(20rem,calc(100vw-2rem))] overflow-y-auto p-1.5 lg:left-auto lg:right-0">
                {children}
            </div>
        </details>
    );
}
