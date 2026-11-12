import Link from "next/link";
import { GameIcon } from "@/components/shared/game-icon";
import { getClass } from "@/lib/dofus-assets";
import { metamobProfileUrl } from "@/lib/ocre-soul-stones";
import { visitorProfileHref } from "@/lib/public-directory";
import {
    TRADE_MATCHES_LIMIT,
    TRADE_PARTNERS_SHOWN,
    type TradeMonster,
    type TradeMonsterType,
    type TradePartner,
} from "@/lib/public-trades";
import { buildVisitorsHubHref, type VisitorsHubTradeType } from "@/lib/visitors-hub";
import { cn } from "@/lib/utils";
import type { VisitorTrades } from "@/server/public-trades";
import type { Translations } from "@/lib/i18n/locales/fr";

type Labels = Translations["visitorsPage"];
type LinkTarget = { href: string; label: string };

/** Remplace les jetons `{nom}` d'un libellé i18n (jamais de HTML). */
function replace(template: string, values: Record<string, string>): string {
    return Object.entries(values).reduce(
        (text, [key, value]) => text.replace(`{${key}}`, value),
        template
    );
}

/** Lien interne (`Link`) ou externe (`a`, nouvel onglet) selon la cible. */
function Cta({ target, className }: { target: LinkTarget; className: string }) {
    if (target.href.startsWith("http")) {
        return (
            <a
                href={target.href}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
            >
                {target.label}
            </a>
        );
    }
    return (
        <Link href={target.href} className={className}>
            {target.label}
        </Link>
    );
}

function metamobLink(pseudo: string | null, label: string): LinkTarget | undefined {
    const href = metamobProfileUrl(pseudo);
    return href ? { href, label } : undefined;
}

function InfoPanel({
    title,
    text,
    cta,
    secondary,
}: {
    title: string;
    text: string;
    cta?: LinkTarget;
    secondary?: LinkTarget;
}) {
    return (
        <section className="reg-panel mt-6 p-4 sm:p-5" aria-label={title}>
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <p className="mt-1 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
                {text}
            </p>
            {cta ? <Cta target={cta} className="reg-btn reg-btn-secondary mt-3" /> : null}
            {secondary ? (
                <Cta target={secondary} className="reg-link mt-3 block text-sm" />
            ) : null}
        </section>
    );
}

/** Chargement du panneau : même hauteur que la carte, aucun décalage quand Metamob répond. */
export function VisitorTradesFallback({ labels }: { labels: Labels }) {
    return (
        <div className="reg-panel mt-6 p-4 sm:p-5" role="status" aria-live="polite">
            <p className="reg-eyebrow">{labels.hub.trades.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{labels.hub.trades.loading}</p>
            <div className="mt-4 h-24 animate-pulse rounded-md bg-elevated" />
            <span className="sr-only">{labels.hub.trades.loading}</span>
        </div>
    );
}

const MONSTER_TYPE_ORDER: Array<{
    id: TradeMonsterType;
    labelKey: "boss" | "archis" | "monster";
}> = [
    { id: "boss", labelKey: "boss" },
    { id: "archimonstre", labelKey: "archis" },
    { id: "monstre", labelKey: "monster" },
];

/** Icône de monstre : image interne (proxy) avec repli sur l'asset bestiaire. */
function MonsterIcon({ src, name }: { src: string | null; name: string }) {
    return (
        <span
            className="flex size-6 shrink-0 items-center justify-center rounded border border-border bg-background p-0.5"
            title={name}
        >
            <GameIcon src={src ?? "/assets/dofus/modules/bestiary.png"} className="size-4" />
        </span>
    );
}

/** Une colonne de monstres : rangée par Boss / Archimonstres / Monstres, avec icônes. */
function MonsterColumn({
    title,
    monsters,
    more,
    moreByType,
    empty,
    type,
    labels,
}: {
    title: string;
    monsters: TradeMonster[];
    more: number;
    moreByType: Record<TradeMonsterType, number>;
    empty: string;
    type: VisitorsHubTradeType | null;
    labels: Labels;
}) {
    const groups = MONSTER_TYPE_ORDER.filter((group) => (type ? group.id === type : true))
        .map((group) => ({
            ...group,
            items: monsters.filter((monster) => monster.type === group.id),
        }))
        .filter((group) => group.items.length > 0);
    const remaining = type ? moreByType[type] : more;

    return (
        <div className="min-w-0">
            <p className="reg-eyebrow">{title}</p>
            {groups.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">{empty}</p>
            ) : (
                <div className="mt-1 space-y-2">
                    {groups.map((group) => (
                        <div key={group.id}>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {labels.hub.trades[group.labelKey]}
                            </p>
                            <ul className="mt-0.5 space-y-0.5">
                                {group.items.map((monster) => (
                                    <li
                                        key={monster.id}
                                        className="flex min-w-0 items-center gap-1.5 text-sm"
                                    >
                                        <MonsterIcon src={monster.imageUrl} name={monster.name} />
                                        <span className="truncate text-foreground">
                                            {monster.name}
                                        </span>
                                        {monster.coversNeed ? (
                                            <span className="reg-tag shrink-0 text-success">
                                                {labels.hub.trades.covers}
                                            </span>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
            {remaining > 0 ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                    + {remaining} {labels.hub.others}
                </p>
            ) : null}
        </div>
    );
}

/**
 * Une carte partenaire. Le pseudo Metamob est affiché **ici seulement** : c'est le seul
 * moyen de contacter la personne pour l'échange (décision du 11/11/2026). La fiche SigilOS
 * reste la porte d'entrée pour le reste du profil public.
 */
function PartnerRow({
    partner,
    type,
    labels,
}: {
    partner: TradePartner;
    type: VisitorsHubTradeType | null;
    labels: Labels;
}) {
    const trades = labels.hub.trades;
    const classe = partner.classe ? getClass(partner.classe) : undefined;
    const contact = metamobProfileUrl(partner.metamobPseudo);
    const profileHref = visitorProfileHref({ id: partner.profileId, pseudo: partner.pseudo });

    return (
        <li className="reg-panel p-4">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    {classe ? (
                        <GameIcon src={classe.icon} className="size-8 shrink-0" />
                    ) : null}
                    <div className="min-w-0">
                        <Link
                            href={profileHref}
                            className="reg-link block max-w-full truncate text-sm font-semibold"
                        >
                            {partner.pseudo ?? labels.anonymous}
                        </Link>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                            {classe ? <span>{classe.name}</span> : null}
                            <span className="inline-flex min-w-0 items-center gap-1">
                                <GameIcon
                                    src="/assets/brands/metamob.png"
                                    className="size-4 shrink-0"
                                />
                                <span className="truncate">{partner.metamobPseudo}</span>
                            </span>
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {partner.reciprocal ? (
                        <span className="reg-tag text-success">{trades.reciprocal}</span>
                    ) : null}
                    <span className="reg-mono text-xs text-muted-foreground">
                        {trades.score} {partner.matchScore}
                    </span>
                </div>
            </header>

            <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
                <MonsterColumn
                    title={trades.theyHave}
                    monsters={partner.theyHave}
                    more={partner.theyHaveMore}
                    moreByType={partner.theyHaveMoreByType}
                    empty={trades.noneTheyHave}
                    type={type}
                    labels={labels}
                />
                <MonsterColumn
                    title={trades.youHave}
                    monsters={partner.youHave}
                    more={partner.youHaveMore}
                    moreByType={partner.youHaveMoreByType}
                    empty={trades.noneYouHave}
                    type={type}
                    labels={labels}
                />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
                <Link href={profileHref} className="reg-link text-sm">
                    {trades.seeProfile}
                </Link>
                {contact ? (
                    <a
                        href={contact}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="reg-btn reg-btn-secondary"
                    >
                        {trades.contact}
                    </a>
                ) : null}
            </div>
        </li>
    );
}

/**
 * Vue « Échanges Metamob » — **100 % serveur**, aucun état client.
 *
 * Les états sont explicites : pas de clé, clé refusée, Metamob indisponible, aucune quête,
 * puis le tableau. Un échec de Metamob n'est jamais une page cassée : c'est un panneau qui
 * dit quoi faire.
 */
export function VisitorTradesView({
    state,
    labels,
    type = null,
}: {
    state: VisitorTrades;
    labels: Labels;
    type?: VisitorsHubTradeType | null;
}) {
    const trades = labels.hub.trades;

    if (state.status === "no-metamob") {
        return (
            <InfoPanel
                title={trades.title}
                text={trades.noMetamob}
                cta={{ href: "/espace-visiteur/general", label: trades.linkCta }}
            />
        );
    }
    if (state.status === "unauthorized") {
        return (
            <InfoPanel
                title={trades.title}
                text={trades.unauthorized}
                cta={{ href: "/espace-visiteur/general", label: trades.checkKey }}
                secondary={metamobLink(state.viewerMetamobPseudo, trades.openMetamob)}
            />
        );
    }
    if (state.status === "unavailable") {
        return (
            <InfoPanel
                title={trades.title}
                text={trades.unavailable}
                cta={{ href: buildVisitorsHubHref({ vue: "echanges", type }), label: trades.retry }}
                secondary={metamobLink(state.viewerMetamobPseudo, trades.openMetamob)}
            />
        );
    }
    if (state.status === "no-quest") {
        return (
            <InfoPanel
                title={trades.title}
                text={trades.noQuest}
                cta={metamobLink(state.viewerMetamobPseudo, trades.openMetamob)}
            />
        );
    }

    const { board, quest } = state;
    const profileUrl = metamobProfileUrl(state.viewerMetamobPseudo);
    const visiblePartners = type
        ? board.partners.filter((partner) =>
              [...partner.theyHave, ...partner.youHave].some(
                  (monster) => monster.type === type
              )
          )
        : board.partners;
    const shownCount = type ? visiblePartners.length : board.partnersCount;
    const filters: Array<{
        id: VisitorsHubTradeType | null;
        label: string;
        href: string;
    }> = [
        { id: null, label: trades.all, href: buildVisitorsHubHref({ vue: "echanges" }) },
        {
            id: "boss",
            label: trades.boss,
            href: buildVisitorsHubHref({ vue: "echanges", type: "boss" }),
        },
        {
            id: "archimonstre",
            label: trades.archis,
            href: buildVisitorsHubHref({ vue: "echanges", type: "archimonstre" }),
        },
    ];

    return (
        <section className="mt-6 min-w-0" aria-label={trades.title}>
            <header className="border-b border-border pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                            <GameIcon
                                src="/assets/dofus/icons/archimonster.png"
                                className="size-5"
                            />
                            {trades.title}
                        </h2>
                        <p className="mt-1 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
                            {trades.desc}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="reg-mono text-[11px] text-muted-foreground">
                            {shownCount}{" "}
                            {shownCount === 1 ? trades.partnerOne : trades.partners} ·{" "}
                            {board.apiTotal} {trades.apiMatches}
                        </p>
                        {board.capped ? (
                            <p className="text-[11px] text-muted-foreground">
                                {replace(trades.capped, { n: String(TRADE_MATCHES_LIMIT) })}
                            </p>
                        ) : null}
                    </div>
                </div>

                <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>
                        {replace(trades.questLabel, {
                            name: quest.characterName,
                            step: String(quest.currentStep),
                        })}
                    </span>
                    {state.viewerMetamobPseudo ? (
                        <>
                            <span aria-hidden="true">·</span>
                            <span>
                                {replace(trades.linkedAs, {
                                    pseudo: state.viewerMetamobPseudo,
                                })}
                            </span>
                            {profileUrl ? (
                                <a
                                    href={profileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="reg-link"
                                >
                                    {trades.openMetamob}
                                </a>
                            ) : null}
                        </>
                    ) : null}
                </p>

                {state.hidden ? (
                    <p className="mt-2 text-xs text-warning">{trades.hidden}</p>
                ) : null}
                {state.serverMismatch ? (
                    <p className="mt-1 text-[11px] text-warning">
                        {replace(trades.serverMismatch, { server: quest.serverName || "?" })}
                    </p>
                ) : null}

                <nav
                    aria-label={trades.filterLabel}
                    className="mt-3 flex flex-wrap items-center gap-1"
                >
                    {filters.map((filter) => {
                        const active = type === filter.id || (filter.id === null && !type);
                        return (
                            <Link
                                key={filter.label}
                                href={filter.href}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                    "inline-flex h-8 items-center rounded-md border border-border px-2.5 text-xs text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    active &&
                                        "border-accent bg-elevated font-semibold text-foreground"
                                )}
                            >
                                {filter.label}
                            </Link>
                        );
                    })}
                </nav>
            </header>

            {board.apiMatches === 0 ? (
                <p className="reg-callout mt-4 text-sm text-muted-foreground">
                    {trades.noMatch}
                </p>
            ) : board.partners.length === 0 ? (
                <>
                    <p className="reg-callout mt-4 text-sm text-muted-foreground">
                        {trades.noPartner}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {trades.noPartnerHint}
                    </p>
                </>
            ) : visiblePartners.length === 0 ? (
                <p className="reg-callout mt-4 text-sm text-muted-foreground">
                    {trades.noType}
                </p>
            ) : (
                <ul className="mt-4 space-y-3">
                    {visiblePartners.map((partner) => (
                        <PartnerRow
                            key={partner.profileId}
                            partner={partner}
                            type={type}
                            labels={labels}
                        />
                    ))}
                </ul>
            )}

            {board.displayCapped ? (
                <p className="mt-3 text-xs text-muted-foreground">
                    {replace(trades.displayCapped, { n: String(TRADE_PARTNERS_SHOWN) })}
                </p>
            ) : null}
            <p className="mt-3 text-[11px] text-muted-foreground">{trades.privacyNote}</p>
        </section>
    );
}

