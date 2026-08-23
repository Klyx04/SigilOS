import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** GodPanel — enveloppe de section pleine largeur avec padding cohérent. */
export function GodPanel({
    className,
    children,
}: {
    className?: string;
    children?: ReactNode;
}) {
    return (
        <div className={cn("w-full space-y-5", className)}>
            {children}
        </div>
    );
}

/** GodPanelGrid — grille responsive standard pour les cartes God. */
export function GodPanelGrid({
    className,
    children,
}: {
    className?: string;
    children?: ReactNode;
}) {
    return (
        <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", className)}>
            {children}
        </div>
    );
}