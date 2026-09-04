"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Brain, Compass, ExternalLink, Flame, Info, Loader2, MapPin, PictureInPicture2, ScrollText, Search, Shield, Swords, Target, Users, X, Zap, Gem } from "lucide-react";
import { useBossOverlay } from "@/hooks/use-boss-overlay";
import { getDungeonsWithAchievements, getDungeonMonsters, getMonsterStats } from "@/server/actions/game-data-actions";
import { getLinkedQuests } from "@/server/actions/dofus-quest-actions";
import { mergeDofensiveSpells } from "@/lib/dofensive-spells";
import { deriveDofensiveMonsterName } from "@/lib/dofensive-boss";
import {
    getBossDofensiveSpells,
    getDofensiveDungeonForBoss,
    type DofensiveDungeonInfo,
} from "@/server/actions/dofensive-actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getWorldName } from "@/lib/dofus-assets";
import { SpellData, SpellRangeGrid } from "./SpellRangeGrid";

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
                <Swords className="w-1/2 h-1/2 max-w-6 max-h-6" />
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
}

interface FamilyMember {
    id: number;
    name: string;
    imageUrl: string | null;
    isBoss: boolean;
}

interface DungeonFamily {
    familyId: number | null;
    monsters: FamilyMember[];
}

interface LinkedQuest {
    id: string;
    name: string;
    isDungeon: boolean;
    stepOrder: number;
    zone: string | null;
    chainName: string | null;
    isRush: boolean;
    myStatus: string;
    guildCompleted: number;
    guildInProgress: number;
    memberCount: number;
}

interface LinkedQuestsData {
    quests: LinkedQuest[];
    rushActive: { pseudoDofus: string; dofusClass: string | null; milestoneId: string | null }[];
}

export function SuccesBossGuide({ guildId }: { guildId: string }) {
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
    const [detailTab, setDetailTab] = useState<"sorts" | "overview" | "sim" | "grades" | "loot" | "family">("sorts");
    const [linkedQuestsByDungeon, setLinkedQuestsByDungeon] = useState<Record<string, LinkedQuestsData>>({});
    // Maps du donjon (salles réelles) récupérées chez Dofensive pour le boss courant.
    const [dungeonMapsByBoss, setDungeonMapsByBoss] = useState<Record<string, DofensiveDungeonInfo | null>>({});

    // 1. Charger la liste des donjons (instantané ~50ms, sans spammer 89 requêtes réseau)
    useEffect(() => {
        let cancelled = false;
        getDungeonsWithAchievements()
            .then((res) => {
                if (cancelled) return;
                if (res.success && Array.isArray(res.data)) {
                    const withBoss = (res.data as any[])
                        .filter((d) => d && (d.bossName || d.name))
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
    }, []);

    // 2. Deep-link `?dungeon={id}` : dès que la liste des donjons est chargée, on ouvre
    //    directement la fiche du boss ciblé (au lieu de laisser l'onglet sur la liste).
    useEffect(() => {
        if (!dungeonParam || dungeons.length === 0) return;
        if (deepLinkHandledRef.current) return;
        const match = dungeons.find((d) => d.id === dungeonParam);
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
        setDetailTab("overview");
        setSelectedSpellId(undefined);
        if (!familyByDungeon[d.id]) {
            getDungeonMonsters(d.bossName, d.name).then((res) => {
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
        getDofensiveDungeonForBoss(boss, d.name, {
            dofensiveMonsterName: d.dofensiveMonsterName,
            dofensiveDungeonName: d.dofensiveDungeonName,
        })
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
                <Swords className="w-8 h-8 animate-spin mb-4 text-warning" />
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
                        placeholder="Rechercher un boss ou un donjon…"
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
                    {search ? `${filtered.length} boss trouvé(s) sur ${dungeons.length}` : `${dungeons.length} boss répertoriés`}
                </p>
            </div>


            {!selected && (filtered.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground border border-dashed border-border rounded-2xl bg-background/40">
                    <Swords className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="font-medium">Aucun boss trouvé.</p>
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
                                        ? "border-warning/60 bg-elevated"
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
                                </div>
                                <div className="p-3 border-t border-border">
                                    <p className="text-sm font-bold text-foreground leading-tight truncate group-hover:text-warning transition-colors">{d.bossName}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{d.name}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            ))}

            {selected && (
                <div className="bg-surface/90 border border-border rounded-2xl p-5 sm:p-6 space-y-6" data-tour="succes-tracker-detail">
                    {/* Header Boss */}
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-5">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-background border border-border flex items-center justify-center p-1.5 shrink-0 overflow-hidden">
                                <MonsterImage
                                    src={statsOf(selected)?.imageUrl ?? selected.imageUrl}
                                    alt={selected.bossName}
                                    monsterId={statsOf(selected)?.id ?? selected.dofusdbId ?? undefined}
                                    className="max-h-full max-w-full object-contain"
                                />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xl font-bold text-foreground">{activeMonsterName ?? selected.bossName}</h3>
                                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-warning/10 border border-warning/25 text-warning">
                                        Niveau {selected.level}
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                                    <Compass className="w-3.5 h-3.5 text-warning" />
                                    Donjon : <strong className="text-foreground">{selected.name}</strong>
                                </p>
                            </div>
                        </div>

                        {/* Liens Guides (DofusDB toujours ; Dofensive / DPLN seulement si liés dans game-data) */}
                        {(() => {
                            const bossName = activeMonsterName ?? selected.bossName;
                            const dbLink = statsOf(selected)?.id
                                ? `https://dofusdb.fr/fr/database/monster/${statsOf(selected)!.id}`
                                : `https://dofusdb.fr/fr/database/monsters?search=${encodeURIComponent(bossName)}`;
                            const dofensiveUrl = selected.dofensiveUrl ?? null;
                            const dpnlUrl = selected.dpnlUrl ?? selected.dofuspourlesnoobsUrl ?? null;
                            return (
                                <div className="flex flex-wrap items-center gap-2">
                                    <a href={dbLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-surface text-foreground text-xs font-bold hover:bg-elevated hover:border-border-strong transition-colors">
                                        <img src="https://www.google.com/s2/favicons?domain=dofusdb.fr&sz=32" alt="" className="w-3.5 h-3.5 rounded-sm" loading="lazy" />
                                        DofusDB
                                    </a>
                                    {dofensiveUrl && (
                                        <a href={dofensiveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-surface text-foreground text-xs font-bold hover:bg-elevated hover:border-border-strong transition-colors">
                                            <img src="https://www.google.com/s2/favicons?domain=dofensive.com&sz=32" alt="" className="w-3.5 h-3.5 rounded-sm" loading="lazy" />
                                            Dofensive
                                        </a>
                                    )}
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
                                                ? "border-amber-500/50 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                                                : "border-amber-500/30 bg-amber-500/8 text-amber-400/80 hover:bg-amber-500/15 hover:text-amber-300 hover:border-amber-500/50"
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
                            );
                        })()}
                    </div>

                    {/* 1. Résistances & Vitalité (regroupés et rapprochés, sans vide géant) */}
                    {(() => {
                        const targetKey = activeMonsterName && selected ? `${selected.id}::${activeMonsterName}` : selected?.id;
                        const isLoadingCurrent = targetKey ? loadingStatsByBoss[targetKey] : false;
                        const currentStats = statsOf(selected);

                        if (isLoadingCurrent && !currentStats) {
                            return (
                                <div className="flex items-center justify-center p-6 rounded-2xl bg-surface border border-border gap-3 text-muted-foreground">
                                    <Loader2 className="w-5 h-5 animate-spin text-warning" />
                                    <span className="text-xs font-bold">Chargement des caractéristiques de {activeMonsterName ?? selected.bossName}…</span>
                                </div>
                            );
                        }

                        const grades = currentStats?.grades;
                        const gradeIdx = activeGradeIndex ?? (grades ? grades.length - 1 : 0);
                        const g = grades && grades.length > 0 ? grades[gradeIdx] : null;
                        const resists = g?.resists || {};

                        return (
                            <div className="space-y-2">
                                {/* Barre de Vitalité & Résistances rapprochées */}
                                <div className="flex flex-wrap items-center gap-2 sm:gap-3 py-2 px-1 border-y border-border/40 my-1">
                                    {/* PV / PA / PM */}
                                    <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                                        {/* PV */}
                                        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-surface border border-border/70" title="Points de Vie">
                                            <img src="/assets/module-succes/vitalite.png" alt="PV" className="w-4 h-4 object-contain" />
                                            <span className="text-sm font-bold text-foreground tabular-nums">
                                                {g ? g.lifePoints?.toLocaleString("fr-FR") : "-"}
                                            </span>
                                            <span className="text-[11px] font-bold text-muted-foreground">PV</span>
                                        </div>

                                        {/* PA */}
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-info/10 border border-info/20" title="Points d'Action">
                                            <span className="text-sm font-bold text-info tabular-nums">
                                                {g?.actionPoints ?? "-"}
                                            </span>
                                            <span className="text-[11px] font-bold text-info/80">PA</span>
                                        </div>

                                        {/* PM */}
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-success/10 border border-success/20" title="Points de Mouvement">
                                            <span className="text-sm font-bold text-success tabular-nums">
                                                {g?.movementPoints ?? "-"}
                                            </span>
                                            <span className="text-[11px] font-bold text-success/80">PM</span>
                                        </div>
                                    </div>

                                    {/* Séparateur vertical */}
                                    <div className="hidden sm:block h-5 w-px bg-border/80 mx-0.5" />

                                    {/* Résistances élémentaires 5 colonnes */}
                                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface/70 border border-border/60" title="Résistance Neutre">
                                            <img src="/assets/module-succes/neutre.png" alt="Neutre" className="w-4 h-4 object-contain" />
                                            <b className="text-sm font-bold text-foreground tabular-nums">{resists.neutral ?? 0}%</b>
                                            <span className="text-[11px] font-bold text-muted-foreground hidden sm:inline">Neutre</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-warning/10 border border-warning/20" title="Résistance Terre">
                                            <img src="/assets/module-succes/terre.png" alt="Terre" className="w-4 h-4 object-contain" />
                                            <b className="text-sm font-bold text-warning tabular-nums">{resists.earth ?? 0}%</b>
                                            <span className="text-[11px] font-bold text-warning/80 hidden sm:inline">Terre</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-danger/10 border border-danger/20" title="Résistance Feu">
                                            <img src="/assets/module-succes/Intelligence.png" alt="Feu" className="w-4 h-4 object-contain" />
                                            <b className="text-sm font-bold text-danger tabular-nums">{resists.fire ?? 0}%</b>
                                            <span className="text-[11px] font-bold text-danger/80 hidden sm:inline">Feu</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-info/10 border border-info/20" title="Résistance Eau">
                                            <img src="/assets/module-succes/eau.png" alt="Eau" className="w-4 h-4 object-contain" />
                                            <b className="text-sm font-bold text-info tabular-nums">{resists.water ?? 0}%</b>
                                            <span className="text-[11px] font-bold text-info/80 hidden sm:inline">Eau</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-success/10 border border-success/20" title="Résistance Air">
                                            <img src="/assets/module-succes/Agility.png" alt="Air" className="w-4 h-4 object-contain" />
                                            <b className="text-sm font-bold text-success tabular-nums">{resists.air ?? 0}%</b>
                                            <span className="text-[11px] font-bold text-success/80 hidden sm:inline">Air</span>
                                        </div>
                                    </div>

                                    {/* Tag de grade actif avec raccourci vers l'onglet Grades */}
                                    {grades && grades.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => setDetailTab("grades")}
                                            className="ml-auto px-2 py-1 rounded-lg bg-warning/10 border border-warning/25 text-warning text-[11px] font-bold hover:bg-warning/20 transition-colors flex items-center gap-1"
                                            title="Ouvrir l'onglet des grades & paliers"
                                        >
                                            <Flame className="w-3 h-3" />
                                            {grades.length === 5 ? `Butin ${4 + gradeIdx}` : `Grade ${1 + gradeIdx}`}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {/* 3. Onglets secondaires épurés avec sous-onglets Grades & Monstres de salle */}
                    {(() => {
                        const roomMonsters = selected && familyByDungeon[selected.id]?.monsters ? familyByDungeon[selected.id].monsters : [];
                        const hasRoomMonsters = roomMonsters.length > 1;
                        const currentStats = statsOf(selected);
                        const grades = currentStats?.grades;

                        const tabs = [
                            { id: "sorts", label: "Sorts du Boss", icon: Zap },
                            { id: "overview", label: "Sorts Détaillés", icon: Swords },
                            { id: "sim", label: "Simulation Tactique", icon: Target },
                            ...(grades && grades.length > 1 ? [{ id: "grades", label: `Grades & Paliers (${grades.length})`, icon: Flame }] : []),
                            { id: "loot", label: "Butin & Drops", icon: Gem },
                            ...(hasRoomMonsters ? [{ id: "family", label: `Monstres de la salle (${roomMonsters.length})`, icon: Users }] : []),
                        ];

                        return (
                            <div className="flex items-center gap-1.5 p-1 bg-surface border border-border rounded-xl overflow-x-auto no-scrollbar">
                                {tabs.map((tab) => {
                                    const Icon = tab.icon;
                                    const isActive = detailTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setDetailTab(tab.id as any)}
                                            className={cn(
                                                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap",
                                                isActive
                                                    ? "bg-warning/15 text-warning border border-warning/30"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-elevated/50"
                                            )}
                                        >
                                            <Icon className={cn("w-3.5 h-3.5", isActive ? "text-warning" : "text-muted-foreground")} />
                                            <span>{tab.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })()}

                    {/* Onglet dédié : Grades & Paliers de Butin */}
                    {detailTab === "grades" && (
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                                <Flame className="w-4 h-4 text-warning" /> Paliers de Grades & Caractéristiques de Combat
                            </h4>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <Info className="w-3.5 h-3.5" /> Les caractéristiques ci-dessous varient selon le grade sélectionné.
                            </p>
                            {(() => {
                                const grades = statsOf(selected)?.grades || [];
                                const is5Grades = grades.length === 5;
                                const activeIdx = activeGradeIndex ?? (grades.length - 1);

                                return (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                        {grades.map((gr, idx) => {
                                            const isActive = activeIdx === idx;
                                            const label = is5Grades ? `Butin ${4 + idx}` : `Grade ${idx + 1}`;
                                            const r = gr.resists || {};

                                            return (
                                                <div
                                                    key={idx}
                                                    className={cn(
                                                        "p-3.5 rounded-2xl border transition-colors flex flex-col justify-between space-y-3",
                                                        isActive
                                                            ? "border-warning/50 bg-warning/10"
                                                            : "border-border bg-surface"
                                                    )}
                                                >
                                                    <div>
                                                        <div className="flex items-center justify-between gap-1 mb-2">
                                                            <span className="text-sm font-bold text-foreground">{label}</span>
                                                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-background border border-border text-muted-foreground">
                                                                Niv. {gr.level}
                                                            </span>
                                                        </div>

                                                        {/* Stats vitaux */}
                                                        <div className="space-y-1 text-xs">
                                                            <div className="flex items-center justify-between text-muted-foreground">
                                                                <span>PV :</span>
                                                                <strong className="text-foreground tabular-nums text-right">{gr.lifePoints?.toLocaleString("fr-FR")}</strong>
                                                            </div>
                                                            <div className="flex items-center justify-between text-muted-foreground">
                                                                <span>PA / PM :</span>
                                                                <strong className="text-foreground tabular-nums text-right">{gr.actionPoints} / {gr.movementPoints}</strong>
                                                            </div>
                                                        </div>

                                                        {/* Résistances élémentaires du grade */}
                                                        <div className="grid grid-cols-5 gap-1 mt-2.5 pt-2 border-t border-border/60 text-center text-[11px] font-bold tabular-nums">
                                                            <span title="Neutre" className="text-muted-foreground">{r.neutral ?? 0}%</span>
                                                            <span title="Terre" className="text-warning">{r.earth ?? 0}%</span>
                                                            <span title="Feu" className="text-danger">{r.fire ?? 0}%</span>
                                                            <span title="Eau" className="text-info">{r.water ?? 0}%</span>
                                                            <span title="Air" className="text-success">{r.air ?? 0}%</span>
                                                        </div>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setActiveGradeIndex(idx);
                                                        }}
                                                        className={cn(
                                                            "w-full py-1.5 rounded-xl text-xs font-bold transition-colors",
                                                            isActive
                                                                ? "bg-warning text-warning-foreground"
                                                                : "bg-surface border border-border text-muted-foreground hover:text-foreground hover:bg-elevated"
                                                        )}
                                                    >
                                                        {isActive ? "✓ Grade Actif" : "Sélectionner"}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Onglet dédié : Monstres de la salle */}
                    {detailTab === "family" && (
                        <div className="space-y-3">
                            <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                                <Users className="w-4 h-4 text-warning" /> Monstres accompagnateurs de la salle
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {(familyByDungeon[selected.id]?.monsters || []).map((m) => {
                                    const isActive = (activeMonsterName ?? selected.bossName) === m.name;
                                    return (
                                        <div
                                            key={m.id}
                                            className={cn(
                                                "p-3 rounded-2xl border transition-colors flex flex-col justify-between space-y-2.5 group",
                                                isActive
                                                    ? "border-warning/50 bg-warning/10"
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
                                                    <p className={cn("text-xs font-bold truncate", isActive ? "text-warning font-bold" : "text-foreground")}>
                                                        {m.isBoss && "👑 "}{m.name}
                                                    </p>
                                                    <span className="text-[11px] text-muted-foreground block">
                                                        {m.isBoss ? "Boss principal" : "Monstre de salle"}
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
                                                    className="py-1 px-2.5 rounded-lg bg-warning/15 border border-warning/30 text-warning text-[11px] font-bold hover:bg-warning/25 transition-colors text-center flex items-center gap-1"
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
                    )}

                    {/* Onglet : Sorts du Boss (Mécaniques clés & sorts principaux) */}
                    {detailTab === "sorts" && (
                        <div className="space-y-4">
                            {(() => {
                                const spells = statsOf(selected)?.spells ?? [];
                                if (spells.length === 0) {
                                    return (
                                        <p className="text-xs text-muted-foreground py-4 text-center">
                                            Aucun sort répertorié pour cette entité.
                                        </p>
                                    );
                                }
                                return (
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2 mb-4">
                                            <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                                                <Zap className="w-4 h-4 text-warning" /> Mécaniques clés
                                            </h4>
                                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-warning/10 border border-warning/25 text-warning">
                                                {spells.length} sorts à anticiper
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            {spells.slice(0, 6).map((spell) => (
                                                <div
                                                    key={spell.id}
                                                    className="rounded-2xl bg-surface border border-border p-3.5 flex flex-col justify-between"
                                                >
                                                    <div>
                                                        <div className="flex items-center gap-2.5 mb-2">
                                                            <div className="w-8 h-8 rounded-xl bg-background border border-border flex items-center justify-center p-0.5 shrink-0 overflow-hidden">
                                                                {spell.imageUrl ? (
                                                                    <MonsterImage src={spell.imageUrl} alt={spell.name} assetType="spells" assetId={spell.id} className="w-full h-full object-contain" />
                                                                ) : (
                                                                    <Zap className="w-3.5 h-3.5 text-warning" />
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <h5 className="text-sm font-bold text-foreground truncate">{spell.name}</h5>
                                                                <span className="text-[11px] font-bold text-muted-foreground block">
                                                                    {spell.apCost || 0} PA · {spell.minRange === spell.range ? `${spell.range} PO` : `${spell.minRange ?? 0}-${spell.range ?? 0} PO`}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                                                            {(() => {
                                                                const primaryEffect = spell.effectDetails && spell.effectDetails.length > 0
                                                                    ? spell.effectDetails[0].label
                                                                    : Array.isArray(spell.effects) && spell.effects.length > 0
                                                                        ? spell.effects[0]
                                                                        : spell.description || "Effet de combat.";
                                                                return primaryEffect;
                                                            })()}
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedSpellId(spell.id);
                                                            setDetailTab("sim");
                                                        }}
                                                        className="mt-3 text-xs font-bold text-warning hover:text-warning/80 self-start transition-colors flex items-center gap-1"
                                                    >
                                                        <Target className="w-3.5 h-3.5" /> Voir la portée
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Onglet : Sorts détaillés */}
                    {detailTab === "overview" && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Zap className="w-4 h-4 text-warning" />
                                <h4 className="text-sm font-bold text-foreground">
                                    Tous les sorts ({statsOf(selected)?.spells?.length ?? 0})
                                </h4>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                                {(statsOf(selected)?.spells ?? []).map((spell) => (
                                    <div
                                        key={spell.id}
                                        className="p-3.5 rounded-xl bg-surface border border-border flex flex-col justify-start text-left space-y-2.5 transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2.5">
                                                {spell.imageUrl ? (
                                                    <MonsterImage src={spell.imageUrl} alt={spell.name} assetType="spells" assetId={spell.id} className="w-8 h-8 object-contain rounded-lg bg-background border border-border p-0.5" />
                                                ) : (
                                                    <Zap className="w-4 h-4 text-warning" />
                                                )}
                                                <div>
                                                    <span className="flex items-center gap-1.5">
                                                        <span className="block text-sm font-bold text-foreground">{spell.name}</span>
                                                        {spell.grade !== undefined && (
                                                            <span className="text-[11px] font-bold text-muted-foreground bg-background border border-border px-1 py-px rounded">
                                                                Niv. {spell.grade}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="text-[11px] font-bold text-muted-foreground">
                                                        {spell.apCost || 0} PA · {spell.minRange === spell.range ? `${spell.range} PO` : `${spell.minRange ?? 0}-${spell.range ?? 0} PO`}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedSpellId(spell.id);
                                                    setDetailTab("sim");
                                                }}
                                                className="text-[11px] font-bold px-2 py-1 rounded-md bg-warning/10 border border-warning/20 text-warning hover:bg-warning/20 transition-colors shrink-0"
                                            >
                                                Simuler
                                            </button>
                                        </div>
                                        {(() => {
                                            const details =
                                                spell.effectDetails && spell.effectDetails.length > 0
                                                    ? spell.effectDetails
                                                    : (Array.isArray(spell.effects) ? spell.effects.slice(0, 20).map((e) => ({ label: e, duration: null, triggers: [] as string[], masks: [] as string[] })) : []);
                                            const hasDetails = details.length > 0;
                                            const criticals = Array.isArray(spell.criticalEffects) ? spell.criticalEffects : [];
                                            const hasCritical = criticals.length > 0;
                                            const hasAny = hasDetails || !!spell.description || hasCritical;
                                            if (!hasAny) return null;
                                            return (
                                                <div className="space-y-2 text-[11px] leading-relaxed">
                                                    {spell.description && (
                                                        <p className="text-muted-foreground">{spell.description}</p>
                                                    )}
                                                    {hasDetails && (
                                                        <div className="space-y-1">
                                                            <span className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Effet principal</span>
                                                            <ul className="space-y-1">
                                                                {details.map((det, i) => (
                                                                    <li key={i} className="text-muted-foreground">
                                                                        <span className="text-foreground font-semibold">
                                                                            {det.label}
                                                                            {det.duration ? ` (${det.duration})` : ""}
                                                                        </span>
                                                                        {det.masks.length > 0 && <span className="block text-muted-foreground/80">{det.masks.join(" · ")}</span>}
                                                                        {det.triggers.length > 0 && (
                                                                            <span className="block text-muted-foreground/80 flex items-center gap-1">
                                                                                <Zap className="w-3 h-3 text-warning shrink-0" />
                                                                                {det.triggers.join(" · ")}
                                                                            </span>
                                                                        )}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                    {spell.hasCriticalEffects === false ? (
                                                        <p className="text-muted-foreground/80">Effets critiques : aucun.</p>
                                                    ) : hasCritical ? (
                                                        <div className="space-y-0.5 pt-1 border-t border-border/60">
                                                            <span className="block text-[11px] font-bold uppercase tracking-wide text-warning">Effets critiques</span>
                                                            <ul className="space-y-0.5">
                                                                {criticals.map((ce, k) => (
                                                                    <li key={k} className="text-muted-foreground">• {ce}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Onglet : Simulation */}
                    {detailTab === "sim" && (
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Target className="w-4 h-4 text-warning" />
                                    <h4 className="text-sm font-bold text-foreground">
                                        Simulation & Portée des Sorts
                                    </h4>
                                </div>

                                {familyByDungeon[selected.id]?.monsters && familyByDungeon[selected.id].monsters.length > 1 && (
                                    <div className="flex items-center gap-1 bg-background/60 border border-border/80 p-1 rounded-xl overflow-x-auto max-w-full">
                                        <span className="text-[11px] font-bold text-muted-foreground px-1.5 hidden sm:inline">
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
                                                        "flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-bold transition-colors shrink-0",
                                                        isActive
                                                            ? "bg-warning/20 border border-warning/40 text-warning font-bold"
                                                            : "bg-surface border border-border text-muted-foreground hover:text-foreground hover:bg-elevated"
                                                    )}
                                                >
                                                    {m.imageUrl && (
                                                        <MonsterImage src={m.imageUrl} alt={m.name} monsterId={m.id} className="w-3 h-3 object-contain rounded-xs" />
                                                    )}
                                                    {m.isBoss && "👑 "}
                                                    {m.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

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
                            />
                        </div>
                    )}

                    {/* Onglet : Butin */}
                    {detailTab === "loot" && (
                        <div>
                            <h4 className="text-sm font-bold text-info mb-3 flex items-center gap-1.5">
                                <Brain className="w-4 h-4" /> Butins notables & Taux de drop
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
                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background border border-border hover:border-warning/50 text-foreground transition-colors group"
                                    title="Cliquer pour copier la commande /travel"
                                >
                                    <MapPin className="w-3.5 h-3.5 text-warning shrink-0" />
                                    <span>
                                        Entrée du donjon : <strong className="text-warning">[{coords.x}, {coords.y}]</strong>
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
                                    <a
                                        href={`https://dofusdb.fr/fr/database/item/${selectedDrop.objectId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-surface text-xs font-bold text-foreground hover:bg-elevated hover:border-border-strong transition-colors"
                                    >
                                        <img src="https://www.google.com/s2/favicons?domain=dofusdb.fr&sz=32" alt="" className="w-3.5 h-3.5 rounded-sm" loading="lazy" />
                                        DofusDB
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
