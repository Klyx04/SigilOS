"use client";

/**
 * Module « Marché » — icône d'une stat (S2.4 / §12.4).
 *
 * Résolution en **deux temps** :
 *   1. **asset graphique officiel** (`public/assets/dofus/stats/*.png`) via
 *      `src/lib/dofus-stats-theme.ts` : c'est l'icône que le joueur voit en jeu
 *      et celle que la galerie de stuff / l'overlay boss affichent déjà ;
 *   2. **repli lucide** (`STAT_ICON_SPECS`) quand l'effet n'est pas
 *      identifiable — jamais d'icône cassée ni de carré vide.
 *
 * Consommé par la carte d'item, la fiche d'annonce, l'éditeur de jet et
 * l'encyclopédie (`ItemSearchPanel`). Aucune couleur en dur : la couleur vient
 * des specs (tokens du design system).
 */

import {
    Heart,
    Brain,
    Droplet,
    Wind,
    Flame,
    Sword,
    Zap,
    Footprints,
    Target,
    Eye,
    Star,
    Plus,
    Shield,
    ShieldCheck,
    Sparkles,
    Package,
    type LucideIcon,
} from "lucide-react";
import { resolveStatIconSpec, type StatIconName } from "@/lib/market/effects";
import { dofusStatAssetUrl, resolveDofusStatTheme } from "@/lib/dofus-stats-theme";
import { cn } from "@/lib/utils";

const ICON_COMPONENTS: Record<StatIconName, LucideIcon> = {
    heart: Heart,
    brain: Brain,
    droplet: Droplet,
    wind: Wind,
    flame: Flame,
    sword: Sword,
    zap: Zap,
    footprints: Footprints,
    target: Target,
    eye: Eye,
    star: Star,
    plus: Plus,
    shield: Shield,
    shieldCheck: ShieldCheck,
    sparkles: Sparkles,
    pkg: Package,
};

export function StatIcon({
    characteristicId,
    effectId,
    charCode,
    label,
    className,
}: {
    characteristicId?: number | null;
    /** Identifiant d'effet DofusDB — repli quand la caractéristique est absente. */
    effectId?: number | null;
    charCode?: string | null;
    /** Libellé déclaré — dernier filet (résolution par mots-clés). */
    label?: string | null;
    className?: string;
}) {
    // 1 — Asset officiel (la « vraie » icône Dofus), cf. S7.1.
    const theme = resolveDofusStatTheme(characteristicId, effectId, charCode, label);
    if (theme) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={dofusStatAssetUrl(theme.asset)}
                alt=""
                aria-hidden="true"
                loading="lazy"
                className={cn("h-4 w-4 shrink-0 object-contain", className)}
            />
        );
    }

    // 2 — Repli lucide (effet non identifiable) : jamais d'icône cassée.
    const spec = resolveStatIconSpec(characteristicId ?? effectId, charCode);
    const Icon = spec ? ICON_COMPONENTS[spec.icon] : Zap;
    return (
        <Icon
            className={cn("h-4 w-4 shrink-0", spec?.color ?? "text-muted-foreground", className)}
            aria-hidden="true"
        />
    );
}
