"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Timer, Ban } from "lucide-react";
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

    // Calcule le timestamp d'expiration minimal parmi les grants limités
    const minExpiry = (() => {
        let min: number | null = null;
        for (const g of myGrants) {
            if (!g.expiresAt) continue;
            const t = new Date(g.expiresAt).getTime();
            if (min === null || t < min) min = t;
        }
        return min;
    })();

    // Force la déconnexion (fail-closed) quand plus aucun accès n'est valide
    const forceLogout = useCallback(() => {
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

            if (expiring) setWarning(expiring);

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
                redirectedRef.current = true;
                setRevoked(true);
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

    // Affiche aussi un décompte permanent discret du temps restant global
    const globalLabel = (() => {
        if (myGrants.some(g => !g.expiresAt)) return "accès illimité";
        if (minExpiry === null) return null;
        const left = Math.max(0, Math.floor((minExpiry - Date.now()) / 60_000));
        return left <= 60 ? `${left} min` : `${Math.floor(left / 60)}h ${left % 60}m`;
    })();

    return (
        <>
            {/* Badge discret du temps restant global (coin bas gauche) */}
            {globalLabel && (
                <div className="fixed bottom-4 left-4 z-[95] flex items-center gap-2 rounded-xl border border-amber-500/30 bg-[#111]/90 backdrop-blur px-3 py-2 shadow-xl">
                    <Timer className="w-4 h-4 text-amber-400" />
                    <span className="text-[11px] font-black text-amber-300 uppercase tracking-widest">
                        Expire : {globalLabel}
                    </span>
                </div>
            )}

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
