"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { RefreshCw, Home, ServerCrash, AlertOctagon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardError({
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
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Effets arrière-plan (localisés au container) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-danger/10 rounded-full blur-[100px] pointer-events-none opacity-40" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] bg-danger/20 rounded-full blur-[60px] pointer-events-none opacity-30 mix-blend-screen" />

            <div className="relative z-10 max-w-lg w-full animate-in fade-in zoom-in-95 duration-300 mt-8">
                <div className="bg-black/40 backdrop-blur-3xl border border-border p-8 md:p-12 rounded-[2.5rem] shadow-2xl shadow-rose-900/20 text-center ring-1 ring-white/5 relative overflow-hidden">

                    {/* Ligne rouge décorative */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-danger/0 via-danger to-danger/0 opacity-70" />

                    <div className="mx-auto w-20 h-20 bg-danger/10 rounded-[1.5rem] flex items-center justify-center mb-8 border border-danger/20 rotate-3 ">
                        <ServerCrash className="w-10 h-10 text-danger rotate-[-3deg]" />
                    </div>

                    <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-foreground mb-4 drop-shadow-md">
                        Section Indisponible
                    </h2>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-6 max-w-[95%] mx-auto">
                        Une erreur logicielle s'est produite lors du chargement de cette page. Les équipes de maintenance ont été alertées en arrière-plan.
                    </p>

                    {error.digest && (
                        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-black/60 border border-border mb-8">
                            <AlertOctagon className="w-3.5 h-3.5 text-danger" />
                            <span className="text-muted-foreground font-mono text-caption uppercase tracking-widest">
                                Réf : {error.digest.slice(0, 16)}
                            </span>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Button
                            onClick={() => reset()}
                            variant="sigil-destructive"
                            className="w-full sm:w-auto h-12 px-8"
                        >
                            <RefreshCw className="w-4 h-4 mr-2 group-hover:rotate-180 transition-transform duration-300 ease-out" />
                            <span>Réessayer</span>
                        </Button>
                        <Button
                            asChild
                            variant="sigil-destructive"
                            className="w-full sm:w-auto h-12 px-8"
                        >
                            <Link href="/dashboard">
                                <Home className="w-4 h-4 mr-2" />
                                <span>Accueil</span>
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>

            <div className="mt-8 text-center opacity-40">
                <span className="text-caption font-black uppercase tracking-widest text-muted-foreground">
                    SigilOS • Module Failure
                </span>
            </div>
        </div>
    );
}
