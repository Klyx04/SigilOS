"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Lock, ArrowLeft, MessageSquare, Archive, Clock } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { useSession } from "next-auth/react";
import { RefreshCcw } from "lucide-react";
import { useTransition } from "react";
import { useParams } from "next/navigation";
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
    variant?: "lock" | "ban" | "archive" | "timeout";
    action?: React.ReactNode;
    countdownDate?: string | null;
    countdownLabel?: string;
    expiredLabel?: string;
    guildId?: string; // Optional, to help re-sync specific guild
    hasPendingReactivation?: boolean;
}

import { useState, useEffect } from "react";

function Countdown({ date, label = "Suppression définitive des données dans", expiredLabel = "Suppression imminente..." }: { date: string; label?: string; expiredLabel?: string }) {
    const [timeLeft, setTimeLeft] = useState<string>("");

    useEffect(() => {
        const target = new Date(date).getTime();

        const update = () => {
            const now = new Date().getTime();
            const diff = target - now;

            if (diff <= 0) {
                setTimeLeft(expiredLabel);
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
    }, [date, expiredLabel]);

    return (
        <div className="mt-4 rounded-[6px] border border-warning/30 bg-warning/10 p-3">
            <p className="text-caption font-semibold uppercase tracking-wide text-warning">
                {label}
            </p>
            <p className="text-title font-bold tabular-nums text-foreground">
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
    countdownLabel,
    expiredLabel,
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
        } catch {
            toast.error("Échec de l'envoi de la demande");
        } finally {
            setIsRequesting(false);
        }
    };

    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center bg-background text-center">
            <PublicHeader user={session?.user} isMember={false} clientId={effectiveGuildId} />

            <div className="w-full max-w-md space-y-8 px-6 py-10">
                {/* Statut : l'icône dit l'état — pas de cadre, pas de halo, pas d'animation. */}
                {variant === "lock" ? (
                    <Lock className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
                ) : variant === "archive" ? (
                    <Archive className="mx-auto h-12 w-12 text-warning" aria-hidden="true" />
                ) : variant === "timeout" ? (
                    <Clock className="mx-auto h-12 w-12 text-warning" aria-hidden="true" />
                ) : (
                    <ShieldAlert className="mx-auto h-12 w-12 text-danger" aria-hidden="true" />
                )}

                <div className="space-y-3">
                    <h1 className="font-heading text-display-xl font-bold leading-tight text-foreground">
                        {title}
                    </h1>
                    <p className="text-body-sm leading-relaxed text-muted-foreground">
                        {message}
                    </p>

                    {countdownDate && (
                        <Countdown date={countdownDate} label={countdownLabel} expiredLabel={expiredLabel} />
                    )}
                </div>

                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                        <Button variant="outline" asChild className="flex-1">
                            <Link href="/">
                                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                                Accueil
                            </Link>
                        </Button>
                        {action}
                    </div>

                    {variant === "archive" && !hasRequested && (
                        <Dialog open={showModal} onOpenChange={setShowModal}>
                            <DialogTrigger asChild>
                                <Button 
                                >
                                    <RefreshCcw className="w-4 h-4 mr-2" />
                                    Demander ma réintégration
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                    <DialogTitle className="text-title font-bold">Demande de Réintégration</DialogTitle>
                                    <DialogDescription>
                                        Expliquez brièvement pourquoi vous souhaitez revenir parmi nous. Un membre du Staff étudiera votre demande.
                                    </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleRequestReactivation} className="space-y-5 pt-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="pseudo" className="text-label font-medium text-muted-foreground">Pseudo Dofus (optionnel)</Label>
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
                                            className="h-11"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="reason" className="text-label font-medium text-muted-foreground">Votre message (obligatoire)</Label>
                                        <Textarea 
                                            id="reason"
                                            required
                                            maxLength={1000}
                                            placeholder="Expliquez vos motivations..."
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                            className="min-h-[120px] resize-none"
                                        />
                                        <p className="text-caption text-right text-muted-foreground">
                                            {reason.length} / 1000 caractères
                                        </p>
                                    </div>
                                    <DialogFooter>
                                        <Button 
                                            type="submit" 
                                            disabled={isRequesting || !reason.trim()}
                                            className="w-full"
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
                        <p className="rounded-[6px] border border-success/30 bg-success/10 p-3 text-body-sm font-semibold text-success">
                            Demande envoyée. Le Staff va l'étudier.
                        </p>
                    )}

                    <p className="text-caption text-muted-foreground">Besoin d'aide ?</p>

                    <Button asChild className="w-full">
                        <Link href="https://discord.gg/uX7G6SUDgN" target="_blank">
                            <MessageSquare className="mr-2 h-4 w-4" aria-hidden="true" />
                            Contacter le support
                        </Link>
                    </Button>

                    {variant === "lock" && (
                        <Button 
                            variant="ghost" 
                            disabled={isPending}
                            onClick={handleSync}
                            className="text-caption"
                        >
                            <RefreshCcw className={`w-3 h-3 mr-2 ${isPending ? 'animate-spin' : ''}`} />
                            {isPending ? "Synchronisation en cours..." : "Je viens de rejoindre (Synchroniser)"}
                        </Button>
                    )}
                </div>

                <div className="w-full border-t border-border pt-8">
                    <p className="text-caption uppercase tracking-wider text-muted-foreground">
                        Secteur sécurisé
                    </p>
                </div>
            </div>
        </div>
    );
}
