import { Hammer, Sparkles, Target, Trophy } from "lucide-react";
import { GameIcon } from "@/components/shared/game-icon";
import { formatDofusLevel } from "@/lib/dofus-level";
import type { VisitorProfile } from "@/lib/public-directory";
import type { Translations } from "@/lib/i18n/locales/fr";

/**
 * Corps de la fiche visiteur (V2e, refonte visuelle du 16/11/2026). Composant **serveur
 * pur** : il ne reçoit qu'un `VisitorProfile` déjà filtré par la couche serveur, donc il ne
 * peut rien exposer d'autre (pas de mules, pas de Metamob — ces champs n'existent pas dans
 * le DTO). Aucun contrôle : la fiche est en lecture seule par conception.
 */
export function VisitorProfileCard({
    profile,
    labels,
}: {
    profile: VisitorProfile;
    labels: Translations["visitorsPage"];
}) {
    const summary = [
        { label: labels.profile.level, value: formatDofusLevel(profile.level) },
        { label: labels.profile.successPoints, value: profile.successPoints ?? "—" },
        { label: labels.profile.achievements, value: profile.achievements },
        { label: labels.profile.bounties, value: profile.bountiesDone },
    ];

    return (
        <>
            <header className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
                    <span className="grid size-20 shrink-0 place-items-center rounded-xl border border-border bg-background p-2">
                        {profile.classe ? (
                            <GameIcon src={profile.classe.icon} className="size-16" />
                        ) : (
                            <Trophy className="size-8 text-muted-foreground" aria-hidden="true" />
                        )}
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="reg-eyebrow">Profil public</p>
                        <h1
                            id="visiteur-titre"
                            className="mt-1 truncate text-[clamp(1.6rem,3vw,2.25rem)] font-semibold leading-tight tracking-tight text-foreground"
                        >
                            {profile.pseudo ?? labels.anonymous}
                        </h1>
                        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            {profile.server ? (
                                <span className="inline-flex items-center gap-2">
                                    <GameIcon src={profile.server.icon} className="size-5" />
                                    {profile.server.name}
                                </span>
                            ) : null}
                            {profile.classe ? <span>{profile.classe.name}</span> : null}
                            {profile.guildName ? (
                                <span className="inline-flex items-center gap-1.5">
                                    <GameIcon src="/assets/dofus/modules/guild.png" className="size-4" />
                                    {labels.profile.guild} · {profile.guildName}
                                </span>
                            ) : null}
                        </p>
                    </div>
                </div>

                <dl className="grid grid-cols-2 gap-3 border-t border-border p-5 sm:grid-cols-4 sm:p-6">
                    {summary.map((item) => (
                        <div
                            key={item.label}
                            className="min-w-0 rounded-lg border border-border bg-background/60 px-3 py-2.5"
                        >
                            <dt className="text-[11px] leading-tight text-muted-foreground">
                                {item.label}
                            </dt>
                            <dd className="reg-mono mt-1 text-lg font-semibold text-foreground">
                                {item.value}
                            </dd>
                        </div>
                    ))}
                </dl>
            </header>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
                    <h2 className="reg-eyebrow flex items-center gap-2">
                        <Sparkles className="size-3.5" aria-hidden="true" />
                        {labels.profile.presentation}
                    </h2>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                        {profile.introduction ?? labels.profile.empty}
                    </p>
                </section>
                <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
                    <h2 className="reg-eyebrow flex items-center gap-2">
                        <Target className="size-3.5" aria-hidden="true" />
                        {labels.profile.objectives}
                    </h2>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                        {profile.objectifs ?? labels.profile.empty}
                    </p>
                </section>
            </div>

            <section className="mt-4 rounded-xl border border-border bg-surface p-4 sm:p-5">
                <h2 className="reg-eyebrow flex items-center gap-2">
                    <Hammer className="size-3.5" aria-hidden="true" />
                    {labels.profile.jobs}
                </h2>
                {profile.jobs.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">{labels.profile.noJobs}</p>
                ) : (
                    <ul className="mt-3 flex flex-wrap gap-2">
                        {profile.jobs.map((job) => (
                            <li
                                key={job.id}
                                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                            >
                                <GameIcon src={job.icon} className="size-4" />
                                <span className="max-w-[10rem] truncate">{job.name}</span>
                                <span className="reg-mono text-muted-foreground">{job.level}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </>
    );
}
