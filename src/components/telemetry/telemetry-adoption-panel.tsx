"use client";

import { Layers, TriangleAlert } from "lucide-react";
import { moduleLabel } from "@/lib/module-catalog";
import { getProductStats } from "@/server/actions/telemetry-product-actions";
import { TelemetrySampleNote } from "@/components/telemetry/telemetry-sample-note";

/**
 * Onglet « Adoption par module » (D-2bis, itération 4).
 *
 * Remplace « Consommation modules », qui comptait des **pages vues par module** : un module
 * qu'on ouvre beaucoup n'est pas un module qui sert. Ici, la mesure est croisée :
 * **activé** (bascule de la guilde, hors verrouillage staff) **vs réellement utilisé**
 * (au moins une ligne métier horodatée sur la fenêtre).
 *
 * Deux honnêtetés non négociables :
 * 1. un module **sans table métier horodatée** n'est pas « inutilisé » : il est listé à part
 *    avec la raison ;
 * 2. les modules désactivés par le staff (verrou `disabledByGod`) ne sont pas comptés comme activés.
 */

type ProductStatsType = Awaited<ReturnType<typeof getProductStats>>;

export function TelemetryAdoptionPanel({ product }: { product: ProductStatsType | null }) {
    if (!product) {
        return (
            <section className="p-6 rounded-2xl border border-border bg-surface">
                <h3 className="text-sm font-bold text-foreground">Mesures produit indisponibles</h3>
                <p className="text-xs text-muted-foreground mt-1">
                    La lecture des mesures produit a échoué : aucun chiffre d&apos;adoption n&apos;est affiché
                    plutôt qu&apos;un chiffre faux.
                </p>
            </section>
        );
    }

    const { adoption, windowDays, sample, truncated } = product;
    const withoutUsage = adoption.modules.filter((module) => module.idleGuilds > 0);
    const enabledMeasured = adoption.modules.filter((module) => module.enabledGuilds > 0);
    const maxEnabled = Math.max(1, ...adoption.modules.map((module) => module.enabledGuilds));

    return (
        <section className="p-6 rounded-2xl border border-border bg-surface space-y-5">
            <header className="space-y-1">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Layers className="w-4 h-4 text-accent" />
                    Adoption réelle des modules
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                    Un module activé n&apos;est pas un module utilisé. Chaque ligne croise la bascule de la guilde
                    (un module désactivé par le staff ne compte pas) et l&apos;usage réel : au moins une ligne
                    métier produite sur {windowDays} jours.
                </p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <MiniStat label="Modules mesurables" value={String(adoption.probedModules)} />
                <MiniStat
                    label="Activés sans aucun usage"
                    value={String(withoutUsage.length)}
                    tone={withoutUsage.length > 0 ? "warning" : "neutral"}
                />
                <MiniStat label="Activés sans mesure d'usage" value={String(adoption.unmeasured.length)} />
            </div>

            {enabledMeasured.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                    Aucun module mesurable n&apos;est activé : il n&apos;y a rien à comparer pour l&apos;instant.
                </p>
            ) : (
                <ul className="space-y-2">
                    {enabledMeasured.map((module) => (
                        <li
                            key={module.module}
                            className="p-3 rounded-xl border border-border bg-elevated/40 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] gap-2 md:items-center"
                        >
                            <span className="text-xs font-semibold text-foreground truncate">
                                {moduleLabel(module.module)}
                            </span>

                            <div className="flex items-center gap-3">
                                <div className="h-2 flex-1 rounded-full bg-surface overflow-hidden">
                                    <div
                                        className="h-full bg-accent"
                                        style={{ width: `${Math.round((module.enabledGuilds / maxEnabled) * 100)}%` }}
                                    />
                                </div>
                                <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
                                    {module.usedGuilds} / {module.enabledGuilds} guilde(s) utilisatrice(s)
                                </span>
                            </div>

                            <span className="flex items-center gap-2 justify-start md:justify-end">
                                <span className="text-[10px] font-semibold tabular-nums text-foreground">
                                    {module.adoptionRate} %
                                </span>
                                {module.idleGuilds > 0 && (
                                    <span className="text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded border bg-warning/10 text-warning border-warning/20 whitespace-nowrap">
                                        {module.idleGuilds} sans usage
                                    </span>
                                )}
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            <ModuleWithoutProbe unmeasured={adoption.unmeasured} />
            <TelemetrySampleNote sample={sample} truncated={truncated} windowDays={windowDays} />
        </section>
    );
}

function MiniStat({
    label,
    value,
    tone = "neutral",
}: {
    label: string;
    value: string;
    tone?: "neutral" | "warning";
}) {
    return (
        <div className="p-3 rounded-xl border border-border bg-surface/60">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
            <p
                className={`text-lg font-bold tabular-nums mt-1 ${
                    tone === "warning" ? "text-warning" : "text-foreground"
                }`}
            >
                {value}
            </p>
        </div>
    );
}

function ModuleWithoutProbe({ unmeasured }: { unmeasured: Array<{ module: string; enabledGuilds: number }> }) {
    return (
        <div className="pt-4 border-t border-border/60 space-y-2">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                <TriangleAlert className="w-3.5 h-3.5 text-muted-foreground" />
                Modules sans mesure d&apos;usage
            </h4>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
                Ces modules n&apos;ont aucune table métier horodatée par guilde : ils ne sont donc pas jugés ici.
                Les compter comme inutilisés serait une affirmation, pas une mesure.
            </p>
            {unmeasured.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">
                    Aucun : tous les modules activables sont mesurables.
                </p>
            ) : (
                <ul className="flex flex-wrap gap-2">
                    {unmeasured.map((module) => (
                        <li
                            key={module.module}
                            className="text-[10px] px-2 py-1 rounded-lg border border-border bg-surface/60 text-muted-foreground"
                        >
                            <span className="text-foreground font-semibold">{moduleLabel(module.module)}</span>
                            {module.enabledGuilds > 0
                                ? ` · ${module.enabledGuilds} activée(s)`
                                : " · aucune activation"}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
