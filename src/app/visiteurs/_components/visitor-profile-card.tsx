import { GameIcon } from "@/components/shared/game-icon";
import type { VisitorProfile } from "@/lib/public-directory";
import type { Translations } from "@/lib/i18n/locales/fr";

/**
 * Corps de la fiche visiteur (V2e). Composant **serveur pur** : il ne reçoit qu'un
 * `VisitorProfile` déjà filtré par la couche serveur, donc il ne peut rien exposer d'autre
 * (pas de mules, pas de Metamob — ces champs n'existent pas dans le DTO).
 */
export function VisitorProfileCard({
    profile,
    labels,
}: {
    profile: VisitorProfile;
    labels: Translations["visitorsPage"];
}) {
    const summary = [
        { label: labels.profile.level, value: profile.level ?? "—" },
        { label: labels.profile.successPoints, value: profile.successPoints ?? "—" },
        { label: labels.profile.achievements, value: profile.achievements },
    ];

    return (
        <>
            <div className="mt-6 flex items-start gap-4">
                {profile.classe ? <GameIcon src={profile.classe.icon} className="size-12" /> : null}
                <div className="min-w-0">
                    <h1
                        id="visiteur-titre"
                        className="text-[clamp(1.6rem,3vw,2.25rem)] font-bold leading-tight tracking-tight text-foreground"
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
                            <span>
                                {labels.profile.guild} · {profile.guildName}
                            </span>
                        ) : null}
                    </p>
                </div>
            </div>

            <dl className="mt-8 grid gap-3 sm:grid-cols-3">
                {summary.map((item) => (
                    <div key={item.label} className="rounded-xl border border-border bg-surface p-4">
                        <dt className="text-xs text-muted-foreground">{item.label}</dt>
                        <dd className="mt-1 text-xl font-semibold text-foreground">{item.value}</dd>
                    </div>
                ))}
            </dl>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <section className="rounded-xl border border-border bg-surface p-5">
                    <h2 className="text-base font-semibold text-foreground">{labels.profile.presentation}</h2>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                        {profile.introduction ?? labels.profile.empty}
                    </p>
                </section>
                <section className="rounded-xl border border-border bg-surface p-5">
                    <h2 className="text-base font-semibold text-foreground">{labels.profile.objectives}</h2>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                        {profile.objectifs ?? labels.profile.empty}
                    </p>
                </section>
            </div>

            <section className="mt-4 rounded-xl border border-border bg-surface p-5">
                <h2 className="text-base font-semibold text-foreground">{labels.profile.jobs}</h2>
                {profile.jobs.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">{labels.profile.noJobs}</p>
                ) : (
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {profile.jobs.map((job) => (
                            <li key={job.id} className="flex items-center gap-2 text-sm text-foreground">
                                <GameIcon src={job.icon} className="size-6" />
                                <span className="min-w-0 truncate">{job.name}</span>
                                <span className="ml-auto text-xs text-muted-foreground">{job.level}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </>
    );
}
