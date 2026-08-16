"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Hash, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getLoansConfig, updateLoansChannel, getVaultConfig, updateVaultChannel, getServicesStatusConfig, updateServicesStatusConfig } from "@/server/actions/admin-actions";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ChannelPreview } from "@/components/shared/ChannelPreview";

interface LoansSettingsClientProps {
    guildId: string;
}

export function LoansSettingsClient({ guildId }: LoansSettingsClientProps) {
    const [channelId, setChannelId] = useState<string>("");
    const [vaultChannelId, setVaultChannelId] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [isConfigured, setIsConfigured] = useState(false);
    const [vaultIsConfigured, setVaultIsConfigured] = useState(false);

    // Maintenance States
    const [marketplaceEnabled, setMarketplaceEnabled] = useState(true);
    const [marketplaceMessage, setMarketplaceMessage] = useState("");
    const [loansEnabled, setLoansEnabled] = useState(true);
    const [loansMessage, setLoansMessage] = useState("");
    const [vaultEnabled, setVaultEnabled] = useState(true);
    const [vaultMessage, setVaultMessage] = useState("");

    useEffect(() => {
        async function loadConfig() {
            const [loansRes, vaultRes, servicesRes] = await Promise.all([
                getLoansConfig(guildId),
                getVaultConfig(guildId),
                getServicesStatusConfig(guildId)
            ]);

            if (loansRes.success && loansRes.data) {
                setChannelId(loansRes.data.loansNotifyChannelId || "");
                setIsConfigured(!!loansRes.data.loansNotifyChannelId);
            }

            if (vaultRes.success && vaultRes.data) {
                setVaultChannelId(vaultRes.data.vaultNotifyChannelId || "");
                setVaultIsConfigured(!!vaultRes.data.vaultNotifyChannelId);
            }

            if (servicesRes.success && servicesRes.data) {
                setMarketplaceEnabled(servicesRes.data.serviceMarketplaceEnabled);
                setMarketplaceMessage(servicesRes.data.serviceMarketplaceMessage || "");
                setLoansEnabled(servicesRes.data.serviceLoansEnabled);
                setLoansMessage(servicesRes.data.serviceLoansMessage || "");
                setVaultEnabled(servicesRes.data.serviceVaultEnabled);
                setVaultMessage(servicesRes.data.serviceVaultMessage || "");
            }

            setIsLoading(false);
        }
        loadConfig();
    }, [guildId]);

    const handleSaveChannel = () => {
        startTransition(async () => {
            const result = await updateLoansChannel(guildId, channelId.trim() || null);
            if (result.success) {
                toast.success("Salon des prêts configuré !");
                setIsConfigured(!!channelId.trim());
            } else {
                toast.error(result.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    const handleSaveVaultChannel = () => {
        startTransition(async () => {
            const result = await updateVaultChannel(guildId, vaultChannelId.trim() || null);
            if (result.success) {
                toast.success("Salon du coffre configuré !");
                setVaultIsConfigured(!!vaultChannelId.trim());
            } else {
                toast.error(result.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    const handleSaveMaintenance = () => {
        startTransition(async () => {
            const result = await updateServicesStatusConfig(guildId, {
                serviceMarketplaceEnabled: marketplaceEnabled,
                serviceMarketplaceMessage: marketplaceMessage.trim() || null,
                serviceLoansEnabled: loansEnabled,
                serviceLoansMessage: loansMessage.trim() || null,
                serviceVaultEnabled: vaultEnabled,
                serviceVaultMessage: vaultMessage.trim() || null,
            });

            if (result.success) {
                toast.success("Statuts des services mis à jour !");
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
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 bg-zinc-900/60 border-white/5">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <span className="bg-emerald-500/20 text-emerald-400 p-2 rounded-lg">
                                    <Hash className="w-4 h-4" />
                                </span>
                                Salon des prêts
                            </CardTitle>
                            {isConfigured ? (
                                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Actif</Badge>
                            ) : (
                                <Badge variant="outline" className="text-zinc-500">Inactif</Badge>
                            )}
                        </div>
                        <CardDescription>
                            Quand un prêt est créé/rendu, le bot postera un message récapitulatif dans ce salon.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <p className="text-xs text-zinc-500">
                                Mode développeur Discord → Clic droit sur le salon → <span className="text-zinc-300">Copier l'identifiant</span>
                            </p>
                            <div className="flex gap-2">
                                <Input
                                    value={channelId}
                                    onChange={(e) => setChannelId(e.target.value)}
                                    placeholder="Ex: 123456789012345678"
                                    className="font-mono bg-black/20 border-white/10"
                                />
                                <Button onClick={handleSaveChannel} disabled={isPending} className="min-w-[120px] bg-emerald-600 hover:bg-emerald-500">
                                    {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                    Sauvegarder
                                </Button>
                            </div>
                            <ChannelPreview guildId={guildId} channelId={channelId} color="emerald" />
                            {isConfigured && (
                                <div className="flex justify-end">
                                    <Button
                                        variant="ghost" size="sm"
                                        onClick={() => { setChannelId(""); handleSaveChannel(); }}
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

                {/* Salon du coffre (séparé) */}
                <Card className="lg:col-span-2 bg-zinc-900/60 border-white/5">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <span className="bg-teal-500/20 text-teal-400 p-2 rounded-lg">
                                    <Hash className="w-4 h-4" />
                                </span>
                                Salon du coffre
                            </CardTitle>
                            {vaultIsConfigured ? (
                                <Badge className="bg-teal-500/10 text-teal-400 border-teal-500/20">Actif</Badge>
                            ) : (
                                <Badge variant="outline" className="text-zinc-500">Inactif</Badge>
                            )}
                        </div>
                        <CardDescription>
                            Quand un mouvement de coffre est enregistré, le bot postera un message récapitulatif dans ce salon.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <p className="text-xs text-zinc-500">
                                Mode développeur Discord → Clic droit sur le salon → <span className="text-zinc-300">Copier l'identifiant</span>
                            </p>
                            <div className="flex gap-2">
                                <Input
                                    value={vaultChannelId}
                                    onChange={(e) => setVaultChannelId(e.target.value)}
                                    placeholder="Ex: 123456789012345678"
                                    className="font-mono bg-black/20 border-white/10"
                                />
                                <Button onClick={handleSaveVaultChannel} disabled={isPending} className="min-w-[120px] bg-teal-600 hover:bg-teal-500">
                                    {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                    Sauvegarder
                                </Button>
                            </div>
                            <ChannelPreview guildId={guildId} channelId={vaultChannelId} color="emerald" />
                            {vaultIsConfigured && (
                                <div className="flex justify-end">
                                    <Button
                                        variant="ghost" size="sm"
                                        onClick={() => { setVaultChannelId(""); handleSaveVaultChannel(); }}
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
            </div>

            <Card className="bg-zinc-900/60 border-white/5 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4">
                    <Button onClick={handleSaveMaintenance} disabled={isPending} className="bg-emerald-600 hover:bg-emerald-500">
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Enregistrer les statuts
                    </Button>
                </div>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        Maintenance & Accès aux Services
                    </CardTitle>
                    <CardDescription>
                        Désactivez temporairement des onglets spécifiques et affichez un message personnalisé aux membres.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Marketplace */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-bold">Services (Marketplace)</Label>
                                    <p className="text-caption text-zinc-500 uppercase tracking-widest">Onglet principal</p>
                                </div>
                                <Switch
                                    checked={marketplaceEnabled}
                                    onCheckedChange={setMarketplaceEnabled}
                                />
                            </div>
                            {!marketplaceEnabled && (
                                <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                                    <Label className="text-caption text-zinc-400 font-black uppercase tracking-widest">Message d'indisponibilité</Label>
                                    <Textarea
                                        value={marketplaceMessage}
                                        onChange={(e) => setMarketplaceMessage(e.target.value)}
                                        placeholder="Ex: Le marketplace est en maintenance..."
                                        className="h-20 bg-black/40 border-white/10 text-xs resize-none"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Loans */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-bold">Prêts</Label>
                                    <p className="text-caption text-zinc-500 uppercase tracking-widest">Emprunts & Retours</p>
                                </div>
                                <Switch
                                    checked={loansEnabled}
                                    onCheckedChange={setLoansEnabled}
                                />
                            </div>
                            {!loansEnabled && (
                                <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                                    <Label className="text-caption text-zinc-400 font-black uppercase tracking-widest">Message d'indisponibilité</Label>
                                    <Textarea
                                        value={loansMessage}
                                        onChange={(e) => setLoansMessage(e.target.value)}
                                        placeholder="Ex: Les prêts sont suspendus pour inventaire..."
                                        className="h-20 bg-black/40 border-white/10 text-xs resize-none"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Vault */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-bold">Coffre</Label>
                                    <p className="text-caption text-zinc-500 uppercase tracking-widest">Historique & Trésorerie</p>
                                </div>
                                <Switch
                                    checked={vaultEnabled}
                                    onCheckedChange={setVaultEnabled}
                                />
                            </div>
                            {!vaultEnabled && (
                                <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                                    <Label className="text-caption text-zinc-400 font-black uppercase tracking-widest">Message d'indisponibilité</Label>
                                    <Textarea
                                        value={vaultMessage}
                                        onChange={(e) => setVaultMessage(e.target.value)}
                                        placeholder="Ex: Le coffre est inaccessible suite à une réorganisation..."
                                        className="h-20 bg-black/40 border-white/10 text-xs resize-none"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}