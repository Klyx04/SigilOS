"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, AlertTriangle, Hash, ArrowLeft, Moon } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { getSongesConfig, updateSongesChannel } from "@/server/actions/admin-actions";

interface SongesSettingsClientProps {
    guildId: string;
}

export function SongesSettingsClient({ guildId }: SongesSettingsClientProps) {
    const [channelId, setChannelId] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [isConfigured, setIsConfigured] = useState(false);

    useEffect(() => {
        async function loadConfig() {
            const result = await getSongesConfig(guildId);
            if (result.success && result.data) {
                setChannelId(result.data.songesChannelId || "");
                setIsConfigured(!!result.data.songesChannelId);
            }
            setIsLoading(false);
        }
        loadConfig();
    }, [guildId]);

    const handleSave = () => {
        startTransition(async () => {
            const result = await updateSongesChannel(guildId, channelId.trim() || null);
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
            const result = await updateSongesChannel(guildId, null);
            if (result.success) {
                setChannelId("");
                setIsConfigured(false);
                toast.success("Notifications Songes désactivées");
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
                <Card className="lg:col-span-2 bg-zinc-900/60 border-white/5">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <span className="bg-purple-500/20 text-purple-400 p-2 rounded-lg">
                                    <Hash className="w-5 h-5" />
                                </span>
                                Salon Discord
                            </CardTitle>
                            {isConfigured ? (
                                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20">
                                    Actif
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-zinc-500">
                                    Inactif
                                </Badge>
                            )}
                        </div>
                        <CardDescription>
                            Les leaders seront notifiés ici quand un joueur postule à leur run Songes.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {/* Step 1 */}
                        <div className="relative pl-6 border-l-2 border-white/5 pb-6 last:pb-0">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-zinc-800 border-2 border-zinc-950 flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                            </div>
                            <h3 className="text-sm font-medium text-white mb-2">1. Récupérer l'ID du salon</h3>
                            <p className="text-xs text-zinc-500 mb-3">
                                Activez le mode développeur Discord, puis faites <span className="text-zinc-300">Clic Droit</span> sur le salon voulu {'>'} <span className="text-zinc-300">Copier l'identifiant</span>.
                            </p>
                        </div>

                        {/* Step 2 */}
                        <div className="relative pl-6 border-l-2 border-purple-500/50">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-purple-500 border-2 border-zinc-950 shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                            <h3 className="text-sm font-medium text-white mb-4">2. Coller l'identifiant</h3>

                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <Input
                                        value={channelId}
                                        onChange={(e) => setChannelId(e.target.value)}
                                        placeholder="Ex: 123456789012345678"
                                        className="font-mono bg-black/20 border-white/10"
                                    />
                                    <Button onClick={handleSave} disabled={isPending} className="min-w-[120px] bg-purple-600 hover:bg-purple-500">
                                        {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                        Sauvegarder
                                    </Button>
                                </div>
                                {isConfigured && (
                                    <div className="flex justify-end">
                                        <Button variant="ghost" size="sm" onClick={handleClear} disabled={isPending} className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-auto py-1 px-3 text-xs">
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
                    <Card className="bg-zinc-900/60 border-white/5 overflow-hidden">
                        <CardHeader className="bg-white/5 pb-4">
                            <CardTitle className="text-sm text-zinc-300">Aperçu du message</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 relative">
                            {/* Discord Message Mockup */}
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center shrink-0">
                                    <Moon className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className="font-medium text-purple-400">SigilOS</span>
                                        <span className="bg-purple-500/20 text-purple-300 text-[10px] px-1 rounded">BOT</span>
                                        <span className="text-xs text-zinc-500">Maintenant</span>
                                    </div>

                                    {/* Embed */}
                                    <div className="bg-[#2b2d31] rounded border-l-4 border-purple-400 p-4 max-w-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-lg">🌙</span>
                                            <h4 className="font-semibold text-white text-sm">Nouvelle candidature</h4>
                                        </div>

                                        <p className="text-zinc-300 text-sm mb-4">
                                            <span className="text-purple-400 font-medium hover:underline cursor-pointer">Wylan</span> veut rejoindre votre run <span className="text-amber-400">Rêve III</span>.
                                        </p>

                                        <div className="flex gap-6">
                                            <div>
                                                <div className="text-[#b5bac1] text-xs font-bold uppercase tracking-wider mb-1">Classe</div>
                                                <div className="text-zinc-200 text-sm">Cra</div>
                                            </div>
                                            <div>
                                                <div className="text-[#b5bac1] text-xs font-bold uppercase tracking-wider mb-1">Message</div>
                                                <div className="text-zinc-200 text-sm">Opti dispo 21h</div>
                                            </div>
                                        </div>

                                        <div className="mt-3 pt-3 border-t border-[#3f4147] flex items-center gap-2">
                                            <div className="w-4 h-4 rounded-full bg-zinc-700" />
                                            <span className="text-[#949ba4] text-xs">SigilOS • Songes Infinis</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-blue-500/5 border-blue-500/10">
                        <CardContent className="p-4 flex gap-3">
                            <div className="p-2 bg-blue-500/20 rounded-lg shrink-0 h-fit">
                                <AlertTriangle className="w-4 h-4 text-blue-400" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-sm font-medium text-blue-200">Permissions requises</h4>
                                <p className="text-xs text-blue-300/70 leading-relaxed">
                                    Le bot <strong>SigilOS</strong> doit avoir les droits "Voir le salon" et "Envoyer des messages".
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
