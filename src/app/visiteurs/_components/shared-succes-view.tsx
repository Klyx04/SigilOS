import Link from "next/link";
import { Trophy } from "lucide-react";
import { GameIcon } from "@/components/shared/game-icon";
import { MonsterImage } from "@/components/succes/BountyFicheView";
import { Input } from "@/components/ui/input";
import { getClass } from "@/lib/dofus-assets";
import { visitorProfileHref } from "@/lib/public-directory";
import { displayAchievementDescription } from "@/lib/challenge-description";
import { cn } from "@/lib/utils";
import {
    SHARED_SUCCES_MEMBERS_SHOWN,
    SHARED_SUCCES_VISITORS_TAKE,
    buildVisitorsHubHref,
    type SharedSuccesMember,
    type SharedSuccesRow,
    type VisitorsHubSuccesList,
} from "@/lib/visitors-hub";
import type {
    SharedSuccesBounty,
    SharedSuccesBountyBoard,
    SharedSuccesDungeon,
    SharedSuccesDungeonBoard,
} from "@/server/public-succes-communs";
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
                                    href={visitorProfileHref(member)}
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
 * Un **filtre d'URL** (`?liste=avis`) bascule la MÊME zone maître-détail entre les donjons
 * et les avis : une seule liste et un seul détail à l'écran, jamais les avis empilés sous
 * les donjons. La sélection vit dans l'URL (`?donjon=…` / `?avis=…`), donc le retour
 * arrière et le partage fonctionnent. La liste est bornée par `SUCCES_DUNGEONS_TAKE` ;
 * les colonnes par `SHARED_SUCCES_MEMBERS_SHOWN` (le reste est compté, jamais inventé).
 */
export function SharedSuccesView({
    dungeons,
    selected,
    bounties,
    selectedBounty,
    liste,
    search,
    labels,
}: {
    dungeons: SharedSuccesDungeon[];
    selected: SharedSuccesDungeonBoard | null;
    bounties: SharedSuccesBounty[];
    selectedBounty: SharedSuccesBountyBoard | null;
    liste: VisitorsHubSuccesList;
    search: string;
    labels: Translations["visitorsPage"];
}) {
    return (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            <aside className="min-w-0">
                <nav
                    aria-label={labels.hub.typeFilterLabel}
                    className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface/40 p-1"
                >
                    {[
                        {
                            id: "donjons" as const,
                            label: labels.hub.dungeons,
                            count: dungeons.length,
                            href: buildVisitorsHubHref({
                                vue: "succes",
                                donjon: selected?.dungeon.slug ?? selected?.dungeon.id ?? null,
                                q: search,
                            }),
                            icon: "/assets/dofus/game-icons/trophy-1.png",
                        },
                        {
                            id: "avis" as const,
                            label: labels.hub.bountyTitle,
                            count: bounties.length,
                            href: buildVisitorsHubHref({
                                vue: "succes",
                                bounty:
                                    selectedBounty?.bounty.slug ??
                                    selectedBounty?.bounty.id ??
                                    null,
                                liste: "avis",
                                q: search,
                            }),
                            icon: "/assets/avis/avitons.png",
                        },
                    ].map((item) => {
                        const active = liste === item.id;
                        return (
                            <Link
                                key={item.id}
                                href={item.href}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                    "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    active
                                        ? "bg-elevated font-semibold text-foreground"
                                        : "text-muted-foreground hover:bg-surface hover:text-foreground"
                                )}
                            >
                                <GameIcon src={item.icon} className="size-4" />
                                {item.label}
                                <span className="reg-mono text-[11px] text-muted-foreground">
                                    {item.count}
                                </span>
                            </Link>
                        );
                    })}
                </nav>
                <form method="get" action="/visiteurs" className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input type="hidden" name="vue" value="succes" />
                    {liste === "avis" ? <input type="hidden" name="liste" value="avis" /> : null}
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
                        href={buildVisitorsHubHref({ vue: "succes", liste })}
                        className="reg-link-quiet mt-2 inline-block text-xs"
                    >
                        {labels.hub.resetSearch}
                    </Link>
                ) : null}

                {liste === "donjons" ? (
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
                ) : (
                    <div className="mt-3 space-y-2">
                        <p className="text-xs text-muted-foreground">{labels.hub.bountyDesc}</p>
                        <div className="reg-panel max-h-[32rem] overflow-y-auto">
                            {bounties.length === 0 ? (
                                <p className="p-3 text-sm text-muted-foreground">
                                    {labels.hub.noBounties}
                                </p>
                            ) : (
                                <ul>
                                    {bounties.map((bounty) => {
                                        const active = selectedBounty?.bounty.id === bounty.id;
                                        const key = bounty.slug ?? bounty.id;
                                        return (
                                            <li
                                                key={bounty.id}
                                                className="border-b border-border last:border-b-0"
                                            >
                                                <Link
                                                    href={buildVisitorsHubHref({
                                                        vue: "succes",
                                                        bounty: key,
                                                        liste: "avis",
                                                        q: search,
                                                    })}
                                                    aria-current={active ? "true" : undefined}
                                                    className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                                                        active
                                                            ? "bg-elevated text-foreground"
                                                            : "text-muted-foreground hover:bg-elevated hover:text-foreground"
                                                    }`}
                                                >
                                                    <MonsterImage
                                                        src={bounty.imageUrl}
                                                        className="size-6 shrink-0 rounded object-contain"
                                                    />
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate font-medium">
                                                            {bounty.name}
                                                        </span>
                                                        <span className="block truncate text-[11px]">
                                                            {bounty.zoneName ?? "—"}
                                                        </span>
                                                    </span>
                                                    <span className="reg-mono shrink-0 text-[11px]">
                                                        {bounty.level}
                                                    </span>
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>
                )}
            </aside>

            <section className="min-w-0">
                {liste === "donjons" ? (
                    !selected ? (
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
                    )
                ) : !selectedBounty ? (
                    <div className="reg-callout reg-callout-accent">
                        <div>
                            <h2 className="text-base font-semibold text-foreground">
                                {labels.hub.bountyTitle}
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {labels.hub.chooseBountyDesc}
                            </p>
                        </div>
                    </div>
                ) : (
                    <article className="reg-panel p-4">
                        <header className="flex items-start gap-3">
                            <MonsterImage
                                src={selectedBounty.bounty.imageUrl}
                                className="size-12 shrink-0 rounded-lg object-contain"
                            />
                            <div className="min-w-0">
                                <h3 className="truncate text-base font-semibold text-foreground">
                                    {selectedBounty.bounty.name}
                                </h3>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    LVL {selectedBounty.bounty.level}
                                    {selectedBounty.bounty.zoneName
                                        ? ` · ${selectedBounty.bounty.zoneName}`
                                        : ""}
                                </p>
                                {selectedBounty.bounty.slug ? (
                                    <Link
                                        href={`/boss/${selectedBounty.bounty.slug}`}
                                        className="reg-link mt-1 inline-block text-xs"
                                    >
                                        {labels.hub.bountySheet}
                                    </Link>
                                ) : null}
                            </div>
                        </header>

                        <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
                            <MemberColumn
                                title={labels.hub.doneBy}
                                members={selectedBounty.board.done}
                                empty={labels.hub.noneDone}
                                labels={labels}
                            />
                            <MemberColumn
                                title={labels.hub.lookingFor}
                                members={selectedBounty.board.missing}
                                empty={labels.hub.noneLooking}
                                labels={labels}
                            />
                        </div>

                        {selectedBounty.board.capped ? (
                            <p className="mt-2 text-[11px] text-muted-foreground">
                                {labels.hub.capped.replace(
                                    "{n}",
                                    String(SHARED_SUCCES_VISITORS_TAKE)
                                )}
                            </p>
                        ) : null}
                    </article>
                )}
            </section>
        </div>
    );
}
