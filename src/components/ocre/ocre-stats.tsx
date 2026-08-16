"use client";

// =============================================================================
// OCRE STAT CARDS - Premium glassmorphism stat display
// =============================================================================

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface OcreStatCardProps {
    label: string;
    value: number;
    icon: LucideIcon;
    color: "red" | "green" | "amber" | "blue" | "purple";
    subValue?: string;
    delay?: number;
}

const colorClasses = {
    red: {
        bg: "from-danger/20 to-danger/5",
        border: "border-danger/30 hover:border-danger/50",
        icon: "text-danger",
        glow: "shadow-red-500/10",
    },
    green: {
        bg: "from-success/20 to-success/5",
        border: "border-success/30 hover:border-success/50",
        icon: "text-success",
        glow: "shadow-emerald-500/10",
    },
    amber: {
        bg: "from-warning/20 to-warning/5",
        border: "border-warning/30 hover:border-warning/50",
        icon: "text-warning",
        glow: "shadow-amber-500/10",
    },
    blue: {
        bg: "from-info/20 to-info/5",
        border: "border-info/30 hover:border-info/50",
        icon: "text-info",
        glow: "shadow-blue-500/10",
    },
    purple: {
        bg: "from-info/20 to-info/5",
        border: "border-info/30 hover:border-info/50",
        icon: "text-info",
        glow: "shadow-purple-500/10",
    },
};

export function OcreStatCard({
    label,
    value,
    icon: Icon,
    color,
    subValue,
    delay = 0,
}: OcreStatCardProps) {
    const colors = colorClasses[color];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay }}
            className={cn(
                "relative overflow-hidden rounded-xl border backdrop-blur-xl",
                "bg-gradient-to-br",
                colors.bg,
                colors.border,
                "transition-all duration-300",
                "hover:scale-[1.02]",
                `hover:${colors.glow} hover:shadow-lg`
            )}
        >
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

            <div className="relative p-3 flex items-center gap-3">
                <div className={cn("shrink-0", colors.icon)}>
                    <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <motion.p
                        className="text-xl font-bold leading-tight"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: delay + 0.2 }}
                    >
                        {value.toLocaleString("fr-FR")}
                    </motion.p>
                    <p className="text-caption uppercase tracking-wider text-muted-foreground/60 font-bold truncate">{label}</p>
                    {subValue && (
                        <p className={cn("text-caption font-medium mt-0.5", colors.icon)}>
                            ✨ {subValue}
                        </p>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

// Grid wrapper for consistent layout
interface StatsGridProps {
    children: React.ReactNode;
    columns?: 2 | 3 | 4;
}

export function StatsGrid({ children, columns = 4 }: StatsGridProps) {
    const colsClass = {
        2: "grid-cols-1 sm:grid-cols-2",
        3: "grid-cols-1 sm:grid-cols-3",
        4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    };

    return (
        <div className={cn("grid gap-4", colsClass[columns])}>
            {children}
        </div>
    );
}
