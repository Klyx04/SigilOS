"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html>
            <body className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
                <div className="text-center space-y-6 p-8 max-w-md">
                    <div className="text-6xl">💀</div>
                    <h1 className="text-2xl font-black tracking-tighter">
                        Erreur Critique
                    </h1>
                    <p className="text-zinc-400 text-sm">
                        Une erreur inattendue s&apos;est produite. L&apos;équipe a été notifiée.
                    </p>
                    {error.digest && (
                        <p className="text-zinc-600 text-xs font-mono">
                            Référence : {error.digest}
                        </p>
                    )}
                    <button
                        onClick={() => reset()}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold text-sm transition-colors"
                    >
                        Réessayer
                    </button>
                </div>
            </body>
        </html>
    );
}
