"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { 
    Settings, 
    Shield, 
    Save, 
    Loader2, 
    Info, 
    Activity, 
    ClipboardList, 
    ShieldCheck, 
    AlertCircle,
    Power,
    MessageSquare,
    Bell,
    Lock,
    Globe,
    Server,
    Heart,
    ShieldAlert,
    ChevronDown
} from "lucide-react";
import { toast } from "sonner";
import { updatePlatformConfig, testStatusPing, testBackupNotification, toggleMaintenanceMode } from "@/server/actions/changelog-actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { diagnoseDiscordConnectivity } from "@/server/actions/god-discord-actions";
import { 
    Tooltip, 
    TooltipContent, 
    TooltipProvider, 
    TooltipTrigger 
} from "@/components/ui/tooltip";

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
        donationsEnabled: boolean;
        maintenanceMode: boolean;
        maintenanceMessage: string | null;
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
        nsfwFilterEnabled: config?.nsfwFilterEnabled !== undefined ? config?.nsfwFilterEnabled : true,
        donationsEnabled: config?.donationsEnabled !== undefined ? config?.donationsEnabled : true,
        maintenanceMode: config?.maintenanceMode || false,
        maintenanceMessage: config?.maintenanceMessage || ""
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
                success: (res: any) => {
                    if (res.success) return `Message de STATUT envoyé avec succès !`;
                    throw new Error(res.error);
                },
                error: (err: any) => `Erreur : ${err.message}`
            });
        });
    };

    const handleTestBackup = () => {
        startTransition(async () => {
            toast.promise(testBackupNotification(formData.godNotifyChannelId), {
                loading: "Envoi de l'alerte ADMIN (Test)...",
                success: (res: any) => {
                    if (res.success) return `Alerte ADMIN envoyée avec succès !`;
                    throw new Error(res.error);
                },
                error: (err: any) => `Erreur : ${err.message}`
            });
        });
    };

    const handleToggleMaintenance = () => {
        const newValue = !formData.maintenanceMode;
        startTransition(async () => {
            const res = await toggleMaintenanceMode(newValue, formData.maintenanceMessage);
            if (res.success) {
                setFormData(prev => ({ ...prev, maintenanceMode: newValue }));
                toast.success(`Mode maintenance ${newValue ? "activé" : "désactivé"} !`, {
                    description: newValue ? "Le site est maintenant réservé aux admins." : "Le site est de nouveau public.",
                    icon: newValue ? <Lock className="w-4 h-4 text-rose-500" /> : <Globe className="w-4 h-4 text-emerald-500" />
                });
            } else {
                toast.error(res.error || "Erreur de mise à jour");
            }
        });
    };

    const handleDiagnose = async () => {
        setIsDiagPending(true);
        try {
            const res = await diagnoseDiscordConnectivity();
            if (res.success) {
                setDiagResults(res.results);
                toast.success("Diagnostic terminé ! Regarde le rapport juste en dessous.");
            } else {
                toast.error(res.error || "Échec du diagnostic");
            }
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setIsDiagPending(false);
        }
    };

    const inputClasses = "w-full h-14 px-6 bg-zinc-900 border border-white/10 rounded-2xl text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-mono shadow-inner placeholder:text-zinc-700";

    return (
        <TooltipProvider delayDuration={0}>
            <div className="space-y-10 animate-in fade-in duration-1000 pb-20">
                
                {/* --- HEADER --- */}
                <div className="bg-zinc-950/60 border border-white/5 rounded-[2.5rem] p-10 backdrop-blur-3xl flex flex-col lg:flex-row items-center justify-between gap-8 relative overflow-hidden shadow-2xl border-b-white/10">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-transparent to-rose-500/5 pointer-events-none" />
                    
                    <div className="flex items-center gap-6 relative z-10">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-black border border-white/10 flex items-center justify-center shadow-2xl group">
                            <Settings className="w-8 h-8 text-indigo-400 group-hover:rotate-180 transition-transform duration-1000" />
                        </div>
                        <div className="space-y-1.5">
                            <h3 className="text-xl font-black text-white uppercase tracking-[0.2em]">Paramètres Plateforme</h3>
                            <div className="flex items-center gap-3">
                                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Configuration des salons & maintenance</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 relative z-10 w-full lg:w-auto">
                        <button
                            onClick={handleDiagnose}
                            disabled={isDiagPending}
                            className="flex-1 lg:flex-none h-14 px-8 bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 text-[10px] font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-4 transition-all shadow-xl active:scale-95"
                        >
                            {isDiagPending ? <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> : <ClipboardList className="w-4 h-4" />}
                            VÉRIFIER LES ACCÈS (Scan)
                        </button>
                        
                        <button
                            onClick={handleSave}
                            disabled={isPending}
                            className="flex-1 lg:flex-none h-14 px-10 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-black text-[10px] font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-4 transition-all shadow-indigo-500/20 shadow-xl active:scale-95"
                        >
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            ENREGISTRER TOUT
                        </button>
                    </div>
                </div>

                {/* --- DIAGNOSTIC REPORT (Prominent) --- */}
                {diagResults && (
                    <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-[3rem] p-10 animate-in slide-in-from-top-8 duration-700 overflow-hidden relative shadow-2xl">
                        <div className="absolute top-0 right-0 p-12 opacity-[0.05]"><ShieldCheck className="w-48 h-48 text-indigo-400" /></div>
                        <div className="flex items-center gap-4 mb-8">
                            <Info className="w-5 h-5 text-indigo-400" />
                            <h4 className="text-[11px] font-black text-white uppercase tracking-[0.4em]">RÉSULTAT DU SCAN DISCORD (RAPPORT)</h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                            <div className="bg-zinc-950/80 p-6 rounded-[2rem] border border-white/10 space-y-3">
                                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Connexion Bot</span>
                                <div className={cn("text-xs font-black uppercase", diagResults.token.status === "OK" ? "text-emerald-400" : "text-rose-400")}>{diagResults.token.message}</div>
                            </div>
                            <div className="bg-zinc-950/80 p-6 rounded-[2rem] border border-white/10 space-y-3">
                                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Nom du Bot</span>
                                <div className="text-xs font-black text-white uppercase">{diagResults.botIdentity?.username}</div>
                            </div>
                            <div className="bg-zinc-950/80 p-6 rounded-[2rem] border border-white/10 space-y-3">
                                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Serveurs Actifs</span>
                                <div className="text-xs font-black text-white">{diagResults.guilds.length} SERVEURS</div>
                            </div>
                            <div className="bg-zinc-950/80 p-6 rounded-[2rem] border border-white/10 space-y-3">
                                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Accès Salons</span>
                                <div className="flex flex-wrap gap-2">{Object.entries(diagResults.channels).map(([key, res]: any) => (<Badge key={key} variant="outline" className={cn("text-[9px] uppercase font-black border-transparent px-2", res.status === "OK" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400")}>{key}: {res.status}</Badge>))}</div>
                            </div>
                        </div>
                        <button onClick={() => setDiagResults(null)} className="mt-8 text-[9px] font-black text-zinc-500 uppercase tracking-widest hover:text-white transition-colors">Fermer le rapport</button>
                    </div>
                )}

                {/* --- MAIN CARDS --- */}
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-10">
                    
                    {/* SECTION 1: PUBLIC / HUB */}
                    <div className="bg-zinc-950/40 border border-white/5 rounded-[3rem] p-10 space-y-8 backdrop-blur-2xl flex flex-col hover:border-white/10 transition-all shadow-2xl">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                                <Globe className="w-7 h-7 text-indigo-400" />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-white uppercase tracking-[0.1em]">1. SALON PUBLIC (HUB)</h4>
                                <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">Annonces & Mises à jour</p>
                            </div>
                        </div>

                        <div className="space-y-6 flex-1">
                            <div className="p-5 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl space-y-2">
                                <div className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                                    <Info className="w-3.5 h-3.5" /> À quoi ça sert ?
                                </div>
                                <p className="text-[10px] text-zinc-400 leading-relaxed font-bold uppercase tracking-tight">
                                    C'est le salon où le bot va poster les **Changelogs** officiels (ex: "Nouvelle version v5 dispo"). C'est visible par tous les joueurs.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-zinc-200 uppercase tracking-widest ml-1">ID du Salon HUB</label>
                                <input type="text" value={formData.hubChannelId} onChange={(e) => setFormData(prev => ({ ...prev, hubChannelId: e.target.value }))} placeholder="Entrez l'ID du salon Discord..." className={inputClasses} />
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: MONITORING / STATUS */}
                    <div className="bg-zinc-950/40 border border-white/5 rounded-[3rem] p-10 space-y-8 backdrop-blur-2xl flex flex-col hover:border-white/10 transition-all shadow-2xl">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                <Activity className="w-7 h-7 text-emerald-400" />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-white uppercase tracking-[0.1em]">2. SALON SANTÉ (LOGS)</h4>
                                <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">Statut du bot & services</p>
                            </div>
                        </div>

                        <div className="space-y-6 flex-1">
                            <div className="p-5 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl space-y-2 relative group/test">
                                <div className="flex items-center gap-2 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                                    <Info className="w-3.5 h-3.5" /> À quoi ça sert ?
                                </div>
                                <p className="text-[10px] text-zinc-400 leading-relaxed font-bold uppercase tracking-tight">
                                    C'est un salon technique. Le bot y envoie un message toutes les X minutes pour dire "Je suis vivant". Ça sert à surveiller que rien n'est planté.
                                </p>
                                <button onClick={handleTestPing} className="absolute right-4 top-4 px-3 py-1.5 bg-emerald-500 text-black text-[9px] font-black rounded-lg hover:bg-emerald-400 transition-all shadow-lg active:scale-90">TESTER L'ENVOI</button>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-zinc-200 uppercase tracking-widest ml-1">ID du Salon Santé (Logs)</label>
                                <input type="text" value={formData.serviceStatusChannelId} onChange={(e) => setFormData(prev => ({ ...prev, serviceStatusChannelId: e.target.value }))} placeholder="Entrez l'ID du salon Discord..." className={inputClasses} />
                            </div>

                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Fréquence des Logs</label>
                                    <Select value={String(formData.statusFrequency)} onValueChange={(val) => setFormData(prev => ({ ...prev, statusFrequency: parseInt(val) }))}>
                                        <SelectTrigger className="h-12 bg-zinc-900 border-white/10 rounded-2xl text-zinc-200 text-[10px] font-black uppercase tracking-widest hover:border-emerald-500 transition-all shadow-inner"><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem value="5">Toutes les 5 min</SelectItem><SelectItem value="15">Toutes les 15 min</SelectItem><SelectItem value="60">Toutes les 1h</SelectItem></SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Mention (Ping)</label>
                                    <Select value={formData.statusMention} onValueChange={(val) => setFormData(prev => ({ ...prev, statusMention: val }))}>
                                        <SelectTrigger className="h-12 bg-zinc-900 border-white/10 rounded-2xl text-zinc-200 text-[10px] font-black uppercase tracking-widest hover:border-emerald-500 transition-all shadow-inner"><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem value="none">Aucune</SelectItem><SelectItem value="@here">@here</SelectItem></SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 3: PRIVATE / ALERTS */}
                    <div className="bg-zinc-950/40 border border-white/5 rounded-[3rem] p-10 space-y-8 backdrop-blur-2xl flex flex-col hover:border-white/10 transition-all shadow-2xl">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                                <ShieldAlert className="w-7 h-7 text-rose-400" />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-white uppercase tracking-[0.1em]">3. SALON ALERTES (GOD)</h4>
                                <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">Alertes de sécurité privées</p>
                            </div>
                        </div>

                        <div className="space-y-6 flex-1">
                            <div className="p-5 bg-rose-500/5 border border-rose-500/10 rounded-2xl space-y-2 relative group/test-god">
                                <div className="flex items-center gap-2 text-[10px] font-black text-rose-400 uppercase tracking-widest">
                                    <Info className="w-3.5 h-3.5" /> À quoi ça sert ?
                                </div>
                                <p className="text-[10px] text-zinc-400 leading-relaxed font-bold uppercase tracking-tight">
                                    C'est pour vous les Admins. Le bot y envoie des alertes de sécurité (ex: backup R2, erreurs critiques). C'est un salon **privé**.
                                </p>
                                <button onClick={handleTestBackup} className="absolute right-4 top-4 px-3 py-1.5 bg-rose-500 text-black text-[9px] font-black rounded-lg hover:bg-rose-400 transition-all shadow-lg active:scale-90">TESTER L'ALERTE</button>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-zinc-200 uppercase tracking-widest ml-1">ID du Salon Alertes God</label>
                                <input type="text" value={formData.godNotifyChannelId} onChange={(e) => setFormData(prev => ({ ...prev, godNotifyChannelId: e.target.value }))} placeholder="Entrez l'ID du salon Discord..." className={inputClasses} />
                            </div>
                            
                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-zinc-200 uppercase tracking-widest ml-1">ID du Rôle GOD (à mentionner)</label>
                                <input type="text" value={formData.godNotifyRoleId} onChange={(e) => setFormData(prev => ({ ...prev, godNotifyRoleId: e.target.value }))} placeholder="Entrez l'ID du rôle admin..." className={inputClasses} />
                                <p className="text-[9px] text-zinc-700 uppercase font-bold tracking-tighter italic">C'est le rôle qui sera "pingé" lors des alertes.</p>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 4: OPTIONS (IA, DONATIONS, WEB) */}
                    <div className="bg-zinc-950/40 border border-white/5 rounded-[3rem] p-10 space-y-10 backdrop-blur-2xl flex flex-col hover:border-white/10 transition-all shadow-2xl lg:col-span-1">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                <ShieldCheck className="w-7 h-7 text-amber-400" />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-white uppercase tracking-[0.1em]">4. OPTIONS SYSTÈME</h4>
                                <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">IA, Web & Dons</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-6">
                            {[
                                { key: "nsfwFilterEnabled", icon: ShieldCheck, label: "IA FILTRE NSFW", color: "emerald", tip: "Bloque les images pornographiques ou choquantes." },
                                { key: "godNotifyWebEnabled", icon: Globe, label: "NOTIFICATIONS WEB", color: "indigo", tip: "Affiche les alertes en haut à droite sur ton dashboard." },
                                { key: "donationsEnabled", icon: Heart, label: "BOUTON DONS ORB", color: "amber", tip: "Affiche ou cache le bouton de don Orbe dans la guilde." }
                            ].map((item) => {
                                const active = (formData as any)[item.key];
                                const Icon = item.icon;
                                return (
                                    <button key={item.key} onClick={() => setFormData(prev => ({ ...prev, [item.key]: !active }))} className={cn("flex items-center gap-6 p-6 rounded-[2.5rem] border transition-all shadow-xl group/opt", active ? `bg-${item.color}-500/10 border-${item.color}-500/30 text-${item.color}-400` : "bg-zinc-900 border-white/5 text-zinc-600 hover:border-white/10")}>
                                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center border", active ? `bg-${item.color}-500 text-black shadow-lg` : "bg-zinc-800 border-white/5")}>
                                            <Icon className="w-6 h-6" />
                                        </div>
                                        <div className="text-left space-y-1 flex-1">
                                            <span className="text-xs font-black uppercase tracking-widest">{item.label}</span>
                                            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-tight leading-none">{item.tip}</p>
                                        </div>
                                        <div className={cn("w-2 h-2 rounded-full", active ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-zinc-800")} />
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* SECTION 5: MAINTENANCE KILLSWITCH (LARGE) */}
                    <div className="bg-zinc-950/40 border border-white/5 rounded-[3rem] p-10 space-y-10 backdrop-blur-2xl flex flex-col xl:col-span-2 lg:col-span-1 hover:border-white/10 transition-all shadow-2xl">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                                <Power className="w-7 h-7 text-rose-400" />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-white uppercase tracking-[0.1em]">5. MODE MAINTENANCE (COUPURE)</h4>
                                <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">Gestion de l'accès au site</p>
                            </div>
                        </div>

                        <div className={cn("p-10 rounded-[3rem] border transition-all duration-1000 flex flex-col lg:flex-row items-center gap-10", formData.maintenanceMode ? "bg-rose-500/10 border-rose-500/40 shadow-[0_0_60px_rgba(244,63,94,0.1)]" : "bg-zinc-900/60 border-white/10")}>
                            <div className="space-y-4 flex-1">
                                <div className="flex items-center gap-4">
                                    <div className={cn("w-16 h-16 rounded-[1.5rem] flex items-center justify-center border", formData.maintenanceMode ? "bg-rose-500 text-white shadow-xl animate-pulse" : "bg-zinc-800 text-zinc-600")}>
                                        <Lock className="w-8 h-8" />
                                    </div>
                                    <div className="space-y-1">
                                        <h5 className={cn("text-lg font-black uppercase tracking-[0.15em]", formData.maintenanceMode ? "text-rose-500" : "text-zinc-400")}>INTERRUPTEUR GÉNÉRAL</h5>
                                        <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">Action Immédiate : Bloque l'accès aux joueurs</p>
                                    </div>
                                </div>
                                <div className="space-y-3 pt-6">
                                    <label className="text-[11px] font-black text-rose-500/80 uppercase tracking-[0.2em] ml-1">Message affiché aux joueurs (Optionnel)</label>
                                    <input type="text" value={formData.maintenanceMessage} onChange={(e) => setFormData(prev => ({ ...prev, maintenanceMessage: e.target.value }))} placeholder="Ex: Maintenance en cours pour la v5, revenez dans 1h..." className={cn(inputClasses, "border-rose-500/20 focus:border-rose-500")} />
                                    <p className="text-[9px] text-zinc-700 uppercase font-bold tracking-tight">Si vide, un message par défaut sera affiché.</p>
                                </div>
                            </div>
                            <button onClick={handleToggleMaintenance} className={cn("h-24 w-full lg:w-64 text-sm font-black uppercase tracking-[0.3em] rounded-[2.5rem] transition-all shadow-2xl active:scale-95 border-2", formData.maintenanceMode ? "bg-rose-500 text-white hover:bg-rose-600 border-rose-400" : "bg-zinc-800 text-zinc-500 hover:text-white border-white/10")}>
                                {formData.maintenanceMode ? "DÉSACTIVER" : "ACTIVER LA MAINTENANCE"}
                            </button>
                        </div>

                        <div className="flex items-center gap-6 p-8 bg-amber-500/5 border border-amber-500/10 rounded-[2.5rem]">
                            <AlertCircle className="w-8 h-8 text-amber-500/40 shrink-0" />
                            <div className="space-y-1">
                                <p className="text-[11px] text-zinc-400 font-black uppercase tracking-widest">Zone de Danger</p>
                                <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-tight leading-relaxed">
                                    Ces réglages sont critiques. Un mauvais ID de salon empêchera le bot de communiquer. La maintenance déconnectera tous les utilisateurs non-admins.
                                </p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </TooltipProvider>
    );
}
