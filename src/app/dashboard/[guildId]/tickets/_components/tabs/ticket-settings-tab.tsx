"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
    Sliders,
    Save,
    Shield,
    Bell,
    FileText,
    Star,
    Hash,
    Layers,
    AlertTriangle,
} from "lucide-react";
import { updateTicketGuildConfigAction } from "@/server/actions/ticket-bot-actions";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface TicketSettingsTabProps {
    guildId: string;
    config: any;
    onRefresh: () => void;
}

export function TicketSettingsTab({ guildId, config, onRefresh }: TicketSettingsTabProps) {
    const [isPending, startTransition] = useTransition();

    const [isEnabled, setIsEnabled] = useState<boolean>(config?.isEnabled ?? true);
    const [logChannelId, setLogChannelId] = useState<string>(config?.logChannelId || "");
    const [transcriptsChannelId, setTranscriptsChannelId] = useState<string>(config?.transcriptsChannelId || "");
    const [staffRoleIdsText, setStaffRoleIdsText] = useState<string>(
        (config?.staffRoleIds || []).join(", ")
    );
    const [maxActiveTicketsPerUser, setMaxActiveTicketsPerUser] = useState<number>(
        config?.maxActiveTicketsPerUser ?? 1
    );
    const [maxTicketsTotalGuild, setMaxTicketsTotalGuild] = useState<number>(
        config?.maxTicketsTotalGuild ?? 50
    );
    const [enableCsat, setEnableCsat] = useState<boolean>(config?.enableCsat ?? true);
    const [enableDmNotifications, setEnableDmNotifications] = useState<boolean>(
        config?.enableDmNotifications ?? true
    );
    const [enableTranscripts, setEnableTranscripts] = useState<boolean>(
        config?.enableTranscripts ?? true
    );

    const handleSave = () => {
        const staffRoles = staffRoleIdsText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

        startTransition(async () => {
            const res = await updateTicketGuildConfigAction(guildId, {
                isEnabled,
                logChannelId: logChannelId.trim() || undefined,
                transcriptsChannelId: transcriptsChannelId.trim() || undefined,
                staffRoleIds: staffRoles,
                maxActiveTicketsPerUser,
                maxTicketsTotalGuild,
                enableCsat,
                enableDmNotifications,
                enableTranscripts,
            });

            if (res.success) {
                toast.success("Paramètres enregistrés !");
                onRefresh();
            } else {
                toast.error(res.error || "Erreur de mise à jour");
            }
        });
    };

    return (
        <div className="max-w-4xl space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <Sliders className="h-5 w-5 text-amber-400" /> Paramètres du Système de Support
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        Règles globales de modération, quotas par membre et alertes automatisées.
                    </p>
                </div>

                <Button onClick={handleSave} disabled={isPending} size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs">
                    <Save className="h-3.5 w-3.5 mr-1" /> Sauvegarder
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* General Toggles */}
                <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Shield className="h-4 w-4 text-amber-400" /> Options & Notifications
                    </h3>

                    <div className="space-y-3 divide-y divide-border/40 text-xs">
                        <div className="flex items-center justify-between pt-2">
                            <div>
                                <div className="font-semibold text-foreground">Activer le module Ticket</div>
                                <div className="text-muted-foreground">Autorise l'ouverture de tickets par les membres.</div>
                            </div>
                            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
                        </div>

                        <div className="flex items-center justify-between pt-3">
                            <div>
                                <div className="font-semibold text-foreground">Transcripts Automatiques</div>
                                <div className="text-muted-foreground">Génère une archive HTML complète à la clôture.</div>
                            </div>
                            <Switch checked={enableTranscripts} onCheckedChange={setEnableTranscripts} />
                        </div>

                        <div className="flex items-center justify-between pt-3">
                            <div>
                                <div className="font-semibold text-foreground">Enquête de Satisfaction CSAT</div>
                                <div className="text-muted-foreground">Envoie un sondage 1-5 étoiles en DM Discord à la fermeture.</div>
                            </div>
                            <Switch checked={enableCsat} onCheckedChange={setEnableCsat} />
                        </div>

                        <div className="flex items-center justify-between pt-3">
                            <div>
                                <div className="font-semibold text-foreground">Notifications MP Discord</div>
                                <div className="text-muted-foreground">Prévient le membre en DM des réponses du staff.</div>
                            </div>
                            <Switch checked={enableDmNotifications} onCheckedChange={setEnableDmNotifications} />
                        </div>
                    </div>
                </div>

                {/* Quotas & Roles */}
                <div className="rounded-2xl border border-border bg-card p-5 space-y-4 text-xs">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Layers className="h-4 w-4 text-amber-400" /> Quotas & Canaux Discord
                    </h3>

                    <div className="space-y-3">
                        <div className="space-y-1">
                            <label className="font-semibold text-foreground">
                                Rôles Staff globaux (IDs séparés par virgules)
                            </label>
                            <Input
                                placeholder="ex: 123456789012345678, 987654321098765432"
                                value={staffRoleIdsText}
                                onChange={(e) => setStaffRoleIdsText(e.target.value)}
                                className="text-xs h-8 font-mono"
                            />
                            <p className="text-[11px] text-muted-foreground">Ces rôles ont accès à tous les tickets ouverts.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="font-semibold text-foreground">Max tickets par membre</label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={maxActiveTicketsPerUser}
                                    onChange={(e) => setMaxActiveTicketsPerUser(Number(e.target.value))}
                                    className="text-xs h-8"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="font-semibold text-foreground">Quota max simultané guilde</label>
                                <Input
                                    type="number"
                                    min={5}
                                    max={500}
                                    value={maxTicketsTotalGuild}
                                    onChange={(e) => setMaxTicketsTotalGuild(Number(e.target.value))}
                                    className="text-xs h-8"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="font-semibold text-foreground">ID Salon Logs de Modération</label>
                            <Input
                                placeholder="ex: 123456789012345678"
                                value={logChannelId}
                                onChange={(e) => setLogChannelId(e.target.value)}
                                className="text-xs h-8 font-mono"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
