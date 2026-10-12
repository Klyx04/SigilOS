"use client";

import { CalendarClock, TrendingDown } from "lucide-react";
import { getProductStats } from "@/server/actions/telemetry-product-actions";
import { TelemetrySampleNote } from "@/components/telemetry/telemetry-sample-note";

/**
 * Onglet « Rétention & guildes à relancer » (D-2bis, itération 5).
 *
 * Remplace trois onglets « console » : la heatmap 7 j × 24 h de clics, le classement des
 * « membres les plus actifs » (artefact d'échantillon) et la « Santé des Guildes » à score
 * inventé.
 *
 * Ce que la rétention peut dire honnêtement : pour chaque **semaine d'entrée** (première semaine
 * d'activité d'une guilde dans la fenêtre), combien de ces guildes reviennent semaine après
 * semaine. Un taux n'est publié que si la cohorte compte au moins `minCohortSize` guildes :
 * en dessous, l'écran affiche le **compte brut**, jamais un pourcentage calculé sur une guilde.
 */

type ProductStatsType = Awaited<ReturnType<typeof getProductStats>>;

const STATUS_STYLES: Record<string, string> = {
    ACTIVE: "bg-accent-soft text-accent border-accent/20",
    SLOWING: "bg-warning/10 text-warning border-warning/20",
    DORMANT: "bg-danger/10 text-danger border-danger/20",
};

const STATUS_LABELS: Record<string, string> = {
    ACTIVE: "Active",
    SLOWING: "Ralentit",
    DORMANT: "Endormie",
};

export function TelemetryRetentionPanel({ product }: { product: ProductStatsType | null }) {
    if (!product) {
        return (
            <section className="p-6 rounded-2xl border border-border bg-surface">
                <h3 className="text-sm font-bold text-foreground">Mesures produit indisponibles</h3>
                <p className="text-xs text-muted-foreground mt-1">
                    La lecture des mesures produit a échoué : aucun taux de rétention n&apos;est affiché plutôt
                    qu&apos;un taux faux.
                </p>
            </section>
        );
    }

    const { retention, freshness, minCohortSize, sample, truncated, windowDays } = product;
    const offsets = Array.from(
        new Set(retention.flatMap((cohort) => cohort.points.map((point) => point.weekOffset)))
    ).sort((a, b) => a - b);
    const publishableCohorts = retention.filter((cohort) => cohort.size >= minCohortSize);
    const toRelance = freshness.guilds.filter((guild) => guild.status !== "ACTIVE");
    const thresholdNote = freshness.thresholds.derived
        ? `Seuil de relance : ${freshness.thresholds.warningDays} jours, dérivé de la distribution observée (3e quartile de ${freshness.thresholds.sampleSize} guilde(s) mesurée(s)).`
        : `Seuil de relance : ${freshness.thresholds.warningDays} jours (plancher documenté) — ${freshness.thresholds.sampleSize} guilde(s) mesurée(s) seulement, trop peu pour un centile.`;

    return (
        <section className="p-6 rounded-2xl border border-border bg-surface space-y-6">
            <header className="space-y-1">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-accent" />
                    Rétention par cohorte de guilde
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                    Une cohorte = les guildes dont la <strong>première</strong> semaine d&apos;activité dans la
                    fenêtre est celle indiquée. Chaque cellule dit combien de ces guildes ont agi la semaine
                    suivante. Aucune donnée n&apos;est extrapolée : une semaine hors fenêtre n&apos;apparaît pas.
                </p>
            </header>

            {retention.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                    Aucune guilde n&apos;a d&apos;activité sur la fenêtre lue : il n&apos;y a pas de cohorte à suivre.
                </p>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <table className="min-w-[560px] w-full text-xs border-collapse">
                            <thead>
                                <tr className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                    <th className="text-left py-2 pr-4">Cohorte</th>
                                    <th className="text-left py-2 pr-4">Guildes</th>
                                    {offsets.map((offset) => (
                                        <th key={offset} className="text-center py-2 px-3">
                                            +{offset} sem.
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {retention.map((cohort) => (
                                    <tr key={cohort.cohortWeek} className="border-t border-border/60">
                                        <td className="py-2 pr-4 font-semibold text-foreground tabular-nums">
                                            {cohort.cohortWeek}
                                        </td>
                                        <td className="py-2 pr-4 tabular-nums text-muted-foreground">
                                            {cohort.size}
                                            {cohort.size < minCohortSize && (
                                                <span className="ml-2 text-[10px] uppercase tracking-widest text-warning">
                                                    taux non publié
                                                </span>
                                            )}
                                        </td>
                                        {offsets.map((offset) => {
                                            const point = cohort.points.find((entry) => entry.weekOffset === offset);
                                            return (
                                                <td
                                                    key={offset}
                                                    className="py-2 px-3 text-center tabular-nums text-muted-foreground"
                                                >
                                                    {!point
                                                        ? "—"
                                                        : point.rate === null
                                                            ? `${point.retained} / ${cohort.size}`
                                                            : `${point.rate} %`}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {publishableCohorts.length === 0 && (
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                            Aucun taux n&apos;est publiable pour l&apos;instant : toutes les cohortes comptent moins
                            de {minCohortSize} guildes. Les cellules affichent donc le compte brut
                            (« revenus / total »), qui reste un fait mesuré.
                        </p>
                    )}
                </>
            )}

            <div className="pt-4 border-t border-border/60 space-y-3">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                    <TrendingDown className="w-3.5 h-3.5 text-warning" />
                    Guildes à relancer ({toRelance.length} sur {freshness.guilds.length})
                </h4>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{thresholdNote}</p>

                {toRelance.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                        Toutes les guildes ont agi dans la fenêtre du seuil.
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {toRelance.map((guild) => (
                            <li
                                key={guild.id}
                                className="p-3 rounded-xl border border-border bg-elevated/40 flex items-center justify-between gap-3"
                            >
                                <span className="text-xs font-semibold text-foreground truncate">{guild.name}</span>
                                <span className="flex items-center gap-2 shrink-0">
                                    <span className="text-[10px] text-muted-foreground tabular-nums">
                                        {guild.daysInactive === null
                                            ? "aucune action enregistrée"
                                            : `silence depuis ${guild.daysInactive} j`}
                                    </span>
                                    <span
                                        className={`text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                                            STATUS_STYLES[guild.status] ?? STATUS_STYLES.ACTIVE
                                        }`}
                                    >
                                        {STATUS_LABELS[guild.status] ?? guild.status}
                                    </span>
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <TelemetrySampleNote sample={sample} truncated={truncated} windowDays={windowDays} />
        </section>
    );
}
