"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Swords, X } from "lucide-react";
import { getDungeonsWithAchievements } from "@/server/actions/game-data-actions";
import { cn } from "@/lib/utils";

interface BossDungeon {
    id: string;
    name: string;
    bossName: string;
    level: number;
    imageUrl?: string | null;
    dofuspourlesnoobsUrl?: string | null;
    dofensiveUrl?: string | null;
    achievements?: { id: string; points: number; challenge?: { name: string } }[];
}

/**
 * #176 — Fiches boss dans le module Succès.
 * Onglet dédié « Fiches Boss » : une fiche par boss (nom, donjon, niveau, image),
 * avec liens DofusDB (sorts du monstre) et Dofensive quand l'URL est disponible,
 * plus les succès rattachés au donjon. Sources : `getDungeonsWithAchievements`.
 */
export function SuccesBossGuide({ guildId }: { guildId: string }) {
    const [dungeons, setDungeons] = useState<BossDungeon[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedBoss, setSelectedBoss] = useState<BossDungeon | null>(null);

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
                            dofuspourlesnoobsUrl: d.dofuspourlesnoobsUrl ?? null,
                            dofensiveUrl: d.dofensiveUrl ?? null,
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

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return dungeons;
        return dungeons.filter(
            (d) =>
                d.bossName.toLowerCase().includes(q) ||
                d.name.toLowerCase().includes(q)
        );
    }, [dungeons, search]);

    const bossUrl = (d: BossDungeon) =>
        `https://www.dofusdb.fr/fr/database/monsters?search=${encodeURIComponent(d.bossName)}`;

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
            <div className="flex flex-col md:flex-row md:items-center gap-3">
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

            {filtered.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground border border-dashed border-border rounded-2xl bg-background/40">
                    <Swords className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="font-medium">Aucun boss trouvé.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((d) => (
                        <button
                            key={d.id}
                            type="button"
                            onClick={() => setSelectedBoss(selectedBoss?.id === d.id ? null : d)}
                            className={cn(
                                "flex flex-col text-left rounded-2xl border overflow-hidden transition-colors",
                                selectedBoss?.id === d.id
                                    ? "border-warning/50 bg-elevated/90"
                                    : "border-border bg-surface/70 hover:bg-elevated/70"
                            )}
                        >
                            <div className="relative h-32 bg-background">
                                {d.imageUrl ? (
                                    <img src={d.imageUrl} alt={d.bossName} className="w-full h-full object-cover" loading="lazy" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Swords className="w-8 h-8 text-muted-foreground/30" />
                                    </div>
                                )}
                                <div className="absolute top-2 left-2 rounded-lg bg-black/60 backdrop-blur px-2 py-1 text-xs font-black text-white">
                                    LVL {d.level}
                                </div>
                            </div>
                            <div className="p-4 flex-1">
                                <p className="text-sm font-black text-foreground leading-tight">{d.bossName}</p>
                                <p className="text-xs text-muted-foreground mt-1 truncate">{d.name}</p>
                                <div className="flex flex-wrap items-center gap-2 mt-3">
                                    <a
                                        href={bossUrl(d)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-9 rounded-lg border border-border bg-surface text-xs font-bold text-foreground hover:bg-elevated transition-colors"
                                        title="Sorts et fiche du monstre sur DofusDB"
                                    >
                                        <img src="https://www.google.com/s2/favicons?domain=dofusdb.fr&sz=32" alt="" className="w-3.5 h-3.5 rounded-sm" loading="lazy" />
                                        DofusDB
                                    </a>
                                    {d.dofensiveUrl && (
                                        <a
                                            href={d.dofensiveUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-9 rounded-lg border border-border bg-surface text-xs font-bold text-foreground hover:bg-elevated transition-colors"
                                            title="Guide Dofensive"
                                        >
                                            <img src="https://www.google.com/s2/favicons?domain=dofensive.com&sz=32" alt="" className="w-3.5 h-3.5 rounded-sm" loading="lazy" />
                                            Dofensive
                                        </a>
                                    )}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {selectedBoss && (
                <div className="bg-surface/70 border border-border rounded-2xl p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <div>
                            <h3 className="text-base font-black text-foreground">{selectedBoss.bossName}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Donjon : {selectedBoss.name} · Niveau {selectedBoss.level}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <a
                                href={bossUrl(selectedBoss)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-3.5 py-2.5 min-h-11 rounded-xl border border-border bg-surface text-foreground text-xs font-bold hover:bg-elevated transition-colors"
                            >
                                <img src="https://www.google.com/s2/favicons?domain=dofusdb.fr&sz=32" alt="" className="w-4 h-4 rounded-sm" loading="lazy" />
                                Sorts & fiche DofusDB
                            </a>
                            {selectedBoss.dofensiveUrl && (
                                <a
                                    href={selectedBoss.dofensiveUrl}
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
                    {selectedBoss.achievements && selectedBoss.achievements.length > 0 && (
                        <div className="mt-4 border-t border-border pt-4">
                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                                Succès du donjon
                            </p>
                            <ul className="space-y-1.5">
                                {selectedBoss.achievements.map((a) => (
                                    <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                                        <span className="text-foreground truncate">{a.challenge?.name || "Succès"}</span>
                                        {a.points > 0 && <span className="text-xs font-bold text-warning shrink-0">+{a.points} pts</span>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
