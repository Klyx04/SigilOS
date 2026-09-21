"use client";

// =============================================================================
// OCRE STAT CARDS — registre (refonte anti-slop)
// =============================================================================
// Ce qui a été retiré volontairement : le verre dépoli (`backdrop-blur-xl`), le
// dégradé de fond, le halo coloré au survol, l'agrandissement au survol
// (`hover:scale-*`), les animations d'entrée `framer-motion` et l'émoji `✨` devant
// la sous-valeur. La profondeur passe par la luminosité des surfaces + les bordures
// (charte zéro glow). La couleur ne teinte QUE le picto et la sous-valeur.

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface OcreStatCardProps {
    label: string;
    value: number;
    icon: LucideIcon;
    color: "red" | "green" | "amber" | "blue" | "purple";
    subValue?: string;
}

/** Accent de lecture d'un compteur (une seule couleur par carte, jamais de fond). */
const ACCENT: Record<OcreStatCardProps["color"], string> = {
    red: "text-danger",
    green: "text-success",
    amber: "text-warning",
    blue: "text-info",
    purple: "text-info",
};

export function OcreStatCard({
    label,
    value,
    icon: Icon,
    color,
    subValue,
}: OcreStatCardProps) {
    return (
        <Card className="border-border bg-card">
            <CardContent className="flex items-center gap-3 p-3">
                <Icon className={cn("h-4 w-4 shrink-0", ACCENT[color])} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                    <p className="text-xl font-bold leading-tight tabular-nums text-foreground">
                        {value.toLocaleString("fr-FR")}
                    </p>
                    <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
                    {subValue && (
                        <p className={cn("mt-0.5 truncate text-xs font-medium", ACCENT[color])}>
                            {subValue}
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

// Grid wrapper for consistent layout
interface StatsGridProps {
    children: ReactNode;
    columns?: 2 | 3 | 4;
}

export function StatsGrid({ children, columns = 4 }: StatsGridProps) {
    const colsClass = {
        2: "grid-cols-1 sm:grid-cols-2",
        3: "grid-cols-1 sm:grid-cols-3",
        4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    };

    return (
        <div className={cn("grid gap-3", colsClass[columns])}>
            {children}
        </div>
    );
}
