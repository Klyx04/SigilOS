"use client";

import { useState, useTransition } from "react";
import { Settings, Shield, Save, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { updatePlatformConfig, testStatusPing } from "@/server/actions/changelog-actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";

interface PlatformConfigPanelProps {
    config: {
        id: string;
        hubChannelId: string | null;
        serviceStatusChannelId: string | null;
        ticketAutoRoleId: string | null;
        ticketSupportGuildId: string | null;
        statusIsLite: boolean;
        statusMode: string;
        statusMention: string;
        statusFrequency: number;
    } | null;
    availableGuilds: { id: string, name: string }[];
    availableRoles: { id: string, name: string }[];
}

export function PlatformConfigPanel({ config, availableGuilds, availableRoles }: PlatformConfigPanelProps) {
    const [isPending, startTransition] = useTransition();
    const [formData, setFormData] = useState({
        hubChannelId: config?.hubChannelId || "",
        serviceStatusChannelId: config?.serviceStatusChannelId || "",
        ticketAutoRoleId: config?.ticketAutoRoleId || "",
        ticketSupportGuildId: config?.ticketSupportGuildId || "",
        statusIsLite: config?.statusIsLite || false,
        statusMode: config?.statusMode || "living",
        statusMention: config?.statusMention || "none",
        statusFrequency: config?.statusFrequency || 15
    });

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
            toast.promise(testStatusPing(), {
                loading: "Envoi du ping de service...",
                success: (res) => {
                    if (res.success) return `Ping réussi ! (${res.action})`;
                    throw new Error(res.error);
                },
                error: (err) => `Erreur : ${err.message}`
            });
        });
    };

    return (
        <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-8 backdrop-blur-xl shadow-2xl space-y-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[60px] -translate-y-1/2 translate-x-1/2" />
            
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-3">
                    <Settings className="w-5 h-5 text-indigo-400" />
                    SigilOS Platform Configuration
                </h3>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleTestPing}
                        disabled={isPending || !formData.serviceStatusChannelId}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 disabled:opacity-50 text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 transition-all"
                    >
                        <Activity className="w-3.5 h-3.5" />
                        Tester le Ping
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isPending}
                        className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-black text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 transition-all"
                    >
                        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Sauvegarder
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Section Channels */}
                <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5" /> Canaux Officiels
                    </h4>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1.5 block">Canal HUB (Annonces)</label>
                            <input 
                                type="text"
                                value={formData.hubChannelId}
                                onChange={(e) => setFormData(prev => ({ ...prev, hubChannelId: e.target.value }))}
                                placeholder="ID du salon Discord..."
                                className="w-full px-4 py-3 bg-black/40 border border-white/5 rounded-xl text-sm text-zinc-300 focus:outline-none focus:border-indigo-500/30 transition-all font-mono"
                            />
                        </div>
                        <div>
                             <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1.5 block">Statut Service (Logs Hub)</label>
                             <input 
                                 type="text"
                                 value={formData.serviceStatusChannelId}
                                 onChange={(e) => setFormData(prev => ({ ...prev, serviceStatusChannelId: e.target.value }))}
                                 placeholder="ID du salon Discord..."
                                 className="w-full px-4 py-3 bg-black/40 border border-white/5 rounded-xl text-sm text-zinc-300 focus:outline-none focus:border-indigo-500/30 transition-all font-mono"
                             />
                         </div>

                         {/* Status Mode & Lite Toggle */}
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1.5 block">Format d'Affichage</label>
                                <Select 
                                    value={formData.statusIsLite ? "LITE" : "FULL"} 
                                    onValueChange={(val) => setFormData(prev => ({ ...prev, statusIsLite: val === "LITE" }))}
                                >
                                    <SelectTrigger className="bg-black/40 border-white/5 rounded-xl text-zinc-400 h-11">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="FULL">📊 Complet (Technique)</SelectItem>
                                        <SelectItem value="LITE">✨ Lite (Épuré)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1.5 block">Mode de Mise à Jour</label>
                                <Select 
                                    value={formData.statusMode} 
                                    onValueChange={(val) => setFormData(prev => ({ ...prev, statusMode: val }))}
                                >
                                    <SelectTrigger className="bg-black/40 border-white/5 rounded-xl text-zinc-400 h-11">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent side="top">
                                        <SelectItem value="living">♻️ Living Status (Edit msg)</SelectItem>
                                        <SelectItem value="notification">🔔 Notification (New msg)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                         </div>

                         {/* Mention & Frequency */}
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1.5 block">Mention Notification</label>
                                <Select 
                                    value={formData.statusMention} 
                                    onValueChange={(val) => setFormData(prev => ({ ...prev, statusMention: val }))}
                                >
                                    <SelectTrigger className="bg-black/40 border-white/5 rounded-xl text-zinc-400 h-11">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent side="top">
                                        <SelectItem value="none">😶 Aucune</SelectItem>
                                        <SelectItem value="@here">🔔 @here</SelectItem>
                                        <SelectItem value="@everyone">📢 @everyone</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1.5 block">Fréquence (Minutes)</label>
                                <Select 
                                    value={String(formData.statusFrequency)} 
                                    onValueChange={(val) => setFormData(prev => ({ ...prev, statusFrequency: parseInt(val) }))}
                                >
                                    <SelectTrigger className="bg-black/40 border-white/5 rounded-xl text-zinc-400 h-11">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent side="top">
                                        <SelectItem value="5">🏎️ 5 min</SelectItem>
                                        <SelectItem value="15">🛰️ 15 min</SelectItem>
                                        <SelectItem value="60">🕙 1 h</SelectItem>
                                        <SelectItem value="360">🕙 6 h</SelectItem>
                                        <SelectItem value="1440">📅 24 h</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                         </div>
                    </div>
                </div>

                {/* Section Ticket System */}
                <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-2">
                        🎫 Système de Tickets (Automatique)
                    </h4>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1.5 block">Serveur de Support (Reference)</label>
                            <Select 
                                value={formData.ticketSupportGuildId} 
                                onValueChange={(val) => setFormData(prev => ({ ...prev, ticketSupportGuildId: val }))}
                            >
                                <SelectTrigger className="bg-black/40 border-white/5 rounded-xl text-zinc-400 h-11">
                                    <SelectValue placeholder="Choisir le serveur..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableGuilds.map(g => (
                                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 mb-1.5 block">Rôle Auto-Assigné (Validation)</label>
                            <Select 
                                value={formData.ticketAutoRoleId} 
                                onValueChange={(val) => setFormData(prev => ({ ...prev, ticketAutoRoleId: val }))}
                                disabled={!formData.ticketSupportGuildId}
                            >
                                <SelectTrigger className="bg-black/40 border-white/5 rounded-xl text-zinc-400 h-11">
                                    <SelectValue placeholder="Choisir le rôle par défaut..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="SKIP">Aucun (Manuel uniquement)</SelectItem>
                                    {availableRoles.map(r => (
                                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex items-start gap-4">
                <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-zinc-500 leading-relaxed italic">
                    Le rôle auto-assigné sera donné à l'auteur du ticket dès que vous cliquez sur <strong>"Valider"</strong> dans le Dashboard Tickets, sauf si vous choisissez un autre rôle manuellement.
                </p>
            </div>
        </div>
    );
}
