import Image from "next/image";
import Link from "next/link";
import {
    ExternalLink,
    Pencil,
    Users,
    Calendar,
    Server,
    MessageCircle,
    Sparkles,
    Star,
} from "lucide-react";
import type { GuildPresentation } from "@/server/actions/presentation-actions";
import { AVAILABLE_ACTIVITIES, ACTIVITY_ASSETS, FOUNDER_CROWN_ASSET } from "@/lib/presentation-constants";
import { getDofusServerImage } from "@/lib/dofus-assets";
import { GuildEmblem } from "@/components/guild/guild-emblem";

/**
 * Lecture interne de la présentation — registre, pas de cartes génériques.
 * Même langage que la page publique (`guild-public-view`) : emblème, faits
 * vérifiables, état-major en registre, manifeste en marge, recrutement en
 * panneau latéral. Zéro emoji, statut neutre (pas de fond teinté), vignettes
 * du jeu pour les activités et le serveur.
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
    const activity = AVAILABLE_ACTIVITIES.find((a) => a.id === id);
    return activity?.label || id;
};

export default function PresentationContent({
    guild,
    user,
    guildId,
}: {
    guild: GuildPresentation;
    user: any;
    guildId: string;
}) {
    const canEdit = user.isAdmin || user.canEditPresentation;
    const foundedDate = guild.foundedDate ? new Date(guild.foundedDate) : null;

    const roster = [
        ...(guild.founder ? [{ pseudo: guild.founder, role: "Fondateur", lead: true }] : []),
        ...(guild.coLeaders ?? []).map((pseudo) => ({ pseudo, role: "Co-leader", lead: false })),
        ...(guild.team ?? []).map((pseudo) => ({ pseudo, role: "Bras droit", lead: false })),
    ];

    return (
        <div className="registre">
            {/* Barre de lecture : statut à gauche, actions à droite. */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="inline-flex items-center gap-2 text-sm">
                    <span className="reg-tag">
                        {guild.isRecruiting ? "Recrute" : "Recrutement fermé"}
                    </span>
                    <span className="text-muted-foreground">
                        {guild.isRecruiting ? "Visible dans l'annuaire" : "Masquée de l'annuaire"}
                    </span>
                </p>
                <p className="inline-flex items-center gap-4 text-sm">
                    <Link href={`/guilds/${guildId}`} target="_blank" className="reg-link-quiet inline-flex items-center gap-1.5">
                        Voir page publique
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                    {canEdit && (
                        <Link href={`/dashboard/${guildId}/admin/presentation`} className="reg-btn reg-btn-primary !min-h-0 px-3 py-1.5 text-sm">
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            Retravailler la page
                        </Link>
                    )}
                </p>
            </div>

            {/* Étendard : image réelle de la guilde, rien si absente. */}
            {guild.bannerType === "custom" && guild.bannerUrl && (
                <div className="reg-screen mt-6">
                    <Image
                        src={guild.bannerUrl}
                        alt={`Étendard de la guilde ${guild.name}`}
                        width={1600}
                        height={600}
                        priority
                        unoptimized
                        className="aspect-[8/3] w-full object-cover"
                    />
                </div>
            )}

            {/* Identité : emblème, nom, faits vérifiables. */}
            <section aria-label="Identité de la guilde" className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
                <GuildEmblem src={guild.iconUrl} name={guild.name} size={88} priority />
                <div className="min-w-0">
                    <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-bold leading-tight tracking-tight">
                        {guild.name}
                    </h2>
                    <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
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
                                            className="h-8 w-8 rounded-md border border-black/30 object-cover"
                                        />
                                    ) : (
                                        <Server className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                                    );
                                })()}
                                <span className="text-muted-foreground">Serveur</span>
                                <span className="font-semibold">{guild.server}</span>
                            </span>
                        )}
                        {foundedDate && (
                            <span className="inline-flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                                <span className="text-muted-foreground">Fondée le</span>
                                <span className="reg-mono font-semibold">
                                    {foundedDate.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })}
                                </span>
                            </span>
                        )}
                        {guild.memberCount !== null && guild.memberCount !== undefined && (
                            <span className="inline-flex items-center gap-2">
                                <Users className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                                <span className="text-muted-foreground">Membres</span>
                                <span className="reg-mono font-semibold">{guild.memberCount} / 350</span>
                            </span>
                        )}
                    </div>
                    {(guild.activities?.length ?? 0) > 0 && (
                        <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                            {guild.activities?.map((activity) => (
                                <li key={activity} className="inline-flex items-center gap-2 text-sm">
                                    <ActivityThumb id={activity} />
                                    {getActivityLabel(activity)}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </section>

            {!guild.history && roster.length === 0 && canEdit && (
                <div className="reg-panel mt-8 p-6">
                    <p className="reg-eyebrow">Page à écrire</p>
                    <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
                        Ni récit ni état-major pour l&apos;instant. Une guilde sans manifeste
                        attire peu de recrues — racontez d&apos;où vous venez en cinq minutes.
                    </p>
                    <Link href={`/dashboard/${guildId}/admin/presentation`} className="reg-link mt-3 inline-block text-sm">
                        Commencer par les fondations
                    </Link>
                </div>
            )}

            <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-3 lg:gap-12">
                <div className="space-y-12 lg:col-span-2">
                    {roster.length > 0 ? (
                        <section aria-labelledby="etat-major-titre">
                            <h3 id="etat-major-titre" className="reg-eyebrow">État-major</h3>
                            <ul className="mt-4 border-t border-border">
                                {roster.map((member, index) => (
                                    <li
                                        key={`${member.role}-${member.pseudo}-${index}`}
                                        className="flex items-center justify-between gap-4 border-b border-border py-3"
                                    >
                                        <span className="inline-flex min-w-0 items-center gap-2">
                                            {member.lead ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={FOUNDER_CROWN_ASSET} alt="" loading="lazy" decoding="async" draggable={false} className="h-5 w-5 shrink-0 object-contain" />
                                            ) : (
                                                <Star className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                            )}
                                            <span className="truncate font-semibold">{member.pseudo}</span>
                                        </span>
                                        <span className="shrink-0 text-xs text-muted-foreground">{member.role}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ) : (
                        <section aria-label="État-major vide">
                            <h3 className="reg-eyebrow">État-major</h3>
                            <p className="mt-4 border-l-2 border-border pl-5 text-sm leading-relaxed text-muted-foreground">
                                Personne n&apos;est inscrit à l&apos;état-major. Désignez au moins le
                                meneur pour que les recrues sachent à qui s&apos;adresser.
                            </p>
                        </section>
                    )}

                    {guild.history ? (
                        <section aria-labelledby="manifeste-titre">
                            <h3 id="manifeste-titre" className="reg-eyebrow">Manifeste</h3>
                            <div className="mt-4 border-l-2 border-border-strong pl-5">
                                <p className="whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed">
                                    {guild.history}
                                </p>
                            </div>
                        </section>
                    ) : (
                        <section aria-label="Manifeste vide">
                            <h3 className="reg-eyebrow">Manifeste</h3>
                            <p className="mt-4 border-l-2 border-border pl-5 text-sm leading-relaxed text-muted-foreground">
                                Aucun récit pour l&apos;instant. D&apos;où vient la guilde, ce
                                qu&apos;elle cherche, ce qu&apos;elle refuse — trois phrases
                                suffisent pour commencer.
                            </p>
                        </section>
                    )}

                    {guild.photoUrl && (
                        <section aria-labelledby="galerie-titre">
                            <h3 id="galerie-titre" className="reg-eyebrow">Salle des bannières</h3>
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

                <aside aria-labelledby="recrutement-titre">
                    <div className="reg-panel p-6 lg:sticky lg:top-24">
                        <h3 id="recrutement-titre" className="reg-eyebrow">Centre de recrutement</h3>
                        <dl className="mt-4">
                            <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
                                <dt className="text-sm text-muted-foreground">Statut</dt>
                                <dd>
                                    <span className="reg-tag">
                                        {guild.isRecruiting ? "Ouvert" : "Fermé"}
                                    </span>
                                </dd>
                            </div>
                            {guild.minLevel !== null && guild.minLevel !== undefined && (
                                <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
                                    <dt className="text-sm text-muted-foreground">Niveau minimum</dt>
                                    <dd className="reg-mono text-sm font-semibold">{guild.minLevel}</dd>
                                </div>
                            )}
                            {guild.minSuccesses !== null && guild.minSuccesses !== undefined && (
                                <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
                                    <dt className="text-sm text-muted-foreground">Succès minimum</dt>
                                    <dd className="reg-mono text-sm font-semibold">{guild.minSuccesses}</dd>
                                </div>
                            )}
                        </dl>
                        {guild.isRecruiting && guild.recruitmentRequirements && (
                            <div className="pt-4">
                                <p className="text-xs text-muted-foreground">Pré-requis</p>
                                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">
                                    {guild.recruitmentRequirements}
                                </p>
                            </div>
                        )}
                        {guild.discord ? (
                            <Link
                                href={guild.discord}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="reg-btn reg-btn-primary mt-6 w-full"
                            >
                                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                                Rejoindre le Discord
                            </Link>
                        ) : (
                            <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
                                Aucune porte d&apos;entrée renseignée. Ajoutez le lien Discord
                                depuis l&apos;édition pour que les recrues frappent au bon endroit.
                            </p>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
}
