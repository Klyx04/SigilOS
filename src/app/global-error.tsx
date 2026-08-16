"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Geist_Mono, Space_Grotesk, Inter } from "next/font/google";
import { AlertOctagon, RefreshCw, ServerCrash } from "lucide-react";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
    variable: "--font-space-grotesk",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

const inter = Inter({
    variable: "--font-inter",
    subsets: ["latin"],
});

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
        <html lang="fr" className="dark">
            <body className={`${spaceGrotesk.variable} ${geistMono.variable} ${inter.variable} antialiased min-h-screen bg-[#0d0f11] flex flex-col items-center justify-center p-4 font-sans text-zinc-100 overflow-hidden`}>

                <div className="relative z-10 max-w-lg w-full animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-8 md:p-10 rounded-2xl shadow-2xl text-center ring-1 ring-white/5 relative overflow-hidden">

                        <div className="mx-auto w-20 h-20 bg-rose-500/10 rounded-2xl flex items-center justify-center mb-6 border border-rose-500/20">
                            <ServerCrash className="w-10 h-10 text-rose-400" />
                        </div>

                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-3">
                            Erreur Système
                        </h1>
                        <p className="text-zinc-400 text-sm md:text-[15px] leading-relaxed mb-8 max-w-[95%] mx-auto">
                            Une anomalie critique a provoqué le crash de l'interface. Pas de panique, <b className="text-white font-semibold">l'équipe de développement a été notifiée automatiquement</b>.
                        </p>

                        {error.digest && (
                            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black/60 border border-white/5 mb-8">
                                <AlertOctagon className="w-4 h-4 text-rose-500" />
                                <span className="text-zinc-500 font-mono text-[11px] uppercase tracking-wider">
                                    Réf : {error.digest.slice(0, 16)}
                                </span>
                            </div>
                        )}

                        <div className="flex flex-col items-center justify-center gap-4">
                            <button
                                onClick={() => reset()}
                                className="flex items-center justify-center gap-3 bg-zinc-100 hover:bg-white text-zinc-950 px-6 py-3 rounded-lg font-semibold transition-colors w-full sm:w-auto"
                            >
                                <RefreshCw className="w-4 h-4" />
                                <span>Relancer l'interface</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-8 left-0 right-0 text-center opacity-40 hover:opacity-100 transition-opacity">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                        SigilOS • System Recovery
                    </span>
                </div>
            </body>
        </html>
    );
}
