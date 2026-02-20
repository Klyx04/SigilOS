"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Circle, Trophy, ChevronDown, ChevronRight, Search } from "lucide-react";
import { toggleAchievementCompleted, getUserDungeonProgress, findMissingAchievements } from "@/server/actions/dungeon-finder-actions";
import { getDungeonsWithAchievements } from "@/server/actions/game-data-actions";
import { toast } from "sonner";

interface Dungeon {
    id: string;
    name: string;
    bossName: string;
    level: number;
    imageUrl?: string | null;
    achievements: {
        id: string;
        points: number;
        challenge: { id: string; name: string; iconUrl?: string | null };
    }[];
}

interface AchievementTrackerProps {
    guildId: string;
}

export function AchievementTracker({ guildId }: AchievementTrackerProps) {
    const [dungeons, setDungeons] = useState<Dungeon[]>([]);
    const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [expandedDungeon, setExpandedDungeon] = useState<string | null>(null);
    const [missingData, setMissingData] = useState<Record<string, any[]>>({});
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        async function load() {
            const [dungeonsRes, progressRes] = await Promise.all([
                getDungeonsWithAchievements(),
                getUserDungeonProgress(guildId),
            ]);

            if (dungeonsRes.success && dungeonsRes.data) {
                // Only show dungeons that have achievements
                const filtered = (dungeonsRes.data as Dungeon[]).filter((d) => d.achievements.length > 0);
                setDungeons(filtered.sort((a, b) => a.level - b.level));
            }

            if (progressRes.success && progressRes.data) {
                setCompletedIds(new Set(progressRes.data.map((p) => p.achievementId)));
            }

            setLoading(false);
        }
        load();
    }, [guildId]);

    async function expandDungeon(dungeonId: string) {
        if (expandedDungeon === dungeonId) {
            setExpandedDungeon(null);
            return;
        }
        setExpandedDungeon(dungeonId);

        // Load missing achievements info for this dungeon
        if (!missingData[dungeonId]) {
            const res = await findMissingAchievements(guildId, dungeonId);
            if (res.success && res.data) {
                setMissingData((prev) => ({ ...prev, [dungeonId]: res.data! }));
            }
        }
    }

    function toggleAchievement(achievementId: string) {
        startTransition(async () => {
            const dungeon = dungeons.find((d) => d.achievements.some((a) => a.id === achievementId));
            if (!dungeon) return;
            const res = await toggleAchievementCompleted(guildId, dungeon.id, achievementId);
            if (res.success) {
                setCompletedIds((prev) => {
                    const next = new Set(prev);
                    if (res.data?.completed) {
                        next.add(achievementId);
                    } else {
                        next.delete(achievementId);
                    }
                    return next;
                });
                // Invalidate missing cache for this dungeon
                const dungeon = dungeons.find((d) => d.achievements.some((a) => a.id === achievementId));
                if (dungeon) {
                    setMissingData((prev) => { const next = { ...prev }; delete next[dungeon.id]; return next; });
                }
            } else {
                toast.error(res.error);
            }
        });
    }

    const filteredDungeons = useMemo(() =>
        dungeons.filter((d) =>
            d.name.toLowerCase().includes(search.toLowerCase()) ||
            d.bossName.toLowerCase().includes(search.toLowerCase())
        ),
        [dungeons, search]
    );

    // Stats
    const totalAchievements = dungeons.reduce((acc, d) => acc + d.achievements.length, 0);
    const completedTotal = dungeons.reduce((acc, d) =>
        acc + d.achievements.filter((a) => completedIds.has(a.id)).length, 0
    );
    const progressPct = totalAchievements > 0 ? Math.round((completedTotal / totalAchievements) * 100) : 0;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 animate-pulse">
                <Trophy className="w-8 h-8 mb-3" />
                <p>Chargement des succès…</p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Global progress */}
            <div className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <p className="text-sm font-bold text-white">{completedTotal} / {totalAchievements} succès cochés</p>
                        <p className="text-xs text-slate-500">sur {dungeons.length} donjons avec succès</p>
                    </div>
                    <span className="text-2xl font-black text-indigo-400">{progressPct}%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPct}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                    />
                </div>
                <p className="text-[10px] text-slate-600 mt-2">
                    ℹ️ Coche les succès que tu as déjà pour aider à trouver des succès en commun avec la guilde.
                </p>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Chercher un donjon…"
                    className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
            </div>

            {/* Dungeon list */}
            <div className="space-y-2">
                {filteredDungeons.map((dungeon) => {
                    const dungeonCompleted = dungeon.achievements.filter((a) => completedIds.has(a.id)).length;
                    const dungeonPct = dungeon.achievements.length > 0
                        ? Math.round((dungeonCompleted / dungeon.achievements.length) * 100)
                        : 0;
                    const isExpanded = expandedDungeon === dungeon.id;
                    const missing = missingData[dungeon.id] ?? [];

                    return (
                        <div key={dungeon.id} className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden transition-all">
                            {/* Dungeon header */}
                            <button
                                onClick={() => expandDungeon(dungeon.id)}
                                className="w-full flex items-center gap-3 p-3 hover:bg-slate-800/30 transition-colors text-left"
                            >
                                <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-800 border border-slate-700 shrink-0">
                                    {dungeon.imageUrl
                                        ? <img src={dungeon.imageUrl} alt="" className="w-full h-full object-cover" />
                                        : <Trophy className="w-4 h-4 m-2.5 text-slate-600" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white truncate">{dungeon.name}</p>
                                    <p className="text-[11px] text-slate-500">Lvl {dungeon.level}</p>
                                </div>
                                {/* Mini progress */}
                                <div className="flex items-center gap-2 shrink-0">
                                    <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${dungeonPct === 100 ? "bg-emerald-500" : "bg-indigo-500"}`}
                                            style={{ width: `${dungeonPct}%` }}
                                        />
                                    </div>
                                    <span className={`text-[11px] font-bold w-8 text-right ${dungeonPct === 100 ? "text-emerald-400" : "text-slate-400"}`}>
                                        {dungeonCompleted}/{dungeon.achievements.length}
                                    </span>
                                    {isExpanded
                                        ? <ChevronDown className="w-4 h-4 text-slate-500" />
                                        : <ChevronRight className="w-4 h-4 text-slate-500" />}
                                </div>
                            </button>

                            {/* Expanded achievements */}
                            {isExpanded && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    className="border-t border-slate-800 p-3 space-y-2"
                                >
                                    {dungeon.achievements.map((a) => {
                                        const done = completedIds.has(a.id);
                                        const missingInfo = missing.find((m) => m.achievementId === a.id);

                                        return (
                                            <div key={a.id} className="space-y-1">
                                                <div
                                                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${done ? "bg-emerald-500/5 border border-emerald-500/10" : "bg-slate-800/30 border border-transparent hover:border-slate-700"}`}
                                                    onClick={() => toggleAchievement(a.id)}
                                                >
                                                    {done
                                                        ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                                                        : <Circle className="w-5 h-5 text-slate-600 shrink-0" />}
                                                    {a.challenge.iconUrl && (
                                                        <img src={a.challenge.iconUrl} alt="" className="w-5 h-5 object-contain shrink-0" />
                                                    )}
                                                    <span className={`text-sm flex-1 ${done ? "text-emerald-300 line-through opacity-70" : "text-slate-300"}`}>
                                                        {a.challenge.name}
                                                    </span>
                                                    <span className="text-[10px] text-slate-600 font-medium">{a.points}pts</span>
                                                </div>

                                                {/* Members who have it (for missing achievements) */}
                                                {!done && missingInfo && missingInfo.membersWhoHaveIt.length > 0 && (
                                                    <div className="ml-8 flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-[10px] text-slate-600">Déjà fait par :</span>
                                                        {missingInfo.membersWhoHaveIt.slice(0, 5).map((m: any, i: number) => (
                                                            <div key={i} className="flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
                                                                {m.imageUrl && <img src={m.imageUrl} alt="" className="w-3.5 h-3.5 rounded-full" />}
                                                                {m.name}
                                                            </div>
                                                        ))}
                                                        {missingInfo.membersWhoHaveIt.length > 5 && (
                                                            <span className="text-[10px] text-slate-600">+{missingInfo.membersWhoHaveIt.length - 5}</span>
                                                        )}
                                                    </div>
                                                )}
                                                {!done && missingInfo && missingInfo.membersWhoHaveIt.length === 0 && (
                                                    <div className="ml-8 text-[10px] text-slate-600">Aucun membre de la guilde ne l'a encore.</div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </motion.div>
                            )}
                        </div>
                    );
                })}

                {filteredDungeons.length === 0 && !loading && (
                    <div className="py-12 text-center text-slate-600">
                        <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p>Aucun donjon avec des succès trouvé.</p>
                        <p className="text-xs mt-1 text-slate-700">Les succès sont gérés par le super-admin.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
