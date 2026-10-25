"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GameIcon } from "@/components/shared/game-icon";
import { cn } from "@/lib/utils";
import type { RosterRoleInput, RosterRow } from "@/lib/member-roster";

import { DailyReportButton } from "@/components/admin/daily-report-button";
import { MemberBlacklist } from "./member-blacklist";
import { InGameGuildPanel } from "./in-game-guild-panel";
import { MemberMulesSummary } from "./member-mules-summary";
import { MemberRosterList } from "./member-roster-list";
import { SeniorityRolesPanel } from "./seniority-roles-panel";

interface MemberManagementProps {
    guildId: string;
    rows: RosterRow[];
    roles: RosterRoleInput[];
    /** Ids des rôles Discord **autorisés dashboard** : borne le filtre de rôles au RBAC réel. */
    dashboardRoleIds?: string[];
    /** Rôles Discord comptés comme « en guilde en jeu » (onglet Mules). */
    inGameGuildRoleIds?: string[];
    stats: { active: number; archived: number; banned: number; total: number; maxMembers: number };
    discordAvailable: boolean;
    welcomeBadgeName: string;
    isSuperAdmin: boolean;
    canManageMembers: boolean;
    canDeleteMembers: boolean;
    currentUserId: string;
    ownerId: string | null;
    /** Lien profond historique `?tab=registre` (le registre est désormais dans la liste unique). */
    initialTab?: string;
}

/** Onglets (assets Dofus réels, jamais d'emoji dans un libellé structurant). */
const TABS = [
    { id: "membres", label: "Membres", icon: "party.png" },
    { id: "mules", label: "Mules", icon: "petsmount.png" },
    { id: "anciennete", label: "Rôles d'ancienneté", icon: "/assets/dofus/modules/ladder.png" },
    { id: "blacklist", label: "Blacklist", icon: "circle-warning.png" },
] as const;

type MembersTab = (typeof TABS)[number]["id"];

export default function MemberManagement({
    guildId,
    rows,
    roles,
    dashboardRoleIds,
    inGameGuildRoleIds,
    stats,
    discordAvailable,
    canManageMembers,
    canDeleteMembers,
    currentUserId,
    ownerId,
    initialTab,
}: MemberManagementProps) {
    // L'onglet « Rôles d'ancienneté » n'existe que pour ceux qui gèrent déjà les membres : la
    // page est leur garde, donc **aucune permission ni entrée de menu** à inventer (brief §7-2).
    const visibleTabs = TABS.filter((tab) => tab.id !== "anciennete" || canManageMembers);
    const allowedInitialTabs: MembersTab[] = ["membres", "mules", "blacklist"];
    const [activeTab, setActiveTab] = useState<MembersTab>(
        canManageMembers && initialTab === "anciennete"
            ? "anciennete"
            : initialTab && (allowedInitialTabs as string[]).includes(initialTab)
              ? (initialTab as MembersTab)
              : "membres",
    );

    const fillPercent =
        stats.maxMembers > 0 ? Math.min(100, Math.round((stats.active / stats.maxMembers) * 100)) : 0;

    const cards = [
        {
            label: "Comptes actifs",
            value: stats.active,
            icon: "circle-tick.png",
            hint: `${stats.maxMembers} places`,
            fill: true,
            accent: true,
        },
        { label: "Archivés", value: stats.archived, icon: "havre-sac.png", hint: "Hors guilde, réintégrables", fill: false, accent: false },
        { label: "Exclus", value: stats.banned, icon: "lock.png", hint: "Bannis ou supprimés", fill: false, accent: false, danger: true },
        { label: "Total gérés", value: stats.total, icon: "guild-xp.png", hint: "Tous statuts confondus", fill: false, accent: false },
    ];

    return (
        <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as MembersTab)}
            className="space-y-6"
        >
            <TabsList className="h-auto w-full gap-1 rounded-lg border border-border-strong bg-surface p-1 sm:w-fit">
                {visibleTabs.map((tab) => (
                    <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        className="gap-2 rounded-md px-3 py-1.5 text-xs data-[state=active]:bg-accent-soft data-[state=active]:text-accent"
                    >
                        <GameIcon src={tab.icon} className="h-3.5 w-3.5" />
                        {tab.label}
                    </TabsTrigger>
                ))}
            </TabsList>

            <TabsContent value="membres" className="space-y-6">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {cards.map((card) => (
                        <div
                            key={card.label}
                            className={cn(
                                "rounded-lg border p-4",
                                card.accent ? "border-accent-soft-border bg-accent-soft" : "border-border-strong bg-surface"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <GameIcon src={card.icon} className="h-4 w-4" />
                                <p className="text-caption uppercase text-muted-foreground">{card.label}</p>
                            </div>
                            <p
                                className={cn(
                                    "mt-1 text-2xl font-semibold tabular-nums",
                                    card.danger ? "text-danger" : "text-foreground"
                                )}
                            >
                                {card.value}
                            </p>
                            {card.fill ? (
                                <Progress value={fillPercent} className="mt-3 h-1.5" />
                            ) : (
                                <p className="mt-1 text-caption text-muted-foreground">{card.hint}</p>
                            )}
                        </div>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <DailyReportButton guildId={guildId} />
                    {!discordAvailable && (
                        <Badge variant="outline" className="border-border text-caption text-warning">
                            Discord injoignable : colonnes Discord vides
                        </Badge>
                    )}
                </div>

                <MemberRosterList
                    guildId={guildId}
                    rows={rows}
                    roles={roles}
                    dashboardRoleIds={dashboardRoleIds}
                    canManageMembers={canManageMembers}
                    canDeleteMembers={canDeleteMembers}
                    currentUserId={currentUserId}
                    ownerId={ownerId}
                />
            </TabsContent>

            <TabsContent value="mules" className="space-y-6">
                <InGameGuildPanel
                    guildId={guildId}
                    rows={rows}
                    roles={roles}
                    initialRoleIds={inGameGuildRoleIds ?? []}
                    canManageMembers={canManageMembers}
                />
                {/* Le tag « en guilde en jeu » d'une mule n'est proposé qu'à qui gère les membres ;
                    l'inventaire reste lisible par les autres (aucune écriture possible). */}
                <MemberMulesSummary
                    rows={rows}
                    guildId={guildId}
                    canManageMembers={canManageMembers}
                />
            </TabsContent>

            <TabsContent value="anciennete">
                <SeniorityRolesPanel guildId={guildId} />
            </TabsContent>

            <TabsContent value="blacklist">
                <MemberBlacklist guildId={guildId} />
            </TabsContent>
        </Tabs>
    );
}
