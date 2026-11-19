"use client";

import { cn } from "@/lib/utils";

/**
 * Les deux états manuels d'un donjon (`Fait` / `À faire`) — **un seul** rendu pour la
 * carte donjon et le panneau des succès. L'absence d'état reste « pas décidé ».
 *
 * Actif = aplat (on lit l'état d'un coup d'œil dans une petite fenêtre de jeu),
 * inactif = contour discret. Deux teintes sémantiques seulement : vert = fait,
 * ambre = à faire.
 */
export function DungeonStateButton({
    active,
    tone,
    label,
    ariaLabel,
    disabled,
    onClick,
}: {
    active: boolean;
    tone: "emerald" | "amber";
    label: string;
    ariaLabel: string;
    disabled: boolean;
    onClick: () => void;
}) {
    const activeCls =
        tone === "emerald"
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-amber-500 bg-amber-500 text-black";
    return (
        <button
            type="button"
            disabled={disabled}
            aria-pressed={active}
            aria-label={ariaLabel}
            onClick={onClick}
            className={cn(
                "rounded-md border px-2 py-1 text-[10px] font-bold transition-colors disabled:opacity-50",
                active
                    ? activeCls
                    : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground"
            )}
        >
            {label}
        </button>
    );
}
