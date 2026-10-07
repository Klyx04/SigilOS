"use client";

import { Activity, BarChart3, Layers, TrendingDown, Users } from "lucide-react";
import { moduleLabel } from "@/lib/module-catalog";
import { getProductStats } from "@/server/actions/telemetry-product-actions";
import { TelemetrySampleNote } from "@/components/telemetry/telemetry-sample-note";

/**
 * Vue d'ensemble **produit** (D-2bis) — remplace les 8 cartes « console » du module God
 * (pages vues, interactions, DAU/WAU, engagement, événements totaux).
 *
 * Ce qui change de nature : ces cartes parlent du **produit** (guildes et membres réellement
 * actifs, adoption réelle des modules, guildes qui décrochent), pas de la navigation.
 *
 * Trois règles d'affichage appliquées ici :
 * 1. chaque chiffre porte son **dénominateur** (« sur N guildes connues ») ;
 * 2. l'**échantillon** est affiché (actions, membres distincts) et le classement nominatif
 *    n'est annoncé comme publiable que si `sample.reliable` ;
 * 3. les **seuils** utilisés sont nommés (« dérivés de la distribution observée » ou
 *    « plancher »), jamais présentés comme une évidence.
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

export function TelemetryProductOverview({ product }: { product: ProductStatsType | null }) {
    if (!product) {
        return (
            <div className="p-6 rounded-2xl border border-border bg-surface">
                <h3 className="text-sm font-bold text-foreground">Mesures produit indisponibles</h3>
                <p className="text-xs text-muted-foreground mt-1">
                    La lecture des mesures produit a échoué (base indisponible ou droits insuffisants).
                    Aucun chiffre n&apos;est affiché plutôt qu&apos;un chiffre faux : relancez la page.
                </p>
            </div>
        );
    }

    const { counts, sample, freshness, adoption, businessRows30, weekly, truncated, windowDays } = product;
    const toRelance = freshness.guilds.filter((guild) => guild.status !== "ACTIVE");
    const usedModules = adoption.modules.filter((module) => module.usedGuilds > 0);
    const idleModules = adoption.modules.filter((module) => module.idleGuilds > 0);
    const maxWeekly = Math.max(1, ...weekly.map((week) => Math.max(week.activeGuilds, week.activeMembers)));
    const thresholdNote = freshness.thresholds.derived
        ? `seuil dérivé de la distribution observée (3e quartile de ${freshness.thresholds.sampleSize} guilde(s) mesurée(s))`
        : `seuil plancher ${freshness.thresholds.warningDays} j — trop peu de guilde(s) mesurée(s) (${freshness.thresholds.sampleSize}) pour un centile`;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <OverviewCard
                    icon={<Activity className="w-5 h-5" />}
                    label="Guildes actives"
                    value={`${counts.guildsActive7} / ${counts.guildsActive30}`}
                    valueNote="7 j / 30 j"
                    detail={`sur ${counts.guildsTotal} guilde(s) connue(s) · ${counts.guildsNew30} créée(s) sur 30 j`}
                />
                <OverviewCard
                    icon={<Users className="w-5 h-5" />}
                    label="Membres actifs"
                    value={`${counts.membersActive7} / ${counts.membersActive30}`}
                    valueNote="7 j / 30 j"
                    detail={`sur ${counts.profilesTotal} profil(s) · ${counts.accountsTotal} compte(s) au total`}
                />
                <OverviewCard
                    icon={<Layers className="w-5 h-5" />}
                    label="Modules réellement utilisés"
                    value={`${usedModules.length} / ${adoption.probedModules}`}
                    valueNote="utilisés / mesurables"
                    detail={`${adoption.unmeasured.length} module(s) activé(s) sans mesure d'usage disponible`}
                />
                <OverviewCard
                    icon={<TrendingDown className="w-5 h-5" />}
                    label="Guildes à relancer"
                    value={String(toRelance.length)}
                    valueNote={`sur ${counts.guildsTotal}`}
                    detail={thresholdNote}
                />
            </div>

            <TelemetrySampleNote sample={sample} truncated={truncated} windowDays={windowDays} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <section className="lg:col-span-2 p-5 rounded-2xl border border-border bg-surface">
                    <header className="flex items-baseline justify-between gap-3">
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-accent" />
                            Activité réelle par semaine
                        </h3>
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                            {product.retentionWeeks} semaines · guildes et membres distincts
                        </span>
                    </header>

                    <div className="mt-4 flex items-end gap-2 h-28">
                        {weekly.map((week) => (
                            <div key={week.week} className="flex-1 flex flex-col items-center gap-1 h-full">
                                <div className="flex-1 w-full flex items-end justify-center gap-0.5">
                                    <div
                                        title={`${week.week} — ${week.activeGuilds} guilde(s) active(s)`}
                                        className="w-2.5 rounded-t bg-accent/70"
                                        style={{ height: `${Math.max(3, Math.round((week.activeGuilds / maxWeekly) * 100))}%` }}
                                    />
                                    <div
                                        title={`${week.week} — ${week.activeMembers} membre(s) actif(s)`}
                                        className="w-2.5 rounded-t bg-foreground/25"
                                        style={{ height: `${Math.max(3, Math.round((week.activeMembers / maxWeekly) * 100))}%` }}
                                    />
                                </div>
                                <span className="text-[9px] font-mono text-muted-foreground">{week.week.slice(-2)}</span>
                            </div>
                        ))}
                    </div>

                    <footer className="mt-3 flex items-center gap-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-sm bg-accent/70" /> Guildes actives
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-sm bg-foreground/25" /> Membres actifs
                        </span>
                    </footer>
                </section>

                <section className="p-5 rounded-2xl border border-border bg-surface">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-warning" />
                        À relancer
                    </h3>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{thresholdNote}</p>

                    {toRelance.length === 0 ? (
                        <p className="text-xs text-muted-foreground mt-4">
                            Aucune guilde au-delà du seuil : toutes ont agi récemment.
                        </p>
                    ) : (
                        <ul className="mt-3 space-y-2">
                            {toRelance.slice(0, 5).map((guild) => (
                                <li key={guild.id} className="flex items-center justify-between gap-3">
                                    <span className="text-xs font-semibold text-foreground truncate">{guild.name}</span>
                                    <span className="flex items-center gap-2 shrink-0">
                                        <span className="text-[10px] text-muted-foreground tabular-nums">
                                            {guild.daysInactive === null ? "jamais vue" : `${guild.daysInactive} j`}
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
                </section>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <section className="p-5 rounded-2xl border border-border bg-surface">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Layers className="w-4 h-4 text-accent" />
                        Modules activés sans usage
                    </h3>
                    <p className="text-[10px] text-muted-foreground mt-1">
                        Activés par au moins une guilde, sans aucune ligne métier produite sur {windowDays} jours.
                    </p>

                    {idleModules.length === 0 ? (
                        <p className="text-xs text-muted-foreground mt-4">
                            Aucun : tous les modules mesurables activés ont produit de l&apos;usage.
                        </p>
                    ) : (
                        <ul className="mt-3 space-y-2">
                            {idleModules.slice(0, 5).map((module) => (
                                <li key={module.module} className="flex items-center justify-between gap-3">
                                    <span className="text-xs font-semibold text-foreground truncate">
                                        {moduleLabel(module.module)}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                                        {module.enabledGuilds} activée(s) · {module.idleGuilds} sans usage
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className="p-5 rounded-2xl border border-border bg-surface">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-accent" />
                        Profondeur d&apos;usage
                    </h3>
                    <p className="text-[10px] text-muted-foreground mt-1">
                        Lignes métier créées par guilde sur {windowDays} jours (songes, missions, sondages, marché,
                        tickets, profils, succès, événements, services).
                    </p>

                    {businessRows30.length === 0 ? (
                        <p className="text-xs text-muted-foreground mt-4">Aucune ligne métier créée sur la fenêtre.</p>
                    ) : (
                        <ul className="mt-3 space-y-2">
                            {businessRows30.slice(0, 5).map((entry) => (
                                <li key={entry.guildId} className="flex items-center justify-between gap-3">
                                    <span className="text-xs font-semibold text-foreground truncate">
                                        {entry.guildName}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                                        {entry.rows} ligne(s)
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
}

function OverviewCard({
    icon,
    label,
    value,
    valueNote,
    detail,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    valueNote: string;
    detail: string;
}) {
    return (
        <div className="p-5 rounded-2xl border border-border bg-surface">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        {label}
                    </span>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-foreground tabular-nums">{value}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                            {valueNote}
                        </span>
                    </div>
                </div>
                <div className="p-2.5 rounded-xl bg-accent-soft border border-accent/20 text-accent shrink-0">{icon}</div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">{detail}</p>
        </div>
    );
}

