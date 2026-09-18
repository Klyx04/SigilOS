"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    CheckCircle2,
    Circle,
    Trophy,
    Search,
    ChevronLeft,
    Swords,
    Loader2,
    Users,
    X,
    Zap,
    CheckCheck,
    RotateCcw,
} from "lucide-react";
import {
    toggleAchievementCompleted,
    toggleDungeonAchievements,
    toggleLevelBracketAchievements,
    getUserDungeonProgress,
    findMissingAchievements,
} from "@/server/actions/dungeon-finder-actions";
import { getDungeonsWithAchievements } from "@/server/actions/game-data-actions";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Achievement {
    id: string;
    points: number;
    challenge: { id: string; name: string; iconUrl?: string | null };
}

interface Dungeon {
    id: string;
    name: string;
    bossName: string;
    level: number;
    imageUrl?: string | null;
    isOcreQuest?: boolean;
    /* Chantier « boss d'anomalie » : contenu siphonné (Gardiens des anomalies). */
    isAnomalyBoss?: boolean | null;
    anomalyFamily?: string | null;
    // #171 — liens guides externes (rendus avec favicon dans le détail donjon)
    dpnlUrl?: string | null;
    dofuspourlesnoobsUrl?: string | null;
    dofensiveUrl?: string | null;
    achievements: Achievement[];
}

interface ProgressEntry {
    achievementId: string;
    dungeonId: string;
    source: string;
    completedAt: string | null;
}

interface Partner {
    achievementId: string;
    achievementName: string;
    iconUrl: string | null;
    membersWhoHaveIt: { name: string; imageUrl: string | null }[];
}

interface SuccesTrackerProps {
    guildId: string;
    canEdit: boolean;
}

type StatusFilter = "all" | "todo" | "done";

const LEVEL_PRESETS = [
    { label: "Tous", min: 1, max: 1000 },
    { label: "1-99", min: 1, max: 99 },
    { label: "100-149", min: 100, max: 149 },
    { label: "150-199", min: 150, max: 199 },
    { label: "200+", min: 200, max: 1000 },
] as const;

/** Libellé lisible d'une tranche de niveau (contrôle compact du filtre « Mes Succès »). */
function levelPresetLabel(label: (typeof LEVEL_PRESETS)[number]["label"]): string {
    return label === "Tous" ? "Tous les niveaux" : `Niveau ${label}`;
}

/**
 * #138 — Vue « Moi » du module Succès (refonte d'AchievementTracker).
 * Split view : liste de donjons à gauche, détail à droite (mobile : plein écran + Retour).
 * Batch toggle (1 server action), coche optimiste, hint « partenaires », toast participant.
 * URL = source de vérité : ?status= / ?q= / ?dungeon=
 */
export function SuccesTracker({ guildId, canEdit }: SuccesTrackerProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [dungeons, setDungeons] = useState<Dungeon[]>([]);
    const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
    const [progressEntries, setProgressEntries] = useState<ProgressEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<StatusFilter>("all");
    const [minLevel, setMinLevel] = useState(1);
    const [maxLevel, setMaxLevel] = useState(1000);
    // Filtre « Boss Anomalie » (chantier gardiens des anomalies) — cumulable avec la tranche de niveau.
    const [anomalyOnly, setAnomalyOnly] = useState(searchParams.get("anomaly") === "1");
    const [partners, setPartners] = useState<Record<string, Partner[]>>({});
    const [loadingPartners, setLoadingPartners] = useState(false);
    const [bracketLoading, setBracketLoading] = useState(false);
    const toastFired = useRef(false);
    const autoSelectedRef = useRef(false);

    const selectedDungeonId = searchParams.get("dungeon");

    const handleToggleLevelBracket = useCallback(
        async (action: "validate" | "unvalidate") => {
            if (!canEdit || bracketLoading) return;
            setBracketLoading(true);
            try {
                const res = await toggleLevelBracketAchievements(guildId, minLevel, maxLevel, action);
                if (res.success && res.data) {
                    const affectedIds = res.data.achievementIds;
                    setCompletedIds((prev) => {
                        const next = new Set(prev);
                        if (action === "validate") {
                            affectedIds.forEach((id) => next.add(id));
                        } else {
                            affectedIds.forEach((id) => next.delete(id));
                        }
                        return next;
                    });
                    toast.success(
                        action === "validate"
                            ? `Tous les succès de la tranche (Niv. ${minLevel}-${maxLevel === 1000 ? "200+" : maxLevel}) ont été validés !`
                            : `Tous les succès de la tranche ont été décochés.`
                    );
                } else {
                    toast.error(res.error || "Erreur lors de la mise à jour");
                }
            } catch {
                toast.error("Erreur de communication avec le serveur");
            } finally {
                setBracketLoading(false);
            }
        },
        [canEdit, bracketLoading, guildId, minLevel, maxLevel]
    );

    const updateParam = useCallback(
        (key: string, value: string | null) => {
            const params = new URLSearchParams(searchParams.toString());
            if (value === null) params.delete(key);
            else params.set(key, value);
            router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
        },
        [router, searchParams]
    );

    // Charge le catalogue (statique) + le progrès perso (court).
    useEffect(() => {
        let cancelled = false;
        async function load() {
            const [dungeonsRes, progressRes] = await Promise.all([
                getDungeonsWithAchievements(),
                getUserDungeonProgress(guildId),
            ]);
            if (cancelled) return;
            if (dungeonsRes.success && dungeonsRes.data) {
                setDungeons(
                    // On inclut AUSSI les donjons sans succès associé (ils doivent rester visibles,
                    // p.ex. via /succes?dungeon=<id>). L'écran gère l'état « 0 succès ».
                    (dungeonsRes.data as Dungeon[]).sort((a, b) => a.level - b.level)
                );
            }
            if (progressRes.success && progressRes.data) {
                setCompletedIds(new Set(progressRes.data.map((p) => p.achievementId)));
                setProgressEntries(progressRes.data);
            }
            setLoading(false);
        }
        load();
        return () => {
            cancelled = true;
        };
    }, [guildId]);

    // #138 — Toast participant : des succès ont été validés par un groupe depuis la dernière visite.
    useEffect(() => {
        if (toastFired.current || progressEntries.length === 0) return;
        try {
            const key = "sigil:succes:group-last-seen";
            const lastSeen = Number(localStorage.getItem(key) || 0);
            const fresh = progressEntries.filter(
                (p) => p.source === "GROUP" && p.completedAt && new Date(p.completedAt).getTime() > lastSeen
            );
            if (fresh.length > 0) {
                toast.success(
                    `${fresh.length} succès validé${fresh.length > 1 ? "s" : ""} par un groupe de donjon — ta checklist a été mise à jour. 🏆`
                );
            }
            localStorage.setItem(key, String(Date.now()));
        } catch {
            /* localStorage indisponible (SSR/privacy) — non bloquant */
        }
        toastFired.current = true;
    }, [progressEntries]);

    const selectedDungeon = dungeons.find((d) => d.id === selectedDungeonId) || null;

    // #138 UI : jamais de panneau vide à droite — on auto-sélectionne le 1er donjon « à faire »
    // (sinon le 1er de la liste) UNE SEULE fois au chargement (le « Retour à la liste » mobile
    // efface l'URL sans être surchargé).
    useEffect(() => {
        if (autoSelectedRef.current || loading || dungeons.length === 0) return;
        if (selectedDungeonId) {
            autoSelectedRef.current = true;
            return;
        }
        const firstTodo = dungeons.find((d) => d.achievements.some((a) => !completedIds.has(a.id))) || dungeons[0];
        if (firstTodo) {
            autoSelectedRef.current = true;
            updateParam("dungeon", firstTodo.id);
        }
    }, [loading, dungeons, selectedDungeonId, completedIds, updateParam]);

    // Hint « partenaires » : chargé à la sélection, une seule fois par donjon.
    useEffect(() => {
        if (!selectedDungeon || partners[selectedDungeon.id] || loadingPartners) return;
        let cancelled = false;
        setLoadingPartners(true);
        findMissingAchievements(guildId, selectedDungeon.id)
            .then((res) => {
                if (!cancelled && res.success && res.data) {
                    setPartners((prev) => ({ ...prev, [selectedDungeon.id]: res.data! }));
                }
            })
            .finally(() => {
                if (!cancelled) setLoadingPartners(false);
            });
        return () => {
            cancelled = true;
        };
    }, [selectedDungeon, partners, guildId, loadingPartners]);

    const toggleOne = useCallback(
        (achievementId: string) => {
            if (!canEdit) return;
            const dungeon = dungeons.find((d) => d.achievements.some((a) => a.id === achievementId));
            if (!dungeon) return;
            const prev = completedIds;
            const next = new Set(prev);
            const target = !prev.has(achievementId);
            target ? next.add(achievementId) : next.delete(achievementId);
            setCompletedIds(next);
            toggleAchievementCompleted(guildId, dungeon.id, achievementId)
                .then((res) => {
                    if (!res.success) {
                        setCompletedIds(prev);
                        toast.error(res.error);
                    }
                })
                .catch(() => setCompletedIds(prev));
        },
        [canEdit, completedIds, dungeons, guildId]
    );

    const toggleAll = useCallback(
        (checkAll: boolean) => {
            if (!canEdit || !selectedDungeon) return;
            const prev = completedIds;
            const next = new Set(prev);
            for (const a of selectedDungeon.achievements) {
                checkAll ? next.add(a.id) : next.delete(a.id);
            }
            setCompletedIds(next);
            toggleDungeonAchievements(guildId, selectedDungeon.id, { mode: checkAll ? "all" : "none" })
                .then((res) => {
                    if (!res.success) {
                        setCompletedIds(prev);
                        toast.error(res.error);
                    }
                })
                .catch(() => setCompletedIds(prev));
        },
        [canEdit, selectedDungeon, completedIds, guildId]
    );

    // ── Une seule bascule par contexte : l'état décide du sens du bouton ────────
    /** Tous les succès du donjon ouvert sont-ils déjà cochés ? */
    const selectedAllDone = useMemo(
        () =>
            !!selectedDungeon &&
            selectedDungeon.achievements.length > 0 &&
            selectedDungeon.achievements.every((a) => completedIds.has(a.id)),
        [selectedDungeon, completedIds]
    );

    /** Donjons de la tranche de niveau sélectionnée (portée réelle du bouton « tranche »). */
    const bracketDungeons = useMemo(
        () => dungeons.filter((d) => d.level >= minLevel && d.level <= maxLevel),
        [dungeons, minLevel, maxLevel]
    );
    /** Toute la tranche de niveau est-elle déjà validée ? */
    const bracketAllDone = useMemo(
        () =>
            bracketDungeons.some((d) => d.achievements.length > 0) &&
            bracketDungeons.every((d) => d.achievements.every((a) => completedIds.has(a.id))),
        [bracketDungeons, completedIds]
    );
    const bracketLabel = minLevel === 1 && maxLevel === 1000 ? "du jeu" : `Niv. ${minLevel}-${maxLevel === 1000 ? "200+" : maxLevel}`;

    const doneCount = useMemo(
        () => dungeons.reduce((acc, d) => acc + d.achievements.filter((a) => completedIds.has(a.id)).length, 0),
        [dungeons, completedIds]
    );
    const totalCount = useMemo(() => dungeons.reduce((acc, d) => acc + d.achievements.length, 0), [dungeons]);
    const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    const filteredDungeons = useMemo(() => {
        const term = search.toLowerCase();
        return dungeons.filter((d) => {
            const matchSearch = d.name.toLowerCase().includes(term) || d.bossName.toLowerCase().includes(term);
            const matchLevel = d.level >= minLevel && d.level <= maxLevel;
            // Filtre « Boss Anomalie » : uniquement le contenu siphonné (isAnomalyBoss).
            const matchKind = !anomalyOnly || !!d.isAnomalyBoss;
            if (!matchSearch || !matchLevel || !matchKind) return false;
            const done = d.achievements.filter((a) => completedIds.has(a.id)).length;
            // Un donjon sans aucun succès n'est ni « done » ni « todo » → il reste visible sous « Tous ».
            if (d.achievements.length === 0) return true;
            if (status === "done") return done === d.achievements.length;
            if (status === "todo") return done < d.achievements.length;
            return true;
        });
    }, [dungeons, search, status, minLevel, maxLevel, anomalyOnly, completedIds]);

    const selectedPartners = selectedDungeon ? partners[selectedDungeon.id] : undefined;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-warning" />
                <p className="font-medium">Chargement de tes succès…</p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Glance compact & épuré : résumé de progression */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5 p-3.5 rounded-2xl bg-surface/80 border border-border">
                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center shrink-0">
                        <Trophy className="w-5 h-5 text-warning" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-xs font-bold text-foreground truncate">Progression globale des succès</span>
                            <span className="text-xs font-black text-warning tabular-nums shrink-0">{progressPct}% ({doneCount}/{totalCount})</span>
                        </div>
                        <div className="h-2 rounded-full bg-background border border-border/80 overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-warning/80 to-warning transition-all duration-300"
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 sm:border-l sm:border-border sm:pl-3.5">
                    <div className="px-3 py-1.5 rounded-xl bg-background/60 border border-border text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Donjons</p>
                        <p className="text-sm font-black text-foreground tabular-nums">{dungeons.length}</p>
                    </div>
                </div>
            </div>

            {/* Filtres compacts */}
            <div className="flex flex-col md:flex-row md:items-center gap-2.5" data-tour="succes-filters">
                <div className="relative flex-1" data-tour="succes-search">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            updateParam("q", e.target.value || null);
                        }}
                        placeholder="Rechercher un donjon ou un boss…"
                        className="w-full h-9 pl-9 pr-8 rounded-xl bg-surface/70 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-warning/40"
                    />
                    {search && (
                        <button
                            onClick={() => {
                                setSearch("");
                                updateParam("q", null);
                            }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label="Effacer la recherche"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                    {/* Statut — un seul contrôle segmenté (Tous / À faire / Finis) */}
                    <div className="flex items-center gap-0.5 p-0.5 rounded-xl border border-border bg-surface/70 shrink-0">
                        {(["all", "todo", "done"] as StatusFilter[]).map((s) => (
                            <button
                                key={s}
                                onClick={() => {
                                    setStatus(s);
                                    updateParam("status", s === "all" ? null : s);
                                }}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors",
                                    status === s
                                        ? "bg-warning/15 text-warning"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {s === "all" ? "Tous" : s === "todo" ? "À faire" : "Finis"}
                            </button>
                        ))}
                    </div>
                    <div className="w-px h-5 bg-border shrink-0" />
                    {/* Filtre « Fiches Anomalies » (gardiens des anomalies temporelles). */}
                    <button
                        type="button"
                        data-tour="succes-filter-anomaly"
                        onClick={() => {
                            const next = !anomalyOnly;
                            setAnomalyOnly(next);
                            updateParam("anomaly", next ? "1" : null);
                        }}
                        title="N'afficher que les boss d'anomalie (gardiens des anomalies temporelles)"
                        className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 h-9 rounded-xl border text-xs font-bold transition-colors shrink-0",
                            anomalyOnly
                                ? "bg-info/15 border-info/40 text-info"
                                : "bg-surface/70 border-border text-muted-foreground hover:text-foreground hover:bg-elevated"
                        )}
                    >
                        <img src="/assets/missions/ano1.png" alt="" aria-hidden className="w-3.5 h-3.5 object-contain" />
                        Boss d&apos;anomalie
                    </button>
                    {/* Niveau — un seul contrôle compact (remplace les 5 puces de tranche) */}
                    <Select
                        value={`${minLevel}-${maxLevel}`}
                        onValueChange={(value) => {
                            const preset = LEVEL_PRESETS.find((p) => `${p.min}-${p.max}` === value);
                            if (!preset) return;
                            setMinLevel(preset.min);
                            setMaxLevel(preset.max);
                        }}
                    >
                        <SelectTrigger
                            aria-label="Filtrer par tranche de niveau"
                            className="h-9 w-[9.5rem] shrink-0 rounded-xl border-border bg-surface/70 text-xs font-bold text-foreground"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-surface border-border">
                            {LEVEL_PRESETS.map((p) => (
                                <SelectItem key={p.label} value={`${p.min}-${p.max}`} className="text-xs font-bold">
                                    {levelPresetLabel(p.label)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Une seule bascule pour la tranche : valider ↔ décocher, selon l'état réel */}
                    {canEdit && (
                        <button
                            type="button"
                            disabled={bracketLoading}
                            onClick={() => handleToggleLevelBracket(bracketAllDone ? "unvalidate" : "validate")}
                            className={cn(
                                "inline-flex items-center gap-1.5 px-3 h-9 rounded-xl border text-xs font-black transition-all shrink-0 disabled:opacity-50",
                                bracketAllDone
                                    ? "bg-surface/70 border-border text-muted-foreground hover:text-danger hover:border-danger/30"
                                    : "bg-success/10 border-success/30 hover:bg-success/20 text-success"
                            )}
                            title={
                                bracketAllDone
                                    ? `Décocher tous les succès ${bracketLabel}`
                                    : `Valider tous les succès ${bracketLabel}`
                            }
                        >
                            {bracketLoading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : bracketAllDone ? (
                                <RotateCcw className="w-3.5 h-3.5" />
                            ) : (
                                <CheckCheck className="w-3.5 h-3.5" />
                            )}
                            <span>{bracketAllDone ? "Décocher la tranche" : "Valider la tranche"}</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="grid lg:grid-cols-[340px_1fr] gap-4 items-start">

                {/* ─── LISTE DES DONJONS ─── */}
                <div data-tour="succes-tracker-list" className={cn("space-y-2 lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1 custom-scrollbar", selectedDungeon && "hidden lg:block")}>
                    {filteredDungeons.length === 0 ? (
                        <div className="py-16 text-center text-muted-foreground">
                            <Trophy className="w-10 h-10 mx-auto mb-3 opacity-20" />
                            <p className="font-medium">Aucun donjon trouvé.</p>
                        </div>
                    ) : (
                        filteredDungeons.map((d) => {
                            const done = d.achievements.filter((a) => completedIds.has(a.id)).length;
                            const pct = d.achievements.length ? Math.round((done / d.achievements.length) * 100) : 0;
                            const complete = d.achievements.length > 0 && done === d.achievements.length;
                            const active = d.id === selectedDungeonId;
                            return (
                                <button
                                    key={d.id}
                                    onClick={() => updateParam("dungeon", d.id)}
                                    className={cn(
                                        "w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-colors min-h-16",
                                        active
                                            ? "bg-elevated/90 border-warning/50"
                                            : "bg-surface/70 border-border hover:bg-elevated/70"
                                    )}
                                >
                                    <div className="relative shrink-0">
                                        <div className="w-11 h-11 rounded-xl bg-background border border-border flex items-center justify-center overflow-hidden">
                                            {d.imageUrl ? (
                                                <img
                                                    src={d.imageUrl}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                    loading="lazy"
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = "none";
                                                    }}
                                                />
                                            ) : null}
                                            <Trophy className="w-5 h-5 text-muted-foreground/30 absolute" />
                                        </div>
                                        {d.isOcreQuest && (
                                            <img
                                                src="/module-dofus/Dofus_Ocre.png"
                                                alt="Quête Ocre"
                                                title="Donjon de la Quête Ocre"
                                                className="absolute -bottom-1 -right-1 w-5 h-5 object-contain rounded-full bg-background border border-warning/30 p-0.5"
                                            />
                                        )}
                                        {d.isAnomalyBoss && (
                                            <img
                                                src="/assets/missions/ano1.png"
                                                alt="Boss Anomalie"
                                                title={d.anomalyFamily ? `Boss d'anomalie — ${d.anomalyFamily}` : "Boss d'anomalie"}
                                                className="absolute -bottom-1 -right-1 w-5 h-5 object-contain rounded-full bg-background border border-info/30 p-0.5"
                                            />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-foreground truncate">{d.name}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            LVL {d.level} · {done}/{d.achievements.length}
                                        </p>
                                        <div className="h-1.5 rounded-full bg-background border border-border mt-1.5 overflow-hidden">
                                            <div
                                                className={cn("h-full transition-all duration-300", complete ? "bg-success" : "bg-warning")}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                    {complete ? (
                                        <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                                    ) : (
                                        <Circle className="w-5 h-5 text-muted-foreground/40 shrink-0" />
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>

                {/* ─── DÉTAIL DU DONJON SÉLECTIONNÉ ─── */}
                <div data-tour="succes-tracker-detail" className={cn(!selectedDungeon && "hidden lg:block")}>
                    {selectedDungeon ? (
                        <div className="bg-surface/70 border border-border rounded-2xl overflow-hidden">
                            <div className="border-b border-border p-5 space-y-4">
                                <button
                                    onClick={() => updateParam("dungeon", null)}
                                    className="lg:hidden inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground min-h-11 px-1"
                                >
                                    <ChevronLeft className="w-4 h-4" /> Retour à la liste
                                </button>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                    <div className="relative shrink-0">
                                        <div className="w-16 h-16 rounded-2xl bg-background border border-border flex items-center justify-center overflow-hidden">
                                            {selectedDungeon.imageUrl ? (
                                                <img
                                                    src={selectedDungeon.imageUrl}
                                                    alt={selectedDungeon.name}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = "none";
                                                    }}
                                                />
                                            ) : null}
                                            <Trophy className="w-7 h-7 text-muted-foreground/30 absolute" />
                                        </div>
                                        {selectedDungeon.isOcreQuest && (
                                            <img
                                                src="/module-dofus/Dofus_Ocre.png"
                                                alt="Quête Ocre"
                                                className="absolute -bottom-1.5 -right-1.5 w-6 h-6 object-contain rounded-full bg-background border border-warning/30 p-0.5"
                                            />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-lg font-black text-foreground leading-tight">{selectedDungeon.name}</h2>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Boss : {selectedDungeon.bossName} · LVL {selectedDungeon.level}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {/* #171 — Liens guides (favicon) dans « Mes Succès », comme dans Succès Commun */}
                                        {(selectedDungeon.dofuspourlesnoobsUrl || selectedDungeon.dpnlUrl) && (
                                            <a
                                                href={selectedDungeon.dofuspourlesnoobsUrl || selectedDungeon.dpnlUrl || "#"}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 px-3.5 py-2.5 min-h-11 rounded-xl border border-border bg-surface text-foreground text-xs font-bold hover:bg-elevated transition-colors"
                                                title="Guide DofusPourLesNoobs (DPNL)"
                                            >
                                                <img
                                                    src="https://www.google.com/s2/favicons?domain=dofuspourlesnoobs.com&sz=32"
                                                    alt=""
                                                    className="w-4 h-4 rounded-sm"
                                                    loading="lazy"
                                                />
                                                Guide DPNL
                                            </a>
                                        )}
                                        <Link
                                            href={`/dashboard/${guildId}/donjons-et-quetes?dungeonId=${selectedDungeon.id}`}
                                            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-11 rounded-xl border border-info/30 bg-info/10 text-info text-xs font-bold uppercase tracking-wide hover:bg-info/20 transition-colors"
                                        >
                                            <Swords className="w-4 h-4" /> Chercher un groupe
                                        </Link>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between gap-3 mb-1.5">
                                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                            Succès — {selectedDungeon.achievements.filter((a) => completedIds.has(a.id)).length}/{selectedDungeon.achievements.length}
                                        </p>
                                        {canEdit && selectedDungeon.achievements.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => toggleAll(!selectedAllDone)}
                                                title={selectedAllDone ? "Décocher les succès de ce donjon" : "Valider les succès de ce donjon"}
                                                className={cn(
                                                    "inline-flex items-center gap-1.5 px-3 py-2 min-h-11 rounded-xl border text-xs font-black uppercase tracking-wide transition-colors shrink-0",
                                                    selectedAllDone
                                                        ? "border-border bg-surface text-muted-foreground hover:text-danger hover:border-danger/30"
                                                        : "border-warning/40 bg-warning/15 text-warning hover:bg-warning/25"
                                                )}
                                            >
                                                {selectedAllDone ? <RotateCcw className="w-3.5 h-3.5" /> : <CheckCheck className="w-3.5 h-3.5" />}
                                                {selectedAllDone ? "Tout décocher" : "Tout cocher"}
                                            </button>
                                        )}
                                    </div>
                                    <div className="h-2 rounded-full bg-background border border-border overflow-hidden">
                                        <div
                                            className="h-full bg-warning transition-all duration-300"
                                            style={{
                                                width: `${selectedDungeon.achievements.length ? (selectedDungeon.achievements.filter((a) => completedIds.has(a.id)).length / selectedDungeon.achievements.length) * 100 : 0}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Checklist */}
                            <div className="p-5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {selectedDungeon.achievements.map((a) => {
                                        const isDone = completedIds.has(a.id);
                                        return (
                                            <button
                                                key={a.id}
                                                onClick={() => toggleOne(a.id)}
                                                disabled={!canEdit}
                                                className={cn(
                                                    "flex items-center gap-3 p-3 rounded-xl border text-left transition-all min-h-12 group",
                                                    isDone
                                                        ? "bg-success/10 border-success/30 shadow-2xs"
                                                        : "bg-surface/60 border-border hover:bg-elevated hover:border-border-strong",
                                                    !canEdit && "cursor-default opacity-80"
                                                )}
                                            >
                                                <div
                                                    className={cn(
                                                        "w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-all",
                                                        isDone ? "bg-success border-success text-white shadow-2xs" : "bg-background border-border group-hover:border-warning/50"
                                                    )}
                                                >
                                                    {isDone && <CheckCircle2 className="w-3.5 h-3.5" />}
                                                </div>

                                                <div className="w-8 h-8 rounded-lg bg-background border border-border/80 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                                                    {a.challenge.iconUrl ? (
                                                        <img
                                                            src={a.challenge.iconUrl}
                                                            alt=""
                                                            className="w-full h-full object-contain"
                                                            loading="lazy"
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = "none";
                                                            }}
                                                        />
                                                    ) : (
                                                        <img src="/assets/dofus/icons/challenges.png" alt="" className="w-4 h-4 object-contain opacity-70" />
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <p className={cn("text-xs font-bold truncate", isDone ? "text-success" : "text-foreground")}>
                                                        {a.challenge.name}
                                                    </p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Hint partenaires — le lien métier avec les posts, sans ouvrir le board ici */}
                                {selectedPartners && selectedPartners.filter((p) => !completedIds.has(p.achievementId) && p.membersWhoHaveIt.length > 0).length > 0 && (
                                    <div data-tour="succes-partners" className="mt-5 border border-warning/20 bg-warning/5 rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Users className="w-4 h-4 text-warning" />
                                            <p className="text-xs font-bold uppercase tracking-widest text-warning">Partenaires potentiels</p>
                                        </div>
                                        <div className="space-y-2">
                                            {selectedPartners
                                                .filter((p) => !completedIds.has(p.achievementId) && p.membersWhoHaveIt.length > 0)
                                                .map((p) => (
                                                    <div key={p.achievementId} className="flex items-center justify-between gap-3">
                                                        <span className="text-sm text-foreground truncate">{p.achievementName}</span>
                                                        <span className="text-xs font-bold text-warning shrink-0">
                                                            {p.membersWhoHaveIt.length} membre{p.membersWhoHaveIt.length > 1 ? "s" : ""} l'ont déjà
                                                        </span>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="hidden lg:flex flex-col items-center justify-center py-24 text-muted-foreground border border-dashed border-border rounded-2xl bg-background/40">
                            <Trophy className="w-12 h-12 mb-4 opacity-20" />
                            <p className="font-medium">Sélectionne un donjon pour voir ses succès.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
