"use client";

import { useEffect, useState } from "react";
import { getMyAvailability } from "@/server/actions/availability-actions";
import { Clock } from "lucide-react";
import { getISOWeek, getYear, startOfWeek, addWeeks } from "date-fns";

const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"] as const;
type Jour = (typeof JOURS)[number];

const JOUR_COURTS: Record<string, string> = {
    lundi: "Lun", mardi: "Mar", mercredi: "Mer", jeudi: "Jeu",
    vendredi: "Ven", samedi: "Sam", dimanche: "Dim",
};

type SlotColors = { pill: string };
const SLOT_STYLE: Record<string, SlotColors & { emoji: string; label: string }> = {
    matin: { pill: "bg-orange-500/20 text-orange-300 border-orange-500/30", emoji: "🌅", label: "Matin" },
    midi: { pill: "bg-warning/20 text-warning border-warning/30", emoji: "☀️", label: "Aprèm" },
    soir: { pill: "bg-violet-500/20 text-violet-300 border-violet-500/30", emoji: "🌙", label: "Soir" },
    nuit: { pill: "bg-info/20 text-info border-info/30", emoji: "🌃", label: "Nuit" },
};

/** Résout le contenu d'un GlobalAvailability ou AvailabilityMap en map simple jour→slots[] */
function resolveSimpleMap(raw: any): Record<string, string[]> {
    if (!raw || typeof raw !== "object") return {};

    // Nouveau format GlobalAvailability : { template: {...}, weeks: {...} }
    if ("template" in raw || "weeks" in raw) {
        const now = new Date();
        const monday = startOfWeek(now, { weekStartsOn: 1 });
        const weekKey = `${getYear(monday)}-W${getISOWeek(monday)}`;

        // Priorité : semaine courante > template
        const weekData = raw.weeks?.[weekKey] || raw.template || {};
        return weekData as Record<string, string[]>;
    }

    // Ancien format direct : { lundi: ["matin","soir"], ... }
    return raw as Record<string, string[]>;
}

interface AvailabilityPreviewProps {
    guildId: string;
}

export function AvailabilityPreview({ guildId }: AvailabilityPreviewProps) {
    const [map, setMap] = useState<Record<string, string[]> | null>(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        getMyAvailability(guildId).then((res) => {
            if (res.success) setMap(resolveSimpleMap(res.data));
            setLoaded(true);
        });
    }, [guildId]);

    if (!loaded) return null;

    const activeDays = JOURS.filter((j) => (map?.[j]?.length ?? 0) > 0);

    if (activeDays.length === 0) {
        return (
            <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-surface px-3 py-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground italic">
                    Aucune dispo renseignée dans ton profil —{" "}
                    <a
                        href={`/dashboard/${guildId}/profile`}
                        className="underline hover:text-muted-foreground transition-colors"
                        target="_blank"
                    >
                        compléter le profil
                    </a>
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-white/8 bg-surface px-3 py-2.5 space-y-2">
            <div className="flex items-center gap-1.5 text-caption font-black uppercase tracking-widest text-muted-foreground">
                <Clock className="h-3 w-3" />
                Dispos du profil (semaine courante)
            </div>
            <div className="flex flex-wrap gap-y-1.5 gap-x-4">
                {activeDays.map((jour) => (
                    <div key={jour} className="flex items-center gap-1.5">
                        <span className="text-caption font-black text-muted-foreground w-7">{JOUR_COURTS[jour]}</span>
                        <div className="flex gap-1 flex-wrap">
                            {(map![jour] || []).map((slot) => {
                                const style = SLOT_STYLE[slot] || {
                                    pill: "bg-muted/40 text-muted-foreground border-border/40",
                                    emoji: "🕐",
                                    label: slot,
                                };
                                return (
                                    <span
                                        key={slot}
                                        className={`text-caption px-1.5 py-0.5 rounded border font-bold whitespace-nowrap ${style.pill}`}
                                    >
                                        {style.emoji} {style.label}
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
