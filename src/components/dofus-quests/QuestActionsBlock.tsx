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
        positions?: { x: number; y: number; label?: string }[];
        dofusdbUrl?: string | null;
        dofuspourlesnoobsUrl?: string | null;
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
        const pos = entry.coords || (Array.isArray(entry.positions) ? entry.positions[0] : null);
        if (pos) {
            copyWithToast(`/travel ${pos.x} ${pos.y}`);
        }
    };
    const autopilotPos = entry.coords || (Array.isArray(entry.positions) ? entry.positions[0] : null);

    return (
        <div className="pt-4 border-t border-border space-y-4">
            <div className="text-caption font-black text-muted-foreground uppercase tracking-[0.2em] italic mb-1">
                Panneau Tactique & Synergies
            </div>

            {/* 4-Column Navigation Deck */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* 1. DofusDB */}
                <a
                    href={entry.dofusdbUrl || `https://dofusdb.fr/fr/database/quest/${entry.dofusdbId || entry.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative group overflow-hidden rounded-2xl border border-info/20 bg-surface/60 p-4 hover:border-info/40 hover:bg-elevated/80  transition-all duration-300 flex flex-col justify-between min-h-[110px]"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex justify-between items-start">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                            src={dofusDbFavicon} 
                            alt="DofusDB" 
                            className="w-5 h-5 object-contain rounded-md filter drop-shadow-[0_0_4px_rgba(99,102,241,0.5)] group- transition-transform" 
                            onError={(e) => { e.currentTarget.style.display = "none"; }} 
                        />
                        <span className="text-caption font-black uppercase tracking-wider text-info/90 bg-info/10 px-1.5 py-0.5 rounded border border-info/20">
                            Base
                        </span>
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-foreground italic tracking-tight mt-3 group-hover:text-info transition-colors">
                            DofusDB
                        </h4>
                        <p className="text-caption text-muted-foreground mt-1 line-clamp-2 leading-tight">
                            Fiche officielle, IDs & structure.
                        </p>
                    </div>
                </a>

                {/* 2. Dofus pour les Noobs */}
                <a
                    href={entry.dofuspourlesnoobsUrl || entry.externalRef || (() => {
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
                    className="relative group overflow-hidden rounded-2xl border border-warning/20 bg-surface/60 p-4 hover:border-warning/40 hover:bg-elevated/80  transition-all duration-300 flex flex-col justify-between min-h-[110px]"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex justify-between items-start">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                            src={noobsFavicon} 
                            alt="Noobs" 
                            className="w-5 h-5 object-contain rounded-md filter drop-shadow-[0_0_4px_rgba(245,158,11,0.5)] group- transition-transform" 
                            onError={(e) => { e.currentTarget.style.display = "none"; }} 
                        />
                        <span className="text-caption font-black uppercase tracking-wider text-warning/90 bg-warning/10 px-1.5 py-0.5 rounded border border-warning/20">
                            Tuto
                        </span>
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-foreground italic tracking-tight mt-3 group-hover:text-warning transition-colors">
                            Noobs
                        </h4>
                        <p className="text-caption text-muted-foreground mt-1 line-clamp-2 leading-tight">
                            Tutoriel détaillé & images d'étapes.
                        </p>
                    </div>
                </a>

                {/* 3. Autopilote (Travel) */}
                <button
                    onClick={copyTravelCoords}
                    disabled={!autopilotPos}
                    className="relative group overflow-hidden rounded-2xl border border-success/20 bg-surface/60 p-4 hover:border-success/40 hover:bg-elevated/80  transition-all duration-300 flex flex-col justify-between min-h-[110px] text-left disabled:opacity-30 disabled:pointer-events-none"
                >
                    <div className="flex justify-between items-start">
                        <Navigation className="w-5 h-5 text-success/80 group-hover:rotate-12 transition-transform shrink-0" />
                        <span className="text-caption font-black uppercase tracking-wider text-success/90 bg-success/10 px-1.5 py-0.5 rounded border border-success/20">
                            GPS
                        </span>
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-foreground italic tracking-tight mt-3 group-hover:text-success transition-colors">
                            Autopilote
                        </h4>
                        {autopilotPos ? (
                            <div className="flex items-center gap-1 mt-1">
                                <span className="text-caption font-mono text-success bg-success/60 border border-success/20 px-1.5 py-0.5 rounded">
                                    [{autopilotPos.x}, {autopilotPos.y}]
                                </span>
                                <Copy className="w-2.5 h-2.5 text-success/50" />
                            </div>
                        ) : (
                            <p className="text-caption text-muted-foreground mt-1">
                                Aucune coordonnée
                            </p>
                        )}
                    </div>
                </button>

                {/* 4. Guild Radar Card (La Tour de Contrôle avec vrai modal au clic) */}
                <button
                    onClick={openGuildModal}
                    className="relative group overflow-hidden rounded-2xl border border-danger/20 bg-surface/60 p-4 hover:border-danger/40 hover:bg-elevated/80  transition-all duration-300 flex flex-col justify-between min-h-[110px] text-left"
                >
                    <div className="flex justify-between items-start">
                        <Users className="w-5 h-5 text-danger/80 group- transition-transform shrink-0" />
                        <span className="text-caption font-black uppercase tracking-wider text-danger/90 bg-danger/10 px-1.5 py-0.5 rounded border border-danger/20">
                            Guilde
                        </span>
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-foreground italic tracking-tight mt-1 group-hover:text-danger transition-colors">
                            Synergies
                        </h4>

                        {/* Avatars Stack or Count */}
                        <div className="mt-1 flex items-center gap-1">
                            {loadingMembers ? (
                                <div className="w-3.5 h-3.5 rounded-full border border-border border-t-rose-400 animate-spin" />
                            ) : members.length === 0 ? (
                                <span className="text-caption text-muted-foreground font-bold uppercase tracking-wider">
                                    0 Membre
                                </span>
                            ) : (
                                <div className="flex -space-x-1.5 overflow-hidden">
                                    {members.slice(0, 3).map((m) => (
                                        <div
                                            key={m.profileId}
                                            className="w-5 h-5 rounded-full overflow-hidden border border-border bg-elevated flex-shrink-0"
                                        >
                                            {m.image ? (
                                                <img src={m.image} alt={m.pseudo} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-caption flex items-center justify-center h-full font-black text-foreground/50 bg-muted">
                                                    {m.pseudo[0]}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                    {members.length > 3 && (
                                        <div className="w-5 h-5 rounded-full bg-surface border border-danger/20 flex items-center justify-center text-caption font-black text-danger">
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
                className={`w-full h-12 rounded-2xl font-black italic uppercase text-body-sm transition-all tracking-widest ${
                    done
                        ? "bg-surface border border-border text-muted-foreground hover:bg-background"
                        : lock
                        ? "bg-background text-foreground/10 border border-border cursor-not-allowed"
                        : "bg-background text-foreground hover:bg-surface hover:scale-[1.01] active:scale-[0.99] "
                }`}
            >
                {done ? (
                    <span className="flex items-center justify-center gap-2">
                        <Check className="w-4 h-4 text-success" /> Réinitialiser la progression
                    </span>
                ) : lock ? (
                    <span className="flex items-center justify-center gap-2">
                        <Lock className="w-4 h-4 text-muted-foreground" /> Quête Verrouillée
                    </span>
                ) : (
                    "Valider l'étape de quête"
                )}
            </Button>

            {/* Beautiful Interactive Guild Progress Dialog Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-md bg-popover border border-border rounded-[2rem] p-6 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                    <DialogHeader className="border-b border-border pb-4 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-center text-danger shrink-0">
                                <Users className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                                <div className="text-caption font-black text-danger uppercase tracking-widest leading-none mb-1">
                                    Synergies de Guilde
                                </div>
                                <DialogTitle className="text-lg font-black text-foreground italic uppercase tracking-tight truncate max-w-[280px]">
                                    {entry.name}
                                </DialogTitle>
                            </div>
                        </div>
                    </DialogHeader>

                    <ScrollArea className="flex-1 pr-1">
                        <div className="space-y-2">
                            {loadingMembers ? (
                                <div className="py-12 flex flex-col items-center justify-center gap-3">
                                    <div className="w-6 h-6 rounded-full border-2 border-danger/20 border-t-rose-400 animate-spin" />
                                    <span className="text-caption text-muted-foreground font-bold uppercase">Chargement de la tour de contrôle...</span>
                                </div>
                            ) : members.length === 0 ? (
                                <div className="py-12 flex flex-col items-center justify-center text-center gap-2 bg-surface border border-dashed border-border rounded-2xl">
                                    <ShieldAlert className="w-8 h-8 text-muted-foreground" />
                                    <p className="text-xs text-muted-foreground font-black uppercase tracking-wider">
                                        Aucun membre n'a débuté
                                    </p>
                                    <p className="text-caption text-muted-foreground max-w-[220px]">
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
                                                className="flex items-center gap-3 p-3 rounded-2xl bg-surface border border-border hover:bg-surface hover:border-border transition-all group/member"
                                                onClick={() => setIsModalOpen(false)}
                                            >
                                                <div className="w-9 h-9 rounded-xl overflow-hidden bg-elevated border border-border shrink-0 relative shadow-inner">
                                                    {m.image ? (
                                                        <img src={m.image} alt={m.pseudo} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-caption flex items-center justify-center h-full font-black text-foreground/50 bg-muted uppercase">
                                                            {m.pseudo[0]}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-black text-foreground group-hover/member:text-danger transition-colors truncate leading-none mb-1.5">
                                                        {m.pseudo}
                                                    </p>
                                                    <div className="flex items-center gap-1.5">
                                                        <span 
                                                            className="w-1.5 h-1.5 rounded-full" 
                                                            style={{ backgroundColor: isDone ? "var(--success)" : "var(--warning)" }} 
                                                        />
                                                        <span 
                                                            className="text-caption font-black uppercase tracking-widest"
                                                            style={{ color: isDone ? "var(--success)" : "var(--warning)" }}
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

                    <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-caption font-black text-muted-foreground uppercase tracking-widest">
                        <span>SigilOS Intelligence</span>
                        <span>{members.length} joueur{members.length > 1 ? "s" : ""}</span>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
