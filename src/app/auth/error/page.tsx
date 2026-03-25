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

                <Button
                    asChild
                    className="w-full h-14 bg-white text-black hover:bg-zinc-200 font-black text-lg rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow-xl"
                >
                    <Link href="/">
                        <ArrowLeft className="w-5 h-5 mr-3" />
                        Retour à l'accueil
                    </Link>
                </Button>
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
