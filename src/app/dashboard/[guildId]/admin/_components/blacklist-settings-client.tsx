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
                <Loader2 className="w-8 h-8 animate-spin text-danger/50" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-300 pb-10">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* ── MAIN CONFIG ── */}
                <Card className="lg:col-span-2 bg-surface/40 border-border backdrop-blur-xl shrink-0 overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-danger/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    
                    <CardHeader className="relative z-10">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
                                <span className="bg-danger/20 text-danger p-2.5 rounded-2xl border border-danger/20">
                                    <ShieldAlert className="w-6 h-6" />
                                </span>
                                Synchronisation Discord
                            </CardTitle>
                            {isConfigured ? (
                                <Badge className="bg-danger/10 text-danger border-danger/20 px-3 py-1 font-black uppercase tracking-widest animate-pulse">
                                    SYNCHRO ACTIVE
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-muted-foreground border-border px-3 py-1 font-black uppercase tracking-widest">
                                    DÉSACTIVÉ
                                </Badge>
                            )}
                        </div>
                        <CardDescription className="text-muted-foreground font-medium">
                            Couplez votre salon de signalement Discord avec le Dashboard SigilOS pour une gestion centralisée.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-8 relative z-10">
                        <div className="p-4 rounded-2xl bg-black/40 border border-border space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-center shrink-0">
                                    <Hash className="w-5 h-5 text-danger" />
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-xs font-black uppercase text-foreground tracking-widest">ID du Salon Blacklist</p>
                                    <p className="text-caption text-muted-foreground font-medium">Récupérez l&apos;ID via Discord (Clic droit {'>'} Copier l&apos;ID)</p>
                                </div>
                            </div>
                            
                            <div className="flex gap-2">
                                <Input 
                                    value={channelId}
                                    onChange={(e) => setChannelId(e.target.value)}
                                    placeholder="Ex: 1290442961380835451"
                                    className="bg-black/40 border-border font-mono text-danger h-12 rounded-xl focus:ring-danger/50"
                                />
                                <Button 
                                    onClick={handleSave} 
                                    disabled={isPending}
                                    className="bg-danger hover:bg-danger text-danger-foreground font-black px-6 h-12 rounded-xl"
                                >
                                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                </Button>
                            </div>
                            <ChannelPreview guildId={guildId} channelId={channelId} color="rose" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-surface border border-border space-y-2">
                                <div className="flex items-center gap-2 text-foreground font-black text-caption uppercase tracking-widest">
                                    <ArrowRightLeft className="w-3.5 h-3.5 text-danger" />
                                    Synchro Bidirectionnelle
                                </div>
                                <p className="text-caption text-muted-foreground leading-relaxed italic">
                                    Ajoutez, modifiez ou supprimez des entrées sur Discord ou le Dashboard, les changements se répercutent instantanément des deux côtés.
                                </p>
                            </div>
                            <div className="p-4 rounded-2xl bg-surface border border-border space-y-2">
                                <div className="flex items-center gap-2 text-foreground font-black text-caption uppercase tracking-widest">
                                    <MessageSquare className="w-3.5 h-3.5 text-danger" />
                                    Formatage Automatique
                                </div>
                                <p className="text-caption text-muted-foreground leading-relaxed italic">
                                    Le bot formate proprement les signalements sur Discord avec des embeds colorés pour une lecture rapide par vos modérateurs.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* ── INFO PANEL ── */}
                <div className="space-y-6">
                    <Card className="bg-surface/60 border-border overflow-hidden relative">
                        <CardHeader className="bg-danger/5 pb-4 border-b border-border">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-danger flex items-center gap-2">
                                <Sparkles className="w-3.5 h-3.5" />
                                Comment ça marche ?
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="space-y-3">
                                <div className="flex gap-3">
                                    <div className="w-5 h-5 rounded-full bg-danger/20 text-danger flex items-center justify-center text-caption font-black shrink-0 mt-0.5">1</div>
                                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                                        Créez ou choisissez un salon dédié aux signalements sur votre Discord.
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <div className="w-5 h-5 rounded-full bg-danger/20 text-danger flex items-center justify-center text-caption font-black shrink-0 mt-0.5">2</div>
                                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                                        Saisissez son ID ici. Le Bot SigilOS doit avoir accès en <span className="text-foreground">lecture/écriture</span>.
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <div className="w-5 h-5 rounded-full bg-danger/20 text-danger flex items-center justify-center text-caption font-black shrink-0 mt-0.5">3</div>
                                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                                        Postez n&apos;importe quoi dans ce salon : SigilOS le capturera et l&apos;ajoutera à la blacklist dashboard !
                                    </p>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-border">
                                <div className="p-3 rounded-xl bg-warning/5 border border-warning/10 flex items-start gap-3">
                                    <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                                    <p className="text-caption text-warning/70 italic leading-relaxed font-medium">
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
