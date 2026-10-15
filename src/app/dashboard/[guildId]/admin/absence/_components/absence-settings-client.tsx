"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, AlertTriangle, CheckCircle2, Hash, ArrowLeft, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { getAbsenceConfig, updateAbsenceChannel } from "@/server/actions/admin-actions";
import { cn } from "@/lib/utils";
import { DiscordChannelPicker } from "@/components/shared/DiscordChannelPicker";

interface AbsenceSettingsClientProps {
    guildId: string;
}

export function AbsenceSettingsClient({ guildId }: AbsenceSettingsClientProps) {
    const [channelId, setChannelId] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [isConfigured, setIsConfigured] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        async function loadConfig() {
            const result = await getAbsenceConfig(guildId);
            if (result.success && result.data) {
                setChannelId(result.data.absenceChannelId || "");
                setIsConfigured(!!result.data.absenceChannelId);
            }
            setIsLoading(false);
        }
        loadConfig();
    }, [guildId]);

    const handleSave = () => {
        startTransition(async () => {
            const result = await updateAbsenceChannel(guildId, channelId.trim() || null);
            if (result.success) {
                toast.success("Configuration sauvegardée !");
                setIsConfigured(!!channelId.trim());
            } else {
                toast.error(result.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    const handleClear = () => {
        startTransition(async () => {
            const result = await updateAbsenceChannel(guildId, null);
            if (result.success) {
                setChannelId("");
                setIsConfigured(false);
                toast.success("Notifications d'absence désactivées");
            } else {
                toast.error(result.error || "Erreur lors de la désactivation");
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <Card className="bg-surface/40 border-border overflow-hidden">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold flex items-center gap-3">
                        <span className="bg-primary/20 text-primary p-2.5 rounded-2xl border border-primary/20">
                            <Hash className="w-6 h-6" />
                        </span>
                        Salon des Absences & Congés
                    </CardTitle>
                    {isConfigured ? (
                        <Badge className="bg-success/10 text-success border-success/20 text-caption font-semibold uppercase tracking-wide">
                            Configuré
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="text-muted-foreground text-caption font-semibold uppercase tracking-wide">
                            Inactif
                        </Badge>
                    )}
                </div>
                <CardDescription className="text-muted-foreground">
                    Définissez le salon Discord où seront publiées les annonces de départ en vacances et indisponibilités des membres.
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <label className="text-caption font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5" /> Salon Discord
                    </label>
                    <DiscordChannelPicker
                        guildId={guildId}
                        value={channelId}
                        onChange={setChannelId}
                        placeholder="Sélectionner un salon..."
                        allowEmptyLabel="Aucun salon (désactivé)"
                    />
                </div>

                <div className="flex items-center justify-between pt-2">
                    {isConfigured ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleClear}
                            disabled={isPending}
                            className="text-danger hover:text-danger hover:bg-danger/20 h-auto py-1 px-3 text-caption font-bold uppercase tracking-wider"
                        >
                            Désactiver ce salon
                        </Button>
                    ) : <span />}

                    <Button
                        onClick={handleSave}
                        disabled={isPending}
                        className="h-10 px-5 rounded-xl font-bold uppercase tracking-widest text-xs"
                    >
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Enregistrer
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
