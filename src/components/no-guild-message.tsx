"use client";

import { signOut } from "next-auth/react";
import Image from "next/image";
import { LogOut, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { useEffect } from "react";

interface NoGuildMessageProps {
    rateLimited?: boolean;
}

export function NoGuildMessage({ rateLimited }: NoGuildMessageProps) {
    // Auto-reload every 3 seconds when rate limited (Discord sync in progress)
    useEffect(() => {
        if (rateLimited) {
            const interval = setInterval(() => {
                window.location.reload();
            }, 3000); // Reload every 3 seconds

            return () => clearInterval(interval);
        }
    }, [rateLimited]);
    return (
        <div className="relative w-full flex flex-col items-center justify-center p-4">

            <div className="relative z-10 max-w-md w-full text-center space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-700">
                <div className="mx-auto w-32 h-32 relative mb-8 animate-pulse-slow">
                    <Image
                        src="/assets/ui/logo-v2.png"
                        alt="SigilOS"
                        fill
                        className="object-contain drop-shadow-[0_0_50px_rgba(168,85,247,0.6)]"
                        priority
                    />
                </div>

                <div className="space-y-3">
                    <h1 className="text-3xl font-black text-white tracking-tight font-heading">
                        SIGIL<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">OS</span>
                    </h1>
                    <div className="h-1 w-20 bg-gradient-to-r from-transparent via-indigo-500 to-transparent mx-auto rounded-full opacity-50"></div>

                    <h2 className="text-xl font-medium text-zinc-200 mt-4">
                        {rateLimited ? "Initialisation du système..." : "Accès Restreint"}
                    </h2>

                    <p className="text-zinc-400 text-sm max-w-[300px] mx-auto leading-relaxed">
                        {rateLimited
                            ? "Synchronisation des protocoles d'accès en cours. Veuillez patienter."
                            : "Votre compte Discord n'est associé à aucune guilde active sur ce secteur."}
                    </p>
                </div>

                <div className="flex flex-col gap-3 pt-6 w-full max-w-[250px] mx-auto">
                    {rateLimited ? (
                        <Button
                            onClick={() => window.location.reload()}
                            variant="outline"
                            className="w-full gap-2 border-white/10 hover:bg-white/5 hover:text-white transition-all"
                        >
                            <RefreshCw className="h-4 w-4 animate-spin-slow" />
                            Relancer la synchro
                        </Button>
                    ) : (
                        <Button
                            onClick={() => signOut({ callbackUrl: "/" })}
                            variant="ghost"
                            className="w-full gap-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                            <LogOut className="h-4 w-4" />
                            Déconnexion
                        </Button>
                    )}
                </div>

                {!rateLimited && (
                    <div className="pt-8 border-t border-white/5 w-full">
                        <div className="flex items-center justify-center gap-2 text-xs text-zinc-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500/50"></span>
                            <span>Système Sécurisé</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
