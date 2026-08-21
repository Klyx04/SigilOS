"use client";

import { useEffect, useMemo, useState } from "react";
import { Brain, Compass, ExternalLink, Flame, Loader2, MapPin, ScrollText, Search, Shield, Swords, Target, Users, X, Zap } from "lucide-react";
import { getDungeonsWithAchievements, getDungeonMonsters, getMonsterStats } from "@/server/actions/game-data-actions";
import { getLinkedQuests } from "@/server/actions/dofus-quest-actions";
import { mergeDofensiveSpells } from "@/lib/dofensive-spells";
import {
    getBossDofensiveSpells,
    getDofensiveDungeonForBoss,
    type DofensiveDungeonInfo,
} from "@/server/actions/dofensive-actions";
import { cn } from "@/lib/utils";
import { SpellData, SpellRangeGrid } from "./SpellRangeGrid";

/**
 * Image de monstre avec fallback stylisé (icône Swords) si l'illustration DofusDB
 * est absente OU renvoie un 404 (image cassée). Évite les icônes brisées.
 */
function MonsterImage({
    src,
    alt = "",
    className = "",
}: {
    src?: string | null;
    alt?: string;
    className?: string;
}) {
    const [failed, setFailed] = useState(false);
    if (!src || failed) {
        return (
            <span className={cn("inline-flex items-center justify-center text-muted-foreground/40 bg-background", className)}>
                <Swords className="w-1/2 h-1/2 max-w-6 max-h-6" />
            </span>
        );
    }
    return (
        <img
            src={src}
            alt={alt}
            className={className}
            loading="lazy"
            onError={() => setFailed(true)}
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
    const [dungeons, setDungeons] = useState<BossDungeon[]>([]);
    const [statsByBoss, setStatsByBoss] = useState<Record<string, MonsterStats>>({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<BossDungeon | null>(null);
    const [selectedDrop, setSelectedDrop] = useState<any>(null);
    const [selectedSpellId, setSelectedSpellId] = useState<number | undefined>(undefined);
    const [familyByDungeon, setFamilyByDungeon] = useState<Record<string, DungeonFamily>>({});
    const [activeMonsterName, setActiveMonsterName] = useState<string | null>(null);
    const [activeGradeIndex, setActiveGradeIndex] = useState<number | null>(null);
    const [detailTab, setDetailTab] = useState<"overview" | "sim" | "loot" | "goals">("overview");
    const [linkedQuestsByDungeon, setLinkedQuestsByDungeon] = useState<Record<string, LinkedQuestsData>>({});
    // Maps du donjon (salles réelles) récupérées chez Dofensive pour le boss courant.
    const [dungeonMapsByBoss, setDungeonMapsByBoss] = useState<Record<string, DofensiveDungeonInfo | null>>({});

    // Charger les donjons → pour chacun, charger la fiche monstre en arrière-plan
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
                    withBoss.forEach((d: BossDungeon) => {
                        getMonsterStats(d.bossName, d.name)
                            .then(async (statsRes) => {
                                if (cancelled) return;
                                if (statsRes.success && statsRes.data) {
                                    let data = statsRes.data;
                                    const dRes = await getBossDofensiveSpells(d.bossName, d.name);
                                    if (!cancelled && dRes.success && dRes.data) {
                                        data = { ...data, spells: mergeDofensiveSpells(data.spells ?? [], dRes.data) };
                                    }
                                    if (!cancelled) setStatsByBoss((prev) => ({ ...prev, [d.id]: data }));
                                }
                            })
                            .catch(() => {});
                    });
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

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
        getDofensiveDungeonForBoss(boss)
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
        getBossDofensiveSpells(activeMonsterName ?? d.bossName, d.name, gradeNumber)
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
            setDetailTab("overview");
            setSelectedSpellId(undefined);
            return;
        }
        setActiveMonsterName(m.name);
        setSelectedSpellId(undefined);
        const key = `${d.id}::${m.name}`;
        if (!statsByBoss[key]) {
            getMonsterStats(m.name, d.name).then(async (res) => {
                if (res.success && res.data) {
                    let data = res.data;
                    const dRes = await getBossDofensiveSpells(m.name, d.name);
                    if (dRes.success && dRes.data) {
                        data = { ...data, spells: mergeDofensiveSpells(data.spells ?? [], dRes.data) };
                    }
                    setStatsByBoss((prev) => ({ ...prev, [key]: data }));
                }
            });
        }
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
                <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher un boss ou un donjon…"
                        className="w-full h-11 pl-9 pr-8 rounded-xl bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-warning/40"
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
                    {filtered.length} boss répertoriés
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
                                    "flex flex-col rounded-2xl border overflow-hidden transition-all text-left group",
                                    activeBossId === d.id
                                        ? "border-warning/50 bg-elevated/90 ring-2 ring-warning/30"
                                        : "border-border bg-surface/70 hover:bg-elevated/70 hover:border-white/20"
                                )}
                            >
                                <div className="relative h-24 bg-background flex items-center justify-center p-2 overflow-hidden">
                                    <MonsterImage
                                        src={stats?.imageUrl ?? d.imageUrl}
                                        alt={d.bossName}
                                        className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                                    />
                                    <div className="absolute top-1.5 left-1.5 rounded-md bg-black/70 backdrop-blur px-1.5 py-0.5 text-[10px] font-black text-white border border-white/10">
                                        LVL {d.level}
                                    </div>
                                </div>
                                <div className="p-3 border-t border-border">
                                    <p className="text-xs font-black text-foreground leading-tight truncate group-hover:text-warning transition-colors">{d.bossName}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{d.name}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            ))}

            {selected && (
                <div className="bg-surface/90 border border-border rounded-2xl p-5 sm:p-6 space-y-6 shadow-2xl backdrop-blur-xl" data-tour="succes-tracker-detail">
                    {/* Header Boss */}
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-5">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-background border border-border flex items-center justify-center p-1.5 shrink-0 overflow-hidden shadow-inner">
                                <MonsterImage
                                    src={statsOf(selected)?.imageUrl}
                                    alt={selected.bossName}
                                    className="max-h-full max-w-full object-contain"
                                />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-black text-foreground">{activeMonsterName ?? selected.bossName}</h3>
                                    <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-warning/10 border border-warning/20 text-warning">
                                        Niveau {selected.level}
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                                    <Compass className="w-3.5 h-3.5 text-teal-400" />
                                    Donjon : <strong className="text-zinc-200">{selected.name}</strong>
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
                                    <a href={dbLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-zinc-900 text-zinc-200 text-xs font-bold hover:bg-zinc-800 hover:text-white transition-all shadow-sm">
                                        <img src="https://www.google.com/s2/favicons?domain=dofusdb.fr&sz=32" alt="" className="w-3.5 h-3.5 rounded-sm" loading="lazy" />
                                        DofusDB
                                    </a>
                                    {dofensiveUrl && (
                                        <a href={dofensiveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-zinc-900 text-zinc-200 text-xs font-bold hover:bg-zinc-800 hover:text-white transition-all shadow-sm">
                                            <img src="https://www.google.com/s2/favicons?domain=dofensive.com&sz=32" alt="" className="w-3.5 h-3.5 rounded-sm" loading="lazy" />
                                            Dofensive
                                        </a>
                                    )}
                                    {dpnlUrl && (
                                        <a href={dpnlUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-zinc-900 text-zinc-200 text-xs font-bold hover:bg-zinc-800 hover:text-white transition-all shadow-sm">
                                            <img src="https://www.google.com/s2/favicons?domain=dofuspourlesnoobs.com&sz=32" alt="" className="w-3.5 h-3.5 rounded-sm" loading="lazy" />
                                            DPLN
                                        </a>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelected(null);
                                            setSelectedSpellId(undefined);
                                        }}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-surface border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-elevated transition-all"
                                    >
                                        <X className="w-3.5 h-3.5" /> Fermer
                                    </button>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Famille du Boss (accompagnateurs de la salle) */}
                    {familyByDungeon[selected.id] && familyByDungeon[selected.id].monsters.length > 1 && (
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-accent" /> Monstres de la salle (famille du boss)
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {familyByDungeon[selected.id].monsters.map((m) => {
                                    const isActive = (activeMonsterName ?? selected.bossName) === m.name;
                                    return (
                                        <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => selectMonster(selected, m)}
                                            className={cn(
                                                "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all",
                                                isActive
                                                    ? "border-warning/50 bg-warning/10 text-warning ring-2 ring-warning/20"
                                                    : "border-border bg-surface/70 text-muted-foreground hover:text-foreground hover:border-white/20"
                                            )}
                                        >
                                            {m.imageUrl ? (
                                                <MonsterImage src={m.imageUrl} alt={m.name} className="w-5 h-5 object-contain rounded-sm" />
                                            ) : (
                                                <Swords className="w-4 h-4" />
                                            )}
                                            {m.isBoss && "👑 "}
                                            {m.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Chargement de la fiche d'un monstre de la famille */}
                    {activeMonsterName && !statsOf(selected) && (
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-warning" /> Chargement de la fiche de {activeMonsterName}…
                        </p>
                    )}

                    {/* 1. Résistances & Vital (TOUJOURS VISIBLES, 5 colonnes) */}
                    {(() => {
                        const grades = statsOf(selected)?.grades;
                        const gradeIdx = activeGradeIndex ?? (grades ? grades.length - 1 : 0);
                        const g = grades && grades.length > 0 ? grades[gradeIdx] : null;
                        const resists = g?.resists || {};

                        return (
                            <div className="space-y-3">
                                {grades && grades.length > 1 && (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-[11px] font-bold text-muted-foreground mr-1">Grade :</span>
                                        {grades.map((gr, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => setActiveGradeIndex(idx)}
                                                className={cn(
                                                    "px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all",
                                                    (activeGradeIndex ?? grades.length - 1) === idx
                                                        ? "border-warning/50 bg-warning/10 text-warning"
                                                        : "border-border bg-surface/70 text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                Niv {gr.level}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                                    {/* PV / PA / PM */}
                                    <div className="lg:col-span-4 grid grid-cols-3 gap-2 rounded-2xl bg-background/80 border border-border p-3">
                                        <div className="text-center border-r border-border/60 pr-1">
                                            <b className="text-base font-black text-foreground tabular-nums block">{g ? g.lifePoints?.toLocaleString("fr-FR") : "-"}</b>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5 block">PV</span>
                                        </div>
                                        <div className="text-center border-r border-border/60 pr-1">
                                            <b className="text-base font-black text-blue-400 tabular-nums block">{g?.actionPoints ?? "-"}</b>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5 block">PA</span>
                                        </div>
                                        <div className="text-center">
                                            <b className="text-base font-black text-emerald-400 tabular-nums block">{g?.movementPoints ?? "-"}</b>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5 block">PM</span>
                                        </div>
                                    </div>

                                    {/* Résistances élémentaires 5 colonnes */}
                                    <div className="lg:col-span-8 grid grid-cols-5 gap-2 rounded-2xl bg-background/80 border border-border p-3 text-center">
                                        <div className="rounded-xl bg-zinc-900/80 border border-white/5 p-2">
                                            <span className="text-[10px] text-zinc-400 block font-bold">Neutre</span>
                                            <b className="text-sm font-black text-zinc-200 mt-0.5 block">{resists.neutral ?? 0}%</b>
                                        </div>
                                        <div className="rounded-xl bg-amber-950/30 border border-amber-500/20 p-2">
                                            <span className="text-[10px] text-amber-400 block font-bold">Terre</span>
                                            <b className="text-sm font-black text-amber-300 mt-0.5 block">{resists.earth ?? 0}%</b>
                                        </div>
                                        <div className="rounded-xl bg-red-950/30 border border-red-500/20 p-2">
                                            <span className="text-[10px] text-red-400 block font-bold">Feu</span>
                                            <b className="text-sm font-black text-red-300 mt-0.5 block">{resists.fire ?? 0}%</b>
                                        </div>
                                        <div className="rounded-xl bg-blue-950/30 border border-blue-500/20 p-2">
                                            <span className="text-[10px] text-blue-400 block font-bold">Eau</span>
                                            <b className="text-sm font-black text-blue-300 mt-0.5 block">{resists.water ?? 0}%</b>
                                        </div>
                                        <div className="rounded-xl bg-emerald-950/30 border border-emerald-500/20 p-2">
                                            <span className="text-[10px] text-emerald-400 block font-bold">Air</span>
                                            <b className="text-sm font-black text-emerald-300 mt-0.5 block">{resists.air ?? 0}%</b>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* 2. Mécaniques clés à retenir (3 cartes synthétiques) */}
                    {(() => {
                        const spells = statsOf(selected)?.spells ?? [];
                        const topSpells = spells.slice(0, 3);
                        if (topSpells.length === 0) return null;

                        return (
                            <div>
                                <h4 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-2.5 flex items-center gap-1.5">
                                    <Zap className="w-3.5 h-3.5 text-warning" /> Mécaniques clés du combat
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {topSpells.map((spell) => (
                                        <div
                                            key={spell.id}
                                            className="rounded-2xl bg-surface border border-border p-3.5 flex flex-col justify-between"
                                        >
                                            <div>
                                                <div className="flex items-center gap-2.5 mb-2">
                                                    <div className="w-7 h-7 rounded-lg bg-background border border-border flex items-center justify-center p-0.5 shrink-0 overflow-hidden">
                                                        {spell.imageUrl ? (
                                                            <MonsterImage src={spell.imageUrl} alt={spell.name} className="w-full h-full object-contain" />
                                                        ) : (
                                                            <Zap className="w-3.5 h-3.5 text-warning" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h5 className="text-xs font-black text-foreground truncate">{spell.name}</h5>
                                                        <span className="text-[10px] font-bold text-muted-foreground block">
                                                            {spell.apCost || 0} PA · {spell.minRange === spell.range ? `${spell.range} PO` : `${spell.minRange ?? 0}-${spell.range ?? 0} PO`}
                                                        </span>
                                                    </div>
                                                </div>
                                                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                                    {Array.isArray(spell.effects) && spell.effects.length > 0
                                                        ? spell.effects[0]
                                                        : spell.description || "Effet de combat."}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedSpellId(spell.id);
                                                    setDetailTab("sim");
                                                }}
                                                className="mt-3 text-[11px] font-black text-warning hover:text-warning/80 self-start transition-colors"
                                            >
                                                Voir la portée →
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    {/* 3. Onglets secondaires */}
                    <div className="flex gap-1 border-b border-border pb-1 overflow-x-auto pt-2">
                        {(["sim", "overview", "loot", "goals"] as const).map((tk) => (
                            <button
                                key={tk}
                                type="button"
                                onClick={() => setDetailTab(tk)}
                                className={cn(
                                    "px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all whitespace-nowrap",
                                    detailTab === tk
                                        ? "bg-warning/10 text-warning border border-warning/30"
                                        : "text-muted-foreground hover:text-foreground border border-transparent"
                                )}
                            >
                                {tk === "sim"
                                    ? "Simulation Tactique"
                                    : tk === "overview"
                                    ? "Sorts détaillés"
                                    : tk === "loot"
                                    ? "Butin"
                                    : "Succès & quêtes"}
                            </button>
                        ))}
                    </div>

                    {/* Onglet : Sorts détaillés */}
                    {detailTab === "overview" && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Zap className="w-4 h-4 text-amber-400" />
                                <h4 className="text-xs font-black uppercase tracking-widest text-foreground">
                                    Tous les sorts ({statsOf(selected)?.spells?.length ?? 0})
                                </h4>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {(statsOf(selected)?.spells ?? []).map((spell) => (
                                    <div
                                        key={spell.id}
                                        className="p-3 rounded-xl bg-surface border border-border flex flex-col justify-between text-left space-y-2"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2.5">
                                                {spell.imageUrl ? (
                                                    <MonsterImage src={spell.imageUrl} alt={spell.name} className="w-8 h-8 object-contain rounded-lg bg-background border border-border p-0.5" />
                                                ) : (
                                                    <Zap className="w-4 h-4 text-amber-400" />
                                                )}
                                                <div>
                                                    <span className="block text-xs font-black text-foreground">{spell.name}</span>
                                                    <span className="text-[10px] font-bold text-blue-400">
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
                                                className="text-[10px] font-bold px-2 py-1 rounded-md bg-warning/10 border border-warning/20 text-warning hover:bg-warning/20 transition-all shrink-0"
                                            >
                                                Simuler
                                            </button>
                                        </div>
                                        {Array.isArray(spell.effects) && spell.effects.length > 0 ? (
                                            <ul className="text-[11px] text-zinc-300 space-y-1">
                                                {spell.effects.map((eff, i) => (
                                                    <li key={i} className="text-muted-foreground">• {eff}</li>
                                                ))}
                                            </ul>
                                        ) : spell.description ? (
                                            <p className="text-[11px] text-muted-foreground">{spell.description}</p>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Onglet : Simulation */}
                    {detailTab === "sim" && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Target className="w-4 h-4 text-amber-400" />
                                <h4 className="text-xs font-black uppercase tracking-widest text-foreground">
                                    Simulation & Portée des Sorts
                                </h4>
                            </div>
                            <SpellRangeGrid
                                spells={statsOf(selected)?.spells ?? []}
                                activeSpellId={selectedSpellId}
                                onSelectSpell={(spell) => setSelectedSpellId(spell.id)}
                                bossName={activeMonsterName ?? selected.bossName}
                                bossImageUrl={statsOf(selected)?.imageUrl}
                                dungeonMaps={dungeonMapsByBoss[activeMonsterName ?? selected.bossName]?.maps}
                                dungeonName={dungeonMapsByBoss[activeMonsterName ?? selected.bossName]?.dungeonName}
                                grades={statsOf(selected)?.grades?.map((g) => ({ level: g.level })) ?? []}
                                activeGradeIndex={activeGradeIndex ?? ((statsOf(selected)?.grades?.length ?? 1) - 1)}
                                onGradeChange={(idx) => setActiveGradeIndex(idx)}
                            />
                        </div>
                    )}

                    {/* Onglet : Butin */}
                    {detailTab === "loot" && (
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-widest text-info mb-2.5 flex items-center gap-1.5">
                                <Brain className="w-3.5 h-3.5" /> Butins notables & Taux de drop
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {(statsOf(selected)?.drops ?? []).map((drop, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedDrop(drop)}
                                        title={`${drop.name} — ${drop.percent}%`}
                                        className="w-10 h-10 rounded-xl bg-surface border border-border p-1.5 hover:bg-elevated hover:border-info/40 transition-all shadow-sm"
                                    >
                                        <MonsterImage src={drop.imageUrl} alt={drop.name} className="w-full h-full object-contain" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Onglet : Succès & quêtes */}
                    {detailTab === "goals" && (
                        <div className="space-y-4">
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                                    <ScrollText className="w-3.5 h-3.5 text-accent" /> Quêtes liées à ce donjon
                                </p>
                                {(() => {
                                    const data = linkedQuestsByDungeon[selected.id];
                                    if (data && data.quests.length === 0) {
                                        return <p className="text-xs text-muted-foreground">Aucune quête Dofus / Rush ne référence ce donjon pour l'instant.</p>;
                                    }
                                    return (
                                        <ul className="space-y-2">
                                            {(data?.quests ?? []).map((q) => {
                                                const statusBadge = q.myStatus === "COMPLETED" ? "bg-success/15 text-success border-success/30"
                                                    : q.myStatus === "IN_PROGRESS" ? "bg-warning/15 text-warning border-warning/30"
                                                    : q.myStatus === "SKIPPED" ? "bg-muted/20 text-muted-foreground border-border"
                                                    : "bg-muted/10 text-muted-foreground border-border";
                                                const statusLabel = q.myStatus === "COMPLETED" ? "Fait" : q.myStatus === "IN_PROGRESS" ? "En cours" : q.myStatus === "SKIPPED" ? "Passée" : "À faire";
                                                return (
                                                    <li key={q.id} className="flex items-center justify-between gap-3 text-xs bg-background border border-border p-2.5 rounded-xl">
                                                        <div className="min-w-0">
                                                            <span className="text-foreground font-bold truncate block">{q.name}</span>
                                                            <span className="text-[10px] text-muted-foreground">
                                                                {q.chainName && <span>{q.chainName}</span>}
                                                                {q.isRush && <span className="text-amber-400 font-bold ml-1.5">Rush</span>}
                                                                {q.isDungeon && <span className="text-info font-bold ml-1.5">Donjon</span>}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <span className="text-[10px] text-muted-foreground font-bold" title="Membres de la guilde ayant terminé cette quête">
                                                                ✔ {q.guildCompleted}/{q.memberCount}
                                                            </span>
                                                            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black ${statusBadge}`}>{statusLabel}</span>
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    );
                                })()}
                            </div>

                            {/* Rush Sylvestre en cours */}
                            {(() => {
                                const data = linkedQuestsByDungeon[selected.id];
                                if (!data || data.rushActive.length === 0) return null;
                                return (
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-widest text-amber-500/80 mb-2 flex items-center gap-1.5">
                                            <Flame className="w-3.5 h-3.5" /> Rush Sylvestre en cours ({data.rushActive.length})
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {data.rushActive.map((m, i) => (
                                                <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[11px] font-bold text-amber-300">
                                                    {m.pseudoDofus}
                                                    {m.dofusClass && <span className="text-[10px] text-amber-500/70">{m.dofusClass}</span>}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Coordonnées (toujours visibles) */}
                    {statsOf(selected)?.coordinates && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border">
                            <MapPin className="w-4 h-4 text-accent shrink-0" />
                            <span>
                                Entrée du donjon : <strong className="text-foreground">[{statsOf(selected)!.coordinates!.x}, {statsOf(selected)!.coordinates!.y}]</strong>
                                {statsOf(selected)!.coordinates!.worldMapId ? ` · Monde ${statsOf(selected)!.coordinates!.worldMapId}` : ""}
                            </span>
                        </div>
                    )}

                    {/* Drop modal */}
                    {selectedDrop && (
                        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedDrop(null)} />
                            <div className="relative bg-surface border border-border rounded-2xl p-6 w-full max-w-xs text-center shadow-2xl">
                                <div className="w-16 h-16 rounded-2xl bg-background border border-border p-2 mx-auto mb-3 shadow-inner">
                                    <MonsterImage src={selectedDrop.imageUrl} alt={selectedDrop.name} className="w-full h-full object-contain" />
                                </div>
                                <h3 className="text-sm font-black text-foreground">{selectedDrop.name}</h3>
                                <p className="text-xs text-info font-bold mt-1">
                                    Taux de drop : {selectedDrop.percentByGrade?.length
                                        ? `${Math.min(...selectedDrop.percentByGrade)} % – ${Math.max(...selectedDrop.percentByGrade)} % (grade 1-5)`
                                        : `${selectedDrop.percent}%`}
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
                                        className="flex-1 px-4 py-2 rounded-xl bg-info text-xs font-black text-foreground hover:bg-info/80 transition-colors"
                                    >
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
