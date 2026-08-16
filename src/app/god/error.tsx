"use client";

import { useEffect } from "react";
import { ShieldAlert, RefreshCw } from "lucide-react";

export default function GodError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[God Dashboard] Error:", error);
    }, [error]);

    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
            <div className="max-w-lg w-full space-y-8 text-center">
                <div className="flex justify-center">
                    <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                        <ShieldAlert className="w-10 h-10 text-red-400" />
                    </div>
                </div>

                <div className="space-y-3">
                    <h1 className="text-3xl font-black text-white uppercase tracking-tight">
                        Erreur God Dashboard
                    </h1>
                    <p className="text-zinc-500 font-medium leading-relaxed">
                        Un composant du tableau de bord a rencontré une erreur.
                        Les autres services restent opérationnels.
                    </p>
                    {error.message && (
                        <code className="block mt-4 px-4 py-3 bg-zinc-900 border border-white/5 rounded-xl text-xs text-red-400 font-mono text-left break-all">
                            {error.message}
                        </code>
                    )}
                    {error.digest && (
                        <p className="text-caption font-mono text-zinc-700">
                            REF: {error.digest}
                        </p>
                    )}
                </div>

                <button
                    onClick={reset}
                    className="inline-flex items-center gap-2 px-8 py-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-2xl text-sm font-black text-red-400 uppercase tracking-widest transition-all"
                >
                    <RefreshCw className="w-4 h-4" />
                    Relancer le Dashboard
                </button>
            </div>
        </div>
    );
}
