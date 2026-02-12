"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Lock, ArrowLeft } from "lucide-react";

interface AccessDeniedProps {
    title?: string;
    message?: string;
    variant?: "lock" | "ban";
    action?: React.ReactNode;
}

export function AccessDenied({
    title = "Accès Restreint",
    message = "Vous n'avez pas les permissions nécessaires pour accéder à cette ressource.",
    variant = "lock",
    action
}: AccessDeniedProps) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-center p-4">
            <div className="mb-6 relative">
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full opacity-20" />
                <div className="relative bg-zinc-900/50 p-6 rounded-2xl border border-white/5 shadow-2xl">
                    {variant === "lock" ? (
                        <Lock className="w-12 h-12 text-zinc-400" />
                    ) : (
                        <ShieldAlert className="w-12 h-12 text-red-400" />
                    )}
                </div>
            </div>

            <h1 className="text-3xl font-bold text-white tracking-tight mb-3">
                {title}
            </h1>

            <p className="text-zinc-400 max-w-md text-base mb-8 leading-relaxed">
                {message}
            </p>

            <div className="flex items-center gap-4">
                <Button variant="outline" asChild className="gap-2">
                    <Link href="/">
                        <ArrowLeft className="w-4 h-4" />
                        Retour à l'accueil
                    </Link>
                </Button>
                {action}
            </div>
        </div>
    );
}
