"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Lock, ArrowLeft, MessageSquare, Archive } from "lucide-react";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { PublicHeader } from "@/components/layout/public-header";
import { useSession } from "next-auth/react";
import { RefreshCcw } from "lucide-react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { revalidateUserContext } from "@/server/actions/user-actions";
import { toast } from "sonner";

interface AccessDeniedProps {
    title?: string;
    message?: string;
    variant?: "lock" | "ban" | "archive";
    action?: React.ReactNode;
    countdownDate?: string | null;
    guildId?: string; // Optional, to help re-sync specific guild
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
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">
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
    guildId
}: AccessDeniedProps) {
    const { data: session } = useSession();
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleSync = () => {
        startTransition(async () => {
            const res = await revalidateUserContext(guildId);
            if (res.success) {
                toast.success("Synchronisation effectuée. Vérification en cours...");
                // Reload the current page to pick up fresh data
                window.location.reload();
            } else {
                toast.error(res.error || "Échec de la synchronisation");
            }
        });
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-center relative overflow-hidden">
            <PublicHeader user={session?.user} />
            <AuroraBackground className="absolute inset-0 z-0 pointer-events-none opacity-40" />

            {/* Ambient Noise Overlay */}
            <div className="absolute inset-0 noise-overlay opacity-[0.03] pointer-events-none" />

            {/* Mystical Glow Background */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-4xl z-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[140px] mix-blend-screen" />
            </div>

            <div className="relative z-10 space-y-8 max-w-md w-full animate-in fade-in zoom-in duration-700">
                <div className="mx-auto relative group">
                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full opacity-20 group-hover:opacity-40 transition-opacity" />
                    <div className="relative bg-zinc-900/50 p-8 rounded-3xl border border-white/5 shadow-2xl backdrop-blur-xl">
                        {variant === "lock" ? (
                            <Lock className="w-16 h-16 text-zinc-400 drop-shadow-[0_0_15px_rgba(168,85,247,0.3)]" />
                        ) : variant === "archive" ? (
                            <Archive className="w-16 h-16 text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.3)]" />
                        ) : (
                            <ShieldAlert className="w-16 h-16 text-red-400 drop-shadow-[0_0_15px_rgba(248,113,113,0.3)]" />
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <h1 className="text-4xl font-black text-white tracking-tighter uppercase font-heading leading-tight">
                        {title}
                    </h1>
                    <div className="h-1 w-24 bg-gradient-to-r from-transparent via-purple-500 to-transparent mx-auto rounded-full opacity-50"></div>
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
                        <Button variant="outline" asChild className="flex-1 h-12 rounded-xl border-white/10 hover:bg-white/5 text-zinc-300 font-bold uppercase tracking-wider text-xs">
                            <Link href="/">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Accueil
                            </Link>
                        </Button>
                        {action}
                    </div>

                    <p className="text-xs text-zinc-600 font-medium">Besoin d'aide ?</p>

                    <Button asChild className="h-12 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-black uppercase tracking-[0.1em] text-xs shadow-lg shadow-[#5865F2]/20">
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
                            className="h-12 rounded-xl border border-white/5 hover:bg-white/5 text-zinc-500 hover:text-white font-bold uppercase tracking-wider text-[10px]"
                        >
                            <RefreshCcw className={`w-3 h-3 mr-2 ${isPending ? 'animate-spin' : ''}`} />
                            {isPending ? "Synchronisation en cours..." : "Je viens de rejoindre (Synchroniser)"}
                        </Button>
                    )}
                </div>

                <div className="pt-8 border-t border-white/5 w-full">
                    <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-700 uppercase tracking-widest font-black">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500/50 animate-pulse"></span>
                        <span>Secteur Sécurisé</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
