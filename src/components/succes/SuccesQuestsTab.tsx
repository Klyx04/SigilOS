"use client";

import { useEffect, useMemo, useState } from "react";
import {
    Compass,
    ExternalLink,
    Filter,
    Flame,
    Loader2,
    MapPin,
    ScrollText,
    Search,
    Shield,
    Swords,
    User,
    Users,
    CheckCircle2,
    Clock,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    Sparkles,
    BookOpen,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getWorldName } from "@/lib/dofus-assets";
import { getDungeonsWithAchievements, getMonsterStats } from "@/server/actions/game-data-actions";
import { getLinkedQuests } from "@/server/actions/dofus-quest-actions";

interface DungeonItem {
    id: string;
    name: string;
    bossName: string;
    level: number;
    imageUrl?: string | null;
    dofusdbId?: number | null;
    dofuspourlesnoobsUrl?: string | null;
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
    dofusImageUrl: string | null;
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
    const [dungeons, setDungeons] = useState<DungeonItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedFilter, setSelectedFilter] = useState<"all" | "rush" | "in_progress" | "completed">("all");
    const [expandedDungeonId, setExpandedDungeonId] = useState<string | null>(null);
    const [selectedQuestMembersId, setSelectedQuestMembersId] = useState<string | null>(null);

    // Données de quêtes et coordonnées par donjon (mises en cache)
    const [questsByDungeon, setQuestsByDungeon] = useState<Record<string, LinkedQuestsData>>({});
    const [loadingQuests, setLoadingQuests] = useState<Record<string, boolean>>({});
    const [coordsByDungeon, setCoordsByDungeon] = useState<Record<string, { x: number; y: number; worldMapId?: number } | null>>({});

    // 1. Charger le catalogue des donjons
    useEffect(() => {
        let cancelled = false;
        getDungeonsWithAchievements()
            .then((res) => {
                if (cancelled) return;
                if (res.success && Array.isArray(res.data)) {
                    const mapped = (res.data as any[])
                        .filter((d) => d && (d.bossName || d.name))
                        .map((d) => ({
                            id: d.id,
                            name: d.name,
                            bossName: d.bossName || d.name,
                            level: d.level ?? 0,
                            imageUrl: d.imageUrl ?? null,
                            dofusdbId: d.dofusdbId ?? null,
                            dofuspourlesnoobsUrl: d.dofuspourlesnoobsUrl ?? null,
                        }));
                    setDungeons(mapped);
                    if (mapped.length > 0) {
                        setExpandedDungeonId(mapped[0].id);
                    }
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

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
                <ScrollText className="w-8 h-8 animate-spin mb-4 text-warning" />
                <p className="font-medium">Chargement des quêtes et succès de donjons…</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header & Barre de recherche */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-surface border border-border p-4 sm:p-5 rounded-2xl shadow-xs">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <ScrollText className="w-5 h-5 text-warning" />
                        <h2 className="text-base font-black uppercase tracking-wider text-foreground">
                            Quêtes & Succès de Donjons
                        </h2>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Identifie pour chaque donjon les quêtes de Dofus associées, les membres qui en ont besoin et les participants en Rush.
                    </p>
                </div>

                {/* Barre de Recherche (Quête, Guide/Dofus, Donjon, Zone, Membre) */}
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Quête, Dofus, donjon, pseudo membre…"
                        className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-warning/40 transition-all font-medium"
                    />
                </div>
            </div>

            {/* Chips de filtres rapides */}
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
                                "flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-2xs",
                                isActive
                                    ? "bg-warning/15 border-warning/40 text-warning ring-1 ring-warning/30"
                                    : "bg-surface border-border text-muted-foreground hover:text-foreground hover:bg-elevated"
                            )}
                        >
                            {Icon && <Icon className={cn("w-3.5 h-3.5", isActive ? "text-warning" : "text-muted-foreground")} />}
                            <span>{tab.label}</span>
                            {tab.count !== undefined && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-background border border-border text-muted-foreground font-black">
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Liste des Donjons & Quêtes associées */}
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

                        return (
                            <div
                                key={d.id}
                                className={cn(
                                    "rounded-2xl border transition-all overflow-hidden bg-surface shadow-xs",
                                    isExpanded ? "border-warning/40 ring-1 ring-warning/20 bg-surface/95" : "border-border hover:border-border-strong"
                                )}
                            >
                                {/* Header Donjon accordéon */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setExpandedDungeonId(isExpanded ? null : d.id);
                                        if (!isExpanded) fetchDungeonQuests(d);
                                    }}
                                    className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-elevated/40"
                                >
                                    <div className="flex items-center gap-3.5 min-w-0">
                                        <div className="w-11 h-11 rounded-xl bg-background border border-border flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-inner">
                                            {d.imageUrl ? (
                                                <img src={d.imageUrl} alt={d.bossName} className="w-full h-full object-contain" />
                                            ) : (
                                                <Swords className="w-5 h-5 text-muted-foreground/60" />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-black text-foreground truncate">{d.name}</h3>
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-warning/10 border border-warning/20 text-warning">
                                                    Niv. {d.level}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5 truncate flex items-center gap-1.5">
                                                <span>Boss : <strong className="text-foreground">{d.bossName}</strong></span>
                                                {coords && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-accent">
                                                        <MapPin className="w-3 h-3" /> [{coords.x}, {coords.y}]
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
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
                                    <div className="p-4 sm:p-5 border-t border-border/80 bg-background/50 space-y-5">
                                        {/* Prévisualisation Coordonnées / Sous-monde & Guides */}
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
                                                    href={`/dashboard/${guildId}/donjons-et-quetes?dungeon=${d.id}`}
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

                                        {/* Liste des Quêtes du Donjon */}
                                        <div>
                                            <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                                                <ScrollText className="w-3.5 h-3.5 text-warning" /> Quêtes & Étapes associées
                                            </h4>

                                            {isLoadingThis ? (
                                                <div className="flex items-center justify-center p-6 text-muted-foreground gap-2">
                                                    <Loader2 className="w-4 h-4 animate-spin text-warning" />
                                                    <span className="text-xs font-bold">Chargement des quêtes liées…</span>
                                                </div>
                                            ) : questData && questData.quests.length > 0 ? (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                                                    {questData.quests.map((q) => {
                                                        const isCompleted = q.myStatus === "COMPLETED";
                                                        const isInProgress = q.myStatus === "IN_PROGRESS";

                                                        const statusBadge = isCompleted
                                                            ? "bg-success/15 text-success border-success/30"
                                                            : isInProgress
                                                            ? "bg-warning/15 text-warning border-warning/30"
                                                            : "bg-muted/15 text-muted-foreground border-border";

                                                        const statusLabel = isCompleted ? "Terminé" : isInProgress ? "En cours" : "Non débuté";
                                                        const isShowingMembers = selectedQuestMembersId === q.id;

                                                        return (
                                                            <div
                                                                key={q.id}
                                                                className="p-3.5 rounded-xl bg-surface border border-border flex flex-col justify-start gap-2.5 shadow-2xs transition-all"
                                                            >
                                                                <div className="space-y-2">
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <div className="space-y-1">
                                                                            <h5 className="text-xs font-black text-foreground leading-snug">{q.name}</h5>
                                                                            {/* Guide ou Dofus SigilOS de rattachement avec lien direct et icône */}
                                                                            {q.dofusName && (
                                                                                <Link
                                                                                    href={`/dashboard/${guildId}/quetes-dofus`}
                                                                                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-accent hover:underline group"
                                                                                    title={`Ouvrir le guide ${q.dofusName} dans Quêtes Dofus`}
                                                                                >
                                                                                    {q.dofusImageUrl ? (
                                                                                        <img
                                                                                            src={q.dofusImageUrl}
                                                                                            alt={q.dofusName}
                                                                                            className="w-4 h-4 object-contain rounded-xs shrink-0 drop-shadow-xs transition-transform group-hover:scale-110"
                                                                                            loading="lazy"
                                                                                        />
                                                                                    ) : (
                                                                                        <BookOpen className="w-3 h-3 text-accent shrink-0" />
                                                                                    )}
                                                                                    <span>Guide : <strong>{q.dofusName}</strong></span>
                                                                                </Link>
                                                                            )}
                                                                        </div>
                                                                        <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black shrink-0 ${statusBadge}`}>
                                                                            {statusLabel}
                                                                        </span>
                                                                    </div>

                                                                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground font-semibold">
                                                                        {q.chainName && (
                                                                            <span className="bg-background px-1.5 py-0.5 rounded border border-border">
                                                                                {q.chainName}
                                                                            </span>
                                                                        )}
                                                                        {q.isRush && (
                                                                            <Link
                                                                                href={`/dashboard/${guildId}/quetes-dofus?guide=rush-sylvestre`}
                                                                                className="bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold inline-flex items-center gap-1 transition-colors"
                                                                            >
                                                                                <Flame className="w-2.5 h-2.5" />
                                                                                Rush Sylvestre
                                                                            </Link>
                                                                        )}
                                                                        {q.isDungeon && (
                                                                            <span className="bg-info/10 text-info px-1.5 py-0.5 rounded border border-info/20 font-bold">
                                                                                Donjon
                                                                            </span>
                                                                        )}
                                                                        {q.zone && (
                                                                            <span className="text-muted-foreground/80 flex items-center gap-0.5">
                                                                                <MapPin className="w-2.5 h-2.5" /> {q.zone}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Barre de progression guilde & Accordéon Membres */}
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

                                                                    {/* Liste des membres ayant validé ou en cours */}
                                                                    {isShowingMembers && (
                                                                        <div className="p-2.5 rounded-lg bg-background/80 border border-border space-y-1.5 text-xs">
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
                                                                                    Aucun membre n'a encore enregistré cette quête.
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
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
