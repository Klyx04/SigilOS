"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { togglePinnedNavItem } from "@/server/actions/profile-actions";
import { toast } from "sonner";
import { 
    Star, 
    ArrowRight, 
    Settings, 
    Shield, 
    Hammer, 
    BookOpen, 
    Swords, 
    CheckCircle, 
    Users, 
    Gavel, 
    FileText,
    ShieldAlert,
    Puzzle,
    type LucideIcon 
} from "lucide-react";

interface AdminCardProps {
    href: string;
    iconName: string;
    title: string;
    description: string;
    accent: string;
    guildId: string;
    initialPinned: boolean;
    warningBadge?: string;
    /** Identifiant stable pour le tour admin (data-tour). */
    tourId?: string;
}

const ICONS: Record<string, LucideIcon> = {
    Settings,
    Shield,
    Hammer,
    BookOpen,
    Swords,
    CheckCircle,
    Users,
    Gavel,
    FileText,
    ShieldAlert,
    Puzzle
};

const ACCENT: Record<string, { border: string; hover: string; text: string; bg: string; shadow: string }> = {
    violet: { border: "border-violet-500/20", hover: "hover:border-violet-500/50", text: "text-violet-400", bg: "bg-violet-500/10", shadow: "shadow-violet-500/20" },
    blue: { border: "border-blue-500/20", hover: "hover:border-blue-500/50", text: "text-blue-400", bg: "bg-blue-500/10", shadow: "shadow-blue-500/20" },
    slate: { border: "border-slate-500/20", hover: "hover:border-slate-500/50", text: "text-slate-400", bg: "bg-slate-500/10", shadow: "shadow-slate-500/20" },
    indigo: { border: "border-indigo-500/20", hover: "hover:border-indigo-500/50", text: "text-indigo-400", bg: "bg-indigo-500/10", shadow: "shadow-indigo-500/20" },
    green: { border: "border-green-500/20", hover: "hover:border-green-500/50", text: "text-green-400", bg: "bg-green-500/10", shadow: "shadow-green-500/20" },
    emerald: { border: "border-emerald-500/20", hover: "hover:border-emerald-500/50", text: "text-emerald-400", bg: "bg-emerald-500/10", shadow: "shadow-emerald-500/20" },
    amber: { border: "border-amber-500/20", hover: "hover:border-amber-500/50", text: "text-amber-400", bg: "bg-amber-500/10", shadow: "shadow-amber-500/20" },
    rose: { border: "border-rose-500/20", hover: "hover:border-rose-500/50", text: "text-rose-400", bg: "bg-rose-500/10", shadow: "shadow-rose-500/20" },
    cyan: { border: "border-cyan-500/20", hover: "hover:border-cyan-500/50", text: "text-cyan-400", bg: "bg-cyan-500/10", shadow: "shadow-cyan-500/20" },
};

export function AdminCard({
    href,
    iconName,
    title,
    description,
    accent,
    guildId,
    initialPinned,
    warningBadge,
    tourId,
}: AdminCardProps) {
    const [isPinned, setIsPinned] = useState(initialPinned);
    const [isPending, startTransition] = useTransition();
    const a = ACCENT[accent] ?? ACCENT.slate;
    const Icon = ICONS[iconName] || Shield;

    const handleTogglePin = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (isPending) return;

        const newState = !isPinned;
        setIsPinned(newState);

        startTransition(async () => {
            try {
                const res = await togglePinnedNavItem({ guildId, href });
                if (!res.success) {
                    setIsPinned(!newState);
                    toast.error("Erreur lors du changement de favori");
                } else {
                    toast.success(newState ? "Ajouté aux favoris" : "Retiré des favoris", {
                        description: title,
                        icon: newState ? <Star className="w-4 h-4 text-amber-400 fill-amber-400" /> : undefined
                    });
                }
            } catch (err) {
                setIsPinned(!newState);
                toast.error("Erreur serveur");
            }
        });
    };

    return (
        <Link href={href} className="group outline-none relative block h-full" data-tour={tourId}>
            <div className={cn(
                "relative flex flex-col h-full rounded-[2.5rem] border border-white/5 bg-white/[0.02] p-8 transition-all duration-700 hover:bg-white/[0.04] hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] overflow-hidden",
                a.hover,
                "before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/[0.05] before:to-transparent before:opacity-0 group-hover:before:opacity-100 before:transition-opacity before:duration-700"
            )}>
                {/* Favorite Toggle */}
                <button
                    onClick={handleTogglePin}
                    disabled={isPending}
                    className={cn(
                        "absolute top-6 right-6 z-20 p-2.5 rounded-xl border transition-all duration-500 hover:scale-110 active:scale-95",
                        isPinned 
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]" 
                            : "bg-white/5 border-white/10 text-white/20 hover:text-white/60 hover:bg-white/10 hover:border-white/20"
                    )}
                >
                    <Star className={cn("w-4 h-4 transition-all duration-500", isPinned && "fill-current scale-110")} />
                </button>

                {/* Card Accent Glow */}
                <div className={cn(
                    "absolute -top-24 -right-24 w-48 h-48 blur-[100px] opacity-0 group-hover:opacity-20 transition-opacity duration-700 rounded-full z-0",
                    a.bg
                )} />

                <div className="relative z-10 flex flex-col h-full">
                    {/* Header: Icon & Tech ID */}
                    <div className="flex items-center justify-between mb-8">
                        <div className={cn(
                            "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 border group-hover:scale-110 group-hover:rotate-3 shadow-xl",
                            a.bg,
                            a.border
                        )}>
                            <Icon className={cn("w-7 h-7", a.text)} strokeWidth={1.5} />
                        </div>
                    </div>

                    {/* Body: Title & Intro */}
                    <div className="space-y-4 flex-1 mt-2">
                        <div className="flex items-center gap-3">
                            <h3 className="text-xl font-black text-white tracking-tighter uppercase leading-tight">
                                {title}
                            </h3>
                            {warningBadge && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[9px] font-black uppercase tracking-[0.2em] whitespace-nowrap shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                                    <ShieldAlert className="w-3 h-3" />
                                    {warningBadge}
                                </span>
                            )}
                        </div>
                        <p className="text-[13px] text-zinc-500 font-medium leading-relaxed group-hover:text-zinc-400 transition-colors">
                            {description}
                        </p>
                    </div>

                    {/* Footer: Action & Decoration */}
                    <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                        <div className={cn(
                            "flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all",
                            a.text,
                            "opacity-40 group-hover:opacity-100"
                        )}>
                            <span className="group-hover:translate-x-1 transition-transform">Accès Panel</span>
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1.5 transition-transform" />
                        </div>
                        
                        {/* Industrial Corner Detail */}
                        <div className="flex gap-1">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="h-1 w-1 rounded-full bg-white/5 group-hover:bg-white/20 transition-colors" />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Corner Decoration */}
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-30 transition-opacity">
                    <div className="h-[1px] w-12 bg-white/40" />
                    <div className="h-12 w-[1px] bg-white/40 absolute top-3 right-3" />
                </div>
            </div>
        </Link>
    );
}
