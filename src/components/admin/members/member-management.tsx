"use client";

import { useState } from "react";
import { Ban, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RosterRoleInput, RosterRow } from "@/lib/member-roster";
import type { MemberReconciliationData, RoleStats } from "@/server/actions/member-actions";

import { DailyReportButton } from "@/components/admin/daily-report-button";
import { MemberSyncButton } from "@/components/admin/member-sync-button";
import { MemberBlacklist } from "./member-blacklist";
import { MemberDiscordCharts } from "./member-discord-charts";
import { MemberRosterList } from "./member-roster-list";

interface MemberManagementProps {
    guildId: string;
    rows: RosterRow[];
    roles: RosterRoleInput[];
    stats: { active: number; archived: number; banned: number; total: number; maxMembers: number };
    discordAvailable: boolean;
    reconciliation: { members: MemberReconciliationData[]; stats: RoleStats[] } | null;
    welcomeBadgeName: string;
    isSuperAdmin: boolean;
    canManageMembers: boolean;
    canDeleteMembers: boolean;
    currentUserId: string;
    ownerId: string | null;
    /** Lien profond historique `?tab=registre` (le registre est désormais dans la liste unique). */
    initialTab?: string;
}

export default function MemberManagement({
    guildId,
    rows,
    roles,
    stats,
    discordAvailable,
    reconciliation,
    canManageMembers,
    canDeleteMembers,
    currentUserId,
    ownerId,
}: MemberManagementProps) {
    const [activeTab, setActiveTab] = useState<"membres" | "blacklist">("membres");

    const fillPercent =
        stats.maxMembers > 0 ? Math.min(100, Math.round((stats.active / stats.maxMembers) * 100)) : 0;

    const cards = [
        { label: "Comptes actifs", value: stats.active, hint: `${stats.maxMembers} places`, fill: true },
        { label: "Archivés", value: stats.archived, hint: "Hors guilde, réintégrables" },
        { label: "Exclus", value: stats.banned, hint: "Bannis ou supprimés" },
        { label: "Total gérés", value: stats.total, hint: "Tous statuts confondus" },
    ];

    return (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "membres" | "blacklist")} className="space-y-6">
            <TabsList className="w-full gap-1 border border-border bg-surface/40 p-1 sm:w-fit">
                <TabsTrigger value="membres" className="gap-2 text-xs">
                    <Users className="h-3.5 w-3.5" />
                    Membres
                </TabsTrigger>
                <TabsTrigger value="blacklist" className="gap-2 text-xs">
                    <Ban className="h-3.5 w-3.5" />
                    Blacklist
                </TabsTrigger>
            </TabsList>

            <TabsContent value="membres" className="space-y-6">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {cards.map((card) => (
                        <div key={card.label} className="rounded-lg border border-border bg-surface/40 p-4">
                            <p className="text-caption uppercase text-muted-foreground">{card.label}</p>
                            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{card.value}</p>
                            {card.fill ? (
                                <Progress value={fillPercent} className="mt-3 h-1.5" />
                            ) : (
                                <p className="mt-1 text-caption text-muted-foreground">{card.hint}</p>
                            )}
                        </div>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <MemberSyncButton guildId={guildId} />
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
                    canManageMembers={canManageMembers}
                    canDeleteMembers={canDeleteMembers}
                    currentUserId={currentUserId}
                    ownerId={ownerId}
                />

                {reconciliation && reconciliation.members.length > 0 && (
                    <details className="rounded-lg border border-border bg-surface/40 p-4">
                        <summary className="cursor-pointer text-caption uppercase text-muted-foreground">
                            Analyse Discord (activité par rôle)
                        </summary>
                        <div className="mt-4">
                            <MemberDiscordCharts members={reconciliation.members} roleStats={reconciliation.stats} />
                        </div>
                    </details>
                )}
            </TabsContent>

            <TabsContent value="blacklist">
                <MemberBlacklist guildId={guildId} />
            </TabsContent>
        </Tabs>
    );
}
