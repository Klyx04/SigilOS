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
            <body className={`${spaceGrotesk.variable} ${geistMono.variable} ${inter.variable} antialiased min-h-screen bg-background flex flex-col items-center justify-center p-4 font-sans text-foreground`}>

                <div className="w-full max-w-lg">
                    <div className="rounded-[6px] border border-border bg-surface p-8 text-center md:p-10">

                        <ServerCrash className="mx-auto mb-6 h-10 w-10 text-danger" aria-hidden="true" />

                        <h1 className="mb-3 text-title font-bold tracking-tight text-foreground">
                            Erreur système
                        </h1>
                        <p className="mx-auto mb-8 max-w-[95%] text-body-sm leading-relaxed text-muted-foreground">
                            Une anomalie critique a provoqué le crash de l'interface. Pas de panique, <b className="font-semibold text-foreground">l'équipe de développement a été notifiée automatiquement</b>.
                        </p>

                        {error.digest && (
                            <p className="mb-8 inline-flex items-center gap-2 rounded-[4px] border border-border bg-elevated px-4 py-2.5">
                                <AlertOctagon className="h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                                <span className="font-mono text-caption uppercase tracking-wider text-muted-foreground">
                                    Réf : {error.digest.slice(0, 16)}
                                </span>
                            </p>
                        )}

                        <button
                            onClick={() => reset()}
                            className="inline-flex w-full items-center justify-center gap-3 rounded-[4px] bg-primary px-6 py-3 text-body-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
                        >
                            <RefreshCw className="h-4 w-4" aria-hidden="true" />
                            <span>Relancer l'interface</span>
                        </button>
                    </div>
                </div>

                <p className="absolute bottom-8 left-0 right-0 text-center text-caption uppercase tracking-wider text-muted-foreground">
                    SigilOS · System Recovery
                </p>
            </body>
        </html>
    );
}
