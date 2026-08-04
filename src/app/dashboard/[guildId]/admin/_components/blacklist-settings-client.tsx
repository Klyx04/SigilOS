"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, AlertTriangle, Hash, ShieldAlert, Sparkles, MessageSquare, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { getBlacklistConfig, updateBlacklistSettings } from "@/server/actions/blacklist-actions";
import { cn } from "@/lib/utils";
import { ChannelPreview } from "@/components/shared/ChannelPreview";

interface BlacklistSettingsClientProps {
    guildId: string;
}

export function BlacklistSettingsClient({ guildId }: BlacklistSettingsClientProps) {
    const [channelId, setChannelId] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [isConfigured, setIsConfigured] = useState(false);

    useEffect(() => {
        async function loadConfig() {
            const result = await getBlacklistConfig(guildId);
            if (result.success && result.data) {
                setChannelId(result.data.blacklistChannelId || "");
                setIsConfigured(!!result.data.blacklistChannelId);
            }
            setIsLoading(false);
        }
        loadConfig();
    }, [guildId]);

    const handleSave = () => {
        const trimmed = channelId.trim();
        if (trimmed && !/^\d{17,20}$/.test(trimmed)) {
            toast.error("ID de salon Discord invalide");
            return;
        }

        startTransition(async () => {
            const result = await updateBlacklistSettings(guildId, trimmed || null);
            if (result.success) {
                toast.success("Synchronisation Blacklist mise à jour !");
                setIsConfigured(!!trimmed);
            } else {
                toast.error(result.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-red-500/50" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* ── MAIN CONFIG ── */}
                <Card className="lg:col-span-2 bg-zinc-900/40 border-white/5 backdrop-blur-xl shrink-0 overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    
                    <CardHeader className="relative z-10">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
                                <span className="bg-red-500/20 text-red-400 p-2.5 rounded-2xl border border-red-500/20">
                                    <ShieldAlert className="w-6 h-6" />
                                </span>
                                Synchronisation Discord
                            </CardTitle>
                            {isConfigured ? (
                                <Badge className="bg-red-500/10 text-red-400 border-red-500/20 px-3 py-1 font-black uppercase tracking-widest animate-pulse">
                                    SYNCHRO ACTIVE
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-zinc-500 border-white/10 px-3 py-1 font-black uppercase tracking-widest">
                                    DÉSACTIVÉ
                                </Badge>
                            )}
                        </div>
                        <CardDescription className="text-zinc-400 font-medium">
                            Couplez votre salon de signalement Discord avec le Dashboard SigilOS pour une gestion centralisée.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-8 relative z-10">
                        <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                                    <Hash className="w-5 h-5 text-red-400" />
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-xs font-black uppercase text-white tracking-widest">ID du Salon Blacklist</p>
                                    <p className="text-[10px] text-zinc-500 font-medium">Récupérez l&apos;ID via Discord (Clic droit {'>'} Copier l&apos;ID)</p>
                                </div>
                            </div>
                            
                            <div className="flex gap-2">
                                <Input 
                                    value={channelId}
                                    onChange={(e) => setChannelId(e.target.value)}
                                    placeholder="Ex: 1290442961380835451"
                                    className="bg-black/40 border-white/10 font-mono text-red-400 h-12 rounded-xl focus:ring-red-500/50"
                                />
                                <Button 
                                    onClick={handleSave} 
                                    disabled={isPending}
                                    className="bg-red-600 hover:bg-red-500 text-white font-black px-6 h-12 rounded-xl"
                                >
                                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                </Button>
                            </div>
                            <ChannelPreview guildId={guildId} channelId={channelId} color="rose" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                                <div className="flex items-center gap-2 text-white font-black text-[10px] uppercase tracking-widest">
                                    <ArrowRightLeft className="w-3.5 h-3.5 text-red-400" />
                                    Synchro Bidirectionnelle
                                </div>
                                <p className="text-[11px] text-zinc-500 leading-relaxed italic">
                                    Ajoutez, modifiez ou supprimez des entrées sur Discord ou le Dashboard, les changements se répercutent instantanément des deux côtés.
                                </p>
                            </div>
                            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                                <div className="flex items-center gap-2 text-white font-black text-[10px] uppercase tracking-widest">
                                    <MessageSquare className="w-3.5 h-3.5 text-red-400" />
                                    Formatage Automatique
                                </div>
                                <p className="text-[11px] text-zinc-500 leading-relaxed italic">
                                    Le bot formate proprement les signalements sur Discord avec des embeds colorés pour une lecture rapide par vos modérateurs.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* ── INFO PANEL ── */}
                <div className="space-y-6">
                    <Card className="bg-zinc-900/60 border-white/10 overflow-hidden relative">
                        <CardHeader className="bg-red-500/5 pb-4 border-b border-white/5">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-red-400 flex items-center gap-2">
                                <Sparkles className="w-3.5 h-3.5" />
                                Comment ça marche ?
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="space-y-3">
                                <div className="flex gap-3">
                                    <div className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">1</div>
                                    <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                                        Créez ou choisissez un salon dédié aux signalements sur votre Discord.
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <div className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">2</div>
                                    <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                                        Saisissez son ID ici. Le Bot SigilOS doit avoir accès en <span className="text-white">lecture/écriture</span>.
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <div className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">3</div>
                                    <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                                        Postez n&apos;importe quoi dans ce salon : SigilOS le capturera et l&apos;ajoutera à la blacklist dashboard !
                                    </p>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-white/5">
                                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-3">
                                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-amber-200/70 italic leading-relaxed font-medium">
                                        Note: Seuls les messages textuels sont synchronisés. Les images/fichiers ne sont pas importés.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
