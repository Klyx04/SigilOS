"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    Trophy,
    Users,
    Search,
    ChevronLeft,
    Loader2,
    Swords,
    Info,
    Copy,
    Map as MapIcon,
    X,
} from "lucide-react";
import { getDungeonDirectory } from "@/server/actions/dungeon-finder-actions";
import { getDungeonsWithAchievements, getMonsterStats } from "@/server/actions/game-data-actions";
import { getClass } from "@/lib/dofus-assets";
import { MapViewer } from "@/components/worldmap/map-viewer";
import { cn } from "@/lib/utils";

interface Dungeon {
    id: string;
    name: string;
    bossName: string;
    level: number;
    imageUrl?: string | null;
    isExpedition?: boolean;
    dofuspourlesnoobsUrl?: string | null;
    dpnlUrl?: string | null;
    dofensiveUrl?: string | null;
}

interface DirectoryMember {
    id: string;
    name: string;
    imageUrl: string | null;
    classe: string | null;
}

interface DirectoryAchievement {
    achievementId: string;
    achievementName: string;
    iconUrl: string | null;
    points: number;
    hasCompleted: DirectoryMember[];
    missing: DirectoryMember[];
}

interface SuccesDirectoryProps {
    guildId: string;
}

function MemberPill({
    member,
    variant,
}: {
    member: DirectoryMember;
    variant: "missing" | "completed";
}) {
    const cls = member.classe ? getClass(member.classe) : null;
    return (
        <div
            className={cn(
                "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 min-w-0",
                variant === "missing" ? "bg-danger/5 border-danger/15" : "bg-success/10 border-success/20"
            )}
        >
            <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 bg-background border border-border">
                {member.imageUrl ? (
                    <img src={member.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                    <Users className="w-3.5 h-3.5 m-auto text-muted-foreground/60" />
                )}
            </div>
            <span className="text-xs font-bold text-foreground truncate">{member.name}</span>
            {cls && (
                <img src={cls.icon} alt={member.classe || ""} className="w-4 h-4 object-contain shrink-0" title={member.classe || undefined} loading="lazy" />
            )}
        </div>
    );
}

/**
 * #138 — Vue « Guilde » du module Succès (refonte de DungeonDirectory).
 * Social d'abord : pour chaque succès, qui cherche encore / qui l'a déjà validé.
 * La fiche boss (drops, sorts, carte) est un tiroir secondaire — plus le hero.
 * Aucun modal posts : « Chercher un groupe » navigue vers /donjons-et-quetes.
 */
export function SuccesDirectory({ guildId }: SuccesDirectoryProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [dungeons, setDungeons] = useState<Dungeon[]>([]);
    const [loadingDb, setLoadingDb] = useState(true);
    const [search, setSearch] = useState("");
    const [directory, setDirectory] = useState<DirectoryAchievement[]>([]);
    const [loadingDir, setLoadingDir] = useState(false);
    const [bossStats, setBossStats] = useState<any>(null);
    const [selectedDrop, setSelectedDrop] = useState<any>(null);
    const [showBossSheet, setShowBossSheet] = useState(false);
    const autoSelectedRef = useRef(false);

    const selectedDungeonId = searchParams.get("dungeon");
    const selectedDungeon = dungeons.find((d) => d.id === selectedDungeonId) || null;

    const updateParam = useCallback(
        (key: string, value: string | null) => {
            const params = new URLSearchParams(searchParams.toString());
            if (value === null) params.delete(key);
            else params.set(key, value);
            router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
        },
        [router, searchParams]
    );

    // #138 UI : jamais de panneau vide à droite — auto-sélection du 1er donjon UNE SEULE fois
    // au chargement (le « Retour à la liste » mobile efface l'URL sans être surchargé).
    useEffect(() => {
        if (autoSelectedRef.current || loadingDb || dungeons.length === 0) return;
        if (selectedDungeonId) {
            autoSelectedRef.current = true;
            return;
        }
        autoSelectedRef.current = true;
        updateParam("dungeon", dungeons[0].id);
    }, [loadingDb, dungeons, selectedDungeonId, updateParam]);

    useEffect(() => {
        let cancelled = false;
        getDungeonsWithAchievements().then((res) => {
            if (cancelled) return;
            if (res.success && res.data) {
                const unique = Array.from(new Map((res.data as any[]).map((d) => [d.id, d])).values()) as Dungeon[];
                setDungeons(unique.sort((a, b) => a.level - b.level));
            }
            setLoadingDb(false);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    // Chargement du directory (qui a quoi) + stats du boss à la sélection.
    useEffect(() => {
        if (!selectedDungeon) return;
        let cancelled = false;
        setLoadingDir(true);
        setDirectory([]);
        setBossStats(null);
        setShowBossSheet(false);
        // 1. Le social (qui a / qui cherche) vient de NOTRE BDD (local, instantané) → affiché sans attendre.
        getDungeonDirectory(guildId, selectedDungeon.id).then((dirRes) => {
            if (cancelled) return;
            if (dirRes.success && dirRes.data) setDirectory(dirRes.data);
            setLoadingDir(false);
        });
        // 2. La fiche donjon (drops/sorts/carte) vient de dofusdb → charge en ARRIÈRE-PLAN,
        // sans jamais bloquer le « qui a quoi ». (Cache 1h côté serveur + cache state client.)
        getMonsterStats(selectedDungeon.bossName).then((statsRes) => {
            if (cancelled) return;
            if (statsRes.success && statsRes.data) setBossStats(statsRes.data);
        });
        return () => {
            cancelled = true;
        };
    }, [selectedDungeon, guildId]);

    const filteredDungeons = useMemo(() => {
        const term = search.toLowerCase();
        if (!term) return dungeons;
        return dungeons.filter((d) => d.name.toLowerCase().includes(term) || d.bossName.toLowerCase().includes(term));
    }, [dungeons, search]);

    const copyTravel = useCallback(() => {
        if (!bossStats?.coordinates) return;
        const { x, y } = bossStats.coordinates;
        const text = `/travel ${x},${y}`;
        navigator.clipboard?.writeText(text).then(
            () => {
                /* copié */
            },
            () => {
                /* clipboard refusé */
            }
        );
    }, [bossStats]);

    if (loadingDb) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-warning" />
                <p className="font-medium">Chargement de la base de données…</p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Recherche */}
            <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher un donjon ou un boss…"
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

            <div className="grid lg:grid-cols-[340px_1fr] gap-4 items-start">
                {/* ─── LISTE DES DONJONS ─── */}
                <div className={cn("space-y-2 lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1 custom-scrollbar", selectedDungeon && "hidden lg:block")}>
                    {filteredDungeons.length === 0 ? (
                        <div className="py-16 text-center text-muted-foreground">
                            <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
                            <p className="font-medium">Aucun donjon trouvé.</p>
                        </div>
                    ) : (
                        filteredDungeons.map((d) => {
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
                                    {d.imageUrl ? (
                                        <img src={d.imageUrl} alt="" className="w-11 h-11 rounded-xl object-cover border border-border bg-background shrink-0" loading="lazy" />
                                    ) : (
                                        <div className="w-11 h-11 rounded-xl bg-background border border-border flex items-center justify-center shrink-0">
                                            <Trophy className="w-5 h-5 text-muted-foreground/50" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-foreground truncate">{d.name}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {d.bossName} · LVL {d.level}
                                        </p>
                                    </div>
                                    <Users className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                                </button>
                            );
                        })
                    )}
                </div>

                {/* ─── DÉTAIL SOCIAL DU DONJON SÉLECTIONNÉ ─── */}
                <div className={cn(!selectedDungeon && "hidden lg:block")}>
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
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-lg font-black text-foreground leading-tight">{selectedDungeon.name}</h2>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Boss : {selectedDungeon.bossName} · LVL {selectedDungeon.level}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {selectedDungeon.dofuspourlesnoobsUrl && (
                                            <a
                                                href={selectedDungeon.dofuspourlesnoobsUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 px-3 py-2 min-h-11 rounded-xl border border-border bg-surface text-xs font-bold text-foreground hover:bg-elevated transition-colors"
                                            >
                                                Guide DPNL
                                            </a>
                                        )}
                                        {selectedDungeon.dofensiveUrl && (
                                            <a
                                                href={selectedDungeon.dofensiveUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 px-3 py-2 min-h-11 rounded-xl border border-border bg-surface text-xs font-bold text-foreground hover:bg-elevated transition-colors"
                                            >
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
                            </div>

                            {/* Social d'abord : qui a / qui cherche, par succès */}
                            <div className="p-5">
                                {loadingDir ? (
                                    <div className="flex items-center justify-center py-16 text-muted-foreground">
                                        <Loader2 className="w-6 h-6 animate-spin mr-3 text-warning" />
                                        <span className="font-medium">Chargement de l'annuaire…</span>
                                    </div>
                                ) : directory.length === 0 ? (
                                    <div className="py-16 text-center text-muted-foreground">
                                        <Info className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                        <p className="font-medium">Aucun succès enregistré pour ce donjon.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-5">
                                        {directory.map((achv) => {
                                            const missingCount = achv.missing.length;
                                            const doneCount = achv.hasCompleted.length;
                                            const everyone = missingCount === 0;
                                            return (
                                                <div key={achv.achievementId} className="border border-border rounded-2xl overflow-hidden bg-background/30">
                                                    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-surface/60 border-b border-border">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            {achv.iconUrl && (
                                                                <img src={achv.iconUrl} alt="" className="w-8 h-8 rounded-lg bg-surface border border-border p-1 object-contain shrink-0" loading="lazy" />
                                                            )}
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-bold text-foreground truncate">{achv.achievementName}</p>
                                                                {achv.points > 0 && <p className="text-xs text-warning font-semibold">+{achv.points} pts</p>}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {everyone && (
                                                                <span className="text-xs font-black uppercase tracking-wide text-success bg-success/10 border border-success/25 px-2 py-1 rounded-full">
                                                                    Tous validé 🎉
                                                                </span>
                                                            )}
                                                            <span className="text-xs font-black text-danger bg-danger/5 border border-danger/15 px-2 py-1 rounded-full">
                                                                {missingCount} cherche{missingCount > 1 ? "nt" : ""}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
                                                        <div>
                                                            <p className="text-caption font-bold uppercase tracking-widest text-danger mb-2">
                                                                Cherchent encore ({missingCount})
                                                            </p>
                                                            {missingCount > 0 ? (
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {achv.missing.map((m) => (
                                                                        <MemberPill key={m.id} member={m} variant="missing" />
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-muted-foreground italic py-2">Personne ne le cherche.</p>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="text-caption font-bold uppercase tracking-widest text-success mb-2">
                                                                Déjà validé ({doneCount})
                                                            </p>
                                                            {doneCount > 0 ? (
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {achv.hasCompleted.map((m) => (
                                                                        <MemberPill key={m.id} member={m} variant="completed" />
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-muted-foreground italic py-2">Personne ne l'a encore validé.</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Fiche donjon : contenu (tiroir) */}
                                {showBossSheet && bossStats && !loadingDir && (
                                    <div className="border-t border-border p-5 space-y-5">
                                        {bossStats.drops?.length > 0 && (
                                            <div>
                                                <h4 className="text-caption font-bold uppercase tracking-widest text-info mb-2">Butins notables</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {bossStats.drops.map((drop: any, idx: number) => (
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

                                        {bossStats.spells?.length > 0 && (
                                            <div>
                                                <h4 className="text-caption font-bold uppercase tracking-widest text-danger mb-2">Capacités du boss</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {bossStats.spells.map((spell: any, idx: number) => (
                                                        <div key={idx} className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5" title={spell.description}>
                                                            {spell.imageUrl ? (
                                                                <img src={spell.imageUrl} alt="" className="w-4 h-4 object-contain" />
                                                            ) : (
                                                                <Swords className="w-4 h-4 text-muted-foreground" />
                                                            )}
                                                            <span className="text-xs font-bold">{spell.name}</span>
                                                            {spell.apCost ? <span className="text-caption text-warning font-bold">{spell.apCost} PA</span> : null}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {bossStats.coordinates && (
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="text-caption font-bold uppercase tracking-widest text-foreground flex items-center gap-1.5">
                                                        <MapIcon className="w-4 h-4" /> Position ({bossStats.coordinates.x}, {bossStats.coordinates.y})
                                                    </h4>
                                                    <button onClick={copyTravel} className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground min-h-11 px-2">
                                                        <Copy className="w-3.5 h-3.5" /> /travel
                                                    </button>
                                                </div>
                                                <div className="rounded-2xl overflow-hidden border border-border h-[260px]">
                                                    <MapViewer
                                                        initialTab="map"
                                                        initialX={bossStats.coordinates.x}
                                                        initialY={bossStats.coordinates.y}
                                                        initialWorldId={bossStats.coordinates.worldMapId}
                                                        initialZoom={1}
                                                        hideUI
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Bouton bascule fiche donjon */}
                                {bossStats && !loadingDir && (
                                    <div className="mt-5 border-t border-border pt-5">
                                        <button
                                            onClick={() => setShowBossSheet((v) => !v)}
                                            className="inline-flex items-center gap-2 text-sm font-bold text-foreground hover:text-warning transition-colors min-h-11"
                                        >
                                            <Info className="w-4 h-4 text-warning" />
                                            {showBossSheet ? "Masquer la fiche donjon" : "Voir la fiche donjon (drops, sorts, carte)"}
                                        </button>
                                    </div>
                                )}
                            </div>

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
                    ) : (
                        <div className="hidden lg:flex flex-col items-center justify-center py-24 text-muted-foreground border border-dashed border-border rounded-2xl bg-background/40">
                            <Users className="w-12 h-12 mb-4 opacity-20" />
                            <p className="font-medium">Sélectionne un donjon pour voir qui a quoi.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
