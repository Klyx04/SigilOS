"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, Trophy, Search, X, ChevronDown, Info } from "lucide-react";
import { toggleAchievementCompleted, getUserDungeonProgress, findMissingAchievements } from "@/server/actions/dungeon-finder-actions";
import { getDungeonsWithAchievements } from "@/server/actions/game-data-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
    isOcreQuest?: boolean;
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
                    <div key={i} className="h-32 rounded-2xl bg-zinc-900/40 border border-white/5" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Global stats banner */}
            <div className="relative overflow-hidden bg-zinc-950 border border-white/10 rounded-2xl p-6 group">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-emerald-500/5" />
                <div className="absolute -top-24 -right-24 w-64 h-64 opacity-[0.03] rotate-12 group-hover:rotate-0 transition-transform duration-1000">
                    <Trophy className="w-full h-full text-white" />
                </div>
                
                <div className="relative flex flex-col md:flex-row items-center gap-6">
                    {/* Big ring */}
                    <div className="relative shrink-0 transition-transform group-hover:scale-105 duration-500">
                        <ProgressRing pct={progressPct} size={84} stroke={6} color={progressPct === 100 ? "#10b981" : "#6366f1"} />
                        <span className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-xl font-black text-white leading-none">{progressPct}%</span>
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">Global</span>
                        </span>
                    </div>

                    <div className="flex-1 text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-3 mb-1">
                            <Trophy className="w-5 h-5 text-amber-500" />
                            <h2 className="text-xl font-black text-white tracking-tight uppercase">Progression des Succès</h2>
                        </div>
                        <p className="text-2xl font-black text-white leading-none">
                            {completedTotal} <span className="text-zinc-600 font-bold text-lg">/ {totalAchievements}</span>
                        </p>
                        <p className="text-[11px] text-zinc-400 mt-3 flex items-center justify-center md:justify-start gap-2 bg-white/5 w-max px-3 py-1.5 rounded-lg border border-white/5 shadow-inner mx-auto md:mx-0">
                            <Info className="w-3.5 h-3.5 text-indigo-400" />
                            Coche tes succès pour trouver des partenaires de jeu.
                        </p>
                    </div>

                    {/* Mini stats cards */}
                    <div className="grid grid-cols-2 gap-3 shrink-0 w-full md:w-auto">
                        <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-3 text-center shadow-inner">
                            <p className="text-xl font-black text-emerald-400 leading-none">
                                {dungeons.filter((d) => d.achievements.every((a) => completedIds.has(a.id))).length}
                            </p>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Donjons Finis</p>
                        </div>
                        <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-3 text-center shadow-inner">
                            <p className="text-xl font-black text-zinc-300 leading-none">
                                {dungeons.filter((d) => !d.achievements.every((a) => completedIds.has(a.id))).length}
                            </p>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Restants</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-2">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Chercher un donjon par nom ou boss…"
                        className="w-full bg-zinc-950/80 border border-white/10 rounded-xl pl-11 pr-10 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all shadow-inner h-12"
                    />
                    {search && (
                        <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white bg-zinc-800 rounded-lg p-1 transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
                {/* Status filter */}
                <div className="flex gap-1.5 bg-zinc-950/80 border border-white/10 shadow-inner rounded-xl p-1.5 shrink-0 h-12 items-center">
                    {[
                        { id: "all" as const, label: "Tous" },
                        { id: "todo" as const, label: "À faire" },
                        { id: "done" as const, label: "Complétés" },
                    ].map(({ id, label }) => (
                        <button
                            key={id}
                            onClick={() => setFilterStatus(id)}
                            className={cn(
                                "px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                                filterStatus === id 
                                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 ring-1 ring-white/10" 
                                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Level Presets Row */}
            <div className="flex flex-wrap items-center gap-2 p-1.5 bg-zinc-950/40 border border-white/10 rounded-xl w-max">
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
                            className={cn(
                                "px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border",
                                isActive
                                    ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30 shadow-lg shadow-indigo-900/10"
                                    : "bg-white/5 text-zinc-500 border-transparent hover:bg-white/10 hover:text-zinc-300"
                            )}
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
                                    <div className="bg-zinc-900/90 border border-indigo-500/30 rounded-2xl overflow-hidden">
                                        {/* Expanded header */}
                                        <button
                                            onClick={() => expandDungeon(dungeon.id)}
                                            className="w-full flex flex-col sm:flex-row items-center gap-6 p-6 hover:bg-white/5 transition-all text-left group"
                                        >
                                             <div className="w-20 h-20 rounded-2xl overflow-hidden bg-zinc-950 border border-white/10 shrink-0 flex items-center justify-center relative">
                                                {dungeon.imageUrl
                                                    ? <img src={dungeon.imageUrl} alt="" className="w-full h-full object-cover" />
                                                    : <Trophy className="w-8 h-8 text-zinc-700" />
                                                }
                                                {dungeon.isOcreQuest && (
                                                    <img
                                                        src="/module-dofus/Dofus_Ocre.png"
                                                        alt="Quête Ocre"
                                                        title="Donjon de la Quête Ocre"
                                                        className="absolute -bottom-1.5 -right-1.5 w-6 h-6 object-contain rounded-full bg-zinc-950/80 border border-amber-500/30 p-0.5 shadow-lg"
                                                    />
                                                )}
                                            </div>
                                            <div className="flex-1 text-center sm:text-left">
                                                <h3 className="text-2xl font-black text-white tracking-tight uppercase">{dungeon.name}</h3>
                                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1">
                                                    <span className="bg-indigo-500/10 text-indigo-400 text-[10px] font-black px-2.5 py-1 rounded border border-indigo-500/20 uppercase tracking-widest">Niveau {dungeon.level}</span>
                                                    <span className="text-zinc-500 text-xs font-bold">·</span>
                                                    <span className="text-zinc-400 text-sm font-bold uppercase tracking-tighter">{dungeon.bossName}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-white/5 pt-4 sm:pt-0">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleDungeonAchievements(dungeon, !isComplete);
                                                    }}
                                                    className={cn(
                                                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all shadow-lg active:scale-95",
                                                        isComplete
                                                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500 hover:text-white hover:border-rose-400"
                                                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500 hover:text-white hover:border-emerald-400"
                                                    )}
                                                >
                                                    {isComplete ? "Décocher tout" : "Tout cocher"}
                                                </button>
                                                <div className="flex items-center gap-3 bg-zinc-950 px-3 py-2 rounded-xl border border-white/10">
                                                    <span className={cn("text-base font-black tracking-tighter", isComplete ? "text-emerald-400" : "text-indigo-400")}>
                                                        {done} <span className="text-zinc-600 mx-0.5">/</span> {dungeon.achievements.length}
                                                    </span>
                                                    <ChevronDown className="w-5 h-5 text-zinc-500 rotate-180 transition-transform group-hover:text-white" />
                                                </div>
                                            </div>
                                        </button>
                                        {/* Achievements Grid */}
                                        <div className="border-t border-white/10 p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-zinc-950/50">
                                            {dungeon.achievements.map((a) => {
                                                const isDone = completedIds.has(a.id);
                                                return (
                                                    <div key={a.id}>
                                                        <button
                                                            onClick={() => toggleAchievement(a.id)}
                                                            className={cn(
                                                                "flex items-center gap-4 p-3.5 rounded-2xl cursor-pointer transition-colors border w-full text-left group/item",
                                                                isDone
                                                                    ? "bg-emerald-500/5 border-emerald-500/20"
                                                                    : "bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.05]"
                                                            )}
                                                        >
                                                            <div className={cn(
                                                                "w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition-colors",
                                                                isDone ? "bg-emerald-500 border-emerald-400" : "bg-zinc-900 border-white/10 group-hover/item:border-zinc-500"
                                                            )}>
                                                                {isDone && <CheckCircle2 className="w-4 h-4 text-white" />}
                                                            </div>
                                                            {a.challenge.iconUrl && (
                                                                <div className="w-8 h-8 bg-zinc-900 rounded-lg p-1.5 border border-white/5 shrink-0 group-hover/item:scale-110 transition-transform">
                                                                    <img src={a.challenge.iconUrl} alt="" className="w-full h-full object-contain" />
                                                                </div>
                                                            )}
                                                            <div className="flex-1">
                                                                <span className={cn(
                                                                    "text-xs font-bold leading-tight transition-colors",
                                                                    isDone ? "text-emerald-400/80 line-through" : "text-zinc-300 group-hover/item:text-white"
                                                                )}>
                                                                    {a.challenge.name}
                                                                </span>
                                                                <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest mt-0.5">{a.points} Pts</p>
                                                            </div>
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    /* Card view (Collapsed) */
                                    <button
                                        onClick={() => expandDungeon(dungeon.id)}
                                        className={cn(
                                            "group w-full rounded-2xl border transition-colors overflow-hidden text-left flex flex-col h-full bg-zinc-900/40",
                                            isComplete
                                                ? "border-emerald-500/30"
                                                : "border-white/5 hover:border-indigo-500/40 hover:bg-zinc-900/60"
                                        )}
                                    >
                                        <div className="p-4 flex flex-col h-full gap-4">
                                            {/* Top: icon + progress ring */}
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-zinc-950 border border-white/10 shadow-2xl shrink-0 flex items-center justify-center transition-transform group-hover:scale-105 duration-500 relative">
                                                    {dungeon.imageUrl
                                                        ? <img src={dungeon.imageUrl} alt="" className="w-full h-full object-cover" />
                                                        : <Trophy className="w-6 h-6 text-zinc-700" />
                                                    }
                                                    {dungeon.isOcreQuest && (
                                                        <img
                                                            src="/module-dofus/Dofus_Ocre.png"
                                                            alt="Quête Ocre"
                                                            title="Donjon de la Quête Ocre"
                                                            className="absolute -bottom-1.5 -right-1.5 w-5 h-5 object-contain rounded-full bg-zinc-950/80 border border-amber-500/30 p-0.5 shadow-lg"
                                                        />
                                                    )}
                                                </div>
                                                <div className="relative shrink-0 mt-1">
                                                    <ProgressRing
                                                        pct={pct}
                                                        size={40}
                                                        stroke={4}
                                                        color={isComplete ? "#10b981" : "#6366f1"}
                                                    />
                                                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white">
                                                        {done}<span className="text-[8px] opacity-40 mx-0.5">/</span>{dungeon.achievements.length}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Name & Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-black text-white line-clamp-2 leading-snug group-hover:text-indigo-300 transition-colors uppercase tracking-tight">
                                                    {dungeon.name}
                                                </p>
                                                <div className="flex items-center gap-1.5 mt-2">
                                                    <span className="text-[10px] font-black text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded border border-white/5">LVL {dungeon.level}</span>
                                                    {isComplete && (
                                                        <div className="flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                                                            <span className="text-[9px] text-emerald-400 font-black uppercase tracking-tighter">FINI</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                )}
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {filteredDungeons.length === 0 && (
                <div className="py-16 text-center text-zinc-600">
                    <Trophy className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="font-medium">Aucun donjon trouvé.</p>
                </div>
            )}
        </div>
    );
}
