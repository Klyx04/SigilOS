"use client";

/**
 * Module « Marché » — icône d'une stat (S2.4 / §12.4).
 *
 * Mapping **unique** des slugs d'icônes partagés (`src/lib/market/effects.ts`)
 * vers les composants lucide. Consommé par la carte d'item, l'éditeur de jet et
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
import { resolveDofusStatTheme } from "@/lib/dofus-stats-theme";
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
    charCode,
    className,
}: {
    characteristicId?: number | null;
    charCode?: string | null;
    className?: string;
}) {
    const dofusTheme = resolveDofusStatTheme(characteristicId, null, charCode);
    if (dofusTheme?.asset) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={`/assets/dofus/stats/${dofusTheme.asset}`}
                alt={dofusTheme.label || "stat"}
                className={cn("h-4 w-4 shrink-0 object-contain", className)}
                aria-hidden="true"
            />
        );
    }

    const spec = resolveStatIconSpec(characteristicId, charCode);
    const Icon = spec ? ICON_COMPONENTS[spec.icon] : Zap;
    return (
        <Icon
            className={cn("h-4 w-4 shrink-0", spec?.color ?? "text-muted-foreground", className)}
            aria-hidden="true"
        />
    );
}
