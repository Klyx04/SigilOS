"use client";

/**
 * BUG-1 — **vignette d'objet toujours résolue**, partagée par tous les écrans du
 * Marché (catalogue, table, fiche, « Mon espace », modération, négociation).
 *
 * 🎯 Constat beta : le catalogue affichait des icônes **404** parce que
 * `MarketListing.itemIconUrl` pouvait contenir le chemin **statique**
 * `/uploads/assets-dofus/items/32239.webp`, qui n'existe que si le siphon a déjà
 * tourné. Le nom nu (`25757.webp`) était en plus résolu par le navigateur en
 * `/marche/25757.webp`.
 *
 * ✅ Une seule forme d'URL pour tout le module : `normalizeItemIconUrl()` renvoie
 * le **proxy auto-siphon** (`/api/assets-dofus/items/{ankamaId}`, jamais de 404 :
 * il sert le WebP local, sinon le télécharge, sinon un placeholder). En cas
 * d'échec réseau, on retente **une fois** le proxy depuis l'`ankamaId` — jamais
 * d'image cassée, jamais de boucle.
 *
 * 🔒 Composant **purement présentationnel** : aucune règle métier, aucun appel
 * serveur, aucune donnée privée. Les identifiants Ankama sont des entiers bornés.
 */

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { itemImageProxyUrl, normalizeItemIconUrl } from "@/lib/market/item-image";
import { cn } from "@/lib/utils";

export function MarketItemIcon({
    src,
    ankamaId = null,
    alt,
    size = 48,
    className,
    fallback = null,
}: {
    /** URL brute issue de la base (peut être un chemin local, un nom nu, `null`). */
    src?: string | null;
    /** `GameItem.ankamaId` (identifiant Ankama) — repli sûr du proxy. */
    ankamaId?: number | null;
    alt: string;
    /** Côté en pixels (vignette 48–64 px sur les listes). */
    size?: number;
    className?: string;
    /** Affiché quand aucune URL n'est exploitable (icône lucide, etc.). */
    fallback?: ReactNode;
}) {
    const [proxyOnly, setProxyOnly] = useState(false);
    const resolved = proxyOnly ? itemImageProxyUrl(ankamaId) : normalizeItemIconUrl(src ?? null, ankamaId);

    if (!resolved) return <>{fallback}</>;

    return (
        <Image
            src={resolved}
            alt={alt}
            width={size}
            height={size}
            unoptimized
            onError={() => setProxyOnly(true)}
            className={cn("object-contain", className)}
        />
    );
}
