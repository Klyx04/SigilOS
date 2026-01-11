"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, AlertTriangle, CheckCircle2, Hash, Info, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { getAbsenceConfig, updateAbsenceChannel } from "@/server/actions/admin-actions";

interface AbsenceSettingsClientProps {
    guildId: string;
}

export function AbsenceSettingsClient({ guildId }: AbsenceSettingsClientProps) {
    const [channelId, setChannelId] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [isConfigured, setIsConfigured] = useState(false);

    useEffect(() => {
        async function loadConfig() {
            const result = await getAbsenceConfig(guildId);
            if (result.success && result.data) {
                setChannelId(result.data.absenceChannelId || "");
                setIsConfigured(!!result.data.absenceChannelId);
            }
            setIsLoading(false);
        }
        loadConfig();
    }, [guildId]);

    const handleSave = () => {
        startTransition(async () => {
            const result = await updateAbsenceChannel(guildId, channelId.trim() || null);
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
            const result = await updateAbsenceChannel(guildId, null);
            if (result.success) {
                setChannelId("");
                setIsConfigured(false);
                toast.success("Notifications d'absence désactivées");
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
        <div className="p-6 max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href={`/dashboard/${guildId}/admin`} className="p-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-white">Notifications d'Absence</h1>
                    <p className="text-zinc-400 text-sm">Configurez le salon Discord pour les notifications de mode vacances</p>
                </div>
            </div>

            <Card className="bg-zinc-900/60 border-white/10">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Hash className="w-5 h-5 text-cyan-400" />
                                Salon Discord
                            </CardTitle>
                            <CardDescription>L'ID du salon où seront envoyées les notifications</CardDescription>
                        </div>
                        {isConfigured ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                                Configuré
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                                <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                                Non configuré
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="channelId">ID du Salon</Label>
                        <Input
                            id="channelId"
                            value={channelId}
                            onChange={(e) => setChannelId(e.target.value)}
                            placeholder="Ex: 1357151089043964124"
                            className="bg-black/30 border-white/10 font-mono"
                        />
                        <p className="text-xs text-zinc-500">Clic droit sur le salon → Copier l'identifiant</p>
                    </div>

                    <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <div className="flex gap-3">
                            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                            <div className="space-y-2 text-sm text-blue-200">
                                <p className="font-medium">Permissions requises</p>
                                <ul className="list-disc list-inside text-blue-300/80 space-y-1">
                                    <li><strong>Envoyer des messages</strong></li>
                                    <li><strong>Intégrer des liens</strong></li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button onClick={handleSave} disabled={isPending} className="flex-1">
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Sauvegarder
                        </Button>
                        {isConfigured && (
                            <Button variant="outline" onClick={handleClear} disabled={isPending} className="border-white/10 text-zinc-400 hover:text-white">
                                Désactiver
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-zinc-900/60 border-white/10">
                <CardHeader>
                    <CardTitle className="text-lg">Aperçu de l'embed</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="bg-[#2f3136] rounded-lg p-4 border-l-4 border-cyan-400">
                        <h4 className="font-semibold text-white text-sm">🏝️ Notification d'absence</h4>
                        <p className="text-[#dcddde] text-sm mt-1">
                            <span className="text-cyan-400 font-medium">Pseudo</span> sera absent(e).
                        </p>
                        <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                            <div>
                                <div className="text-[#b9bbbe] font-medium">📅 Début</div>
                                <div className="text-[#dcddde]">lundi 6 janvier 2026</div>
                            </div>
                            <div>
                                <div className="text-[#b9bbbe] font-medium">📅 Retour</div>
                                <div className="text-[#dcddde]">Pas de date prévue</div>
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-zinc-500 mt-3">Le pseudo est cliquable et redirige vers le profil.</p>
                </CardContent>
            </Card>
        </div>
    );
}
