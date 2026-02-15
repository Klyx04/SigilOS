"use client";

import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    variant?: "default" | "minimal" | "glow";
    className?: string;
    iconClassName?: string;
}

export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    variant = "glow",
    className,
    iconClassName
}: EmptyStateProps) {
    return (
        <div className={cn(
            "flex flex-col items-center justify-center text-center p-8 rounded-2xl border border-dashed transition-all duration-500",
            variant === "glow" ? "bg-zinc-900/40 border-white/5 hover:border-white/10" : "border-zinc-800",
            className
        )}>
            {/* Glow / Aura Backdrop */}
            {variant === "glow" && (
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-2xl">
                    <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/10 blur-[100px] animate-pulse" />
                    <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 blur-[100px] animate-pulse delay-700" />
                </div>
            )}

            <div className="relative z-10 flex flex-col items-center">
                {/* Icon Container with Glow */}
                <div className={cn(
                    "p-4 rounded-full bg-zinc-900 border border-white/5 mb-4 shadow-xl",
                    variant === "glow" && "shadow-primary/5 ring-1 ring-white/10"
                )}>
                    <Icon className={cn(
                        "w-8 h-8",
                        variant === "glow" ? "text-primary drop-shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]" : "text-zinc-500",
                        iconClassName
                    )} />
                </div>

                <h3 className="text-lg font-bold text-white mb-2 leading-tight">
                    {title}
                </h3>

                <p className="text-sm text-zinc-500 max-w-[280px] mb-6">
                    {description}
                </p>

                {action && (
                    <Button
                        onClick={action.onClick}
                        variant="outline"
                        className="bg-zinc-900/50 border-white/10 hover:bg-white/10 hover:border-white/20 text-xs font-bold px-6 h-9 transition-all active:scale-95"
                    >
                        {action.label}
                    </Button>
                )}
            </div>
        </div>
    );
}
