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
                "group flex items-center gap-4 p-5 rounded-2xl border text-left outline-none transition-colors duration-200 select-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
                isActive
                    ? "border-emerald-500/40 bg-emerald-500/[0.06]"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20"
            )}
        >
            <div className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border transition-colors duration-200",
                isActive
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-zinc-900/60 border-white/5 text-zinc-500 group-hover:text-zinc-300 group-hover:border-white/10"
            )}>
                <Icon className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
                <p className={cn(
                    "font-bold transition-colors duration-200",
                    isActive ? "text-white" : "text-zinc-300 group-hover:text-white"
                )}>
                    {label}
                </p>
                <p className="text-caption font-medium text-zinc-500 mt-0.5">
                    {description}
                </p>
            </div>

            {isActive && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" aria-hidden />
            )}
            <ChevronRight className={cn(
                "w-4 h-4 shrink-0 transition-colors duration-200",
                isActive ? "text-emerald-400" : "text-zinc-600 group-hover:text-zinc-400"
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
