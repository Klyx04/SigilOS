"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Hash, AlertTriangle, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { getRelanceConfig, updateRelanceChannel } from "@/server/actions/relance-actions";
import { ChannelPreview } from "@/components/shared/ChannelPreview";

interface RelanceSettingsClientProps {
    guildId: string;
}

/** #104 — Canal de relance préconfiguré : utilisé par la modale « Relancer » (ping canal). */
export function RelanceSettingsClient({ guildId }: RelanceSettingsClientProps) {
    const [channelId, setChannelId] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [isConfigured, setIsConfigured] = useState(false);

    useEffect(() => {
        async function loadConfig() {
            const result = await getRelanceConfig(guildId);
            if (result.success && result.data) {
                setChannelId(result.data.relanceChannelId || "");
                setIsConfigured(!!result.data.relanceChannelId);
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
            const result = await updateRelanceChannel(guildId, trimmed || null);
            if (result.success) {
                toast.success("Canal de relance mis à jour !");
                setIsConfigured(!!trimmed);
            } else {
                toast.error(result.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-warning/50" />
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-10">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* ── MAIN CONFIG ── */}
                <Card className="lg:col-span-2 bg-surface/40 border-border overflow-hidden">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-xl font-bold flex items-center gap-3">
                                <span className="bg-warning/20 text-warning p-2.5 rounded-2xl border border-warning/20">
                                    <Megaphone className="w-6 h-6" />
                                </span>
                                Canal de Relance
                            </CardTitle>
                            {isConfigured ? (
                                <Badge className="bg-success/10 text-success border-success/20 text-caption font-semibold uppercase tracking-wide">
                                    Configuré
                                </Badge>
                            ) : (
                                <Badge className="bg-warning/10 text-warning border-warning/20 text-caption font-semibold uppercase tracking-wide">
                                    Non configuré
                                </Badge>
                            )}
                        </div>
                        <CardDescription className="text-muted-foreground">
                            Salon Discord où les relances « ping canal » sont diffusées depuis Admin &gt; Membres.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-caption font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                <Hash className="w-3.5 h-3.5" /> ID du salon Discord
                            </label>
                            <Input
                                value={channelId}
                                onChange={(e) => setChannelId(e.target.value)}
                                placeholder="Ex: 123456789012345678"
                                className="h-11 bg-surface/60 border-border font-mono text-sm"
                            />
                            <ChannelPreview guildId={guildId} channelId={channelId} color="amber" />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <Button
                                onClick={handleSave}
                                disabled={isPending}
                                className="h-10 px-5 rounded-xl bg-warning hover:bg-warning text-warning-foreground font-bold uppercase tracking-widest text-xs disabled:opacity-40"
                            >
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                Enregistrer
                            </Button>
                        </div>

                        <div className="pt-2 border-t border-border flex items-start gap-2 text-caption text-muted-foreground">
                            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                            <p>
                                La modale « Relancer » affiche ce salon en lecture seule : plus de choix du canal à la volée.
                                Le bot doit avoir accès en lecture/écriture à ce salon.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* ── INFO PANEL ── */}
                <div className="space-y-6">
                    <Card className="bg-surface/60 border-border overflow-hidden">
                        <CardHeader className="bg-warning/5 pb-4 border-b border-border">
                            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-warning flex items-center gap-2">
                                <Megaphone className="w-3.5 h-3.5" />
                                Comment ça marche ?
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="space-y-3">
                                <div className="flex gap-3">
                                    <div className="w-5 h-5 rounded-full bg-warning/20 text-warning flex items-center justify-center text-caption font-bold shrink-0 mt-0.5">1</div>
                                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                                        Choisissez un salon dédié aux relances sur votre Discord.
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <div className="w-5 h-5 rounded-full bg-warning/20 text-warning flex items-center justify-center text-caption font-bold shrink-0 mt-0.5">2</div>
                                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                                        Collez son ID ici et enregistrez. Le Bot SigilOS doit avoir accès en <span className="text-foreground">lecture/écriture</span>.
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <div className="w-5 h-5 rounded-full bg-warning/20 text-warning flex items-center justify-center text-caption font-bold shrink-0 mt-0.5">3</div>
                                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                                        Les relances depuis Admin &gt; Membres y seront diffusées avec un ping @mention des membres ciblés.
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
