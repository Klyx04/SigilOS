"use client";

import { useState, useTransition } from "react";
import { Settings, Shield, Save, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { updatePlatformConfig } from "@/server/actions/changelog-actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PlatformConfigPanelProps {
    config: {
        id: string;
        hubChannelId: string | null;
        serviceStatusChannelId: string | null;
        ticketAutoRoleId: string | null;
        ticketSupportGuildId: string | null;
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

    return (
        <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-8 backdrop-blur-xl shadow-2xl space-y-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[60px] -translate-y-1/2 translate-x-1/2" />
            
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-3">
                    <Settings className="w-5 h-5 text-indigo-400" />
                    SigilOS Platform Configuration
                </h3>
                <button
                    onClick={handleSave}
                    disabled={isPending}
                    className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-black text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 transition-all"
                >
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Sauvegarder
                </button>
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
