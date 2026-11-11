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
                            <span className="inline-flex items-center gap-1.5">
                                <GameIcon src="/assets/dofus/modules/guild.png" className="size-4" />
                                {labels.profile.guild} · {profile.guildName}
                            </span>
                        ) : null}
                    </p>
                </div>
            </div>

            <dl className="mt-6 grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-surface">
                {summary.map((item) => (
                    <div key={item.label} className="min-w-0 p-3 sm:p-4">
                        <dt className="text-[11px] leading-tight text-muted-foreground">{item.label}</dt>
                        <dd className="reg-mono mt-1 text-lg font-semibold text-foreground">
                            {item.value}
                        </dd>
                    </div>
                ))}
            </dl>

            <section className="mt-4 rounded-xl border border-border bg-surface">
                <div className="grid sm:grid-cols-2 sm:divide-x sm:divide-border">
                    <div className="p-4 sm:p-5">
                        <h2 className="reg-eyebrow">{labels.profile.presentation}</h2>
                        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                            {profile.introduction ?? labels.profile.empty}
                        </p>
                    </div>
                    <div className="border-t border-border p-4 sm:border-t-0 sm:p-5">
                        <h2 className="reg-eyebrow">{labels.profile.objectives}</h2>
                        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                            {profile.objectifs ?? labels.profile.empty}
                        </p>
                    </div>
                </div>
            </section>

            <section className="mt-4 rounded-xl border border-border bg-surface p-4 sm:p-5">
                <h2 className="reg-eyebrow">{labels.profile.jobs}</h2>
                {profile.jobs.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">{labels.profile.noJobs}</p>
                ) : (
                    <ul className="mt-2 flex flex-wrap gap-2">
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
