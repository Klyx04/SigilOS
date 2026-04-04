"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Settings, Shield, Save, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { updatePlatformConfig, testStatusPing } from "@/server/actions/changelog-actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { diagnoseDiscordConnectivity } from "@/server/actions/god-discord-actions";
import { Activity, ClipboardList, ShieldCheck, AlertCircle } from "lucide-react";

interface PlatformConfigPanelProps {
    config: {
        id: string;
        hubChannelId: string | null;
        serviceStatusChannelId: string | null;
        godNotifyChannelId: string | null;
        godNotifyRoleId: string | null;
        godNotifyWebEnabled: boolean;
        ticketAutoRoleId: string | null;
        ticketSupportGuildId: string | null;
        statusIsLite: boolean;
        statusMode: string;
        statusMention: string;
        statusFrequency: number;
        nsfwFilterEnabled: boolean;
    } | null;
    availableGuilds: { id: string, name: string }[];
    availableRoles: { id: string, name: string }[];
}

export function PlatformConfigPanel({ config, availableGuilds, availableRoles }: PlatformConfigPanelProps) {
    const [isPending, startTransition] = useTransition();
    const [formData, setFormData] = useState({
        hubChannelId: config?.hubChannelId || "",
        serviceStatusChannelId: config?.serviceStatusChannelId || "",
        godNotifyChannelId: config?.godNotifyChannelId || "",
        godNotifyRoleId: config?.godNotifyRoleId || "",
        godNotifyWebEnabled: config?.godNotifyWebEnabled !== undefined ? config?.godNotifyWebEnabled : true,
        ticketAutoRoleId: config?.ticketAutoRoleId || "",
        ticketSupportGuildId: config?.ticketSupportGuildId || "",
        statusIsLite: config?.statusIsLite || false,
        statusMode: config?.statusMode || "living",
        statusMention: config?.statusMention || "none",
        statusFrequency: config?.statusFrequency || 15,
        nsfwFilterEnabled: config?.nsfwFilterEnabled !== undefined ? config?.nsfwFilterEnabled : true
    });

    const [diagResults, setDiagResults] = useState<any>(null);
    const [isDiagPending, setIsDiagPending] = useState(false);

    const handleSave = () => {
        startTransition(async () => {
            const res = await updatePlatformConfig(formData);
            if (res.success) {
                toast.success("Configuration sauvegardée !");
            } else {
                toast.error(res.error || "Erreur de sauvegarde");
            }
        });
    };

    const handleTestPing = () => {
        startTransition(async () => {
            toast.promise(testStatusPing(formData.serviceStatusChannelId), {
                loading: "Envoi du ping de service...",
                success: (res) => {
                    if (res.success) return `Ping réussi ! (${res.action})`;
                    throw new Error(res.error);
                },
                error: (err) => `Erreur : ${err.message}`
            });
        });
    };

    const handleDiagnose = async () => {
        setIsDiagPending(true);
        try {
            const res = await diagnoseDiscordConnectivity();
            if (res.success) {
                setDiagResults(res.results);
                toast.success("Diagnostic terminé !");
            } else {
                toast.error(res.error || "Échec du diagnostic");
            }
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setIsDiagPending(false);
        }
    };

    return (
        <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-8 backdrop-blur-xl shadow-2xl space-y-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[60px] -translate-y-1/2 translate-x-1/2" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-4 md:pb-0">
                <h3 className="text-[11px] sm:text-sm font-black text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-3 min-w-0">
                    <Settings className="w-5 h-5 text-indigo-400 shrink-0" />
                    <span className="truncate">SigilOS Platform Configuration</span>
                </h3>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <button
                        onClick={handleDiagnose}
                        disabled={isDiagPending}
                        className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all"
                    >
                        {isDiagPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardList className="w-3.5 h-3.5" />}
                        <span className="truncate">Diagnostic</span>
                    </button>
                    <button
                        onClick={handleTestPing}
                        disabled={isPending || !formData.serviceStatusChannelId}
                        className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 disabled:opacity-50 text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all"
                    >
                        <Activity className="w-3.5 h-3.5" />
                        <span className="truncate">Ping</span>
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isPending}
                        className="w-full sm:w-auto px-4 py-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-black text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all"
                    >
                        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Sauvegarder
                    </button>
                </div>
            </div>

            {/* Diagnostic Results Display */}
            {diagResults && (
                <div className="p-4 bg-zinc-950/80 border border-indigo-500/20 rounded-2xl animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-3 mb-4">
                        <ShieldCheck className="w-5 h-5 text-indigo-400" />
                        <h4 className="text-xs font-black text-white uppercase tracking-widest">Rapport de Diagnostic Bot</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-1">
                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Authentification</span>
                            <div className={cn(
                                "flex items-center gap-2 text-[10px] font-bold",
                                diagResults.token.status === "OK" ? "text-emerald-400" : "text-rose-400"
                            )}>
                                {diagResults.token.status === "OK" ? <ShieldCheck className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                {diagResults.token.message}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Identité Bot</span>
                            <div className="text-[10px] font-bold text-zinc-300">
                                {diagResults.botIdentity ? `${diagResults.botIdentity.username} (${diagResults.botIdentity.id})` : "N/A"}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Serveurs Bot</span>
                            <div className="text-[10px] font-bold text-zinc-300">
                                {diagResults.guilds.length} serveurs actifs
                            </div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Accès Salons</span>
                            <div className="flex flex-col gap-0.5">
                                {Object.entries(diagResults.channels).map(([key, res]: any) => (
                                    <div key={key} className={cn(
                                        "text-[9px] font-bold flex items-center gap-1",
                                        res.status === "OK" ? "text-indigo-400" : "text-zinc-500"
                                    )}>
                                        <span className="capitalize">{key}:</span> {res.message}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Main Configuration Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                
                {/* 1. DISCORD CHANNELS & CORE */}
                <div className="space-y-6 flex flex-col h-full">
                    <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                            <Shield className="w-4 h-4 text-indigo-400" />
                        </div>
                        <h4 className="text-xs font-black text-white uppercase tracking-widest">Connectivité Discord</h4>
                    </div>

                    <div className="space-y-4 flex-1">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Salon HUB (Annonces)</label>
                            <input 
                                type="text"
                                value={formData.hubChannelId}
                                onChange={(e) => setFormData(prev => ({ ...prev, hubChannelId: e.target.value }))}
                                placeholder="ID du salon..."
                                className="w-full px-4 py-2.5 bg-zinc-950/50 border border-white/5 rounded-xl text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Statut Service (Logs Hub)</label>
                            <input 
                                type="text"
                                value={formData.serviceStatusChannelId}
                                onChange={(e) => setFormData(prev => ({ ...prev, serviceStatusChannelId: e.target.value }))}
                                placeholder="ID du salon..."
                                className="w-full px-4 py-2.5 bg-zinc-950/50 border border-white/5 rounded-xl text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Ping</label>
                                <Select 
                                    value={formData.statusMention} 
                                    onValueChange={(val) => setFormData(prev => ({ ...prev, statusMention: val }))}
                                >
                                    <SelectTrigger className="bg-zinc-950/50 border-white/5 rounded-xl text-zinc-400 h-10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent side="top">
                                        <SelectItem value="none">😶 Aucune</SelectItem>
                                        <SelectItem value="@here">@here</SelectItem>
                                        <SelectItem value="@everyone">@everyone</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Cycles</label>
                                <Select 
                                    value={String(formData.statusFrequency)} 
                                    onValueChange={(val) => setFormData(prev => ({ ...prev, statusFrequency: parseInt(val) }))}
                                >
                                    <SelectTrigger className="bg-zinc-950/50 border-white/5 rounded-xl text-zinc-400 h-10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent side="top">
                                        <SelectItem value="5">5m</SelectItem>
                                        <SelectItem value="15">15m</SelectItem>
                                        <SelectItem value="60">1h</SelectItem>
                                        <SelectItem value="1440">24h</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. SECURITY & NOTIFICATIONS */}
                <div className="space-y-6 flex flex-col h-full">
                    <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                        <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                            <Activity className="w-4 h-4 text-rose-400" />
                        </div>
                        <h4 className="text-xs font-black text-white uppercase tracking-widest">Alerte & Sécurité</h4>
                    </div>

                    <div className="space-y-4 flex-1">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Canal Alertes God</label>
                            <input 
                                type="text"
                                value={formData.godNotifyChannelId}
                                onChange={(e) => setFormData(prev => ({ ...prev, godNotifyChannelId: e.target.value }))}
                                placeholder="ID du salon..."
                                className="w-full px-4 py-2.5 bg-zinc-950/50 border border-white/5 rounded-xl text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono"
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-white/5 border border-white/5 rounded-2xl flex flex-col justify-between gap-2">
                                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Filtre IA NSFW</span>
                                <button 
                                    onClick={() => setFormData(prev => ({ ...prev, nsfwFilterEnabled: !prev.nsfwFilterEnabled }))}
                                    className={cn(
                                        "px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-all border",
                                        formData.nsfwFilterEnabled 
                                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                                            : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                                    )}
                                >
                                    {formData.nsfwFilterEnabled ? "Activé" : "Désactivé"}
                                </button>
                            </div>
                            <div className="p-3 bg-white/5 border border-white/5 rounded-2xl flex flex-col justify-between gap-2">
                                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Notifs Web Dashboard</span>
                                <button 
                                    onClick={() => setFormData(prev => ({ ...prev, godNotifyWebEnabled: !prev.godNotifyWebEnabled }))}
                                    className={cn(
                                        "px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-all border",
                                        formData.godNotifyWebEnabled 
                                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                                            : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                                    )}
                                >
                                    {formData.godNotifyWebEnabled ? "Activé" : "Désactivé"}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Rôle Notif (ID)</label>
                            <input 
                                type="text"
                                value={formData.godNotifyRoleId}
                                onChange={(e) => setFormData(prev => ({ ...prev, godNotifyRoleId: e.target.value }))}
                                placeholder="ID du rôle..."
                                className="w-full px-4 py-2.5 bg-zinc-950/50 border border-white/5 rounded-xl text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono"
                            />
                        </div>
                    </div>
                </div>

                {/* 3. LOGISTIQUE & TICKETING */}
                <div className="space-y-6 flex flex-col h-full">
                    <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                            <Settings className="w-4 h-4 text-amber-400" />
                        </div>
                        <h4 className="text-xs font-black text-white uppercase tracking-widest">Logistique & Support</h4>
                    </div>

                    <div className="space-y-4 flex-1">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Serveur Support</label>
                            <Select 
                                value={formData.ticketSupportGuildId || ""} 
                                onValueChange={(val) => setFormData(prev => ({ ...prev, ticketSupportGuildId: val }))}
                            >
                                <SelectTrigger className="bg-zinc-950/50 border-white/5 rounded-xl text-zinc-400 h-10">
                                    <SelectValue placeholder="Choisir..." />
                                </SelectTrigger>
                                <SelectContent side="top">
                                    {availableGuilds.map(g => (
                                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Rôle Auto-Assign (Validation)</label>
                            <Select 
                                value={formData.ticketAutoRoleId || ""} 
                                onValueChange={(val) => setFormData(prev => ({ ...prev, ticketAutoRoleId: val }))}
                                disabled={!formData.ticketSupportGuildId}
                            >
                                <SelectTrigger className="bg-zinc-950/50 border-white/5 rounded-xl text-zinc-400 h-10">
                                    <SelectValue placeholder="Choisir..." />
                                </SelectTrigger>
                                <SelectContent side="top">
                                    <SelectItem value="SKIP">Aucun</SelectItem>
                                    {availableRoles.map(r => (
                                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-3 flex items-start gap-3">
                            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-zinc-500 leading-relaxed font-medium italic">
                                Le rôle auto-assign est donné au créateur du ticket dès la validation manuelle.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
