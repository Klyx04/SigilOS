"use client";

import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { AuroraBackground } from "@/components/ui/aurora-background";

function ErrorContent() {
    const searchParams = useSearchParams();
    const error = searchParams.get("error");

    let title = "Oups, petit accroc !";
    let message = "Une erreur d'authentification est survenue. Réessayez, ça devrait passer.";

    if (error === "OAuthCallbackError") {
        title = "Connexion interrompue";
        message = "L'échange avec Discord a été coupé. Vous avez peut-être annulé la connexion ou le service a eu un hoquet.";
        // Vérifier si le message contient "verify" — Discord renvoie cette erreur
        // quand l'email du compte Discord n'est pas vérifié.
        const msg = searchParams.get("message") || "";
        if (msg.toLowerCase().includes("verify") || msg.toLowerCase().includes("vérifi")) {
            title = "Email Discord non vérifié";
            message = "Discord exige que votre adresse email soit vérifiée pour utiliser l'authentification. Ouvrez Discord → Paramètres → Mon Compte → Vérifier votre email, puis réessayez.";
        }
    } else if (error === "AccessDenied") {
        title = "Accès Refusé";
        message = "Désolé, mais vous n'avez pas les accréditaitons pour entrer ici. Il faut montrer patte blanche !";
    } else if (error === "NoManagedGuild") {
        title = "Accès Restreint";
        message = "Votre compte Discord n'est associé à aucune guilde utilisant SigilOS. Pour accéder au QG, vous devez être membre d'une guilde partenaire.";
    } else if (error === "Verification") {
        title = "Lien expiré";
        message = "Ce lien de vérification a déjà été utilisé ou est trop vieux.";
    }

    return (
        <div className="relative z-10 max-w-md w-full group">
            <div className="absolute -inset-1 bg-gradient-to-r from-red-500/20 via-orange-500/20 to-red-500/20 rounded-3xl blur-xl opacity-50 group-hover:opacity-100 transition duration-1000" />

            <div className="relative bg-zinc-950/80 backdrop-blur-3xl border border-red-500/20 rounded-3xl p-10 text-center shadow-2xl">
                <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-8 shadow-inner">
                    <ShieldAlert className="w-10 h-10 text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.4)]" />
                </div>

                <div className="space-y-4 mb-10">
                    <h1 className="text-3xl font-black text-white tracking-tighter">{title}</h1>
                    <p className="text-zinc-400 font-medium leading-relaxed">
                        {message}
                    </p>
                    {error && (
                        <div className="inline-block px-3 py-1 rounded-md bg-red-500/5 border border-red-500/10">
                            <p className="text-[10px] font-mono text-red-500/50 uppercase tracking-widest font-bold">
                                Diagnostics: {error}
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-3">
                    {error === "NoManagedGuild" && (
                        <Button
                            asChild
                            className="w-full h-14 bg-indigo-500 hover:bg-indigo-400 text-white font-black text-lg rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow-[0_8px_32px_-8px_rgba(88,101,242,0.5)] border border-indigo-400/50"
                        >
                            <a href="https://discord.gg/uX7G6SUDgN" target="_blank" rel="noopener noreferrer">
                                <svg className="w-6 h-6 mr-3" viewBox="0 0 127.14 96.36" fill="currentColor">
                                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c2.91-27.55-13.48-51.67-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
                                </svg>
                                Demande d'accès (Discord)
                            </a>
                        </Button>
                    )}
                    <Button
                        asChild
                        className={`w-full h-14 font-black text-lg rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow-xl ${
                            error === "NoManagedGuild"
                            ? "bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700/50"
                            : "bg-white text-black hover:bg-zinc-200"
                        }`}
                    >
                        <Link href="/">
                            <ArrowLeft className="w-5 h-5 mr-3" />
                            Retour à l'accueil
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default function AuthErrorPage() {
    return (
        <div className="min-h-screen bg-black text-white selection:bg-red-500/30 font-sans flex flex-col relative overflow-hidden landing-theme">
            {/* Ambient Background Effects */}
            <div className="fixed inset-0 z-0">
                <AuroraBackground className="h-full w-full pointer-events-none opacity-20" />
            </div>
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-red-500/5 rounded-full blur-[120px] animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-900/10 rounded-full blur-[100px] animate-pulse-slow delay-1000" />
            </div>

            <PublicHeader variant="standard" backHref="/" backLabel="Accueil" />

            <main className="flex-1 flex items-center justify-center p-4 relative z-10 pt-20">
                <Suspense fallback={
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin" />
                        <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest">Initialisation des diagnostics...</p>
                    </div>
                }>
                    <ErrorContent />
                </Suspense>
            </main>

            <GalacticFooter />
        </div>
    );
}
