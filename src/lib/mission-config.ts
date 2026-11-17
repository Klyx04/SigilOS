'use client'

import { Swords, Skull, Zap, Clock, Sparkles } from "lucide-react";
import { InfinityIcon } from "lucide-react";

/**
 * Shared Mission Category Configuration
 * Used by both MissionCard and MissionEditor for consistent theming.
 *
 * 🎨 DA (règle `docs/RULES.md` § UI) : **aucune palette en dur**. Les six catégories
 * s'appuient uniquement sur les tokens sémantiques (`danger`, `success`, `warning`,
 * `info`) ; l'accent d'action de l'écran (sélection, bouton principal) reste `warning`.
 * `glowColor` a été retiré : lu nulle part, et une ombre colorée est un motif interdit.
 */

export const MISSION_CATEGORIES = ["DONJON", "REGULATION", "ANOMALIE", "SONGES", "EXPEDITION", "EVENT"] as const;

export type MissionCategoryType = typeof MISSION_CATEGORIES[number];

export const CATEGORY_CONFIG: Record<MissionCategoryType, {
    icon: any;
    color: string;
    bgColor: string;
    borderColor: string;
    label: string;
}> = {
    DONJON: {
        icon: Swords,
        color: "text-danger",
        bgColor: "bg-danger/10",
        borderColor: "border-danger/25",
        label: "Donjon"
    },
    REGULATION: {
        icon: Skull,
        color: "text-success",
        bgColor: "bg-success/10",
        borderColor: "border-success/25",
        label: "Régulation"
    },
    ANOMALIE: {
        icon: Zap,
        color: "text-warning",
        bgColor: "bg-warning/10",
        borderColor: "border-warning/25",
        label: "Anomalie"
    },
    SONGES: {
        icon: InfinityIcon,
        color: "text-info",
        bgColor: "bg-info/10",
        borderColor: "border-info/25",
        label: "Songes"
    },
    EXPEDITION: {
        icon: Clock,
        color: "text-info",
        bgColor: "bg-info/10",
        borderColor: "border-info/25",
        label: "Expédition"
    },
    EVENT: {
        icon: Sparkles,
        color: "text-warning",
        bgColor: "bg-warning/10",
        borderColor: "border-warning/25",
        label: "Événement"
    }
};
