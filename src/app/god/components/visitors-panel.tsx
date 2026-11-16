/**
 * God — **Visiteurs** (V3) : liste et réinitialisation de visibilité.
 *
 * Décision du 16/11/2026 : la partie guildes du God est refondue, et les visiteurs
 * y entrent comme une **sous-vue** de `Guildes & Users` (pas de nouvel onglet).
 *
 * Rendu **côté serveur** : recherche et pagination passent par l'URL — pas d'état
 * client, pas de bundle ajouté, une page partageable. Seule écriture : la
 * **réinitialisation** des trois consentements (réversible, journalisée). Aucune
 * suppression ni bannissement dans ce lot.
 */

import Image from "next/image";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Check, ExternalLink, Minus, Search, Users } from "lucide-react";
import { formatDofusLevel } from "@/lib/dofus-level";
import { ALL_DOFUS_SERVER_ENTRIES } from "@/lib/presentation-constants";
import type { GodVisitorsQuery } from "@/lib/god-visitors";
import type { GodVisitorsResult, GodVisitorDetail } from "@/server/god-visitors";
import { GodCard, GodCardBody, GodCardHeader } from "@/app/god/ui/god-card";
import { GodEmptyState } from "@/app/god/ui/god-empty-state";
import { GodSectionHeader } from "@/app/god/ui/god-section-header";
import { GodPaginationLinks } from "@/app/god/ui/god-pagination-links";
import { VisitorVisibilityReset, VisitorDestructiveActions } from "./visitor-visibility-reset";

function ConsentMark({ granted, label }: { granted: boolean; label: string }) {
    return (
        <span
            className={
                granted
                    ? "inline-flex items-center gap-1 text-xs font-medium text-success"
                    : "inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"
            }
            title={`${label} : ${granted ? "oui" : "non"}`}
            aria-label={`${label} : ${granted ? "oui" : "non"}`}
        >
            {granted ? (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
                <Minus className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span aria-hidden="true">{label}</span>
        </span>
    );
}

export function VisitorsPanel({
    result,
    detail,
    query,
    godRoute,
}: {
    result: GodVisitorsResult;
    detail: GodVisitorDetail | null;
    query: GodVisitorsQuery;
    godRoute: string;
}) {
    if (!result.ok) {
        return (
            <GodEmptyState
                icon={Users}
                title="Accès refusé"
                description="La liste des visiteurs est réservée aux super-admins."
            />
        );
    }

    const baseParams = new URLSearchParams({ tab: "guilds", vue: "visiteurs" });
    if (query.q) baseParams.set("q", query.q);
    if (query.consent !== "all") baseParams.set("consent", query.consent);
    if (query.serverId) baseParams.set("serverId", String(query.serverId));

    const hrefForPage = (page: number) => {
        const params = new URLSearchParams(baseParams);
        params.set("page", String(page));
        return `${godRoute}?${params.toString()}`;
    };

    const hrefForVisitor = (profileId: string) => {
        const params = new URLSearchParams(baseParams);
        params.set("visiteur", profileId);
        return `${godRoute}?${params.toString()}`;
    };

    const hrefForClose = `${godRoute}?${baseParams.toString()}`;

    return (
        <section className="space-y-5">
            <GodSectionHeader
                title="Visiteurs"
                description="Comptes Discord sans guilde. Le consentement appartient au visiteur : la réinitialisation est réversible et journalisée."
                badge={`${result.total}`}
            />

            {detail ? (
                <GodCard>
                    <GodCardHeader
                        title={`Fiche — ${detail.pseudo ?? "profil incomplet"}`}
                        description={`${detail.serverName} · ${detail.classe ?? "classe inconnue"} · ${formatDofusLevel(detail.level)}`}
                        actions={
                            <Link href={hrefForClose} className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                                Fermer
                            </Link>
                        }
                    />
                    <GodCardBody className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-1 text-sm text-foreground">
                                <p className="flex flex-wrap items-center gap-2">
                                    <span className="text-muted-foreground">Discord :</span>
                                    {detail.discord ? (
                                        <>
                                            <span>{detail.discord.name ?? "sans nom"}</span>
                                            <a
                                                href={`https://discord.com/users/${detail.discord.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
                                            >
                                                {detail.discord.id}
                                                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                            </a>
                                        </>
                                    ) : (
                                        <span className="text-muted-foreground">non lié</span>
                                    )}
                                </p>
                                <p>
                                    <span className="text-muted-foreground">Inscrit :</span>{" "}
                                    {detail.createdAt.toLocaleDateString("fr-FR")}
                                </p>
                                <p>
                                    <span className="text-muted-foreground">Dernière activité :</span>{" "}
                                    {detail.updatedAt.toLocaleDateString("fr-FR")}
                                </p>
                                <p>
                                    <span className="text-muted-foreground">Contenu :</span>{" "}
                                    {detail.successPoints ?? 0} pts · {detail.achievements} succès · {detail.jobs} métiers
                                </p>
                            </div>
                            <div className="space-y-2 text-sm text-foreground">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <span className="text-muted-foreground">Consentements :</span>
                                    <ConsentMark granted={detail.showOnDirectory} label="Annuaire" />
                                    <ConsentMark granted={detail.showPresence} label="Présence" />
                                    <ConsentMark granted={detail.showRushProgress} label="Rush" />
                                </div>
                                <p>
                                    <span className="text-muted-foreground">Guildes :</span>{" "}
                                    {detail.guilds.length > 0
                                        ? detail.guilds.map((g) => `${g.name} (${g.status})`).join(", ")
                                        : "aucune"}
                                </p>
                                {detail.ownsGuild ? (
                                    <p className="text-xs text-warning">
                                        Ce compte possède une guilde — transfert de propriété requis avant suppression.
                                    </p>
                                ) : null}
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                            <VisitorVisibilityReset profileId={detail.id} pseudo={detail.pseudo} />
                            <VisitorDestructiveActions
                                profileId={detail.id}
                                pseudo={detail.pseudo}
                                discordId={detail.discord?.id ?? null}
                                ownsGuild={detail.ownsGuild}
                            />
                        </div>
                    </GodCardBody>
                </GodCard>
            ) : null}

            <GodCard>
                <GodCardBody>
                    <form method="get" action={godRoute} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <input type="hidden" name="tab" value="guilds" />
                        <input type="hidden" name="vue" value="visiteurs" />

                        <label className="flex flex-1 flex-col gap-1">
                            <span className="text-xs font-medium text-muted-foreground">Recherche</span>
                            <input
                                type="search"
                                name="q"
                                defaultValue={query.q}
                                maxLength={40}
                                placeholder="Pseudo Dofus ou guilde déclarée"
                                className="h-9 w-full rounded-lg border border-border bg-elevated px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-border-strong focus:outline-none"
                            />
                        </label>

                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-muted-foreground">Annuaire</span>
                            <select
                                name="consent"
                                defaultValue={query.consent}
                                className="h-9 rounded-lg border border-border bg-elevated px-2 text-sm text-foreground focus:border-border-strong focus:outline-none"
                            >
                                <option value="all">Tous</option>
                                <option value="listed">Visibles</option>
                                <option value="hidden">Masqués</option>
                            </select>
                        </label>

                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-muted-foreground">Serveur</span>
                            <select
                                name="serverId"
                                defaultValue={query.serverId ? String(query.serverId) : ""}
                                className="h-9 rounded-lg border border-border bg-elevated px-2 text-sm text-foreground focus:border-border-strong focus:outline-none"
                            >
                                <option value="">Tous</option>
                                {ALL_DOFUS_SERVER_ENTRIES.map((server) => (
                                    <option key={server.id} value={server.id}>
                                        {server.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <button
                            type="submit"
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-elevated px-3 text-sm font-medium text-foreground transition-colors hover:border-border-strong"
                        >
                            <Search className="h-4 w-4" aria-hidden="true" />
                            Rechercher
                        </button>
                    </form>
                </GodCardBody>
            </GodCard>


            <GodCard>
                <GodCardHeader
                    title="Profils visiteurs"
                    description="Pseudo, serveur, progression déclarée et consentements."
                />
                <GodCardBody className="p-0">
                    {result.rows.length === 0 ? (
                        <div className="p-6">
                            <GodEmptyState
                                icon={Users}
                                title="Aucun visiteur"
                                description="Aucun profil ne correspond à ce filtre."
                            />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[860px] text-left text-sm">
                                <thead>
                                    <tr className="border-b border-border text-xs text-muted-foreground">
                                        <th scope="col" className="px-5 py-3 font-medium">Visiteur</th>
                                        <th scope="col" className="px-3 py-3 font-medium">Serveur</th>
                                        <th scope="col" className="px-3 py-3 font-medium">Personnage</th>
                                        <th scope="col" className="px-3 py-3 font-medium">Contenu</th>
                                        <th scope="col" className="px-3 py-3 font-medium">Consentements</th>
                                        <th scope="col" className="px-5 py-3 font-medium">Dernière activité</th>
                                        <th scope="col" className="px-5 py-3 text-right font-medium">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.rows.map((row) => (
                                        <tr key={row.id} className="border-b border-border/60 last:border-0">
                                            <td className="px-5 py-3">
                                                <Link
                                                    href={hrefForVisitor(row.id)}
                                                    className="font-medium text-foreground transition-colors hover:text-accent"
                                                >
                                                    {row.pseudo ?? (
                                                        <span className="text-muted-foreground">Profil incomplet</span>
                                                    )}
                                                </Link>
                                                <div className="text-xs text-muted-foreground">
                                                    Inscrit {formatDistanceToNow(row.createdAt, { addSuffix: true, locale: fr })}
                                                </div>
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="flex items-center gap-2">
                                                    {row.serverIcon ? (
                                                        <Image
                                                            src={row.serverIcon}
                                                            alt=""
                                                            width={16}
                                                            height={16}
                                                            className="h-4 w-4 shrink-0"
                                                        />
                                                    ) : null}
                                                    <span className="text-foreground">{row.serverName}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="text-foreground">
                                                    {row.classe ?? "—"} · {formatDofusLevel(row.level)}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {row.successPoints ?? 0} pts · {row.achievements} succès · {row.jobs} métiers
                                                </div>
                                            </td>

                                            <td className="px-3 py-3 text-xs text-muted-foreground">
                                                {row.lastLadderSync
                                                    ? `Ladder ${formatDistanceToNow(row.lastLadderSync, { addSuffix: true, locale: fr })}`
                                                    : "Jamais synchronisé"}
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                    <ConsentMark granted={row.showOnDirectory} label="Annuaire" />
                                                    <ConsentMark granted={row.showPresence} label="Présence" />
                                                    <ConsentMark granted={row.showRushProgress} label="Rush" />
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 text-xs text-muted-foreground">
                                                {formatDistanceToNow(row.updatedAt, { addSuffix: true, locale: fr })}
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                {row.showOnDirectory || row.showPresence || row.showRushProgress ? (
                                                    <VisitorVisibilityReset profileId={row.id} pseudo={row.pseudo} />
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">Déjà masqué</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </GodCardBody>
            </GodCard>

            <GodPaginationLinks
                page={result.page}
                totalPages={result.totalPages}
                total={result.total}
                hrefForPage={hrefForPage}
                label="profil"
                className="justify-end"
            />
        </section>
    );
}

