"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Lock, ArrowLeft, MessageSquare, Archive } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { useSession } from "next-auth/react";
import { RefreshCcw } from "lucide-react";
import { useTransition } from "react";
import { useRouter, useParams } from "next/navigation";
import { revalidateUserContext } from "@/server/actions/user-actions";
import { requestProfileReactivation } from "@/server/actions/lifecycle-actions";
import { toast } from "sonner";
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface AccessDeniedProps {
    title?: string;
    message?: string;
    variant?: "lock" | "ban" | "archive";
    action?: React.ReactNode;
    countdownDate?: string | null;
    guildId?: string; // Optional, to help re-sync specific guild
    hasPendingReactivation?: boolean;
}

import { useState, useEffect } from "react";

function Countdown({ date }: { date: string }) {
    const [timeLeft, setTimeLeft] = useState<string>("");

    useEffect(() => {
        const target = new Date(date).getTime();

        const update = () => {
            const now = new Date().getTime();
            const diff = target - now;

            if (diff <= 0) {
                setTimeLeft("Suppression imminente...");
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            if (days > 0) {
                setTimeLeft(`${days}j ${hours}h ${minutes}m`);
            } else {
                setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
            }
        };

        update();
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, [date]);

    return (
        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl animate-pulse">
            <p className="text-caption font-semibold uppercase tracking-wide text-amber-500">
                ⚠️ Suppression définitive des données dans
            </p>
            <p className="text-xl font-black text-amber-400 tabular-nums">
                {timeLeft}
            </p>
        </div>
    );
}

export function AccessDenied({
    title = "Accès Restreint",
    message = "Vous n'avez pas les permissions nécessaires pour accéder à cette ressource.",
    variant = "lock",
    action,
    countdownDate,
    guildId,
    hasPendingReactivation = false
}: AccessDeniedProps) {
    const { data: session } = useSession();
    const [isPending, startTransition] = useTransition();
    const [isRequesting, setIsRequesting] = useState(false);
    const [hasRequested, setHasRequested] = useState(hasPendingReactivation);
    const [showModal, setShowModal] = useState(false);
    const [pseudo, setPseudo] = useState("");
    const [reason, setReason] = useState("");
    const router = useRouter();
    const params = useParams();

    const effectiveGuildId = guildId || (params?.guildId as string);

    const handleSync = () => {
        startTransition(async () => {
            const res = await revalidateUserContext(effectiveGuildId);
            if (res.success) {
                toast.success("Synchronisation effectuée. Vérification en cours...");
                // Reload the current page to pick up fresh data
                window.location.reload();
            } else {
                toast.error(res.error || "Échec de la synchronisation");
            }
        });
    };

    const handleRequestReactivation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!effectiveGuildId || !reason.trim()) return;
        
        setIsRequesting(true);
        try {
            const res = await requestProfileReactivation(effectiveGuildId, pseudo, reason);
            if (res.success) {
                toast.success("Demande envoyée au Staff ! Vous recevrez une notification sur le Dashboard dès validation.");
                setHasRequested(true);
                setShowModal(false);
            } else {
                toast.error(res.error || "Erreur lors de la demande");
            }
        } catch (error) {
            toast.error("Échec de l'envoi de la demande");
        } finally {
            setIsRequesting(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-center relative overflow-hidden">
            <PublicHeader user={session?.user} isMember={false} clientId={effectiveGuildId} />

            <div className="relative z-10 space-y-8 max-w-md w-full animate-in fade-in zoom-in duration-200">
                <div className="mx-auto">
                    <div className="relative bg-zinc-900/50 p-6 rounded-2xl border border-white/5 shadow-lg backdrop-blur-xl">
                        {variant === "lock" ? (
                            <Lock className="w-14 h-14 text-zinc-400" />
                        ) : variant === "archive" ? (
                            <Archive className="w-14 h-14 text-amber-400" />
                        ) : (
                            <ShieldAlert className="w-14 h-14 text-red-400" />
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <h1 className="text-display-xl font-bold text-white font-heading leading-tight">
                        {title}
                    </h1>
                    <p className="text-zinc-400 text-lg leading-relaxed px-4">
                        {message}
                    </p>

                    {countdownDate && (
                        <div className="px-8">
                            <Countdown date={countdownDate} />
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-4 pt-4 px-6">
                    <div className="flex items-center gap-3">
                        <Button variant="outline" asChild className="flex-1 h-12 rounded-lg border-white/10 hover:bg-white/5 text-zinc-300 font-semibold text-sm">
                            <Link href="/">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Accueil
                            </Link>
                        </Button>
                        {action}
                    </div>

                    {variant === "archive" && !hasRequested && (
                        <Dialog open={showModal} onOpenChange={setShowModal}>
                            <DialogTrigger asChild>
                                <Button 
                                    className="h-12 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm"
                                >
                                    <RefreshCcw className="w-4 h-4 mr-2" />
                                    Demander ma réintégration
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-zinc-900 border-white/10 text-white sm:max-w-[425px]">
                                <DialogHeader>
                                    <DialogTitle className="text-title font-bold">Demande de Réintégration</DialogTitle>
                                    <DialogDescription className="text-zinc-400">
                                        Expliquez brièvement pourquoi vous souhaitez revenir parmi nous. Un membre du Staff étudiera votre demande.
                                    </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleRequestReactivation} className="space-y-6 pt-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="pseudo" className="text-label font-medium text-zinc-400">Pseudo Dofus (Optionnel)</Label>
                                        <Input 
                                            id="pseudo"
                                            placeholder="Ex: Mon-Pseudo"
                                            value={pseudo}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                // Only allow letters, spaces, hyphens and square brackets
                                                const cleaned = val.replace(/[^a-zA-Z\u00C0-\u017F\u00DF\u00FF\u0100-\u017F\s-\[\]]/g, "");
                                                setPseudo(cleaned);
                                            }}
                                            className="bg-black/40 border-white/10 h-12 rounded-xl focus:ring-emerald-500/50"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="reason" className="text-label font-medium text-zinc-400">Votre Message (Obligatoire)</Label>
                                        <Textarea 
                                            id="reason"
                                            required
                                            maxLength={1000}
                                            placeholder="Expliquez vos motivations..."
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                            className="min-h-[120px] bg-black/40 border-white/10 rounded-xl focus:ring-emerald-500/50 resize-none"
                                        />
                                        <p className="text-[10px] text-right text-zinc-600 font-medium">
                                            {reason.length} / 1000 caractères
                                        </p>
                                    </div>
                                    <DialogFooter>
                                        <Button 
                                            type="submit" 
                                            disabled={isRequesting || !reason.trim()}
                                            className="w-full h-12 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm"
                                        >
                                            {isRequesting ? (
                                                <>
                                                    <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                                                    Envoi en cours...
                                                </>
                                            ) : (
                                                "Envoyer la demande"
                                            )}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    )}

                    {variant === "archive" && hasRequested && (
                        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-sm animate-in fade-in slide-in-from-bottom-4">
                            ✅ Demande envoyée ! Le Staff va l'étudier.
                        </div>
                    )}

                    <p className="text-xs text-zinc-600 font-medium">Besoin d'aide ?</p>

                    <Button asChild className="h-12 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold text-sm">
                        <Link href="https://discord.gg/uX7G6SUDgN" target="_blank">
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Contacter le Support
                        </Link>
                    </Button>

                    {variant === "lock" && (
                        <Button 
                            variant="ghost" 
                            disabled={isPending}
                            onClick={handleSync}
                            className="h-12 rounded-lg border border-white/5 hover:bg-white/5 text-zinc-400 hover:text-white font-medium text-xs"
                        >
                            <RefreshCcw className={`w-3 h-3 mr-2 ${isPending ? 'animate-spin' : ''}`} />
                            {isPending ? "Synchronisation en cours..." : "Je viens de rejoindre (Synchroniser)"}
                        </Button>
                    )}
                </div>

                <div className="pt-8 border-t border-white/5 w-full">
                    <div className="flex items-center justify-center gap-2 text-caption text-zinc-600 uppercase tracking-wider font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500/50 animate-pulse"></span>
                        <span>Secteur Sécurisé</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
