import { cn } from "@/lib/utils";
import React from "react";

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: "default" | "hover-glow" | "interactive";
    intensity?: "low" | "high";
    children: React.ReactNode;
}

export function GlassPanel({
    className,
    variant = "default",
    intensity = "low",
    children,
    ...props
}: GlassPanelProps) {
    const variants = {
        default: "bg-glass border-white/5",
        "hover-glow": "bg-glass border-white/5 hover:border-neon-green/30 hover:shadow-[0_0_20px_rgba(57,255,20,0.1)] transition-all duration-300",
        interactive: "bg-glass border-white/10 hover:bg-white/5 active:scale-[0.99] transition-all duration-200 cursor-pointer",
    };

    const intensities = {
        low: "backdrop-blur-md",
        high: "backdrop-blur-xl bg-void-surface/50",
    };

    return (
        <div
            className={cn(
                "rounded-xl border shadow-lg relative overflow-hidden",
                variants[variant],
                intensities[intensity],
                className
            )}
            {...props}
        >
            {/* Glossy sheen overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

            {/* Content */}
            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
}
