"use client";

import { Trophy } from "lucide-react";
import { getDungeonAchievementIconUrl } from "@/lib/achievement-icon";
import { NO_ACHIEVEMENT_CHALLENGE_SLUG } from "@/lib/dungeon-no-achievement";
import type { PublicDungeonAchievement } from "@/server/actions/public-boss-tabs-actions";

interface PublicBossAchievementsTabProps {
    achievements: PublicDungeonAchievement[];
    bossName: string;
}

function AchievementCard({ achievement }: { achievement: PublicDungeonAchievement }) {
    const iconUrl = getDungeonAchievementIconUrl(achievement);

    return (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-surface/50 border border-border/70 hover:border-border transition-colors">
            {/* Icône du succès — réelle quand elle est connue (proxy interne), repli Trophy sinon. */}
            <div className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center p-1.5 shrink-0 overflow-hidden shadow-xs">
                {iconUrl ? (
                    <img
                        src={iconUrl}
                        alt={achievement.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                            e.currentTarget.style.display = "none";
                        }}
                    />
                ) : (
                    <Trophy className="w-5 h-5 text-amber-400/70" />
                )}
            </div>

            {/* Infos */}
            <div className="flex-1 min-w-0">
                <h5 className="text-sm font-bold text-foreground leading-snug">{achievement.name}</h5>
                {achievement.description && (
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                        {achievement.description}
                    </p>
                )}
            </div>
        </div>
    );
}

/**
 * Onglet Succès de la fiche boss publique.
 * Lecture seule — aucune interaction, aucune donnée de progression.
 */
export function PublicBossAchievementsTab({ achievements, bossName }: PublicBossAchievementsTabProps) {
    // Le pseudo-succès « Donjon validé » n'est plus rendu (demande user du 11/10/2026) : on l'écarte
    // même si une ligne résiduelle traînait en base avant la purge.
    const visible = achievements.filter((a) => a.slug !== NO_ACHIEVEMENT_CHALLENGE_SLUG);

    if (visible.length === 0) {
        return (
            <p className="text-xs text-muted-foreground py-8 text-center border border-dashed border-border rounded-xl bg-background/40">
                Aucun succès connu pour {bossName}.
            </p>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <img
                    src="/assets/dofus/modules/spells.png"
                    alt=""
                    className="w-4 h-4 object-contain opacity-80"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
                <h4 className="text-sm font-bold text-foreground">Succès du donjon</h4>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                    {visible.length} succès
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {visible.map((a) => (
                    <AchievementCard key={a.id} achievement={a} />
                ))}
            </div>
        </div>
    );
}
