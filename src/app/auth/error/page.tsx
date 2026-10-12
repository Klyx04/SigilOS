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
import { useI18n } from "@/lib/i18n/client";

function ErrorContent() {
    const { t } = useI18n();
    const searchParams = useSearchParams();
    const error = searchParams.get("error");

    let title = t.auth.errorTitleDefault;
    let message = t.auth.errorMessageDefault;

    if (error === "OAuthCallbackError") {
        title = t.auth.errorOAuthTitle;
        message = t.auth.errorOAuthDesc;
        const msg = searchParams.get("message") || "";
        if (msg.toLowerCase().includes("verify") || msg.toLowerCase().includes("vérifi")) {
            title = t.auth.errorUnverifiedTitle;
            message = t.auth.errorUnverifiedDesc;
        }
    } else if (error === "AccessDenied") {
        title = t.auth.errorAccessDeniedTitle;
        message = t.auth.errorAccessDeniedDesc;
    } else if (error === "Banned") {
        title = t.auth.errorBannedTitle;
        message = t.auth.errorBannedDesc;
    } else if (error === "NoManagedGuild") {
        title = t.auth.errorNoManagedGuildTitle;
        message = t.auth.errorNoManagedGuildDesc;
    } else if (error === "Verification") {
        title = t.auth.errorVerificationTitle;
        message = t.auth.errorVerificationDesc;
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
                    {t.auth.diagnostics} <span className="text-danger">{error}</span>
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
                        {t.auth.requestAccessDiscord}
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
                    {t.auth.returnHome}
                </Link>
            </div>
        </div>
    );
}

export default function AuthErrorPage() {
    const { t } = useI18n();

    return (
        <div className="registre landing-theme min-h-screen flex flex-col bg-background text-foreground selection:bg-danger/30">
            <PublicHeader variant="standard" backHref="/" backLabel={t.nav.backToHome} />

            <main className="flex-1">
                <div className="reg-shell py-10 lg:py-16">
                    <Suspense fallback={
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
                            <p className="text-xs">...</p>
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
