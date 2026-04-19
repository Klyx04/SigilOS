"use client";

import React, { useState } from "react";
import { CheckCircle2, Circle, ChevronRight, Check } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";

export default function OptimizedGuideClient({ 
    guide, 
    questsDetail, 
    memberProgress,
    currentUserId
}: { 
    guide: any, 
    questsDetail: any[], 
    memberProgress: any[],
    currentUserId: string
}) {
    const [selectedStep, setSelectedStep] = useState<number>(0);
    const [showPlayers, setShowPlayers] = useState(true);

    const getQuestData = (id: string) => questsDetail.find(q => q.id === id);

    // Determines if a step is 100% completed by the current user
    const checkStepCompletion = (step: any) => {
        if (!step.questIds || step.questIds.length === 0) return true; // Empty steps are "done" or manual. For manual we could have a manual toggle, but let's stick to quests for now.
        return step.questIds.every((qid: string) => {
            const q = getQuestData(qid);
            return q?.playerProgress?.length > 0 && q.playerProgress[0].status === "COMPLETED";
        });
    };

    // Calculate progression percentage
    const stepCompletionStates = guide.steps.map((step: any) => checkStepCompletion(step));
    const completedCount = stepCompletionStates.filter(Boolean).length;
    const progressPercent = guide.steps.length > 0 ? (completedCount / guide.steps.length) * 100 : 0;

    return (
        <div className="flex flex-col lg:flex-row gap-8 w-full min-h-[80vh] relative">
            
            {/* Left side: The Timeline */}
            <div className="w-full lg:w-1/2 relative bg-zinc-900/40 rounded-3xl border border-white/5 p-8 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent pointer-events-none" />
                
                <div className="flex justify-between items-center mb-12">
                    <div>
                        <h2 className="text-3xl font-black text-white">{guide.name}</h2>
                        <p className="text-emerald-400 font-bold mt-1">{completedCount} / {guide.steps.length} étapes terminées</p>
                    </div>
                    <button 
                        onClick={() => setShowPlayers(!showPlayers)}
                        className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 transition-colors text-sm font-bold border border-white/5"
                    >
                        {showPlayers ? "Masquer les membres" : "Voir les membres"}
                    </button>
                </div>

                {/* The Timeline SVG / Line */}
                <div className="relative pl-6 lg:pl-12 space-y-16">
                    {/* Continuous Line */}
                    <div className="absolute top-0 bottom-0 left-[2rem] lg:left-[3.5rem] w-1 bg-zinc-800 rounded-full">
                        <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: `${progressPercent}%` }}
                            transition={{ duration: 1, ease: "easeInOut" }}
                            className="w-full bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.8)]"
                        />
                    </div>

                    {guide.steps.map((step: any, index: number) => {
                        const isDone = stepCompletionStates[index];
                        const isCurrent = index === selectedStep;
                        
                        // Find members on this step
                        const membersHere = memberProgress.filter(mp => mp.currentStepIndex === index && !mp.isFinished);

                        return (
                            <div key={step.id} className="relative z-10 flex items-start gap-8 group cursor-pointer" onClick={() => setSelectedStep(index)}>
                                {/* Node */}
                                <div className={`relative flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 transition-all duration-500
                                        ${isDone ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.6)]' : 'bg-zinc-800 border-2 border-zinc-700 group-hover:border-emerald-500/50'}
                                        ${isCurrent && !isDone ? 'ring-4 ring-emerald-500/20' : ''}`}>
                                    {isDone ? (
                                        <Check className="w-6 h-6 text-emerald-950 font-black" />
                                    ) : (
                                        <span className="text-zinc-500 font-black text-sm">{index + 1}</span>
                                    )}
                                </div>

                                {/* Content */}
                                <div className={`flex-1 transition-all ${isCurrent ? 'scale-105 opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
                                    <h3 className={`text-xl font-black ${isDone ? 'text-emerald-400' : 'text-zinc-200'}`}>{step.title}</h3>
                                    <p className="text-sm text-zinc-500 mt-1 max-w-sm line-clamp-2">{step.description || "Aucune description pour cette étape."}</p>
                                    
                                    <div className="text-xs text-zinc-600 font-bold mt-2 font-mono">
                                        {step.questIds?.length || 0} QUÊTES
                                    </div>

                                    {/* Members avatars floating */}
                                    <AnimatePresence>
                                        {showPlayers && membersHere.length > 0 && (
                                            <motion.div 
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0 }}
                                                className="absolute -left-12 lg:-left-16 top-12 flex flex-col gap-1"
                                            >
                                                {membersHere.slice(0, 3).map((mp, i) => (
                                                    <Avatar key={mp.profile.id} className="w-8 h-8 border-2 border-zinc-900 shadow-xl" style={{ zIndex: 10 - i }}>
                                                        <AvatarImage src={mp.profile.user?.image} />
                                                        <AvatarFallback>{mp.profile.user?.name?.[0]}</AvatarFallback>
                                                    </Avatar>
                                                ))}
                                                {membersHere.length > 3 && (
                                                    <div className="w-8 h-8 rounded-full bg-zinc-800 border-2 border-zinc-900 flex items-center justify-center text-[10px] font-bold text-white relative -mt-2">
                                                        +{membersHere.length - 3}
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Right side: The Active Step Details */}
            <div className="w-full lg:w-1/2 flex flex-col">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={selectedStep}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="sticky top-8 bg-zinc-900 border border-white/5 rounded-3xl p-8 shadow-2xl"
                    >
                        {guide.steps[selectedStep] ? (
                            <>
                                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-black text-zinc-400 uppercase tracking-widest mb-6">
                                    Étape Focus
                                </div>
                                
                                <h2 className="text-4xl font-black text-white mb-4 leading-tight">
                                    {guide.steps[selectedStep].title}
                                </h2>

                                <p className="text-lg text-zinc-400 mb-8 leading-relaxed">
                                    {guide.steps[selectedStep].description || "Terminez toutes les quêtes ci-dessous pour valider cette étape."}
                                </p>

                                <div className="space-y-3">
                                    {guide.steps[selectedStep].questIds?.map((qid: string) => {
                                        const qData = getQuestData(qid);
                                        if (!qData) return null;
                                        const isCompleted = qData.playerProgress?.length > 0 && qData.playerProgress[0].status === "COMPLETED";

                                        return (
                                            <div key={qid} className={`p-4 rounded-2xl border transition-all flex items-center justify-between
                                                ${isCompleted ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-black/40 border-white/5 hover:bg-black/60'}
                                            `}>
                                                <div className="flex flex-col">
                                                    <span className={`text-[10px] uppercase font-black tracking-widest mb-1 ${isCompleted ? 'text-emerald-500' : 'text-zinc-600'}`}>
                                                        {qData.chain?.dofus?.name}
                                                    </span>
                                                    <span className={`font-bold text-lg ${isCompleted ? 'text-emerald-400' : 'text-zinc-200'}`}>
                                                        {qData.name}
                                                    </span>
                                                </div>
                                                
                                                {isCompleted ? (
                                                    <div className="flex items-center gap-2 text-emerald-500">
                                                        <CheckCircle2 className="w-6 h-6" />
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-zinc-600">
                                                        <Circle className="w-6 h-6" />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {(!guide.steps[selectedStep].questIds || guide.steps[selectedStep].questIds.length === 0) && (
                                        <div className="p-4 rounded-2xl bg-black/40 border border-white/5 text-center text-zinc-500 italic">
                                            Aucune quête n'a été assignée à cette étape.
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="text-center text-zinc-500">Sélectionnez une étape.</div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

        </div>
    );
}
