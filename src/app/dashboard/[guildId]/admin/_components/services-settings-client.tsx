"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Hash, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getServiceSettings, updateServiceSettings } from "@/server/actions/service-actions";
import { ChannelPreview } from "@/components/shared/ChannelPreview";

interface ServicesSettingsClientProps {
    guildId: string;
}

export function ServicesSettingsClient({ guildId }: ServicesSettingsClientProps) {
    const [channelId, setChannelId] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [isConfigured, setIsConfigured] = useState(false);

    useEffect(() => {
        async function loadConfig() {
            const res = await getServiceSettings(guildId);
            if (res.success && res.data) {
                setChannelId(res.data.servicesNotifyChannelId || "");
                setIsConfigured(!!res.data.servicesNotifyChannelId);
            }
            setIsLoading(false);
        }
        loadConfig();
    }, [guildId]);

    const handleSaveChannel = () => {
        startTransition(async () => {
            const result = await updateServiceSettings(guildId, channelId.trim() || null);
            if (result.success) {
                toast.success("Salon de mention configuré !");
                setIsConfigured(!!channelId.trim());
            } else {
                toast.error(result.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 bg-zinc-900/60 border-white/5 shadow-xl rounded-2xl overflow-hidden backdrop-blur-xl">
                    <CardHeader className="border-b border-white/5 bg-slate-900/30 p-6">
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-wider text-white">
                                <span className="bg-cyan-500/20 text-cyan-400 p-2 rounded-xl border border-cyan-500/30">
                                    <Hash className="w-4 h-4" />
                                </span>
                                Salon de mention des passeurs
                            </CardTitle>
                            {isConfigured ? (
                                <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 font-black uppercase tracking-wider text-[10px]">Actif</Badge>
                            ) : (
                                <Badge variant="outline" className="text-zinc-500 font-black uppercase tracking-wider text-[10px]">Inactif</Badge>
                            )}
                        </div>
                        <CardDescription className="text-zinc-400 mt-2 text-xs">
                            Configurez le salon Discord dans lequel les demandes de passages / mentions de passeurs seront envoyées.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        <div className="space-y-2">
                            <p className="text-xs text-zinc-500">
                                Mode développeur Discord → Clic droit sur le salon → <span className="text-zinc-300 font-semibold">Copier l'identifiant</span>
                            </p>
                            <div className="flex gap-2">
                                <Input
                                    value={channelId}
                                    onChange={(e) => setChannelId(e.target.value)}
                                    placeholder="Ex: 123456789012345678"
                                    className="font-mono bg-black/40 border-white/10 text-white rounded-xl focus:border-cyan-500/50"
                                />
                                <Button onClick={handleSaveChannel} disabled={isPending} className="min-w-[120px] bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase tracking-wider text-xs rounded-xl shadow-lg shadow-cyan-900/20">
                                    {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                    Sauvegarder
                                </Button>
                            </div>
                            <ChannelPreview guildId={guildId} channelId={channelId} color="cyan" />
                            {isConfigured && (
                                <div className="flex justify-end">
                                    <Button
                                        variant="ghost" size="sm"
                                        onClick={() => { setChannelId(""); handleSaveChannel(); }}
                                        disabled={isPending}
                                        className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 text-xs font-bold rounded-lg"
                                    >
                                        Désactiver
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-cyan-500/5 border-cyan-500/10 h-fit rounded-2xl overflow-hidden backdrop-blur-xl">
                    <CardContent className="p-5 flex gap-3">
                        <div className="p-2 bg-cyan-500/20 rounded-xl shrink-0 h-fit border border-cyan-500/30">
                            <AlertTriangle className="w-4 h-4 text-cyan-400" />
                        </div>
                        <div className="space-y-1.5">
                            <h4 className="text-sm font-black uppercase tracking-wider text-cyan-300">Permissions requises</h4>
                            <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                                Le bot <strong>SigilOS</strong> doit avoir les droits <em>Voir le salon</em> et <em>Envoyer des messages</em> dans le salon cible pour mentionner correctement le passeur.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
