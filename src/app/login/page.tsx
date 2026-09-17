import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signIn } from "@/auth";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { DiscordIcon } from "@/components/shared/icons";
import { Metadata } from "next";

/**
 * Page de connexion — registre.
 *
 * Le rôle de cette page est documenté plus bas (page `signIn` personnalisée
 * d'Auth.js, pour éviter la route par défaut et sa faille d'open redirect).
 *
 * Ce qui a été retiré volontairement :
 *  - les deux orbes flous violet/bleu en `animate-pulse-slow` ;
 *  - l'anneau lumineux `absolute -inset-1 bg-gradient-to-r blur-xl` qui
 *    s'allumait au survol de la carte ;
 *  - la carte centrée `rounded-3xl border-violet-500/20 backdrop-blur-3xl
 *    shadow-2xl` et la tuile d'icône `rounded-2xl` avec
 *    `drop-shadow-[0_0_15px_rgba(139,92,246,0.4)]` ;
 *  - le bouton `bg-[#5865F2] font-black text-lg rounded-2xl shadow-xl
 *    hover:scale-[1.02] active:scale-95` (couleur codée en dur + micro-games
 *    d'échelle) ;
 *  - la mention en capitales espacées sous le bouton.
 *
 * À la place : en-tête gauche-aligné, un seul bouton `.reg-btn-primary` avec
 * l'icône Discord, et l'information utile — ce qui reste ouvert sans compte.
 */

export const metadata: Metadata = {
    title: "Connexion — SigilOS",
    description: "Connectez-vous à SigilOS via Discord pour accéder à votre tableau de bord de guilde.",
    robots: {
        index: false,
        follow: false,
    },
};

// SECURITY: This page is the custom signIn page for NextAuth.
// It replaces the default /api/auth/signin route which was flagged by Google Safe Browsing
// for the Open Redirect vulnerability in the callbackUrl param.
// The redirect callback in auth.ts now validates callbackUrl (same-origin only).
export default async function LoginPage({
    searchParams,
}: {
    searchParams: Promise<{ callbackUrl?: string; info?: string }>;
}) {
    const session = await auth();

    // Already logged in — redirect to the dashboard entry point
    if (session?.user) {
        redirect("/dashboard");
    }

    const { callbackUrl, info } = await searchParams;

    // SECURITY: Only allow relative callbackUrls to prevent Open Redirect
    const safeCallbackUrl =
        callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/";

    const isSessionExpired = info === "session_expired";

    return (
        <div className="registre min-h-screen flex flex-col bg-background text-foreground">
            <PublicHeader variant="standard" backHref="/" backLabel="Accueil" />

            <main className="flex-1">
                <div className="reg-shell py-10 lg:py-16">
                    <div className="max-w-[34rem]">
                        <p className="reg-eyebrow">Connexion</p>
                        <h1 className="mt-3 text-[clamp(1.6rem,2.8vw,2rem)] font-bold tracking-tight text-foreground">
                            Connexion requise
                        </h1>
                        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                            SigilOS s&apos;ouvre avec ton compte Discord&nbsp;: il n&apos;existe ni compte ni mot de
                            passe SigilOS, et aucun accès au compte Ankama n&apos;est demandé.
                        </p>

                        {isSessionExpired && (
                            <div className="reg-callout mt-6 border-warning/40">
                                <div>
                                    <p className="font-semibold text-foreground">Session expirée</p>
                                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                                        Ta session Discord a expiré. Reconnecte-toi pour continuer.
                                    </p>
                                </div>
                            </div>
                        )}

                        <form
                            className="mt-6"
                            action={async () => {
                                "use server";
                                await signIn("discord", { redirectTo: safeCallbackUrl });
                            }}
                        >
                            <button type="submit" className="reg-btn reg-btn-primary">
                                <DiscordIcon className="w-4 h-4" aria-hidden="true" />
                                Se connecter avec Discord
                            </button>
                        </form>

                        <p className="mt-5 max-w-[54ch] text-xs text-muted-foreground leading-relaxed">
                            Le tableau de bord est réservé aux membres des guildes présentes sur SigilOS. Les outils de
                            jeu — Rush Sylvestre, fiches de boss, Almanax — restent consultables sans compte.
                        </p>
                    </div>
                </div>
            </main>

            <GalacticFooter />
        </div>
    );
}
