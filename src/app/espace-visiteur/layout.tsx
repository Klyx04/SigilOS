import type { ReactNode } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { requirePublicSession } from "@/server/public-account";
import { VisitorNav } from "./_components/visitor-nav";

export const metadata = {
    title: "Espace visiteur | SigilOS",
    description:
        "Ton profil public de visiteur : identité Dofus, mules, présentation, succès de donjons et métiers.",
};

/**
 * Coque de l'espace visiteur (rang 57, D-V6) : **aucun chrome de guilde**, aucun `guildId`.
 *
 * La garde de session est aussi posée ici (défense en profondeur) ; chaque **page** appelle
 * la sienne, car un `layout` ne protège pas une route imbriquée rendue seule.
 */
export default async function VisitorLayout({ children }: { children: ReactNode }) {
    await requirePublicSession();

    return (
        <div className="min-h-dvh bg-background text-foreground">
            <header className="border-b border-border bg-surface/40">
                <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
                    <div>
                        <p className="text-xs text-muted-foreground">Espace perso</p>
                        <p className="text-lg font-semibold text-foreground">Espace visiteur</p>
                    </div>
                    <SignOutButton />
                </div>
                <VisitorNav />
            </header>
            <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-16">{children}</main>
        </div>
    );
}
