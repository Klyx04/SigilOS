"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Hash, UserCheck, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { UnsavedChangesGuard, isDirty } from "@/components/ui/unsaved-changes-guard";
import { getDirectorySettings, saveDirectorySettings } from "@/server/actions/directory-settings-actions";
import { Label } from "@/components/ui/label";
import { DiscordChannelPicker } from "@/components/shared/DiscordChannelPicker";

interface DirectorySettingsClientProps {
    guildId: string;
}

export function DirectorySettingsClient({ guildId }: DirectorySettingsClientProps) {
    const [channelId, setChannelId] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    // — Détection « modifications non sauvegardées » (snapshot chargé vs état courant)
    const [initialConfig, setInitialConfig] = useState<{ channelId: string } | null>(null);
    const hasUnsavedChanges = isDirty({ channelId }, initialConfig);

    useEffect(() => {
        async function loadConfig() {
            const res = await getDirectorySettings(guildId);
            if (res.success && res.data) {
                setChannelId(res.data.userRequestChannelId || "");
                setInitialConfig({ channelId: res.data.userRequestChannelId || "" });
            }
            setIsLoading(false);
        }
        loadConfig();
    }, [guildId]);

    const handleSave = () => {
        startTransition(async () => {
            const trimmed = channelId.trim();
            const result = await saveDirectorySettings(guildId, trimmed || null);
            if (result.success) {
                toast.success("Paramètres de l'annuaire mis à jour !");
                setChannelId(trimmed);
                setInitialConfig({ channelId: trimmed });
            } else {
                toast.error("Erreur lors de la sauvegarde");
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-info" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300 text-left">
            <UnsavedChangesGuard hasUnsavedChanges={hasUnsavedChanges} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Configuration Panel */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="bg-surface/60 border-border overflow-hidden">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-foreground font-black uppercase tracking-tighter">
                                    <span className="bg-info/20 text-info p-2 rounded-lg">
                                        <UserCheck className="w-5 h-5" />
                                    </span>
                                    Salon des Sollicitations
                                </CardTitle>
                                {channelId ? (
                                    <Badge className="bg-info/10 text-info border-info/20">Configuré</Badge>
                                ) : (
                                    <Badge variant="outline" className="text-muted-foreground border-border uppercase text-caption font-black tracking-widest">Défaut</Badge>
                                )}
                            </div>
                            <CardDescription className="text-xs font-medium text-muted-foreground">
                                Ce salon Discord recevra les pings lorsque vos membres se sollicitent depuis l'annuaire (craft, forgemagie, etc).
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-caption uppercase font-black text-muted-foreground ml-1">Salon Discord</Label>
                                    <DiscordChannelPicker
                                        guildId={guildId}
                                        value={channelId}
                                        onChange={setChannelId}
                                    />
                                    <p className="text-caption text-muted-foreground ml-1">
                                        Laissez vide pour désactiver les notifications Discord (les notifications resteront actives sur le tableau de bord SigilOS).
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end pt-4">
                        <Button onClick={handleSave} disabled={isPending} className="bg-info hover:bg-info text-info-foreground min-w-[200px] font-bold h-12 shadow-xl shadow-indigo-600/20">
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            SAUVEGARDER
                            {hasUnsavedChanges && !isPending && <span className="ml-2 w-2 h-2 rounded-full bg-white animate-pulse" title="Modifications non sauvegardées" />}
                        </Button>
                    </div>
                </div>

                {/* Preview Panel */}
                <div className="space-y-6">
                    <Card className="bg-surface/60 border-border overflow-hidden">
                        <CardHeader className="bg-surface pb-3 px-4 py-3">
                            <CardTitle className="text-caption font-black uppercase tracking-widest text-muted-foreground">Aperçu : Sollicitation</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 relative px-4">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-info flex items-center justify-center shrink-0">
                                    <MessageSquare className="w-4 h-4 text-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className="font-medium text-info text-xs">SigilOS</span>
                                        <span className="bg-info/20 text-info text-caption px-1 rounded">BOT</span>
                                    </div>
                                    <div className="bg-[#2b2d31] rounded border-l-4 border-info p-3 max-w-sm shadow-xl">
                                        <p className="text-foreground text-caption leading-relaxed mb-2">
                                            <span className="text-info font-bold">@Wylan</span> a besoin de toi pour un Craft Légendaire !
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
