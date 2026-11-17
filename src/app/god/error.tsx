"use client";

import { useEffect } from "react";
import { ShieldAlert, RefreshCw, Home } from "lucide-react";
import Link from "next/link";
import { StaleDeploymentPanel } from "@/components/shared/stale-deployment-panel";
import { isStaleDeploymentError } from "@/lib/stale-deployment";

export default function GodError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    // Décalage de build (onglet resté ouvert pendant un déploiement) : « Relancer la section »
    // rejouerait le même bundle périmé ⇒ on recharge l'onglet (voir `src/lib/stale-deployment.ts`).
    const staleDeployment = isStaleDeploymentError(error);

    useEffect(() => {
        // #108 — on ne log plus le message minifié React (#441/#419) qui n'aide pas :
        // on trace côté serveur le digest (référence Sentry/erreur) pour diagnostic.
        if (!staleDeployment) {
            console.error("[God Dashboard] Error (digest):", error.digest || error.name);
        }
    }, [error, staleDeployment]);

    if (staleDeployment) return <StaleDeploymentPanel />;

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <div className="max-w-lg w-full space-y-8 text-center">
                <div className="flex justify-center">
                    <div className="w-20 h-20 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center">
                        <ShieldAlert className="w-10 h-10 text-warning" />
                    </div>
                </div>

                <div className="space-y-3">
                    <h1 className="text-3xl font-semibold text-foreground uppercase tracking-tight">
                        Une section du panneau God est indisponible
                    </h1>
                    <p className="text-muted-foreground font-medium leading-relaxed">
                        Cette page a rencontré une erreur d&apos;affichage.
                        Vos accès restent valides et les autres sections fonctionnent normalement.
                    </p>
                    {error.digest && (
                        <p className="text-caption font-mono text-foreground">
                            REF: {error.digest}
                        </p>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                        onClick={reset}
                        className="inline-flex items-center gap-2 px-8 py-4 bg-warning/10 hover:bg-warning/20 border border-warning/20 rounded-xl text-sm font-semibold text-warning uppercase tracking-wide transition-all"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Relancer la section
                    </button>
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-2 px-6 py-4 bg-surface/10 hover:bg-elevated border border-border rounded-xl text-sm font-semibold text-foreground uppercase tracking-wide transition-all"
                    >
                        <Home className="w-4 h-4" />
                        Accueil
                    </Link>
                </div>
            </div>
        </div>
    );
}
