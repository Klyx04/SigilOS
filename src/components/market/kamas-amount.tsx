/**
 * 🪙 Marché — **montant en kamas** avec l'icône officielle du jeu.
 *
 * Deux usages, une seule source (`public/assets/dofus/icons/kamas.png`) :
 * `KamasIcon` seul (libellés, en-têtes) et `KamasAmount` (icône + montant
 * formaté **déterministe** — BUG-9 : jamais `toLocaleString`).
 *
 * Volontairement sobre : pas d'emoji, pas de couleur en dur, l'icône du jeu
 * suffit à dire « kamas » — y compris à l'édition et dans les récapitulatifs.
 */

import Image from "next/image";

import { formatGroupedInteger } from "@/lib/market/kamas";

/** Icône kamas seule (14 px par défaut), alignée sur la ligne de texte. */
export function KamasIcon({ size = 14, className }: { size?: number; className?: string }) {
    return (
        <Image
            src="/assets/dofus/icons/kamas.png"
            alt="kamas"
            width={size}
            height={size}
            className={`inline-block shrink-0 ${className ?? ""}`}
            unoptimized
        />
    );
}

/** « 12 500 » + icône kamas (jamais de négatif affiché). */
export function KamasAmount({ value, className }: { value: number; className?: string }) {
    return (
        <span className={`inline-flex items-center gap-1 ${className ?? ""}`}>
            <KamasIcon />
            <span>{formatGroupedInteger(Math.max(0, Math.trunc(value)))}</span>
        </span>
    );
}
