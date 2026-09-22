"use client";

/**
 * **Panneau « Boosts »** d'une fiche stuff — « combien je tape avec mes buffs, et avec les malus
 * que je pose ? ».
 *
 * 🎯 Demande user (22/09/2026, verbatim) : « sur dofusbook aussi on peut ajouter des boost pour
 * voir combien on tape avec les boost que le perso a ou les malus quil peut mettre etc ».
 *
 * 🔒 Deux sources, aucune valeur inventée :
 *   ① les **presets mesurés** (`BOOST_PRESETS`, chaque entrée citant son sort/niveau/effet
 *      DofusDB — Puissance, Épée Divine, Bond) ;
 *   ② les **lignes personnalisées**, saisies par l'utilisateur (Puissance, % Dommages par famille,
 *      Dommages fixes/critiques, `% Dommages finaux`, `% Dommages subis` de la cible).
 *
 * Le composant ne calcule **aucun dégât** : il produit la liste de boosts, que la fiche applique
 * au build (`applyBoosts`) et à la cible (`targetDamageTakenFactor`) — une seule source de vérité
 * pour le calcul (`computeSpellDamage` + `dofus-zone-damage`).
 */

import { RotateCcw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";
import { BOOST_PRESETS, type BoostCasterDelta, type DamageBoost } from "@/lib/dofus-boosts";

/** Lignes personnalisées : clé i18n → champ visé (`caster`, ou `% Dommages subis` de la cible). */
const CUSTOM_ROWS = [
    "puissance",
    "pctSorts",
    "pctMelee",
    "pctDistance",
    "dommagesGeneraux",
    "dommagesCritiques",
    "pctFinaux",
    "targetDamageTaken",
] as const;

type CustomKey = (typeof CUSTOM_ROWS)[number];

/** Valeur saisie d'une ligne personnalisée (0 = ligne inactive, donc absente de la liste). */
function customValue(boosts: DamageBoost[], key: CustomKey): number {
    const boost = boosts.find((b) => b.id === `custom:${key}`);
    if (!boost) return 0;
    if (key === "targetDamageTaken") return Number(boost.targetDamageTakenPercent) || 0;
    return Number((boost.caster as Record<string, number> | undefined)?.[key]) || 0;
}

/** Remplace (ou retire) la ligne personnalisée `key` — les presets ne sont jamais touchés. */
function withCustomValue(
    boosts: DamageBoost[],
    key: CustomKey,
    raw: number,
    label: string
): DamageBoost[] {
    const id = `custom:${key}`;
    const others = boosts.filter((b) => b.id !== id);
    const value = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
    if (value === 0) return others;
    if (key === "targetDamageTaken") return [...others, { id, label, targetDamageTakenPercent: value }];
    return [...others, { id, label, caster: { [key]: value } as BoostCasterDelta }];
}

interface SimulationBoostPanelProps {
    value: DamageBoost[];
    onChange: (boosts: DamageBoost[]) => void;
}

export function SimulationBoostPanel({ value, onChange }: SimulationBoostPanelProps) {
    const { t } = useI18n();
    const boostsT = t.tacticalSim.boosts;

    const togglePreset = (preset: DamageBoost) => {
        const active = value.some((b) => b.id === preset.id);
        onChange(active ? value.filter((b) => b.id !== preset.id) : [...value, preset]);
    };

    return (
        <section className="rounded-2xl border border-border bg-surface p-3 sm:p-4 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-tight text-foreground">
                    <Sparkles className="h-4 w-4 text-warning" aria-hidden="true" />
                    {boostsT.title}
                </h4>
                {value.length > 0 && (
                    <button
                        type="button"
                        onClick={() => onChange([])}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <RotateCcw className="h-3 w-3" aria-hidden="true" />
                        {boostsT.reset}
                    </button>
                )}
            </div>

            <p className="text-caption text-muted-foreground">{boostsT.hint}</p>

            <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">{boostsT.presets}</p>
                <div className="flex flex-wrap gap-1.5">
                    {BOOST_PRESETS.map((preset) => {
                        const active = value.some((b) => b.id === preset.id);
                        const label = boostsT.presetLabels[preset.id as keyof typeof boostsT.presetLabels] ?? preset.label;
                        const source = preset.source;
                        return (
                            <button
                                key={preset.id}
                                type="button"
                                onClick={() => togglePreset(preset)}
                                aria-pressed={active}
                                title={
                                    source
                                        ? boostsT.sourceTitle
                                              .replace("{spell}", String(source.spellId))
                                              .replace("{level}", String(source.spellLevelId))
                                              .replace("{effect}", String(source.effectId))
                                        : preset.label
                                }
                                className={cn(
                                    "cursor-pointer rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors",
                                    active
                                        ? "border-accent/40 bg-accent/10 text-foreground"
                                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">{boostsT.custom}</p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {CUSTOM_ROWS.map((key) => (
                        <label key={key} className="flex flex-col gap-1">
                            <span className="truncate text-[10px] font-bold text-muted-foreground">{boostsT.labels[key]}</span>
                            <input
                                type="number"
                                min={0}
                                inputMode="numeric"
                                value={customValue(value, key) || ""}
                                onChange={(e) =>
                                    onChange(withCustomValue(value, key, Number(e.target.value), boostsT.labels[key]))
                                }
                                placeholder="0"
                                className="w-full rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-bold tabular-nums text-foreground"
                            />
                        </label>
                    ))}
                </div>
            </div>
        </section>
    );
}
