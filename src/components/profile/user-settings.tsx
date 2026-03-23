"use client";

import { useState, useEffect } from "react";
import {
    AlertTriangle,
    Zap,
    UserMinus,
    Trash2,
    ShieldAlert,
    Info,
    Bell,
    MessageSquare,
    Swords,
    Trophy,
    Calendar,
    Target,
    Flame,
    PieChart,
    ShieldCheck
} from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { archiveProfile, handleGdprDeletionRequest } from "@/server/actions/lifecycle-actions";
import { useRouter } from "next/navigation";
import { DiscordOwnershipModal } from "./discord-ownership-modal";
import { updateNotificationPrefs } from "@/server/actions/profile-actions";

interface NotificationPrefs {
    missions: boolean;
    songes: boolean;
    donjons: boolean;
    events: boolean;
    ladder: boolean;
    polls: boolean;
    admin_validations: boolean;
    ocre: boolean;
}

interface UserSettingsProps {
    guildId: string;
    guildName: string;
    profileId: string;
    notificationPrefs?: NotificationPrefs | null;
    onNotificationPrefsSave?: (prefs: any) => void;
    isAdmin: boolean;
    targetUserId?: string;
    showPresence: boolean;
    onPresenceToggle: (enabled: boolean) => void;
}

export function UserSettings({
    guildId,
    guildName,
    profileId,
    notificationPrefs,
    onNotificationPrefsSave,
    isAdmin,
    targetUserId,
    showPresence,
    onPresenceToggle
}: UserSettingsProps) {
    const [performanceMode, setPerformanceMode] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showOwnershipModal, setShowOwnershipModal] = useState(false);
    const [loading, setLoading] = useState(false); // Added loading state
    const router = useRouter();

    // Default values: true if not specified
    const prefs = {
        missions: notificationPrefs?.missions ?? true,
        songes: notificationPrefs?.songes ?? true,
        donjons: notificationPrefs?.donjons ?? true,
        events: notificationPrefs?.events ?? true,
        ladder: notificationPrefs?.ladder ?? true,
        polls: notificationPrefs?.polls ?? true,
        admin_validations: notificationPrefs?.admin_validations ?? true,
        ocre: notificationPrefs?.ocre ?? true,
    };

    const handleUpdatePrefs = async (newPrefs: Partial<NotificationPrefs>) => { // Renamed and updated signature
        setLoading(true);
        onNotificationPrefsSave?.(newPrefs);

        const res = await updateNotificationPrefs({
            guildId,
            prefs: newPrefs,
            targetUserId
        });

        if (res.success) {
            toast.success("Préférences enregistrées");
        } else {
            toast.error(res.error || "Erreur");
            // Rollback on fail
            onNotificationPrefsSave?.(Object.fromEntries(
                Object.entries(newPrefs).map(([key, value]) => [key, !value])
            ));
        }
        setLoading(false);
    };

    // Load performance mode from localStorage
    useEffect(() => {
        const saved = localStorage.getItem("sigilos-performance-mode") === "true";
        setPerformanceMode(saved);
        if (saved) document.documentElement.classList.add("reduce-motion");
    }, []);

    const togglePerformanceMode = (enabled: boolean) => {
        setPerformanceMode(enabled);
        localStorage.setItem("sigilos-performance-mode", String(enabled));

        if (enabled) {
            document.documentElement.classList.add("reduce-motion");
            toast.info("Mode Performance activé : Animations réduites.");
        } else {
            document.documentElement.classList.remove("reduce-motion");
            toast.info("Mode Performance désactivé.");
        }
    };

    const handleLeaveGuild = async () => {
        setIsDeleting(true);
        try {
            const res = await archiveProfile(guildId);
            if (res.success) {
                toast.success(`Vous avez quitté ${guildName}.`);
                router.push("/dashboard");
            } else {
                toast.error(res.error || "Une erreur est survenue");
            }
        } catch (error) {
            toast.error("Erreur de communication avec le serveur");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        try {
            const res = await handleGdprDeletionRequest();
            if (res.success) {
                toast.success("Compte supprimé définitivement. Adieu !");
                window.location.href = "/";
            } else {
                const isOwnershipError = res.error?.toLowerCase().includes("proprié");
                if (isOwnershipError) {
                    setShowOwnershipModal(true);
                } else {
                    toast.error(res.error || "Une erreur est survenue");
                }
            }
        } catch (error) {
            toast.error("Erreur de communication avec le serveur");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                {/* PERFORMANCE SECTION */}
                <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-xl">
                            <Zap className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Interface & Performance</h3>
                            <p className="text-sm text-zinc-400">Optimisez votre lecture</p>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-white/5">
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-amber-500/30 transition-all">
                            <div className="space-y-1">
                                <Label htmlFor="perf-mode" className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">
                                    Mode Performance
                                </Label>
                                <p className="text-[10px] text-zinc-500 leading-tight">
                                    Réduit les animations et flous.
                                </p>
                            </div>
                            <Switch
                                id="perf-mode"
                                checked={performanceMode}
                                onCheckedChange={togglePerformanceMode}
                            />
                        </div>

                        <div className="flex items-start gap-3 p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                            <Info className="w-5 h-5 text-blue-400 mt-0.5" />
                            <p className="text-xs text-blue-300/80 leading-relaxed">
                                Ce réglage est sauvegardé localement sur ce navigateur. Il n'affecte pas votre profil sur d'autres appareils.
                            </p>
                        </div>
                    </div>
                </div>

                {/* NOTIFICATIONS SECTION */}
                <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-xl">
                            <Bell className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Notifications</h3>
                            <p className="text-sm text-zinc-400">Gérez vos alertes in-app</p>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/5">
                        <TooltipProvider delayDuration={0}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {/* MISSIONS */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center justify-between p-2.5 border border-white/5 rounded-2xl bg-white/5 group hover:border-blue-500/30 transition-all cursor-default">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                                <Target className="w-4 h-4 text-blue-400" />
                                            </div>
                                            <div className="min-w-0 pr-2">
                                                <p className="text-[11px] font-semibold text-zinc-200 truncate">Missions</p>
                                                <p className="text-[9px] text-zinc-500 truncate">Nouvelles & validations</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={prefs.missions}
                                            onCheckedChange={(checked) => handleUpdatePrefs({ missions: checked })}
                                            disabled={loading}
                                        />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-zinc-900 border-white/10 text-white font-bold uppercase tracking-wider text-[9px] px-3 py-1.5 shadow-xl">
                                    Notifications Missions
                                </TooltipContent>
                            </Tooltip>

                            {/* SONGES */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center justify-between p-2.5 border border-white/5 rounded-2xl bg-white/5 group hover:border-emerald-500/30 transition-all cursor-default">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                                                <Flame className="w-4 h-4 text-emerald-400" />
                                            </div>
                                            <div className="min-w-0 pr-2">
                                                <p className="text-[11px] font-semibold text-zinc-200 truncate">Songes</p>
                                                <p className="text-[9px] text-zinc-500 truncate">Invitations & candidatures</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={prefs.songes}
                                            onCheckedChange={(checked) => handleUpdatePrefs({ songes: checked })}
                                            disabled={loading}
                                        />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-zinc-900 border-white/10 text-white font-bold uppercase tracking-wider text-[9px] px-3 py-1.5 shadow-xl">
                                    Notifications Songes
                                </TooltipContent>
                            </Tooltip>

                            {/* DONJONS */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center justify-between p-2.5 border border-white/5 rounded-2xl bg-white/5 group hover:border-indigo-500/30 transition-all cursor-default">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                                                <Swords className="w-4 h-4 text-indigo-400" />
                                            </div>
                                            <div className="min-w-0 pr-2">
                                                <p className="text-[11px] font-semibold text-zinc-200 truncate">Donjons & Quêtes</p>
                                                <p className="text-[9px] text-zinc-500 truncate">Entrée en groupe</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={prefs.donjons}
                                            onCheckedChange={(checked) => handleUpdatePrefs({ donjons: checked })}
                                            disabled={loading}
                                        />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-zinc-900 border-white/10 text-white font-bold uppercase tracking-wider text-[9px] px-3 py-1.5 shadow-xl">
                                    Notifications Donjons
                                </TooltipContent>
                            </Tooltip>

                            {/* EVENTS */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center justify-between p-2.5 border border-white/5 rounded-2xl bg-white/5 group hover:border-purple-500/30 transition-all cursor-default">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                                                <Calendar className="w-4 h-4 text-purple-400" />
                                            </div>
                                            <div className="min-w-0 pr-2">
                                                <p className="text-[11px] font-semibold text-zinc-200 truncate">Événements</p>
                                                <p className="text-[9px] text-zinc-500 truncate">Rappels de guilde</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={prefs.events}
                                            onCheckedChange={(checked) => handleUpdatePrefs({ events: checked })}
                                            disabled={loading}
                                        />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-zinc-900 border-white/10 text-white font-bold uppercase tracking-wider text-[9px] px-3 py-1.5 shadow-xl">
                                    Notifications Événements
                                </TooltipContent>
                            </Tooltip>

                            {/* LADDER */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center justify-between p-2.5 border border-white/5 rounded-2xl bg-white/5 group hover:border-red-500/30 transition-all cursor-default">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                                                <Trophy className="w-4 h-4 text-red-400" />
                                            </div>
                                            <div className="min-w-0 pr-2">
                                                <p className="text-[11px] font-semibold text-zinc-200 truncate">Succès & Ladder</p>
                                                <p className="text-[9px] text-zinc-500 truncate">Validations & rangs</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={prefs.ladder}
                                            onCheckedChange={(checked) => handleUpdatePrefs({ ladder: checked })}
                                            disabled={loading}
                                        />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-zinc-900 border-white/10 text-white font-bold uppercase tracking-wider text-[9px] px-3 py-1.5 shadow-xl">
                                    Notifications Classement
                                </TooltipContent>
                            </Tooltip>

                            {/* POLLS */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center justify-between p-2.5 border border-white/5 rounded-2xl bg-white/5 group hover:border-orange-500/30 transition-all cursor-default">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                                                <PieChart className="w-4 h-4 text-orange-400" />
                                            </div>
                                            <div className="min-w-0 pr-2">
                                                <p className="text-[11px] font-semibold text-zinc-200 truncate">Sondages</p>
                                                <p className="text-[9px] text-zinc-500 truncate">Nouveaux votes</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={prefs.polls}
                                            onCheckedChange={(checked) => handleUpdatePrefs({ polls: checked })}
                                            disabled={loading}
                                        />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-zinc-900 border-white/10 text-white font-bold uppercase tracking-wider text-[9px] px-3 py-1.5 shadow-xl">
                                    Notifications Sondages
                                </TooltipContent>
                            </Tooltip>

                            {/* OCRE */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center justify-between p-2.5 border border-white/5 rounded-2xl bg-white/5 group hover:border-emerald-700/30 transition-all cursor-default">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-700/10 flex items-center justify-center shrink-0">
                                                <Trophy className="w-4 h-4 text-emerald-500" />
                                            </div>
                                            <div className="min-w-0 pr-2">
                                                <p className="text-[11px] font-semibold text-zinc-200 truncate">Quête Ocre</p>
                                                <p className="text-[9px] text-zinc-500 truncate">Échanges</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={prefs.ocre}
                                            onCheckedChange={(checked) => handleUpdatePrefs({ ocre: checked })}
                                            disabled={loading}
                                        />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-zinc-900 border-white/10 text-white font-bold uppercase tracking-wider text-[9px] px-3 py-1.5 shadow-xl">
                                    Notifications Échanges Ocre
                                </TooltipContent>
                            </Tooltip>

                            {isAdmin && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex items-center justify-between p-2.5 border border-white/5 rounded-2xl bg-zinc-400/5 group hover:border-zinc-300/30 transition-all cursor-default">
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                <div className="w-8 h-8 rounded-lg bg-zinc-400/10 flex items-center justify-center shrink-0">
                                                    <ShieldCheck className="w-4 h-4 text-zinc-400" />
                                                </div>
                                                <div className="min-w-0 pr-2">
                                                    <p className="text-[11px] font-semibold text-zinc-200 truncate">Alertes Admin</p>
                                                    <p className="text-[9px] text-zinc-500 truncate">Missions en attente</p>
                                                </div>
                                            </div>
                                            <Switch
                                                checked={prefs.admin_validations}
                                                onCheckedChange={(checked) => handleUpdatePrefs({ admin_validations: checked })}
                                                disabled={loading}
                                            />
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="bg-zinc-900 border-white/10 text-white font-bold uppercase tracking-wider text-[9px] px-3 py-1.5 shadow-xl">
                                        Notifications Administration
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </div>
                        </TooltipProvider>
                    </div>
                </div>

                {/* GDPR / LIFECYCLE SECTION */}
                <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/10 rounded-xl">
                            <ShieldAlert className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Gestion du Compte</h3>
                            <p className="text-sm text-zinc-400">Départ et suppression</p>
                        </div>
                    </div>

                    {/* Comparison info box */}
                    <div className="p-3 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 space-y-2">
                        <div className="flex items-center gap-2 text-indigo-300">
                            <Info className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-black uppercase tracking-wider">Quelle est la différence ?</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div className="p-2 bg-zinc-800/60 rounded-xl border border-white/5">
                                <p className="font-bold text-zinc-200 mb-1">📦 Archivage</p>
                                <ul className="space-y-0.5 text-zinc-500 leading-relaxed">
                                    <li>• Profil <b className="text-emerald-400">mis en pause</b></li>
                                    <li>• Gardé <b className="text-zinc-300">90 jours</b></li>
                                    <li>• Retour <b className="text-emerald-400">instantané</b> possible</li>
                                </ul>
                            </div>
                            <div className="p-2 bg-red-950/30 rounded-xl border border-red-500/10">
                                <p className="font-bold text-zinc-200 mb-1">💀 Suppression</p>
                                <ul className="space-y-0.5 text-zinc-500 leading-relaxed">
                                    <li>• <b className="text-red-300">Adieu</b> définitif</li>
                                    <li>• Données <b className="text-red-300">tout effacer</b></li>
                                    <li>• <b className="text-red-400">Irréversible</b></li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-white/5">
                        {/* LEAVE GUILD — Safe, Reversible */}
                        <div className="p-3 bg-zinc-900/40 rounded-2xl border border-emerald-500/10 space-y-3 group hover:border-emerald-500/20 transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-sm font-semibold text-zinc-200">Archiver mon profil</h4>
                                        <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">Réversible</span>
                                    </div>
                                    <p className="text-[10px] text-zinc-500 leading-tight">
                                        Met vos données de côté pour <b className="text-zinc-300">{guildName}</b>. Elles sont conservées 90 jours avant suppression automatique.
                                    </p>
                                </div>
                            </div>

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="w-full h-8 text-xs border-zinc-700 hover:bg-zinc-800 hover:border-emerald-500/30 gap-2 transition-colors">
                                        <UserMinus className="w-3 h-3" />
                                        Quitter {guildName}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-zinc-900 border-white/10 text-white">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Archiver votre profil sur {guildName} ?</AlertDialogTitle>
                                        <AlertDialogDescription asChild>
                                            <div className="text-zinc-400 space-y-3">
                                                <p>Votre profil de guilde sera <b className="text-zinc-200">archivé</b>, pas supprimé.</p>
                                                <div className="bg-zinc-800/50 rounded-xl p-3 space-y-1.5 text-xs">
                                                    <p className="flex items-center gap-2"><span className="text-emerald-400">✅</span> Vos XP et données sont conservées</p>
                                                    <p className="flex items-center gap-2"><span className="text-emerald-400">✅</span> Vous pouvez rejoindre à tout moment via Discord</p>
                                                    <p className="flex items-center gap-2"><span className="text-amber-400">⚠️</span> Vous perdez l&apos;accès au tableau de bord de cette guilde</p>
                                                    <p className="flex items-center gap-2"><span className="text-blue-400">ℹ️</span> Vos autres guildes ne sont pas affectées</p>
                                                </div>
                                            </div>
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel className="bg-transparent border-white/10">Annuler</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleLeaveGuild}
                                            disabled={isDeleting}
                                            className="bg-zinc-100 text-zinc-950 font-black uppercase tracking-tight hover:bg-white transition-all active:scale-95"
                                        >
                                            Confirmer le départ
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>

                        {/* DELETE ACCOUNT — Dangerous, Permanent */}
                        <div className="p-3 bg-red-500/5 rounded-2xl border border-red-500/10 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-red-400">
                                        <AlertTriangle className="w-3 h-3" />
                                        <h4 className="text-[10px] font-bold uppercase tracking-wider">Zone de danger</h4>
                                        <span className="text-[8px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full border border-red-500/20">Irréversible</span>
                                    </div>
                                    <p className="text-[10px] text-zinc-500 leading-relaxed">
                                        Supprime <b className="text-red-300">définitivement</b> votre compte SigilOS et toutes vos données sur <b className="text-red-300">toutes</b> les guildes.
                                    </p>
                                </div>
                            </div>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm" className="w-full h-8 text-xs gap-2 bg-red-600/80 hover:bg-red-600">
                                        <Trash2 className="w-3 h-3" />
                                        Supprimer mon compte (RGPD)
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-zinc-900 border-red-500/20 text-white">
                                    <AlertDialogHeader>
                                        <div className="p-3 bg-red-500/10 rounded-full w-fit mx-auto mb-4">
                                            <AlertTriangle className="w-8 h-8 text-red-500 animate-pulse" />
                                        </div>
                                        <AlertDialogTitle className="text-center text-xl">Suppression définitive du compte</AlertDialogTitle>
                                        <AlertDialogDescription asChild>
                                            <div className="text-zinc-400 text-center space-y-3">
                                                <p>
                                                    Vous êtes sur le point de <b className="text-red-300">supprimer définitivement</b> votre compte SigilOS.
                                                </p>
                                                <div className="bg-red-950/30 rounded-xl p-3 space-y-1.5 text-xs text-left border border-red-500/10">
                                                    <p className="flex items-center gap-2"><span className="text-red-400">❌</span> Profils supprimés sur <b className="text-red-300">toutes</b> vos guildes</p>
                                                    <p className="flex items-center gap-2"><span className="text-red-400">❌</span> XP, missions, succès, et données effacés</p>
                                                    <p className="flex items-center gap-2"><span className="text-red-400">❌</span> Aucun retour possible (conforme RGPD)</p>
                                                </div>
                                                <p className="text-[10px] text-zinc-600">
                                                    Si vous souhaitez simplement quitter une guilde, utilisez &quot;Quitter la guilde&quot; à la place.
                                                </p>
                                            </div>
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="sm:justify-center gap-3">
                                        <AlertDialogCancel className="bg-transparent border-white/10 sm:w-24">Annuler</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleDeleteAccount}
                                            disabled={isDeleting}
                                            className="bg-red-600 text-white hover:bg-red-500 sm:w-auto"
                                        >
                                            Oui, tout supprimer
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                </div>
            </div>

            <DiscordOwnershipModal
                isOpen={showOwnershipModal}
                onClose={() => setShowOwnershipModal(false)}
                guildName={guildName}
            />
        </div>
    );
}
