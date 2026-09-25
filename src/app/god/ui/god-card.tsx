import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

/**
 * Recette de carte God — **source unique**.
 *
 * Le même `bg-zinc-900/2x border border-white/5 rounded-3xl` était recopié à la main
 * dans les écrans God (audit du 24/09 : 4 fichiers, 7 occurrences). Il est exporté
 * pour les blocs dont la balise n'est pas réécrite d'un coup, afin qu'ils partagent
 * exactement la même recette que `<GodCard>`.
 */
export const GOD_CARD_BASE = "rounded-3xl border border-white/5 bg-zinc-900/10 backdrop-blur-xl";

export function GodCard({ className, children, ...props }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
    return (
        <div className={cn(GOD_CARD_BASE, className)} {...props}>
            {children}
        </div>
    );
}

export function GodCardHeader({ className, title, description, actions }: {
    className?: string; title: ReactNode; description?: ReactNode; actions?: ReactNode;
}) {
    return (
        <div className={cn("flex items-start justify-between gap-4 p-5 pb-3 border-b border-white/5", className)}>
            <div className="space-y-1">
                <h3 className="text-sm font-bold tracking-tight text-white">{title}</h3>
                {description ? <p className="text-xs text-zinc-400">{description}</p> : null}
            </div>
            {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
        </div>
    );
}

export function GodCardBody({ className, children }: { className?: string; children?: ReactNode }) {
    return <div className={cn("p-5", className)}>{children}</div>;
}