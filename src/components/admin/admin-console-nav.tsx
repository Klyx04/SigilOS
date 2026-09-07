"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Puzzle, Shield, Rocket, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sous-navigation des pages profondes (modules, permissions, mise en route).
 * PAS de "Vue d'ensemble" : l'accueil c'est /admin (Staff), on n'y revient
 * pas via un onglet redondant. Règles d'audience :
 * - Pilotage + Modules : natifs Discord uniquement.
 * - Accès & Rôles : natifs + délégués `system:rbac` (succession).
 */
export function AdminConsoleNav({
    guildId,
    showModules,
    showAccess,
    showOnboarding,
    showPilotage,
}: {
    guildId: string;
    showModules: boolean;
    showAccess: boolean;
    showOnboarding: boolean;
    /** Onglet Pilotage (page dédiée natifs Discord). Absent = non affiché. */
    showPilotage?: boolean;
}) {
    const pathname = usePathname();
    // Pas d'onglet "Vue d'ensemble" : la page d'accueil c'est /admin (Staff),
    // on n'y revient pas depuis les pages profondes via un onglet redondant.
    const tabs = [
        ...(showPilotage
            ? [
                  {
                      href: `/dashboard/${guildId}/admin/pilotage`,
                      label: "Pilotage",
                      icon: Crown,
                      active: pathname.startsWith(`/dashboard/${guildId}/admin/pilotage`),
                      visible: true,
                  },
              ]
            : []),
        {
            href: `/dashboard/${guildId}/admin/getting-started`,
            label: "Mise en route",
            icon: Rocket,
            active: pathname.startsWith(`/dashboard/${guildId}/admin/getting-started`),
            visible: showOnboarding,
        },
        {
            href: `/dashboard/${guildId}/admin/modules`,
            label: "Modules",
            icon: Puzzle,
            active: pathname.startsWith(`/dashboard/${guildId}/admin/modules`),
            visible: showModules,
        },
        {
            href: `/dashboard/${guildId}/admin/permissions`,
            label: "Accès & Rôles",
            icon: Shield,
            active: pathname.startsWith(`/dashboard/${guildId}/admin/permissions`),
            visible: showAccess,
        },
    ].filter((t) => t.visible);

    if (tabs.length <= 1) return null;

    return (
        <nav aria-label="Console d'administration" className="flex items-center gap-1.5 flex-wrap">
            {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        aria-current={tab.active ? "page" : undefined}
                        className={cn(
                            "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-colors",
                            tab.active
                                ? "bg-success/15 border-success/40 text-success"
                                : "bg-surface border-border text-muted-foreground hover:text-foreground hover:border-border-strong"
                        )}
                    >
                        <Icon className="w-3.5 h-3.5" />
                        {tab.label}
                    </Link>
                );
            })}
        </nav>
    );
}
