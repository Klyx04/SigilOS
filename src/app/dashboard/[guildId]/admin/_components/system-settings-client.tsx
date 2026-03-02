"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, AlertTriangle, Hash, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { getSystemAnnouncementSettings } from "@/server/actions/system-settings-actions";
import { saveSystemAnnouncementSettings } from "@/server/actions/announcement-actions";

interface SystemSettingsClientProps {
    guildId: string;
}

export function SystemSettingsClient({ guildId }: SystemSettingsClientProps) {
    const [channelId, setChannelId] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [isConfigured, setIsConfigured] = useState(false);

    useEffect(() => {
        async function loadConfig() {
            const result = await getSystemAnnouncementSettings(guildId);
            if (result.success && result.data) {
                setChannelId(result.data.systemNotifyChannelId || "");
                setIsConfigured(!!result.data.systemNotifyChannelId);
            }
            setIsLoading(false);
        }
        loadConfig();
    }, [guildId]);

    const handleSave = () => {
        startTransition(async () => {
            const result = await saveSystemAnnouncementSettings(guildId, channelId.trim() || null);
            if (result.success) {
                toast.success("Paramètres des annonces SigilOS enregistrés !");
                setIsConfigured(!!channelId.trim());
            } else {
                toast.error(result.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[200px]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <Card className="bg-zinc-900/60 border-white/5 overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                    <Megaphone className="w-32 h-32 text-indigo-500 rotate-12" />
                </div>

                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <span className="bg-indigo-500/20 text-indigo-400 p-2 rounded-lg">
                                <Megaphone className="w-5 h-5" />
                            </span>
                            Annonces de la Plateforme (SigilOS)
                        </CardTitle>
                        {isConfigured ? (
                            <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 px-2 py-0.5 text-[10px] uppercase font-black tracking-widest">
                                Configuré
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="text-zinc-600 px-2 py-0.5 text-[10px] uppercase font-black tracking-widest border-white/5">
                                Par Défaut
                            </Badge>
                        )}
                    </div>
                    <CardDescription className="max-w-2xl">
                        Définissez où vous souhaitez recevoir les annonces importantes de SigilOS (mises à jour, maintenances, actus plateforme).
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6 relative">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-zinc-400 flex items-center gap-2 font-bold uppercase tracking-tight text-[11px]">
                                <Hash className="w-3.5 h-3.5 text-indigo-400" />
                                Salon pour les annonces SigilOS
                            </Label>
                        </div>
                        <Input
                            value={channelId}
                            onChange={(e) => setChannelId(e.target.value)}
                            placeholder="ID du salon Discord (laisser vide pour le premier salon dispo)"
                            className="font-mono bg-black/40 border-white/5 focus:border-indigo-500/50 transition-all h-11"
                        />
                        <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-4 flex gap-3">
                            <AlertTriangle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-xs text-indigo-200/90 leading-tight font-medium">
                                    Si laissé vide, SigilOS utilisera le premier salon de notifications trouvé (Missions, Songes, etc.).
                                </p>
                                <p className="text-[10px] text-zinc-500 italic">
                                    Il est recommandé de créer un salon dédié aux annonces automatiques pour ne pas polluer vos salons de jeu.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 flex items-center justify-end border-t border-white/5">
                        <Button
                            onClick={handleSave}
                            disabled={isPending}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white min-w-[160px] font-bold shadow-lg shadow-indigo-600/20"
                        >
                            {isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                                <Save className="w-4 h-4 mr-2" />
                            )}
                            Enregistrer
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Help Card */}
            <Card className="bg-zinc-950/40 border-white/5 border-dashed">
                <CardContent className="p-4 flex gap-3">
                    <div className="p-2 bg-white/5 rounded-lg shrink-0 h-fit">
                        <Hash className="w-4 h-4 text-zinc-500" />
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-zinc-300">Comment copier l'ID ?</h4>
                        <p className="text-xs text-zinc-500 leading-relaxed">
                            Activez le <strong>Mode Développeur</strong> dans vos paramètres Discord (Apparence {'>'} Avancé).
                            Ensuite, faites un clic droit sur votre salon et sélectionnez <strong>"Copier l'identifiant"</strong>.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
