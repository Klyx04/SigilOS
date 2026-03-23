"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, Trophy, Search, X, ChevronDown, Info } from "lucide-react";
import { toggleAchievementCompleted, getUserDungeonProgress, findMissingAchievements } from "@/server/actions/dungeon-finder-actions";
import { getDungeonsWithAchievements } from "@/server/actions/game-data-actions";
import { toast } from "sonner";

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
    achievements: Achievement[];
}

interface AchievementTrackerProps {
    guildId: string;
}

// Circular progress ring component
function ProgressRing({ pct, size = 48, stroke = 4, color = "#6366f1" }: {
    pct: number; size?: number; stroke?: number; color?: string;
}) {
    const r = (size - stroke * 2) / 2;
    const circ = 2 * Math.PI * r;
    const dash = circ - (pct / 100) * circ;

    return (
        <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
            <motion.circle
                cx={size / 2} cy={size / 2} r={r}
                fill="none" stroke={color} strokeWidth={stroke}
                strokeLinecap="round" strokeDasharray={circ}
                initial={{ strokeDashoffset: circ }}
                animate={{ strokeDashoffset: dash }}
                transition={{ duration: 1, ease: "easeOut" }}
            />
        </svg>
    );
}

export function AchievementTracker({ guildId }: AchievementTrackerProps) {
    const [dungeons, setDungeons] = useState<Dungeon[]>([]);
    const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [expandedDungeon, setExpandedDungeon] = useState<string | null>(null);
    const [missingData, setMissingData] = useState<Record<string, any[]>>({});
    const [filterStatus, setFilterStatus] = useState<"all" | "done" | "todo">("all");
    const [minLevel, setMinLevel] = useState(1);
    const [maxLevel, setMaxLevel] = useState(1000);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        async function load() {
            const [dungeonsRes, progressRes] = await Promise.all([
                getDungeonsWithAchievements(),
                getUserDungeonProgress(guildId),
            ]);
            if (dungeonsRes.success && dungeonsRes.data) {
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
        if (expandedDungeon === dungeonId) { setExpandedDungeon(null); return; }
        setExpandedDungeon(dungeonId);
        if (!missingData[dungeonId]) {
            const res = await findMissingAchievements(guildId, dungeonId);
            if (res.success && res.data) setMissingData((p) => ({ ...p, [dungeonId]: res.data! }));
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
                    res.data?.completed ? next.add(achievementId) : next.delete(achievementId);
                    return next;
                });
                setMissingData((prev) => { const next = { ...prev }; delete next[dungeon.id]; return next; });
            } else {
                toast.error(res.error);
            }
        });
    }

    function toggleDungeonAchievements(dungeon: Dungeon, checkAll: boolean) {
        startTransition(async () => {
            // Optimistic update
            const nextIds = new Set(completedIds);
            for (const a of dungeon.achievements) {
                if (checkAll) nextIds.add(a.id);
                else nextIds.delete(a.id);
            }
            setCompletedIds(nextIds);

            // Sequential calls (not ideal but server action limitation)
            // Or better: update all in one go if the server action supported it.
            // For now, let's just do them one by one but in the background.
            for (const a of dungeon.achievements) {
                const alreadyMatch = checkAll ? completedIds.has(a.id) : !completedIds.has(a.id);
                if (!alreadyMatch) {
                    await toggleAchievementCompleted(guildId, dungeon.id, a.id);
                }
            }
            setMissingData((prev) => { const next = { ...prev }; delete next[dungeon.id]; return next; });
        });
    }

    const totalAchievements = dungeons.reduce((acc, d) => acc + d.achievements.length, 0);
    const completedTotal = dungeons.reduce((acc, d) => acc + d.achievements.filter((a) => completedIds.has(a.id)).length, 0);
    const progressPct = totalAchievements > 0 ? Math.round((completedTotal / totalAchievements) * 100) : 0;

    const filteredDungeons = useMemo(() => {
        const term = search.toLowerCase();
        return dungeons.filter((d) => {
            const matchSearch = d.name.toLowerCase().includes(term) || d.bossName.toLowerCase().includes(term);
            const matchLevel = d.level >= minLevel && d.level <= maxLevel;
            if (!matchSearch || !matchLevel) return false;
            
            const done = d.achievements.filter((a) => completedIds.has(a.id)).length;
            if (filterStatus === "done") return done === d.achievements.length;
            if (filterStatus === "todo") return done < d.achievements.length;
            return true;
        });
    }, [dungeons, search, filterStatus, completedIds, minLevel, maxLevel]);

    if (loading) {
        return (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="h-28 rounded-2xl bg-slate-900/40 border border-slate-800 animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Global stats banner */}
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/30 border border-white/5 shadow-inner rounded-2xl p-5">
                <div className="absolute top-0 right-0 w-48 h-48 opacity-5">
                    <Trophy className="w-full h-full text-indigo-400" />
                </div>
                <div className="flex items-center gap-5">
                    {/* Big ring */}
                    <div className="relative shrink-0">
                        <ProgressRing pct={progressPct} size={72} stroke={5} color={progressPct === 100 ? "#22c55e" : "#818cf8"} />
                        <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-white">
                            {progressPct}%
                        </span>
                    </div>
                    <div className="flex-1">
                        <p className="text-lg font-black text-white">
                            {completedTotal} <span className="text-slate-400 font-normal text-base">/ {totalAchievements}</span>
                        </p>
                        <p className="text-sm text-slate-400">succès de donjon cochés</p>
                        <p className="text-[11px] text-slate-600 mt-1.5 flex items-center gap-1">
                            <Info className="w-3 h-3" />
                            Coche les succès complétés pour trouver des co-équipiers dans la guilde.
                        </p>
                    </div>
                    {/* Mini stats */}
                    <div className="hidden sm:flex gap-4 shrink-0">
                        <div className="text-center">
                            <p className="text-xl font-black text-emerald-400">
                                {dungeons.filter((d) => d.achievements.every((a) => completedIds.has(a.id))).length}
                            </p>
                            <p className="text-[10px] text-slate-500">donjons finis</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xl font-black text-slate-300">
                                {dungeons.filter((d) => !d.achievements.every((a) => completedIds.has(a.id))).length}
                            </p>
                            <p className="text-[10px] text-slate-500">à compléter</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-2">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Chercher un donjon…"
                        className="w-full bg-slate-900/50 border border-white/5 rounded-xl pl-10 pr-8 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-inner h-11"
                    />
                    {search && (
                        <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
                {/* Status filter */}
                <div className="flex gap-1 bg-slate-900/50 border border-white/5 shadow-inner rounded-xl p-1 shrink-0 h-11 items-center">
                    {[
                        { id: "all" as const, label: "Tous" },
                        { id: "todo" as const, label: "À faire" },
                        { id: "done" as const, label: "Complétés" },
                    ].map(({ id, label }) => (
                        <button
                            key={id}
                            onClick={() => setFilterStatus(id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === id ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                                }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Level Presets Row */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-900/40 border border-white/5 rounded-xl w-max">
                {[
                    { label: "Tout", min: 1, max: 1000 },
                    { label: "1-50", min: 1, max: 50 },
                    { label: "51-100", min: 51, max: 100 },
                    { label: "101-150", min: 101, max: 150 },
                    { label: "151-190", min: 151, max: 190 },
                    { label: "191-200", min: 191, max: 200 },
                ].map((preset) => {
                    const isActive = minLevel === preset.min && maxLevel === preset.max;
                    return (
                        <button
                            key={preset.label}
                            onClick={() => { setMinLevel(preset.min); setMaxLevel(preset.max); }}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${isActive
                                ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30 shadow-indigo-900/10"
                                : "bg-white/5 text-slate-500 border-transparent hover:bg-white/10 hover:text-slate-300"
                                }`}
                        >
                            {preset.label === "Tout" ? "Tous Niveaux" : `Lvl ${preset.label}`}
                        </button>
                    );
                })}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                <AnimatePresence>
                    {filteredDungeons.map((dungeon, i) => {
                        const done = dungeon.achievements.filter((a) => completedIds.has(a.id)).length;
                        const pct = dungeon.achievements.length > 0 ? Math.round((done / dungeon.achievements.length) * 100) : 0;
                        const isComplete = done === dungeon.achievements.length;
                        const isExpanded = expandedDungeon === dungeon.id;
                        const missing = missingData[dungeon.id] ?? [];

                        return (
                            <motion.div
                                key={dungeon.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ delay: i * 0.02 }}
                                className={`col-span-1 ${isExpanded ? "sm:col-span-3 md:col-span-4 lg:col-span-5" : ""}`}
                            >
                                {isExpanded ? (
                                    /* Expanded view */
                                    <div className="bg-slate-900/90 border border-indigo-500/20 rounded-2xl overflow-hidden shadow-2xl shadow-indigo-900/10">
                                        {/* Expanded header */}
                                        <button
                                            onClick={() => expandDungeon(dungeon.id)}
                                            className="w-full flex items-center gap-4 p-4 hover:bg-slate-800/30 transition-colors text-left group"
                                        >
                                            <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-900 border border-white/5 shadow-inner shrink-0 flex items-center justify-center">
                                                {dungeon.imageUrl
                                                    ? <img src={dungeon.imageUrl} alt="" className="w-full h-full object-cover" />
                                                    : <Trophy className="w-7 h-7 text-slate-600" />
                                                }
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xl font-black text-white">{dungeon.name}</p>
                                                <p className="text-sm text-slate-500">Lvl {dungeon.level} · {dungeon.bossName}</p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleDungeonAchievements(dungeon, !isComplete);
                                                    }}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${isComplete
                                                        ? "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
                                                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                                                        }`}
                                                >
                                                    {isComplete ? "Décocher tout" : "Cocher tout"}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className={`text-sm font-black ${isComplete ? "text-emerald-400" : "text-indigo-400"}`}>
                                                        {done}/{dungeon.achievements.length}
                                                    </span>
                                                    <ChevronDown className="w-4 h-4 text-slate-400 rotate-180 transition-transform group-hover:text-white" />
                                                </div>
                                            </div>
                                        </button>
                                        {/* Achievements */}
                                        <div className="border-t border-white/5 p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {dungeon.achievements.map((a) => {
                                                const isDone = completedIds.has(a.id);
                                                const missingInfo = missing.find((m) => m.achievementId === a.id);
                                                return (
                                                    <div key={a.id}>
                                                        <div
                                                            onClick={() => toggleAchievement(a.id)}
                                                            className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all border ${isDone
                                                                ? "bg-emerald-500/8 border-emerald-500/15 hover:border-emerald-500/30"
                                                                : "bg-white/5 border-transparent hover:border-white/10 hover:bg-white/10"
                                                                }`}
                                                        >
                                                            {isDone
                                                                ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                                                : <Circle className="w-4 h-4 text-slate-600 shrink-0" />
                                                            }
                                                            {a.challenge.iconUrl && (
                                                                <img src={a.challenge.iconUrl} alt="" className="w-5 h-5 object-contain shrink-0" />
                                                            )}
                                                            <span className={`text-xs flex-1 leading-tight ${isDone ? "text-emerald-300 line-through opacity-60" : "text-slate-300"}`}>
                                                                {a.challenge.name}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    /* Card view */
                                    <button
                                        onClick={() => expandDungeon(dungeon.id)}
                                        className={`group w-full rounded-2xl border transition-all duration-200 overflow-hidden text-left hover:scale-[1.02] hover:shadow-xl ${isComplete
                                            ? "bg-emerald-950/20 border-emerald-700/30 hover:border-emerald-600/50 hover:shadow-emerald-900/20"
                                            : "bg-slate-900/40 border-white/5 hover:border-indigo-500/30 hover:bg-slate-900/60 shadow-sm"
                                            }`}
                                    >
                                        <div className="p-3 space-y-2">
                                            {/* Top: icon + progress ring */}
                                            <div className="flex items-start justify-between gap-2">
                                                {/* Icon */}
                                                <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-900 border border-white/5 shadow-inner shrink-0 flex items-center justify-center">
                                                    {dungeon.imageUrl
                                                        ? <img src={dungeon.imageUrl} alt="" className="w-full h-full object-cover" />
                                                        : <Trophy className="w-5 h-5 text-slate-600" />
                                                    }
                                                </div>
                                                {/* Progress ring */}
                                                <div className="relative shrink-0">
                                                    <ProgressRing
                                                        pct={pct}
                                                        size={34}
                                                        stroke={3}
                                                        color={isComplete ? "#22c55e" : "#818cf8"}
                                                    />
                                                    <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-white">
                                                        {done}/{dungeon.achievements.length}
                                                    </span>
                                                </div>
                                            </div>
                                            {/* Name */}
                                            <div>
                                                <p className="text-xs font-bold text-white line-clamp-2 leading-tight group-hover:text-indigo-200 transition-colors">
                                                    {dungeon.name}
                                                </p>
                                                <p className="text-[10px] text-slate-500 mt-0.5">Lvl {dungeon.level}</p>
                                            </div>
                                            {/* Status */}
                                            {isComplete && (
                                                <div className="flex items-center gap-1">
                                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                                    <span className="text-[10px] text-emerald-400 font-bold">Complété</span>
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                )}
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {filteredDungeons.length === 0 && (
                <div className="py-16 text-center text-slate-600">
                    <Trophy className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="font-medium">Aucun donjon trouvé.</p>
                </div>
            )}
        </div>
    );
}
