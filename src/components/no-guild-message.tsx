"use client";

import { signOut } from "next-auth/react";
import { LogOut, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuroraBackground } from "@/components/ui/aurora-background";

interface NoGuildMessageProps {
    rateLimited?: boolean;
}

export function NoGuildMessage({ rateLimited }: NoGuildMessageProps) {
    return (
        <div className="relative min-h-screen w-full overflow-hidden flex flex-col items-center justify-center p-4">
            <AuroraBackground className="absolute inset-0 z-0 h-full w-full pointer-events-none opacity-30" />

            <div className="relative z-10 max-w-md w-full text-center space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-700">
                <div className="mx-auto w-20 h-20 rounded-full bg-zinc-800/50 border border-white/10 flex items-center justify-center">
                    <Home className="w-10 h-10 text-zinc-500" />
                </div>

                <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-white">
                        {rateLimited ? "Un instant..." : "Aucune guilde disponible"}
                    </h1>
                    <p className="text-muted-foreground">
                        {rateLimited
                            ? "Nous vérifions vos accès. Veuillez patienter quelques secondes puis réessayer."
                            : "Vous n'êtes membre d'aucune guilde utilisant SigilOS."}
                    </p>
                </div>

                <div className="flex flex-col gap-3 pt-4">
                    {rateLimited ? (
                        <Button
                            onClick={() => window.location.reload()}
                            variant="outline"
                            className="gap-2"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Réessayer
                        </Button>
                    ) : (
                        <Button
                            onClick={() => signOut({ callbackUrl: "/" })}
                            variant="outline"
                            className="gap-2"
                        >
                            <LogOut className="h-4 w-4" />
                            Se déconnecter
                        </Button>
                    )}
                </div>

                {!rateLimited && (
                    <p className="text-xs text-muted-foreground/60 pt-4">
                        Contactez l'administrateur de votre guilde pour obtenir l'accès.
                    </p>
                )}
            </div>
        </div>
    );
}
