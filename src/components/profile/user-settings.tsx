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
import { signOut } from "next-auth/react";
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

    const [archiveDuration, setArchiveDuration] = useState<number>(3); // Default 3 months

    const handleLeaveGuild = async () => {
        setIsDeleting(true);
        try {
            const res = await archiveProfile(guildId, undefined, archiveDuration);
            if (res.success) {
                toast.success(`Profil archivé. Redirection...`);
                // Use hard redirect to clear all client-side state/caches.
                // → /dashboard/{guildId} (et non /dashboard) pour afficher la page
                // « Compte Archivé » avec « Demander ma réintégration » ; le sélecteur
                // /dashboard exclut les guildes archivées → landing « Prenez les commandes ».
                window.location.href = `/dashboard/${guildId}`;
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
                toast.success("Compte supprimé définitivement. Déconnexion...");
                // Clear cookies and force hard redirect to home
                await signOut({ redirect: false });
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
        <div className="flex flex-col gap-8">
            {/* TOP ROW: Performance & Notifications */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* PERFORMANCE SECTION */}
                <div className="bg-black/40 backdrop-blur-md border border-border rounded-3xl p-6 shadow-xl space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-warning/10 rounded-xl">
                            <Zap className="w-5 h-5 text-warning" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground">Interface & Performance</h3>
                            <p className="text-sm text-muted-foreground">Optimisez votre lecture</p>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-border">
                        <div className="flex items-center justify-between p-4 bg-surface rounded-2xl border border-border group hover:border-warning/30 transition-all">
                            <div className="space-y-1">
                                <Label htmlFor="perf-mode" className="text-sm font-medium text-foreground group-hover:text-foreground transition-colors">
                                    Mode Performance
                                </Label>
                                <p className="text-caption text-muted-foreground leading-tight">
                                    Réduit les animations et flous.
                                </p>
                            </div>
                            <Switch
                                id="perf-mode"
                                checked={performanceMode}
                                onCheckedChange={togglePerformanceMode}
                            />
                        </div>

                        <div className="flex items-start gap-3 p-4 bg-info/5 rounded-2xl border border-info/10">
                            <Info className="w-5 h-5 text-info mt-0.5" />
                            <p className="text-xs text-info/80 leading-relaxed">
                                Ce réglage est sauvegardé localement sur ce navigateur. Il n'affecte pas votre profil sur d'autres appareils.
                            </p>
                        </div>
                    </div>
                </div>

                {/* NOTIFICATIONS SECTION */}
                <div className="bg-black/40 backdrop-blur-md border border-border rounded-3xl p-6 shadow-xl space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-info/10 rounded-xl">
                            <Bell className="w-5 h-5 text-info" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground">Notifications</h3>
                            <p className="text-sm text-muted-foreground">Gérez vos alertes in-app</p>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-border">
                        <TooltipProvider delayDuration={0}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {/* MISSIONS */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center justify-between p-2.5 border border-border rounded-2xl bg-surface group hover:border-info/30 transition-all cursor-default">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center shrink-0">
                                                <Target className="w-4 h-4 text-info" />
                                            </div>
                                            <div className="min-w-0 pr-2">
                                                <p className="text-caption font-semibold text-foreground truncate">Missions</p>
                                                <p className="text-caption text-muted-foreground truncate">Nouvelles & validations</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={prefs.missions}
                                            onCheckedChange={(checked) => handleUpdatePrefs({ missions: checked })}
                                            disabled={loading}
                                        />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-surface border-border text-foreground font-bold uppercase tracking-wider text-caption px-3 py-1.5 shadow-xl">
                                    Notifications Missions
                                </TooltipContent>
                            </Tooltip>

                            {/* SONGES */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center justify-between p-2.5 border border-border rounded-2xl bg-surface group hover:border-success/30 transition-all cursor-default">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                                                <Flame className="w-4 h-4 text-success" />
                                            </div>
                                            <div className="min-w-0 pr-2">
                                                <p className="text-caption font-semibold text-foreground truncate">Songes</p>
                                                <p className="text-caption text-muted-foreground truncate">Invitations & candidatures</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={prefs.songes}
                                            onCheckedChange={(checked) => handleUpdatePrefs({ songes: checked })}
                                            disabled={loading}
                                        />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-surface border-border text-foreground font-bold uppercase tracking-wider text-caption px-3 py-1.5 shadow-xl">
                                    Notifications Songes
                                </TooltipContent>
                            </Tooltip>

                            {/* DONJONS */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center justify-between p-2.5 border border-border rounded-2xl bg-surface group hover:border-info/30 transition-all cursor-default">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center shrink-0">
                                                <Swords className="w-4 h-4 text-info" />
                                            </div>
                                            <div className="min-w-0 pr-2">
                                                <p className="text-caption font-semibold text-foreground truncate">Donjons & Quêtes</p>
                                                <p className="text-caption text-muted-foreground truncate">Entrée en groupe</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={prefs.donjons}
                                            onCheckedChange={(checked) => handleUpdatePrefs({ donjons: checked })}
                                            disabled={loading}
                                        />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-surface border-border text-foreground font-bold uppercase tracking-wider text-caption px-3 py-1.5 shadow-xl">
                                    Notifications Donjons
                                </TooltipContent>
                            </Tooltip>

                            {/* EVENTS */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center justify-between p-2.5 border border-border rounded-2xl bg-surface group hover:border-info/30 transition-all cursor-default">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center shrink-0">
                                                <Calendar className="w-4 h-4 text-info" />
                                            </div>
                                            <div className="min-w-0 pr-2">
                                                <p className="text-caption font-semibold text-foreground truncate">Événements</p>
                                                <p className="text-caption text-muted-foreground truncate">Rappels de guilde</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={prefs.events}
                                            onCheckedChange={(checked) => handleUpdatePrefs({ events: checked })}
                                            disabled={loading}
                                        />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-surface border-border text-foreground font-bold uppercase tracking-wider text-caption px-3 py-1.5 shadow-xl">
                                    Notifications Événements
                                </TooltipContent>
                            </Tooltip>

                            {/* LADDER */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center justify-between p-2.5 border border-border rounded-2xl bg-surface group hover:border-danger/30 transition-all cursor-default">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <div className="w-8 h-8 rounded-lg bg-danger/10 flex items-center justify-center shrink-0">
                                                <Trophy className="w-4 h-4 text-danger" />
                                            </div>
                                            <div className="min-w-0 pr-2">
                                                <p className="text-caption font-semibold text-foreground truncate">Succès & Ladder</p>
                                                <p className="text-caption text-muted-foreground truncate">Validations & rangs</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={prefs.ladder}
                                            onCheckedChange={(checked) => handleUpdatePrefs({ ladder: checked })}
                                            disabled={loading}
                                        />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-surface border-border text-foreground font-bold uppercase tracking-wider text-caption px-3 py-1.5 shadow-xl">
                                    Notifications Classement
                                </TooltipContent>
                            </Tooltip>

                            {/* POLLS */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center justify-between p-2.5 border border-border rounded-2xl bg-surface group hover:border-orange-500/30 transition-all cursor-default">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                                                <PieChart className="w-4 h-4 text-orange-400" />
                                            </div>
                                            <div className="min-w-0 pr-2">
                                                <p className="text-caption font-semibold text-foreground truncate">Sondages</p>
                                                <p className="text-caption text-muted-foreground truncate">Nouveaux votes</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={prefs.polls}
                                            onCheckedChange={(checked) => handleUpdatePrefs({ polls: checked })}
                                            disabled={loading}
                                        />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-surface border-border text-foreground font-bold uppercase tracking-wider text-caption px-3 py-1.5 shadow-xl">
                                    Notifications Sondages
                                </TooltipContent>
                            </Tooltip>

                            {/* OCRE */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center justify-between p-2.5 border border-border rounded-2xl bg-surface group hover:border-success/30 transition-all cursor-default">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                                                <Trophy className="w-4 h-4 text-success" />
                                            </div>
                                            <div className="min-w-0 pr-2">
                                                <p className="text-caption font-semibold text-foreground truncate">Quête Ocre</p>
                                                <p className="text-caption text-muted-foreground truncate">Échanges</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={prefs.ocre}
                                            onCheckedChange={(checked) => handleUpdatePrefs({ ocre: checked })}
                                            disabled={loading}
                                        />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-surface border-border text-foreground font-bold uppercase tracking-wider text-caption px-3 py-1.5 shadow-xl">
                                    Notifications Échanges Ocre
                                </TooltipContent>
                            </Tooltip>

                            {isAdmin && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex items-center justify-between p-2.5 border border-border rounded-2xl bg-zinc-400/5 group hover:border-border/30 transition-all cursor-default">
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                <div className="w-8 h-8 rounded-lg bg-zinc-400/10 flex items-center justify-center shrink-0">
                                                    <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                                                </div>
                                                <div className="min-w-0 pr-2">
                                                    <p className="text-caption font-semibold text-foreground truncate">Alertes Admin</p>
                                                    <p className="text-caption text-muted-foreground truncate">Missions en attente</p>
                                                </div>
                                            </div>
                                            <Switch
                                                checked={prefs.admin_validations}
                                                onCheckedChange={(checked) => handleUpdatePrefs({ admin_validations: checked })}
                                                disabled={loading}
                                            />
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="bg-surface border-border text-foreground font-bold uppercase tracking-wider text-caption px-3 py-1.5 shadow-xl">
                                        Notifications Administration
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </div>
                        </TooltipProvider>
                    </div>
                </div>

            </div>

            {/* BOTTOM ROW: GDPR / LIFECYCLE SECTION (Full width, divided in 2) */}
            <div className="bg-black/40 backdrop-blur-md border border-border rounded-3xl p-4 sm:p-6 lg:p-8 shadow-xl space-y-8">
                <div className="flex items-center gap-4 border-b border-border pb-6">
                    <div className="p-3 bg-danger/10 rounded-2xl border border-danger/20">
                        <ShieldAlert className="w-6 h-6 text-danger" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-foreground">Gestion du Compte & Confidentialité (RGPD)</h3>
                        <p className="text-sm text-muted-foreground">Prenez le contrôle de vos données personnelles et de votre présence sur SigilOS</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 items-stretch">
                    {/* LEAVE GUILD — Safe, Reversible */}
                    <div className="flex flex-col p-5 sm:p-6 lg:p-8 bg-surface/60 rounded-3xl border border-success/20 hover:border-success/40 transition-all relative overflow-hidden group shadow-lg">
                        <div className="absolute -top-10 -right-10 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none rotate-12">
                            <UserMinus className="w-64 h-64 text-success" />
                        </div>
                        
                        <div className="flex-1 space-y-4 relative z-10">
                            <div className="flex items-center gap-3">
                                <span className="text-caption font-black uppercase tracking-widest text-success bg-success/10 px-2.5 py-1 rounded-full border border-success/20">
                                    Action Réversible
                                </span>
                            </div>
                            
                            <div>
                                <h4 className="text-2xl font-bold text-foreground mb-2">Archiver mon profil</h4>
                                <p className="text-sm text-muted-foreground leading-relaxed text-balance">
                                    Mettez votre profil en pause uniquement pour la guilde <b className="text-foreground">{guildName}</b>. Vos points d'expérience, missions et inventaires sont soigneusement conservés en sécurité pendant une durée configurée au cas où vous changeriez d'avis. 
                                </p>
                            </div>
                            
                            <ul className="space-y-2 mt-4 text-sm text-foreground">
                                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-success" /> Vous conservez vos données intactes</li>
                                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-success" /> Vos autres guildes fonctionnent toujours</li>
                                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-success" /> Réactivation sur simple demande</li>
                            </ul>
                        </div>

                        <div className="mt-8 pt-6 border-t border-border relative z-10">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="sigil-destructive" className="w-full h-auto min-h-[3rem] py-2 whitespace-normal text-caption sm:text-xs md:text-sm gap-2 font-bold bg-surface hover:bg-success/20 text-foreground hover:text-success border border-border hover:border-success/50 transition-all flex items-center justify-center text-center">
                                        <UserMinus className="w-4 h-4 shrink-0" />
                                        ARCHIVER MON PROFIL SUR <span className="block sm:inline">{guildName.toUpperCase()}</span>
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-surface border-border text-foreground">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Archiver votre profil sur {guildName} ?</AlertDialogTitle>
                                        <AlertDialogDescription asChild>
                                            <div className="text-muted-foreground space-y-3">
                                                <p>Votre profil de guilde sera <b className="text-foreground">archivé</b>, pas supprimé.</p>
                                                <div className="bg-elevated/50 rounded-xl p-3 space-y-1.5 text-xs">
                                                    <p className="flex items-center gap-2"><span className="text-success">✅</span> Vos XP et données sont conservées</p>
                                                    <p className="flex items-center gap-2"><span className="text-success">✅</span> Vous pouvez rejoindre à tout moment via Discord</p>
                                                    <p className="flex items-center gap-2"><span className="text-warning">⚠️</span> Vous perdez l&apos;accès au tableau de bord de cette guilde</p>
                                                    <p className="flex items-center gap-2"><span className="text-info">ℹ️</span> Vos autres guildes ne sont pas affectées</p>
                                                </div>
                                                <div className="pt-2 space-y-2">
                                                    <p className="text-xs font-bold text-foreground">Durée d'archivage (avant suppression définitive) :</p>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {[3, 6, 12].map(duration => (
                                                            <button
                                                                key={duration}
                                                                type="button"
                                                                onClick={() => setArchiveDuration(duration)}
                                                                className={`p-2 rounded-xl text-xs font-bold transition-all border ${
                                                                    archiveDuration === duration 
                                                                        ? "bg-success/20 text-success border-success/50 ring-1 ring-success/30" 
                                                                        : "bg-elevated/50 text-muted-foreground border-border hover:bg-surface"
                                                                }`}
                                                            >
                                                                {duration} Mois
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel className="bg-transparent border-border">Annuler</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleLeaveGuild}
                                            disabled={isDeleting}
                                            variant="sigil-destructive"
                                            className="h-10 px-6"
                                        >
                                            Confirmer l'archivage
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>

                    {/* DELETE ACCOUNT — Dangerous, Permanent */}
                    <div className="flex flex-col p-5 sm:p-6 lg:p-8 bg-black/60 rounded-3xl border border-danger/30 hover:border-danger/60 transition-all relative overflow-hidden group  ">
                        <div className="absolute -top-10 -right-10 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none rotate-12">
                            <Trash2 className="w-64 h-64 text-danger" />
                        </div>
                        
                        <div className="flex-1 space-y-4 relative z-10">
                            <div className="flex items-center gap-3">
                                <span className="text-caption font-black uppercase tracking-widest text-danger bg-danger/10 px-2.5 py-1 rounded-full border border-danger/20 flex items-center gap-1.5">
                                    <AlertTriangle className="w-3 h-3" />
                                    Action Irréversible
                                </span>
                            </div>
                            
                            <div>
                                <h4 className="text-2xl font-bold text-foreground mb-2">Suppression Définitive</h4>
                                <p className="text-sm text-muted-foreground leading-relaxed text-balance">
                                    Supprime intégralement et <b className="text-danger">définitivement</b> votre compte SigilOS de nos serveurs. Cette action s'applique à <b className="text-danger">toutes vos guildes</b> simultanément et détruit la totalité de vos données.
                                </p>
                            </div>
                            
                            <ul className="space-y-2 mt-4 text-sm text-foreground">
                                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-danger" /> Profils oblitérés sur TOUTES les guildes</li>
                                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-danger" /> Perte irrécupérable de l'XP et des succès</li>
                                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-danger" /> Impossible d'annuler (Droit à l'oubli RGPD)</li>
                            </ul>
                        </div>

                        <div className="mt-8 pt-6 border-t border-danger/10 relative z-10">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="sigil-destructive" className="w-full h-auto min-h-[3rem] py-2 whitespace-normal text-caption sm:text-xs md:text-sm gap-2 font-bold bg-danger/10 hover:bg-danger text-danger hover:text-foreground border border-danger/30 transition-all flex items-center justify-center text-center">
                                        <Trash2 className="w-4 h-4 shrink-0" />
                                        SUPPRIMER MON COMPTE SIGILOS
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-surface border-danger/20 text-foreground">
                                    <AlertDialogHeader>
                                        <div className="p-3 bg-danger/10 rounded-full w-fit mx-auto mb-4 border border-danger/20">
                                            <AlertTriangle className="w-8 h-8 text-danger animate-pulse" />
                                        </div>
                                        <AlertDialogTitle className="text-center text-xl">Droit à l'oubli total (RGPD)</AlertDialogTitle>
                                        <AlertDialogDescription asChild>
                                            <div className="text-muted-foreground text-center space-y-3">
                                                <p>
                                                    Vous êtes sur le point de procéder à la <b className="text-danger">suppression pure et définitive</b> de votre identité SigilOS globale.
                                                </p>
                                                <div className="bg-black/50 rounded-xl p-4 space-y-2 text-xs text-left border border-danger/20 shadow-inner">
                                                    <p className="flex items-center gap-2"><span className="text-danger border border-danger/20 bg-danger/10 rounded p-0.5">X</span> Effacement sur <b className="text-foreground">TOUTES</b> vos guildes</p>
                                                    <p className="flex items-center gap-2"><span className="text-danger border border-danger/20 bg-danger/10 rounded p-0.5">X</span> Destruction des données (XP, Inventaires)</p>
                                                    <p className="flex items-center gap-2"><span className="text-danger border border-danger/20 bg-danger/10 rounded p-0.5">X</span> Irrécupérable même par notre support</p>
                                                </div>
                                                <p className="text-caption text-muted-foreground pt-2 italic">
                                                    Si vous souhaitez juste faire une pause sur une guilde spécifique, fermez cette fenêtre et utilisez la fonction d'Archivage à la place.
                                                </p>
                                            </div>
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="sm:justify-center gap-3">
                                        <AlertDialogCancel className="bg-elevated text-foreground border-border hover:bg-muted sm:w-32">Annuler</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleDeleteAccount}
                                            disabled={isDeleting}
                                            variant="sigil-destructive"
                                            className="h-10 px-8 bg-danger hover:bg-danger font-bold "
                                        >
                                            OUI, TOUT SUPPRIMER
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
