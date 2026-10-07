"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Brain, ChevronDown, ChevronUp, Compass, Crown, ExternalLink, Flame, Loader2, MapPin, PictureInPicture2, ScrollText, Search, Shield, Swords, Target, Users, X, Zap, Gem, Check, ArrowRight } from "lucide-react";
import { useBossOverlay } from "@/hooks/use-boss-overlay";
import { getDungeonsWithAchievements, getDungeonMonsters, getMonsterStats } from "@/server/actions/game-data-actions";
import { getLinkedQuests } from "@/server/actions/dofus-quest-actions";
import { SuccesBossQuests, type BossLinkedQuestsData } from "./SuccesBossQuests";
import { SuccesBossEncyclo } from "./SuccesBossEncyclo";
import { mergeDofensiveSpells } from "@/lib/dofensive-spells";
import { deriveDofensiveMonsterName } from "@/lib/dofensive-boss";
import {
    getBossDofensiveSpells,
    getDofensiveDungeonForBoss,
    type DofensiveDungeonInfo,
} from "@/server/actions/dofensive-actions";
import { getAnomalyBossBattleMap, getAnomalyBossFamily } from "@/server/actions/anomaly-boss-actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getWorldName } from "@/lib/dofus-assets";
import { SpellData, SpellRangeGrid } from "./SpellRangeGrid";
import { BossMechanicsView, type BossPassiveData } from "@/components/boss/BossMechanicsView";
import { formatDofusEffectLine } from "@/lib/dofus-effects-formatter";
import { ZoneLocationCard } from "@/components/worldmap/ZoneLocationCard";
import { DungeonMinimapCard } from "@/app/boss/[dungeonId]/_components/DungeonMinimapCard";

/**
 * Image de monstre avec fallback stylisé (icône Swords) si l'illustration DofusDB
 * est absente OU renvoie un 404 (image cassée). Évite les icônes brisées.
 */
function MonsterImage({
    src,
    alt = "",
    className = "",
    monsterId,
    assetId,
    assetType = "monsters",
}: {
    src?: string | null;
    alt?: string;
    className?: string;
    monsterId?: number | string;
    assetId?: number | string;
    assetType?: "monsters" | "items" | "spells";
}) {
    const targetId = monsterId ?? assetId;
    const initialSrc = targetId
        ? `/api/assets-dofus/${assetType}/${targetId}${src ? `?url=${encodeURIComponent(src)}` : ''}`
        : (src || null);
    const [currentSrc, setCurrentSrc] = useState<string | null>(initialSrc);
    const [triedRemote, setTriedRemote] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        const newSrc = targetId
            ? `/api/assets-dofus/${assetType}/${targetId}${src ? `?url=${encodeURIComponent(src)}` : ''}`
            : (src || null);
        setCurrentSrc(newSrc);
        setTriedRemote(false);
        setFailed(false);
    }, [src, targetId, assetType]);

    const handleError = () => {
        if (!triedRemote && src && currentSrc !== src) {
            setTriedRemote(true);
            setCurrentSrc(src);
        } else {
            setFailed(true);
        }
    };

    if (!currentSrc || failed) {
        return (
            <span className={cn("inline-flex items-center justify-center text-muted-foreground/40 bg-background", className)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/dofus/icons/crossedSwords.png" alt="" className="w-1/2 h-1/2 max-w-6 max-h-6 object-contain opacity-50" />
            </span>
        );
    }
    return (
        <img
            src={currentSrc}
            alt={alt}
            className={className}
            loading="lazy"
            onError={handleError}
        />
    );
}

interface BossDungeon {
    id: string;
    /** Slug public (`/boss/<slug>`) — le deep-link `?dungeon=` accepte les deux. */
    slug?: string | null;
    name: string;
    bossName: string;
    level: number;
    imageUrl?: string | null;
    dofensiveUrl?: string | null;
    dpnlUrl?: string | null;
    dofuspourlesnoobsUrl?: string | null;
    dofusdbId?: number | null;
    /* Chantier double boss — dissociation affichage / résolution Dofensive. */
    dofensiveMonsterName?: string | null;
    dofensiveDungeonName?: string | null;
    /* Chantier « boss d'anomalie » — contenu siphonné (Dofensive + DofusDB). */
    isAnomalyBoss?: boolean | null;
    anomalyMapId?: number | null;
    anomalyFamily?: string | null;
    mapId?: number | null;
    achievements?: { id: string; points: number; challenge?: { name: string } }[];
}

interface MonsterStats {
    id?: number;
    name?: string;
    imageUrl?: string;
    coordinates?: { x: number; y: number; worldMapId?: number } | null;
    grades?: {
        level: number;
        lifePoints: number;
        actionPoints: number;
        movementPoints: number;
        resists?: {
            neutral?: number;
            earth?: number;
            fire?: number;
            water?: number;
            air?: number;
        };
    }[];
    drops?: { objectId: number; name: string; imageUrl: string; percent: number; percentByGrade?: number[] }[];
    spells?: SpellData[];
    passive?: BossPassiveData;
}

function SpellIcon({ spell, size = 8 }: { spell: SpellData; size?: number }) {
    const [useFallback, setUseFallback] = useState(false);
    const sizeClass = size === 8 ? "w-8 h-8" : size === 9 ? "w-9 h-9" : "w-10 h-10";

    if (spell.unityIconId && spell.unityIconId > 0 && !useFallback) {
        return (
            <div className={cn(sizeClass, "rounded-xl bg-background border border-border flex items-center justify-center p-0.5 shrink-0 overflow-hidden")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={`/uploads/assets-dofus/spells/sort_${spell.unityIconId}.webp`}
                    alt={spell.name}
                    className="w-full h-full object-contain"
                    loading="lazy"
                    onError={() => setUseFallback(true)}
                />
            </div>
        );
    }

    if (spell.imageUrl) {
        return (
            <div className={cn(sizeClass, "rounded-xl bg-background border border-border flex items-center justify-center p-0.5 shrink-0 overflow-hidden")}>
                <MonsterImage
                    src={spell.imageUrl}
                    alt={spell.name}
                    assetType="spells"
                    assetId={spell.id}
                    className="w-full h-full object-contain"
                />
            </div>
        );
    }

    return (
        <div className={cn(sizeClass, "rounded-xl bg-background border border-border flex items-center justify-center p-1 shrink-0")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/dofus/modules/spells.png" alt="" className="w-full h-full object-contain opacity-60" />
        </div>
    );
}

interface FamilyMember {
    id: number;
    name: string;
    imageUrl: string | null;
    isBoss: boolean;
    /** 🌀 Monstre de l'anomalie (Briko/Bruto/Gromo) — 3 tirés au hasard par combat. */
    isCompanion?: boolean;
    level?: number | null;
    raceName?: string | null;
}

interface DungeonFamily {
    familyId: number | null;
    monsters: FamilyMember[];
    /** Monstres de l'anomalie uniquement (accompagnateurs) — sous-ensemble de `monsters`. */
    companions?: FamilyMember[];
    /** « 3 au hasard parmi 16 » (fourni par la source siphonnée). */
    companionHint?: string | null;
}

/** Données de quêtes liées — forme d'affichage partagée (`SuccesBossQuests`). */
type LinkedQuestsData = BossLinkedQuestsData;

export function SuccesBossGuide({ guildId, anomalyOnly = false }: { guildId: string; anomalyOnly?: boolean }) {
    const { openBossOverlay, isOpen: isOverlayOpen } = useBossOverlay(guildId);
    const [dungeons, setDungeons] = useState<BossDungeon[]>([]);
    const [statsByBoss, setStatsByBoss] = useState<Record<string, MonsterStats>>({});
    const [loadingStatsByBoss, setLoadingStatsByBoss] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<BossDungeon | null>(null);
    // Deep-link : l'overlay Rush ou un lien peut arriver sur `?dungeon={id}&view=boss`.
    // On lit le paramètre pour ouvrir directement la fiche du bon boss (sinon on reste
    // sur la liste de toutes les fiches).
    const searchParams = useSearchParams();
    const dungeonParam = searchParams.get("dungeon");
    const deepLinkHandledRef = useRef(false);
    const [selectedDrop, setSelectedDrop] = useState<any>(null);
    const [selectedSpellId, setSelectedSpellId] = useState<number | undefined>(undefined);
    const [familyByDungeon, setFamilyByDungeon] = useState<Record<string, DungeonFamily>>({});
    const [activeMonsterName, setActiveMonsterName] = useState<string | null>(null);
    const [activeGradeIndex, setActiveGradeIndex] = useState<number | null>(null);
    const [detailTab, setDetailTab] = useState<"sorts" | "sim" | "loot" | "family" | "quetes">("sorts");
    // Détail des sorts : chaque sort est replié par défaut (les mécaniques clés — le passif —
    // suffisent d'un coup d'œil). L'état est remis à zéro à chaque changement de fiche.
    // Deep-link `?onglet=quetes` (redirect de l'ancienne vue globale `?view=quetes`).
    const questTabRequested = searchParams.get("onglet") === "quetes";
    const [linkedQuestsByDungeon, setLinkedQuestsByDungeon] = useState<Record<string, LinkedQuestsData>>({});
    // Maps du donjon (salles réelles) récupérées chez Dofensive pour le boss courant.
    const [dungeonMapsByBoss, setDungeonMapsByBoss] = useState<Record<string, DofensiveDungeonInfo | null>>({});
    const [copiedTravel, setCopiedTravel] = useState(false);
    const [expandedSpells, setExpandedSpells] = useState<Record<number, boolean>>({});
    const toggleSpellExpanded = (id: number) => {
        setExpandedSpells((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    // 1. Charger la liste des donjons (instantané ~50ms, sans spammer 89 requêtes réseau)
    useEffect(() => {
        let cancelled = false;
        getDungeonsWithAchievements()
            .then((res) => {
                if (cancelled) return;
                if (res.success && Array.isArray(res.data)) {
                    const withBoss = (res.data as any[])
                        .filter((d) => d && (d.bossName || d.name))
                        // Onglet « Boss Anomalie » : uniquement le contenu siphonné marqué
                        // `isAnomalyBoss` (onglet « Fiches Boss » : les donjons classiques).
                        .filter((d) => !anomalyOnly || !!d.isAnomalyBoss)
                        .filter((d) => anomalyOnly || !d.isAnomalyBoss)
                        .map((d) => ({
                            id: d.id,
                            name: d.name,
                            bossName: d.bossName || d.name,
                            level: d.level ?? 0,
                            imageUrl: d.imageUrl ?? null,
                            dofensiveUrl: d.dofensiveUrl ?? null,
                            dpnlUrl: d.dpnlUrl ?? null,
                            dofuspourlesnoobsUrl: d.dofuspourlesnoobsUrl ?? null,
                            dofusdbId: d.dofusdbId ?? null,
                            dofensiveMonsterName: d.dofensiveMonsterName ?? null,
                            dofensiveDungeonName: d.dofensiveDungeonName ?? null,
                            isAnomalyBoss: !!d.isAnomalyBoss,
                            anomalyMapId: d.anomalyMapId ?? null,
                            anomalyFamily: d.anomalyFamily ?? null,
                            mapId: d.mapId ?? null,
                            achievements: Array.isArray(d.achievements) ? d.achievements : [],
                        }));
                    setDungeons(withBoss);
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [anomalyOnly]);

    // 2. Deep-link `?dungeon={id}` : dès que la liste des donjons est chargée, on ouvre
    //    directement la fiche du boss ciblé (au lieu de laisser l'onglet sur la liste).
    useEffect(() => {
        if (!dungeonParam || dungeons.length === 0) return;
        if (deepLinkHandledRef.current) return;
        const match = dungeons.find((d) => d.id === dungeonParam || d.slug === dungeonParam);
        if (!match) return;
        deepLinkHandledRef.current = true;
        setSelected(match);
        setSelectedSpellId(undefined);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, [dungeonParam, dungeons]);

    // 3. Charger les stats du monstre sélectionné à la demande (lazy-load avec mise en cache)
    useEffect(() => {
        const d = selected;
        if (!d) return;
        const targetMonster = activeMonsterName ?? d.bossName;
        const key = activeMonsterName ? `${d.id}::${activeMonsterName}` : d.id;

        if (!statsByBoss[key] && !loadingStatsByBoss[key]) {
            setLoadingStatsByBoss((prev) => ({ ...prev, [key]: true }));
            getMonsterStats(targetMonster, d.name)
                .then(async (statsRes) => {
                    if (statsRes.success && statsRes.data) {
                        let data = statsRes.data;
                        const dRes = await getBossDofensiveSpells(targetMonster, d.name);
                        if (dRes.success && dRes.data) {
                            data = { ...data, spells: mergeDofensiveSpells(data.spells ?? [], dRes.data) };
                        }
                        setStatsByBoss((prev) => ({ ...prev, [key]: data }));
                    }
                })
                .catch(() => {})
                .finally(() => {
                    setLoadingStatsByBoss((prev) => ({ ...prev, [key]: false }));
                });
        }
    }, [selected?.id, activeMonsterName]);

    // Famille du boss : chargée à la sélection d'un donjon (auto-population DofusDB, cache 24h).
    useEffect(() => {
        const d = selected;
        if (!d) {
            setActiveMonsterName(null);
            return;
        }
        setActiveMonsterName(null);
        setActiveGradeIndex(null);
        // `?onglet=quetes` (redirect `?view=quetes`) ouvre directement les quêtes — boss classiques uniquement.
        setDetailTab(!d.isAnomalyBoss && questTabRequested ? "quetes" : "sorts");
        // Reset de l'accordéon des sorts : aucun dépliage ne survit au changement de fiche.
        setExpandedSpells({});
        setSelectedSpellId(undefined);
        if (!familyByDungeon[d.id]) {
            // 🌀 Boss d'anomalie : la « famille » = les autres gardiens de la MÊME carte
            // (métadonnées siphonnées) — aucun donjon Dofensive à interroger.
            const request = d.isAnomalyBoss
                ? getAnomalyBossFamily(d.bossName)
                : getDungeonMonsters(d.bossName, d.name);
            request.then((res) => {
                if (res.success && res.data) {
                    setFamilyByDungeon((prev) => ({ ...prev, [d.id]: res.data as DungeonFamily }));
                }
            });
        }

        if (!linkedQuestsByDungeon[d.id]) {
            getLinkedQuests(guildId, d.name, d.bossName, d.dofusdbId ?? null).then((res) => {
                if (res.success && res.data) {
                    setLinkedQuestsByDungeon((prev) => ({ ...prev, [d.id]: res.data as LinkedQuestsData }));
                }
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected?.id]);

    // Salles du donjon (maps Dofensive) pour le boss courant — lazy, une seule fois par boss.
    useEffect(() => {
        const d = selected;
        if (!d) return;
        const boss = activeMonsterName ?? d.bossName;
        if (!boss || dungeonMapsByBoss[boss] !== undefined) return;
        let cancelled = false;
        // On passe aussi le nom du donjon (`d.name`) : le resolver Dofensive a un
        // fallback par nom de donjon (token overlap) — indispensable pour les donjons
        // multi-boss dont le `bossName` DofusDB ne matche pas le nom Dofensive.
        // 🌀 Boss d'anomalie : résolution LOCALE (carte siphonnée, sinon map par défaut).
        const resolution = d.isAnomalyBoss
            ? getAnomalyBossBattleMap(boss, d.anomalyMapId)
            : getDofensiveDungeonForBoss(boss, d.name, {
                dofensiveMonsterName: d.dofensiveMonsterName,
                dofensiveDungeonName: d.dofensiveDungeonName,
            });
        resolution
            .then((res) => {
                if (cancelled) return;
                setDungeonMapsByBoss((prev) => ({ ...prev, [boss]: res.success && res.data ? res.data : null }));
            })
            .catch(() => {
                if (!cancelled) setDungeonMapsByBoss((prev) => ({ ...prev, [boss]: null }));
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected?.id, activeMonsterName]);

    // Re-fetch des sorts Dofensive quand le grade change (données de combat PAR GRADE).
    useEffect(() => {
        const d = selected;
        if (!d || activeGradeIndex === null) return;
        const key = activeMonsterName ? `${d.id}::${activeMonsterName}` : d.id;
        const grades = statsByBoss[key]?.grades;
        if (!grades || grades.length === 0) return;
        const gradeNumber = activeGradeIndex + 1; // grade ordinal Dofensive (1..N)
        let cancelled = false;
        getBossDofensiveSpells(activeMonsterName ?? d.bossName, d.name, gradeNumber, false, {
            dofensiveMonsterName: d.dofensiveMonsterName,
            dofensiveDungeonName: d.dofensiveDungeonName,
        })
            .then((res) => {
                if (cancelled || !res.success || !res.data) return;
                setStatsByBoss((prev) => {
                    const cur = prev[key];
                    if (!cur) return prev;
                    return { ...prev, [key]: { ...cur, spells: mergeDofensiveSpells(cur.spells ?? [], res.data) } };
                });
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected?.id, activeMonsterName, activeGradeIndex]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return dungeons;
        return dungeons.filter(
            (d) =>
                d.bossName.toLowerCase().includes(q) ||
                d.name.toLowerCase().includes(q)
        );
    }, [dungeons, search]);

    const statsOf = (d: BossDungeon): MonsterStats | undefined =>
        statsByBoss[activeMonsterName && d.id === selected?.id ? `${d.id}::${activeMonsterName}` : d.id];

    const selectMonster = (d: BossDungeon, m: FamilyMember) => {
        if (m.isBoss || m.name === d.bossName) {
            setActiveMonsterName(null);
            setActiveGradeIndex(null);
            setSelectedSpellId(undefined);
            return;
        }
        setActiveMonsterName(m.name);
        setActiveGradeIndex(null);
        setSelectedSpellId(undefined);
    };
    const activeBossId = selected ? selected.id : null;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Swords className="w-8 h-8 animate-spin mb-4 text-muted-foreground" />
                <p className="font-medium">Chargement des fiches boss…</p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-col md:flex-row md:items-center gap-3" data-tour="succes-filters">
                <div className="relative flex-1" data-tour="succes-search">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        value={search}
                        onChange={(e) => {
                            const val = e.target.value;
                            setSearch(val);
                            if (val.trim().length > 0 && selected) {
                                setSelected(null);
                                setSelectedSpellId(undefined);
                            }
                        }}
                        placeholder={anomalyOnly ? "Rechercher un gardien d'anomalie…" : "Rechercher un boss ou un donjon…"}
                        className="w-full h-11 pl-9 pr-8 rounded-xl bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label="Effacer la recherche"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <p className="text-xs text-muted-foreground font-semibold">
                    {search
                        ? `${filtered.length} ${anomalyOnly ? "gardien(s)" : "boss"} trouvé(s) sur ${dungeons.length}`
                        : `${dungeons.length} ${anomalyOnly ? "gardiens d'anomalie répertoriés" : "boss répertoriés"}`}
                </p>
            </div>


            {!selected && (filtered.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground border border-dashed border-border rounded-2xl bg-background/40">
                    <Swords className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="font-medium">{anomalyOnly ? "Aucun gardien d'anomalie trouvé." : "Aucun boss trouvé."}</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" data-tour="succes-tracker-list">
                    {filtered.map((d) => {
                        const stats = statsOf(d);
                        return (
                            <button
                                key={d.id}
                                type="button"
                                onClick={() => {
                                    if (activeBossId === d.id) {
                                        setSelected(null);
                                        setSelectedSpellId(undefined);
                                        return;
                                    }
                                    setSelected(d);
                                    setSelectedSpellId(undefined);
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                                className={cn(
                                    "flex flex-col rounded-2xl border overflow-hidden transition-colors text-left group",
                                    activeBossId === d.id
                                        ? "border-border-strong bg-elevated"
                                        : "border-border bg-surface/70 hover:bg-elevated/80 hover:border-border-strong"
                                )}
                            >
                                <div className="relative h-24 bg-background flex items-center justify-center p-2 overflow-hidden">
                                    <MonsterImage
                                        src={stats?.imageUrl ?? d.imageUrl}
                                        alt={d.bossName}
                                        monsterId={stats?.id ?? (typeof d.dofusdbId === 'number' ? d.dofusdbId : undefined)}
                                        className="max-h-full max-w-full object-contain transition-opacity"
                                    />
                                    <div className="absolute top-1.5 left-1.5 rounded-md bg-background/85 backdrop-blur px-1.5 py-0.5 text-[11px] font-bold text-foreground border border-border">
                                        LVL {d.level}
                                    </div>
                                    {/* Chantier « boss d'anomalie » : marqueur visuel du contenu siphonné. */}
                                    {d.isAnomalyBoss && (
                                        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 rounded-md bg-info/20 backdrop-blur px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-info border border-info/30">
                                            <img src="/assets/missions/ano1.png" alt="" aria-hidden className="w-3.5 h-3.5 object-contain" />
                                            Anomalie
                                        </div>
                                    )}
                                </div>
                                <div className="p-3 border-t border-border">
                                    <p className="text-sm font-bold text-foreground leading-tight truncate group-hover:text-foreground transition-colors">{d.bossName}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{d.name}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            ))}

            {selected && (
                <div className="bg-surface/90 border border-border rounded-2xl p-5 sm:p-6 space-y-6" data-tour="succes-tracker-detail">
                    {/* Header Boss + Stats + Minimap (Iso Fiche Publique) */}
                    {(() => {
                        const targetKey = activeMonsterName && selected ? `${selected.id}::${activeMonsterName}` : selected?.id;
                        const isLoadingCurrent = targetKey ? loadingStatsByBoss[targetKey] : false;
                        const currentStats = statsOf(selected);
                        const grades: any[] = currentStats?.grades ?? [];
                        const gradeIdx = activeGradeIndex ?? (grades.length > 0 ? grades.length - 1 : 0);
                        const activeGrade = grades.length > 0 ? grades[Math.min(gradeIdx, grades.length - 1)] : null;
                        const resists = activeGrade?.resists || {};
                        const coords = currentStats?.coordinates as { x: number; y: number; worldMapId?: number } | null | undefined;
                        const travelCmd = coords ? `/travel ${coords.x} ${coords.y}` : null;
                        const hasZoneLocation = !!(coords || selected.mapId);
                        const zoneWorldId = Number(coords?.worldMapId ?? 0) > 0 ? (coords!.worldMapId as number) : 1;
                        const dpnlUrl = selected.dpnlUrl ?? selected.dofuspourlesnoobsUrl ?? null;

                        return (
                            <div className="space-y-4">
                                <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
                                    {dpnlUrl && (
                                        <a href={dpnlUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-surface text-foreground text-xs font-bold hover:bg-elevated hover:border-border-strong transition-colors">
                                            <img src="https://www.google.com/s2/favicons?domain=dofuspourlesnoobs.com&sz=32" alt="" className="w-3.5 h-3.5 rounded-sm" loading="lazy" />
                                            DPLN
                                        </a>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            openBossOverlay({
                                                monsterName: activeMonsterName ?? selected.bossName,
                                                dungeonName: selected.name,
                                            });
                                        }}
                                        title="Ouvrir la fiche dans l'Encyclopédie Overlay"
                                        className={cn(
                                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors",
                                            isOverlayOpen
                                                ? "border-border-strong bg-white/[0.08] text-foreground hover:bg-white/[0.12]"
                                                : "border border-border text-muted-foreground hover:border-border-strong hover:text-foreground"
                                        )}
                                    >
                                        <PictureInPicture2 className="w-3.5 h-3.5" />
                                        {isOverlayOpen ? "Encyclopédie ouverte" : "Encyclopédie Overlay"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelected(null);
                                            setSelectedSpellId(undefined);
                                        }}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-surface border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors"
                                    >
                                        <X className="w-3.5 h-3.5" /> Fermer
                                    </button>
                                </div>

                                <div className={cn("grid gap-4", hasZoneLocation && "lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:items-start")}>
                                    {/* ── Colonne gauche : identité, entrée du donjon, caractéristiques ── */}
                                    <div className="min-w-0 space-y-3.5">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="w-16 h-16 rounded-xl border border-border bg-background/60 flex items-center justify-center p-1.5 shrink-0 overflow-hidden shadow-xs">
                                                <MonsterImage
                                                    src={currentStats?.imageUrl ?? selected.imageUrl}
                                                    alt={activeMonsterName ?? selected.bossName}
                                                    monsterId={currentStats?.id ?? selected.dofusdbId ?? undefined}
                                                    className="max-w-full max-h-full object-contain"
                                                />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                                                    {selected.isAnomalyBoss ? "Gardien d'anomalie" : "Boss de donjon"}
                                                    <span className="font-mono normal-case">Niv. {selected.level ?? 200}</span>
                                                </p>
                                                <h3 className="mt-0.5 truncate text-2xl font-bold text-foreground">
                                                    {activeMonsterName ?? selected.bossName}
                                                </h3>
                                                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                                                    <Compass className="w-3.5 h-3.5 opacity-70" />
                                                    {selected.isAnomalyBoss ? "Carte :" : "Donjon :"}{" "}
                                                    <span className="text-foreground/90 font-medium">{selected.name}</span>
                                                    {selected.isAnomalyBoss && selected.anomalyFamily ? (
                                                        <span className="ml-1 text-[11px] font-semibold text-info/90">· {selected.anomalyFamily}</span>
                                                    ) : null}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Entrée du donjon : coordonnées copiables (clic) + zone. */}
                                        {coords && (
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (!travelCmd) return;
                                                        navigator.clipboard.writeText(travelCmd).then(() => {
                                                            setCopiedTravel(true);
                                                            toast.success(`Commande ${travelCmd} copiée !`);
                                                            window.setTimeout(() => setCopiedTravel(false), 2000);
                                                        }).catch(() => {});
                                                    }}
                                                    className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-surface border border-border hover:border-border-strong text-foreground transition-colors cursor-pointer"
                                                    title="Cliquer pour copier la commande /travel"
                                                >
                                                    <MapPin className="w-3.5 h-3.5 shrink-0 opacity-70" />
                                                    <span>
                                                        Entrée du donjon :{" "}
                                                        <strong className="font-mono text-foreground/90">
                                                            [{coords.x}, {coords.y}]
                                                        </strong>
                                                    </span>
                                                    {copiedTravel ? (
                                                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                                                    ) : (
                                                        <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-background border border-border text-muted-foreground font-mono">
                                                            {travelCmd}
                                                        </span>
                                                    )}
                                                </button>
                                                <span className="text-xs font-semibold text-muted-foreground">
                                                    Zone : <strong className="text-foreground">{getWorldName(coords.worldMapId)}</strong>
                                                </span>
                                            </div>
                                        )}

                                        {/* Caractéristiques : PV / PA / PM en cartes, résistances dans un encadré. */}
                                        {isLoadingCurrent ? (
                                            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/60 px-3.5 py-3 text-muted-foreground">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span className="text-xs">Chargement des caractéristiques de {activeMonsterName ?? selected.bossName}…</span>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="grid grid-cols-3 gap-2.5">
                                                    <div className="rounded-xl border border-border bg-surface/60 px-3.5 py-2" title="Points de Vie">
                                                        <span className="flex items-baseline gap-1.5">
                                                            <img src="/assets/dofus/stats/pv.png" alt="" className="w-4 h-4 shrink-0 self-center object-contain" />
                                                            <span className="font-mono text-xl font-bold tabular-nums text-foreground sm:text-2xl">
                                                                {activeGrade ? (typeof activeGrade.lifePoints === "number" ? activeGrade.lifePoints.toLocaleString("fr-FR") : "—") : "—"}
                                                            </span>
                                                            <span className="font-mono text-[11px] text-muted-foreground">PV</span>
                                                        </span>
                                                    </div>
                                                    <div className="rounded-xl border border-border bg-surface/60 px-3.5 py-2" title="Points d'Action">
                                                        <span className="flex items-baseline gap-1.5">
                                                            <img src="/assets/dofus/stats/pa.png" alt="" className="w-4 h-4 shrink-0 self-center object-contain" />
                                                            <span className="font-mono text-xl font-bold tabular-nums text-foreground sm:text-2xl">{activeGrade?.actionPoints ?? "—"}</span>
                                                            <span className="font-mono text-[11px] text-muted-foreground">PA</span>
                                                        </span>
                                                    </div>
                                                    <div className="rounded-xl border border-border bg-surface/60 px-3.5 py-2" title="Points de Mouvement">
                                                        <span className="flex items-baseline gap-1.5">
                                                            <img src="/assets/dofus/stats/pm.png" alt="" className="w-4 h-4 shrink-0 self-center object-contain" />
                                                            <span className="font-mono text-xl font-bold tabular-nums text-foreground sm:text-2xl">{activeGrade?.movementPoints ?? "—"}</span>
                                                            <span className="font-mono text-[11px] text-muted-foreground">PM</span>
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="rounded-xl border border-border bg-surface/60 px-3.5 py-2.5">
                                                    <span className="block text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Résistances</span>
                                                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                            {(
                                                                [
                                                                    { key: "neutral", label: "Neutre", icon: "/assets/dofus/stats/resNeutre.png", value: resists.neutral ?? null },
                                                                    { key: "earth", label: "Terre", icon: "/assets/dofus/stats/resTerre.png", value: resists.earth ?? null },
                                                                    { key: "fire", label: "Feu", icon: "/assets/dofus/stats/resFeu.png", value: resists.fire ?? null },
                                                                    { key: "water", label: "Eau", icon: "/assets/dofus/stats/resEau.png", value: resists.water ?? null },
                                                                    { key: "air", label: "Air", icon: "/assets/dofus/stats/resAir.png", value: resists.air ?? null },
                                                                ] as const
                                                            ).map(({ key, label, icon, value }) => (
                                                                <span key={key} className="inline-flex items-center gap-1.5" title={`${label} %`}>
                                                                    <img src={icon} alt="" className="w-4 h-4 object-contain" />
                                                                    <span
                                                                        className={cn(
                                                                            "font-mono text-[13px] font-bold tabular-nums",
                                                                            typeof value === "number" && value < 0 ? "text-rose-400" : "text-foreground/90"
                                                                        )}
                                                                    >
                                                                        {typeof value === "number" ? `${value}%` : "—"}
                                                                    </span>
                                                                    <span className="hidden text-[11px] text-muted-foreground sm:inline">{label}</span>
                                                                </span>
                                                            ))}
                                                        </div>
                                                        {grades.length > 1 && (
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-[11px] font-bold text-muted-foreground mr-1">Rang :</span>
                                                                {grades.map((gr: any, i: number) => (
                                                                    <button
                                                                        key={i}
                                                                        type="button"
                                                                        onClick={() => setActiveGradeIndex(i)}
                                                                        className={cn(
                                                                            "min-w-6 h-6 px-1.5 rounded-md border text-[11px] font-bold tabular-nums transition-colors cursor-pointer",
                                                                            gradeIdx === i
                                                                                ? "bg-foreground text-background border-foreground font-black"
                                                                                : "bg-background border-border text-muted-foreground hover:text-foreground"
                                                                        )}
                                                                        title={`Rang ${i + 1} — Niv. ${gr.level ?? "—"}`}
                                                                    >
                                                                        {i + 1}
                                                                    </button>
                                                                ))}
                                                                {activeGrade?.level != null && (
                                                                    <span className="text-[11px] font-mono text-muted-foreground ml-1">
                                                                        · Niv. {activeGrade.level}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Caractéristiques avancées officielles (Tacle, Fuite, Esquives, Initiative) */}
                                                {(activeGrade?.tackle !== undefined || activeGrade?.apDodge !== undefined) && (
                                                    <div className="grid grid-cols-4 gap-2 rounded-xl border border-border bg-surface/40 p-2.5 text-[11px] font-mono">
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-muted-foreground text-[10px] uppercase font-sans">Tacle</span>
                                                            <span className="text-foreground font-bold tabular-nums mt-0.5">{activeGrade.tackle ?? "—"}</span>
                                                        </div>
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-muted-foreground text-[10px] uppercase font-sans">Fuite</span>
                                                            <span className="text-foreground font-bold tabular-nums mt-0.5">{activeGrade.evade ?? "—"}</span>
                                                        </div>
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-muted-foreground text-[10px] uppercase font-sans">Esq PA</span>
                                                            <span className="text-foreground font-bold tabular-nums mt-0.5">{activeGrade.apDodge ?? "—"}</span>
                                                        </div>
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-muted-foreground text-[10px] uppercase font-sans">Esq PM</span>
                                                            <span className="text-foreground font-bold tabular-nums mt-0.5">{activeGrade.mpDodge ?? "—"}</span>
                                                        </div>
                                                        {activeGrade.initiative !== undefined && activeGrade.initiative > 0 && (
                                                            <div className="col-span-4 flex items-center justify-between pt-1.5 border-t border-border px-1 text-[11px]">
                                                                <span className="text-muted-foreground font-sans">Initiative</span>
                                                                <span className="text-foreground font-bold tabular-nums">
                                                                    {activeGrade.initiative.toLocaleString("fr-FR")}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {/* ── Colonne droite : minimap / aperçu de la zone ── */}
                                    {hasZoneLocation && (
                                        <ZoneLocationCard
                                            mapId={selected.mapId ?? null}
                                            worldId={zoneWorldId}
                                            mapHref={
                                                coords
                                                    ? `/carte-du-monde?play=1&x=${coords.x}&y=${coords.y}&zoom=-2&world=${zoneWorldId}`
                                                    : null
                                            }
                                            title="Localisation du donjon"
                                            placeName={selected.name}
                                            openLabel="Explorer sur la carte"
                                            markerIcon="/assets/worldmap/dungeon-boss.png"
                                            fallback={
                                                coords ? (
                                                    <DungeonMinimapCard
                                                        x={coords.x}
                                                        y={coords.y}
                                                        worldMapId={coords.worldMapId}
                                                        title="Localisation du donjon"
                                                        placeName={selected.name}
                                                        openLabel="Explorer sur la carte"
                                                    />
                                                ) : null
                                            }
                                        />
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {/* 3. Onglets secondaires : sorts, simulation, butin, salle, quêtes.
                        Les rangs (grades) vivent dans la section encyclopédie ci-dessus. */}
                    {(() => {
                        const roomMonsters = selected && familyByDungeon[selected.id]?.monsters ? familyByDungeon[selected.id].monsters : [];
                        const hasRoomMonsters = roomMonsters.length > 1;
                        const currentStats = statsOf(selected);
                        // Quêtes liées (boss classiques uniquement — déjà chargées, zéro requête en plus).
                        const questCount = selected && !selected.isAnomalyBoss ? (linkedQuestsByDungeon[selected.id]?.quests.length ?? 0) : 0;

                        // Un seul onglet Sorts : mécaniques clés + détail complet.
                        const spellCount = currentStats?.spells?.length ?? 0;
                        const tabs = [
                            { id: "sorts", label: `Sorts (${spellCount})`, asset: "/assets/dofus/modules/spells.png" },
                            { id: "sim", label: "Simulation Tactique", asset: "/assets/dofus/modules/map.png" },
                            { id: "loot", label: "Butin & Drops", asset: "/assets/dofus/modules/chest.png" },
                            ...(hasRoomMonsters ? [{ id: "family", label: `Monstres de la salle (${roomMonsters.length})`, asset: "/assets/dofus/modules/party.png" }] : []),
                            ...(!selected?.isAnomalyBoss ? [{ id: "quetes", label: `Quêtes (${questCount})`, asset: "/assets/dofus/icons/quests.png" }] : []),
                        ];

                        return (
                            <div className="flex items-center gap-1 overflow-x-auto border-b border-border no-scrollbar">
                                {tabs.map((tab) => {
                                    const isActive = detailTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setDetailTab(tab.id as any)}
                                            className={cn(
                                                "flex items-center gap-2 border-b-2 -mb-px px-3 py-2 text-xs transition-colors whitespace-nowrap cursor-pointer",
                                                isActive
                                                    ? "border-foreground/60 text-foreground"
                                                    : "border-transparent text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={tab.asset} alt="" className={cn("w-4 h-4 object-contain", !isActive && "opacity-60")} />
                                            <span>{tab.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })()}

                    {/* Onglet dédié : Monstres de la salle + monstres de l'anomalie */}
                    {detailTab === "family" && (() => {
                        const family = familyByDungeon[selected.id];
                        const companionCount = family?.companions?.length ?? 0;
                        return (
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                                    <Users className="w-4 h-4 opacity-70" /> Monstres accompagnateurs de la salle
                                </h4>
                                {companionCount > 0 && (
                                    <span
                                        className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-info/30 text-info bg-info/10"
                                        title="En combat, le gardien est accompagné de 3 de ces monstres, tirés au hasard à l'ouverture de l'anomalie."
                                    >
                                        Anomalie · {family?.companionHint ?? `${companionCount} monstres possibles`}
                                    </span>
                                )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {(family?.monsters || []).map((m) => {
                                    const isActive = (activeMonsterName ?? selected.bossName) === m.name;
                                    return (
                                        <div
                                            key={m.id}
                                            className={cn(
                                                "p-3 rounded-2xl border transition-colors flex flex-col justify-between space-y-2.5 group",
                                                isActive
                                                    ? "border-border-strong bg-white/[0.06]"
                                                    : "border-border bg-surface hover:border-border-strong"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center p-1 shrink-0 overflow-hidden">
                                                    {m.imageUrl ? (
                                                        <MonsterImage src={m.imageUrl} alt={m.name} monsterId={m.id} className="w-full h-full object-contain" />
                                                    ) : (
                                                        <Swords className="w-4 h-4 text-muted-foreground" />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className={cn("text-xs font-bold truncate", isActive ? "text-foreground" : "text-muted-foreground")}>
                                                        {m.isBoss && "👑 "}{m.name}
                                                    </p>
                                                    <span className="text-[11px] text-muted-foreground block">
                                                        {m.isBoss
                                                            ? "Boss principal"
                                                            : m.isCompanion
                                                            ? `Monstre de l'anomalie${m.raceName ? ` · ${m.raceName}` : ""}`
                                                            : "Monstre de salle"}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        selectMonster(selected, m);
                                                        setDetailTab("sorts");
                                                    }}
                                                    className="flex-1 py-1 px-2 rounded-lg bg-surface border border-border text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors text-center"
                                                >
                                                    Fiche & Sorts
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        selectMonster(selected, m);
                                                        setDetailTab("sim");
                                                    }}
                                                    className="py-1 px-2.5 rounded-lg border border-border text-muted-foreground text-[11px] hover:text-foreground transition-colors text-center flex items-center gap-1"
                                                    title="Simuler la portée de ce monstre"
                                                >
                                                    <Target className="w-3 h-3" /> Simuler
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        );
                    })()}

                    {/* Onglet : Sorts (fusionné, iso fiche publique) */}
                    {detailTab === "sorts" && (
                        <div className="space-y-4">
                            {/* Passif officiel Unity — mécanique de début de combat (repliable) */}
                            {statsOf(selected)?.passive && (
                                <BossMechanicsView passive={statsOf(selected)!.passive!} collapsible defaultCollapsed={false} />
                            )}

                            {(() => {
                                const spells = statsOf(selected)?.spells ?? [];
                                if (spells.length === 0) {
                                    return (
                                        <p className="text-xs text-muted-foreground py-8 text-center">
                                            Aucun sort répertorié pour cette entité.
                                        </p>
                                    );
                                }
                                return (
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <Zap className="w-4 h-4 opacity-70" />
                                            <h4 className="text-sm font-bold text-foreground">
                                                Tous les sorts ({spells.length})
                                            </h4>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                                            {spells.map((spell: any) => {
                                                const isExpanded = !!expandedSpells[spell.id];
                                                const rawEffects: string[] = spell.unityEffects?.length > 0
                                                    ? spell.unityEffects
                                                    : (Array.isArray(spell.effects) ? spell.effects : []);
                                                const details = rawEffects.length > 0
                                                    ? rawEffects.map((e: string) => ({ label: e, duration: null, triggers: [] as string[], masks: [] as string[] }))
                                                    : (spell.effectDetails?.length > 0 ? spell.effectDetails : []);
                                                const criticals = spell.unityCriticalEffects?.length > 0
                                                    ? spell.unityCriticalEffects
                                                    : (Array.isArray(spell.criticalEffects) ? spell.criticalEffects : []);
                                                const hasBody = details.length > 0 || spell.description || spell.unityDescription || criticals.length > 0 || spell.hasCriticalEffects === false;

                                                return (
                                                    <div key={spell.id} className="p-3.5 rounded-xl bg-surface/50 border border-border/70 flex flex-col space-y-2 hover:border-border transition-colors">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => hasBody && toggleSpellExpanded(spell.id)}
                                                                className={cn("flex items-center gap-2.5 text-left flex-1 min-w-0", hasBody && "cursor-pointer group")}
                                                                title={hasBody ? (isExpanded ? "Replier les détails" : "Déplier les détails") : undefined}
                                                            >
                                                                <SpellIcon spell={spell} size={8} />
                                                                <div className="min-w-0">
                                                                    <span className="flex items-center gap-1.5">
                                                                        <span className="block text-sm font-bold text-foreground truncate group-hover:text-warning transition-colors">
                                                                            {spell.name}
                                                                        </span>
                                                                        {spell.grade !== undefined && (
                                                                            <span className="text-[11px] font-mono text-muted-foreground bg-background border border-border px-1 py-px rounded shrink-0">
                                                                                Niv. {spell.grade}
                                                                            </span>
                                                                        )}
                                                                        {hasBody && (
                                                                            <span className="text-muted-foreground group-hover:text-foreground transition-colors ml-0.5">
                                                                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                    <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1 mt-0.5">
                                                                        <img src="/assets/dofus/stats/pa.png" alt="PA" className="w-3 h-3 object-contain inline" />
                                                                        <span>{spell.apCost || 0}</span>
                                                                        <span>·</span>
                                                                        <img src="/assets/dofus/stats/po.png" alt="PO" className="w-3 h-3 object-contain inline" />
                                                                        <span>{spell.minRange === spell.range ? `${spell.range}` : `${spell.minRange ?? 0}-${spell.range ?? 0}`}</span>
                                                                    </span>
                                                                </div>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => { setSelectedSpellId(spell.id); setDetailTab("sim"); }}
                                                                className="text-[11px] font-semibold px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
                                                            >
                                                                Simuler
                                                            </button>
                                                        </div>

                                                        {isExpanded && hasBody && (
                                                            <div className="pt-2 border-t border-border/60 space-y-2 text-[11px] leading-relaxed">
                                                                {(spell.unityDescription || spell.description) && (
                                                                    <p className="text-muted-foreground">{spell.unityDescription || spell.description}</p>
                                                                )}
                                                                {details.length > 0 && (
                                                                    <div className="space-y-1">
                                                                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                                            Effets
                                                                        </span>
                                                                        <ul className="space-y-1">
                                                                            {details.map((det: any, i: number) => (
                                                                                <li key={i} className="text-muted-foreground flex items-center gap-1.5 flex-wrap">
                                                                                    <span className="w-1 h-1 rounded-full bg-border shrink-0" />
                                                                                    <span>{formatDofusEffectLine(det.label)}</span>
                                                                                    {det.duration && <span className="font-mono text-[10px] text-muted-foreground/70">({det.duration})</span>}
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}
                                                                {spell.hasCriticalEffects === false ? (
                                                                    <p className="text-muted-foreground/80">Aucun coup critique</p>
                                                                ) : criticals.length > 0 ? (
                                                                    <div className="space-y-1 pt-1 border-t border-border">
                                                                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-amber-500/90">
                                                                            Effets critiques
                                                                        </span>
                                                                        <ul className="space-y-1">
                                                                            {criticals.map((ce: string, k: number) => (
                                                                                <li key={k} className="text-muted-foreground flex items-center gap-1.5">
                                                                                    <span className="w-1 h-1 rounded-full bg-amber-500/40 shrink-0" />
                                                                                    <span>{formatDofusEffectLine(ce)}</span>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Onglet : Simulation — un seul panneau (la grille porte déjà son
                        cadre) et une ligne d'entité sobre, sans or décoratif. */}
                    {detailTab === "sim" && (
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                    <Target className="w-4 h-4 opacity-70" />
                                    Simulation &amp; portée des sorts
                                </h4>

                                {familyByDungeon[selected.id]?.monsters && familyByDungeon[selected.id].monsters.length > 1 && (
                                    <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-border bg-background/40 p-1">
                                        <span className="hidden shrink-0 px-1.5 text-[11px] text-muted-foreground sm:inline">
                                            Entité :
                                        </span>
                                        {familyByDungeon[selected.id].monsters.map((m) => {
                                            const isActive = (activeMonsterName ?? selected.bossName) === m.name;
                                            return (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => selectMonster(selected, m)}
                                                    className={cn(
                                                        "flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition-colors",
                                                        isActive
                                                            ? "bg-white/[0.10] text-foreground"
                                                            : "text-muted-foreground hover:text-foreground"
                                                    )}
                                                >
                                                    {m.imageUrl && (
                                                        <MonsterImage src={m.imageUrl} alt="" monsterId={m.id} className="w-3 h-3 object-contain" />
                                                    )}
                                                    {m.isBoss && <Crown className="h-3 w-3 text-amber-300/80" />}
                                                    {m.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* 🎛️ Parité avec la landing publique : le toggle « Boss libre »
                                (déplacement libre du boss pour tester les portées) est aussi
                                disponible dans le dashboard — prévisualisation pure, aucune
                                écriture de donnée. */}
                            <SpellRangeGrid
                                spells={statsOf(selected)?.spells ?? []}
                                activeSpellId={selectedSpellId}
                                onSelectSpell={(spell) => setSelectedSpellId(spell.id)}
                                bossName={selected.dofensiveMonsterName ?? (activeMonsterName ?? deriveDofensiveMonsterName(selected.bossName) ?? selected.bossName)}
                                bossImageUrl={statsOf(selected)?.imageUrl}
                                dungeonMaps={dungeonMapsByBoss[activeMonsterName ?? selected.bossName]?.maps}
                                dungeonName={dungeonMapsByBoss[activeMonsterName ?? selected.bossName]?.dungeonName}
                                grades={statsOf(selected)?.grades?.map((g) => ({ level: g.level })) ?? []}
                                activeGradeIndex={activeGradeIndex ?? ((statsOf(selected)?.grades?.length ?? 1) - 1)}
                                onGradeChange={(idx) => setActiveGradeIndex(idx)}
                                monsters={familyByDungeon[selected.id]?.monsters ?? []}
                                allowFreeCasterMove
                            />
                        </div>
                    )}

                    {/* Onglet : Butin */}
                    {detailTab === "loot" && (
                        <div>
                            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                                <Brain className="w-4 h-4 opacity-70" /> Butins notables &amp; taux de drop
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                {(statsOf(selected)?.drops ?? []).map((drop, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setSelectedDrop(drop)}
                                        title={`${drop.name} — ${drop.percent > 0 && drop.percent < 0.01 ? parseFloat(drop.percent.toFixed(3)) : parseFloat(Number(drop.percent || 0).toFixed(2))}%`}
                                        className="flex items-center gap-2.5 rounded-xl bg-surface border border-border p-2 text-left hover:bg-elevated hover:border-border-strong transition-colors"
                                    >
                                        <div className="w-9 h-9 rounded-lg bg-background border border-border p-1 flex items-center justify-center shrink-0 overflow-hidden">
                                            <MonsterImage src={drop.imageUrl} alt={drop.name} assetType="items" assetId={drop.objectId} className="w-full h-full object-contain" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-foreground truncate">{drop.name}</p>
                                            <span className="text-[11px] font-bold text-info">
                                                {drop.percent > 0 && drop.percent < 0.01 ? parseFloat(drop.percent.toFixed(3)) : parseFloat(Number(drop.percent || 0).toFixed(2))}%
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Onglet : Quêtes liées (boss classiques — les succès vivent dans « Mes Succès »). */}
                    {detailTab === "quetes" && !selected.isAnomalyBoss && (
                        <div className="space-y-3">
                            <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                                <ScrollText className="w-4 h-4 opacity-70" /> Quêtes liées au donjon
                                {linkedQuestsByDungeon[selected.id] ? (
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                                        {linkedQuestsByDungeon[selected.id].quests.length} quête{linkedQuestsByDungeon[selected.id].quests.length > 1 ? "s" : ""}
                                    </span>
                                ) : null}
                            </h4>
                            {linkedQuestsByDungeon[selected.id] ? (
                                <SuccesBossQuests guildId={guildId} bossName={selected.bossName} data={linkedQuestsByDungeon[selected.id]} />
                            ) : (
                                <p className="text-xs text-muted-foreground py-4 text-center">Chargement des quêtes liées…</p>
                            )}
                        </div>
                    )}

                    {/* Coordonnées (toujours visibles et cliquables en /travel) */}
                    {statsOf(selected)?.coordinates && (() => {
                        const coords = statsOf(selected)!.coordinates!;
                        const worldName = getWorldName(coords.worldMapId);
                        const travelCmd = `/travel ${coords.x} ${coords.y}`;

                        return (
                            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground pt-3 border-t border-border">
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard.writeText(travelCmd);
                                        toast.success(`Commande ${travelCmd} copiée !`);
                                    }}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background border border-border hover:border-border-strong text-foreground transition-colors group"
                                    title="Cliquer pour copier la commande /travel"
                                >
                                    <MapPin className="w-3.5 h-3.5 shrink-0 opacity-70" />
                                    <span>
                                        Entrée du donjon : <strong className="font-mono text-foreground/90">[{coords.x}, {coords.y}]</strong>
                                    </span>
                                    <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-surface border border-border text-muted-foreground font-mono">
                                        {travelCmd}
                                    </span>
                                </button>
                                <span className="text-xs font-bold text-muted-foreground">
                                    Zone : <strong className="text-foreground">{worldName}</strong>
                                </span>
                            </div>
                        );
                    })()}

                    {/* Drop modal */}
                    {selectedDrop && (
                        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedDrop(null)} />
                            <div className="relative bg-surface border border-border rounded-2xl p-6 w-full max-w-xs text-center">
                                <div className="w-16 h-16 rounded-2xl bg-background border border-border p-2 mx-auto mb-3">
                                    <MonsterImage src={selectedDrop.imageUrl} alt={selectedDrop.name} assetType="items" assetId={selectedDrop.objectId} className="w-full h-full object-contain" />
                                </div>
                                <h3 className="text-sm font-bold text-foreground">{selectedDrop.name}</h3>
                                <p className="text-xs text-info font-bold mt-1">
                                    Taux de drop : {selectedDrop.percentByGrade?.length
                                        ? `${Math.min(...selectedDrop.percentByGrade) < 0.01 ? parseFloat(Math.min(...selectedDrop.percentByGrade).toFixed(3)) : parseFloat(Number(Math.min(...selectedDrop.percentByGrade) || 0).toFixed(2))} % – ${Math.max(...selectedDrop.percentByGrade) < 0.01 ? parseFloat(Math.max(...selectedDrop.percentByGrade).toFixed(3)) : parseFloat(Number(Math.max(...selectedDrop.percentByGrade) || 0).toFixed(2))} % (grade 1-5)`
                                        : `${selectedDrop.percent > 0 && selectedDrop.percent < 0.01 ? parseFloat(selectedDrop.percent.toFixed(3)) : parseFloat(Number(selectedDrop.percent || 0).toFixed(2))}%`}
                                </p>
                                <div className="flex gap-2 mt-5">
                                    <button
                                        onClick={() => setSelectedDrop(null)}
                                        className="flex-1 px-4 py-2 rounded-xl border border-border bg-surface text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        Fermer
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
