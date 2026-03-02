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

                    <div className="space-y-3 pt-4 border-t border-white/5">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 border border-white/5 rounded-2xl bg-white/5 group hover:border-blue-500/30 transition-all duration-300">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                        <Target className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-zinc-200">Missions</p>
                                        <p className="text-[10px] text-zinc-500">Nouvelles missions et validations</p>
                                    </div>
                                </div>
                                <Switch
                                    checked={prefs.missions}
                                    onCheckedChange={(checked) => handleUpdatePrefs({ missions: checked })}
                                    disabled={loading}
                                />
                            </div>

                            <div className="flex items-center justify-between p-3 border border-white/5 rounded-2xl bg-white/5 group hover:border-emerald-500/30 transition-all duration-300">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                        <Flame className="w-5 h-5 text-emerald-400" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-zinc-200">Songes</p>
                                        <p className="text-[10px] text-zinc-500">Candidatures et invitations</p>
                                    </div>
                                </div>
                                <Switch
                                    checked={prefs.songes}
                                    onCheckedChange={(checked) => handleUpdatePrefs({ songes: checked })}
                                    disabled={loading}
                                />
                            </div>

                            <div className="flex items-center justify-between p-3 border border-white/5 rounded-2xl bg-white/5 group hover:border-indigo-500/30 transition-all duration-300">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                                        <Swords className="w-5 h-5 text-indigo-400" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-zinc-200">Donjons &amp; Quêtes</p>
                                        <p className="text-[10px] text-zinc-500">Quelqu&rsquo;un rejoint ton groupe</p>
                                    </div>
                                </div>
                                <Switch
                                    checked={prefs.donjons}
                                    onCheckedChange={(checked) => handleUpdatePrefs({ donjons: checked })}
                                    disabled={loading}
                                />
                            </div>

                            <div className="flex items-center justify-between p-3 border border-white/5 rounded-2xl bg-white/5 group hover:border-purple-500/30 transition-all duration-300">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                        <Calendar className="w-5 h-5 text-purple-400" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-zinc-200">Événements</p>
                                        <p className="text-[10px] text-zinc-500">Rappels et invitations de guilde</p>
                                    </div>
                                </div>
                                <Switch
                                    checked={prefs.events}
                                    onCheckedChange={(checked) => handleUpdatePrefs({ events: checked })}
                                    disabled={loading}
                                />
                            </div>

                            <div className="flex items-center justify-between p-3 border border-white/5 rounded-2xl bg-white/5 group hover:border-red-500/30 transition-all duration-300">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                                        <Trophy className="w-5 h-5 text-red-400" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-zinc-200">Succès & Ladder</p>
                                        <p className="text-[10px] text-zinc-500">Validations de succès et rangs</p>
                                    </div>
                                </div>
                                <Switch
                                    checked={prefs.ladder}
                                    onCheckedChange={(checked) => handleUpdatePrefs({ ladder: checked })}
                                    disabled={loading}
                                />
                            </div>

                            <div className="flex items-center justify-between p-3 border border-white/5 rounded-2xl bg-white/5 group hover:border-orange-500/30 transition-all duration-300">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                                        <PieChart className="w-5 h-5 text-orange-400" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-zinc-200">Sondages</p>
                                        <p className="text-[10px] text-zinc-500">Nouveaux sondages et résultats</p>
                                    </div>
                                </div>
                                <Switch
                                    checked={prefs.polls}
                                    onCheckedChange={(checked) => handleUpdatePrefs({ polls: checked })}
                                    disabled={loading}
                                />
                            </div>

                            <div className="flex items-center justify-between p-3 border border-white/5 rounded-2xl bg-white/5 group hover:border-emerald-700/30 transition-all duration-300">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-700/10 flex items-center justify-center">
                                        <Trophy className="w-5 h-5 text-emerald-500" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-zinc-200">Quête Ocre</p>
                                        <p className="text-[10px] text-zinc-500">Demandes d'échange</p>
                                    </div>
                                </div>
                                <Switch
                                    checked={prefs.ocre}
                                    onCheckedChange={(checked) => handleUpdatePrefs({ ocre: checked })}
                                    disabled={loading}
                                />
                            </div>

                            {isAdmin && (
                                <div className="flex items-center justify-between p-3 border border-white/5 rounded-2xl bg-zinc-400/5 group hover:border-zinc-300/30 transition-all duration-300">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-zinc-400/10 flex items-center justify-center">
                                            <ShieldCheck className="w-5 h-5 text-zinc-400" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-zinc-200">Alertes Admin</p>
                                            <p className="text-[10px] text-zinc-500">Validations de missions en attente</p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={prefs.admin_validations}
                                        onCheckedChange={(checked) => handleUpdatePrefs({ admin_validations: checked })}
                                        disabled={loading}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* GDPR / LIFECYCLE SECTION */}
                <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/10 rounded-xl">
                            <ShieldAlert className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Sécurité & Vie Privée</h3>
                            <p className="text-sm text-zinc-400">Gérez votre présence</p>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-white/5">
                        {/* DISCORD RICH PRESENCE */}
                        <div className="flex items-center justify-between p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 group hover:border-indigo-500/30 transition-all">
                            <div className="space-y-1">
                                <Label htmlFor="show-presence" className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">
                                    Discord Rich Presence
                                </Label>
                                <p className="text-[10px] text-zinc-500 leading-tight">
                                    Affiche si vous jouez à Dofus dans le chat (🟢/⚫).
                                </p>
                            </div>
                            <Switch
                                id="show-presence"
                                checked={showPresence}
                                onCheckedChange={onPresenceToggle}
                            />
                        </div>

                        {/* LEAVE GUILD */}
                        <div className="p-3 bg-zinc-900/40 rounded-2xl border border-white/5 space-y-3">
                            <div className="space-y-1">
                                <h4 className="text-sm font-semibold text-zinc-200">Quitter la guilde</h4>
                                <p className="text-[10px] text-zinc-500">
                                    Archive votre profil pour <b>{guildName}</b>.
                                </p>
                            </div>

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="w-full h-8 text-xs border-zinc-700 hover:bg-zinc-800 gap-2">
                                        <UserMinus className="w-3 h-3" />
                                        Quitter la guilde
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-zinc-900 border-white/10 text-white">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Quitter la guilde ?</AlertDialogTitle>
                                        <AlertDialogDescription className="text-zinc-400">
                                            Cette action mettra vote profil en sommeil. Vous ne pourrez plus accéder au tableau de bord de {guildName} à moins de rejoindre à nouveau via Discord.
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

                        {/* DELETE ACCOUNT */}
                        <div className="p-3 bg-red-500/5 rounded-2xl border border-red-500/10 space-y-3">
                            <div className="flex items-center gap-2 text-red-400">
                                <AlertTriangle className="w-3 h-3" />
                                <h4 className="text-[10px] font-bold uppercase tracking-wider">Zone de danger</h4>
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
                                        <AlertDialogTitle className="text-center text-xl">Suppression irréversible</AlertDialogTitle>
                                        <AlertDialogDescription className="text-zinc-400 text-center">
                                            Êtes-vous certain de vouloir supprimer totalement votre compte ? <br />
                                            <span className="text-red-400 font-bold mt-2 block">Toutes vos réussites seront effacées définitivement.</span>
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
