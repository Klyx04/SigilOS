"use client";

/**
 * Sondages — **filtre de participation** : recherche de membre + rôle Discord.
 *
 * Deux contrôles **compacts** sur une seule ligne (empilés sur mobile), aucun
 * encombrement : la liste filtrée est celle des votants d'un choix **et** celle
 * des non-votants — un seul état pour les deux, donc jamais deux listes qui se
 * contredisent.
 *
 * Le sélecteur de rôle n'apparaît **que** si des rôles sont réellement
 * filtrables (`roles.length > 0`) : sans données Discord, l'écran ne montre pas
 * un contrôle inerte.
 */

import { Search, X } from "lucide-react";
import { POLL_FILTER_CONTROL, POLL_SLOT_COUNTER } from "@/lib/polls/ui";
import { cn } from "@/lib/utils";

export interface PollParticipationFilterProps {
    query: string;
    onQueryChange: (value: string) => void;
    roleId: string;
    onRoleChange: (value: string) => void;
    roles: { id: string; name: string; color?: string | null }[];
    /** Éléments affichés / total, pour ne jamais laisser croire à une liste vide. */
    shown: number;
    total: number;
    className?: string;
}

export function PollParticipationFilter({
    query,
    onQueryChange,
    roleId,
    onRoleChange,
    roles,
    shown,
    total,
    className,
}: PollParticipationFilterProps) {
    const filtered = query.trim().length > 0 || roleId.length > 0;

    return (
        <div className={cn("flex flex-col sm:flex-row sm:items-center gap-2", className)}>
            <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <input
                    type="search"
                    value={query}
                    onChange={(event) => onQueryChange(event.target.value)}
                    placeholder="Rechercher un membre…"
                    aria-label="Rechercher un membre"
                    className={cn(POLL_FILTER_CONTROL, "w-full pl-8")}
                />
            </div>

            {roles.length > 0 && (
                <select
                    value={roleId}
                    onChange={(event) => onRoleChange(event.target.value)}
                    aria-label="Filtrer par rôle Discord"
                    className={cn(POLL_FILTER_CONTROL, "w-full sm:w-48 appearance-none pr-7 cursor-pointer")}
                    style={{
                        backgroundImage:
                            "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 0.6rem center",
                    }}
                >
                    <option value="">Tous les rôles</option>
                    {roles.map((role) => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                </select>
            )}

            <div className="flex items-center gap-2 sm:ml-auto">
                <span className={POLL_SLOT_COUNTER}>
                    {filtered ? `${shown} / ${total}` : `${total} membre${total > 1 ? "s" : ""}`}
                </span>
                {filtered && (
                    <button
                        type="button"
                        onClick={() => {
                            onQueryChange("");
                            onRoleChange("");
                        }}
                        title="Réinitialiser le filtre"
                        aria-label="Réinitialiser le filtre"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </div>
    );
}
