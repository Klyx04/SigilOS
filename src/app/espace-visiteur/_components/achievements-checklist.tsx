"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    CheckCheck,
    CheckCircle2,
    ChevronLeft,
    Circle,
    ExternalLink,
    Loader2,
    RotateCcw,
    Trophy,
} from "lucide-react";
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
    togglePublicDungeonAchievementsGroup,
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
    imageUrl: string | null;
    isAnomalyBoss: boolean;
    isOcreQuest: boolean;
    achievements: { id: string; label: string; iconUrl: string | null }[];
};

type StatusFilter = "all" | "todo" | "done";

/** Avis de recherche : une fiche publique, un niveau — aucun succès à cocher. */
export type BountyTarget = {
    id: string;
    name: string;
    level: number;
    slug: string;
    imageUrl: string | null;
    zoneName: string | null;
};

/** Portée de la liste : les donjons (cochables) ou les avis (fiches seules). */
type SuccesScope = "dungeons" | "bounties";

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
    { id: "all", label: "Tous" },
    { id: "todo", label: "À faire" },
    { id: "done", label: "Finis" },
];

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
 * Vignette du donjon (image du boss) — le repère visuel de la liste interne.
 * Repli trophée si l'asset manque, badges Ocre / anomalie en surimpression.
 */
function DungeonThumb({
    imageUrl,
    isOcreQuest = false,
    isAnomalyBoss = false,
    size = "sm",
}: {
    imageUrl: string | null;
    isOcreQuest?: boolean;
    isAnomalyBoss?: boolean;
    size?: "sm" | "lg";
}) {
    const [failed, setFailed] = useState(false);
    const box = size === "lg" ? "size-14" : "size-11";

    return (
        <span className={cn("relative block shrink-0", box)}>
            <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-background">
                {imageUrl && !failed ? (
                    <img
                        src={imageUrl}
                        alt=""
                        aria-hidden="true"
                        className="h-full w-full object-cover"
                        loading="lazy"
                        onError={() => setFailed(true)}
                    />
                ) : (
                    <Trophy className="size-5 text-muted-foreground" aria-hidden="true" />
                )}
            </span>
            {isOcreQuest ? (
                <img
                    src="/module-dofus/Dofus_Ocre.png"
                    alt=""
                    aria-hidden="true"
                    title="Donjon de la Quête Ocre"
                    className="absolute -right-1 -bottom-1 size-5 rounded-full border border-border bg-background object-contain p-0.5"
                />
            ) : null}
            {isAnomalyBoss ? (
                <img
                    src="/assets/missions/ano1.png"
                    alt=""
                    aria-hidden="true"
                    title="Boss d'anomalie"
                    className="absolute -top-1 -right-1 size-5 rounded-full border border-border bg-background object-contain p-0.5"
                />
            ) : null}
        </span>
    );
}

/**
 * Onglet Succès (V1c + V1i) — **même mise en page que l'onglet interne** : résumé de
 * progression, filtres compacts, liste de donjons avec vignette du boss à gauche et fiche
 * du donjon à droite (mobile : plein écran + « Retour »).
 *
 * Différences assumées avec l'interne : **aucun bouton de groupe** (recherche de groupe,
 * guide DPNL) — un visiteur n'a pas de roster ; le lien mène à la **fiche publique**
 * `/boss/<slug>`. Les tranches viennent de `src/lib/succes-level-brackets.ts` (source
 * unique) ; la validation groupée n'envoie qu'un id, le serveur relit les cibles.
 */
export function AchievementsChecklist({
    dungeons,
    checkedIds,
    bounties,
}: {
    dungeons: DungeonAchievementGroup[];
    checkedIds: string[];
    bounties: BountyTarget[];
}) {
    const router = useRouter();
    const [checked, setChecked] = useState<Set<string>>(() => new Set(checkedIds));
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [scope, setScope] = useState<SuccesScope>("dungeons");
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<StatusFilter>("all");
    const [anomalyOnly, setAnomalyOnly] = useState(false);
    const [levelBracketId, setLevelBracketId] = useState<string>(ALL_SUCCES_LEVELS_ID);
    const [pendingId, setPendingId] = useState<string | null>(null);
    const [pendingBracket, setPendingBracket] = useState(false);
    const [pendingDungeon, setPendingDungeon] = useState(false);

    const levelBracket = findSuccesLevelBracket(levelBracketId);
    const bracketLabel = succesLevelBracketLabel(levelBracket);

    const inBracket = useMemo(
        () => dungeons.filter((dungeon) => matchesSuccesLevelBracket(dungeon.level, levelBracket)),
        [dungeons, levelBracket]
    );

    const term = search.trim().toLowerCase();
    const filtered = useMemo(
        () =>
            inBracket.filter((dungeon) => {
                if (anomalyOnly && !dungeon.isAnomalyBoss) return false;
                if (
                    term.length > 0 &&
                    !dungeon.name.toLowerCase().includes(term) &&
                    !dungeon.bossName.toLowerCase().includes(term) &&
                    !dungeon.achievements.some((achievement) => achievement.label.toLowerCase().includes(term))
                ) {
                    return false;
                }
                if (status === "all") return true;
                const done = dungeon.achievements.filter((achievement) => checked.has(achievement.id)).length;
                return status === "done" ? done === dungeon.achievements.length : done < dungeon.achievements.length;
            }),
        [inBracket, term, status, anomalyOnly, checked]
    );

    // Le détail suit le donjon choisi, même s'il sort de la recherche (comme l'interne) :
    // changer de tranche, lui, referme la fiche pour ne pas valider hors du filtre affiché.
    const selected = dungeons.find((dungeon) => dungeon.id === selectedId) ?? null;
    const selectedBounty = bounties.find((bounty) => bounty.id === selectedId) ?? null;

    const filteredBounties = useMemo(
        () =>
            bounties.filter((bounty) => {
                if (!matchesSuccesLevelBracket(bounty.level, levelBracket)) return false;
                if (term.length === 0) return true;
                return (
                    bounty.name.toLowerCase().includes(term) ||
                    (bounty.zoneName ?? "").toLowerCase().includes(term)
                );
            }),
        [bounties, levelBracket, term]
    );

    const doneCount = useMemo(
        () =>
            dungeons.reduce(
                (total, dungeon) =>
                    total + dungeon.achievements.filter((achievement) => checked.has(achievement.id)).length,
                0
            ),
        [dungeons, checked]
    );
    const totalCount = useMemo(
        () => dungeons.reduce((total, dungeon) => total + dungeon.achievements.length, 0),
        [dungeons]
    );
    const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
    const doneDungeons = useMemo(
        () =>
            dungeons.filter(
                (dungeon) =>
                    dungeon.achievements.length > 0 &&
                    dungeon.achievements.every((achievement) => checked.has(achievement.id))
            ).length,
        [dungeons, checked]
    );

    const bracketTotal = inBracket.reduce((total, dungeon) => total + dungeon.achievements.length, 0);
    const bracketDone = inBracket.reduce(
        (total, dungeon) =>
            total + dungeon.achievements.filter((achievement) => checked.has(achievement.id)).length,
        0
    );
    const bracketAllDone = bracketTotal > 0 && bracketDone === bracketTotal;

    const selectedDone = selected
        ? selected.achievements.filter((achievement) => checked.has(achievement.id)).length
        : 0;
    const selectedAllDone =
        !!selected && selected.achievements.length > 0 && selectedDone === selected.achievements.length;

    const toggle = async (achievementId: string) => {
        if (pendingId || pendingBracket || pendingDungeon) return;
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

    /** « Tout cocher / Tout décocher » du donjon ouvert (le serveur relit ses succès). */
    const toggleDungeon = async () => {
        if (!selected || pendingDungeon || pendingBracket) return;
        const action = selectedAllDone ? "unvalidate" : "validate";

        setPendingDungeon(true);
        const result = await togglePublicDungeonAchievementsGroup({ dungeonId: selected.id, action });
        setPendingDungeon(false);

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
                ? `${result.data.count} succès validés pour ce donjon.`
                : `${result.data.count} succès décochés pour ce donjon.`
        );
        router.refresh();
    };

    return (
        <VisitorSection
            title="Succès de donjon"
            description={`Coche ce que tu as déjà validé (${checked.size} succès). Les autres visiteurs ne le verront qu'à l'étape suivante du chantier.`}
        >
            <div className="space-y-4">
                {/* Résumé — même lecture que l'interne, en tokens de la DA */}
                <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-background">
                            <Trophy className="size-5 text-muted-foreground" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <div className="mb-1.5 flex items-center justify-between gap-2">
                                <span className="truncate text-sm font-medium text-foreground">
                                    Progression globale des succès
                                </span>
                                <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums">
                                    {progressPct} % ({doneCount}/{totalCount})
                                </span>
                            </div>
                            <div
                                role="progressbar"
                                aria-label="Progression globale des succès"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={progressPct}
                                className="h-2 overflow-hidden rounded-full border border-border bg-background"
                            >
                                <div className="h-full bg-warning transition-all" style={{ width: `${progressPct}%` }} />
                            </div>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 sm:border-l sm:border-border sm:pl-3">
                        <div className="rounded-xl border border-border bg-background/60 px-3 py-1.5 text-center">
                            <p className="text-xs text-muted-foreground">Donjons</p>
                            <p className="text-sm font-semibold text-foreground tabular-nums">
                                {doneDungeons}/{dungeons.length}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Filtres compacts */}
                <div className="space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder={
                                scope === "dungeons"
                                    ? "Rechercher un donjon ou un boss…"
                                    : "Rechercher un avis ou une zone…"
                            }
                            aria-label="Rechercher un donjon, un boss, un avis ou une zone"
                            className="sm:flex-1"
                        />
                        <Select
                            value={levelBracketId}
                            onValueChange={(value) => {
                                setLevelBracketId(value);
                                setSelectedId(null);
                            }}
                        >
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

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Portée : les donjons (cochables) ou les avis de recherche (fiches) */}
                        <div
                            role="group"
                            aria-label="Choisir la liste"
                            className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5"
                        >
                            <button
                                type="button"
                                aria-pressed={scope === "dungeons"}
                                onClick={() => {
                                    setScope("dungeons");
                                    setSelectedId(null);
                                }}
                                className={cn(
                                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    scope === "dungeons"
                                        ? "bg-warning/15 text-warning"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                Donjons
                            </button>
                            <button
                                type="button"
                                aria-pressed={scope === "bounties"}
                                onClick={() => {
                                    setScope("bounties");
                                    setSelectedId(null);
                                }}
                                className={cn(
                                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    scope === "bounties"
                                        ? "bg-warning/15 text-warning"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                Avis
                            </button>
                        </div>

                        {scope === "dungeons" ? (
                            <>
                        <div
                            role="group"
                            aria-label="Filtrer par avancement"
                            className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5"
                        >
                            {STATUS_FILTERS.map((entry) => (
                                <button
                                    key={entry.id}
                                    type="button"
                                    aria-pressed={status === entry.id}
                                    onClick={() => setStatus(entry.id)}
                                    className={cn(
                                        "rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                        status === entry.id
                                            ? "bg-warning/15 text-warning"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {entry.label}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            aria-pressed={anomalyOnly}
                            onClick={() => setAnomalyOnly((value) => !value)}
                            title="N'afficher que les boss d'anomalie"
                            className={cn(
                                "inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                anomalyOnly
                                    ? "border-warning/40 bg-warning/15 text-warning"
                                    : "border-border bg-surface text-muted-foreground hover:bg-elevated hover:text-foreground"
                            )}
                        >
                            <img
                                src="/assets/missions/ano1.png"
                                alt=""
                                aria-hidden="true"
                                className="size-3.5 object-contain"
                            />
                            Boss d&apos;anomalie
                        </button>
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
                            </>
                        ) : null}
                    </div>
                    {scope === "dungeons" ? (
                        <p className="text-xs text-muted-foreground">
                            {bracketDone} / {bracketTotal} succès — {bracketLabel}
                        </p>
                    ) : (
                        <p className="text-xs text-muted-foreground">
                            {filteredBounties.length} avis de recherche — {bracketLabel}
                        </p>
                    )}
                </div>

                {/* Liste + fiche : la disposition de l'onglet interne (340 px + détail) */}
                <div className="grid items-start gap-4 lg:grid-cols-[340px_1fr]">
                    <div
                        className={cn(
                            "space-y-2 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto lg:pr-1",
                            (selected || selectedBounty) && "hidden lg:block"
                        )}
                    >
                        {scope === "bounties" ? (
                            filteredBounties.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-border bg-background/40 py-12 text-center text-muted-foreground">
                                    <Trophy className="mx-auto mb-3 size-8 opacity-30" aria-hidden="true" />
                                    <p className="text-sm">Aucun avis ne correspond à ces filtres.</p>
                                </div>
                            ) : (
                                filteredBounties.map((bounty) => {
                                    const active = bounty.id === selectedId;
                                    return (
                                        <button
                                            key={bounty.id}
                                            type="button"
                                            onClick={() => setSelectedId(bounty.id)}
                                            aria-current={active ? "true" : undefined}
                                            className={cn(
                                                "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                active
                                                    ? "border-border-strong bg-elevated"
                                                    : "border-border bg-surface/70 hover:bg-elevated/70"
                                            )}
                                        >
                                            <DungeonThumb imageUrl={bounty.imageUrl} />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium text-foreground">
                                                    {bounty.name}
                                                </span>
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    LVL {bounty.level}
                                                    {bounty.zoneName ? ` · ${bounty.zoneName}` : ""}
                                                </span>
                                            </span>
                                            <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                                Avis
                                            </span>
                                        </button>
                                    );
                                })
                            )
                        ) : filtered.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-border bg-background/40 py-12 text-center text-muted-foreground">
                                <Trophy className="mx-auto mb-3 size-8 opacity-30" aria-hidden="true" />
                                <p className="text-sm">Aucun donjon ne correspond à ces filtres.</p>
                            </div>
                        ) : (
                            filtered.map((dungeon) => {
                                const done = dungeon.achievements.filter((achievement) =>
                                    checked.has(achievement.id)
                                ).length;
                                const pct = dungeon.achievements.length
                                    ? Math.round((done / dungeon.achievements.length) * 100)
                                    : 0;
                                const complete =
                                    dungeon.achievements.length > 0 && done === dungeon.achievements.length;
                                const active = dungeon.id === selectedId;
                                return (
                                    <button
                                        key={dungeon.id}
                                        type="button"
                                        onClick={() => setSelectedId(dungeon.id)}
                                        aria-current={active ? "true" : undefined}
                                        className={cn(
                                            "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                            active
                                                ? "border-border-strong bg-elevated"
                                                : "border-border bg-surface/70 hover:bg-elevated/70"
                                        )}
                                    >
                                        <DungeonThumb
                                            imageUrl={dungeon.imageUrl}
                                            isOcreQuest={dungeon.isOcreQuest}
                                            isAnomalyBoss={dungeon.isAnomalyBoss}
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium text-foreground">
                                                {dungeon.name}
                                            </span>
                                            <span className="block truncate text-xs text-muted-foreground">
                                                LVL {dungeon.level} · {done}/{dungeon.achievements.length}
                                            </span>
                                            <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-background">
                                                <span
                                                    className="block h-full bg-warning transition-all"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </span>
                                        </span>
                                        {complete ? (
                                            <span className="shrink-0 text-foreground">
                                                <span className="sr-only">Terminé</span>
                                                <CheckCircle2 className="size-4" aria-hidden="true" />
                                            </span>
                                        ) : (
                                            <Circle
                                                className="size-4 shrink-0 text-muted-foreground/40"
                                                aria-hidden="true"
                                            />
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {/* Fiche du donjon — même lecture que l'onglet interne */}
                    <div className={cn(!selected && !selectedBounty && "hidden lg:block")}>
                        {selected ? (
                            <div className="rounded-xl border border-border bg-surface">
                                <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <DungeonThumb
                                            imageUrl={selected.imageUrl}
                                            isOcreQuest={selected.isOcreQuest}
                                            isAnomalyBoss={selected.isAnomalyBoss}
                                            size="lg"
                                        />
                                        <div className="min-w-0">
                                            <h3 className="truncate text-base font-semibold text-foreground">
                                                {selected.name}
                                            </h3>
                                            <p className="truncate text-xs text-muted-foreground">
                                                Boss : {selected.bossName} · LVL {selected.level}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedId(null)}
                                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
                                        >
                                            <ChevronLeft className="size-3.5" aria-hidden="true" />
                                            Retour
                                        </button>
                                        <Link
                                            href={`/boss/${selected.slug}`}
                                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            <ExternalLink className="size-3.5" aria-hidden="true" />
                                            Voir la fiche
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={toggleDungeon}
                                            disabled={pendingDungeon || selected.achievements.length === 0}
                                            className={cn(
                                                "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition-colors hover:bg-elevated disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                selectedAllDone && "text-muted-foreground"
                                            )}
                                        >
                                            {pendingDungeon ? (
                                                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                                            ) : selectedAllDone ? (
                                                <RotateCcw className="size-3.5" aria-hidden="true" />
                                            ) : (
                                                <CheckCheck className="size-3.5" aria-hidden="true" />
                                            )}
                                            {selectedAllDone ? "Tout décocher" : "Tout cocher"}
                                        </button>
                                    </div>
                                </div>

                                <div className="p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm font-medium text-foreground">
                                            Succès — {selectedDone}/{selected.achievements.length}
                                        </p>
                                    </div>
                                    <div className="mt-2 h-2 overflow-hidden rounded-full border border-border bg-background">
                                        <div
                                            className="h-full bg-warning transition-all"
                                            style={{
                                                width: `${
                                                    selected.achievements.length
                                                        ? Math.round(
                                                              (selectedDone / selected.achievements.length) * 100
                                                          )
                                                        : 0
                                                }%`,
                                            }}
                                        />
                                    </div>

                                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        {selected.achievements.map((achievement) => {
                                            const isChecked = checked.has(achievement.id);
                                            return (
                                                <button
                                                    key={achievement.id}
                                                    type="button"
                                                    role="checkbox"
                                                    aria-checked={isChecked}
                                                    onClick={() => toggle(achievement.id)}
                                                    disabled={
                                                        pendingId === achievement.id ||
                                                        pendingBracket ||
                                                        pendingDungeon
                                                    }
                                                    className={cn(
                                                        "flex min-h-12 items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                        isChecked
                                                            ? "border-border-strong bg-surface/60"
                                                            : "border-border bg-surface/60 hover:bg-elevated"
                                                    )}
                                                >
                                                    <span
                                                        aria-hidden="true"
                                                        className={cn(
                                                            "flex size-5 shrink-0 items-center justify-center rounded-md border",
                                                            isChecked
                                                                ? "border-foreground bg-foreground text-background"
                                                                : "border-border bg-background"
                                                        )}
                                                    >
                                                        {isChecked ? <CheckCheck className="size-3.5" /> : null}
                                                    </span>
                                                    <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-background p-1">
                                                        <AchievementIcon iconUrl={achievement.iconUrl} />
                                                    </span>
                                                    <span
                                                        className={cn(
                                                            "min-w-0 truncate text-xs font-medium",
                                                            isChecked ? "text-muted-foreground" : "text-foreground"
                                                        )}
                                                    >
                                                        {achievement.label}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ) : selectedBounty ? (
                            <div className="rounded-xl border border-border bg-surface">
                                <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <DungeonThumb imageUrl={selectedBounty.imageUrl} size="lg" />
                                        <div className="min-w-0">
                                            <h3 className="truncate text-base font-semibold text-foreground">
                                                {selectedBounty.name}
                                            </h3>
                                            <p className="truncate text-xs text-muted-foreground">
                                                Avis de recherche · LVL {selectedBounty.level}
                                                {selectedBounty.zoneName ? ` · ${selectedBounty.zoneName}` : ""}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedId(null)}
                                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
                                        >
                                            <ChevronLeft className="size-3.5" aria-hidden="true" />
                                            Retour
                                        </button>
                                        <Link
                                            href={`/boss/${selectedBounty.slug}`}
                                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            <ExternalLink className="size-3.5" aria-hidden="true" />
                                            Voir la fiche
                                        </Link>
                                    </div>
                                </div>
                                <div className="p-4">
                                    <p className="text-sm text-muted-foreground">
                                        Un avis de recherche n&apos;a pas de succès de donjon à cocher : sa fiche
                                        publique donne la zone de traque, la prime et la stratégie de capture.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="hidden flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background/40 py-24 text-center text-muted-foreground lg:flex">
                                <Trophy className="mb-3 size-10 opacity-30" aria-hidden="true" />
                                <p className="text-sm font-medium">Sélectionne un donjon pour voir ses succès.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </VisitorSection>
    );
}

