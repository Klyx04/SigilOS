"use client";

import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    variant?: "default" | "minimal" | "glow" | "premium";
    className?: string;
    iconClassName?: string;
}

export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    variant = "premium",
    className,
    iconClassName
}: EmptyStateProps) {
    return (
        <div className={cn(
            "relative flex flex-col items-center justify-center text-center p-12 rounded-3xl border transition-all duration-700 overflow-hidden group",
            variant === "premium" ? "bg-zinc-900/20 border-white/5 shadow-2xl backdrop-blur-md" :
                variant === "glow" ? "bg-zinc-900/40 border-white/5 hover:border-white/10" : "border-zinc-800",
            className
        )}>
            {/* Background Effects */}
            {(variant === "glow" || variant === "premium") && (
                <div className="absolute inset-0 z-0 pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                    <div className="absolute bottom-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

                    <motion.div
                        animate={{
                            scale: [1, 1.2, 1],
                            opacity: [0.1, 0.15, 0.1]
                        }}
                        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute -top-24 -left-24 w-64 h-64 bg-primary/20 blur-[100px]"
                    />
                    <motion.div
                        animate={{
                            scale: [1, 1.3, 1],
                            opacity: [0.1, 0.2, 0.1]
                        }}
                        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                        className="absolute -bottom-24 -right-24 w-64 h-64 bg-purple-500/20 blur-[100px]"
                    />
                </div>
            )}

            <div className="relative z-10 flex flex-col items-center w-full max-w-sm">
                {/* Icon Container with Animated Gradient Border */}
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", damping: 15 }}
                    className={cn(
                        "relative p-6 rounded-2xl bg-zinc-950/50 border border-white/10 mb-6 shadow-2xl group-hover:border-primary/30 transition-colors duration-500",
                        variant === "premium" && "before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-br before:from-primary/20 before:to-purple-500/20 before:opacity-0 group-hover:before:opacity-100 before:transition-opacity"
                    )}
                >
                    <Icon className={cn(
                        "w-10 h-10 relative z-10",
                        variant === "premium" || variant === "glow"
                            ? "text-primary group-hover:text-white transition-colors duration-500 drop-shadow-[0_0_15px_rgba(var(--primary-rgb),0.4)]"
                            : "text-zinc-500",
                        iconClassName
                    )} />
                </motion.div>

                <h3 className="text-2xl font-black text-white mb-3 tracking-tight group-hover:translate-y-[-2px] transition-transform duration-500">
                    {title}
                </h3>

                <p className="text-base text-zinc-400/80 mb-8 leading-relaxed font-medium">
                    {description}
                </p>

                {action && (
                    <Button
                        onClick={action.onClick}
                        className="relative h-11 px-8 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 font-black text-sm transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)]"
                    >
                        {action.label}
                    </Button>
                )}
            </div>

            {/* Dust Particles Overlay effect maybe? No, let's keep it clean. */}
        </div>
    );
}
