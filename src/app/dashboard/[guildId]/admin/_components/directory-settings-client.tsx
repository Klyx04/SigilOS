"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Hash, UserCheck, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { getDirectorySettings, saveDirectorySettings } from "@/server/actions/directory-settings-actions";
import { Label } from "@/components/ui/label";
import { ChannelPreview } from "@/components/shared/ChannelPreview";

interface DirectorySettingsClientProps {
    guildId: string;
}

export function DirectorySettingsClient({ guildId }: DirectorySettingsClientProps) {
    const [channelId, setChannelId] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        async function loadConfig() {
            const res = await getDirectorySettings(guildId);
            if (res.success && res.data) {
                setChannelId(res.data.userRequestChannelId || "");
            }
            setIsLoading(false);
        }
        loadConfig();
    }, [guildId]);

    const handleSave = () => {
        startTransition(async () => {
            const result = await saveDirectorySettings(guildId, channelId.trim() || null);
            if (result.success) {
                toast.success("Paramètres de l'annuaire mis à jour !");
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
                                    <Label className="text-caption uppercase font-black text-muted-foreground ml-1">ID du Salon Discord</Label>
                                    <div className="relative group/input">
                                        <Input
                                            value={channelId}
                                            onChange={(e) => setChannelId(e.target.value)}
                                            placeholder="Ex: 123456789012345678"
                                            className="font-mono bg-black/20 border-border h-11 pl-10 focus:border-info/50 transition-colors"
                                        />
                                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-hover/input:text-info transition-colors" />
                                    </div>
                                    <ChannelPreview guildId={guildId} channelId={channelId} color="indigo" />
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
