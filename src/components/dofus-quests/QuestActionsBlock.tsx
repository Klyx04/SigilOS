"use client";

import React, { useState, useEffect } from "react";
import { 
    Target, 
    BookOpen, 
    Navigation, 
    Users, 
    Copy,
    Search,
    ShieldAlert,
    Check,
    Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { copyWithToast } from "./dofus-resolvers";
import type { MemberOnQuest } from "@/server/actions/dofus-quest-actions";
import { getOtherMembersOnQuest } from "@/server/actions/dofus-quest-actions";
import Link from "next/link";

interface QuestActionsBlockProps {
    entry: {
        id: string;
        dofusdbId?: number | null;
        name: string;
        externalRef?: string | null;
        coords?: { x: number; y: number; worldId?: number } | null;
    };
    guildId: string;
    dofusColor: string;
    initialMembers?: MemberOnQuest[];
    lock: boolean;
    done: boolean;
    onToggle: () => void;
}

export function QuestActionsBlock({
    entry,
    guildId,
    dofusColor,
    initialMembers = [],
    lock,
    done,
    onToggle
}: QuestActionsBlockProps) {
    const [members, setMembers] = useState<MemberOnQuest[]>(initialMembers);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Dynamic icon URL fetcher
    const dofusDbFavicon = "https://dofusdb.fr/favicon.ico";
    const noobsFavicon = "https://www.dofuspourlesnoobs.com/favicon.ico";
    const dofusbookFavicon = "https://www.dofusbook.net/favicon.ico";

    useEffect(() => {
        if (initialMembers.length > 0) {
            setMembers(initialMembers);
        } else {
            // Lazy load members if none provided initially
            setLoadingMembers(true);
            getOtherMembersOnQuest(guildId, entry.id).then((res) => {
                if (res.success && res.data) {
                    setMembers(res.data);
                }
                setLoadingMembers(false);
            });
        }
    }, [guildId, entry.id, initialMembers]);

    // Triggers the modal view
    const openGuildModal = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsModalOpen(true);
    };

    const copyTravelCoords = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (entry.coords) {
            copyWithToast(`/travel ${entry.coords.x} ${entry.coords.y}`);
        }
    };

    return (
        <div className="pt-4 border-t border-white/5 space-y-4">
            <div className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] italic mb-1">
                Panneau Tactique & Synergies
            </div>

            {/* 4-Column Navigation Deck */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* 1. DofusDB */}
                <a
                    href={`https://dofusdb.fr/fr/database/quest/${entry.dofusdbId || entry.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative group overflow-hidden rounded-2xl border border-indigo-500/20 bg-[#0d0e15]/60 p-4 hover:border-indigo-500/40 hover:bg-[#10121d]/80 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] transition-all duration-300 flex flex-col justify-between min-h-[110px]"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex justify-between items-start">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                            src={dofusDbFavicon} 
                            alt="DofusDB" 
                            className="w-5 h-5 object-contain rounded-md filter drop-shadow-[0_0_4px_rgba(99,102,241,0.5)] group-hover:scale-110 transition-transform" 
                            onError={(e) => { e.currentTarget.style.display = "none"; }} 
                        />
                        <span className="text-[8px] font-black uppercase tracking-wider text-indigo-400/90 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                            Base
                        </span>
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-white italic tracking-tight mt-3 group-hover:text-indigo-400 transition-colors">
                            DofusDB
                        </h4>
                        <p className="text-[9px] text-zinc-500 mt-1 line-clamp-2 leading-tight">
                            Fiche officielle, IDs & structure.
                        </p>
                    </div>
                </a>

                {/* 2. Dofus pour les Noobs */}
                <a
                    href={entry.externalRef || (() => {
                        const slug = entry.name
                            .toLowerCase()
                            .normalize("NFD")
                            .replace(/[\u0300-\u036f]/g, "")
                            .replace(/['’]/g, "")
                            .replace(/[^a-z0-9\s-]/g, "")
                            .trim()
                            .replace(/\s+/g, "-")
                            .replace(/-+/g, "-");
                        return `https://www.dofuspourlesnoobs.com/${slug}.html`;
                    })()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative group overflow-hidden rounded-2xl border border-amber-500/20 bg-[#0d0e15]/60 p-4 hover:border-amber-500/40 hover:bg-[#15120e]/80 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)] transition-all duration-300 flex flex-col justify-between min-h-[110px]"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex justify-between items-start">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                            src={noobsFavicon} 
                            alt="Noobs" 
                            className="w-5 h-5 object-contain rounded-md filter drop-shadow-[0_0_4px_rgba(245,158,11,0.5)] group-hover:scale-110 transition-transform" 
                            onError={(e) => { e.currentTarget.style.display = "none"; }} 
                        />
                        <span className="text-[8px] font-black uppercase tracking-wider text-amber-400/90 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            Tuto
                        </span>
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-white italic tracking-tight mt-3 group-hover:text-amber-400 transition-colors">
                            Noobs
                        </h4>
                        <p className="text-[9px] text-zinc-500 mt-1 line-clamp-2 leading-tight">
                            Tutoriel détaillé & images d'étapes.
                        </p>
                    </div>
                </a>

                {/* 3. Autopilote (Travel) */}
                <button
                    onClick={copyTravelCoords}
                    disabled={!entry.coords}
                    className="relative group overflow-hidden rounded-2xl border border-emerald-500/20 bg-[#0d0e15]/60 p-4 hover:border-emerald-500/40 hover:bg-[#0e1512]/80 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all duration-300 flex flex-col justify-between min-h-[110px] text-left disabled:opacity-30 disabled:pointer-events-none"
                >
                    <div className="flex justify-between items-start">
                        <Navigation className="w-5 h-5 text-emerald-400/80 group-hover:rotate-12 transition-transform shrink-0" />
                        <span className="text-[8px] font-black uppercase tracking-wider text-emerald-400/90 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            GPS
                        </span>
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-white italic tracking-tight mt-3 group-hover:text-emerald-400 transition-colors">
                            Autopilote
                        </h4>
                        {entry.coords ? (
                            <div className="flex items-center gap-1 mt-1">
                                <span className="text-[8px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                                    [{entry.coords.x}, {entry.coords.y}]
                                </span>
                                <Copy className="w-2.5 h-2.5 text-emerald-500/50" />
                            </div>
                        ) : (
                            <p className="text-[9px] text-zinc-600 mt-1">
                                Aucune coordonnée
                            </p>
                        )}
                    </div>
                </button>

                {/* 4. Guild Radar Card (La Tour de Contrôle avec vrai modal au clic) */}
                <button
                    onClick={openGuildModal}
                    className="relative group overflow-hidden rounded-2xl border border-rose-500/20 bg-[#0d0e15]/60 p-4 hover:border-rose-500/40 hover:bg-[#150d10]/80 hover:shadow-[0_0_20px_rgba(244,63,94,0.15)] transition-all duration-300 flex flex-col justify-between min-h-[110px] text-left"
                >
                    <div className="flex justify-between items-start">
                        <Users className="w-5 h-5 text-rose-400/80 group-hover:scale-110 transition-transform shrink-0" />
                        <span className="text-[8px] font-black uppercase tracking-wider text-rose-400/90 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                            Guilde
                        </span>
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-white italic tracking-tight mt-1 group-hover:text-rose-400 transition-colors">
                            Synergies
                        </h4>

                        {/* Avatars Stack or Count */}
                        <div className="mt-1 flex items-center gap-1">
                            {loadingMembers ? (
                                <div className="w-3.5 h-3.5 rounded-full border border-white/10 border-t-rose-400 animate-spin" />
                            ) : members.length === 0 ? (
                                <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">
                                    0 Membre
                                </span>
                            ) : (
                                <div className="flex -space-x-1.5 overflow-hidden">
                                    {members.slice(0, 3).map((m) => (
                                        <div
                                            key={m.profileId}
                                            className="w-5 h-5 rounded-full overflow-hidden border border-zinc-950 bg-zinc-800 flex-shrink-0"
                                        >
                                            {m.image ? (
                                                <img src={m.image} alt={m.pseudo} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-[7px] flex items-center justify-center h-full font-black text-white/50 bg-zinc-700">
                                                    {m.pseudo[0]}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                    {members.length > 3 && (
                                        <div className="w-5 h-5 rounded-full bg-zinc-900 border border-rose-500/20 flex items-center justify-center text-[7px] font-black text-rose-400">
                                            +{members.length - 3}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </button>
            </div>

            {/* Validation CTA Button */}
            <Button
                disabled={lock && !done}
                onClick={(e) => {
                    e.stopPropagation();
                    if (lock && !done) return;
                    onToggle();
                }}
                className={`w-full h-12 rounded-2xl font-black italic uppercase text-[13px] transition-all tracking-widest ${
                    done
                        ? "bg-zinc-900 border border-white/10 text-zinc-400 hover:bg-zinc-950"
                        : lock
                        ? "bg-zinc-950 text-white/10 border border-white/5 cursor-not-allowed"
                        : "bg-white text-black hover:bg-zinc-200 hover:scale-[1.01] active:scale-[0.99] shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                }`}
            >
                {done ? (
                    <span className="flex items-center justify-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400" /> Réinitialiser la progression
                    </span>
                ) : lock ? (
                    <span className="flex items-center justify-center gap-2">
                        <Lock className="w-4 h-4 text-zinc-700" /> Quête Verrouillée
                    </span>
                ) : (
                    "Valider l'étape de quête"
                )}
            </Button>

            {/* Beautiful Interactive Guild Progress Dialog Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-md bg-[#090a0f] border border-white/10 rounded-[2rem] p-6 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                    <DialogHeader className="border-b border-white/5 pb-4 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                                <Users className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                                <div className="text-[9px] font-black text-rose-400 uppercase tracking-widest leading-none mb-1">
                                    Synergies de Guilde
                                </div>
                                <DialogTitle className="text-lg font-black text-white italic uppercase tracking-tight truncate max-w-[280px]">
                                    {entry.name}
                                </DialogTitle>
                            </div>
                        </div>
                    </DialogHeader>

                    <ScrollArea className="flex-1 pr-1">
                        <div className="space-y-2">
                            {loadingMembers ? (
                                <div className="py-12 flex flex-col items-center justify-center gap-3">
                                    <div className="w-6 h-6 rounded-full border-2 border-rose-500/20 border-t-rose-400 animate-spin" />
                                    <span className="text-[10px] text-zinc-500 font-bold uppercase">Chargement de la tour de contrôle...</span>
                                </div>
                            ) : members.length === 0 ? (
                                <div className="py-12 flex flex-col items-center justify-center text-center gap-2 bg-white/[0.01] border border-dashed border-white/5 rounded-2xl">
                                    <ShieldAlert className="w-8 h-8 text-zinc-700" />
                                    <p className="text-xs text-zinc-500 font-black uppercase tracking-wider">
                                        Aucun membre n'a débuté
                                    </p>
                                    <p className="text-[10px] text-zinc-600 max-w-[220px]">
                                        Soyez le premier de votre guilde à vous lancer et à guider les autres !
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-2">
                                    {members.map((m) => {
                                        const isDone = m.status === "COMPLETED";
                                        return (
                                            <Link
                                                key={m.profileId}
                                                href={`/dashboard/${guildId}/members/${encodeURIComponent(m.pseudo)}`}
                                                className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all group/member"
                                                onClick={() => setIsModalOpen(false)}
                                            >
                                                <div className="w-9 h-9 rounded-xl overflow-hidden bg-zinc-800 border border-white/10 shrink-0 relative shadow-inner">
                                                    {m.image ? (
                                                        <img src={m.image} alt={m.pseudo} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-[11px] flex items-center justify-center h-full font-black text-white/50 bg-zinc-700 uppercase">
                                                            {m.pseudo[0]}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-black text-white group-hover/member:text-rose-400 transition-colors truncate leading-none mb-1.5">
                                                        {m.pseudo}
                                                    </p>
                                                    <div className="flex items-center gap-1.5">
                                                        <span 
                                                            className="w-1.5 h-1.5 rounded-full" 
                                                            style={{ backgroundColor: isDone ? "#10b981" : "#f59e0b" }} 
                                                        />
                                                        <span 
                                                            className="text-[9px] font-black uppercase tracking-widest"
                                                            style={{ color: isDone ? "#10b981" : "#f59e0b" }}
                                                        >
                                                            {isDone ? "Terminée" : "En cours"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-[8px] font-black text-zinc-600 uppercase tracking-widest">
                        <span>SigilOS Intelligence</span>
                        <span>{members.length} joueur{members.length > 1 ? "s" : ""}</span>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
