"use client";

import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

function ErrorContent() {
    const searchParams = useSearchParams();
    const error = searchParams.get("error");

    let title = "Oups, petit accroc !";
    let message = "Une erreur d'authentification est survenue. Réessayez, ça devrait passer.";

    if (error === "OAuthCallbackError") {
        title = "Connexion interrompue";
        message = "L'échange avec Discord a été coupé. Vous avez peut-être annulé la connexion ou le service a eu un hoquet.";
    } else if (error === "AccessDenied") {
        title = "Accès Refusé";
        message = "Désolé, mais vous n'avez pas les accréditations pour entrer ici. Il faut montrer patte blanche !";
    } else if (error === "Verification") {
        title = "Lien expiré";
        message = "Ce lien de vérification a déjà été utilisé ou est trop vieux.";
    }

    return (
        <div className="relative z-10 max-w-md w-full p-8 rounded-3xl bg-black/50 border border-red-500/20 backdrop-blur-xl shadow-[0_0_50px_rgba(220,38,38,0.1)] text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 animate-pulse-slow">
                <ShieldAlert className="w-8 h-8 text-red-500" />
            </div>

            <div className="space-y-2">
                <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
                <p className="text-zinc-400 text-sm leading-relaxed">
                    {message}
                </p>
                {error && (
                    <p className="text-xs font-mono text-red-500/50 mt-2">
                        Code: {error}
                    </p>
                )}
            </div>

            <div className="pt-4">
                <Link href="/">
                    <Button
                        variant="ghost"
                        className="text-zinc-300 hover:text-white hover:bg-white/5 border border-white/10 rounded-full px-6"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Retour à la base
                    </Button>
                </Link>
            </div>
        </div>
    );
}

export default function AuthErrorPage() {
    return (
        <div className="min-h-screen bg-[#020202] text-white flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-red-900/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-red-500/5 rounded-full blur-[120px]" />
                <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.05] mix-blend-overlay" />
            </div>

            <Suspense fallback={<div className="text-zinc-500 font-mono text-sm animate-pulse">Initializing diagnostics...</div>}>
                <ErrorContent />
            </Suspense>
        </div>
    );
}
