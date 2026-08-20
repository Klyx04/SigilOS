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
} from "lucide-react";
import {
    toggleAchievementCompleted,
    toggleDungeonAchievements,
    getUserDungeonProgress,
    findMissingAchievements,
} from "@/server/actions/dungeon-finder-actions";
import { getDungeonsWithAchievements } from "@/server/actions/game-data-actions";
import { toast } from "sonner";
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
    const [partners, setPartners] = useState<Record<string, Partner[]>>({});
    const [loadingPartners, setLoadingPartners] = useState(false);
    const toastFired = useRef(false);
    const autoSelectedRef = useRef(false);

    const selectedDungeonId = searchParams.get("dungeon");

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
                    (dungeonsRes.data as Dungeon[])
                        .filter((d) => d.achievements.length > 0)
                        .sort((a, b) => a.level - b.level)
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

    const doneCount = useMemo(
        () => dungeons.reduce((acc, d) => acc + d.achievements.filter((a) => completedIds.has(a.id)).length, 0),
        [dungeons, completedIds]
    );
    const totalCount = useMemo(() => dungeons.reduce((acc, d) => acc + d.achievements.length, 0), [dungeons]);
    const totalPoints = useMemo(
        () =>
            dungeons.reduce(
                (acc, d) =>
                    acc +
                    d.achievements.filter((a) => completedIds.has(a.id)).reduce((p, a) => p + (a.points || 0), 0),
                0
            ),
        [dungeons, completedIds]
    );
    const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    const filteredDungeons = useMemo(() => {
        const term = search.toLowerCase();
        return dungeons.filter((d) => {
            const matchSearch = d.name.toLowerCase().includes(term) || d.bossName.toLowerCase().includes(term);
            const matchLevel = d.level >= minLevel && d.level <= maxLevel;
            if (!matchSearch || !matchLevel) return false;
            const done = d.achievements.filter((a) => completedIds.has(a.id)).length;
            if (status === "done") return done === d.achievements.length;
            if (status === "todo") return done < d.achievements.length;
            return true;
        });
    }, [dungeons, search, status, minLevel, maxLevel, completedIds]);

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
            {/* Glance (progressive disclosure) : où j'en suis sans scroll */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="col-span-2 lg:col-span-2 bg-surface border border-border rounded-2xl p-5">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-warning/15 border border-warning/30 text-warning flex items-center justify-center shrink-0">
                                <Trophy className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-foreground">Progression globale</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {doneCount}/{totalCount} succès validés
                                </p>
                            </div>
                        </div>
                        <span className="text-2xl font-black text-warning tabular-nums">{progressPct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-background border border-border overflow-hidden">
                        <div
                            className="h-full bg-warning transition-all duration-300"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                </div>
                <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col justify-center">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Donjons</p>
                    <p className="text-2xl font-black text-foreground tabular-nums mt-1">{dungeons.length}</p>
                </div>
                <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col justify-center">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Points</p>
                    <p className="text-2xl font-black text-warning tabular-nums mt-1">{totalPoints}</p>
                </div>
            </div>

            {/* Filtres */}
            <div className="flex flex-col md:flex-row md:items-center gap-3" data-tour="succes-filters">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            updateParam("q", e.target.value || null);
                        }}
                        placeholder="Rechercher un donjon ou un boss…"
                        className="w-full h-11 pl-9 pr-8 rounded-xl bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-warning/40"
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
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                    {(["all", "todo", "done"] as StatusFilter[]).map((s) => (
                        <button
                            key={s}
                            onClick={() => {
                                setStatus(s);
                                updateParam("status", s === "all" ? null : s);
                            }}
                            className={cn(
                                "px-4 py-2 min-h-11 rounded-xl border text-xs font-bold uppercase tracking-wider transition-colors shrink-0",
                                status === s
                                    ? "bg-warning/15 border-warning/40 text-warning"
                                    : "bg-surface border-border text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {s === "all" ? "Tous" : s === "todo" ? "À faire" : "Finis"}
                        </button>
                    ))}
                    <div className="w-px h-6 bg-border shrink-0" />
                    {LEVEL_PRESETS.map((p) => (
                        <button
                            key={p.label}
                            onClick={() => {
                                setMinLevel(p.min);
                                setMaxLevel(p.max);
                            }}
                            className={cn(
                                "px-3 py-2 min-h-11 rounded-xl border text-xs font-bold uppercase tracking-wider transition-colors shrink-0",
                                minLevel === p.min && maxLevel === p.max
                                    ? "bg-elevated border-border-strong text-foreground"
                                    : "bg-surface border-border text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {p.label}
                        </button>
                    ))}
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
                            const complete = done === d.achievements.length;
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
                                        {d.imageUrl ? (
                                            <img src={d.imageUrl} alt="" className="w-11 h-11 rounded-xl object-cover border border-border bg-background" loading="lazy" />
                                        ) : (
                                            <div className="w-11 h-11 rounded-xl bg-background border border-border flex items-center justify-center">
                                                <Trophy className="w-5 h-5 text-muted-foreground/50" />
                                            </div>
                                        )}
                                        {d.isOcreQuest && (
                                            <img
                                                src="/module-dofus/Dofus_Ocre.png"
                                                alt="Quête Ocre"
                                                title="Donjon de la Quête Ocre"
                                                className="absolute -bottom-1 -right-1 w-5 h-5 object-contain rounded-full bg-background border border-warning/30 p-0.5"
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
                                        {selectedDungeon.imageUrl ? (
                                            <img src={selectedDungeon.imageUrl} alt="" className="w-16 h-16 rounded-2xl object-cover border border-border" />
                                        ) : (
                                            <div className="w-16 h-16 rounded-2xl bg-background border border-border flex items-center justify-center">
                                                <Trophy className="w-7 h-7 text-muted-foreground/50" />
                                            </div>
                                        )}
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
                                        {selectedDungeon.dofensiveUrl && (
                                            <a
                                                href={selectedDungeon.dofensiveUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 px-3.5 py-2.5 min-h-11 rounded-xl border border-border bg-surface text-foreground text-xs font-bold hover:bg-elevated transition-colors"
                                                title="Guide Dofensive"
                                            >
                                                <img
                                                    src="https://www.google.com/s2/favicons?domain=dofensive.com&sz=32"
                                                    alt=""
                                                    className="w-4 h-4 rounded-sm"
                                                    loading="lazy"
                                                />
                                                Dofensive
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
                                        {canEdit && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => toggleAll(false)}
                                                    className="px-3 py-2 min-h-11 rounded-lg border border-border text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                                                >
                                                    Décocher tout
                                                </button>
                                                <button
                                                    onClick={() => toggleAll(true)}
                                                    className="px-3 py-2 min-h-11 rounded-lg bg-warning/15 border border-warning/40 text-warning text-xs font-black uppercase tracking-wide hover:bg-warning/25 transition-colors"
                                                >
                                                    Tout cocher
                                                </button>
                                            </div>
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
                                                    "flex items-center gap-3 p-3 rounded-xl border text-left transition-colors min-h-12",
                                                    isDone
                                                        ? "bg-success/5 border-success/25"
                                                        : "bg-background/50 border-border hover:bg-elevated/70",
                                                    !canEdit && "cursor-default opacity-80"
                                                )}
                                            >
                                                <div
                                                    className={cn(
                                                        "w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition-colors",
                                                        isDone ? "bg-success border-success" : "bg-surface border-border"
                                                    )}
                                                >
                                                    {isDone && <CheckCircle2 className="w-4 h-4 text-foreground" />}
                                                </div>
                                                {a.challenge.iconUrl ? (
                                                    <img src={a.challenge.iconUrl} alt="" className="w-8 h-8 rounded-lg bg-surface border border-border p-1 object-contain shrink-0" loading="lazy" />
                                                ) : (
                                                    <Trophy className="w-5 h-5 text-warning/50 shrink-0" />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-foreground truncate">
                                                        {a.challenge.name}
                                                    </p>
                                                    {a.points > 0 && (
                                                        <p className="text-xs text-warning font-semibold mt-0.5">+{a.points} pts</p>
                                                    )}
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
