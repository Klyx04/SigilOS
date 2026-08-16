"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, AlertTriangle, Hash, Handshake, ExternalLink, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { getOcreConfig, updateOcreChannel } from "@/server/actions/admin-actions";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { ChannelPreview } from "@/components/shared/ChannelPreview";

interface OcreSettingsClientProps {
    guildId: string;
}

export function OcreSettingsClient({ guildId }: OcreSettingsClientProps) {
    const [channelId, setChannelId] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [isConfigured, setIsConfigured] = useState(false);

    useEffect(() => {
        async function loadConfig() {
            const result = await getOcreConfig(guildId);
            if (result.success && result.data) {
                setChannelId(result.data.ocreChannelId || "");
                setIsConfigured(!!result.data.ocreChannelId);
            }
            setIsLoading(false);
        }
        loadConfig();
    }, [guildId]);

    const handleSave = () => {
        startTransition(async () => {
            const result = await updateOcreChannel(guildId, channelId.trim() || null);
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
            const result = await updateOcreChannel(guildId, null);
            if (result.success) {
                setChannelId("");
                setIsConfigured(false);
                toast.success("Notifications Ocre désactivées");
            } else {
                toast.error(result.error || "Erreur lors de la désactivation");
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-success" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300 text-left">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Configuration Panel */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="bg-surface/60 border-border overflow-hidden group relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-success/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-foreground font-black uppercase tracking-tighter">
                                    <span className="bg-success/20 text-success p-2 rounded-lg">
                                        <Hash className="w-5 h-5" />
                                    </span>
                                    Salon des Échanges Ocre
                                </CardTitle>
                                {isConfigured ? (
                                    <Badge className="bg-success/10 text-success border-success/20">Actif</Badge>
                                ) : (
                                    <Badge variant="outline" className="text-muted-foreground border-border uppercase text-caption font-black tracking-widest">Inactif</Badge>
                                )}
                            </div>
                            <CardDescription className="text-xs font-medium text-muted-foreground">
                                Centralisez les demandes d'échange d'archimonstres de vos membres.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <div className="space-y-6">
                                <div className="relative pl-6 border-l-2 border-border pb-6 last:pb-0">
                                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-elevated border-2 border-zinc-950 flex items-center justify-center">
                                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                                    </div>
                                    <h3 className="text-sm font-medium text-foreground mb-2 text-left">1. Récupérer l'ID du salon</h3>
                                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                                        Créez un salon dédié (ex: <span className="text-success">🤝┊échanges-ocre</span>) pour que le bot puisse avertir les membres quand ils peuvent s'entraider.
                                    </p>
                                </div>

                                <div className="relative pl-6 border-l-2 border-success/50">
                                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-success border-2 border-zinc-950 " />
                                    <h3 className="text-sm font-medium text-foreground mb-4 text-left">2. Coller l'identifiant</h3>

                                    <div className="space-y-4">
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <div className="relative flex-1 group/input">
                                                <Input
                                                    value={channelId}
                                                    onChange={(e) => setChannelId(e.target.value)}
                                                    placeholder="ID du salon (ex: 123...)"
                                                    className="font-mono bg-black/20 border-border h-11 pl-10 focus:border-success/50 transition-colors"
                                                />
                                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-hover/input:text-success transition-colors" />
                                            </div>
                                            <Button onClick={handleSave} disabled={isPending} className="min-w-[140px] bg-success hover:bg-success h-11 font-bold shadow-lg shadow-emerald-600/20">
                                                {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                                SAUVEGARDER
                                            </Button>
                                        </div>
                                        <ChannelPreview guildId={guildId} channelId={channelId} color="emerald" />
                                        
                                        {isConfigured ? (
                                            <div className="flex justify-end">
                                                <Button variant="ghost" size="sm" onClick={handleClear} disabled={isPending} className="text-danger hover:text-danger hover:bg-danger/20 h-auto py-1 px-3 text-caption font-black uppercase tracking-widest">
                                                    Désactiver l'intégration
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="p-3 rounded-xl bg-warning/5 border border-warning/10 flex items-start gap-3">
                                                <AlertTriangle className="w-3.5 h-3.5 text-warning mt-0.5 shrink-0" />
                                                <p className="text-caption text-muted-foreground leading-relaxed italic">
                                                    Aucun salon configuré. Les demandes d'échange ne seront pas relayées sur Discord.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-info/5 border-info/10 overflow-hidden">
                        <CardContent className="p-5 flex gap-4">
                            <div className="p-2.5 bg-info/20 rounded-xl shrink-0 h-fit">
                                <ShieldCheck className="w-5 h-5 text-info" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-sm font-bold text-info uppercase tracking-tight">Vérification des Permissions</h4>
                                <p className="text-xs text-info/70 leading-relaxed">
                                    Assurez-vous que le bot <strong>SigilOS</strong> possède les permissions <span className="text-info font-bold">Voir le salon</span> et <span className="text-info font-bold">Envoyer des messages</span> dans le salon choisi.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Preview Panel */}
                <div className="space-y-6">
                    <Card className="bg-surface/60 border-border overflow-hidden">
                        <CardHeader className="bg-surface pb-3 px-4 py-3">
                            <CardTitle className="text-caption font-black uppercase tracking-widest text-muted-foreground text-left">Aperçu : Demande d'Échange</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 relative px-4 text-left">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-success flex items-center justify-center shrink-0">
                                    <Handshake className="w-4 h-4 text-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className="font-medium text-success text-xs">SigilOS</span>
                                        <span className="bg-success/20 text-success text-caption px-1 rounded uppercase font-black">Bot</span>
                                    </div>

                                    <div className="bg-[#2b2d31] rounded border-l-4 border-success p-3 max-w-sm shadow-xl">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-sm">🤝</span>
                                            <h4 className="font-semibold text-foreground text-caption">Demande d'Échange</h4>
                                        </div>

                                        <p className="text-foreground text-caption leading-relaxed mb-3">
                                            <span className="text-success font-medium">@Wylan</span> recherche <span className="text-foreground font-bold">Abrakne le Miséricordieux</span>.
                                        </p>

                                        <div className="grid grid-cols-2 gap-3 p-2 bg-black/20 rounded border border-border">
                                            <div>
                                                <div className="text-[#b5bac1] text-caption font-bold uppercase tracking-wider mb-0.5">Contacté</div>
                                                <div className="text-foreground text-caption truncate">Tourte</div>
                                            </div>
                                            <div>
                                                <div className="text-[#b5bac1] text-caption font-bold uppercase tracking-wider mb-0.5">Dispo</div>
                                                <div className="text-warning text-caption font-bold">En Double</div>
                                            </div>
                                        </div>

                                        <div className="mt-3 pt-2 border-t border-[#3f4147] flex items-center justify-between">
                                            <span className="text-[#949ba4] text-caption">Quête Ocre • SigilOS</span>
                                            <ExternalLink className="w-2.5 h-2.5 text-muted-foreground" />
                                        </div>
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
