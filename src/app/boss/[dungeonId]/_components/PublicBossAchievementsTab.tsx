"use client";

import { useState } from "react";
import { Trophy, Check } from "lucide-react";
import { getDungeonAchievementIconUrl } from "@/lib/achievement-icon";
import { displayAchievementDescription } from "@/lib/challenge-description";
import { visibleDungeonAchievements } from "@/lib/dungeon-no-achievement";
import type { PublicDungeonAchievement } from "@/server/actions/public-boss-tabs-actions";
import { cn } from "@/lib/utils";

interface PublicBossAchievementsTabProps {
    achievements: PublicDungeonAchievement[];
    bossName: string;
    /** Coche « fait » (fiche boss **interne** uniquement — la fiche publique reste en lecture). */
    onToggle?: (achievementId: string) => void;
    /** Ids déjà marqués « fait » par le membre connecté. */
    doneIds?: ReadonlyArray<string>;
    /** Coche en cours d'enregistrement (anti double-clic). */
    pendingId?: string | null;
}

function AchievementCard({
    achievement,
    done,
    onToggle,
    pending,
}: {
    achievement: PublicDungeonAchievement;
    done?: boolean;
    onToggle?: (achievementId: string) => void;
    pending?: boolean;
}) {
    const iconUrl = getDungeonAchievementIconUrl(achievement);
    const checkable = typeof onToggle === "function";
    // Le repli est un **état**, pas un `style.display` : un `onError` laissait une case vide
    // (mesure du 30/10/2026 : « carré noir » sur les succès dont l'asset manque).
    const [iconFailed, setIconFailed] = useState(false);
    // Texte **honnête** : un succès « Spécial » encore au gabarit du seed dit qu'il n'est pas
    // documenté, il ne fait pas passer un gabarit pour une mécanique (A5 bis du 30/10/2026).
    const description = displayAchievementDescription({
        description: achievement.description,
        slug: achievement.slug,
    });

    return (
        <div
            className={cn(
                "flex items-start gap-3 p-4 rounded-xl bg-surface/50 border transition-colors",
                done ? "border-success/40 bg-success/5" : "border-border/70 hover:border-border",
            )}
        >
            {/* Icône du succès — réelle quand elle est connue (proxy interne), repli Trophy sinon. */}
            <div className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center p-1.5 shrink-0 overflow-hidden shadow-xs">
                {iconUrl && !iconFailed ? (
                    <img
                        src={iconUrl}
                        alt={achievement.name}
                        className="w-full h-full object-contain"
                        onError={() => setIconFailed(true)}
                    />
                ) : (
                    <Trophy className="w-5 h-5 text-amber-400/70" />
                )}
            </div>

            {/* Infos */}
            <div className="flex-1 min-w-0">
                <h5 className="text-sm font-bold text-foreground leading-snug">{achievement.name}</h5>
                {description && (
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                        {description}
                    </p>
                )}
            </div>

            {/* Coche « fait » — case native (clavier + lecteur d'écran), masquée en public. */}
            {checkable && (
                <label
                    className={cn(
                        "shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-bold cursor-pointer select-none transition-colors",
                        done
                            ? "border-success/50 bg-success/15 text-success"
                            : "border-border bg-background/60 text-muted-foreground hover:text-foreground hover:bg-elevated",
                        pending && "opacity-60 cursor-wait",
                    )}
                >
                    <input
                        type="checkbox"
                        className="sr-only"
                        checked={!!done}
                        disabled={pending}
                        onChange={() => onToggle?.(achievement.id)}
                        aria-label={`Marquer « ${achievement.name} » comme fait`}
                    />
                    <span
                        aria-hidden="true"
                        className={cn(
                            "w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center",
                            done ? "border-success bg-success text-success-foreground" : "border-border",
                        )}
                    >
                        {done && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                    </span>
                    Fait
                </label>
            )}
        </div>
    );
}

/**
 * Onglet Succès de la fiche boss publique.
 * Lecture seule — aucune interaction, aucune donnée de progression.
 */
export function PublicBossAchievementsTab({
    achievements,
    bossName,
    onToggle,
    doneIds,
    pendingId,
}: PublicBossAchievementsTabProps) {
    // « Donjon validé » n'est rendu que s'il est le **seul** succès du donjon (doubles boss) ;
    // partout ailleurs il reste écarté (décision du 11/10 conservée).
    const visible = visibleDungeonAchievements(achievements);
    const done = new Set(doneIds ?? []);

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
                    <AchievementCard
                        key={a.id}
                        achievement={a}
                        done={done.has(a.id)}
                        onToggle={onToggle}
                        pending={pendingId === a.id}
                    />
                ))}
            </div>
        </div>
    );
}
