"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { getBonusConfig, updateBonusChannel } from "@/server/actions/bonus-actions";
import { DiscordChannelPicker } from "@/components/shared/DiscordChannelPicker";

interface BonusSettingsClientProps {
    guildId: string;
}

export function BonusSettingsClient({ guildId }: BonusSettingsClientProps) {
    const [channelId, setChannelId] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [isConfigured, setIsConfigured] = useState(false);

    useEffect(() => {
        async function loadConfig() {
            try {
                const result = await getBonusConfig(guildId);
                if (result.success && result.data) {
                    setChannelId(result.data.bonusNotifyChannelId || "");
                    setIsConfigured(!!result.data.bonusNotifyChannelId);
                }
            } catch {
                // silently fail
            } finally {
                setIsLoading(false);
            }
        }
        loadConfig();
    }, [guildId]);

    const handleSave = () => {
        startTransition(async () => {
            const result = await updateBonusChannel(guildId, channelId.trim() || null);
            if (result.success) {
                toast.success("Salon de notification des bonus sauvegardé !");
                setIsConfigured(!!channelId.trim());
            } else {
                toast.error(result.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    const handleClear = () => {
        startTransition(async () => {
            const result = await updateBonusChannel(guildId, null);
            if (result.success) {
                setChannelId("");
                setIsConfigured(false);
                toast.success("Notifications bonus désactivées");
            } else {
                toast.error(result.error || "Erreur lors de la désactivation");
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[160px]">
                <Loader2 className="w-8 h-8 animate-spin text-info" />
            </div>
        );
    }

    return (
        <Card className="bg-surface/60 border-border overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-info/15 border border-info/20 flex items-center justify-center shrink-0 p-1.5">
                            <img
                                src="/assets/dofus/modules/guildBonus_2x.png"
                                alt="Oracles"
                                className="w-7 h-7 object-contain drop-shadow"
                            />
                        </div>
                        <div className="space-y-0.5">
                            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                                Bonus de Guilde (Oracles)
                            </CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">
                                Notification automatique dans Discord lors de l'activation d'un bonus par les officiers.
                            </CardDescription>
                        </div>
                    </div>
                    {isConfigured ? (
                        <Badge className="bg-success/10 text-success border-success/20 self-start sm:self-auto">
                            Actif
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="text-muted-foreground self-start sm:self-auto">
                            Inactif
                        </Badge>
                    )}
                </div>
            </CardHeader>

            <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                    <label className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
                        Salon de Notification des Bonus
                    </label>
                    <DiscordChannelPicker
                        guildId={guildId}
                        value={channelId}
                        onChange={setChannelId}
                    />
                    <p className="text-caption text-muted-foreground">
                        Les activations d'oracles (XP, drop, etc.) seront relayées en temps réel dans ce salon.
                    </p>
                </div>

                <div className="flex items-center justify-between pt-2">
                    {isConfigured ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleClear}
                            disabled={isPending}
                            className="text-danger hover:text-danger hover:bg-danger/10 text-xs h-9 px-3"
                        >
                            Désactiver ce salon
                        </Button>
                    ) : <span />}

                    <Button
                        onClick={handleSave}
                        disabled={isPending}
                        className="bg-info hover:bg-info/90 text-info-foreground font-bold h-10 px-6"
                    >
                        {isPending ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                Enregistrement...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                Enregistrer le Salon
                            </>
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
