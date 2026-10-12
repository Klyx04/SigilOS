"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Ticket,
    Layers,
    Tags,
    Sliders,
    FileText,
    BarChart3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TicketInboxTab } from "./tabs/ticket-inbox-tab";
import { TicketPanelsTab } from "./tabs/ticket-panels-tab";
import { TicketMotifsTab } from "./tabs/ticket-motifs-tab";
import { TicketSettingsTab } from "./tabs/ticket-settings-tab";
import { TicketTranscriptsTab } from "./tabs/ticket-transcripts-tab";
import { TicketAnalyticsTab } from "./tabs/ticket-analytics-tab";
import { ModuleHelpActions } from "@/components/doc/module-help-actions";

interface TicketBotManagerProps {
    guildId: string;
    config: any;
    /** Anciens motifs v1 (bannière de migration + boîte de réception). */
    categories: any[];
    panels: any[];
    /** Motifs (parcours publiés : l'unité unique du module). */
    journeys: any[];
    /** Questionnaires (reprise des questions d'un motif). */
    forms: any[];
    tickets: any[];
    stats: any;
}

type TicketManagerTabId =
    | "inbox"
    | "motifs"
    | "panels"
    | "settings"
    | "transcripts"
    | "analytics";

export function TicketBotManager({
    guildId,
    config,
    categories,
    panels,
    journeys,
    forms,
    tickets,
    stats,
}: TicketBotManagerProps) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TicketManagerTabId>("inbox");

    const onRefresh = () => {
        router.refresh();
    };

    const openTicketsCount = tickets.filter(
        (t) => t.status === "OPEN" || t.status === "CLAIMED"
    ).length;

    interface TabItem {
        id: TicketManagerTabId;
        label: string;
        icon: any;
        badge?: number;
    }

    const tabs: TabItem[] = [
        {
            id: "inbox",
            label: "Boîte de Réception",
            icon: Ticket,
            badge: openTicketsCount > 0 ? openTicketsCount : undefined,
        },
        {
            id: "motifs",
            label: "Motifs & Formulaires",
            icon: Tags,
            badge: journeys.length > 0 ? journeys.length : undefined,
        },
        {
            id: "panels",
            label: "Panneaux Discord",
            icon: Layers,
            badge: panels.length > 0 ? panels.length : undefined,
        },
        {
            id: "transcripts",
            label: "Archives Transcripts",
            icon: FileText,
        },
        {
            id: "analytics",
            label: "Satisfaction CSAT",
            icon: BarChart3,
        },
        {
            id: "settings",
            label: "Configuration",
            icon: Sliders,
        },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm">
                        <Ticket className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            Bot Tickets & Support Discord
                            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] px-2 py-0.5">
                                Pro 100% Gratuit
                            </Badge>
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            Gérez les formulaires d'intake, réclamations staff, notes privées et transcripts de votre guilde.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    <ModuleHelpActions docSlug="admin-tickets" docTitle="Bot Tickets & Support" tourPhase="tickets" />
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border/40 scrollbar-none">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                                isActive
                                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm"
                                    : "text-muted-foreground hover:text-foreground hover:bg-surface/50 border border-transparent"
                            }`}
                        >
                            <Icon className="h-4 w-4" />
                            <span>{tab.label}</span>
                            {tab.badge !== undefined && (
                                <span
                                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                                        isActive
                                            ? "bg-amber-500/30 text-amber-300"
                                            : "bg-surface text-muted-foreground"
                                    }`}
                                >
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Active Tab Content */}
            <div>
                {activeTab === "inbox" && (
                    <TicketInboxTab
                        guildId={guildId}
                        tickets={tickets}
                        categories={categories}
                        onRefresh={onRefresh}
                    />
                )}
                {activeTab === "motifs" && (
                    <TicketMotifsTab
                        guildId={guildId}
                        journeys={journeys}
                        forms={forms}
                        legacyCategories={categories}
                        permissionSettings={config?.settingsJson}
                        onRefresh={onRefresh}
                    />
                )}
                {activeTab === "panels" && (
                    <TicketPanelsTab
                        guildId={guildId}
                        panels={panels}
                        journeys={journeys}
                        legacyCategoryCount={categories.length}
                        onRefresh={onRefresh}
                    />
                )}
                {activeTab === "transcripts" && (
                    <TicketTranscriptsTab guildId={guildId} tickets={tickets} />
                )}
                {activeTab === "analytics" && (
                    <TicketAnalyticsTab stats={stats} tickets={tickets} />
                )}
                {activeTab === "settings" && (
                    <TicketSettingsTab guildId={guildId} config={config} onRefresh={onRefresh} />
                )}
            </div>
        </div>
    );
}
