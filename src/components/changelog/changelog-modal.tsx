"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronRight, X, Sparkles, Rocket, Shield, Zap, BookOpen, Bug, ExternalLink } from "lucide-react";
import { checkChangelogVisibility, markChangelogAsSeen } from "@/server/actions/changelog-actions";
import { Badge } from "@/components/ui/badge";
import { ChangelogContent } from "@/components/changelog/changelog-content";
import { cn } from "@/lib/utils";
import { ChangelogCategory } from "@prisma/client";
import { logger } from "@/lib/logger";

const categoryConfig: Record<ChangelogCategory, { label: string; bg: string; text: string; border: string; icon: any }> = {
    FEATURE: { label: "Nouveauté", bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30", icon: Rocket },
    BUGFIX: { label: "Correction", bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30", icon: Bug },
    SECURITY: { label: "Sécurité", bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30", icon: Shield },
    PERFORMANCE: { label: "Performance", bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30", icon: Zap },
    DOCUMENTATION: { label: "Documentation", bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/30", icon: BookOpen },
};

export function ChangelogModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [changelog, setChangelog] = useState<any>(null);

    useEffect(() => {
        const checkVisibility = async () => {
            try {
                const res = await checkChangelogVisibility();
                if (res.show && res.changelog) {
                    setChangelog(res.changelog);
                    setIsOpen(true);
                } else if (res.markSeen) {
                    // Nouvel utilisateur : on marque silencieusement la dernière release
                    // comme vue — pas de popup changelog pendant l'onboarding/tour.
                    await markChangelogAsSeen(res.markSeen);
                }
            } catch (err) {
                logger.error("[Changelog] Failed to check changelog visibility:", err);
            }
        };
        checkVisibility();
    }, []);

    const handleClose = async () => {
        if (changelog?.id) {
            try {
                await markChangelogAsSeen(changelog.id);
            } catch (err) {
                logger.error("[Changelog] Failed to mark changelog as seen:", err);
            }
        }
        setIsOpen(false);
    };

    if (!changelog) return null;

    const cat = categoryConfig[changelog.category as ChangelogCategory] || {
        label: changelog.category || "Mise à jour",
        bg: "bg-indigo-500/10",
        text: "text-indigo-400",
        border: "border-indigo-500/30",
        icon: Sparkles,
    };
    const CatIcon = cat.icon;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-w-2xl w-[92vw] max-h-[85vh] bg-zinc-950/95 border border-white/10 p-0  focus:outline-none focus:ring-0 rounded-2xl flex flex-col overflow-hidden backdrop-blur-xl [&>button:first-of-type]:hidden">
                {/* Header Banner */}
                <div className="relative pt-6 px-6 pb-4 border-b border-white/10 shrink-0 bg-gradient-to-b from-indigo-500/10 via-purple-500/5 to-transparent">
                    {/* Background glow */}
                    <div className="absolute -top-12 -left-12 w-48 h-48 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

                    {/* Close Button */}
                    <button
                        onClick={handleClose}
                        className="absolute top-4 right-4 z-20 p-2 rounded-full bg-zinc-900/80 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-white transition-all shadow-md"
                        title="Fermer"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    <div className="relative z-10 flex flex-col items-start gap-2 pr-8">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-caption font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                                <Sparkles className="w-3 h-3 text-amber-400" /> Version {changelog.version}
                            </span>
                            {changelog.category && (
                                <span className={cn("px-2.5 py-0.5 rounded-full border text-caption font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm", cat.bg, cat.text, cat.border)}>
                                    <CatIcon className="w-3 h-3" /> {cat.label}
                                </span>
                            )}
                        </div>

                        <DialogHeader className="text-left space-y-1">
                            <DialogTitle className="text-xl sm:text-2xl font-black text-zinc-100 tracking-tight leading-tight">
                                {changelog.title}
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                                Nouveautés SigilOS {changelog.version}
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                </div>

                {/* Single Scrollable Content Container (Prevents Double Scrollbars) */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                    <ChangelogContent content={changelog.content} />
                </div>

                {/* Footer Controls */}
                <div className="px-6 py-4 bg-zinc-950 border-t border-white/10 shrink-0 flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                        <span className="text-caption font-black text-zinc-500 uppercase tracking-widest">
                            SigilOS Platform
                        </span>
                        <span className="text-caption font-bold text-zinc-600">
                            Build {changelog.version}
                        </span>
                    </div>

                    <Button
                        onClick={handleClose}
                        className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black uppercase tracking-wider text-xs h-9 px-5 rounded-xl shadow-lg shadow-amber-500/20 transition-all "
                    >
                        Compris
                        <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
