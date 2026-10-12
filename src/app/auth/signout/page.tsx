import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { LogOut, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AutoSignOut } from "./_components/auto-sign-out";

/**
 * Confirmation de déconnexion — registre.
 *
 * Les textes sont inchangés ; seule la présentation revient dans la couche
 * `.reg-*`.
 *
 * Ce qui a été retiré volontairement :
 *  - la carte centrée `bg-zinc-950 rounded-3xl border-white/10 p-10` (fond noir
 *    en dur, thème clair cassé) et sa tuile d'icône `w-20 h-20 rounded-2xl
 *    bg-white/5` ;
 *  - le `text-white` du titre, le `text-zinc-400` du paragraphe, le
 *    `text-emerald-400` codé en dur de l'icône et le `text-zinc-500
 *    hover:bg-white/5` de l'action secondaire ;
 *  - les deux boutons pleine largeur `h-14 rounded-2xl font-black text-lg`
 *    (`bg-white text-black`, `active:scale-95`, `transition-all`), et la
 *    propriété `shadow` implicite des `Button` du design system ;
 *  - le `w-full min-h-[300px] flex flex-col items-center justify-center` de la
 *    carte : il n'existait que pour centrer deux boutons côte à côte.
 *
 * À la place : colonne de lecture `.reg-shell` alignée à gauche, une seule
 * action principale `.reg-btn-primary` (le `<form>` reste la frontière serveur
 * qui appelle `signOut`) et l'action secondaire en lien souligné `.reg-link`.
 */
export default async function SignOutPage({
    searchParams
}: {
    searchParams: Promise<{ reason?: string }>
}) {
    const session = await auth();
    const { reason } = await searchParams;

    if (!session) {
        redirect("/");
    }

    // Automatic signout for expired Discord OAuth tokens
    // We handle this via a client-side component to avoid cookie modification errors in Server Components
    const isAutoSignOut = reason === "token_expired";

    return (
        <div className="registre landing-theme min-h-screen flex flex-col bg-background text-foreground selection:bg-success/30">
            <PublicHeader user={session.user} variant="standard" backHref="/" backLabel="Retour" />

            <main className="flex-1">
                <div className="reg-shell py-10 lg:py-16">
                    <div className="max-w-[34rem]">
                        {isAutoSignOut ? (
                            <AutoSignOut redirectTo="/login?info=session_expired" />
                        ) : (
                            <>
                                <h1 className="flex items-center gap-3 text-[clamp(1.6rem,2.8vw,2rem)] font-bold tracking-tight text-foreground">
                                    <LogOut className="h-6 w-6 shrink-0 text-muted-foreground" aria-hidden="true" />
                                    Confirmation de déconnexion
                                </h1>
                                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                                    Êtes-vous sûr de vouloir quitter votre session SigilOS ? Tous vos accès sécurisés seront réinitialisés.
                                </p>

                                <form
                                    className="mt-6"
                                    action={async () => {
                                        "use server";
                                        await signOut({ redirectTo: "/" });
                                    }}
                                >
                                    <button type="submit" className="reg-btn reg-btn-primary">
                                        Se déconnecter
                                    </button>
                                </form>

                                <p className="mt-5">
                                    <Link href="/dashboard" className="reg-link inline-flex items-center gap-2">
                                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                                        Annuler et retourner au QG
                                    </Link>
                                </p>
                            </>
                        )}
                    </div>
                </div>
            </main>

            <GalacticFooter />
        </div>
    );
}
