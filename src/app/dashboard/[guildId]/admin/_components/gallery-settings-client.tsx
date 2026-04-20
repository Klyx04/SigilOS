"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Image as ImageIcon, Sword, Info, Sparkles, Layout, Hash } from "lucide-react";
import { toast } from "sonner";
import { getGalleryConfig, updateGallerySettings } from "@/server/actions/admin-actions";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface GallerySettingsClientProps {
    guildId: string;
}

export function GallerySettingsClient({ guildId }: GallerySettingsClientProps) {
    const [config, setConfig] = useState<{ skinGalleryChannelId: string | null; stuffGalleryChannelId: string | null } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        async function loadData() {
            const configRes = await getGalleryConfig(guildId);

            if (configRes.success && configRes.data) {
                setConfig(configRes.data);
            }

            setIsLoading(false);
        }
        loadData();
    }, [guildId]);

    const handleSave = () => {
        if (!config) return;

        startTransition(async () => {
            const result = await updateGallerySettings(guildId, {
                skinGalleryChannelId: config.skinGalleryChannelId,
                stuffGalleryChannelId: config.stuffGalleryChannelId,
            });

            if (result.success) {
                toast.success("Paramètres de la galerie mis à jour !");
            } else {
                toast.error(result.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[300px]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500/50" />
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-5xl mx-auto pb-8">
            <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-600 mb-4 pl-1 flex items-center gap-2">
                    <Layout className="w-3.5 h-3.5" />
                    Configuration des Partages Discord
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* SECTION: SKINS */}
                    <Card className="bg-zinc-900/60 border-white/5 overflow-hidden group relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        <CardHeader>
                            <CardTitle className="text-sm font-black text-white flex items-center gap-2">
                                <ImageIcon className="w-4 h-4 text-pink-400" />
                                Galerie de Skins
                            </CardTitle>
                            <CardDescription className="text-[10px] text-zinc-500">
                                Salon où les membres peuvent partager leurs apparences.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black text-zinc-500 ml-1">ID du Salon Skins</Label>
                                <div className="relative group/input">
                                    <Input
                                        placeholder="ID du salon (ex: 123...)"
                                        value={config?.skinGalleryChannelId || ""}
                                        onChange={(e) => setConfig(prev => prev ? { ...prev, skinGalleryChannelId: e.target.value || null } : null)}
                                        className="bg-zinc-950/50 border-white/5 h-11 pl-10 focus:border-pink-500/50 transition-colors"
                                    />
                                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-hover/input:text-pink-500/50 transition-colors" />
                                </div>
                            </div>
                            <div className="p-3 rounded-xl bg-pink-500/5 border border-pink-500/10 flex items-start gap-3">
                                <Info className="w-3 h-3 text-pink-400 mt-0.5 shrink-0" />
                                <p className="text-[10px] text-zinc-400 leading-relaxed italic">
                                    Si l&apos;ID correspond à un <strong>Forum</strong>, SigilOS créera automatiquement un nouveau fil pour chaque partage.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* SECTION: STUFFS */}
                    <Card className="bg-zinc-900/60 border-white/5 overflow-hidden group relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        <CardHeader>
                            <CardTitle className="text-sm font-black text-white flex items-center gap-2">
                                <Sword className="w-4 h-4 text-emerald-400" />
                                Galerie de Stuffs
                            </CardTitle>
                            <CardDescription className="text-[10px] text-zinc-500">
                                Salon où les membres peuvent partager leurs équipements.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black text-zinc-500 ml-1">ID du Salon Stuffs</Label>
                                <div className="relative group/input">
                                    <Input
                                        placeholder="ID du salon (ex: 123...)"
                                        value={config?.stuffGalleryChannelId || ""}
                                        onChange={(e) => setConfig(prev => prev ? { ...prev, stuffGalleryChannelId: e.target.value || null } : null)}
                                        className="bg-zinc-950/50 border-white/5 h-11 pl-10 focus:border-emerald-500/50 transition-colors"
                                    />
                                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-hover/input:text-emerald-500/50 transition-colors" />
                                </div>
                            </div>
                            <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-start gap-3">
                                <Info className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                                <p className="text-[10px] text-zinc-400 leading-relaxed italic">
                                    Compatible avec les salons textuels classiques et les forums Discord.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* ACTION FOOTER */}
            <div className="sticky bottom-0 z-30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-900/90 backdrop-blur-md border border-white/10 shadow-2xl">
                <div className="flex items-start gap-4 max-w-md hidden sm:flex">
                    <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-relaxed font-medium">
                        Une fois configurés, un bouton de partage apparaîtra sur les profils des membres disposant de l&apos;accès à la galerie.
                    </p>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={isPending}
                    className={cn(
                        "w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-black px-8 h-12 shadow-lg shadow-indigo-900/20 rounded-xl transition-all",
                        "hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                    )}
                >
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    SAUVEGARDER LA CONFIGURATION
                </Button>
            </div>
        </div>
    );
}
