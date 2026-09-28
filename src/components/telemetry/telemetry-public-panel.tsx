"use client";

import { Globe, ShieldCheck } from "lucide-react";
import { getPublicStats } from "@/server/actions/telemetry-public-actions";

/**
 * Onglet « Site public » (D-2bis, itération 6) : la partie **externe** du produit.
 *
 * Ce qui s'affiche est volontairement limité à ce qui est mesurable sans identité : des
 * **vues de pages publiques agrégées par jour**. Ni visiteurs uniques, ni sessions, ni
 * provenance — l'écran le dit, plutôt que de laisser croire à une analytics de navigateur.
 */

type PublicStatsType = Awaited<ReturnType<typeof getPublicStats>>;

export function TelemetryPublicPanel({ stats }: { stats: PublicStatsType | null }) {
    if (!stats) {
        return (
            <section className="p-6 rounded-2xl border border-border bg-surface">
                <h3 className="text-sm font-bold text-foreground">Mesures du site public indisponibles</h3>
                <p className="text-xs text-muted-foreground mt-1">
                    La lecture des compteurs publics a échoué : aucun chiffre n&apos;est affiché plutôt
                    qu&apos;un chiffre faux.
                </p>
            </section>
        );
    }

    const published = stats.screens.filter((screen) => screen.published);
    const maxViews = Math.max(1, ...published.map((screen) => screen.views30));

    return (
        <section className="p-6 rounded-2xl border border-border bg-surface space-y-5">
            <header className="space-y-1">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Globe className="w-4 h-4 text-accent" />
                    Site public — vues par écran
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                    {stats.trackedScreens} écrans publics sont suivis, agrégés par jour. Le comptage est déclenché
                    par le navigateur : il mesure des <strong>requêtes</strong>, pas des personnes.
                </p>
            </header>

            {!stats.available ? (
                <p className="text-xs text-warning">
                    Compteurs indisponibles (Redis injoignable) : les zéros affichés ailleurs seraient trompeurs,
                    donc la mesure n&apos;est pas publiée.
                </p>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-4 rounded-xl border border-border bg-surface/60">
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                Vues déclarées (7 jours)
                            </span>
                            <p className="text-2xl font-bold text-foreground tabular-nums mt-1">
                                {stats.totals.views7.toLocaleString()}
                            </p>
                        </div>
                        <div className="p-4 rounded-xl border border-border bg-surface/60">
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                Vues déclarées ({stats.days} jours)
                            </span>
                            <p className="text-2xl font-bold text-foreground tabular-nums mt-1">
                                {stats.totals.views30.toLocaleString()}
                            </p>
                        </div>
                    </div>

                    {published.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                            Aucun écran n&apos;atteint le seuil de {stats.minViewsToPublish} vues
                            {stats.withheld.views > 0
                                ? ` (${stats.withheld.views} vue(s) sur ${stats.withheld.screens} écran(s) sous le seuil).`
                                : " : les compteurs viennent d'être posés."}
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {published.map((screen) => (
                                <li
                                    key={screen.key}
                                    className="p-3 rounded-xl border border-border bg-elevated/40 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] gap-2 md:items-center"
                                >
                                    <span className="text-xs font-semibold text-foreground truncate">
                                        {screen.label}
                                    </span>
                                    <div className="flex items-center gap-3">
                                        <div className="h-2 flex-1 rounded-full bg-surface overflow-hidden">
                                            <div
                                                className="h-full bg-accent"
                                                style={{ width: `${Math.round((screen.views30 / maxViews) * 100)}%` }}
                                            />
                                        </div>
                                        <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
                                            {screen.views7.toLocaleString()} (7 j)
                                        </span>
                                    </div>
                                    <span className="text-[10px] font-semibold tabular-nums text-foreground text-right">
                                        {screen.views30.toLocaleString()} vues
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}

                    {stats.withheld.screens > 0 && published.length > 0 && (
                        <p className="text-[10px] text-muted-foreground">
                            + {stats.withheld.screens} écran(s) sous le seuil de {stats.minViewsToPublish} vues
                            ({stats.withheld.views.toLocaleString()} vue(s) au total) : regroupés plutôt que listés.
                        </p>
                    )}
                </>
            )}

            <div className="pt-4 border-t border-border/60 space-y-2">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                    Ce que ce compteur ne fait pas
                </h4>
                <ul className="text-[10px] text-muted-foreground leading-relaxed list-disc pl-4 space-y-1">
                    <li>
                        Aucun cookie, aucun identifiant, aucune adresse conservée : impossible de dire
                        « visiteurs uniques », « sessions » ou « provenance ».
                    </li>
                    <li>
                        Le user-agent est <strong>lu</strong> pour écarter les robots puis <strong>jeté</strong> :
                        il n&apos;est jamais stocké.
                    </li>
                    <li>
                        Ces compteurs ne sont <strong>jamais</strong> joints à la télémétrie identifiée du tableau
                        de bord : deux mondes séparés.
                    </li>
                    <li>Compteurs conservés {stats.ttlDays} jours au maximum, par jour et par écran.</li>
                </ul>
            </div>
        </section>
    );
}
