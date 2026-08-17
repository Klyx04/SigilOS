"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSocket } from "@/lib/socket-utils";

export type MyGrant = {
    brickId: string;
    label: string;
    expiresAt: string | null; // ISO ou null si illimité
    scope: string | null;
};

/**
 * 🛡️ P3-R — Garde anti-expiration côté sous-god.
 * - Polling léger : surveille les expirations des grants.
 * - Popup d'avertissement quand un accès passe sous le seuil (par défaut 10 min).
 * - Déconnexion FORCÉE (redirection "/") dès que TOUS les accès sont expirés
 *   (ou si le panneau God n'est plus accessible → fail-closed).
 */
export function GodExpiryGuard({ myGrants, warningMinutes = 10 }: { myGrants: MyGrant[]; warningMinutes?: number }) {
    const router = useRouter();
    const [warning, setWarning] = useState<MyGrant | null>(null);
    const [revoked, setRevoked] = useState(false);
    const warnedRef = useRef<Set<string>>(new Set());
    const redirectedRef = useRef(false);

    // Force la déconnexion (fail-closed) quand plus aucun accès n'est valide
    const forceLogout = useCallback(() => {
        if (redirectedRef.current) return;
        redirectedRef.current = true;
        router.replace("/");
    }, [router]);

    useEffect(() => {
        if (myGrants.length === 0) return;

        const timer = setInterval(() => {
            const now = Date.now();
            let hasValid = false;
            let expiring: MyGrant | null = null;

            for (const g of myGrants) {
                if (!g.expiresAt) { hasValid = true; continue; } // illimité = toujours valide
                const t = new Date(g.expiresAt).getTime();
                const left = t - now;

                if (left > 0) {
                    hasValid = true;
                    // Accès qui passe sous le seuil → popup (une seule fois par grant)
                    if (left <= warningMinutes * 60_000 && !warnedRef.current.has(g.brickId)) {
                        warnedRef.current.add(g.brickId);
                        if (!expiring) expiring = g;
                    }
                }
            }

            // A1 : ne re-affiche la popup que pour UN grant à la fois, jamais de doublon.
            // Update fonctionnel → pas besoin de `warning` dans la closure ni dans les deps.
            if (expiring) setWarning((prev) => (prev ?? expiring));

            // Déconnexion forcée si TOUT est expiré / plus rien de valide
            if (!hasValid) {
                clearInterval(timer);
                forceLogout();
            }
        }, 30_000); // toutes les 30s

        // Première exécution immédiate
        const run = () => {
            const now = Date.now();
            let hasValid = false;
            for (const g of myGrants) {
                if (!g.expiresAt) { hasValid = true; continue; }
                const left = new Date(g.expiresAt).getTime() - now;
                if (left > 0) hasValid = true;
            }
            if (!hasValid) forceLogout();
        };
        run();

        return () => clearInterval(timer);
        // ⚠️ #108 : `warning` NE doit PAS être dans les deps — il est déjà géré par
        // `warnedRef` (dédoublonnage). L'inclure re-déclenchait l'effet (nouvel interval
        // + re-run immédiat) à chaque popup → fragile face aux re-renders sous-god.
    }, [myGrants, warningMinutes, forceLogout]);


    // ─── R4 — Révocation LIVE (Socket.IO) ──────────────────────────────────
    // Le serveur WS diffuse "god:revoked" sur la room user:<userId> quand le
    // super-admin révoque un accès. À réception : redirection immédiate.
    // Fail-closed : si le socket est indisponible, on ne fait RIEN — le polling
    // (30s) + canAccessBrick serveur restent la sécurité. Le live est un plus.
    useEffect(() => {
        let socket: ReturnType<typeof getSocket> | null = null;
        let disposed = false;

        try {
            socket = getSocket();

            socket.on("god:revoked", () => {
                if (redirectedRef.current) return;
                setWarning(null); // A1 : ne pas empiler avec la popup d'avertissement.
                redirectedRef.current = true;
                setRevoked(true);
                // A3 : redirection FORCÉE après un court délai (le temps de voir la popup).
                setTimeout(() => router.replace("/"), 2500);
            });

            // god:access-changed — briques accessibles modifiées (ajout/retrait/prolongation)
            // → rafraîchit l'UI (sidebar/onglets) en LIVE, SANS déconnexion.
            socket.on("god:access-changed", () => {
                if (redirectedRef.current) return;
                router.refresh();
            });

            socket.on("connect_error", () => {
                // Fail-closed silencieux : le polling continue de protéger.
            });
        } catch {
            // Socket indisponible → silencieux, le polling protège.
        }

        return () => {
            disposed = true;
            try {
                socket?.disconnect();
            } catch {}
        };
    }, []);

    return (
        <>
            {/* Popup d'avertissement d'expiration */}
            {warning && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
                    <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-[#111] p-6 shadow-2xl">
                        <div className="flex items-start gap-4">
                            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/20 shrink-0">
                                <ShieldAlert className="w-5 h-5 text-amber-400" />
                            </div>
                            <div className="space-y-1">
                                <div className="text-xs font-black text-amber-300 uppercase tracking-widest">Accès bientôt expiré</div>
                                <div className="text-sm text-zinc-200 font-bold">{warning.label}</div>
                                <div className="text-xs text-zinc-500">
                                    Votre accès arrive à expiration. Pensez à demander un renouvellement à votre administrateur.
                                </div>
                            </div>
                        </div>
                        <div className="mt-5 flex justify-end">
                            <Button
                                onClick={() => setWarning(null)}
                                className="bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-bold"
                            >
                                J'ai compris
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* R4 — Popup de RÉVOCATION LIVE : l'accès God a été révoqué */}
            {revoked && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" role="alertdialog" aria-modal="true">
                    <div className="w-full max-w-md rounded-2xl border border-red-500/40 bg-[#111] p-6 shadow-2xl">
                        <div className="flex items-start gap-4">
                            <div className="p-2 rounded-xl bg-red-500/15 border border-red-500/30 shrink-0">
                                <Ban className="w-5 h-5 text-red-400" />
                            </div>
                            <div className="space-y-1">
                                <div className="text-xs font-black text-red-400 uppercase tracking-widest">Accès révoqué</div>
                                <div className="text-sm text-zinc-200 font-bold">Votre accès a été révoqué</div>
                                <div className="text-xs text-zinc-500">
                                    Un administrateur a révoqué vos droits d'accès au panel God.
                                    Vous allez être redirigé vers la page d'accueil.
                                </div>
                            </div>
                        </div>
                        <div className="mt-5 flex justify-end">
                            <Button
                                onClick={() => router.replace("/")}
                                className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 font-bold"
                            >
                                Retour à l'accueil
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
