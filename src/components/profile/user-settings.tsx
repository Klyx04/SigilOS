"use client";

import { useState, useEffect } from "react";
import {
    AlertTriangle,
    Zap,
    ZapOff,
    UserMinus,
    Trash2,
    ArrowRightCircle,
    ShieldAlert,
    Info
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

interface UserSettingsProps {
    guildId: string;
    guildName: string;
    profileId: string;
}

export function UserSettings({ guildId, guildName, profileId }: UserSettingsProps) {
    const [performanceMode, setPerformanceMode] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showOwnershipModal, setShowOwnershipModal] = useState(false);
    const router = useRouter();

    // Load performance mode from localStorage
    useEffect(() => {
        const saved = localStorage.getItem("sigilos-performance-mode") === "true";
        setPerformanceMode(saved);
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
                window.location.href = "/"; // Global redirect to home
            } else {
                // Check if the error is about ownership to show the tutorial modal
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* PERFORMANCE SECTION */}
            <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/10 rounded-xl">
                        <Zap className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Interface & Performance</h3>
                        <p className="text-sm text-zinc-400">Optimisez votre expérience visuelle</p>
                    </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-amber-500/30 transition-all">
                        <div className="space-y-1">
                            <Label htmlFor="perf-mode" className="text-base font-medium text-zinc-200 group-hover:text-white transition-colors">
                                Mode Performance
                            </Label>
                            <p className="text-xs text-zinc-500">
                                Réduit les animations et les effets de flou pour une navigation plus fluide sur les appareils modestes.
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

            {/* GDPR / LIFECYCLE SECTION */}
            <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-500/10 rounded-xl">
                        <ShieldAlert className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Sécurité & Vie Privée</h3>
                        <p className="text-sm text-zinc-400">Gérez votre présence sur SigilOS</p>
                    </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                    {/* LEAVE GUILD */}
                    <div className="p-4 bg-zinc-900/40 rounded-2xl border border-white/5 space-y-4">
                        <div className="space-y-1">
                            <h4 className="text-sm font-semibold text-zinc-200">Quitter la guilde</h4>
                            <p className="text-xs text-zinc-500">
                                Archive votre profil pour <b>{guildName}</b>. Vos données seront conservées 90 jours avant suppression définitive, sauf si vous revenez.
                            </p>
                        </div>

                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="w-full border-zinc-700 hover:bg-zinc-800 gap-2">
                                    <UserMinus className="w-4 h-4" />
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

                    {/* DELETE ACCOUNT (THE NUCLEAR OPTION) */}
                    <div className="p-4 bg-red-500/5 rounded-2xl border border-red-500/10 space-y-4">
                        <div className="flex items-center gap-2 text-red-400">
                            <AlertTriangle className="w-4 h-4" />
                            <h4 className="text-sm font-bold uppercase tracking-wider">Zone de danger</h4>
                        </div>
                        <p className="text-xs text-zinc-500">
                            Supprime définitivement votre compte SigilOS et <b>toutes vos données de profil</b> sur toutes les guildes. Cette action est irréversible.
                        </p>

                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" className="w-full gap-2 bg-red-600/80 hover:bg-red-600">
                                    <Trash2 className="w-4 h-4" />
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
                                        <span className="text-red-400 font-bold mt-2 block">Toutes vos réussites, vos stuffs et vos participations seront effacés définitivement (RGPD).</span>
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

            <DiscordOwnershipModal
                isOpen={showOwnershipModal}
                onClose={() => setShowOwnershipModal(false)}
                guildName={guildName}
            />
        </div>
    );
}
