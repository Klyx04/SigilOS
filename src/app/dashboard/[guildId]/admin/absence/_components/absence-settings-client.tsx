"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, AlertTriangle, CheckCircle2, Hash, ArrowLeft, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { getAbsenceConfig, updateAbsenceChannel } from "@/server/actions/admin-actions";
import { cn } from "@/lib/utils";
import { ChannelPreview } from "@/components/shared/ChannelPreview";

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
        <div className="space-y-8">

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Configuration Panel */}
                <Card className="lg:col-span-2 bg-surface/60 border-border">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <span className="bg-primary/20 text-primary p-2 rounded-lg">
                                    <Hash className="w-5 h-5" />
                                </span>
                                Configuration du Salon
                            </CardTitle>
                            {isConfigured ? (
                                <Badge className="bg-success/10 text-success border-success/20 hover:bg-success/20">
                                    Actif
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-muted-foreground">
                                    Inactif
                                </Badge>
                            )}
                        </div>
                        <CardDescription>
                            Définissez le salon où seront publiées les annonces de départ en vacances.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {/* Step 1 */}
                        <div className="relative pl-6 border-l-2 border-border pb-6 last:pb-0">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-elevated border-2 border-border flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-muted" />
                            </div>
                            <h3 className="text-sm font-medium text-foreground mb-2">1. Récupérer l'ID du salon</h3>
                            <p className="text-xs text-muted-foreground mb-3">
                                Activez le mode développeur Discord, puis faites <span className="text-foreground">Clic Droit</span> sur le salon voulu {'>'} <span className="text-foreground">Copier l'identifiant</span>.
                            </p>
                        </div>

                        {/* Step 2 */}
                        <div className="relative pl-6 border-l-2 border-primary/50">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary border-2 border-border " />
                            <h3 className="text-sm font-medium text-foreground mb-4">2. Coller l'identifiant</h3>

                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <Input
                                        value={channelId}
                                        onChange={(e) => setChannelId(e.target.value)}
                                        placeholder="Ex: 123456789012345678"
                                        className="font-mono bg-black/20 border-border"
                                    />
                                    <Button onClick={handleSave} disabled={isPending} className="min-w-[120px]">
                                        {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                        Sauvegarder
                                    </Button>
                                </div>
                                <ChannelPreview guildId={guildId} channelId={channelId} color="cyan" />
                                {isConfigured && (
                                    <div className="flex justify-end">
                                        <Button variant="ghost" size="sm" onClick={handleClear} disabled={isPending} className="text-danger hover:text-danger hover:bg-danger/20 h-auto py-1 px-3 text-xs">
                                            Désactiver l'intégration
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Preview Panel */}
                <div className="space-y-6">
                    <Card className="bg-surface/60 border-border overflow-hidden">
                        <CardHeader className="bg-surface pb-4">
                            <CardTitle className="text-sm text-foreground">Aperçu Visuel</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 relative">
                            {/* Discord Message Mockup */}
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-info flex items-center justify-center shrink-0">
                                    <span className="font-bold text-foreground text-xs">BOT</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className="font-medium text-info">SigilOS</span>
                                        <span className="bg-info/20 text-info text-caption px-1 rounded">BOT</span>
                                        <span className="text-xs text-muted-foreground">Aujourd'hui à 14:30</span>
                                    </div>

                                    {/* Embed */}
                                    <div className="bg-[#2b2d31] rounded border-l-4 border-info p-4 max-w-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-lg">🏝️</span>
                                            <h4 className="font-semibold text-foreground text-sm">Notification d'absence</h4>
                                        </div>

                                        <p className="text-foreground text-sm mb-4">
                                            <span className="text-info font-medium hover:underline cursor-pointer">Wylan</span> sera absent(e).
                                        </p>

                                        <div className="flex gap-6">
                                            <div>
                                                <div className="text-[#b5bac1] text-xs font-bold uppercase tracking-wider mb-1">Début</div>
                                                <div className="text-foreground text-sm">21 janv. 2026</div>
                                            </div>
                                            <div>
                                                <div className="text-[#b5bac1] text-xs font-bold uppercase tracking-wider mb-1">Retour</div>
                                                <div className="text-foreground text-sm">Pas de date</div>
                                            </div>
                                        </div>

                                        <div className="mt-3 pt-3 border-t border-[#3f4147] flex items-center gap-2">
                                            <div className="w-4 h-4 rounded-full bg-muted" />
                                            <span className="text-[#949ba4] text-xs">SigilOS • Mode Vacances</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-info/5 border-info/10">
                        <CardContent className="p-4 flex gap-3">
                            <div className="p-2 bg-info/20 rounded-lg shrink-0 h-fit">
                                <AlertTriangle className="w-4 h-4 text-info" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-sm font-medium text-info">Attention aux permissions</h4>
                                <p className="text-xs text-info/70 leading-relaxed">
                                    Assurez-vous que le bot <strong>SigilOS</strong> dispose des droits "Voir le salon" et "Envoyer des messages" dans le salon cible.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
