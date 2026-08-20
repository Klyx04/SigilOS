"use client";

import { useEffect, useMemo, useState } from "react";
import { Brain, MapPin, Search, Swords, X, Zap } from "lucide-react";
import { getDungeonsWithAchievements, getMonsterStats } from "@/server/actions/game-data-actions";
import { cn } from "@/lib/utils";

interface BossDungeon {
    id: string;
    name: string;
    bossName: string;
    level: number;
    imageUrl?: string | null;
    dofensiveUrl?: string | null;
    achievements?: { id: string; points: number; challenge?: { name: string } }[];
}

interface MonsterStats {
    id?: number;
    name?: string;
    imageUrl?: string;
    coordinates?: { x: number; y: number; worldMapId?: number } | null;
    grades?: { level: number; lifePoints: number; actionPoints: number; movementPoints: number; resists?: Record<string, number> }[];
    drops?: { objectId: number; name: string; imageUrl: string; percent: number }[];
    spells?: { id: number; name: string; imageUrl?: string; description?: string }[];
}

/**
 * #176 — Fiches boss dans le module Succès (v2, sur ton retour).
 * La vraie fiche (drops, sorts, carte) est DÉPLACÉE ici depuis « Succès Commun » :
 * elle s'ouvre par boss via `getMonsterStats` (image réelle du monstre, grades,
 * sorts avec effets, drops cliquables, coordonnées). Fini les vignettes floues.
 */
export function SuccesBossGuide({ guildId }: { guildId: string }) {
    const [dungeons, setDungeons] = useState<BossDungeon[]>([]);
    const [statsByBoss, setStatsByBoss] = useState<Record<string, MonsterStats>>({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<BossDungeon | null>(null);
    const [selectedDrop, setSelectedDrop] = useState<any>(null);

    // 1. Charger les donjons → pour chacun, charger la fiche monstre en arrière-plan.
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
                            achievements: Array.isArray(d.achievements) ? d.achievements : [],
                        }));
                    setDungeons(withBoss);
                    withBoss.forEach((d: BossDungeon) => {
                        getMonsterStats(d.bossName, d.name)
                            .then((statsRes) => {
                                if (cancelled) return;
                                if (statsRes.success && statsRes.data) {
                                    setStatsByBoss((prev) => ({ ...prev, [d.id]: statsRes.data }));
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

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return dungeons;
        return dungeons.filter(
            (d) =>
                d.bossName.toLowerCase().includes(q) ||
                d.name.toLowerCase().includes(q)
        );
    }, [dungeons, search]);

    const statsOf = (d: BossDungeon): MonsterStats | undefined => statsByBoss[d.id];
    const bossUrl = (d: BossDungeon) =>
        `https://www.dofusdb.fr/fr/database/monsters?search=${encodeURIComponent(d.bossName)}`;

    // #176 — l'ID du boss sélectionné hors du narrowing `!selected` (TS) pour la grille.
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
                    {filtered.length} boss
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
                                        return;
                                    }
                                    setSelected(d);
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                                className={cn(
                                    "flex flex-col rounded-2xl border overflow-hidden transition-colors text-left",
                                    activeBossId === d.id
                                        ? "border-warning/50 bg-elevated/90"
                                        : "border-border bg-surface/70 hover:bg-elevated/70"
                                )}
                            >
                                <div className="relative h-24 bg-background flex items-center justify-center">
                                    {stats?.imageUrl ? (
                                        // Image RÉELLE du monstre (object-contain sur fond uni) — pas de screenshot flou.
                                        <img src={stats.imageUrl} alt={d.bossName} className="max-h-full max-w-full object-contain p-2" loading="lazy" />
                                    ) : d.imageUrl ? (
                                        <img src={d.imageUrl} alt={d.bossName} className="max-h-full max-w-full object-contain p-2" loading="lazy" />
                                    ) : (
                                        <Swords className="w-8 h-8 text-muted-foreground/30" />
                                    )}
                                    <div className="absolute top-1.5 left-1.5 rounded-md bg-black/60 backdrop-blur px-1.5 py-0.5 text-[10px] font-black text-white">
                                        LVL {d.level}
                                    </div>
                                </div>
                                <div className="p-3 border-t border-border">
                                    <p className="text-xs font-black text-foreground leading-tight truncate">{d.bossName}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{d.name}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            ))}

            {selected && (
                <div className="bg-surface/70 border border-border rounded-2xl p-5 space-y-5" data-tour="succes-tracker-detail">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                setSelected(null);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="lg:hidden inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground min-h-11 px-1"
                        >
                            <X className="w-4 h-4" /> Retour à la liste
                        </button>
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-xl bg-background border border-border flex items-center justify-center p-1.5 shrink-0">
                                {statsOf(selected)?.imageUrl ? (
                                    <img src={statsOf(selected)!.imageUrl} alt={selected.bossName} className="max-h-full max-w-full object-contain" />
                                ) : (
                                    <Swords className="w-6 h-6 text-muted-foreground/40" />
                                )}
                            </div>
                            <div>
                                <h3 className="text-base font-black text-foreground">{selected.bossName}</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Donjon : {selected.name} · Niveau {selected.level}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <a
                                href={bossUrl(selected)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-3.5 py-2.5 min-h-11 rounded-xl border border-border bg-surface text-foreground text-xs font-bold hover:bg-elevated transition-colors"
                            >
                                <img src="https://www.google.com/s2/favicons?domain=dofusdb.fr&sz=32" alt="" className="w-4 h-4 rounded-sm" loading="lazy" />
                                Sorts & fiche DofusDB
                            </a>
                            {selected.dofensiveUrl && (
                                <a
                                    href={selected.dofensiveUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-3.5 py-2.5 min-h-11 rounded-xl border border-border bg-surface text-foreground text-xs font-bold hover:bg-elevated transition-colors"
                                >
                                    <img src="https://www.google.com/s2/favicons?domain=dofensive.com&sz=32" alt="" className="w-4 h-4 rounded-sm" loading="lazy" />
                                    Guide Dofensive
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Grades (PV / PA / PM du grade max) */}
                    {(() => {
                        const grades = statsOf(selected)?.grades;
                        const g = grades && grades.length > 0 ? grades[grades.length - 1] : null;
                        if (!g) return null;
                        return (
                            <div className="grid grid-cols-3 gap-3">
                                <div className="rounded-xl bg-background border border-border p-3 text-center">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">PV</p>
                                    <p className="text-sm font-black text-foreground tabular-nums mt-0.5">{g.lifePoints?.toLocaleString("fr-FR")}</p>
                                </div>
                                <div className="rounded-xl bg-background border border-border p-3 text-center">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">PA</p>
                                    <p className="text-sm font-black text-foreground tabular-nums mt-0.5">{g.actionPoints ?? "-"}</p>
                                </div>
                                <div className="rounded-xl bg-background border border-border p-3 text-center">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">PM</p>
                                    <p className="text-sm font-black text-foreground tabular-nums mt-0.5">{g.movementPoints ?? "-"}</p>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Sorts du boss (effets parsés côté serveur) */}
                    {statsOf(selected)?.spells && statsOf(selected)!.spells!.length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-widest text-danger mb-2 flex items-center gap-1.5">
                                <Zap className="w-3.5 h-3.5" /> Capacités du boss
                            </h4>
                            <ul className="space-y-1.5">
                                {statsOf(selected)!.spells!.map((spell) => (
                                    <li key={spell.id} className="flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-2">
                                        {spell.imageUrl ? (
                                            <img src={spell.imageUrl} alt="" className="w-4 h-4 object-contain mt-0.5 shrink-0" loading="lazy" />
                                        ) : (
                                            <Zap className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                        )}
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-foreground">{spell.name}</p>
                                            {spell.description && (
                                                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{spell.description}</p>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Drops du boss */}
                    {statsOf(selected)?.drops && statsOf(selected)!.drops!.length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-widest text-info mb-2 flex items-center gap-1.5">
                                <Brain className="w-3.5 h-3.5" /> Butins notables
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {statsOf(selected)!.drops!.map((drop, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedDrop(drop)}
                                        title={`${drop.name} — ${drop.percent}%`}
                                        className="w-9 h-9 rounded-md bg-surface border border-border p-1 hover:bg-elevated transition-colors"
                                    >
                                        <img src={drop.imageUrl} alt={drop.name} className="w-full h-full object-contain" loading="lazy" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Carte du monstre */}
                    {statsOf(selected)?.coordinates && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <MapPin className="w-4 h-4 text-accent shrink-0" />
                            <span>
                                Carte : <strong className="text-foreground">[{statsOf(selected)!.coordinates!.x}, {statsOf(selected)!.coordinates!.y}]</strong>
                                {statsOf(selected)!.coordinates!.worldMapId ? ` · Monde ${statsOf(selected)!.coordinates!.worldMapId}` : ""}
                            </span>
                        </div>
                    )}

                    {/* Succès du donjon */}
                    {selected.achievements && selected.achievements.length > 0 && (
                        <div className="border-t border-border pt-4">
                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                                Succès du donjon
                            </p>
                            <ul className="space-y-1.5">
                                {selected.achievements.map((a) => (
                                    <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                                        <span className="text-foreground truncate">{a.challenge?.name || "Succès"}</span>
                                        {a.points > 0 && <span className="text-xs font-bold text-warning shrink-0">+{a.points} pts</span>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Drop modal */}
                    {selectedDrop && (
                        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-black/70" onClick={() => setSelectedDrop(null)} />
                            <div className="relative bg-surface border border-border rounded-2xl p-5 w-full max-w-xs text-center">
                                <div className="w-16 h-16 rounded-xl bg-background border border-border p-2 mx-auto mb-3">
                                    <img src={selectedDrop.imageUrl} alt={selectedDrop.name} className="w-full h-full object-contain" />
                                </div>
                                <h3 className="text-sm font-black text-foreground">{selectedDrop.name}</h3>
                                <p className="text-xs text-info font-bold mt-1">Taux de drop : {selectedDrop.percent}%</p>
                                <div className="flex gap-2 mt-4">
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
