"use client";

import { useEffect } from "react";
import { ShieldAlert, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function GodError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // #108 — on ne log plus le message minifié React (#441/#419) qui n'aide pas :
        // on trace côté serveur le digest (référence Sentry/erreur) pour diagnostic.
        console.error("[God Dashboard] Error (digest):", error.digest || error.name);
    }, [error]);

    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
            <div className="max-w-lg w-full space-y-8 text-center">
                <div className="flex justify-center">
                    <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <ShieldAlert className="w-10 h-10 text-amber-400" />
                    </div>
                </div>

                <div className="space-y-3">
                    <h1 className="text-3xl font-black text-white uppercase tracking-tight">
                        Une section du panneau God est indisponible
                    </h1>
                    <p className="text-zinc-500 font-medium leading-relaxed">
                        Cette page a rencontré une erreur d&apos;affichage.
                        Vos accès restent valides et les autres sections fonctionnent normalement.
                    </p>
                    {error.digest && (
                        <p className="text-caption font-mono text-zinc-700">
                            REF: {error.digest}
                        </p>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                        onClick={reset}
                        className="inline-flex items-center gap-2 px-8 py-4 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-2xl text-sm font-black text-amber-300 uppercase tracking-widest transition-all"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Relancer la section
                    </button>
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-2 px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-sm font-black text-zinc-300 uppercase tracking-widest transition-all"
                    >
                        <Home className="w-4 h-4" />
                        Accueil
                    </Link>
                </div>
            </div>
        </div>
    );
}
