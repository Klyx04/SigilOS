"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
    Ticket,
    Shield,
    Server,
    Activity,
    Search,
    CheckCircle2,
    XCircle,
    Star,
    Layers,
    FileText,
    RefreshCw,
    Sliders,
    Sparkles,
} from "lucide-react";
import { toggleGodTicketBotModuleAction, setTicketPlatformLimitsAction } from "@/server/actions/ticket-bot-actions";
import { TICKET_PLATFORM_LIMIT_BOUNDS } from "@/lib/tickets/platform-limits";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface GuildFleetItem {
    id: string;
    discordGuildId: string;
    name: string;
    iconUrl: string | null;
    ticketConfig: {
        isEnabled: boolean;
        maxTicketsTotalGuild: number;
        enableTranscripts: boolean;
        enableCsat: boolean;
    } | null;
    _count: {
        ticketRecords: number;
        ticketCategories: number;
        ticketPanels: number;
    };
}

interface GodTicketBotPanelProps {
    initialFleet: {
        guilds: GuildFleetItem[];
        totalOpenTickets: number;
        totalTranscripts: number;
        globalAvgCsat: number | null;
        totalFeedbackCount: number;
        platformLimits: {
            transcriptsEnabled: boolean;
            retentionArchivesDays: number;
            retentionNotesDays: number;
            retentionAuditDays: number;
            maxPerUserCap: number;
            maxGuildCap: number;
        };
    };
}

export function GodTicketBotPanel({ initialFleet }: GodTicketBotPanelProps) {
    const [guilds, setGuilds] = useState<GuildFleetItem[]>(initialFleet.guilds);
    const [search, setSearch] = useState("");
    const [isPending, startTransition] = useTransition();
    const [limits, setLimits] = useState(initialFleet.platformLimits);

    const filteredGuilds = guilds.filter(
        (g) =>
            g.name.toLowerCase().includes(search.toLowerCase()) ||
            g.discordGuildId.includes(search)
    );

    const activeGuildsCount = guilds.filter((g) => g.ticketConfig?.isEnabled).length;
    const totalTicketsEver = guilds.reduce((acc, g) => acc + g._count.ticketRecords, 0);
    const totalPanelsEver = guilds.reduce((acc, g) => acc + g._count.ticketPanels, 0);

    const handleSaveLimits = () => {
        startTransition(async () => {
            const res = await setTicketPlatformLimitsAction(limits);
            if (res.success) {
                toast.success("Plafonds plateforme enregistrés");
            } else {
                toast.error(res.error || "Erreur de mise à jour");
            }
        });
    };

    const handleToggleGuild = (guildId: string, enabled: boolean) => {        startTransition(async () => {
            const res = await toggleGodTicketBotModuleAction(guildId, enabled);
            if (res.success) {
                toast.success(enabled ? "Module Ticket Bot activé" : "Module Ticket Bot désactivé");
                setGuilds((prev) =>
                    prev.map((g) => {
                        if (g.id === guildId || g.discordGuildId === guildId) {
                            return {
                                ...g,
                                ticketConfig: {
                                    ...(g.ticketConfig || {
                                        maxTicketsTotalGuild: 50,
                                        enableTranscripts: true,
                                        enableCsat: true,
                                    }),
                                    isEnabled: enabled,
                                },
                            };
                        }
                        return g;
                    })
                );
            } else {
                toast.error(res.error || "Erreur de mise à jour");
            }
        });
    };

    return (
        <div className="space-y-8">
            {/* Header / Hero */}
            <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-background to-background p-6 md:p-8">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-lg shadow-amber-500/10">
                                <Ticket className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                                    Tour de Contrôle — Bot Tickets Flotte
                                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs px-2 py-0.5">
                                        GOD Master
                                    </Badge>
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    Supervision globale du moteur de tickets Discord, contrôle de charge VPS et activation par guilde.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 gap-1.5 py-1.5 px-3">
                            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                            Moteur Webhooks Discord v10 Actif
                        </Badge>
                    </div>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                    <div className="p-4 rounded-xl bg-surface/60 border border-border/50 backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <Server className="h-3.5 w-3.5 text-info" />
                            Guildes Déployées
                        </div>
                        <div className="text-2xl font-bold text-foreground">
                            {activeGuildsCount}{" "}
                            <span className="text-xs font-normal text-muted-foreground">/ {guilds.length}</span>
                        </div>
                    </div>

                    <div className="p-4 rounded-xl bg-surface/60 border border-border/50 backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <Activity className="h-3.5 w-3.5 text-amber-400" />
                            Tickets Ouverts Live
                        </div>
                        <div className="text-2xl font-bold text-amber-400">{initialFleet.totalOpenTickets}</div>
                    </div>

                    <div className="p-4 rounded-xl bg-surface/60 border border-border/50 backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <FileText className="h-3.5 w-3.5 text-violet-400" />
                            Transcripts Archivés
                        </div>
                        <div className="text-2xl font-bold text-foreground">{initialFleet.totalTranscripts}</div>
                    </div>

                    <div className="p-4 rounded-xl bg-surface/60 border border-border/50 backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <Star className="h-3.5 w-3.5 text-yellow-400" />
                            Score CSAT Global
                        </div>
                        <div className="text-2xl font-bold text-foreground">
                            {initialFleet.globalAvgCsat ? `${initialFleet.globalAvgCsat} / 5` : "N/A"}{" "}
                            <span className="text-xs font-normal text-muted-foreground">({initialFleet.totalFeedbackCount} avis)</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Plafonds plateforme (God) : stockage VPS sous contrôle */}
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Sliders className="h-5 w-5 text-amber-400" />
                        <div>
                            <h2 className="text-base font-semibold text-foreground">Plafonds plateforme (VPS)</h2>
                            <p className="text-xs text-muted-foreground">
                                Copies HTML en base + durées + quotas max. Les guildes règlent en dessous, jamais au-dessus.
                                Le ménage de nuit purge les expirés.
                            </p>
                        </div>
                    </div>
                    <Button onClick={handleSaveLimits} disabled={isPending} size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs">
                        Sauvegarder
                    </Button>
                </div>

                <div className="flex items-center justify-between text-xs border-t border-border/40 pt-3">
                    <div>
                        <div className="font-semibold text-foreground">Copies des messages (transcripts)</div>
                        <div className="text-muted-foreground">Archive HTML à la clôture (stockée en base).</div>
                    </div>
                    <Switch
                        checked={limits.transcriptsEnabled}
                        onCheckedChange={(checked) => setLimits((previous) => ({ ...previous, transcriptsEnabled: checked }))}
                    />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                    <div className="space-y-1">
                        <label className="font-semibold text-foreground">Archives (j)</label>
                        <Input
                            type="number"
                            min={TICKET_PLATFORM_LIMIT_BOUNDS.retentionArchivesDays.min}
                            max={TICKET_PLATFORM_LIMIT_BOUNDS.retentionArchivesDays.max}
                            value={limits.retentionArchivesDays}
                            onChange={(e) => setLimits((previous) => ({ ...previous, retentionArchivesDays: Number(e.target.value) }))}
                            className="text-xs h-8"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="font-semibold text-foreground">Notes (j)</label>
                        <Input
                            type="number"
                            min={TICKET_PLATFORM_LIMIT_BOUNDS.retentionNotesDays.min}
                            max={TICKET_PLATFORM_LIMIT_BOUNDS.retentionNotesDays.max}
                            value={limits.retentionNotesDays}
                            onChange={(e) => setLimits((previous) => ({ ...previous, retentionNotesDays: Number(e.target.value) }))}
                            className="text-xs h-8"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="font-semibold text-foreground">Audit (j)</label>
                        <Input
                            type="number"
                            min={TICKET_PLATFORM_LIMIT_BOUNDS.retentionAuditDays.min}
                            max={TICKET_PLATFORM_LIMIT_BOUNDS.retentionAuditDays.max}
                            value={limits.retentionAuditDays}
                            onChange={(e) => setLimits((previous) => ({ ...previous, retentionAuditDays: Number(e.target.value) }))}
                            className="text-xs h-8"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="font-semibold text-foreground">Max / membre</label>
                        <Input
                            type="number"
                            min={TICKET_PLATFORM_LIMIT_BOUNDS.maxPerUserCap.min}
                            max={TICKET_PLATFORM_LIMIT_BOUNDS.maxPerUserCap.max}
                            value={limits.maxPerUserCap}
                            onChange={(e) => setLimits((previous) => ({ ...previous, maxPerUserCap: Number(e.target.value) }))}
                            className="text-xs h-8"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="font-semibold text-foreground">Max / guilde</label>
                        <Input
                            type="number"
                            min={TICKET_PLATFORM_LIMIT_BOUNDS.maxGuildCap.min}
                            max={TICKET_PLATFORM_LIMIT_BOUNDS.maxGuildCap.max}
                            value={limits.maxGuildCap}
                            onChange={(e) => setLimits((previous) => ({ ...previous, maxGuildCap: Number(e.target.value) }))}
                            className="text-xs h-8"
                        />
                    </div>
                </div>
            </div>

            {/* Guilds Fleet Table */}
            <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
                <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface/30">
                    <div className="flex items-center gap-3">
                        <Layers className="h-5 w-5 text-amber-400" />
                        <div>
                            <h2 className="text-base font-semibold text-foreground">Gestion de la Flotte des Serveurs</h2>
                            <p className="text-xs text-muted-foreground">
                                Activez ou suspendez le moteur de tickets par serveur Discord.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Rechercher une guilde..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 bg-background/50 h-9 text-xs"
                            />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-surface/50 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                            <tr>
                                <th className="py-3.5 px-4 font-semibold">Serveur Discord</th>
                                <th className="py-3.5 px-4 font-semibold">Statut Module</th>
                                <th className="py-3.5 px-4 font-semibold">Panneaux / Catégories</th>
                                <th className="py-3.5 px-4 font-semibold">Tickets Traités</th>
                                <th className="py-3.5 px-4 font-semibold">Transcripts</th>
                                <th className="py-3.5 px-4 text-right font-semibold">Activation GOD</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                            {filteredGuilds.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                                        Aucune guilde trouvée.
                                    </td>
                                </tr>
                            ) : (
                                filteredGuilds.map((guild) => {
                                    const isEnabled = guild.ticketConfig?.isEnabled ?? false;
                                    return (
                                        <tr key={guild.id} className="hover:bg-surface/30 transition-colors">
                                            <td className="py-4 px-4">
                                                <div className="flex items-center gap-3">
                                                    {guild.iconUrl ? (
                                                        <img
                                                            src={guild.iconUrl}
                                                            alt={guild.name}
                                                            className="h-8 w-8 rounded-lg object-cover border border-border"
                                                        />
                                                    ) : (
                                                        <div className="h-8 w-8 rounded-lg bg-surface flex items-center justify-center font-bold text-xs border border-border">
                                                            {guild.name.slice(0, 2).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="font-semibold text-foreground">{guild.name}</div>
                                                        <div className="text-xs text-muted-foreground font-mono">
                                                            {guild.discordGuildId}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="py-4 px-4">
                                                {isEnabled ? (
                                                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-1 text-xs">
                                                        <CheckCircle2 className="h-3 w-3" /> Actif
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-muted-foreground gap-1 text-xs">
                                                        <XCircle className="h-3 w-3" /> Inactif
                                                    </Badge>
                                                )}
                                            </td>

                                            <td className="py-4 px-4 text-muted-foreground text-xs">
                                                <span className="font-medium text-foreground">
                                                    {guild._count.ticketPanels}
                                                </span>{" "}
                                                panneaux ·{" "}
                                                <span className="font-medium text-foreground">
                                                    {guild._count.ticketCategories}
                                                </span>{" "}
                                                catégories
                                            </td>

                                            <td className="py-4 px-4 text-muted-foreground text-xs">
                                                <span className="font-semibold text-foreground">
                                                    {guild._count.ticketRecords}
                                                </span>{" "}
                                                tickets
                                            </td>

                                            <td className="py-4 px-4 text-muted-foreground text-xs">
                                                {limits.transcriptsEnabled ? (
                                                    <span className="text-emerald-400 font-medium">Activé (God)</span>
                                                ) : (
                                                    <span className="text-muted-foreground">Désactivé (God)</span>
                                                )}
                                            </td>

                                            <td className="py-4 px-4 text-right">
                                                <Switch
                                                    checked={isEnabled}
                                                    onCheckedChange={(checked) => handleToggleGuild(guild.id, checked)}
                                                    disabled={isPending}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
