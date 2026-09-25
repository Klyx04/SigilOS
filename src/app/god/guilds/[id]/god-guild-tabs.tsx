"use client";

/**
 * Onglets de la fiche guilde God (`/god/guilds/[id]`).
 *
 * Audit croisé du 24/09/2026 : la fiche empilait **roster + modules** à la suite,
 * sans onglets, sans logs (alors que le rendu riche existe côté guilde) et sans
 * aucune vue des **accès** (rôles Discord, `rolesMapping`, `usersMapping`, rôle
 * « Accès Dashboard », propriétaire). Les onglets vivent ici ; le contenu reste
 * rendu **côté serveur** (aucune donnée n'est refetchée par ce composant).
 */

import { useState } from "react";
import type { ReactNode } from "react";
import { ShieldCheck, ScrollText, Puzzle } from "lucide-react";
import { cn } from "@/lib/utils";

type GodGuildTabId = "modules" | "logs" | "access";

const TABS: { id: GodGuildTabId; label: string; icon: typeof Puzzle }[] = [
    { id: "modules", label: "Modules", icon: Puzzle },
    { id: "logs", label: "Logs", icon: ScrollText },
    { id: "access", label: "Accès & RBAC", icon: ShieldCheck },
];

export function GodGuildTabs({
    modules,
    logs,
    access,
    logsBadge,
}: {
    modules: ReactNode;
    logs: ReactNode;
    access: ReactNode;
    /** Compteur affiché sur l'onglet Logs (journal de la guilde, 30 j). */
    logsBadge?: number;
}) {
    const [tab, setTab] = useState<GodGuildTabId>("modules");
    const panes: Record<GodGuildTabId, ReactNode> = { modules, logs, access };

    return (
        <div className="space-y-4">
            <div
                role="tablist"
                className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-zinc-950/80 p-1"
            >
                {TABS.map(({ id, label, icon: Icon }) => {
                    const active = tab === id;
                    return (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => setTab(id)}
                            className={cn(
                                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                                active
                                    ? "bg-zinc-100 text-zinc-900"
                                    : "text-zinc-400 hover:text-zinc-200",
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            {label}
                            {id === "logs" && typeof logsBadge === "number" ? (
                                <span
                                    className={cn(
                                        "tabular-nums rounded-full px-1.5 text-xs font-bold",
                                        active ? "bg-zinc-900/10 text-zinc-900" : "bg-zinc-800 text-zinc-300",
                                    )}
                                >
                                    {logsBadge}
                                </span>
                            ) : null}
                        </button>
                    );
                })}
            </div>

            <div role="tabpanel">{panes[tab]}</div>
        </div>
    );
}
