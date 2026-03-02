"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Hash, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getLoansConfig, updateLoansChannel } from "@/server/actions/admin-actions";

interface LoansSettingsClientProps {
    guildId: string;
}

export function LoansSettingsClient({ guildId }: LoansSettingsClientProps) {
    const [channelId, setChannelId] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [isConfigured, setIsConfigured] = useState(false);

    useEffect(() => {
        async function loadConfig() {
            const result = await getLoansConfig(guildId);
            if (result.success && result.data) {
                setChannelId(result.data.loansNotifyChannelId || "");
                setIsConfigured(!!result.data.loansNotifyChannelId);
            }
            setIsLoading(false);
        }
        loadConfig();
    }, [guildId]);

    const handleSave = () => {
        startTransition(async () => {
            const result = await updateLoansChannel(guildId, channelId.trim() || null);
            if (result.success) {
                toast.success("Salon configuré !");
                setIsConfigured(!!channelId.trim());
            } else {
                toast.error(result.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 bg-zinc-900/60 border-white/5">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <span className="bg-emerald-500/20 text-emerald-400 p-2 rounded-lg">
                                <Hash className="w-4 h-4" />
                            </span>
                            Salon de notifications
                        </CardTitle>
                        {isConfigured ? (
                            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Actif</Badge>
                        ) : (
                            <Badge variant="outline" className="text-zinc-500">Inactif</Badge>
                        )}
                    </div>
                    <CardDescription>
                        Quand un prêt est créé/rendu ou qu&apos;un mouvement de coffre est enregistré, le bot postera un message récapitulatif dans ce salon.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <p className="text-xs text-zinc-500">
                            Mode développeur Discord → Clic droit sur le salon → <span className="text-zinc-300">Copier l&apos;identifiant</span>
                        </p>
                        <div className="flex gap-2">
                            <Input
                                value={channelId}
                                onChange={(e) => setChannelId(e.target.value)}
                                placeholder="Ex: 123456789012345678"
                                className="font-mono bg-black/20 border-white/10"
                            />
                            <Button onClick={handleSave} disabled={isPending} className="min-w-[120px] bg-emerald-600 hover:bg-emerald-500">
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                Sauvegarder
                            </Button>
                        </div>
                        {isConfigured && (
                            <div className="flex justify-end">
                                <Button
                                    variant="ghost" size="sm"
                                    onClick={() => { setChannelId(""); handleSave(); }}
                                    disabled={isPending}
                                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-900/20 text-xs"
                                >
                                    Désactiver
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-blue-500/5 border-blue-500/10 h-fit">
                <CardContent className="p-4 flex gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg shrink-0 h-fit">
                        <AlertTriangle className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-sm font-medium text-blue-200">Permissions requises</h4>
                        <p className="text-xs text-blue-300/70 leading-relaxed">
                            Le bot <strong>SigilOS</strong> doit avoir les droits <em>Voir le salon</em> et <em>Envoyer des messages</em> dans le salon cible.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
