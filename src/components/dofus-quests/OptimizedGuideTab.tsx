"use client";

import React, { useState, useEffect } from "react";
import { Navigation, ChevronRight, Check, CheckCircle2, Circle, Sparkles, Users, Calendar, MapPin, Sword, Package, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getOptimizedGuideDetail, getGuildOptimizedGuideProgress } from "@/server/actions/optimized-guide-actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

interface OptimizedGuideTabProps {
    initialGuides: any[];
    guildId: string;
}

export function OptimizedGuideTab({ initialGuides, guildId }: OptimizedGuideTabProps) {
    const { data: session } = useSession();
    const router = useRouter();
    const [selectedGuideSlug, setSelectedGuideSlug] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [guideData, setGuideData] = useState<any>(null);
    const [questsDetail, setQuestsDetail] = useState<any[]>([]);
    const [memberProgress, setMemberProgress] = useState<any[]>([]);
    const [selectedStepIndex, setSelectedStepIndex] = useState(0);

    // Filtrer le guide rush-sylvestre qui a déjà sa carte dédiée dans le hub principal
    const filteredGuides = React.useMemo(() => {
        return (initialGuides || []).filter(g => g.slug !== "rush-sylvestre");
    }, [initialGuides]);

    const [redirecting, setRedirecting] = useState(filteredGuides && filteredGuides.length === 1);

    useEffect(() => {
        if (filteredGuides && filteredGuides.length === 1) {
            router.replace(`/dashboard/${guildId}/quetes-dofus/guide/${filteredGuides[0].slug}`);
        } else {
            setRedirecting(false);
        }
    }, [filteredGuides, guildId, router]);

    const handleSelectGuide = (slug: string) => {
        router.push(`/dashboard/${guildId}/quetes-dofus/guide/${slug}`);
    };

    if (redirecting) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4 animate-pulse">
                <div className="w-12 h-12 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Chargement de votre feuille de route...</p>
            </div>
        );
    }

    // Helper to get quest info
    const getQuestInfo = (id: string) => questsDetail.find(q => q.id === id);

    // Determines if a step is completed for the current user
    const isStepCompleted = (step: any) => {
        const objectives = step.objectives as any[] || [];
        const questIds = step.questIds || [];
        
        // Check quests
        const allQuestIds = [...new Set([...questIds, ...objectives.filter(o => o.type === 'QUEST').map(o => o.id)])];
        if (allQuestIds.length === 0) return true;

        return allQuestIds.every(qid => {
            const q = getQuestInfo(qid);
            return q?.playerProgress?.length > 0 && q.playerProgress[0].status === "COMPLETED";
        });
    };

    if (selectedGuideSlug && guideData && guideData.steps) {
        // --- DETAIL VIEW (Legacy fallback) ---
        const totalSteps = guideData.steps?.length || 0;
        const completedSteps = guideData.steps?.filter((s: any) => isStepCompleted(s)).length || 0;
        const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

        return (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                {/* Header / Back */}
                <div className="flex items-center justify-between">
                    <button 
                        onClick={() => setSelectedGuideSlug(null)}
                        className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors group"
                    >
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10">
                             <ChevronRight className="w-4 h-4 rotate-180" />
                        </div>
                        <span className="text-sm font-bold uppercase tracking-widest">Retour aux guides</span>
                    </button>

                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex flex-col items-end">
                            <span className="text-caption font-black uppercase text-zinc-500 tracking-tighter">Votre progression</span>
                            <span className="text-sm font-bold text-emerald-400">{completedSteps} / {totalSteps} Étapes</span>
                        </div>
                        <div className="w-32 h-2 bg-zinc-800 rounded-full overflow-hidden">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercent}%` }}
                                className="h-full bg-emerald-500 "
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* Left: The Roadmap (4 columns) */}
                    <div className="lg:col-span-5 space-y-6">
                        <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-6 relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-8 opacity-5">
                                <Navigation className="w-32 h-32 rotate-12" />
                             </div>

                             <h2 className="text-3xl font-black text-white mb-2">{guideData.name}</h2>
                             <p className="text-zinc-500 text-sm leading-relaxed mb-8">{guideData.description || "Suivez cet itinéraire pour optimiser votre progression."}</p>

                             <div className="relative pl-8 space-y-12 pb-4">
                                {/* Vertical Line */}
                                <div className="absolute top-2 bottom-2 left-3 w-0.5 bg-zinc-800">
                                     <motion.div 
                                        initial={{ height: 0 }}
                                        animate={{ height: `${progressPercent}%` }}
                                        className="w-full bg-emerald-500"
                                     />
                                </div>

                                {guideData.steps.map((step: any, idx: number) => {
                                    const isDone = isStepCompleted(step);
                                    const active = selectedStepIndex === idx;
                                    const membersHere = memberProgress.filter(mp => mp.currentStepIndex === idx && !mp.isFinished);

                                    return (
                                        <div 
                                            key={step.id} 
                                            onClick={() => setSelectedStepIndex(idx)}
                                            className={`relative z-10 flex items-start gap-6 cursor-pointer group transition-all duration-300 ${active ? 'scale-105' : 'opacity-60 hover:opacity-100'}`}
                                        >
                                            {/* Node */}
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 border-2 
                                                ${isDone ? 'bg-emerald-500 border-emerald-400 ' : 'bg-zinc-900 border-zinc-700 group-hover:border-zinc-500'}
                                                ${active && !isDone ? 'ring-4 ring-emerald-500/20 border-emerald-500' : ''}`}>
                                                {isDone ? <Check className="w-3 h-3 text-emerald-950 font-black" /> : null}
                                            </div>

                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs font-black uppercase tracking-widest ${isDone ? 'text-emerald-500' : 'text-zinc-500'}`}>Étape {idx + 1}</span>
                                                    {membersHere.length > 0 && (
                                                        <div className="flex -space-x-2 ml-2">
                                                            {membersHere.slice(0, 3).map((mp, i) => (
                                                                <Avatar key={mp.profile.id} className="w-5 h-5 border border-zinc-900 shadow-md">
                                                                    <AvatarImage src={mp.profile.user?.image} />
                                                                    <AvatarFallback>{mp.profile.user?.name?.[0]}</AvatarFallback>
                                                                </Avatar>
                                                            ))}
                                                            {membersHere.length > 3 && (
                                                                <div className="w-5 h-5 rounded-full bg-zinc-800 text-caption font-bold flex items-center justify-center border border-zinc-900 text-white">+{membersHere.length - 3}</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <h3 className={`font-bold transition-colors ${active ? 'text-white' : 'text-zinc-300'}`}>{step.title}</h3>
                                            </div>
                                        </div>
                                    );
                                })}
                             </div>
                        </div>
                    </div>

                    {/* Right: Step Detail (7 columns) */}
                    <div className="lg:col-span-7">
                        <AnimatePresence mode="wait">
                            <motion.div 
                                key={selectedStepIndex}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="bg-gradient-to-br from-zinc-900 to-black border border-white/10 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden min-h-[500px]"
                            >
                                <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                                    <Sparkles className="w-64 h-64 text-emerald-500" />
                                </div>

                                {guideData.steps[selectedStepIndex] ? (
                                    <div className="relative z-10 space-y-8">
                                        <div>
                                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-caption font-black text-emerald-400 uppercase tracking-[0.2em] mb-4">
                                                Détails de l'objectif
                                            </div>
                                            <h3 className="text-4xl font-black text-white leading-tight mb-4">{guideData.steps[selectedStepIndex].title}</h3>
                                            <p className="text-zinc-400 leading-relaxed text-lg">{guideData.steps[selectedStepIndex].description || "Terminez les objectifs suivants pour passer à l'étape suivante."}</p>
                                        </div>

                                        <div className="space-y-4">
                                            {/* Merged Objectives List */}
                                            {(() => {
                                                const step = guideData.steps[selectedStepIndex];
                                                const objectives = step.objectives as any[] || [];
                                                // Handle legacy questIds if not migrated yet
                                                const legacyQuests = (step.questIds || []).filter((id:string) => !objectives.find(o => o.id === id)).map((id:string) => ({ id, type: 'QUEST' }));
                                                const items = [...objectives, ...legacyQuests];

                                                if (items.length === 0) return (
                                                    <div className="py-12 border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center text-zinc-600 italic">
                                                        Aucun objectif spécifique pour cette étape.
                                                    </div>
                                                );

                                                return items.map((obj, i) => {
                                                    const isQuest = obj.type === 'QUEST';
                                                    const isDungeon = obj.type === 'DUNGEON';
                                                    const isResource = obj.type === 'RESOURCE';
                                                    
                                                    let name = obj.name;
                                                    let isDone = false;
                                                    let subtitle = "";
                                                    let img = obj.imageUrl;

                                                    if (isQuest) {
                                                        const info = getQuestInfo(obj.id);
                                                        name = info?.name || obj.name || "Quête inconnue";
                                                        isDone = info?.playerProgress?.[0]?.status === "COMPLETED";
                                                        subtitle = info?.chain?.dofus?.name || "Catégorie Quête";
                                                        img = img || info?.chain?.dofus?.localImageUrl || info?.chain?.dofus?.imageUrl;
                                                    } else {
                                                        // Manual completion for others for now, unless we check boss kills later
                                                        subtitle = obj.type === 'DUNGEON' ? 'Donjon' : obj.type === 'RESOURCE' ? `Ressource (${obj.quantity || 1}x)` : 'Objectif';
                                                    }

                                                    return (
                                                        <div 
                                                            key={i} 
                                                            className={`group p-5 rounded-2xl border transition-all flex items-center justify-between ${isDone ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-black/40 border-white/5 hover:border-white/20'}`}
                                                        >
                                                            <div className="flex items-center gap-4">
                                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border ${isDone ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-zinc-800/50 border-white/5'}`}>
                                                                    {img ? (
                                                                        <img src={img} alt="" className="w-8 h-8 object-contain" />
                                                                    ) : (
                                                                        isDungeon ? <Sword className="w-6 h-6 text-indigo-400" /> : <Package className="w-6 h-6 text-amber-400" />
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <div className={`text-caption uppercase font-black tracking-widest ${isDone ? 'text-emerald-500' : 'text-zinc-500'}`}>{subtitle}</div>
                                                                    <div className={`font-bold text-lg ${isDone ? 'text-emerald-400' : 'text-zinc-200'}`}>{name}</div>
                                                                </div>
                                                            </div>

                                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isDone ? 'bg-emerald-500 text-emerald-950' : 'bg-white/5 text-zinc-600'}`}>
                                                                {isDone ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6 opacity-40" />}
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-zinc-500">Sélectionnez une étape pour voir les détails.</div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                </div>
            </div>
        );
    }

    // --- LIST VIEW ---
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {filteredGuides.map((guide) => (
                <div 
                    key={guide.id} 
                    onClick={() => handleSelectGuide(guide.slug)}
                    className="group relative bg-zinc-900 border border-white/5 rounded-[2.5rem] p-8 cursor-pointer hover:border-emerald-500/30 transition-all duration-300 hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden"
                >
                    {/* Background Glow */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 blur-[80px] group-hover:bg-emerald-500/20 transition-all" />
                    
                    <div className="relative z-10 flex flex-col h-full">
                        <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 group- transition-transform">
                             <Navigation className="w-8 h-8 text-emerald-400 " />
                        </div>

                        <h3 className="text-2xl font-black text-white mb-2 group-hover:text-emerald-400 transition-colors uppercase tracking-tight">
                            {guide.name}
                        </h3>
                        <p className="text-zinc-500 text-sm line-clamp-2 mb-8 h-10">
                            {guide.description || "Un itinéraire complet et optimisé pour atteindre vos objectifs."}
                        </p>

                        <div className="mt-auto flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col">
                                    <span className="text-caption font-black text-zinc-600 uppercase tracking-widest leading-none mb-1">Étapes</span>
                                    <span className="text-lg font-black text-white">{guide.steps?.length || 0}</span>
                                </div>
                                <div className="w-[1px] h-8 bg-white/5" />
                                <div className="flex flex-col">
                                    <span className="text-caption font-black text-zinc-600 uppercase tracking-widest leading-none mb-1">Type</span>
                                    <span className="text-lg font-black text-white">Route Opti</span>
                                </div>
                            </div>

                            <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-all group-hover:translate-x-1">
                                <ChevronRight className="w-6 h-6 text-zinc-400" />
                            </div>
                        </div>
                    </div>
                </div>
            ))}

            {filteredGuides.length === 0 && (
                <div className="col-span-full py-20 bg-white/5 border border-dashed border-white/10 rounded-[3rem] text-center flex flex-col items-center justify-center">
                    <Navigation className="w-12 h-12 text-zinc-600 mb-4 opacity-20" />
                    <h3 className="text-xl font-bold text-white/50">Aucun guide configuré</h3>
                    <p className="text-zinc-600 text-sm max-w-xs">Les administrateurs n'ont pas encore publié de routes optimisées.</p>
                </div>
            )}
        </div>
    );
}
