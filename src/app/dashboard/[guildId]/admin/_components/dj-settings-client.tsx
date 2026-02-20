"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, AlertTriangle, Hash, Bell } from "lucide-react";
import { toast } from "sonner";
import { getDjSettings, updateDjSettings } from "@/server/actions/dungeon-finder-actions";

interface DjSettingsClientProps {
    guildId: string;
}

export function DjSettingsClient({ guildId }: DjSettingsClientProps) {
    const [channelId, setChannelId] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [isConfigured, setIsConfigured] = useState(false);

    useEffect(() => {
        async function loadConfig() {
            const result = await getDjSettings(guildId);
            if (result.success && result.data) {
                setChannelId(result.data.djNotifyChannelId || "");
                setIsConfigured(!!result.data.djNotifyChannelId);
            }
            setIsLoading(false);
        }
        loadConfig();
    }, [guildId]);

    const handleSave = () => {
        startTransition(async () => {
            const result = await updateDjSettings(guildId, {
                djNotifyChannelId: channelId.trim() || null
            });
            if (result.success) {
                toast.success("Configuration Donjons & Quêtes sauvegardée !");
                setIsConfigured(!!channelId.trim());
            } else {
                toast.error(result.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[300px]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card className="bg-zinc-900/60 border-white/5">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <span className="bg-indigo-500/20 text-indigo-400 p-2 rounded-lg">
                                <Bell className="w-5 h-5" />
                            </span>
                            Notifications Donjons & Quêtes
                        </CardTitle>
                        {isConfigured ? (
                            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                Connecté à Discord
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="text-zinc-500">
                                Inactif
                            </Badge>
                        )}
                    </div>
                    <CardDescription>
                        Configurez le salon Discord qui recevra les annonces de recherche de joueurs pour les Donjons et Quêtes.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label className="text-zinc-400 flex items-center gap-2">
                            <Hash className="w-3.5 h-3.5" />
                            Salon d'annonce Donjons & Quêtes
                        </Label>
                        <Input
                            value={channelId}
                            onChange={(e) => setChannelId(e.target.value)}
                            placeholder="ID du salon Discord (ex: 123456789...)"
                            className="font-mono bg-black/20 border-white/10 focus:border-indigo-500/50"
                        />
                        <p className="text-[10px] text-zinc-500 italic">
                            Le salon où les nouveaux groupes de recherche (FARM, SUCCES, QUETE...) seront publiés. L'annonce est mise à jour automatiquement quand des joueurs rejoignent ou quittent, et quand le groupe est complet ou fermé.
                        </p>
                    </div>

                    <div className="pt-4 flex items-center justify-between border-t border-white/5">
                        <div className="flex items-center gap-2 text-amber-500/80">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-[10px] font-medium uppercase tracking-wider">
                                Vérifiez que le bot a les droits d'écriture
                            </span>
                        </div>
                        <Button
                            onClick={handleSave}
                            disabled={isPending}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white min-w-[140px]"
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
        </div>
    );
}
