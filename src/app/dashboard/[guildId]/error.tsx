"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { RefreshCw, Home } from "lucide-react";
import Link from "next/link";

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
        <div className="min-h-[60vh] flex items-center justify-center p-8">
            <div className="text-center space-y-6 max-w-md">
                <div className="text-5xl">⚡</div>
                <h2 className="text-xl font-black tracking-tighter text-white">
                    Quelque chose a mal tourné
                </h2>
                <p className="text-zinc-400 text-sm leading-relaxed">
                    Une erreur s&apos;est produite lors du chargement de cette page.
                    Essayez de recharger ou revenez au dashboard.
                </p>
                {error.digest && (
                    <p className="text-zinc-600 text-xs font-mono">
                        Réf : {error.digest}
                    </p>
                )}
                <div className="flex items-center justify-center gap-3">
                    <Button
                        onClick={() => reset()}
                        variant="outline"
                        className="border-white/10 hover:bg-white/5"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Réessayer
                    </Button>
                    <Button asChild>
                        <Link href="/dashboard">
                            <Home className="w-4 h-4 mr-2" />
                            Dashboard
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
