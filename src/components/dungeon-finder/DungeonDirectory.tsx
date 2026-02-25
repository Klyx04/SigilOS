"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Users, Trophy, ChevronLeft, ChevronDown, CheckCircle2, Circle, Sword, Info } from "lucide-react";
import { getDungeonsWithAchievements } from "@/server/actions/game-data-actions";
import { getDungeonDirectory } from "@/server/actions/dungeon-finder-actions";
import { Button } from "@/components/ui/button";
import { getClass } from "@/lib/dofus-assets";

interface Dungeon {
    id: string;
    name: string;
    bossName: string;
    level: number;
    imageUrl?: string | null;
}

interface AchievementDirectory {
    achievementId: string;
    achievementName: string;
    iconUrl: string | null;
    points: number;
    hasCompleted: { id: string; name: string; imageUrl: string | null; classe: string | null }[];
    missing: { id: string; name: string; imageUrl: string | null; classe: string | null }[];
}

interface DungeonDirectoryProps {
    guildId: string;
    onCreatePost?: (dungeonId: string) => void;
}

export function DungeonDirectory({ guildId, onCreatePost }: DungeonDirectoryProps) {
    const [dungeons, setDungeons] = useState<Dungeon[]>([]);
    const [search, setSearch] = useState("");
    const [selectedDungeon, setSelectedDungeon] = useState<Dungeon | null>(null);
    const [directoryData, setDirectoryData] = useState<AchievementDirectory[]>([]);
    const [loadingDb, setLoadingDb] = useState(true);
    const [loadingDir, setLoadingDir] = useState(false);
    const [expandedAchv, setExpandedAchv] = useState<string | null>(null);

    useEffect(() => {
        getDungeonsWithAchievements().then((res) => {
            if (res.success && res.data) {
                // Remove duplicates if any and sort by level
                const uniqueDungeons = Array.from(new Map(res.data.map((item: any) => [item.id, item])).values()) as Dungeon[];
                setDungeons(uniqueDungeons.sort((a, b) => b.level - a.level));
            }
            setLoadingDb(false);
        });
    }, []);

    const filteredDungeons = useMemo(() => {
        if (!search) return dungeons;
        const term = search.toLowerCase();
        return dungeons.filter(
            (d) => d.name.toLowerCase().includes(term) || d.bossName.toLowerCase().includes(term)
        );
    }, [dungeons, search]);

    async function handleSelectDungeon(dungeon: Dungeon) {
        setSelectedDungeon(dungeon);
        setLoadingDir(true);
        setDirectoryData([]);
        setExpandedAchv(null);

        const res = await getDungeonDirectory(guildId, dungeon.id);
        if (res.success && res.data) {
            setDirectoryData(res.data);
            if (res.data.length > 0) {
                setExpandedAchv(res.data[0].achievementId); // auto expand first
            }
        }
        setLoadingDir(false);
    }

    if (loadingDb) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 animate-pulse">
                <Users className="w-10 h-10 mb-4 opacity-50" />
                <p className="font-medium">Chargement de la base de données...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <AnimatePresence mode="wait">
                {!selectedDungeon ? (
                    <motion.div
                        key="list"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="space-y-6"
                    >
                        {/* Header & Search */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-black text-white flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                                        <Users className="w-4 h-4 text-indigo-400" />
                                    </div>
                                    Succès Dj en commun
                                </h2>
                                <p className="text-sm text-slate-400 mt-1 ml-10">
                                    Trouve qui a ou n'a pas encore validé chaque succès de donjon dans la guilde.
                                </p>
                            </div>
                            <div className="relative w-full md:w-72">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Rechercher un donjon…"
                                    className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 backdrop-blur-sm transition-all"
                                />
                            </div>
                        </div>

                        {/* Grid of Dungeons */}
                        {filteredDungeons.length > 0 ? (
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                                {filteredDungeons.map((dungeon) => (
                                    <motion.button
                                        key={dungeon.id}
                                        whileHover={{ y: -2, scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => handleSelectDungeon(dungeon)}
                                        className="relative group overflow-hidden rounded-lg flex flex-col items-center text-center border border-slate-800/80 bg-slate-950 hover:border-indigo-500/40 shadow-md transition-all p-2 pb-2.5"
                                    >
                                        {/* Image */}
                                        <div className="w-full aspect-square flex items-center justify-center mb-1.5">
                                            {dungeon.imageUrl ? (
                                                <img
                                                    src={dungeon.imageUrl}
                                                    alt={dungeon.name}
                                                    className="w-4/5 h-4/5 object-contain drop-shadow-lg group-hover:scale-110 transition-transform duration-300"
                                                />
                                            ) : (
                                                <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center">
                                                    <Search className="w-5 h-5 text-slate-600" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="w-full">
                                            <div className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 mb-1">
                                                Lvl {dungeon.level}
                                            </div>
                                            <h3 className="text-[11px] font-bold text-slate-300 leading-tight line-clamp-2 group-hover:text-white transition-colors">
                                                {dungeon.name}
                                            </h3>
                                        </div>
                                    </motion.button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-slate-500">
                                <Search className="w-8 h-8 mx-auto mb-3 opacity-20" />
                                <p>Aucun donjon trouvé pour "{search}"</p>
                            </div>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        key="details"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                    >
                        {/* Selected Dungeon Hero */}
                        <div className="relative rounded-3xl overflow-hidden border border-slate-700/50 bg-slate-900 shadow-2xl">
                            {selectedDungeon.imageUrl && (
                                <div className="absolute inset-0 w-full h-full">
                                    <img
                                        src={selectedDungeon.imageUrl}
                                        alt=""
                                        className="w-full h-full object-cover opacity-20"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/90 to-transparent" />
                                </div>
                            )}
                            <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                                <div>
                                    <button
                                        onClick={() => setSelectedDungeon(null)}
                                        className="inline-flex items-center text-xs font-bold text-slate-400 hover:text-white mb-3 transition-colors bg-slate-800/50 hover:bg-slate-700/50 px-3 py-1.5 rounded-full backdrop-blur-md"
                                    >
                                        <ChevronLeft className="w-4 h-4 mr-1" /> Retour à l'annuaire
                                    </button>
                                    <div className="flex items-center gap-3">
                                        <div className="px-2 py-1 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded-lg text-xs font-black backdrop-blur-md">
                                            Lvl {selectedDungeon.level}
                                        </div>
                                    </div>
                                    <h2 className="text-3xl md:text-4xl font-black text-white mt-2 drop-shadow-lg">
                                        {selectedDungeon.name}
                                    </h2>
                                    <p className="text-sm text-slate-400 mt-1 flex items-center gap-1.5">
                                        <Sword className="w-4 h-4" /> {selectedDungeon.bossName}
                                    </p>
                                </div>
                                <div className="shrink-0 flex gap-3">
                                    {onCreatePost && (
                                        <Button
                                            onClick={() => onCreatePost(selectedDungeon.id)}
                                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-black shadow-xl shadow-indigo-900/50 transition-all hover:scale-105"
                                        >
                                            <Users className="w-4 h-4 mr-2" />
                                            Créer un groupe
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Directory Content */}
                        {loadingDir ? (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-500 animate-pulse bg-slate-900/30 rounded-3xl border border-slate-800/50">
                                <Search className="w-8 h-8 mb-3 opacity-50" />
                                <p>Analyse des succès de la guilde...</p>
                            </div>
                        ) : directoryData.length === 0 ? (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 text-center text-amber-200/80">
                                <Info className="w-8 h-8 mx-auto mb-2 opacity-60 text-amber-500" />
                                <p>Ce donjon ne possède aucun succès recensé dans la base.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {directoryData.map((achv) => {
                                    const isExpanded = expandedAchv === achv.achievementId;
                                    const totalMembers = achv.hasCompleted.length + achv.missing.length;
                                    const completionRate = totalMembers > 0
                                        ? Math.round((achv.hasCompleted.length / totalMembers) * 100)
                                        : 0;

                                    return (
                                        <div
                                            key={achv.achievementId}
                                            className={`rounded-2xl transition-all duration-300 overflow-hidden border ${isExpanded ? 'bg-slate-900/90 border-indigo-500/30 shadow-2xl shadow-indigo-900/10' : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-900/60'}`}
                                        >
                                            <button
                                                onClick={() => setExpandedAchv(isExpanded ? null : achv.achievementId)}
                                                className="w-full flex items-center justify-between p-4 md:p-5 text-left focus:outline-none"
                                            >
                                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700/50">
                                                        {achv.iconUrl ? (
                                                            <img src={achv.iconUrl} alt="" className="w-6 h-6 object-contain" />
                                                        ) : (
                                                            <Trophy className="w-5 h-5 text-indigo-400" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-base font-bold text-white leading-snug">
                                                            {achv.achievementName}
                                                        </h4>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[11px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                                                                {achv.points} pts
                                                            </span>
                                                            <span className="text-[11px] text-slate-500">
                                                                {completionRate}% de la guilde l'ont validé
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 shrink-0">
                                                    {/* Avatars Preview */}
                                                    {!isExpanded && achv.missing.length > 0 && (
                                                        <div className="hidden sm:flex -space-x-2 mr-2">
                                                            {achv.missing.slice(0, 3).map((m, i) => (
                                                                <div key={i} className="w-7 h-7 rounded-full border-2 border-slate-900 bg-slate-800 overflow-hidden relative">
                                                                    {m.imageUrl ? (
                                                                        <img src={m.imageUrl} alt="" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <Users className="w-3 h-3 m-1.5 text-slate-500" />
                                                                    )}
                                                                </div>
                                                            ))}
                                                            {achv.missing.length > 3 && (
                                                                <div className="w-7 h-7 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[9px] font-bold text-slate-400 z-10">
                                                                    +{achv.missing.length - 3}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isExpanded ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-400'}`}>
                                                        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                                    </div>
                                                </div>
                                            </button>

                                            <AnimatePresence>
                                                {isExpanded && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden border-t border-slate-800/50"
                                                    >
                                                        <div className="p-5 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 bg-slate-950/30">
                                                            {/* Col 1: MISSING */}
                                                            <div className="bg-slate-900/60 border border-rose-900/20 rounded-2xl p-4">
                                                                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                                                                    <div className="flex items-center gap-2 font-bold text-sm">
                                                                        <div className="w-6 h-6 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                                                                            <Circle className="w-3.5 h-3.5 text-rose-400" />
                                                                        </div>
                                                                        <span className="text-rose-300">Cherchent encore</span>
                                                                    </div>
                                                                    <span className="text-xs font-black bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full border border-rose-500/20">
                                                                        {achv.missing.length}
                                                                    </span>
                                                                </div>

                                                                {achv.missing.length > 0 ? (
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {achv.missing.map((member) => (
                                                                            <MemberPill key={member.id} member={member} variant="missing" />
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-sm text-slate-500 italic text-center py-4">
                                                                        Tout le monde a validé ce succès ! 🎉
                                                                    </p>
                                                                )}
                                                            </div>

                                                            {/* Col 2: HAS COMPLETED */}
                                                            <div className="bg-emerald-950/20 border border-emerald-900/20 rounded-2xl p-4">
                                                                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/50">
                                                                    <div className="flex items-center gap-2 font-bold text-sm">
                                                                        <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                                                        </div>
                                                                        <span className="text-emerald-300">Déjà validé</span>
                                                                    </div>
                                                                    <span className="text-xs font-black bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                                                        {achv.hasCompleted.length}
                                                                    </span>
                                                                </div>

                                                                {achv.hasCompleted.length > 0 ? (
                                                                    <div className="flex flex-wrap gap-2 opacity-70 hover:opacity-100 transition-opacity">
                                                                        {achv.hasCompleted.map((member) => (
                                                                            <MemberPill key={member.id} member={member} variant="completed" />
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-sm text-slate-600 italic text-center py-4">
                                                                        Personne n'a encore validé ce succès.
                                                                    </p>
                                                                )}
                                                            </div>

                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function MemberPill({ member, variant }: { member: any, variant: 'missing' | 'completed' }) {
    const isMissing = variant === 'missing';

    return (
        <div className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border transition-colors ${isMissing
            ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 hover:border-slate-500 text-slate-200'
            : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}>
            <div className={`w-6 h-6 rounded-full overflow-hidden shrink-0 ${!member.imageUrl && 'bg-slate-700 flex items-center justify-center'}`}>
                {member.imageUrl ? (
                    <img src={member.imageUrl} alt={member.name} className="w-full h-full object-cover" />
                ) : (
                    <Users className="w-3 h-3 text-slate-400" />
                )}
            </div>

            <span className="text-xs font-medium truncate max-w-[100px]">{member.name}</span>

            {member.classe && (() => {
                const cls = getClass(member.classe);
                return cls ? (
                    <img
                        src={cls.icon}
                        alt={member.classe}
                        className={`w-3.5 h-3.5 object-contain opacity-60 ${isMissing ? 'grayscale-0' : 'grayscale'}`}
                        title={member.classe}
                    />
                ) : null;
            })()}
        </div>
    );
}
