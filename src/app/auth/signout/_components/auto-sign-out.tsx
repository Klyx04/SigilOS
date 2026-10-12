"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { Loader2 } from "lucide-react";

/**
 * Déconnexion automatique (jeton Discord expiré) — registre.
 *
 * Les deux libellés sont inchangés (« Session expirée » et « Déconnexion
 * sécurisée en cours... »).
 *
 * Ce qui a été retiré volontairement : le halo décoratif
 * `absolute inset-0 blur-xl bg-emerald-400/20 animate-pulse` derrière l'icône,
 * le `text-emerald-400` codé en dur, le couple
 * `text-white font-black uppercase tracking-widest italic` (capitales criardes
 * + faux italique) et le `text-zinc-500` du second paragraphe.
 *
 * À la place : indicateur d'attente discret + libellé en gras sur deux lignes,
 * tout en tokens (`text-foreground` / `text-muted-foreground`).
 */
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
        <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 shrink-0 text-muted-foreground animate-spin" aria-hidden="true" />
            <div>
                <p className="text-sm font-semibold text-foreground">Session expirée</p>
                <p className="mt-1 text-xs text-muted-foreground">Déconnexion sécurisée en cours...</p>
            </div>
        </div>
    );
}
