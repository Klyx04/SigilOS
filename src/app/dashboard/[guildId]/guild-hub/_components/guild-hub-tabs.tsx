"use client";

import { MessageSquare, BookOpen, ChevronRight, LucideIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

interface GuildHubTabsProps {
    initialTab: string;
    canViewWelcome: boolean;
    canViewPresentation: boolean;
}

interface HubCardProps {
    id: string;
    label: string;
    description: string;
    icon: LucideIcon;
    isActive: boolean;
    onClick: () => void;
}

// #83 — Refonte calme : suppression glows/radial-gradients/layoutId spring/blur,
// hover = fond + bordure uniquement, un seul accent (emerald), 150-200ms.
function HubCard({ label, description, icon: Icon, isActive, onClick }: HubCardProps) {
    return (
        <button
            onClick={onClick}
            aria-pressed={isActive}
            className={cn(
                "group flex items-center gap-4 p-5 rounded-2xl border text-left outline-none transition-colors duration-200 select-none focus-visible:ring-2 focus-visible:ring-success/50",
                isActive
                    ? "border-success/40 bg-success/[0.06]"
                    : "border-border bg-surface hover:bg-surface hover:border-border-strong"
            )}
        >
            <div className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border transition-colors duration-200",
                isActive
                    ? "bg-success/10 border-success/30 text-success"
                    : "bg-surface/60 border-border text-muted-foreground group-hover:text-foreground group-hover:border-border"
            )}>
                <Icon className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
                <p className={cn(
                    "font-bold transition-colors duration-200",
                    isActive ? "text-foreground" : "text-foreground group-hover:text-foreground"
                )}>
                    {label}
                </p>
                <p className="text-caption font-medium text-muted-foreground mt-0.5">
                    {description}
                </p>
            </div>

            {isActive && (
                <span className="w-2 h-2 rounded-full bg-success shrink-0" aria-hidden />
            )}
            <ChevronRight className={cn(
                "w-4 h-4 shrink-0 transition-colors duration-200",
                isActive ? "text-success" : "text-muted-foreground group-hover:text-muted-foreground"
            )} />
        </button>
    );
}

export function GuildHubTabs({
    initialTab,
    canViewWelcome,
    canViewPresentation
}: GuildHubTabsProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    function setTab(tab: string) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", tab);
        router.push(`?${params.toString()}`);
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {canViewWelcome && (
                <HubCard
                    id="welcome"
                    label="Bienvenue"
                    description="Accueil membres"
                    icon={MessageSquare}
                    isActive={initialTab === "welcome"}
                    onClick={() => setTab("welcome")}
                />
            )}

            {canViewPresentation && (
                <HubCard
                    id="presentation"
                    label="Présentation"
                    description="Notre histoire"
                    icon={BookOpen}
                    isActive={initialTab === "presentation"}
                    onClick={() => setTab("presentation")}
                />
            )}
        </div>
    );
}
