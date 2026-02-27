"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Lock, ArrowLeft, MessageSquare, Archive } from "lucide-react";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { PublicHeader } from "@/components/layout/public-header";
import { useSession } from "next-auth/react";

interface AccessDeniedProps {
    title?: string;
    message?: string;
    variant?: "lock" | "ban" | "archive";
    action?: React.ReactNode;
}

export function AccessDenied({
    title = "Accès Restreint",
    message = "Vous n'avez pas les permissions nécessaires pour accéder à cette ressource.",
    variant = "lock",
    action
}: AccessDeniedProps) {
    const { data: session } = useSession();

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
                    <h1 className="text-4xl font-black text-white tracking-tighter uppercase font-heading">
                        {title}
                    </h1>
                    <div className="h-1 w-24 bg-gradient-to-r from-transparent via-purple-500 to-transparent mx-auto rounded-full opacity-50"></div>
                    <p className="text-zinc-400 text-lg leading-relaxed px-4">
                        {message}
                    </p>
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
