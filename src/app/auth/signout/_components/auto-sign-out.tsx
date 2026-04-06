"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { Loader2 } from "lucide-react";

export function AutoSignOut({ redirectTo = "/login?info=session_expired" }: { redirectTo?: string }) {
    useEffect(() => {
        const performSignOut = async () => {
            // Add a small delay to ensure the user sees why they are being redirected
            await new Promise(resolve => setTimeout(resolve, 800));
            await signOut({ callbackUrl: redirectTo });
        };
        performSignOut();
    }, [redirectTo]);

    return (
        <div className="flex flex-col items-center justify-center p-8 space-y-4">
            <div className="relative">
                <Loader2 className="w-12 h-12 text-emerald-400 animate-spin" />
                <div className="absolute inset-0 blur-xl bg-emerald-400/20 animate-pulse" />
            </div>
            <div className="space-y-2 text-center">
                <p className="text-white font-black uppercase tracking-widest text-sm italic">Session expirée</p>
                <p className="text-zinc-500 text-xs font-medium">Déconnexion sécurisée en cours...</p>
            </div>
        </div>
    );
}
