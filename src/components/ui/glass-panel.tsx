import { cn } from "@/lib/utils";
import React from "react";

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: "default" | "hover-glow" | "interactive";
    intensity?: "low" | "high";
    children: React.ReactNode;
}

/**
 * Panneau de surface plat — anti « AI slop ».
 * Plus de verre dépoli (backdrop-blur), de reflet glossy, ni d'ombre colorée :
 * la profondeur passe par la luminosité des surfaces + les bordures (charte zéro glow).
 * Les props `intensity` et `hover-glow` sont conservées pour la compatibilité des appels
 * mais ne produisent plus d'effet néon.
 */
export function GlassPanel({
    className,
    variant = "default",
    intensity: _intensity,
    children,
    ...props
}: GlassPanelProps) {
    const variants = {
        default: "bg-surface border-border",
        "hover-glow": "bg-surface border-border hover:border-border-strong",
        interactive: "bg-surface border-border hover:bg-elevated cursor-pointer",
    };

    return (
        <div
            className={cn(
                "rounded-xl border relative overflow-hidden transition-colors duration-200",
                variants[variant],
                className
            )}
            {...props}
        >
            {/* Content */}
            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
}
