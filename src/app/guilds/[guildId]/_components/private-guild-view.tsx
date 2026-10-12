"use client";

import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { GuildEmblem } from "@/components/guild/guild-emblem";
import type { User } from "next-auth";

/**
 * Guilde privée — registre (refonte anti-slop).
 *
 * Ce qui a été retiré : `AuroraBackground` + dégradé radial, halo animé
 * `blur-2xl`, carte `rounded-2xl shadow-2xl backdrop-blur-3xl`, barre
 * décorative en dégradé, bouton `active:scale-95` en capitales.
 *
 * Il reste ce qu'il y a à dire : qui est cette guilde, pourquoi on ne voit rien,
 * et le chemin de retour. L'emblème passe par `GuildEmblem` (repli en initiales
 * quand l'icône Discord manque, au lieu d'un carré noir).
 */

type Props = {
    guild: {
        name: string;
        iconUrl: string | null;
    };
    isMember?: boolean;
    /** #142 — session utilisateur : le header public affiche le profil connecté au lieu du bouton « Connexion ». */
    user?: User;
};

export function PrivateGuildView({ guild, isMember, user }: Props) {
    return (
        <div className="registre min-h-screen bg-background text-foreground font-sans flex flex-col">
            <PublicHeader variant="standard" isMember={isMember} user={user} />

            <main className="flex-1">
                <section className="reg-section" aria-labelledby="guilde-privee-titre">
                    <div className="reg-shell max-w-[42rem]">
                        <div className="reg-panel p-6 md:p-8">
                            <GuildEmblem src={guild.iconUrl} name={guild.name} size={64} className="mb-6" />

                            <p className="reg-eyebrow inline-flex items-center gap-2">
                                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                                Contenu privé
                            </p>
                            <h1
                                id="guilde-privee-titre"
                                className="mt-3 text-[clamp(1.5rem,2.6vw,2rem)] font-bold tracking-tight text-foreground"
                            >
                                {guild.name}
                            </h1>
                            <p className="mt-3 max-w-[54ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
                                Cette guilde n'a pas encore activé sa présentation publique ou a choisi de rester dans l'ombre.
                            </p>

                            <Link href="/guilds" className="reg-btn reg-btn-secondary mt-8">
                                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                                Retour à l'annuaire
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            <GalacticFooter isMember={isMember} />
        </div>
    );
}
