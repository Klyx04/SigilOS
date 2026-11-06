"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { togglePublicDungeonAchievement } from "@/server/actions/public-profile-actions";
import { VisitorSection } from "./visitor-section";

export type DungeonAchievementGroup = {
    id: string;
    name: string;
    bossName: string;
    achievements: { id: string; label: string }[];
};

/**
 * Coches de succès de donjon (V1c). La vue « qui a quoi entre visiteurs » est **V2b** :
 * ici, on ne coche que pour soi.
 */
export function AchievementsChecklist({
    dungeons,
    checkedIds,
}: {
    dungeons: DungeonAchievementGroup[];
    checkedIds: string[];
}) {
    const router = useRouter();
    const [checked, setChecked] = useState<Set<string>>(() => new Set(checkedIds));
    const [openDungeonId, setOpenDungeonId] = useState<string | null>(dungeons[0]?.id ?? null);
    const [search, setSearch] = useState("");
    const [pendingId, setPendingId] = useState<string | null>(null);

    const term = search.trim().toLowerCase();
    const filtered = useMemo(
        () =>
            dungeons.filter((dungeon) =>
                term.length === 0
                    ? true
                    : dungeon.name.toLowerCase().includes(term) ||
                      dungeon.bossName.toLowerCase().includes(term) ||
                      dungeon.achievements.some((achievement) => achievement.label.toLowerCase().includes(term))
            ),
        [dungeons, term]
    );

    const toggle = async (achievementId: string) => {
        if (pendingId) return;
        const wasChecked = checked.has(achievementId);

        setPendingId(achievementId);
        setChecked((current) => {
            const next = new Set(current);
            if (wasChecked) next.delete(achievementId);
            else next.add(achievementId);
            return next;
        });

        const result = await togglePublicDungeonAchievement({ dungeonAchievementId: achievementId });
        setPendingId(null);

        if (!result.success) {
            setChecked((current) => {
                const next = new Set(current);
                if (wasChecked) next.add(achievementId);
                else next.delete(achievementId);
                return next;
            });
            toast.error(result.error);
            return;
        }

        router.refresh();
    };

    return (
        <VisitorSection
            title="Succès de donjon"
            description={`Coche ce que tu as déjà validé (${checked.size} succès). Les autres visiteurs ne le verront qu'à l'étape suivante du chantier.`}
        >
            <div className="space-y-4">
                <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Chercher un donjon, un boss ou un succès"
                    aria-label="Chercher un donjon, un boss ou un succès"
                />

                {filtered.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun donjon ne correspond à cette recherche.</p>
                ) : (
                    <ul className="space-y-2">
                        {filtered.map((dungeon) => {
                            const open = openDungeonId === dungeon.id;
                            const done = dungeon.achievements.filter((achievement) => checked.has(achievement.id)).length;
                            return (
                                <li key={dungeon.id} className="rounded-xl border border-border">
                                    <button
                                        type="button"
                                        aria-expanded={open}
                                        onClick={() => setOpenDungeonId(open ? null : dungeon.id)}
                                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-medium text-foreground">
                                                {dungeon.name}
                                            </span>
                                            <span className="block truncate text-xs text-muted-foreground">
                                                {dungeon.bossName}
                                            </span>
                                        </span>
                                        <span className="shrink-0 text-xs text-muted-foreground">
                                            {done} / {dungeon.achievements.length}
                                        </span>
                                    </button>

                                    {open ? (
                                        <div className="space-y-1 border-t border-border px-3 py-2">
                                            {dungeon.achievements.map((achievement) => {
                                                const isChecked = checked.has(achievement.id);
                                                return (
                                                    <button
                                                        key={achievement.id}
                                                        type="button"
                                                        role="checkbox"
                                                        aria-checked={isChecked}
                                                        onClick={() => toggle(achievement.id)}
                                                        disabled={pendingId === achievement.id}
                                                        className={cn(
                                                            "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                            isChecked ? "text-foreground" : "text-muted-foreground"
                                                        )}
                                                    >
                                                        <span
                                                            aria-hidden="true"
                                                            className={cn(
                                                                "flex size-4 shrink-0 items-center justify-center rounded border border-border text-[10px]",
                                                                isChecked && "border-primary bg-primary text-primary-foreground"
                                                            )}
                                                        >
                                                            {isChecked ? "✓" : ""}
                                                        </span>
                                                        <span className="min-w-0 truncate">{achievement.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : null}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </VisitorSection>
    );
}
