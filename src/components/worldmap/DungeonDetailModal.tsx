"use client";
// dark-locked — module volontairement sombre (V2 Dual-Theme Phase 2C) : ne PAS utiliser les tokens thème-aware ici (voir memo 21/08 + prompt 22/08).

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X, Sword, Users, Trophy, ChevronDown, CheckCircle2, Circle, Info, Loader2,
    MapPin, Crown, ChevronRight
} from "lucide-react";
import { getDungeonDirectory } from "@/server/actions/dungeon-finder-actions";
import { searchDungeons } from "@/server/actions/game-data-actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getClass } from "@/lib/dofus-assets";

interface Dungeon {
    id: string | number;
    name: any;
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

interface DungeonDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    dungeons: Dungeon[];
    guildId: string;
}

export function DungeonDetailModal({ isOpen, onClose, dungeons, guildId }: DungeonDetailModalProps) {
    const [selectedDungeonIndex, setSelectedDungeonIndex] = useState(0);
    const [directoryData, setDirectoryData] = useState<AchievementDirectory[]>([]);
    const [resolvedDj, setResolvedDj] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [expandedAchv, setExpandedAchv] = useState<string | null>(null);

    const dungeon = dungeons[selectedDungeonIndex];
    const isOcreQuest = !!(dungeon as any).__isOcreQuest;

    useEffect(() => {
        if (isOpen && dungeon) {
            setLoading(true);
            setDirectoryData([]);
            setExpandedAchv(null);
            setResolvedDj(null);
            
            const dName = typeof dungeon.name === 'string' ? dungeon.name : dungeon.name?.fr;
            
            // Resolve real DJ info for official boss name, image, etc.
            searchDungeons(dName || dungeon.id.toString()).then(res => {
                if (res.success && res.data && res.data.length > 0) {
                    setResolvedDj(res.data[0]);
                }
            });

            getDungeonDirectory(guildId, dungeon.id.toString(), dName).then((res) => {
                if (res.success && res.data) {
                    setDirectoryData(res.data);
                    if (res.data.length > 0) {
                        setExpandedAchv(res.data[0].achievementId);
                    }
                }
                setLoading(false);
            });
        }
    }, [isOpen, dungeon, guildId]);

    if (!isOpen || !dungeon) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent 
                showCloseButton={false} 
                className="w-[95vw] max-w-2xl bg-[#0a0f18] border border-border shadow-[0_50px_100px_rgba(0,0,0,0.8)] rounded-[2rem] md:rounded-[2.5rem] text-foreground overflow-hidden p-0 gap-0 flex flex-col h-[min(750px,85vh)]"
            >
                
                {/* Header with Background Image */}
                <div className="relative h-48 bg-background border-b border-border overflow-hidden shrink-0">
                    {(resolvedDj?.imageUrl || dungeon.imageUrl) && (
                        <motion.img 
                            initial={{ scale: 1.1, opacity: 0 }}
                            animate={{ scale: 1, opacity: 0.3 }}
                            src={resolvedDj?.imageUrl || dungeon.imageUrl} 
                            alt="" 
                            className="absolute inset-0 w-full h-full object-cover" 
                        />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f18] via-[#0a0f18]/40 to-transparent" />
                    
                    <button 
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 rounded-xl bg-surface hover:bg-surface border border-border text-foreground/50 hover:text-foreground transition-all z-20"
                    >
                        <X size={20} />
                    </button>

                    <div className="absolute bottom-6 left-6 right-6 md:left-8 md:right-8 flex items-end justify-between gap-4 z-10">
                        <div className="flex items-center gap-4 md:gap-6">
                            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-surface/80 border border-border shadow-2xl overflow-hidden flex items-center justify-center shrink-0">
                                {(resolvedDj?.imageUrl || dungeon.imageUrl) ? (
                                    <img src={resolvedDj?.imageUrl || dungeon.imageUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <Sword className="w-8 h-8 text-muted-foreground" />
                                )}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-3 mb-1">
                                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-500 text-caption md:text-caption font-black uppercase tracking-widest italic">
                                        Lvl {resolvedDj?.level || dungeon.level}
                                    </span>
                                    {isOcreQuest && (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 text-caption md:text-caption font-black uppercase tracking-widest italic">
                                            <img src="/module-dofus/Dofus_Ocre.png" alt="" className="w-3 h-3 object-contain" />
                                            Quête Ocre
                                        </span>
                                    )}
                                </div>
                                <h2 className="text-xl md:text-3xl font-black text-foreground truncate drop-shadow-2xl uppercase italic tracking-tighter">
                                    {resolvedDj?.name || (typeof dungeon.name === 'string' ? dungeon.name : dungeon.name?.fr || "Donjon")}
                                </h2>
                                <p className="text-caption md:text-sm font-bold text-foreground/40 flex items-center gap-2 uppercase tracking-[0.2em]">
                                    <Sword size={12} className="text-amber-500" /> {resolvedDj?.bossName || "Boss Inconnu"}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navigation if multiple dungeons */}
                {dungeons.length > 1 && (
                    <div className="flex bg-black/40 border-b border-border p-2 gap-2 overflow-x-auto custom-scrollbar">
                        {dungeons.map((d, idx) => (
                            <button
                                key={d.id}
                                onClick={() => setSelectedDungeonIndex(idx)}
                                className={`px-4 py-2 rounded-xl text-caption font-black uppercase italic transition-all whitespace-nowrap ${
                                    selectedDungeonIndex === idx 
                                        ? "bg-amber-600 text-warning-foreground shadow-lg shadow-amber-600/20" 
                                        : "bg-surface text-foreground/30 hover:bg-surface hover:text-foreground/50 border border-border"
                                }`}
                            >
                                {typeof d.name === 'string' ? d.name : d.name?.fr || "Donjon"}
                            </button>
                        ))}
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto custom-scrollbar bg-[#0a0f18]/20">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
                            <p className="text-foreground/20 font-black uppercase text-caption tracking-widest animate-pulse">Analyse des Succès de Guilde...</p>
                        </div>
                    ) : directoryData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-4 bg-surface border border-dashed border-border rounded-3xl">
                            <div className="w-12 h-12 rounded-2xl bg-surface flex items-center justify-center border border-border">
                                <Info className="text-foreground/20" size={24} />
                            </div>
                            <p className="text-foreground/30 font-bold text-sm italic">Aucun succès répertorié pour ce donjon.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center gap-4 mb-6">
                                <h3 className="text-foreground/20 font-black uppercase text-caption tracking-widest">Répertoire des Succès</h3>
                                <div className="flex-1 h-px bg-surface" />
                            </div>

                            {directoryData.map((achv) => {
                                const isExpanded = expandedAchv === achv.achievementId;
                                const completionRate = Math.round((achv.hasCompleted.length / (achv.hasCompleted.length + achv.missing.length)) * 100);

                                return (
                                    <div 
                                        key={achv.achievementId}
                                        className={`rounded-[1.5rem] border transition-all duration-300 overflow-hidden ${
                                            isExpanded 
                                                ? "bg-surface border-amber-500/30 shadow-2xl" 
                                                : "bg-surface border-border hover:border-border hover:bg-surface"
                                        }`}
                                    >
                                        <button
                                            onClick={() => setExpandedAchv(isExpanded ? null : achv.achievementId)}
                                            className="w-full flex items-center justify-between p-4 px-6 text-left"
                                        >
                                            <div className="flex items-center gap-4 flex-1">
                                                <div className="w-12 h-12 rounded-xl bg-black/40 border border-border flex items-center justify-center shrink-0 shadow-inner group">
                                                    {achv.iconUrl ? (
                                                        <img src={achv.iconUrl} alt="" className="w-8 h-8 object-contain drop-shadow-md group- transition-transform" />
                                                    ) : (
                                                        <Trophy className="text-amber-500" size={20} />
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="text-xs md:text-sm font-black text-foreground uppercase italic tracking-tight truncate">{achv.achievementName}</h4>
                                                    <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-1">
                                                        <span className="text-caption md:text-caption font-black text-amber-500 bg-amber-500/10 px-1.5 md:px-2 py-0.5 rounded-lg border border-amber-500/20">
                                                            {achv.points} PTS
                                                        </span>
                                                        <span className="text-caption md:text-caption font-bold text-foreground/30 uppercase tracking-widest">
                                                            Complétion : {completionRate}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isExpanded ? "bg-amber-500/20 text-amber-500" : "bg-surface text-foreground/20 border border-border"}`}>
                                                <ChevronDown size={14} className={`transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
                                            </div>
                                        </button>

                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                                                    className="px-6 pb-6"
                                                >
                                                    <div className="pt-6 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        {/* Missing List */}
                                                        <div className="space-y-4 flex flex-col h-full">
                                                            <div className="flex items-center justify-between shrink-0">
                                                                <span className="text-caption font-black text-rose-500 uppercase tracking-widest flex items-center gap-2">
                                                                    <Circle size={8} fill="currentColor" /> Cherchent encore
                                                                </span>
                                                                <span className="text-caption font-black text-foreground/20 bg-surface px-2 py-0.5 rounded-lg">
                                                                    {achv.missing.length}
                                                                </span>
                                                            </div>
                                                            <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                                                                {achv.missing.length > 0 ? achv.missing.map((member) => (
                                                                    <MemberPill key={member.id} member={member} isMissing />
                                                                )) : (
                                                                    <p className="text-caption text-foreground/10 italic py-2">Tout le monde a validé ! 🎉</p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Completed List */}
                                                        <div className="space-y-4 flex flex-col h-full">
                                                            <div className="flex items-center justify-between shrink-0">
                                                                <span className="text-caption font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                                                                    <CheckCircle2 size={8} fill="currentColor" /> Déjà validé
                                                                </span>
                                                                <span className="text-caption font-black text-foreground/20 bg-surface px-2 py-0.5 rounded-lg">
                                                                    {achv.hasCompleted.length}
                                                                </span>
                                                            </div>
                                                            <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                                                                {achv.hasCompleted.length > 0 ? achv.hasCompleted.map((member) => (
                                                                    <MemberPill key={member.id} member={member} />
                                                                )) : (
                                                                    <p className="text-caption text-foreground/10 italic py-2">Aucun succès validé.</p>
                                                                )}
                                                            </div>
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
                </div>

                {/* Footer / Actions */}
                <div className="p-6 bg-surface border-t border-border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                             <Users size={14} />
                        </div>
                        <p className="text-caption text-foreground/30 font-bold uppercase tracking-widest leading-tight">
                            Consultez les membres de guilde<br/>pour organiser vos groupes
                        </p>
                    </div>
                    <a 
                        href={`/dashboard/${guildId}/donjons-et-quetes`}
                        className="px-6 py-3 rounded-2xl bg-amber-600 text-warning-foreground font-black text-caption uppercase italic shadow-lg shadow-amber-600/20 hover:bg-amber-500 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                    >
                        Créer un groupe <ChevronRight size={14} />
                    </a>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function MemberPill({ member, isMissing }: { member: any, isMissing?: boolean }) {
    const classInfo = member.classe ? getClass(member.classe) : null;
    
    return (
        <div className={`flex items-center gap-3 p-2 rounded-xl border transition-all ${isMissing ? "bg-surface border-border hover:border-border" : "bg-emerald-500/5 border-emerald-500/10 opacity-60"}`}>
            <div className="w-6 h-6 rounded-lg bg-black/40 border border-border overflow-hidden flex items-center justify-center shrink-0">
                {member.imageUrl ? (
                    <img src={member.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                    <Users size={12} className="text-foreground/20" />
                )}
            </div>
            <span className="text-caption font-bold text-foreground/70 truncate flex-1 uppercase tracking-tighter">
                {member.name}
            </span>
            {classInfo && (
                <div className="w-4 h-4 rounded overflow-hidden opacity-50 shadow-inner">
                    <img src={classInfo.icon} alt={member.classe} className="w-full h-full object-contain" />
                </div>
            )}
        </div>
    );
}
