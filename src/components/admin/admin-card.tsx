"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
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
    Ticket,
    Key,
    Terminal,
    CalendarClock,
    Sparkles,
    Coins,
    LayoutDashboard,
    Bell,
    Activity,
    type LucideIcon,
} from "lucide-react";

interface AdminCardProps {
    href: string;
    iconName: string;
    title: string;
    description: string;
    /** Conservé pour compatibilité — l'accent visuel est unique (norme registre). */
    accent: string;
    guildId: string;
    initialPinned: boolean;
    warningBadge?: string;
    /** Identifiant stable pour le tour admin (data-tour). */
    tourId?: string;
    /** Asset officiel Dofus 2x (ex. /assets/dofus/modules/guild.png) — conservé tel quel. */
    dofusAsset?: string;
    /** Étiquette courte de section (ex. « Structure », « Supervision »). */
    tag?: string;
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
    Puzzle,
    Ticket,
    Key,
    Terminal,
    CalendarClock,
    CalendarClockIcon: CalendarClock,
    Sparkles,
    Coins,
    LayoutDashboard,
    Bell,
    Activity,
};

export function AdminCard({
    href,
    iconName,
    title,
    description,
    guildId,
    initialPinned,
    warningBadge,
    tourId,
    dofusAsset,
    tag,
}: AdminCardProps) {
    const [isPinned, setIsPinned] = useState(initialPinned);
    const [isPending, startTransition] = useTransition();
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
                        icon: newState ? <Star className="w-4 h-4 text-warning fill-amber-400" /> : undefined,
                    });
                }
            } catch {
                setIsPinned(!newState);
                toast.error("Erreur serveur");
            }
        });
    };

    return (
        <Link
            href={href}
            data-tour={tourId}
            className="group p-4 rounded-xl border border-border bg-surface/50 hover:bg-surface hover:border-border-strong transition-colors flex flex-col justify-between gap-4 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
            <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="w-10 h-10 rounded-lg bg-background/80 border border-border flex items-center justify-center p-1.5 group-hover:border-border-strong transition-colors shrink-0">
                        {dofusAsset ? (
                            <Image
                                src={dofusAsset}
                                alt=""
                                width={28}
                                height={28}
                                aria-hidden="true"
                                className="w-full h-full object-contain"
                            />
                        ) : (
                            <Icon className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" strokeWidth={1.75} aria-hidden="true" />
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                        {warningBadge ? (
                            <span className="reg-tag reg-tag-accent text-[10px] font-mono font-semibold uppercase whitespace-nowrap">
                                {warningBadge}
                            </span>
                        ) : tag ? (
                            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/50 uppercase whitespace-nowrap">
                                {tag}
                            </span>
                        ) : null}
                        <button
                            onClick={handleTogglePin}
                            disabled={isPending}
                            aria-label={isPinned ? `Retirer ${title} des favoris` : `Ajouter ${title} aux favoris`}
                            aria-pressed={isPinned}
                            title={isPinned ? "Retirer des favoris" : "Ajouter aux favoris"}
                            className={cn(
                                "p-1.5 rounded-md border transition-colors shrink-0",
                                isPinned
                                    ? "bg-warning/10 border-warning/30 text-warning"
                                    : "border-transparent text-muted-foreground/40 hover:text-foreground hover:bg-muted/60 hover:border-border/50"
                            )}
                        >
                            <Star className={cn("w-3.5 h-3.5", isPinned && "fill-current")} aria-hidden="true" />
                        </button>
                    </div>
                </div>

                <div>
                    <h3 className="text-sm font-bold text-foreground group-hover:text-accent transition-colors leading-snug">
                        {title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {description}
                    </p>
                </div>
            </div>

            <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs font-semibold text-foreground group-hover:text-accent transition-colors">
                <span>Ouvrir le panneau</span>
                <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" aria-hidden="true" />
            </div>
        </Link>
    );
}
