"use client";

import { cn } from "@/lib/utils";
import React, { ReactNode } from "react";

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
    children?: ReactNode;
    showRadialGradient?: boolean;
}

/**
 * Déprécié — anti « AI slop ».
 * Les couches décoratives (aurora animée, blur + invert, mix-blend-difference)
 * ont été supprimées : le composant est conservé uniquement pour la compatibilité
 * des appels (conteneur relatif plat, zéro effet). Ne pas réutiliser.
 */
export const AuroraBackground = ({
    className,
    children,
    showRadialGradient: _showRadialGradient,
    ...props
}: AuroraBackgroundProps) => {
    return (
        <div
            className={cn(
                "relative",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
};
