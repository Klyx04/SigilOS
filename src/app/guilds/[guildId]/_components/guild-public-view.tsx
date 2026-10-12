"use client";

import Link from "next/link";
import Image from "next/image";
import {
    Users,
    Calendar,
    Server,
    MessageCircle,
    Sparkles,
    Star,
} from "lucide-react";
import { AVAILABLE_ACTIVITIES, ACTIVITY_ASSETS, FOUNDER_CROWN_ASSET } from "@/lib/presentation-constants";
import { getDofusServerImage } from "@/lib/dofus-assets";
import type { GuildPresentation } from "@/server/actions/presentation-actions";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { GuildEmblem } from "@/components/guild/guild-emblem";
import type { User } from "next-auth";

/**
 * Profil public d'une guilde — registre (refonte anti-slop).
 *
 * 🐞 Deux bugs d'affichage corrigés ici :
 *  1. L'en-tête public était rendu APRÈS le bandeau de 40–50vh, avec un `-mt-32`
 *     qui remontait l'identité dessous : la barre collante se posait au milieu
 *     de la page et masquait le nom de la guilde. Le bandeau vit maintenant dans
 *     le flux, sous l'en-tête.
 *  2. L'icône de guilde (URL Discord) pouvait ne pas se charger : il restait un
 *     carré noir sans repli. `GuildEmblem` affiche les initiales dans ce cas.
 *
 * Ce qui a été retiré : `AuroraBackground` + dégradé radial, parallaxe
 * `framer-motion`, cartes `rounded-2xl` à ombre portée, tuiles d'icônes teintées
 * (`bg-warning/10`, `yellow-500`, `pink-400`), pastilles d'activités et libellés
 * en capitales espacées.
 */

function ActivityThumb({ id }: { id: string }) {
    const src = ACTIVITY_ASSETS[id];
    if (!src) return <Sparkles className="h-5 w-5 text-muted-foreground" aria-hidden="true" />;
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className="h-5 w-5 shrink-0 object-contain"
        />
    );
}

const getActivityLabel = (id: string) => {
    const activity = AVAILABLE_ACTIVITIES.find(a => a.id === id);
    return activity?.label || id;
};

type Props = {
    guild: GuildPresentation;
    foundedYear: number;
    isMember?: boolean;
    /** #142 — session utilisateur : le header public affiche le profil connecté au lieu du bouton « Connexion ». */
    user?: User;
};

export function GuildPublicView({ guild, foundedYear, isMember, user }: Props) {
    const foundedDate = guild.foundedDate ? new Date(guild.foundedDate) : null;

    // Un seul état-major, trois rôles : fondateur, co-leaders, bras droits.
    const roster = [
        ...(guild.founder ? [{ pseudo: guild.founder, role: "Fondateur", lead: true }] : []),
        ...(guild.coLeaders ?? []).map((pseudo) => ({ pseudo, role: "Co-leader", lead: false })),
        ...(guild.team ?? []).map((pseudo) => ({ pseudo, role: "Bras droit", lead: false })),
    ];

    return (
        <div className="registre min-h-screen bg-background text-foreground font-sans flex flex-col">
            <PublicHeader
                activePage="annuaire"
                backHref="/guilds"
                backLabel="Annuaire"
                isMember={isMember}
                user={user}
            />

            {/* Statut de membre — une ligne, pas une carte en verre. */}
            {isMember && (
                <div className="border-b border-border bg-surface">
                    <div className="reg-shell flex flex-wrap items-center justify-between gap-3 py-3">
                        <p className="text-sm font-semibold text-foreground">
                            Vous êtes membre de cette guilde
                        </p>
                        <Link href={`/dashboard/${guild.discordGuildId}`} className="reg-link text-sm">
                            Ouvrir le Dashboard
                        </Link>
                    </div>
                </div>
            )}

            {/* Bandeau de la guilde : donnée réelle (image envoyée par la guilde),
                posé dans le flux — plus de hero en `h-[50vh]` ni de dégradé noir. */}
            {guild.bannerType === "custom" && guild.bannerUrl && (
                <div className="reg-shell pt-6">
                    <div className="reg-screen">
                        <Image
                            src={guild.bannerUrl}
                            alt={`Bandeau de la guilde ${guild.name}`}
                            width={1600}
                            height={600}
                            priority
                            unoptimized
                            className="aspect-[8/3] w-full object-cover"
                        />
                    </div>
                </div>
            )}

            {/* Identité de la guilde : emblème, nom, faits vérifiables. */}
            <section className="reg-section reg-section-tight" aria-label="Identité de la guilde">
                <div className="reg-shell flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
                    <GuildEmblem src={guild.iconUrl} name={guild.name} size={96} priority />

                    <div className="min-w-0">
                        <h1 className="text-[clamp(1.75rem,3.6vw,2.5rem)] font-bold leading-[1.12] tracking-tight text-foreground">
                            {guild.name}
                        </h1>

                        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                            {guild.server && (
                                <span className="inline-flex items-center gap-2">
                                    {(() => {
                                        const img = getDofusServerImage(guild.server);
                                        return img ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={img}
                                                alt=""
                                                loading="lazy"
                                                decoding="async"
                                                draggable={false}
                                                className="h-8 w-8 rounded-md object-cover border border-black/30"
                                            />
                                        ) : (
                                            <Server className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                                        );
                                    })()}
                                    <span className="text-muted-foreground">Serveur</span>
                                    <span className="font-semibold text-foreground">{guild.server}</span>
                                </span>
                            )}
                            <span className="inline-flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                                <span className="text-muted-foreground">Fondée en</span>
                                <span className="reg-mono font-semibold text-foreground">{foundedYear}</span>
                            </span>
                            {guild.memberCount !== null && guild.memberCount !== undefined && (
                                <span className="inline-flex items-center gap-2">
                                    <Users className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                                    <span className="text-muted-foreground">Membres</span>
                                    <span className="reg-mono font-semibold text-foreground">{guild.memberCount} / 350</span>
                                </span>
                            )}
                        </div>

                        {(guild.activities?.length ?? 0) > 0 && (
                            <ul className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
                                {guild.activities?.map((activity) => (
                                    <li key={activity} className="inline-flex items-center gap-2 text-sm text-foreground">
                                        <ActivityThumb id={activity} />
                                        {getActivityLabel(activity)}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </section>

            <main className="reg-shell pb-16">
                <div className="grid grid-cols-1 gap-10 lg:grid-cols-3 lg:gap-12">

                    {/* Colonne principale : état-major, manifeste, galerie. */}
                    <div className="space-y-12 lg:col-span-2">

                        {roster.length > 0 && (
                            <section aria-labelledby="etat-major-titre">
                                <h2 id="etat-major-titre" className="reg-eyebrow">État-Major</h2>
                                <ul className="mt-4 border-t border-border">
                                    {roster.map((member, index) => (
                                        <li
                                            key={`${member.role}-${member.pseudo}-${index}`}
                                            className="flex items-center justify-between gap-4 border-b border-border py-3"
                                        >
                                            <span className="inline-flex min-w-0 items-center gap-2">
                                                {member.lead
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    ? <img src={FOUNDER_CROWN_ASSET} alt="" loading="lazy" decoding="async" draggable={false} className="h-5 w-5 shrink-0 object-contain" />
                                                    : <Star className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                                                <span className="truncate font-semibold text-foreground">{member.pseudo}</span>
                                            </span>
                                            <span className="shrink-0 text-xs text-muted-foreground">{member.role}</span>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        {guild.history && (
                            <section aria-labelledby="manifeste-titre">
                                <h2 id="manifeste-titre" className="reg-eyebrow">Manifeste</h2>
                                <div className="mt-4 border-l-2 border-border-strong pl-5">
                                    <p className="whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed text-foreground">
                                        {guild.history}
                                    </p>
                                </div>
                            </section>
                        )}

                        {guild.photoUrl && (
                            <section aria-labelledby="galerie-titre">
                                <h2 id="galerie-titre" className="reg-eyebrow">Galerie</h2>
                                <figure className="mt-4">
                                    <div className="reg-screen">
                                        <Image
                                            src={guild.photoUrl}
                                            alt={`Photo de la guilde ${guild.name}`}
                                            width={1600}
                                            height={900}
                                            unoptimized
                                            className="aspect-video w-full object-cover"
                                        />
                                    </div>
                                </figure>
                            </section>
                        )}
                    </div>

                    {/* Colonne latérale : le recrutement, en données brutes. */}
                    <aside aria-labelledby="recrutement-titre">
                        <div className="reg-panel p-6 lg:sticky lg:top-24">
                            <h2 id="recrutement-titre" className="reg-eyebrow">Centre de Recrutement</h2>

                            <dl className="mt-4">
                                <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
                                    <dt className="text-sm text-muted-foreground">Statut</dt>
                                    <dd>
                                        <span className="reg-tag">
                                            {guild.isRecruiting ? "Ouvert" : "Fermé"}
                                        </span>
                                    </dd>
                                </div>

                                {guild.memberCount !== null && guild.memberCount !== undefined && (
                                    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
                                        <dt className="text-sm text-muted-foreground">Membres</dt>
                                        <dd className="reg-mono text-sm font-semibold text-foreground">
                                            {guild.memberCount} / 350
                                        </dd>
                                    </div>
                                )}

                                {foundedDate && (
                                    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
                                        <dt className="text-sm text-muted-foreground">Fondation</dt>
                                        <dd className="reg-mono text-sm text-foreground">
                                            {foundedDate.toLocaleDateString("fr-FR", { year: 'numeric', month: 'long', day: 'numeric' })}
                                        </dd>
                                    </div>
                                )}

                                {guild.isRecruiting && guild.minLevel && (
                                    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
                                        <dt className="text-sm text-muted-foreground">Niveau minimum</dt>
                                        <dd className="reg-mono text-sm font-semibold text-foreground">{guild.minLevel}</dd>
                                    </div>
                                )}

                                {guild.isRecruiting && guild.minSuccesses && (
                                    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
                                        <dt className="text-sm text-muted-foreground">Succès minimum</dt>
                                        <dd className="reg-mono text-sm font-semibold text-foreground">{guild.minSuccesses}</dd>
                                    </div>
                                )}
                            </dl>

                            {guild.isRecruiting && guild.recruitmentRequirements && (
                                <div className="pt-4">
                                    <p className="text-xs text-muted-foreground">Pré-requis</p>
                                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                                        {guild.recruitmentRequirements}
                                    </p>
                                </div>
                            )}

                            {guild.discord && (
                                <Link
                                    href={guild.discord}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="reg-btn reg-btn-primary mt-6 w-full"
                                >
                                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                                    Rejoindre le Discord
                                </Link>
                            )}
                        </div>
                    </aside>
                </div>
            </main>

            <GalacticFooter isMember={isMember} />
        </div>
    );
}
