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
                <Loader2 className="w-8 h-8 animate-spin text-amber-500/50" />
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-10">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* ── MAIN CONFIG ── */}
                <Card className="lg:col-span-2 bg-zinc-900/40 border-white/5 overflow-hidden">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-xl font-bold flex items-center gap-3">
                                <span className="bg-amber-500/20 text-amber-400 p-2.5 rounded-2xl border border-amber-500/20">
                                    <Megaphone className="w-6 h-6" />
                                </span>
                                Canal de Relance
                            </CardTitle>
                            {isConfigured ? (
                                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-caption font-semibold uppercase tracking-wide">
                                    Configuré
                                </Badge>
                            ) : (
                                <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-caption font-semibold uppercase tracking-wide">
                                    Non configuré
                                </Badge>
                            )}
                        </div>
                        <CardDescription className="text-zinc-500">
                            Salon Discord où les relances « ping canal » sont diffusées depuis Admin &gt; Membres.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-caption font-semibold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                                <Hash className="w-3.5 h-3.5" /> ID du salon Discord
                            </label>
                            <Input
                                value={channelId}
                                onChange={(e) => setChannelId(e.target.value)}
                                placeholder="Ex: 123456789012345678"
                                className="h-11 bg-zinc-900/60 border-white/10 font-mono text-sm"
                            />
                            <ChannelPreview guildId={guildId} channelId={channelId} color="amber" />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <Button
                                onClick={handleSave}
                                disabled={isPending}
                                className="h-10 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase tracking-widest text-xs disabled:opacity-40"
                            >
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                Enregistrer
                            </Button>
                        </div>

                        <div className="pt-2 border-t border-white/5 flex items-start gap-2 text-caption text-zinc-500">
                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            <p>
                                La modale « Relancer » affiche ce salon en lecture seule : plus de choix du canal à la volée.
                                Le bot doit avoir accès en lecture/écriture à ce salon.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* ── INFO PANEL ── */}
                <div className="space-y-6">
                    <Card className="bg-zinc-900/60 border-white/10 overflow-hidden">
                        <CardHeader className="bg-amber-500/5 pb-4 border-b border-white/5">
                            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-amber-400 flex items-center gap-2">
                                <Megaphone className="w-3.5 h-3.5" />
                                Comment ça marche ?
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="space-y-3">
                                <div className="flex gap-3">
                                    <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-caption font-bold shrink-0 mt-0.5">1</div>
                                    <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                                        Choisissez un salon dédié aux relances sur votre Discord.
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-caption font-bold shrink-0 mt-0.5">2</div>
                                    <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                                        Collez son ID ici et enregistrez. Le Bot SigilOS doit avoir accès en <span className="text-white">lecture/écriture</span>.
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-caption font-bold shrink-0 mt-0.5">3</div>
                                    <p className="text-xs text-zinc-400 leading-relaxed font-medium">
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
