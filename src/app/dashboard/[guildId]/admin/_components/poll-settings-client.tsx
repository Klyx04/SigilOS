"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, AlertTriangle, Hash, Bell, Users } from "lucide-react";
import { toast } from "sonner";
import { getPollSettings, updatePollSettings } from "@/server/actions/poll-actions";
import { cn } from "@/lib/utils";
import { getDiscordRolesAction, updateAllowedPingRolesAction } from "@/server/actions/user-actions";
import { PingRolesSelector } from "@/components/admin/ping-roles-selector";
import { ChannelPreview } from "@/components/shared/ChannelPreview";

interface PollSettingsClientProps {
    guildId: string;
}

export function PollSettingsClient({ guildId }: PollSettingsClientProps) {
    const [channelId, setChannelId] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [isConfigured, setIsConfigured] = useState(false);
    const [pollsPingRoleIds, setPollsPingRoleIds] = useState<string[]>([]);
    const [discordRoles, setDiscordRoles] = useState<{ id: string, name: string, color: string }[]>([]);

    useEffect(() => {
        async function loadConfig() {
            const [result, rolesRes] = await Promise.all([
                getPollSettings(guildId),
                getDiscordRolesAction(guildId, { ignoreWhitelist: true })
            ]);
            if (result.success && result.data) {
                setChannelId(result.data.pollsNotifyChannelId || "");
                setIsConfigured(!!result.data.pollsNotifyChannelId);
                setPollsPingRoleIds(result.data.pollsPingRoleIds || []);
            }
            if (rolesRes.success && rolesRes.roles) {
                setDiscordRoles(rolesRes.roles.filter((r: any) => r.name !== "@everyone") as any);
            }
            setIsLoading(false);
        }
        loadConfig();
    }, [guildId]);

    const handleSave = () => {
        startTransition(async () => {
            const result = await updatePollSettings(guildId, {
                pollsNotifyChannelId: channelId.trim() || null
            });
            const pingRolesResult = await updateAllowedPingRolesAction(guildId, pollsPingRoleIds, "polls");

            if (result.success && pingRolesResult.success) {
                toast.success("Configuration des sondages sauvegardée !");
                setIsConfigured(!!channelId.trim());
            } else {
                toast.error(result.error || pingRolesResult.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[300px]">
                <Loader2 className="w-8 h-8 animate-spin text-info" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card className="bg-surface/60 border-border">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <span className="bg-info/20 text-info p-2 rounded-lg">
                                <Bell className="w-5 h-5" />
                            </span>
                            Notifications de Sondages
                        </CardTitle>
                        {isConfigured ? (
                            <Badge className="bg-success/10 text-success border-success/20">
                                Connecté à Discord
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                                Mode Manuel
                            </Badge>
                        )}
                    </div>
                    <CardDescription>
                        Configurez les paramètres par défaut pour la publication de vos sondages sur Discord.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Channel ID */}
                    <div className="space-y-2">
                        <Label className="text-muted-foreground flex items-center gap-2">
                            <Hash className="w-3.5 h-3.5" />
                            Salon d'annonce par défaut
                        </Label>
                        <Input
                            value={channelId}
                            onChange={(e) => setChannelId(e.target.value)}
                            placeholder="ID du salon Discord (ex: 123456789...)"
                            className="font-mono bg-black/20 border-border focus:border-info/50"
                        />
                        <ChannelPreview guildId={guildId} channelId={channelId} color="cyan" />
                        <p className="text-caption text-muted-foreground italic">
                            Le salon où les nouveaux sondages seront publiés automatiquement si l'option est cochée lors de la création.
                        </p>
                    </div>

                    {/* Whitelist of Ping Roles */}
                    <div className="space-y-2 pt-2 border-t border-border">
                        <Label className="text-muted-foreground flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-info" />
                            Rôles autorisés pour les mentions (Whitelist)
                        </Label>
                        <p className="text-caption text-muted-foreground italic mb-2">
                            Définissez quels rôles Discord les créateurs de sondages peuvent mentionner lors de la publication.
                        </p>
                        <PingRolesSelector
                            value={pollsPingRoleIds}
                            onChange={setPollsPingRoleIds}
                            roles={discordRoles}
                            description="Si la liste est vide, aucun rôle Discord ne sera disponible pour le ping/sélection dans les modales de création (seuls les administrateurs verront toujours tous les rôles)."
                        />
                    </div>

                    <div className="pt-4 flex items-center justify-between border-t border-border">
                        <div className="flex items-center gap-2 text-warning/80">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-caption font-medium uppercase tracking-wider">
                                Vérifiez que le bot a les droits d'écriture
                            </span>
                        </div>
                        <Button
                            onClick={handleSave}
                            disabled={isPending}
                            className="bg-info hover:bg-info text-info-foreground min-w-[140px]"
                        >
                            {isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                                <Save className="w-4 h-4 mr-2" />
                            )}
                            Sauvegarder
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Help Card */}
            <Card className="bg-info/5 border-info/10">
                <CardContent className="p-4 flex gap-3">
                    <div className="p-2 bg-info/20 rounded-lg shrink-0 h-fit">
                        <Hash className="w-4 h-4 text-info" />
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-sm font-medium text-info">Comment obtenir les IDs ?</h4>
                        <p className="text-xs text-info/70 leading-relaxed">
                            Activez le <strong>Mode Développeur</strong> dans vos paramètres Discord (Apparence {'>'} Avancé).
                            Ensuite, faites un clic droit sur un salon ou un rôle et choisissez <strong>"Copier l'identifiant"</strong>.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
