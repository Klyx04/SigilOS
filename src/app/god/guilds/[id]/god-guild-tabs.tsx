"use client";

/**
 * Onglets de la fiche guilde God (`/god/guilds/[id]`).
 *
 * Refonte du 16/11/2026 : la fiche empilait le roster puis trois onglets ; le roster
 * devient un onglet (**Vue d'ensemble**) et la barre passe aux jetons du kit. Quatre
 * vues, une seule barre, aucune animation décorative. Le contenu reste rendu
 * **côté serveur** (aucune donnée n'est refetchée par ce composant).
 */

import { useState } from "react";
import type { ReactNode } from "react";
import { LayoutDashboard, ShieldCheck, ScrollText, Puzzle } from "lucide-react";
import { cn } from "@/lib/utils";

type GodGuildTabId = "overview" | "modules" | "logs" | "access";

const TABS: { id: GodGuildTabId; label: string; icon: typeof Puzzle }[] = [
    { id: "overview", label: "Vue d'ensemble", icon: LayoutDashboard },
    { id: "modules", label: "Modules", icon: Puzzle },
    { id: "logs", label: "Journal", icon: ScrollText },
    { id: "access", label: "Accès & RBAC", icon: ShieldCheck },
];

export function GodGuildTabs({
    overview,
    modules,
    logs,
    access,
    logsBadge,
}: {
    overview: ReactNode;
    modules: ReactNode;
    logs: ReactNode;
    access: ReactNode;
    /** Compteur affiché sur l'onglet Journal (30 j). */
    logsBadge?: number;
}) {
    const [tab, setTab] = useState<GodGuildTabId>("overview");
    const panes: Record<GodGuildTabId, ReactNode> = { overview, modules, logs, access };

    return (
        <div className="space-y-4">
            <div
                role="tablist"
                className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-surface/10 p-1"
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
                                "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                active
                                    ? "bg-elevated text-foreground"
                                    : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            <Icon className="h-4 w-4" aria-hidden="true" />
                            {label}
                            {id === "logs" && typeof logsBadge === "number" && logsBadge > 0 ? (
                                <span className="rounded-full bg-muted/60 px-1.5 text-xs font-semibold tabular-nums text-muted-foreground">
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

