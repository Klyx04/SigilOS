"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, AlertTriangle, Hash, Sparkles, Gem } from "lucide-react";
import { toast } from "sonner";
import { getBonusConfig, updateBonusChannel } from "@/server/actions/bonus-actions";
import { ChannelPreview } from "@/components/shared/ChannelPreview";

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
                toast.success("Canal de notification bonus sauvegardé !");
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
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-info" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Configuration Panel */}
                <Card className="lg:col-span-2 bg-surface/60 border-border overflow-hidden">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-foreground font-black uppercase tracking-tighter">
                                <span className="bg-info/20 text-info p-2 rounded-lg">
                                    <Gem className="w-5 h-5" />
                                </span>
                                Bonus de Guilde (Oracles)
                            </CardTitle>
                            {isConfigured ? (
                                <Badge className="bg-success/10 text-success border-success/20 hover:bg-success/20">
                                    Actif
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-muted-foreground border-border uppercase text-caption font-black tracking-widest">
                                    Inactif
                                </Badge>
                            )}
                        </div>
                        <CardDescription className="text-xs font-medium text-muted-foreground">
                            Notifications automatiques lors de l'activation des bonus de guilde.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {/* Setup steps */}
                        <div className="relative pl-6 border-l-2 border-border pb-6 last:pb-0">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-elevated border-2 border-zinc-950 flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                            </div>
                            <h3 className="text-sm font-medium text-foreground mb-2">1. Récupérer l'ID du salon</h3>
                            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                                Les annonces d'activation de bonus (Oracle de Fortune, etc.) seront postées dans ce salon.
                            </p>
                        </div>

                        <div className="relative pl-6 border-l-2 border-info/50">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-info border-2 border-zinc-950 " />
                            <h3 className="text-sm font-medium text-foreground mb-4">2. Coller l'identifiant</h3>

                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <Input
                                        value={channelId}
                                        onChange={(e) => setChannelId(e.target.value)}
                                        placeholder="Ex: 123456789012345678"
                                        className="font-mono bg-black/20 border-border h-11"
                                    />
                                    <Button onClick={handleSave} disabled={isPending} className="min-w-[120px] bg-info hover:bg-info h-11 font-bold">
                                        {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                        SAUVEGARDER
                                    </Button>
                                </div>
                                <ChannelPreview guildId={guildId} channelId={channelId} color="purple" />
                                {isConfigured && (
                                    <div className="flex justify-end">
                                        <Button variant="ghost" size="sm" onClick={handleClear} disabled={isPending} className="text-danger hover:text-danger hover:bg-danger/20 h-auto py-1 px-3 text-caption font-black uppercase tracking-widest">
                                            Désactiver les notifications
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
                        <CardHeader className="bg-surface pb-4 px-6 py-4">
                            <CardTitle className="text-caption font-black uppercase tracking-widest text-muted-foreground">Aperçu : Bonus Activé</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 relative text-left px-6">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-info flex items-center justify-center shrink-0">
                                    <Sparkles className="w-5 h-5 text-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className="font-medium text-info">SigilOS</span>
                                        <span className="bg-info/20 text-info text-caption px-1 rounded">BOT</span>
                                        <span className="text-xs text-muted-foreground">Maintenant</span>
                                    </div>

                                    {/* Embed */}
                                    <div className="bg-[#2b2d31] rounded border-l-4 border-info p-4 max-w-sm shadow-xl">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Sparkles className="w-4 h-4 text-info" />
                                            <h4 className="font-semibold text-foreground text-caption">Bonus de Guilde Activé !</h4>
                                        </div>

                                        <p className="text-foreground text-caption mb-3 leading-relaxed">
                                            <span className="text-info font-medium italic">Oracle de Fortune</span> a été acheté par <span className="text-info font-bold">@Wylan</span>.
                                        </p>

                                        <div className="grid grid-cols-2 gap-2 mb-3">
                                            <div className="bg-black/20 p-2 rounded border border-border">
                                                <div className="text-[#b5bac1] text-caption font-bold uppercase tracking-wider mb-0.5">Effet</div>
                                                <div className="text-foreground text-caption font-medium">+50% Loot</div>
                                            </div>
                                            <div className="bg-black/20 p-2 rounded border border-border">
                                                <div className="text-[#b5bac1] text-caption font-bold uppercase tracking-wider mb-0.5">Durée</div>
                                                <div className="text-foreground text-caption font-medium">2 heures</div>
                                            </div>
                                        </div>

                                        <div className="mt-3 pt-3 border-t border-[#3f4147] flex items-center gap-2">
                                            <div className="w-4 h-4 rounded-full bg-muted" />
                                            <span className="text-[#949ba4] text-caption">SigilOS • Guild Perks</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-info/5 border-info/10">
                        <CardContent className="p-4 flex gap-3 text-left">
                            <div className="p-2 bg-info/20 rounded-lg shrink-0 h-fit">
                                <AlertTriangle className="w-4 h-4 text-info" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-sm font-medium text-info">Permissions requises</h4>
                                <p className="text-xs text-info/70 leading-relaxed">
                                    Le bot <strong>SigilOS</strong> doit pouvoir écrire dans ce salon pour annoncer les bonus.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
