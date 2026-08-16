"use client";

import React, { useState } from "react";
import { Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { getOtherMembersOnQuest, type MemberOnQuest } from "@/server/actions/dofus-quest-actions";

interface QuestGuildStatusProps {
    guildId: string;
    questId: string;
    dofusColor: string;
    variant?: "default" | "action";
}

export function QuestGuildStatus({ guildId, questId, dofusColor, variant = "default" }: QuestGuildStatusProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [members, setMembers] = useState<MemberOnQuest[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    async function handleToggle() {
        if (!isOpen) {
            setIsLoading(true);
            const res = await getOtherMembersOnQuest(guildId, questId);
            if (res.success && res.data) setMembers(res.data);
            setIsLoading(false);
        }
        setIsOpen(!isOpen);
    }

    const isAction = variant === "action";

    return (
        <div className={isAction ? "w-full" : "relative"}>
            <Button
                variant={isAction ? "sigil-destructive" : "ghost"}
                onClick={(e) => { e.stopPropagation(); handleToggle(); }}
                className={isAction 
                    ? "flex flex-col items-center justify-center gap-2 h-20 w-full rounded-2xl"
                    : `flex items-center gap-1.5 px-3 py-1 rounded-lg text-caption font-black uppercase tracking-widest transition-all ${
                        isOpen ? "bg-white/10 text-white border-white/20" : "bg-white/5 text-zinc-500 hover:text-white border-white/5"
                    } border h-auto`
                }
            >
                <Users className={isAction ? "w-5 h-5" : "w-3 h-3 transition-colors"} style={{ color: isOpen ? dofusColor : undefined }} />
                {isAction ? (
                    <span className="flex flex-col items-center">
                        <span className="text-caption">{members.length > 0 ? `${members.length} Membres` : "Guilde"}</span>
                    </span>
                ) : (
                    members.length > 0 ? (
                        <span className="flex items-center gap-1">
                            <span style={{ color: dofusColor }}>{members.length}</span>
                            <span>membres</span>
                        </span>
                    ) : "Guilde"
                )}
            </Button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="absolute left-0 bottom-full mb-2 z-50 w-56 p-2 rounded-xl bg-zinc-950 border border-white/10 shadow-2xl backdrop-blur-xl"
                    >
                        <div className="flex flex-col gap-1">
                            <p className="text-caption font-black text-white/30 uppercase tracking-widest px-2 mb-2">Avancement Guilde</p>
                            {isLoading ? (
                                <div className="py-6 flex justify-center">
                                    <div className="w-5 h-5 rounded-full border-2 border-white/5 border-t-white animate-spin" />
                                </div>
                            ) : members.length === 0 ? (
                                <div className="px-2 py-4 text-center">
                                    <p className="text-caption text-white/20 italic font-bold">Aucun membre sur cette étape</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                    {members.map(m => (
                                        <div key={m.profileId} className="flex items-center gap-2.5 p-2 rounded-lg bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-colors">
                                            <div className="w-6 h-6 rounded-md overflow-hidden bg-zinc-800 flex-shrink-0 border border-white/5 shadow-inner">
                                                {m.image ? <img src={m.image} alt={m.pseudo} className="w-full h-full object-cover" /> : <span className="text-caption flex items-center justify-center h-full font-black text-white/40">{m.pseudo[0]}</span>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-caption font-bold text-white/80 truncate leading-none mb-1">{m.pseudo}</p>
                                                <div className="flex items-center gap-1">
                                                    <div className={`w-1 h-1 rounded-full ${m.status === "COMPLETED" ? "bg-emerald-500" : "bg-amber-500"}`} />
                                                    <p className={`text-caption font-black uppercase tracking-tighter ${m.status === "COMPLETED" ? "text-emerald-500/70" : "text-amber-500/70"}`}>
                                                        {m.status === "COMPLETED" ? "Terminée" : "En cours"}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="mt-2 pt-2 border-t border-white/5">
                            <p className="text-caption text-white/10 font-black uppercase text-center tracking-widest">SigilOS Intelligence Unit</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
