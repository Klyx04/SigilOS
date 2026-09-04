"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
    Compass,
    ExternalLink,
    Flame,
    Loader2,
    MapPin,
    Search,
    Swords,
    User,
    Users,
    CheckCircle2,
    Clock,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    BookOpen,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getWorldName } from "@/lib/dofus-assets";
import { getDungeonsWithAchievements, getMonsterStats } from "@/server/actions/game-data-actions";
import { getLinkedQuests } from "@/server/actions/dofus-quest-actions";
import { getUserDungeonProgress } from "@/server/actions/dungeon-finder-actions";

interface DungeonAchievement {
    id: string;
    points: number;
    challenge: {
        id: string;
        name: string;
        iconUrl?: string | null;
    };
}

interface DungeonItem {
    id: string;
    name: string;
    bossName: string;
    level: number;
    imageUrl?: string | null;
    dofusdbId?: number | null;
    dofuspourlesnoobsUrl?: string | null;
    achievements: DungeonAchievement[];
}

interface QuestMember {
    profileId: string;
    pseudo: string;
    avatarUrl?: string | null;
    dofusClass?: string | null;
    status: "COMPLETED" | "IN_PROGRESS";
}

interface LinkedQuest {
    id: string;
    name: string;
    isDungeon: boolean;
    stepOrder: number;
    zone: string | null;
    chainName: string | null;
    dofusName: string | null;
    dofusSlug?: string | null;
    dofusImageUrl: string | null;
    dofusSuccessName?: string | null;
    level?: number | null;
    npcName?: string | null;
    coords?: { x: number; y: number } | null;
    dofusdbId?: number | null;
    objectives?: string[];
    isRush: boolean;
    myStatus: string;
    guildCompleted: number;
    guildInProgress: number;
    memberCount: number;
    members?: QuestMember[];
}

interface LinkedQuestsData {
    quests: LinkedQuest[];
    rushActive: { pseudoDofus: string; dofusClass: string | null; milestoneId: string | null }[];
}

export function SuccesQuestsTab({ guildId }: { guildId: string }) {
    const searchParams = useSearchParams();
    const paramDungeonId = searchParams.get("dungeon");

    const [dungeons, setDungeons] = useState<DungeonItem[]>([]);
    const [completedAchievementIds, setCompletedAchievementIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedFilter, setSelectedFilter] = useState<"all" | "rush" | "in_progress" | "completed">("all");
    const [expandedDungeonId, setExpandedDungeonId] = useState<string | null>(null);
    const [selectedQuestMembersId, setSelectedQuestMembersId] = useState<string | null>(null);

    // Données de quêtes et coordonnées par donjon (mises en cache)
    const [questsByDungeon, setQuestsByDungeon] = useState<Record<string, LinkedQuestsData>>({});
    const [loadingQuests, setLoadingQuests] = useState<Record<string, boolean>>({});
    const [coordsByDungeon, setCoordsByDungeon] = useState<Record<string, { x: number; y: number; worldMapId?: number } | null>>({});

    // 1. Charger le catalogue des donjons + progrès personnel
    useEffect(() => {
        let cancelled = false;
        Promise.all([
            getDungeonsWithAchievements(),
            getUserDungeonProgress(guildId),
        ])
            .then(([dungeonsRes, progressRes]) => {
                if (cancelled) return;
                if (progressRes.success && progressRes.data) {
                    setCompletedAchievementIds(new Set(progressRes.data.map((p: any) => p.achievementId)));
                }
                if (dungeonsRes.success && Array.isArray(dungeonsRes.data)) {
                    const mapped: DungeonItem[] = (dungeonsRes.data as any[])
                        .filter((d) => d && (d.bossName || d.name))
                        .map((d) => ({
                            id: d.id,
                            name: d.name,
                            bossName: d.bossName || d.name,
                            level: d.level ?? 0,
                            imageUrl: d.imageUrl ?? null,
                            dofusdbId: d.dofusdbId ?? null,
                            dofuspourlesnoobsUrl: d.dofuspourlesnoobsUrl ?? null,
                            achievements: (d.achievements || []).map((a: any) => ({
                                id: a.id,
                                points: a.points ?? 0,
                                challenge: {
                                    id: a.challenge?.id || a.id,
                                    name: a.challenge?.name || "Succès",
                                    iconUrl: a.challenge?.iconUrl || null,
                                },
                            })),
                        }));
                    setDungeons(mapped);

                    // Sélectionner le donjon passé en URL si présent, sinon le premier
                    if (mapped.length > 0) {
                        const targetId = paramDungeonId && mapped.some((x) => x.id === paramDungeonId)
                            ? paramDungeonId
                            : mapped[0].id;
                        setExpandedDungeonId(targetId);
                    }
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [guildId, paramDungeonId]);

    // 2. Charger les quêtes et coordonnées à l'expansion d'un donjon
    const fetchDungeonQuests = (d: DungeonItem) => {
        if (!questsByDungeon[d.id] && !loadingQuests[d.id]) {
            setLoadingQuests((prev) => ({ ...prev, [d.id]: true }));

            Promise.all([
                getLinkedQuests(guildId, d.name, d.bossName, d.dofusdbId ?? null),
                getMonsterStats(d.bossName, d.name),
            ])
                .then(([qRes, statsRes]) => {
                    if (qRes.success && qRes.data) {
                        setQuestsByDungeon((prev) => ({ ...prev, [d.id]: qRes.data as LinkedQuestsData }));
                    }
                    if (statsRes.success && statsRes.data?.coordinates) {
                        setCoordsByDungeon((prev) => ({ ...prev, [d.id]: statsRes.data.coordinates }));
                    }
                })
                .catch(() => {})
                .finally(() => {
                    setLoadingQuests((prev) => ({ ...prev, [d.id]: false }));
                });
        }
    };

    useEffect(() => {
        if (expandedDungeonId) {
            const d = dungeons.find((item) => item.id === expandedDungeonId);
            if (d) fetchDungeonQuests(d);
        }
    }, [expandedDungeonId, dungeons]);

    // Filtrage et recherche par nom de quête, donjon, boss ou membre
    const filteredDungeons = useMemo(() => {
        const q = search.trim().toLowerCase();
        return dungeons.filter((d) => {
            const matchName = d.name.toLowerCase().includes(q) || d.bossName.toLowerCase().includes(q);
            const questData = questsByDungeon[d.id];

            let matchQuest = false;
            let matchMember = false;

            if (questData) {
                matchQuest = questData.quests.some((quest) =>
                    quest.name.toLowerCase().includes(q) ||
                    (quest.chainName && quest.chainName.toLowerCase().includes(q)) ||
                    (quest.dofusName && quest.dofusName.toLowerCase().includes(q)) ||
                    (quest.zone && quest.zone.toLowerCase().includes(q))
                );
                matchMember =
                    questData.rushActive.some((m) =>
                        m.pseudoDofus.toLowerCase().includes(q) ||
                        (m.dofusClass && m.dofusClass.toLowerCase().includes(q))
                    ) ||
                    questData.quests.some((quest) =>
                        (quest.members ?? []).some((m) =>
                            m.pseudo.toLowerCase().includes(q) ||
                            (m.dofusClass && m.dofusClass.toLowerCase().includes(q))
                        )
                    );
            }

            const passesSearch = !q || matchName || matchQuest || matchMember;
            if (!passesSearch) return false;

            if (selectedFilter === "rush") {
                return questData?.rushActive && questData.rushActive.length > 0;
            }
            if (selectedFilter === "in_progress") {
                return questData?.quests.some((quest) => quest.myStatus === "IN_PROGRESS");
            }
            if (selectedFilter === "completed") {
                return questData?.quests.some((quest) => quest.myStatus === "COMPLETED");
            }

            return true;
        });
    }, [dungeons, search, selectedFilter, questsByDungeon]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-warning" />
                <p className="font-medium">Chargement des quêtes et succès de donjons…</p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Header & Barre de recherche épurés */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-surface/80 border border-border p-4 rounded-2xl shadow-xs">
                <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                        <img src="/assets/dofus/icons/quests.png" alt="" className="w-4 h-4 object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                        <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
                            Quêtes & Succès de Donjons
                        </h2>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Découvre les quêtes de Dofus et les succès spécifiques à chaque donjon pour optimiser tes runs.
                    </p>
                </div>

                {/* Barre de Recherche */}
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Quête, Dofus, donjon, membre…"
                        className="w-full pl-9 pr-3.5 h-9 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-warning/40 font-medium"
                    />
                </div>
            </div>

            {/* Filtres rapides */}
            <div className="flex flex-wrap items-center gap-2">
                {[
                    { id: "all" as const, label: "Tous les donjons", count: dungeons.length },
                    { id: "rush" as const, label: "Rush en cours", icon: Flame },
                    { id: "in_progress" as const, label: "Mes quêtes en cours", icon: Clock },
                    { id: "completed" as const, label: "Quêtes terminées", icon: CheckCircle2 },
                ].map((tab) => {
                    const Icon = (tab as any).icon;
                    const isActive = selectedFilter === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setSelectedFilter(tab.id)}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-2xs",
                                isActive
                                    ? "bg-warning/15 border-warning/40 text-warning"
                                    : "bg-surface/70 border-border text-muted-foreground hover:text-foreground hover:bg-elevated"
                            )}
                        >
                            {Icon && <Icon className={cn("w-3.5 h-3.5", isActive ? "text-warning" : "text-muted-foreground")} />}
                            <span>{tab.label}</span>
                            {tab.count !== undefined && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-background border border-border text-muted-foreground font-black">
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Liste des Donjons avec Succès et Quêtes associées */}
            {filteredDungeons.length === 0 ? (
                <div className="text-center py-16 bg-surface border border-border rounded-2xl p-6">
                    <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-bold text-foreground">Aucun donjon ou quête ne correspond à ta recherche.</p>
                    <p className="text-xs text-muted-foreground mt-1">Essaie avec un autre mot-clé ou réinitialise les filtres.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredDungeons.map((d) => {
                        const isExpanded = expandedDungeonId === d.id;
                        const questData = questsByDungeon[d.id];
                        const isLoadingThis = loadingQuests[d.id];
                        const coords = coordsByDungeon[d.id];
                        const doneAchievementsCount = d.achievements.filter((a) => completedAchievementIds.has(a.id)).length;

                        return (
                            <div
                                key={d.id}
                                className={cn(
                                    "rounded-2xl border transition-all overflow-hidden bg-surface/80 shadow-xs",
                                    isExpanded ? "border-warning/40 bg-surface/95 ring-1 ring-warning/20" : "border-border hover:border-border-strong"
                                )}
                            >
                                {/* Header Donjon accordéon */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setExpandedDungeonId(isExpanded ? null : d.id);
                                        if (!isExpanded) fetchDungeonQuests(d);
                                    }}
                                    className="w-full flex items-center justify-between p-3.5 text-left transition-colors hover:bg-elevated/40"
                                >
                                    <div className="flex items-center gap-3.5 min-w-0">
                                        <div className="w-11 h-11 rounded-xl bg-background border border-border flex items-center justify-center p-1 shrink-0 overflow-hidden relative">
                                            {d.imageUrl ? (
                                                <img
                                                    src={d.imageUrl}
                                                    alt={d.bossName}
                                                    className="w-full h-full object-contain"
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = "none";
                                                    }}
                                                />
                                            ) : null}
                                            <Swords className="w-5 h-5 text-muted-foreground/40 absolute" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-black text-foreground truncate">{d.name}</h3>
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-warning/10 border border-warning/20 text-warning">
                                                    Niv. {d.level}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5 truncate flex items-center gap-2">
                                                <span>Boss : <strong className="text-foreground">{d.bossName}</strong></span>
                                                {coords && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-accent">
                                                        <MapPin className="w-3 h-3" /> [{coords.x}, {coords.y}]
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2.5 shrink-0">
                                        {/* Badge Succès */}
                                        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background border border-border text-[11px] font-bold text-foreground">
                                            <img src="/assets/dofus/icons/success.png" alt="" className="w-3.5 h-3.5 object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                                            <span>{doneAchievementsCount}/{d.achievements.length} succès</span>
                                        </span>

                                        {/* Badge Quêtes */}
                                        {questData?.quests && questData.quests.length > 0 && (
                                            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background border border-border text-[11px] font-bold text-foreground">
                                                <img src="/assets/dofus/icons/quests.png" alt="" className="w-3.5 h-3.5 object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                                                <span>{questData.quests.length} quête{questData.quests.length > 1 ? "s" : ""}</span>
                                            </span>
                                        )}

                                        {questData?.rushActive && questData.rushActive.length > 0 && (
                                            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[11px] font-black text-amber-300">
                                                <Flame className="w-3.5 h-3.5 text-amber-400" />
                                                {questData.rushActive.length} en rush
                                            </span>
                                        )}
                                        {isExpanded ? (
                                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                        ) : (
                                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                        )}
                                    </div>
                                </button>

                                {/* Contenu détaillé du donjon déplié */}
                                {isExpanded && (
                                    <div className="p-4 sm:p-5 border-t border-border/80 bg-background/40 space-y-6">
                                        {/* Barre de navigation Coordonnées / Sous-monde & Guides */}
                                        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-surface border border-border">
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <Compass className="w-4 h-4 text-accent shrink-0" />
                                                <span>
                                                    Zone & Localisation :{" "}
                                                    {coords ? (() => {
                                                        const worldName = getWorldName(coords.worldMapId);
                                                        const travelCmd = `/travel ${coords.x} ${coords.y}`;
                                                        return (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(travelCmd);
                                                                    toast.success(`Commande ${travelCmd} copiée !`);
                                                                }}
                                                                className="inline-flex items-center gap-1.5 font-bold text-foreground hover:text-warning transition-colors ml-1"
                                                                title="Cliquer pour copier la commande /travel"
                                                            >
                                                                <span className="text-warning font-black">[{coords.x}, {coords.y}]</span>
                                                                <span className="text-muted-foreground font-normal">· {worldName}</span>
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground font-mono">
                                                                    {travelCmd}
                                                                </span>
                                                            </button>
                                                        );
                                                    })() : (
                                                        <span className="italic">Coordonnées cartographiques en cours de synchronisation</span>
                                                    )}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/dashboard/${guildId}/donjons-et-quetes?dungeonId=${d.id}`}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-bold text-foreground hover:bg-elevated transition-colors shadow-2xs"
                                                >
                                                    <Swords className="w-3.5 h-3.5 text-warning" />
                                                    Chercher un groupe
                                                </Link>
                                                {d.dofuspourlesnoobsUrl && (
                                                    <a
                                                        href={d.dofuspourlesnoobsUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-bold text-foreground hover:bg-elevated transition-colors shadow-2xs"
                                                    >
                                                        <img src="https://www.google.com/s2/favicons?domain=dofuspourlesnoobs.com&sz=32" alt="" className="w-3.5 h-3.5 rounded-sm" />
                                                        Guide DPLN
                                                        <ExternalLink className="w-3 h-3 text-muted-foreground" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>

                                        {/* Rush Sylvestre actif sur ce donjon */}
                                        {questData?.rushActive && questData.rushActive.length > 0 && (
                                            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                                                        <Flame className="w-3.5 h-3.5" /> Membres de la guilde en Rush Sylvestre ({questData.rushActive.length})
                                                    </p>
                                                    <Link
                                                        href={`/dashboard/${guildId}/quetes-dofus?guide=rush-sylvestre`}
                                                        className="text-[11px] font-bold text-amber-400 hover:underline flex items-center gap-1"
                                                    >
                                                        Ouvrir le Rush Sylvestre →
                                                    </Link>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {questData.rushActive.map((m, i) => (
                                                        <span
                                                            key={i}
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background/80 border border-amber-500/30 text-xs font-bold text-amber-200"
                                                        >
                                                            <User className="w-3 h-3 text-amber-400" />
                                                            {m.pseudoDofus}
                                                            {m.dofusClass && <span className="text-[10px] text-amber-400/80 font-normal">({m.dofusClass})</span>}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* ─── 1. SUCCÈS DU DONJON ─── */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                    <img src="/assets/dofus/icons/success.png" alt="" className="w-4 h-4 object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                                                    <span>Succès du Donjon ({doneAchievementsCount}/{d.achievements.length})</span>
                                                </h4>
                                                <Link
                                                    href={`/dashboard/${guildId}/succes?dungeon=${d.id}`}
                                                    className="text-[11px] font-bold text-warning hover:underline flex items-center gap-1"
                                                >
                                                    Gérer dans Mes Succès →
                                                </Link>
                                            </div>

                                            {d.achievements.length > 0 ? (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                                                    {d.achievements.map((a) => {
                                                        const isDone = completedAchievementIds.has(a.id);
                                                        return (
                                                            <div
                                                                key={a.id}
                                                                className={cn(
                                                                    "flex items-center gap-2.5 p-3 rounded-xl border transition-all",
                                                                    isDone
                                                                        ? "bg-success/10 border-success/30 shadow-2xs"
                                                                        : "bg-surface border-border"
                                                                )}
                                                            >
                                                                <div className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center p-1 shrink-0 overflow-hidden">
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
                                                                    {a.points > 0 && (
                                                                        <span className="text-[10px] font-extrabold text-amber-400">+{a.points} pts</span>
                                                                    )}
                                                                </div>
                                                                {isDone ? (
                                                                    <span className="text-[10px] font-bold text-success px-1.5 py-0.5 rounded bg-success/10 border border-success/20 shrink-0">
                                                                        ✔ Validé
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[10px] font-semibold text-muted-foreground shrink-0">
                                                                        À faire
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-muted-foreground italic bg-surface/40 p-3 rounded-xl border border-border">
                                                    Aucun succès répertorié pour ce donjon.
                                                </p>
                                            )}
                                        </div>

                                        {/* ─── 2. QUÊTES ASSOCIÉES & LEURS SUCCÈS ─── */}
                                        <div className="space-y-4">
                                            <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                <img src="/assets/dofus/icons/quests.png" alt="" className="w-4 h-4 object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                                                <span>Quêtes de Dofus & Succès associés ({questData?.quests?.length ?? 0})</span>
                                            </h4>

                                            {isLoadingThis ? (
                                                <div className="flex items-center justify-center p-6 text-muted-foreground gap-2">
                                                    <Loader2 className="w-4 h-4 animate-spin text-warning" />
                                                    <span className="text-xs font-bold">Chargement des quêtes liées…</span>
                                                </div>
                                            ) : questData && questData.quests.length > 0 ? (
                                                (() => {
                                                    // Regroupement par Succès de quêtes associé (chainName)
                                                    const groupMap = new Map<string, {
                                                        chainName: string;
                                                        dofusName: string | null;
                                                        dofusSlug: string | null;
                                                        dofusImageUrl: string | null;
                                                        dofusSuccessName: string | null;
                                                        quests: LinkedQuest[];
                                                    }>();

                                                    for (const q of questData.quests) {
                                                        const key = q.chainName || "Quêtes annexes liées";
                                                        if (!groupMap.has(key)) {
                                                            groupMap.set(key, {
                                                                chainName: key,
                                                                dofusName: q.dofusName || null,
                                                                dofusSlug: q.dofusSlug || null,
                                                                dofusImageUrl: q.dofusImageUrl || null,
                                                                dofusSuccessName: q.dofusSuccessName || null,
                                                                quests: [],
                                                            });
                                                        }
                                                        const g = groupMap.get(key)!;
                                                        g.quests.push(q);
                                                        if (!g.dofusName && q.dofusName) g.dofusName = q.dofusName;
                                                        if (!g.dofusSlug && q.dofusSlug) g.dofusSlug = q.dofusSlug;
                                                        if (!g.dofusImageUrl && q.dofusImageUrl) g.dofusImageUrl = q.dofusImageUrl;
                                                        if (!g.dofusSuccessName && q.dofusSuccessName) g.dofusSuccessName = q.dofusSuccessName;
                                                    }

                                                    const groups = Array.from(groupMap.values());

                                                    return (
                                                        <div className="space-y-4">
                                                            {groups.map((group) => (
                                                                <div
                                                                    key={group.chainName}
                                                                    className="rounded-2xl border border-amber-500/25 bg-surface/70 overflow-hidden shadow-xs"
                                                                >
                                                                    {/* En-tête prestigieux du Succès Associé */}
                                                                    <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent p-3.5 border-b border-amber-500/20 flex flex-wrap items-center justify-between gap-3">
                                                                        <div className="flex items-center gap-3 min-w-0">
                                                                            <div className="w-10 h-10 rounded-xl bg-background/80 border border-amber-500/30 flex items-center justify-center p-1.5 shadow-xs shrink-0">
                                                                                <img
                                                                                    src="/assets/dofus/icons/success.png"
                                                                                    alt="Succès"
                                                                                    className="w-full h-full object-contain"
                                                                                    onError={(e) => {
                                                                                        e.currentTarget.style.display = "none";
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                            <div className="min-w-0">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                                                                                        Succès associé
                                                                                    </span>
                                                                                    {group.dofusSuccessName && (
                                                                                        <span className="text-[10px] font-semibold text-muted-foreground/80 truncate">
                                                                                            • Série : {group.dofusSuccessName}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <h4 className="text-sm md:text-base font-black text-foreground tracking-tight flex items-center gap-2">
                                                                                    <span className="truncate">{group.chainName}</span>
                                                                                    <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/20 shrink-0">
                                                                                        {group.quests.length} quête{group.quests.length > 1 ? "s" : ""} liée{group.quests.length > 1 ? "s" : ""}
                                                                                    </span>
                                                                                </h4>
                                                                            </div>
                                                                        </div>

                                                                        {/* Badge Dofus rattaché */}
                                                                        {group.dofusName && (
                                                                            <Link
                                                                                href={`/dashboard/${guildId}/quetes-dofus${group.dofusSlug ? `/guide/${group.dofusSlug}` : ""}`}
                                                                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background/80 hover:bg-background border border-border hover:border-accent/40 text-xs font-bold transition-all group shadow-2xs shrink-0"
                                                                                title={`Consulter le guide ${group.dofusName}`}
                                                                            >
                                                                                {group.dofusImageUrl ? (
                                                                                    <img
                                                                                        src={group.dofusImageUrl}
                                                                                        alt=""
                                                                                        className="w-5 h-5 object-contain drop-shadow-xs transition-transform group-hover:scale-110"
                                                                                    />
                                                                                ) : (
                                                                                    <BookOpen className="w-4 h-4 text-accent" />
                                                                                )}
                                                                                <span className="text-muted-foreground">Guide :</span>
                                                                                <span className="text-accent font-black">{group.dofusName}</span>
                                                                                <ExternalLink className="w-3 h-3 text-muted-foreground opacity-60 group-hover:opacity-100" />
                                                                            </Link>
                                                                        )}
                                                                    </div>

                                                                    {/* Grille des quêtes du succès */}
                                                                    <div className="p-3.5 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                                                        {group.quests.map((q) => {
                                                                            const isCompleted = q.myStatus === "COMPLETED";
                                                                            const isInProgress = q.myStatus === "IN_PROGRESS";

                                                                            const statusBadge = isCompleted
                                                                                ? "bg-success/15 text-success border-success/30"
                                                                                : isInProgress
                                                                                ? "bg-warning/15 text-warning border-warning/30"
                                                                                : "bg-muted/15 text-muted-foreground border-border";

                                                                            const statusLabel = isCompleted ? "Validée" : isInProgress ? "En cours" : "À faire";
                                                                            const isShowingMembers = selectedQuestMembersId === q.id;

                                                                            return (
                                                                                <div
                                                                                    key={q.id}
                                                                                    className="p-4 rounded-xl bg-background/70 border border-border/80 flex flex-col justify-between gap-3 shadow-2xs hover:border-border transition-all"
                                                                                >
                                                                                    <div className="space-y-2.5">
                                                                                        {/* En-tête Quête : Icone + Nom agrandi + Statut */}
                                                                                        <div className="flex items-start justify-between gap-3">
                                                                                            <div className="flex items-start gap-2.5 min-w-0">
                                                                                                <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center p-1.5 shrink-0 shadow-inner">
                                                                                                    <img
                                                                                                        src="/assets/dofus/icons/btnIcon_quest.png"
                                                                                                        alt=""
                                                                                                        className="w-full h-full object-contain"
                                                                                                        onError={(e) => {
                                                                                                            e.currentTarget.src = "/assets/dofus/icons/quests.png";
                                                                                                        }}
                                                                                                    />
                                                                                                </div>
                                                                                                <div className="space-y-0.5 min-w-0">
                                                                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                                                                        <h5 className="text-sm md:text-base font-black text-foreground leading-snug tracking-tight">
                                                                                                            {q.name}
                                                                                                        </h5>
                                                                                                        {q.level && (
                                                                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface border border-border text-muted-foreground shrink-0">
                                                                                                                Niv. {q.level}
                                                                                                            </span>
                                                                                                        )}
                                                                                                    </div>
                                                                                                    {q.isRush && (
                                                                                                        <Link
                                                                                                            href={`/dashboard/${guildId}/quetes-dofus?guide=rush-sylvestre`}
                                                                                                            className="bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/20 text-[10px] font-bold inline-flex items-center gap-1 transition-colors mt-0.5"
                                                                                                        >
                                                                                                            <Flame className="w-2.5 h-2.5" />
                                                                                                            Rush Sylvestre
                                                                                                        </Link>
                                                                                                    )}
                                                                                                </div>
                                                                                            </div>

                                                                                            <span className={cn("px-2.5 py-1 rounded-md border text-[11px] font-black shrink-0 inline-flex items-center gap-1 shadow-2xs", statusBadge)}>
                                                                                                {isCompleted ? <CheckCircle2 className="w-3 h-3 text-success" /> : isInProgress ? <Clock className="w-3 h-3 text-warning" /> : null}
                                                                                                <span>{statusLabel}</span>
                                                                                            </span>
                                                                                        </div>

                                                                                        {/* Localisation, PNJ et Étape Donjon */}
                                                                                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                                                            {q.isDungeon && (
                                                                                                <span className="bg-info/10 text-info px-2 py-0.5 rounded border border-info/20 text-[11px] font-bold inline-flex items-center gap-1">
                                                                                                    <Swords className="w-3 h-3" /> Étape Donjon
                                                                                                </span>
                                                                                            )}
                                                                                            {q.zone && (
                                                                                                <span className="flex items-center gap-1">
                                                                                                    <MapPin className="w-3 h-3 text-muted-foreground/70" />
                                                                                                    <span>{q.zone}</span>
                                                                                                </span>
                                                                                            )}
                                                                                            {q.npcName && (
                                                                                                <span className="flex items-center gap-1">
                                                                                                    <User className="w-3 h-3 text-muted-foreground/70" />
                                                                                                    <span>PNJ : <strong className="text-foreground/90">{q.npcName}</strong></span>
                                                                                                </span>
                                                                                            )}
                                                                                        </div>

                                                                                        {/* Objectif principal si renseigné */}
                                                                                        {q.objectives && q.objectives.length > 0 && (
                                                                                            <div className="bg-surface/60 border border-border/50 rounded-lg p-2 text-xs text-muted-foreground">
                                                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 block mb-0.5">
                                                                                                    Objectif clé :
                                                                                                </span>
                                                                                                <p className="text-foreground/90 font-medium leading-relaxed">
                                                                                                    {q.objectives[0].replace(/\{monster,\d+\}/g, d.bossName)}
                                                                                                </p>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>

                                                                                    {/* Barre de progression guilde & Accordéon Membres dédupliqués */}
                                                                                    <div className="pt-2 border-t border-border/60 space-y-2">
                                                                                        <div className="flex items-center justify-between text-[11px]">
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => setSelectedQuestMembersId(isShowingMembers ? null : q.id)}
                                                                                                className="text-muted-foreground hover:text-foreground font-bold flex items-center gap-1 transition-colors"
                                                                                            >
                                                                                                <Users className="w-3 h-3 text-accent" />
                                                                                                <span>Progression guilde :</span>
                                                                                                <span className="text-[10px] underline ml-1 text-accent">
                                                                                                    {isShowingMembers ? "Masquer membres" : "Voir qui l'a"}
                                                                                                </span>
                                                                                            </button>
                                                                                            <span className="font-black text-foreground tabular-nums">
                                                                                                {q.guildCompleted} / {q.memberCount} ({Math.round((q.guildCompleted / Math.max(1, q.memberCount)) * 100)}%)
                                                                                            </span>
                                                                                        </div>

                                                                                        {/* Jauge de progression guilde */}
                                                                                        <div className="w-full h-1 bg-surface rounded-full overflow-hidden border border-border/40">
                                                                                            <div
                                                                                                className="h-full bg-accent rounded-full transition-all duration-300"
                                                                                                style={{ width: `${Math.min(100, Math.round((q.guildCompleted / Math.max(1, q.memberCount)) * 100))}%` }}
                                                                                            />
                                                                                        </div>

                                                                                        {/* Liste des membres ayant validé ou en cours (sans doublons) */}
                                                                                        {isShowingMembers && (
                                                                                            <div className="p-2.5 rounded-lg bg-surface border border-border space-y-1.5 text-xs">
                                                                                                {q.members && q.members.length > 0 ? (
                                                                                                    <div className="flex flex-wrap gap-1.5">
                                                                                                        {q.members.map((m) => (
                                                                                                            <span
                                                                                                                key={m.profileId}
                                                                                                                className={cn(
                                                                                                                    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-bold",
                                                                                                                    m.status === "COMPLETED"
                                                                                                                        ? "bg-success/10 border-success/30 text-success"
                                                                                                                        : "bg-warning/10 border-warning/30 text-warning"
                                                                                                                )}
                                                                                                            >
                                                                                                                <span>{m.status === "COMPLETED" ? "✔" : "⏳"}</span>
                                                                                                                <span>{m.pseudo}</span>
                                                                                                                {m.dofusClass && (
                                                                                                                    <span className="text-[9px] opacity-70 font-normal">({m.dofusClass})</span>
                                                                                                                )}
                                                                                                            </span>
                                                                                                        ))}
                                                                                                    </div>
                                                                                                ) : (
                                                                                                    <p className="text-[11px] text-muted-foreground italic">
                                                                                                        Aucun membre n'a encore validé ou débuté cette quête.
                                                                                                    </p>
                                                                                                )}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                })()
                                            ) : (
                                                <p className="text-xs text-muted-foreground italic py-2">
                                                    Aucune quête Dofus ou étape de rush n'est actuellement liée à ce donjon.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
