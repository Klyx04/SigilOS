"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCheck, ExternalLink, Loader2, RotateCcw, Trophy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
    ALL_SUCCES_LEVELS_ID,
    SUCCES_LEVEL_BRACKETS,
    findSuccesLevelBracket,
    matchesSuccesLevelBracket,
    succesLevelBracketLabel,
} from "@/lib/succes-level-brackets";
import {
    togglePublicDungeonAchievement,
    togglePublicDungeonAchievementsBracket,
} from "@/server/actions/public-profile-actions";
import { VisitorSection } from "./visitor-section";

export type DungeonAchievementGroup = {
    id: string;
    name: string;
    bossName: string;
    /** Niveau du donjon : porte le filtre et la validation par tranche (V1i). */
    level: number;
    /** Segment public de la fiche boss (`/boss/<slug>`). */
    slug: string;
    achievements: { id: string; label: string; iconUrl: string | null }[];
};

/**
 * Icône réelle du succès (proxy interne ou asset local, résolue côté serveur).
 * Le repli est un **état** : un `onError` laissait une case vide dans la fiche boss
 * (mesure du 30/10/2026), on rend donc un trophée neutre — jamais un carré noir.
 */
function AchievementIcon({ iconUrl }: { iconUrl: string | null }) {
    const [failed, setFailed] = useState(false);

    if (!iconUrl || failed) {
        return <Trophy className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />;
    }

    return (
        <img
            src={iconUrl}
            alt=""
            aria-hidden="true"
            className="size-4 shrink-0 object-contain"
            loading="lazy"
            onError={() => setFailed(true)}
        />
    );
}

/**
 * Coches de succès de donjon (V1c + V1i) : recherche, **filtre par tranche de niveau**,
 * validation groupée de la tranche et lien vers la fiche boss publique.
 *
 * Les tranches viennent de `src/lib/succes-level-brackets.ts` — la **même** source que le
 * tracker interne : une seule échelle, deux écrans. La validation groupée n'envoie qu'un
 * `bracketId` et une action ; le serveur relit les cibles (aucune plage client).
 *
 * La vue « qui a quoi entre visiteurs » est **V2b** : ici, on ne coche que pour soi.
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
    const [levelBracketId, setLevelBracketId] = useState<string>(ALL_SUCCES_LEVELS_ID);
    const [pendingId, setPendingId] = useState<string | null>(null);
    const [pendingBracket, setPendingBracket] = useState(false);

    const levelBracket = findSuccesLevelBracket(levelBracketId);
    const bracketLabel = succesLevelBracketLabel(levelBracket);

    const inBracket = useMemo(
        () => dungeons.filter((dungeon) => matchesSuccesLevelBracket(dungeon.level, levelBracket)),
        [dungeons, levelBracket]
    );

    const term = search.trim().toLowerCase();
    const filtered = useMemo(
        () =>
            inBracket.filter((dungeon) =>
                term.length === 0
                    ? true
                    : dungeon.name.toLowerCase().includes(term) ||
                      dungeon.bossName.toLowerCase().includes(term) ||
                      dungeon.achievements.some((achievement) => achievement.label.toLowerCase().includes(term))
            ),
        [inBracket, term]
    );

    const bracketTotal = inBracket.reduce((total, dungeon) => total + dungeon.achievements.length, 0);
    const bracketDone = inBracket.reduce(
        (total, dungeon) =>
            total + dungeon.achievements.filter((achievement) => checked.has(achievement.id)).length,
        0
    );
    const bracketAllDone = bracketTotal > 0 && bracketDone === bracketTotal;

    const toggle = async (achievementId: string) => {
        if (pendingId || pendingBracket) return;
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

    /** Même geste que l'interne : l'état réel de la tranche décide du sens du bouton. */
    const toggleBracket = async () => {
        if (pendingBracket || bracketTotal === 0) return;
        const action = bracketAllDone ? "unvalidate" : "validate";

        setPendingBracket(true);
        const result = await togglePublicDungeonAchievementsBracket({ bracketId: levelBracketId, action });
        setPendingBracket(false);

        if (!result.success) {
            toast.error(result.error);
            return;
        }

        setChecked((current) => {
            const next = new Set(current);
            for (const achievementId of result.data.achievementIds) {
                if (action === "validate") next.add(achievementId);
                else next.delete(achievementId);
            }
            return next;
        });
        toast.success(
            action === "validate"
                ? `${result.data.count} succès validés — ${bracketLabel}.`
                : `${result.data.count} succès décochés — ${bracketLabel}.`
        );
        router.refresh();
    };

    return (
        <VisitorSection
            title="Succès de donjon"
            description={`Coche ce que tu as déjà validé (${checked.size} succès). Les autres visiteurs ne le verront qu'à l'étape suivante du chantier.`}
        >
            <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Chercher un donjon, un boss ou un succès"
                        aria-label="Chercher un donjon, un boss ou un succès"
                        className="sm:flex-1"
                    />
                    <Select value={levelBracketId} onValueChange={setLevelBracketId}>
                        <SelectTrigger
                            aria-label="Filtrer par tranche de niveau"
                            className="h-9 w-full shrink-0 sm:w-[9.5rem]"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {SUCCES_LEVEL_BRACKETS.map((bracket) => (
                                <SelectItem key={bracket.id} value={bracket.id}>
                                    {succesLevelBracketLabel(bracket)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                        {bracketDone} / {bracketTotal} succès — {bracketLabel}
                    </p>
                    <button
                        type="button"
                        onClick={toggleBracket}
                        disabled={pendingBracket || bracketTotal === 0}
                        title={`${bracketAllDone ? "Décocher" : "Valider"} tous les succès : ${bracketLabel}`}
                        className={cn(
                            "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-elevated px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50",
                            bracketAllDone && "text-muted-foreground"
                        )}
                    >
                        {pendingBracket ? (
                            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                        ) : bracketAllDone ? (
                            <RotateCcw className="size-3.5" aria-hidden="true" />
                        ) : (
                            <CheckCheck className="size-3.5" aria-hidden="true" />
                        )}
                        <span>{bracketAllDone ? "Décocher la tranche" : "Valider la tranche"}</span>
                    </button>
                </div>

                {filtered.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Aucun donjon ne correspond à cette recherche dans cette tranche.
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {filtered.map((dungeon) => {
                            const open = openDungeonId === dungeon.id;
                            const done = dungeon.achievements.filter((achievement) => checked.has(achievement.id)).length;
                            return (
                                <li key={dungeon.id} className="rounded-xl border border-border">
                                    <div className="flex items-center gap-1 pr-1">
                                        <button
                                            type="button"
                                            aria-expanded={open}
                                            onClick={() => setOpenDungeonId(open ? null : dungeon.id)}
                                            className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            <span className="min-w-0">
                                                <span className="block truncate text-sm font-medium text-foreground">
                                                    {dungeon.name}
                                                </span>
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    {dungeon.bossName} · Niv. {dungeon.level}
                                                </span>
                                            </span>
                                            <span className="shrink-0 text-xs text-muted-foreground">
                                                {done} / {dungeon.achievements.length}
                                            </span>
                                        </button>
                                        <Link
                                            href={`/boss/${dungeon.slug}`}
                                            aria-label={`Voir la fiche du boss ${dungeon.bossName}`}
                                            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            <ExternalLink className="size-4" aria-hidden="true" />
                                        </Link>
                                    </div>

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
                                                        disabled={pendingId === achievement.id || pendingBracket}
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
                                                        <AchievementIcon iconUrl={achievement.iconUrl} />
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

