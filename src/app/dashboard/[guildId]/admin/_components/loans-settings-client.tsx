"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Hash, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { UnsavedChangesGuard, isDirty } from "@/components/ui/unsaved-changes-guard";
import { getLoansConfig, updateLoansChannel, getVaultConfig, updateVaultChannel, getServicesStatusConfig, updateServicesStatusConfig } from "@/server/actions/admin-actions";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { DiscordChannelPicker } from "@/components/shared/DiscordChannelPicker";

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

    // — Détection « modifications non sauvegardées » (snapshot chargé vs état courant)
    const [initialConfig, setInitialConfig] = useState<{
        channelId: string; vaultChannelId: string;
        marketplaceEnabled: boolean; marketplaceMessage: string;
        loansEnabled: boolean; loansMessage: string;
        vaultEnabled: boolean; vaultMessage: string;
    } | null>(null);
    const hasUnsavedChanges = isDirty({
        channelId, vaultChannelId,
        marketplaceEnabled, marketplaceMessage: marketplaceMessage.trim(),
        loansEnabled, loansMessage: loansMessage.trim(),
        vaultEnabled, vaultMessage: vaultMessage.trim(),
    }, initialConfig ? {
        ...initialConfig,
        marketplaceMessage: initialConfig.marketplaceMessage.trim(),
        loansMessage: initialConfig.loansMessage.trim(),
        vaultMessage: initialConfig.vaultMessage.trim(),
    } : null);

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

            setInitialConfig({
                channelId: loansRes.success && loansRes.data ? (loansRes.data.loansNotifyChannelId || "") : "",
                vaultChannelId: vaultRes.success && vaultRes.data ? (vaultRes.data.vaultNotifyChannelId || "") : "",
                marketplaceEnabled: servicesRes.success && servicesRes.data ? servicesRes.data.serviceMarketplaceEnabled : true,
                marketplaceMessage: servicesRes.success && servicesRes.data ? (servicesRes.data.serviceMarketplaceMessage || "") : "",
                loansEnabled: servicesRes.success && servicesRes.data ? servicesRes.data.serviceLoansEnabled : true,
                loansMessage: servicesRes.success && servicesRes.data ? (servicesRes.data.serviceLoansMessage || "") : "",
                vaultEnabled: servicesRes.success && servicesRes.data ? servicesRes.data.serviceVaultEnabled : true,
                vaultMessage: servicesRes.success && servicesRes.data ? (servicesRes.data.serviceVaultMessage || "") : "",
            });

            setIsLoading(false);
        }
        loadConfig();
    }, [guildId]);

    const handleSaveChannel = () => {
        startTransition(async () => {
            const trimmed = channelId.trim();
            const result = await updateLoansChannel(guildId, trimmed || null);
            if (result.success) {
                toast.success("Salon des prêts configuré !");
                setChannelId(trimmed);
                setIsConfigured(!!trimmed);
                setInitialConfig((prev) => prev ? { ...prev, channelId: trimmed } : prev);
            } else {
                toast.error(result.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    const handleSaveVaultChannel = () => {
        startTransition(async () => {
            const trimmed = vaultChannelId.trim();
            const result = await updateVaultChannel(guildId, trimmed || null);
            if (result.success) {
                toast.success("Salon du coffre configuré !");
                setVaultChannelId(trimmed);
                setVaultIsConfigured(!!trimmed);
                setInitialConfig((prev) => prev ? { ...prev, vaultChannelId: trimmed } : prev);
            } else {
                toast.error(result.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    const handleSaveMaintenance = () => {
        startTransition(async () => {
            const maintenance = {
                serviceMarketplaceEnabled: marketplaceEnabled,
                serviceMarketplaceMessage: marketplaceMessage.trim() || null,
                serviceLoansEnabled: loansEnabled,
                serviceLoansMessage: loansMessage.trim() || null,
                serviceVaultEnabled: vaultEnabled,
                serviceVaultMessage: vaultMessage.trim() || null,
            };
            const result = await updateServicesStatusConfig(guildId, maintenance);

            if (result.success) {
                toast.success("Statuts des services mis à jour !");
                setMarketplaceMessage(maintenance.serviceMarketplaceMessage || "");
                setLoansMessage(maintenance.serviceLoansMessage || "");
                setVaultMessage(maintenance.serviceVaultMessage || "");
                setInitialConfig((prev) => prev ? {
                    ...prev,
                    marketplaceEnabled, marketplaceMessage: maintenance.serviceMarketplaceMessage || "",
                    loansEnabled, loansMessage: maintenance.serviceLoansMessage || "",
                    vaultEnabled, vaultMessage: maintenance.serviceVaultMessage || "",
                } : prev);
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
            <UnsavedChangesGuard hasUnsavedChanges={hasUnsavedChanges} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 bg-surface/60 border-border">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <span className="bg-success/20 text-success p-2 rounded-lg">
                                    <Hash className="w-4 h-4" />
                                </span>
                                Salon des prêts
                            </CardTitle>
                            {isConfigured ? (
                                <Badge className="bg-success/10 text-success border-success/20">Actif</Badge>
                            ) : (
                                <Badge variant="outline" className="text-muted-foreground">Inactif</Badge>
                            )}
                        </div>
                        <CardDescription>
                            Quand un prêt est créé/rendu, le bot postera un message récapitulatif dans ce salon.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex gap-2">
                                <div className="flex-1 min-w-0">
                                    <DiscordChannelPicker
                                        guildId={guildId}
                                        value={channelId}
                                        onChange={setChannelId}
                                    />
                                </div>
                                <Button onClick={handleSaveChannel} disabled={isPending} className="min-w-[120px] bg-success hover:bg-success">
                                    {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                    Sauvegarder
                                    {hasUnsavedChanges && !isPending && <span className="ml-2 w-2 h-2 rounded-full bg-white animate-pulse" title="Modifications non sauvegardées" />}
                                </Button>
                            </div>
                            {isConfigured && (
                                <div className="flex justify-end">
                                    <Button
                                        variant="ghost" size="sm"
                                        // Bypass direct (pas handleSaveChannel) : celui-ci lirait
                                        // le state pas encore à jour (closure périmée).
                                        onClick={() => {
                                            setChannelId("");
                                            startTransition(async () => {
                                                const result = await updateLoansChannel(guildId, null);
                                                if (result.success) {
                                                    setIsConfigured(false);
                                                    setInitialConfig((prev) => prev ? { ...prev, channelId: "" } : prev);
                                                    toast.success("Notifications prêts désactivées");
                                                } else {
                                                    toast.error(result.error || "Erreur lors de la désactivation");
                                                }
                                            });
                                        }}
                                        disabled={isPending}
                                        className="text-danger hover:text-danger hover:bg-danger/20 text-xs"
                                    >
                                        Désactiver
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-info/5 border-info/10 h-fit">
                    <CardContent className="p-4 flex gap-3">
                        <div className="p-2 bg-info/20 rounded-lg shrink-0 h-fit">
                            <AlertTriangle className="w-4 h-4 text-info" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="text-sm font-medium text-info">Permissions requises</h4>
                            <p className="text-xs text-info/70 leading-relaxed">
                                Le bot <strong>SigilOS</strong> doit avoir les droits <em>Voir le salon</em> et <em>Envoyer des messages</em> dans le salon cible.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Salon du coffre (séparé) */}
                <Card className="lg:col-span-2 bg-surface/60 border-border">
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
                                <Badge variant="outline" className="text-muted-foreground">Inactif</Badge>
                            )}
                        </div>
                        <CardDescription>
                            Quand un mouvement de coffre est enregistré, le bot postera un message récapitulatif dans ce salon.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex gap-2">
                                <div className="flex-1 min-w-0">
                                    <DiscordChannelPicker
                                        guildId={guildId}
                                        value={vaultChannelId}
                                        onChange={setVaultChannelId}
                                    />
                                </div>
                                <Button onClick={handleSaveVaultChannel} disabled={isPending} className="min-w-[120px] bg-teal-600 hover:bg-teal-500">
                                    {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                    Sauvegarder
                                    {hasUnsavedChanges && !isPending && <span className="ml-2 w-2 h-2 rounded-full bg-white animate-pulse" title="Modifications non sauvegardées" />}
                                </Button>
                            </div>
                            {vaultIsConfigured && (
                                <div className="flex justify-end">
                                    <Button
                                        variant="ghost" size="sm"
                                        // Bypass direct : voir ci-dessus (closure périmée).
                                        onClick={() => {
                                            setVaultChannelId("");
                                            startTransition(async () => {
                                                const result = await updateVaultChannel(guildId, null);
                                                if (result.success) {
                                                    setVaultIsConfigured(false);
                                                    setInitialConfig((prev) => prev ? { ...prev, vaultChannelId: "" } : prev);
                                                    toast.success("Notifications coffre désactivées");
                                                } else {
                                                    toast.error(result.error || "Erreur lors de la désactivation");
                                                }
                                            });
                                        }}
                                        disabled={isPending}
                                        className="text-danger hover:text-danger hover:bg-danger/20 text-xs"
                                    >
                                        Désactiver
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-surface/60 border-border overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4">
                    <Button onClick={handleSaveMaintenance} disabled={isPending} className="bg-success hover:bg-success">
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Enregistrer les statuts
                        {hasUnsavedChanges && !isPending && <span className="ml-2 w-2 h-2 rounded-full bg-white animate-pulse" title="Modifications non sauvegardées" />}
                    </Button>
                </div>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-warning" />
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
                                    <p className="text-caption text-muted-foreground uppercase tracking-widest">Onglet principal</p>
                                </div>
                                <Switch
                                    checked={marketplaceEnabled}
                                    onCheckedChange={setMarketplaceEnabled}
                                />
                            </div>
                            {!marketplaceEnabled && (
                                <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                                    <Label className="text-caption text-muted-foreground font-black uppercase tracking-widest">Message d'indisponibilité</Label>
                                    <Textarea
                                        value={marketplaceMessage}
                                        onChange={(e) => setMarketplaceMessage(e.target.value)}
                                        placeholder="Ex: Le marketplace est en maintenance..."
                                        className="h-20 bg-black/40 border-border text-xs resize-none"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Loans */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-bold">Prêts</Label>
                                    <p className="text-caption text-muted-foreground uppercase tracking-widest">Emprunts & Retours</p>
                                </div>
                                <Switch
                                    checked={loansEnabled}
                                    onCheckedChange={setLoansEnabled}
                                />
                            </div>
                            {!loansEnabled && (
                                <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                                    <Label className="text-caption text-muted-foreground font-black uppercase tracking-widest">Message d'indisponibilité</Label>
                                    <Textarea
                                        value={loansMessage}
                                        onChange={(e) => setLoansMessage(e.target.value)}
                                        placeholder="Ex: Les prêts sont suspendus pour inventaire..."
                                        className="h-20 bg-black/40 border-border text-xs resize-none"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Vault */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-bold">Coffre</Label>
                                    <p className="text-caption text-muted-foreground uppercase tracking-widest">Historique & Trésorerie</p>
                                </div>
                                <Switch
                                    checked={vaultEnabled}
                                    onCheckedChange={setVaultEnabled}
                                />
                            </div>
                            {!vaultEnabled && (
                                <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                                    <Label className="text-caption text-muted-foreground font-black uppercase tracking-widest">Message d'indisponibilité</Label>
                                    <Textarea
                                        value={vaultMessage}
                                        onChange={(e) => setVaultMessage(e.target.value)}
                                        placeholder="Ex: Le coffre est inaccessible suite à une réorganisation..."
                                        className="h-20 bg-black/40 border-border text-xs resize-none"
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