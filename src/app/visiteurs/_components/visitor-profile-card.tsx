import { formatDistanceToNow } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import {
    Compass,
    ExternalLink,
    Sparkles,
    Swords,
    Target,
    Trophy,
    User,
    Users,
} from "lucide-react";
import { GameIcon } from "@/components/shared/game-icon";
import { VisitorProfileLists } from "./visitor-profile-lists";
import { formatDofusLevel } from "@/lib/dofus-level";
import type { VisitorProfile } from "@/lib/public-directory";
import { MAIN_CHARACTER_SLOT } from "@/lib/succes-characters";
import type { Translations } from "@/lib/i18n/locales/fr";
import type { Locale } from "@/lib/i18n/types";

/**
 * Corps de la fiche visiteur (V2e, enrichi V5 bis le 16/11/2026). Composant **serveur pur** :
 * il ne reçoit qu'un `VisitorProfile` déjà filtré par la couche serveur. La fiche est en
 * lecture seule par conception ; les sections Rush et Metamob ne sont rendues que si le DTO
 * les porte (consentement `showRushProgress`, `metamobVerified`). Aucune clé ne transite.
 */
export function VisitorProfileCard({
    profile,
    labels,
    locale,
}: {
    profile: VisitorProfile;
    labels: Translations["visitorsPage"];
    locale: Locale;
}) {
    const dateLocale = locale === "en" ? enUS : fr;
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
                        <p className="mt-1 text-xs text-muted-foreground">
                            {labels.profile.updated}{" "}
                            {formatDistanceToNow(profile.updatedAt, {
                                addSuffix: true,
                                locale: dateLocale,
                            })}
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

            {profile.mules.length > 0 || profile.activities.length > 0 ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {profile.mules.length > 0 ? (
                        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
                            <h2 className="reg-eyebrow flex items-center gap-2">
                                <Users className="size-3.5" aria-hidden="true" />
                                {labels.profile.characters}
                            </h2>
                            <ul className="mt-3 space-y-2">
                                {profile.mules.map((mule) => (
                                    <li
                                        key={mule.pseudo}
                                        className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2"
                                    >
                                        {mule.classe ? (
                                            <GameIcon
                                                src={mule.classe.icon}
                                                className="size-6 shrink-0"
                                            />
                                        ) : (
                                            <User
                                                className="size-5 shrink-0 text-muted-foreground"
                                                aria-hidden="true"
                                            />
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-foreground">
                                                {mule.pseudo}
                                            </p>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {mule.classe?.name ?? labels.profile.unknownClass}
                                                {mule.level
                                                    ? ` · ${labels.profile.level} ${formatDofusLevel(mule.level)}`
                                                    : ""}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ) : null}

                    {profile.activities.length > 0 ? (
                        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
                            <h2 className="reg-eyebrow flex items-center gap-2">
                                <Compass className="size-3.5" aria-hidden="true" />
                                {labels.profile.activities}
                            </h2>
                            <ul className="mt-3 flex flex-wrap gap-2">
                                {profile.activities.map((activity) => (
                                    <li
                                        key={activity.id}
                                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                                    >
                                        <GameIcon src={activity.icon} className="size-4" />
                                        {activity.label}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ) : null}
                </div>
            ) : null}

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

                        <VisitorProfileLists
                achievements={profile.achievementList}
                achievementsTotal={profile.achievements}
                bounties={profile.bountyList}
                bountiesTotal={profile.bountiesDone}
                jobs={profile.jobs}
                labels={labels}
            />

<section className="mt-4 rounded-xl border border-border bg-surface p-4 sm:p-5">
                <h2 className="reg-eyebrow flex items-center gap-2">
                    <Swords className="size-3.5" aria-hidden="true" />
                    {labels.profile.rush}
                </h2>
                {profile.rush === null ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                        {labels.profile.rushNotShared}
                    </p>
                ) : profile.rush.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">{labels.profile.noRush}</p>
                ) : (
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                        {profile.rush.map((character) => (
                            <li
                                key={character.characterSlot}
                                className="rounded-lg border border-border bg-background p-3"
                            >
                                <div className="flex items-center gap-2">
                                    {character.classe ? (
                                        <GameIcon
                                            src={character.classe.icon}
                                            className="size-6 shrink-0"
                                        />
                                    ) : (
                                        <User
                                            className="size-5 shrink-0 text-muted-foreground"
                                            aria-hidden="true"
                                        />
                                    )}
                                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                                        {character.characterName ?? character.characterSlot}
                                    </p>
                                    <CharacterBadge
                                        slot={character.characterSlot}
                                        labels={labels}
                                    />
                                </div>
                                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                    <span>
                                        {character.completedMilestones}{" "}
                                        {labels.profile.rushBlocks}
                                    </span>
                                    <span>
                                        {character.completedSteps} {labels.profile.rushSteps}
                                    </span>
                                    <span>
                                        {character.dungeonChecks} {labels.profile.rushDungeons}
                                    </span>
                                </p>
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                    {labels.profile.rushUpdated}{" "}
                                    {formatDistanceToNow(character.updatedAt, {
                                        addSuffix: true,
                                        locale: dateLocale,
                                    })}
                                </p>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {profile.metamob ? (
                <section className="mt-4 rounded-xl border border-border bg-surface p-4 sm:p-5">
                    <h2 className="reg-eyebrow flex items-center gap-2">
                        <ExternalLink className="size-3.5" aria-hidden="true" />
                        {labels.profile.metamob}
                    </h2>
                    <a
                        href={profile.metamob.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="reg-link mt-2 inline-flex items-center gap-1.5 text-sm font-medium"
                    >
                        {labels.profile.metamobOpen.replace("{pseudo}", profile.metamob.pseudo)}
                        <ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {labels.profile.metamobVerified}
                    </p>
                </section>
            ) : null}
        </>
    );
}

function CharacterBadge({
    slot,
    labels,
}: {
    slot: string;
    labels: Translations["visitorsPage"];
}) {
    return (
        <span className="shrink-0 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {slot === MAIN_CHARACTER_SLOT ? labels.profile.mainCharacter : slot}
        </span>
    );
}
