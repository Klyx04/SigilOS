"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, AlertTriangle, Hash, Sparkles, Gem } from "lucide-react";
import { toast } from "sonner";
import { getBonusConfig, updateBonusChannel } from "@/server/actions/bonus-actions";

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
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Configuration Panel */}
                <Card className="lg:col-span-2 bg-zinc-900/60 border-white/5 overflow-hidden">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-white font-black uppercase tracking-tighter">
                                <span className="bg-purple-500/20 text-purple-400 p-2 rounded-lg">
                                    <Gem className="w-5 h-5" />
                                </span>
                                Bonus de Guilde (Oracles)
                            </CardTitle>
                            {isConfigured ? (
                                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20">
                                    Actif
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-zinc-500 border-white/5 uppercase text-[10px] font-black tracking-widest">
                                    Inactif
                                </Badge>
                            )}
                        </div>
                        <CardDescription className="text-xs font-medium text-zinc-500">
                            Notifications automatiques lors de l'activation des bonus de guilde.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {/* Setup steps */}
                        <div className="relative pl-6 border-l-2 border-white/5 pb-6 last:pb-0">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-zinc-800 border-2 border-zinc-950 flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                            </div>
                            <h3 className="text-sm font-medium text-white mb-2">1. Récupérer l'ID du salon</h3>
                            <p className="text-xs text-zinc-500 mb-3 leading-relaxed">
                                Les annonces d'activation de bonus (Oracle de Fortune, etc.) seront postées dans ce salon.
                            </p>
                        </div>

                        <div className="relative pl-6 border-l-2 border-purple-500/50">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-purple-500 border-2 border-zinc-950 shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                            <h3 className="text-sm font-medium text-white mb-4">2. Coller l'identifiant</h3>

                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <Input
                                        value={channelId}
                                        onChange={(e) => setChannelId(e.target.value)}
                                        placeholder="Ex: 123456789012345678"
                                        className="font-mono bg-black/20 border-white/10 h-11"
                                    />
                                    <Button onClick={handleSave} disabled={isPending} className="min-w-[120px] bg-purple-600 hover:bg-purple-500 h-11 font-bold">
                                        {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                        SAUVEGARDER
                                    </Button>
                                </div>
                                {isConfigured && (
                                    <div className="flex justify-end">
                                        <Button variant="ghost" size="sm" onClick={handleClear} disabled={isPending} className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-auto py-1 px-3 text-[10px] font-black uppercase tracking-widest">
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
                    <Card className="bg-zinc-900/60 border-white/5 overflow-hidden">
                        <CardHeader className="bg-white/5 pb-4 px-6 py-4">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Aperçu : Bonus Activé</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 relative text-left px-6">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
                                    <Sparkles className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className="font-medium text-purple-400">SigilOS</span>
                                        <span className="bg-purple-500/20 text-purple-300 text-[10px] px-1 rounded">BOT</span>
                                        <span className="text-xs text-zinc-500">Maintenant</span>
                                    </div>

                                    {/* Embed */}
                                    <div className="bg-[#2b2d31] rounded border-l-4 border-purple-500 p-4 max-w-sm shadow-xl">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Sparkles className="w-4 h-4 text-purple-400" />
                                            <h4 className="font-semibold text-white text-[11px]">Bonus de Guilde Activé !</h4>
                                        </div>

                                        <p className="text-zinc-300 text-[10px] mb-3 leading-relaxed">
                                            <span className="text-purple-400 font-medium italic">Oracle de Fortune</span> a été acheté par <span className="text-indigo-400 font-bold">@Wylan</span>.
                                        </p>

                                        <div className="grid grid-cols-2 gap-2 mb-3">
                                            <div className="bg-black/20 p-2 rounded border border-white/5">
                                                <div className="text-[#b5bac1] text-[8px] font-bold uppercase tracking-wider mb-0.5">Effet</div>
                                                <div className="text-zinc-200 text-[10px] font-medium">+50% Loot</div>
                                            </div>
                                            <div className="bg-black/20 p-2 rounded border border-white/5">
                                                <div className="text-[#b5bac1] text-[8px] font-bold uppercase tracking-wider mb-0.5">Durée</div>
                                                <div className="text-zinc-200 text-[10px] font-medium">2 heures</div>
                                            </div>
                                        </div>

                                        <div className="mt-3 pt-3 border-t border-[#3f4147] flex items-center gap-2">
                                            <div className="w-4 h-4 rounded-full bg-zinc-700" />
                                            <span className="text-[#949ba4] text-[10px]">SigilOS • Guild Perks</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-blue-500/5 border-blue-500/10">
                        <CardContent className="p-4 flex gap-3 text-left">
                            <div className="p-2 bg-blue-500/20 rounded-lg shrink-0 h-fit">
                                <AlertTriangle className="w-4 h-4 text-blue-400" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-sm font-medium text-blue-200">Permissions requises</h4>
                                <p className="text-xs text-blue-300/70 leading-relaxed">
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
