"use client";

import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { DiscordIcon } from "@/components/shared/icons";

/**
 * Fiche d'erreur d'authentification — registre.
 *
 * Les textes (titres, messages, code `error`) sont inchangés : seule la
 * présentation revient dans la couche `.reg-*`.
 *
 * Ce qui a été retiré volontairement :
 *  - le wrapper `relative overflow-hidden` et son commentaire « Ambient
 *    Background Effects » : il n'existait que pour des orbes de fond supprimés ;
 *  - la carte centrée `bg-zinc-950 border-red-500/20 rounded-3xl p-10` et sa
 *    tuile d'icône `w-20 h-20 rounded-2xl bg-red-500/10` (icône mise en boîte) ;
 *  - les deux boutons pleine largeur `h-14 rounded-2xl font-black text-lg` avec
 *    `active:scale-95`, dont un `bg-indigo-500` codé en dur (hors tokens) et un
 *    `bg-white text-black` (thème clair) / `bg-zinc-800` (thème sombre) ;
 *  - les gris `text-zinc-400` / `text-zinc-500` et le `text-white` ;
 *  - le code de diagnostic en `uppercase tracking-widest text-red-500/50` :
 *    l'étiquette passe en mono (`.reg-mono`) et la valeur en `--danger`
 *    (contraste mesuré ≥ 4,5 dans les deux thèmes) ;
 *  - le `font-sans` de la racine : c'est un utilitaire (couche `utilities`),
 *    donc prioritaire sur `.registre` (couche `components`) — il réimposait
 *    Inter et annulait la typographie Source Sans 3 de la page.
 *
 * À la place : colonne de lecture `.reg-shell` alignée à gauche, icône de
 * statut, diagnostic en mono, une seule action principale `.reg-btn-primary` et
 * l'action secondaire en lien souligné (`.reg-link`) — jamais deux boutons
 * concurrents.
 */
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
        message = "Désolé, mais vous n'avez pas les accréditations pour entrer ici. Il faut montrer patte blanche !";
    } else if (error === "Banned") {
        title = "Accès Révoqué";
        message = "Ce compte ou ce serveur a été suspendu de la plateforme SigilOS pour non-respect des règles d'utilisation ou de sécurité.";
    } else if (error === "NoManagedGuild") {
        title = "Accès Restreint";
        message = "Votre compte Discord n'est associé à aucune guilde utilisant SigilOS et vous n'êtes administrateur d'aucun serveur éligible. Pour installer SigilOS en autonomie, connectez-vous avec le compte disposant des droits Administrateur sur votre serveur Discord.";
    } else if (error === "Verification") {
        title = "Lien expiré";
        message = "Ce lien de vérification a déjà été utilisé ou est trop vieux.";
    }

    return (
        <div className="max-w-[34rem]">
            <h1 className="flex items-center gap-3 text-[clamp(1.6rem,2.8vw,2rem)] font-bold tracking-tight text-foreground">
                <ShieldAlert className="h-6 w-6 shrink-0 text-danger" aria-hidden="true" />
                {title}
            </h1>

            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{message}</p>

            {error && (
                <p className="reg-mono mt-4 text-xs text-muted-foreground">
                    Diagnostics: <span className="text-danger">{error}</span>
                </p>
            )}

            <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                {error === "NoManagedGuild" && (
                    <a
                        href="https://discord.gg/uX7G6SUDgN"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="reg-btn reg-btn-primary"
                    >
                        <DiscordIcon className="h-4 w-4" />
                        Demande d'accès (Discord)
                    </a>
                )}
                <Link
                    href="/"
                    className={
                        error === "NoManagedGuild"
                            ? "reg-link inline-flex items-center gap-2"
                            : "reg-btn reg-btn-primary"
                    }
                >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Retour à l'accueil
                </Link>
            </div>
        </div>
    );
}

export default function AuthErrorPage() {
    return (
        <div className="registre landing-theme min-h-screen flex flex-col bg-background text-foreground selection:bg-danger/30">
            <PublicHeader variant="standard" backHref="/" backLabel="Accueil" />

            <main className="flex-1">
                <div className="reg-shell py-10 lg:py-16">
                    <Suspense fallback={
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
                            <p className="text-xs">Initialisation des diagnostics...</p>
                        </div>
                    }>
                        <ErrorContent />
                    </Suspense>
                </div>
            </main>

            <GalacticFooter />
        </div>
    );
}
