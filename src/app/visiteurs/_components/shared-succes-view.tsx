import Link from "next/link";
import { Trophy } from "lucide-react";
import { GameIcon } from "@/components/shared/game-icon";
import { Input } from "@/components/ui/input";
import { getClass } from "@/lib/dofus-assets";
import { displayAchievementDescription } from "@/lib/challenge-description";
import {
    SHARED_SUCCES_MEMBERS_SHOWN,
    SHARED_SUCCES_VISITORS_TAKE,
    buildVisitorsHubHref,
    type SharedSuccesMember,
    type SharedSuccesRow,
} from "@/lib/visitors-hub";
import type { SharedSuccesDungeon, SharedSuccesDungeonBoard } from "@/server/public-succes-communs";
import type { Translations } from "@/lib/i18n/locales/fr";

/** Une colonne de membres — dense, plafonnée, avec le compte honnête du reste. */
function MemberColumn({
    title,
    members,
    empty,
    labels,
}: {
    title: string;
    members: SharedSuccesMember[];
    empty: string;
    labels: Translations["visitorsPage"];
}) {
    const shown = members.slice(0, SHARED_SUCCES_MEMBERS_SHOWN);
    const rest = members.length - shown.length;

    return (
        <div>
            <p className="reg-eyebrow">
                {title} · {members.length}
            </p>
            {members.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">{empty}</p>
            ) : (
                <ul className="mt-1 space-y-0.5">
                    {shown.map((member) => {
                        const classe = member.classe ? getClass(member.classe) : undefined;
                        return (
                            <li key={member.id} className="flex min-w-0 items-center gap-1.5 text-sm">
                                {classe ? (
                                    <GameIcon src={classe.icon} className="size-4 shrink-0" />
                                ) : null}
                                <Link
                                    href={`/visiteurs/${member.id}`}
                                    className="truncate text-foreground hover:text-accent"
                                >
                                    {member.pseudo ?? labels.anonymous}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
            {rest > 0 ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                    + {rest} {labels.hub.others}
                </p>
            ) : null}
        </div>
    );
}

/** Un succès : son identité, puis les deux colonnes « déjà validé / cherchent encore ». */
function AchievementRow({
    row,
    labels,
}: {
    row: SharedSuccesRow;
    labels: Translations["visitorsPage"];
}) {
    const description = displayAchievementDescription({
        description: row.achievement.description,
        slug: row.achievement.slug,
    });

    return (
        <article className="reg-panel p-4">
            <header className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-background p-1">
                    {row.achievement.iconUrl ? (
                        <GameIcon src={row.achievement.iconUrl} className="size-7" />
                    ) : (
                        <Trophy className="size-5 text-muted-foreground" aria-hidden="true" />
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-foreground">
                        {row.achievement.name}
                    </h3>
                    <p className="reg-mono mt-0.5 text-[11px] text-muted-foreground">
                        {row.achievement.points} pts
                    </p>
                    {description ? (
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {description}
                        </p>
                    ) : null}
                </div>
            </header>

            <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
                <MemberColumn
                    title={labels.hub.doneBy}
                    members={row.done}
                    empty={labels.hub.noneDone}
                    labels={labels}
                />
                <MemberColumn
                    title={labels.hub.lookingFor}
                    members={row.missing}
                    empty={labels.hub.noneLooking}
                    labels={labels}
                />
            </div>
        </article>
    );
}

/**
 * Vue « Succès en commun » — **100 % serveur**, aucun état client.
 *
 * La sélection du donjon vit dans l'URL (`?vue=succes&donjon=…`), donc le retour arrière
 * et le partage fonctionnent. La liste est bornée par `SUCCES_DUNGEONS_TAKE` ; les
 * colonnes par `SHARED_SUCCES_MEMBERS_SHOWN` (le reste est compté, jamais inventé).
 */
export function SharedSuccesView({
    dungeons,
    selected,
    search,
    labels,
}: {
    dungeons: SharedSuccesDungeon[];
    selected: SharedSuccesDungeonBoard | null;
    search: string;
    labels: Translations["visitorsPage"];
}) {
    return (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            <aside className="min-w-0">
                <form method="get" action="/visiteurs" className="flex flex-col gap-2 sm:flex-row">
                    <input type="hidden" name="vue" value="succes" />
                    <Input
                        name="q"
                        defaultValue={search}
                        maxLength={40}
                        placeholder={labels.hub.searchPlaceholder}
                        aria-label={labels.hub.searchLabel}
                        className="h-11"
                    />
                    <button type="submit" className="reg-btn reg-btn-secondary shrink-0">
                        {labels.hub.search}
                    </button>
                </form>
                {search ? (
                    <Link
                        href={buildVisitorsHubHref({ vue: "succes" })}
                        className="reg-link-quiet mt-2 inline-block text-xs"
                    >
                        {labels.hub.resetSearch}
                    </Link>
                ) : null}

                <div className="reg-panel mt-3 max-h-[32rem] overflow-y-auto">
                    {dungeons.length === 0 ? (
                        <p className="p-3 text-sm text-muted-foreground">{labels.hub.noDungeons}</p>
                    ) : (
                        <ul>
                            {dungeons.map((dungeon) => {
                                const active = selected?.dungeon.id === dungeon.id;
                                const key = dungeon.slug ?? dungeon.id;
                                const thumb = dungeon.imageUrl?.startsWith("/")
                                    ? dungeon.imageUrl
                                    : null;
                                return (
                                    <li
                                        key={dungeon.id}
                                        className="border-b border-border last:border-b-0"
                                    >
                                        <Link
                                            href={buildVisitorsHubHref({
                                                vue: "succes",
                                                donjon: key,
                                                q: search,
                                            })}
                                            aria-current={active ? "true" : undefined}
                                            className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                                                active
                                                    ? "bg-elevated text-foreground"
                                                    : "text-muted-foreground hover:bg-surface hover:text-foreground"
                                            }`}
                                        >
                                            {thumb ? (
                                                <GameIcon src={thumb} className="size-6 shrink-0" />
                                            ) : (
                                                <Trophy
                                                    className="size-4 shrink-0"
                                                    aria-hidden="true"
                                                />
                                            )}
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate font-medium">
                                                    {dungeon.name}
                                                </span>
                                                <span className="block truncate text-[11px]">
                                                    {dungeon.bossName}
                                                </span>
                                            </span>
                                            <span className="reg-mono shrink-0 text-[11px]">
                                                {dungeon.level}
                                            </span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </aside>

            <section className="min-w-0">
                {!selected ? (
                    <div className="reg-callout reg-callout-accent">
                        <div>
                            <h2 className="text-base font-semibold text-foreground">
                                {labels.hub.chooseTitle}
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {labels.hub.chooseDesc}
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
                            <div className="min-w-0">
                                <h2 className="text-lg font-semibold text-foreground">
                                    {selected.dungeon.name}
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {selected.dungeon.bossName} · {labels.hub.metricLevel}{" "}
                                    {selected.dungeon.level}
                                </p>
                            </div>
                            <p className="reg-mono text-xs text-muted-foreground">
                                {selected.board.rows.length} {labels.hub.successCount} ·{" "}
                                {selected.board.visitorCount} {labels.hub.visitorsCount}
                            </p>
                        </header>

                        {selected.board.capped ? (
                            <p className="mt-3 text-xs text-muted-foreground">
                                {labels.hub.capped.replace(
                                    "{n}",
                                    String(SHARED_SUCCES_VISITORS_TAKE)
                                )}
                            </p>
                        ) : null}

                        <div className="mt-4 space-y-3">
                            {selected.board.rows.length === 0 ? (
                                <div className="reg-callout">
                                    <p className="text-sm text-muted-foreground">
                                        {labels.hub.noAchievements}
                                    </p>
                                </div>
                            ) : (
                                selected.board.rows.map((row) => (
                                    <AchievementRow
                                        key={row.achievement.id}
                                        row={row}
                                        labels={labels}
                                    />
                                ))
                            )}
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}
