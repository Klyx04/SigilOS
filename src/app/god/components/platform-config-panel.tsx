"use client";

import { useState, useTransition, useRef } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
        questFeedbackChannelId: string | null;
        maintenanceMode: boolean;
        maintenanceMessage: string | null;
        ladderManualFallback: boolean;
        dofusQuestHeaderIcon: string;
        rbacUsersMappingEnabled: boolean;
        forceDarkMode: boolean;
    } | null;
    availableGuilds: { id: string, name: string }[];
    availableRoles: { id: string, name: string }[];
}

export function PlatformConfigPanel({ config, availableGuilds, availableRoles }: PlatformConfigPanelProps) {
    const [isPending, startTransition] = useTransition();
    const reportRef = useRef<HTMLDivElement>(null);
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
        questFeedbackChannelId: config?.questFeedbackChannelId || "",
        maintenanceMode: config?.maintenanceMode || false,
        maintenanceMessage: config?.maintenanceMessage || "",
        ladderManualFallback: config?.ladderManualFallback || false,
        dofusQuestHeaderIcon: config?.dofusQuestHeaderIcon || "serie-de-quete",
        rbacUsersMappingEnabled: config?.rbacUsersMappingEnabled ?? true,
        forceDarkMode: config?.forceDarkMode ?? false
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
                // Scroll auto vers le rapport pour que le résultat soit visible immédiatement.
                setTimeout(() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
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
        <div className="space-y-10 animate-in fade-in duration-300 pb-20">
            
            {/* BARRE D'ACTIONS PRO */}
            <div className="bg-zinc-950/60 border border-white/10 rounded-3xl p-6 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                        <Settings className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-white uppercase tracking-wider">Infrastructure & Configuration</h3>
                        <p className="text-zinc-500 text-xs font-semibold">Gestion des intégrations Discord, routage des alertes et statut d'accès.</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                        onClick={handleDiagnose}
                        disabled={isDiagPending}
                        className="flex-1 sm:flex-none px-4 py-3 bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        {isDiagPending ? <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> : <ClipboardList className="w-4 h-4" />}
                        Scan Accès
                    </button>
                    
                    <button
                        onClick={handleSave}
                        disabled={isPending}
                        className="flex-1 sm:flex-none px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                    >
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Sauvegarder
                    </button>
                </div>
            </div>

            {/* RAPPORT DE DIAGNOSTIC DISCORD */}
            {diagResults && (
                <div ref={reportRef} className="bg-indigo-500/10 border border-indigo-500/20 rounded-3xl p-6 space-y-4 animate-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-black text-indigo-300 uppercase tracking-wider">
                            <ShieldCheck className="w-4 h-4" /> Rapport de Diagnostic Discord
                        </div>
                        <button onClick={() => setDiagResults(null)} className="text-caption text-zinc-500 hover:text-white font-bold uppercase">Fermer</button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-bold">
                        <div className="p-4 rounded-xl bg-zinc-950/80 border border-white/5 space-y-1">
                            <span className="text-caption text-zinc-500 uppercase block">Connexion Bot</span>
                            <span className={cn(diagResults.token.status === "OK" ? "text-emerald-400" : "text-rose-400")}>{diagResults.token.message}</span>
                        </div>
                        <div className="p-4 rounded-xl bg-zinc-950/80 border border-white/5 space-y-1">
                            <span className="text-caption text-zinc-500 uppercase block">Identité Bot</span>
                            <span className="text-white font-mono">{diagResults.botIdentity?.username || "N/A"}</span>
                        </div>
                        <div className="p-4 rounded-xl bg-zinc-950/80 border border-white/5 space-y-1">
                            <span className="text-caption text-zinc-500 uppercase block">Serveurs</span>
                            <span className="text-white">{diagResults.guilds.length} actifs</span>
                        </div>
                        <div className="p-4 rounded-xl bg-zinc-950/80 border border-white/5 space-y-1">
                            <span className="text-caption text-zinc-500 uppercase block">Salons accessibles</span>
                            <div className="flex flex-wrap gap-1">
                                {Object.entries(diagResults.channels).map(([k, v]: any) => (
                                    <span key={k} className={cn("text-caption font-mono px-1.5 py-0.5 rounded", v.status === "OK" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400")}>{k}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CARTE 1: ROUTAGE DES SALONS DISCORD */}
            <div className="p-8 rounded-3xl bg-zinc-950/40 border border-white/5 space-y-6">
                <div className="border-b border-white/5 pb-4 space-y-1">
                    <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <Server className="w-4 h-4 text-indigo-400" />
                        Routage des Salons Discord (Core System)
                    </h4>
                    <p className="text-zinc-500 text-xs font-medium">Définissez les canaux d'émission pour les Changelogs, la surveillance de santé et les alertes d'administration.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Salon Hub */}
                    <div className="p-5 rounded-2xl bg-zinc-900/30 border border-white/5 space-y-4">
                        <div className="space-y-1">
                            <span className="text-xs font-black text-white uppercase block">1. Salon Hub (Changelog)</span>
                            <p className="text-caption text-zinc-500 leading-normal">Diffusion des mises à jour publiques.</p>
                        </div>
                        <Input
                            type="text"
                            value={formData.hubChannelId}
                            onChange={(e) => setFormData(prev => ({ ...prev, hubChannelId: e.target.value }))}
                            placeholder="ID Discord du salon..."
                            className="bg-zinc-900 border-white/10 text-xs font-mono"
                        />
                    </div>

                    {/* Salon Santé */}
                    <div className="p-5 rounded-2xl bg-zinc-900/30 border border-white/5 space-y-4">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <span className="text-xs font-black text-white uppercase block">2. Salon Santé (Ping Status)</span>
                                <p className="text-caption text-zinc-500 leading-normal">Surveillance automatique du bot.</p>
                            </div>
                            <Button size="sm" variant="ghost" onClick={handleTestPing} className="text-caption font-black uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20">
                                Test Ping
                            </Button>
                        </div>
                        <Input
                            type="text"
                            value={formData.serviceStatusChannelId}
                            onChange={(e) => setFormData(prev => ({ ...prev, serviceStatusChannelId: e.target.value }))}
                            placeholder="ID Discord du salon..."
                            className="bg-zinc-900 border-white/10 text-xs font-mono"
                        />
                        <div className="grid grid-cols-2 gap-2">
                            <Select value={String(formData.statusFrequency)} onValueChange={(val) => setFormData(prev => ({ ...prev, statusFrequency: parseInt(val) }))}>
                                <SelectTrigger className="bg-zinc-900 border-white/10 text-caption font-bold uppercase"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="5">Toutes les 5m</SelectItem><SelectItem value="15">Toutes les 15m</SelectItem><SelectItem value="60">Toutes les 1h</SelectItem></SelectContent>
                            </Select>
                            <Select value={formData.statusMention} onValueChange={(val) => setFormData(prev => ({ ...prev, statusMention: val }))}>
                                <SelectTrigger className="bg-zinc-900 border-white/10 text-caption font-bold uppercase"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="none">Sans mention</SelectItem><SelectItem value="@here">@here</SelectItem></SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Salon Alertes God */}
                    <div className="p-5 rounded-2xl bg-zinc-900/30 border border-white/5 space-y-4">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <span className="text-xs font-black text-white uppercase block">3. Salon Alertes GOD (Privé)</span>
                                <p className="text-caption text-zinc-500 leading-normal">Rapports d'erreurs critiques & backups.</p>
                            </div>
                            <Button size="sm" variant="ghost" onClick={handleTestBackup} className="text-caption font-black uppercase text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20">
                                Test Alerte
                            </Button>
                        </div>
                        <Input
                            type="text"
                            value={formData.godNotifyChannelId}
                            onChange={(e) => setFormData(prev => ({ ...prev, godNotifyChannelId: e.target.value }))}
                            placeholder="ID Salon alertes..."
                            className="bg-zinc-900 border-white/10 text-xs font-mono"
                        />
                        <Input
                            type="text"
                            value={formData.godNotifyRoleId}
                            onChange={(e) => setFormData(prev => ({ ...prev, godNotifyRoleId: e.target.value }))}
                            placeholder="ID Rôle GOD (à ping)..."
                            className="bg-zinc-900 border-white/10 text-xs font-mono"
                        />
                    </div>

                    {/* Salon Feedback Dofus */}
                    <div className="p-5 rounded-2xl bg-zinc-900/30 border border-white/5 space-y-4">
                        <div className="space-y-1">
                            <span className="text-xs font-black text-white uppercase block">4. Salon Feedback Dofus</span>
                            <p className="text-caption text-zinc-500 leading-normal">
                                Cible les retours envoyés depuis les pages « Les Dofus Dofus » (Hub, Détail Dofus, Rush Sylvestre).
                                <span className="text-zinc-600"> Non configuré : repli sur le salon Alertes GOD.</span>
                            </p>
                        </div>
                        <Input
                            type="text"
                            value={formData.questFeedbackChannelId}
                            onChange={(e) => setFormData(prev => ({ ...prev, questFeedbackChannelId: e.target.value }))}
                            placeholder="ID Salon feedbacks..."
                            className="bg-zinc-900 border-white/10 text-xs font-mono"
                        />
                    </div>
                </div>
            </div>

            {/* CARTE 2 & 3: OPTIONS SYSTÈME ET MAINTENANCE EN 2 COLONNES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Options de sécurité / Fonctionnalités */}
                <div className="p-8 rounded-3xl bg-zinc-950/40 border border-white/5 space-y-6">
                    <div className="border-b border-white/5 pb-4 space-y-1">
                        <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-amber-400" />
                            Modules Plateforme & Sécurité
                        </h4>
                        <p className="text-zinc-500 text-xs font-medium">Interrupteurs d'activation globale des services optionnels.</p>
                    </div>

                    <div className="space-y-3">
                        {[
                            { key: "nsfwFilterEnabled", label: "IA Filtre NSFW", desc: "Inspection automatique des captures pour filtrer le contenu inapproprié." },
                            { key: "godNotifyWebEnabled", label: "Notifications Web Admin", desc: "Affichage des bannières d'alerte en temps réel sur l'interface." },
                            { key: "donationsEnabled", label: "Module Dons Orbes", desc: "Activation du widget de contribution financière sur les guildes." },
                            { key: "ladderManualFallback", label: "Fallback Pseudo Manuel", desc: "Autorise la saisie manuelle du pseudo Dofus si la liaison Ankama est KO (évite de bloquer les nouveaux membres)." },
                            { key: "rbacUsersMappingEnabled", label: "RBAC Membres Spécifiques", desc: "Autorise les permissions individuelles par membre (usersMapping). Désactiver en cas de bug = kill-switch global fail-closed (aucune permission individuelle appliquée)." },
                            { key: "forceDarkMode", label: "Forcer le Mode Sombre", desc: "Chantier #16 — Kill-switch thème : verrouille le site en sombre pour tout le monde (bascule auto même si des users avaient laissé le clair) et masque les boutons clair/sombre. À activer en cas de bug du mode clair." }
                        ].map((opt) => {
                            const active = (formData as any)[opt.key];
                            return (
                                <button
                                    key={opt.key}
                                    onClick={() => setFormData(prev => ({ ...prev, [opt.key]: !active }))}
                                    className={cn(
                                        "w-full p-4 rounded-2xl border transition-all text-left flex items-center justify-between gap-4",
                                        active ? "bg-indigo-500/10 border-indigo-500/30 text-white" : "bg-zinc-900/30 border-white/5 text-zinc-500 hover:border-white/10"
                                    )}
                                >
                                    <div className="space-y-0.5 min-w-0">
                                        <span className="text-xs font-bold block">{opt.label}</span>
                                        <span className="text-caption text-zinc-500 block truncate">{opt.desc}</span>
                                    </div>
                                    <span className={cn("text-caption font-black uppercase px-2.5 py-1 rounded-lg shrink-0", active ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-zinc-900 text-zinc-600")}>
                                        {active ? "Actif" : "Inactif"}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Chantier #68 — Choix God de l'icône du bloc d'en-tête des pages quêtes par Dofus */}
                    <div className="space-y-2.5">
                        <div className="space-y-1">
                            <span className="text-xs font-black text-white uppercase block">Icône du bloc quêtes par Dofus</span>
                            <p className="text-caption text-zinc-500 leading-normal">
                                Icône affichée dans le bloc d'en-tête (à la place de l'image générique) sur chaque page quête par Dofus.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Select value={formData.dofusQuestHeaderIcon} onValueChange={(v) => setFormData(prev => ({ ...prev, dofusQuestHeaderIcon: v }))}>
                                <SelectTrigger className="w-full bg-zinc-900 border-white/10 text-xs font-medium">
                                    <SelectValue placeholder="Choisir une icône" />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-950 border-white/10">
                                    <SelectItem value="serie-de-quete">Serie de quête (Dofus vert)</SelectItem>
                                    <SelectItem value="icone-succes">Succès</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                {/* Mode Maintenance (Killswitch) */}
                <div className="p-8 rounded-3xl bg-zinc-950/40 border border-white/5 space-y-6 flex flex-col justify-between">
                    <div className="border-b border-white/5 pb-4 space-y-1">
                        <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Power className="w-4 h-4 text-rose-400" />
                            Accès Plateforme & Maintenance
                        </h4>
                        <p className="text-zinc-500 text-xs font-medium">Restreint l'accès au site uniquement aux Super-Admins.</p>
                    </div>

                    <div className="space-y-4">
                        <Input
                            type="text"
                            value={formData.maintenanceMessage}
                            onChange={(e) => setFormData(prev => ({ ...prev, maintenanceMessage: e.target.value }))}
                            placeholder="Message de maintenance personnalisé..."
                            className="bg-zinc-900 border-white/10 text-xs font-medium"
                        />

                        <button
                            onClick={handleToggleMaintenance}
                            className={cn(
                                "w-full h-16 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border flex items-center justify-center gap-3 shadow-lg active:scale-98",
                                formData.maintenanceMode
                                    ? "bg-rose-500 hover:bg-rose-600 text-white border-rose-400 shadow-rose-500/20"
                                    : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-white/10"
                            )}
                        >
                            <Lock className="w-4 h-4" />
                            {formData.maintenanceMode ? "DÉSACTIVER LA MAINTENANCE (Site En Ligne)" : "ACTIVER LA MAINTENANCE (Verrouiller le site)"}
                        </button>
                    </div>
                </div>

                {/* CARTE 4: GESTION DES RAPPELS ET POSTS INACTIFS (#107) */}
                <div className="p-8 rounded-3xl bg-zinc-950/40 border border-white/5 space-y-6 md:col-span-2">
                    <div className="border-b border-white/5 pb-4 space-y-1 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                                <Bell className="w-4 h-4 text-amber-400" />
                                Relances & Purge des Posts Inactifs (DJ / Quêtes / Songes)
                            </h4>
                            <p className="text-zinc-500 text-xs font-medium">
                                Calendrier progressif (7 &gt; 15 &gt; 20 &gt; Fini) : rappels automatiques par ping Discord à J+7, J+15, J+20 puis auto-clôture et suppression de l'embed.
                            </p>
                        </div>
                        <Button
                            size="sm"
                            disabled={isPending}
                            onClick={() => {
                                startTransition(async () => {
                                    const { godProcessInactivePosts } = await import("@/server/actions/god-system-actions");
                                    const res = await godProcessInactivePosts();
                                    if (res.success) {
                                        toast.success(
                                            `Balayage terminé : ${res.djRemindersSent} rappels DJ, ${res.djPostsClosed} DJ clos, ${res.songesRemindersSent} rappels Songes, ${res.songesRunsClosed} Songes clos.`
                                        );
                                    } else {
                                        toast.error(res.error || "Erreur lors du balayage");
                                    }
                                });
                            }}
                            className="bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-xs font-bold shrink-0"
                        >
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Activity className="w-4 h-4 mr-2" />}
                            Lancer le balayage maintenant
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                        <div className="p-4 rounded-2xl bg-zinc-900/40 border border-white/5 space-y-1">
                            <span className="text-zinc-500 text-caption uppercase font-bold">Calendrier des Relances</span>
                            <p className="text-white font-black text-sm">J+7 • J+15 • J+20</p>
                            <span className="text-zinc-600 text-caption block">3 rappels progressifs par ping Discord</span>
                        </div>
                        <div className="p-4 rounded-2xl bg-zinc-900/40 border border-white/5 space-y-1">
                            <span className="text-zinc-500 text-caption uppercase font-bold">Plafond & Canal</span>
                            <p className="text-white font-black text-sm">3 appels max</p>
                            <span className="text-zinc-600 text-caption block">Dans le fil / salon du post de guilde</span>
                        </div>
                        <div className="p-4 rounded-2xl bg-zinc-900/40 border border-white/5 space-y-1">
                            <span className="text-zinc-500 text-caption uppercase font-bold">Action finale</span>
                            <p className="text-rose-400 font-black text-sm">Clôture & Purge à J+21</p>
                            <span className="text-zinc-600 text-caption block">Fermeture DB + suppression de l'embed</span>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}
