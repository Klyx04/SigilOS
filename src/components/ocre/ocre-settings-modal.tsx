"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Settings2, Save, Loader2, Info, ArrowRightLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { updateOcreSettingsAction } from "@/server/actions/ocre-actions";
import type { OcreProgressData } from "@/server/actions/ocre-actions";

interface OcreSettingsModalProps {
    data: OcreProgressData;
    guildId: string;
    trigger?: React.ReactNode;
}

export function OcreSettingsModal({ data, guildId, trigger }: OcreSettingsModalProps) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Form state
    const [settings, setSettings] = useState({
        parallel_quests: data.questInfo.parallelQuests || 1,
        trade_mode: data.questInfo.trade_mode ?? 1, // 0: Manual, 1: Automatic
        trade_offer_threshold: data.questInfo.trade_offer_threshold ?? 0,
        trade_want_threshold: data.questInfo.trade_want_threshold ?? 0,
        show_trades: data.questInfo.show_trades ?? true,
    });

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const result = await updateOcreSettingsAction({
                guildId,
                settings: {
                    ...settings,
                    // Ensure numbers are numbers
                    parallel_quests: Number(settings.parallel_quests),
                    trade_offer_threshold: settings.trade_offer_threshold === null ? null : Number(settings.trade_offer_threshold),
                    trade_want_threshold: settings.trade_want_threshold === null ? null : Number(settings.trade_want_threshold),
                }
            });

            if (result.success) {
                toast.success("Paramètres mis à jour avec succès !");
                setOpen(false);
                // Force reload to update stats (especially if parallel_quests changed)
                window.location.reload();
            } else {
                toast.error(result.error || "Une erreur est survenue");
            }
        } catch (error) {
            toast.error("Erreur lors de la sauvegarde");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {trigger ? (
                <div onClick={() => setOpen(true)}>{trigger}</div>
            ) : (
                <Button
                    variant="outline"
                    size="sm"
                    className="h-10 px-4 rounded-xl border-dashed border-border hover:border-amber-500/50 hover:bg-amber-500/5 transition-all group"
                    onClick={() => setOpen(true)}
                >
                    <Settings2 className="h-4 w-4 mr-2 text-muted-foreground group-hover:text-amber-500 transition-colors" />
                    <span className="text-xs font-semibold">Réglages Expert</span>
                </Button>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-lg overflow-hidden p-0 rounded-3xl border-border bg-zinc-950/98 backdrop-blur-2xl  border-white/10">
                    <div className="relative p-8 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent border-b border-white/5">
                        <DialogHeader>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                                    <Settings2 className="h-5 w-5 text-amber-500" />
                                </div>
                                <div>
                                    <DialogTitle className="text-xl font-bold">Réglages Metamob</DialogTitle>
                                    <DialogDescription className="text-xs">
                                        Configurez comment SigilOS et Metamob gèrent vos échanges.
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                    </div>

                    <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto no-scrollbar">
                        {/* Section: Base Info */}
                        <div className="space-y-4">
                            <h4 className="text-caption uppercase tracking-widest font-black text-muted-foreground/50 flex items-center gap-2">
                                <Info className="h-3 w-3" />
                                Configuration Générale
                            </h4>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="parallel_quests" className="text-xs font-bold">Quêtes en parallèle</Label>
                                    <Select 
                                        value={settings.parallel_quests.toString()} 
                                        onValueChange={(v) => setSettings(s => ({ ...s, parallel_quests: parseInt(v) }))}
                                    >
                                        <SelectTrigger id="parallel_quests" className="h-10 rounded-xl bg-background/50 border-border">
                                            <SelectValue placeholder="Nombre de quêtes" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[1, 2, 3, 4, 5, 10].map(n => (
                                                <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-caption text-muted-foreground leading-tight">
                                        Nombre de Dofus Ocre que vous faites en même temps (détermine vos doublons).
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="trade_mode" className="text-xs font-bold">Mode d&apos;échange</Label>
                                    <Select 
                                        value={settings.trade_mode.toString()} 
                                        onValueChange={(v) => setSettings(s => ({ ...s, trade_mode: parseInt(v) }))}
                                    >
                                        <SelectTrigger id="trade_mode" className="h-10 rounded-xl bg-background/50 border-border">
                                            <SelectValue placeholder="Mode" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1">Automatique</SelectItem>
                                            <SelectItem value="0">Manuel</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-caption text-muted-foreground leading-tight">
                                        <b>Auto</b> : Metamob calcule vos offres/recherches selon vos quantités.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Section: Thresholds */}
                        <div className="space-y-4">
                            <h4 className="text-caption uppercase tracking-widest font-black text-muted-foreground/50 flex items-center gap-2">
                                <ArrowRightLeft className="h-3 w-3" />
                                Seuils de calcul automatique
                            </h4>

                            <div className="p-4 rounded-2xl bg-zinc-900/50 border border-white/5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-xs font-bold">Seuil d&apos;offre</Label>
                                        <p className="text-caption text-muted-foreground">Quantité à partir de laquelle vous proposez en échange.</p>
                                    </div>
                                    <Input 
                                        type="number" 
                                        className="w-20 h-9 rounded-lg text-center font-bold"
                                        value={settings.trade_offer_threshold ?? 0}
                                        onChange={(e) => setSettings(s => ({ ...s, trade_offer_threshold: parseInt(e.target.value) || 0 }))}
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-xs font-bold">Seuil de recherche</Label>
                                        <p className="text-caption text-muted-foreground">Quantité en dessous de laquelle vous recherchez le monstre.</p>
                                    </div>
                                    <Input 
                                        type="number" 
                                        className="w-20 h-9 rounded-lg text-center font-bold"
                                        value={settings.trade_want_threshold ?? 0}
                                        onChange={(e) => setSettings(s => ({ ...s, trade_want_threshold: parseInt(e.target.value) || 0 }))}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section: Visibility */}
                        <div className="space-y-4">
                            <h4 className="text-caption uppercase tracking-widest font-black text-muted-foreground/50 flex items-center gap-2">
                                <ShieldCheck className="h-3 w-3" />
                                Visibilité & Vie Privée
                            </h4>

                            <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/50 border border-white/5">
                                <div className="space-y-0.5">
                                    <Label className="text-xs font-bold">Afficher mes échanges sur Metamob</Label>
                                    <p className="text-caption text-muted-foreground">Si désactivé, vous n&apos;apparaîtrez pas dans les recherches publiques.</p>
                                </div>
                                <Switch 
                                    checked={settings.show_trades}
                                    onCheckedChange={(v) => setSettings(s => ({ ...s, show_trades: v }))}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-zinc-900/80 border-t border-white/10 flex items-center justify-between gap-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => setOpen(false)}
                            disabled={isLoading}
                        >
                            Annuler
                        </Button>
                        <Button
                            size="sm"
                            className="rounded-xl px-6 h-10 font-bold gap-2 bg-amber-500 hover:bg-amber-400 text-white shadow-lg shadow-amber-500/20 transition-all active:scale-95"
                            onClick={handleSave}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            Sauvegarder
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
