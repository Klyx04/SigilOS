"use client";

import { MessageSquare, BookOpen, LucideIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
    color: "emerald" | "amber" | "indigo";
    onClick: () => void;
}

function HubCard({ id, label, description, icon: Icon, isActive, color, onClick }: HubCardProps) {
    const colorMap = {
        emerald: {
            text: "text-emerald-400",
            bg: "bg-emerald-500/10",
            border: "border-emerald-500/30",
            glow: "shadow-[0_0_30px_rgba(16,185,129,0.15)]",
            accent: "bg-emerald-500",
            activeGlow: "rgba(16, 185, 129, 0.4)"
        },
        amber: {
            text: "text-amber-400",
            bg: "bg-amber-500/10",
            border: "border-amber-500/30",
            glow: "shadow-[0_0_30px_rgba(245,158,11,0.15)]",
            accent: "bg-amber-500",
            activeGlow: "rgba(245, 158, 11, 0.4)"
        },
        indigo: {
            text: "text-indigo-400",
            bg: "bg-indigo-500/10",
            border: "border-indigo-500/30",
            glow: "shadow-[0_0_30px_rgba(99,102,241,0.15)]",
            accent: "bg-indigo-500",
            activeGlow: "rgba(99, 102, 241, 0.4)"
        }
    };

    const theme = colorMap[color];

    return (
        <button
            onClick={onClick}
            className={cn(
                "relative group flex items-center gap-5 p-6 rounded-3xl transition-all duration-700 outline-none select-none",
                isActive 
                    ? "glass-premium bg-white/[0.03] border-white/10 scale-[1.02] shadow-2xl" 
                    : "bg-white/[0.06] border-white/10 hover:bg-white/[0.08] hover:border-white/20 hover:-translate-y-1 hover:shadow-xl"
            )}
        >
            {/* Themed Background Glow */}
            <AnimatePresence>
                {isActive ? (
                    <motion.div 
                        layoutId={`hub-glow-${id}`}
                        className="absolute inset-0 rounded-[inherit] -z-10"
                        style={{ background: `radial-gradient(circle at center, ${theme.activeGlow}, transparent 70%)` }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.35 }}
                        exit={{ opacity: 0 }}
                    />
                ) : (
                    <div 
                        className={cn(
                            "absolute inset-0 rounded-[inherit] -z-10 opacity-5 group-hover:opacity-15 transition-opacity duration-700",
                            theme.accent
                        )}
                        style={{ background: `radial-gradient(circle at center, ${theme.activeGlow}, transparent 80%)` }}
                    />
                )}
            </AnimatePresence>

            <div className="noise-overlay absolute inset-0" />

            {/* Top Gloss Highlight */}
            {isActive && (
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            )}

            {/* Icon Container */}
            <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border transition-all duration-700 relative z-10",
                isActive 
                    ? cn(theme.bg, theme.border, theme.text, theme.glow) 
                    : cn("bg-zinc-900/50 border-white/5 group-hover:border-white/10", theme.text, "opacity-40 group-hover:opacity-100")
            )}>
                {/* Micro-glow for icon */}
                {isActive && (
                    <div className={cn("absolute inset-0 blur-lg opacity-40 -z-10", theme.accent)} />
                )}
                <Icon className={cn(
                    "w-6 h-6 transition-transform duration-700",
                    isActive ? "scale-110 rotate-[5deg]" : "group-hover:scale-110"
                )} />
            </div>

            <div className="text-left relative z-10">
                <p className={cn(
                    "font-black text-[13px] uppercase tracking-[0.3em] transition-all duration-500",
                    isActive ? "text-foreground drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]" : "text-zinc-300 group-hover:text-white"
                )}>
                    {label}
                </p>
                <p className={cn(
                    "text-[10px] font-bold mt-1 tracking-wider transition-colors duration-500",
                    isActive ? "text-zinc-400" : "text-zinc-500 group-hover:text-zinc-400"
                )}>
                    {description}
                </p>
            </div>

            {/* Bottom Glow Indicator */}
            {isActive && (
                <motion.div 
                    layoutId="hub-active-pill"
                    className={cn("absolute -bottom-1 left-1/2 -translate-x-1/2 w-1/3 h-1.5 rounded-full blur-sm", theme.accent)}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
            )}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <AnimatePresence mode="popLayout">
                {canViewWelcome && (
                    <HubCard 
                        id="welcome"
                        label="Bienvenue"
                        description="Accueil membres"
                        icon={MessageSquare}
                        isActive={initialTab === "welcome"}
                        color="emerald"
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
                        color="amber"
                        onClick={() => setTab("presentation")}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

