'use client'

import { Swords, Skull, Zap, Clock, Sparkles } from "lucide-react";
import { InfinityIcon } from "lucide-react";

/**
 * Shared Mission Category Configuration
 * Used by both MissionCard and MissionEditor for consistent theming.
 */

export const MISSION_CATEGORIES = ["DONJON", "REGULATION", "ANOMALIE", "SONGES", "EXPEDITION", "EVENT"] as const;

export type MissionCategoryType = typeof MISSION_CATEGORIES[number];

export const CATEGORY_CONFIG: Record<MissionCategoryType, {
    icon: any;
    color: string;
    bgColor: string;
    borderColor: string;
    glowColor: string;
    label: string;
}> = {
    DONJON: {
        icon: Swords,
        color: "text-rose-400",
        bgColor: "bg-rose-950/30",
        borderColor: "border-rose-500/30",
        glowColor: "rgba(244, 63, 94, 0.4)",
        label: "Donjon"
    },
    REGULATION: {
        icon: Skull,
        color: "text-emerald-400",
        bgColor: "bg-emerald-950/30",
        borderColor: "border-emerald-500/30",
        glowColor: "rgba(52, 211, 153, 0.4)",
        label: "Régulation"
    },
    ANOMALIE: {
        icon: Zap,
        color: "text-fuchsia-400",
        bgColor: "bg-fuchsia-950/30",
        borderColor: "border-fuchsia-500/30",
        glowColor: "rgba(217, 70, 239, 0.4)",
        label: "Anomalie"
    },
    SONGES: {
        icon: InfinityIcon,
        color: "text-cyan-400",
        bgColor: "bg-cyan-950/30",
        borderColor: "border-cyan-500/30",
        glowColor: "rgba(34, 211, 238, 0.4)",
        label: "Songes"
    },
    EXPEDITION: {
        icon: Clock,
        color: "text-amber-400",
        bgColor: "bg-amber-950/30",
        borderColor: "border-amber-500/30",
        glowColor: "rgba(251, 191, 36, 0.4)",
        label: "Expédition"
    },
    EVENT: {
        icon: Sparkles,
        color: "text-yellow-300",
        bgColor: "bg-yellow-950/30",
        borderColor: "border-yellow-500/30",
        glowColor: "rgba(253, 224, 71, 0.4)",
        label: "Événement"
    }
};
