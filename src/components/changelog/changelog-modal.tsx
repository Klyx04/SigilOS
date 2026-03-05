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
import { ChevronRight, X } from "lucide-react";
import { checkChangelogVisibility, markChangelogAsSeen } from "@/server/actions/changelog-actions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { DocContent } from "@/components/doc/doc-content";
import { cn } from "@/lib/utils";
import { ChangelogCategory } from "@prisma/client";

const categoryColors: Record<ChangelogCategory, string> = {
    FEATURE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    BUGFIX: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    SECURITY: "bg-red-500/10 text-red-400 border-red-500/20",
    PERFORMANCE: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    DOCUMENTATION: "bg-purple-500/10 text-purple-400 border-purple-500/20",
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
                }
            } catch (err) {
                console.error("Failed to check changelog visibility", err);
            }
        };
        checkVisibility();
    }, []);

    const handleClose = async () => {
        if (changelog?.id) {
            try {
                await markChangelogAsSeen(changelog.id);
            } catch (err) {
                console.error("Failed to mark changelog as seen", err);
            }
        }
        setIsOpen(false);
    };

    if (!changelog) return null;

    const catColor = categoryColors[changelog.category as ChangelogCategory] ?? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-w-xl bg-[#09090b] border-white/10 p-0 shadow-2xl focus:outline-none focus:ring-0 rounded-3xl max-h-[85vh] flex flex-col [&>button:first-of-type]:hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 pointer-events-none rounded-3xl" />

                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 z-50 p-1.5 bg-black/40 hover:bg-black/60 border border-white/5 rounded-full text-zinc-400 hover:text-white transition-all backdrop-blur-md"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* Header */}
                <div className="relative h-32 sm:h-40 w-full overflow-hidden flex items-center justify-center shrink-0">
                    <div className="absolute inset-0 z-0">
                        <div className="w-full h-full bg-gradient-to-br from-indigo-600/20 via-purple-600/15 to-pink-600/10 animate-pulse-slow" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/40 to-transparent" />
                    </div>

                    <div className="relative z-10 flex flex-col items-center text-center px-6 mt-2 gap-2">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 font-black tracking-widest uppercase py-0.5 px-2.5 text-[10px]">
                                Mise à jour {changelog.version}
                            </Badge>
                            {changelog.category && (
                                <Badge variant="outline" className={cn("font-black tracking-widest uppercase py-0.5 px-2.5 text-[10px]", catColor)}>
                                    {changelog.category}
                                </Badge>
                            )}
                        </div>
                        <DialogHeader>
                            <DialogTitle className="text-2xl sm:text-3xl font-black text-white tracking-tighter uppercase drop-shadow-2xl">
                                {changelog.title}
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                                Nouveautés SigilOS {changelog.version}
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                </div>

                {/* Content — uses DocContent to render TipTap HTML correctly */}
                <div className="px-6 pb-6 sm:px-8 sm:pb-8 flex flex-col flex-1 overflow-hidden relative z-10 -mt-2">
                    <ScrollArea className="flex-1 pr-2">
                        <DocContent
                            content={changelog.content}
                            className="
                                prose-p:text-sm prose-p:leading-relaxed
                                prose-headings:text-white prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tight prose-headings:mb-3 prose-headings:mt-6
                                prose-h3:text-lg
                                prose-strong:text-indigo-400
                                prose-ul:list-disc prose-li:text-zinc-400 prose-li:text-sm prose-li:my-1
                                prose-hr:border-white/5 prose-hr:my-4
                                [&_.callout]:my-4 [&_.callout]:p-4
                                [&_img]:max-w-full [&_img]:h-auto [&_img]:object-contain
                                [&_figure]:my-4 [&_figure]:flex [&_figure]:flex-col [&_figure]:items-start
                            "
                        />
                    </ScrollArea>

                    <div className="pt-4 flex items-center justify-end gap-3 mt-auto border-t border-white/5">
                        <div className="mr-auto hidden sm:flex flex-col">
                            <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">
                                SigilOS Platform
                            </span>
                            <span className="text-[9px] font-medium text-zinc-700 uppercase">
                                Build {changelog.version}
                            </span>
                        </div>
                        <Button
                            onClick={handleClose}
                            className="bg-white text-black hover:bg-zinc-200 font-black uppercase tracking-widest text-[10px] h-10 rounded-xl px-6 shadow-[0_0_20px_rgba(255,255,255,0.1)] group transition-all"
                        >
                            D&apos;accord
                            <ChevronRight className="w-3.5 h-3.5 ml-1.5 transition-transform group-hover:translate-x-0.5" />
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
