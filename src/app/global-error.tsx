"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Geist, Geist_Mono, Playfair_Display, Inter } from "next/font/google";
import { AlertOctagon, RefreshCw, ServerCrash } from "lucide-react";
import "./globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

const playfair = Playfair_Display({
    variable: "--font-playfair",
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
            <body className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${inter.variable} antialiased min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-4 font-sans text-zinc-100 overflow-hidden`}>

                {/* Effet arrière-plan */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rose-600/10 rounded-full blur-[120px] pointer-events-none opacity-50" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-rose-500/20 rounded-full blur-[80px] pointer-events-none opacity-40 mix-blend-screen" />

                <div className="relative z-10 max-w-lg w-full animate-in fade-in zoom-in-95 duration-700">
                    <div className="bg-black/40 backdrop-blur-3xl border border-white/10 p-8 md:p-12 rounded-[2.5rem] shadow-2xl shadow-rose-900/20 text-center ring-1 ring-white/5 relative overflow-hidden">

                        {/* Ligne rouge décorative */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500/0 via-rose-500 to-rose-500/0 opacity-70" />

                        <div className="mx-auto w-24 h-24 bg-rose-500/10 rounded-[2rem] flex items-center justify-center mb-8 border border-rose-500/20 rotate-3 shadow-[0_0_40px_rgba(244,63,94,0.2)]">
                            <ServerCrash className="w-12 h-12 text-rose-400 rotate-[-3deg]" />
                        </div>

                        <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-white mb-4 drop-shadow-md">
                            Erreur Système
                        </h1>
                        <p className="text-zinc-400 text-sm md:text-[15px] leading-relaxed mb-8 max-w-[95%] mx-auto">
                            Une anomalie critique a provoqué le crash de l'interface. Pas de panique, <b>l'équipe de développement a été notifiée automatiquement</b>.
                        </p>

                        {error.digest && (
                            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black/60 border border-white/5 mb-8">
                                <AlertOctagon className="w-4 h-4 text-rose-500" />
                                <span className="text-zinc-500 font-mono text-[11px] uppercase tracking-widest">
                                    Réf : {error.digest.slice(0, 16)}
                                </span>
                            </div>
                        )}

                        <div className="flex flex-col items-center justify-center gap-4">
                            <button
                                onClick={() => reset()}
                                className="group relative flex items-center justify-center gap-3 bg-zinc-100 hover:bg-white text-zinc-950 px-8 py-4 rounded-2xl font-bold transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.15)] w-full sm:w-auto"
                            >
                                <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-700 ease-out" />
                                <span>Relancer l'interface</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-8 left-0 right-0 text-center opacity-40 hover:opacity-100 transition-opacity">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">
                        SigilOS • System Recovery
                    </span>
                </div>
            </body>
        </html>
    );
}
