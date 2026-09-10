"use client";

/**
 * Module « Marché » — **éditeur de jet FM** (S2.10/S2.11).
 *
 * Remplit les lignes **natives** depuis le catalogue (plages `from`→`to`),
 * laisse saisir la valeur réelle, affiche l'**état en direct** (parfait / bon /
 * normal / faible / over / exo), propose le bouton **« ✦ Jet parfait »** et les
 * exos PA/PM/PO/invocation **en un clic** (+ mode avancé : ligne libre).
 *
 * ⚠️ Les valeurs sont **recalculées côté serveur** à l'enregistrement ; l'état
 * affiché ici n'est qu'une aide visuelle (jamais une source de vérité).
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MARKET_QUALITY_CLASSES, MARKET_QUALITY_LABELS, MARKET_LIMITS } from "@/server/actions/market-constants";
import { computeStatQuality } from "@/lib/market/stat-quality";
import {
    EXO_EFFECT_PRESETS,
    buildExoStatDraft,
    type MarketStatDraft,
    type ExoEffectPreset,
} from "@/lib/market/effects";
import { StatIcon } from "@/components/market/stat-icon";
import { cn } from "@/lib/utils";
import { Plus, Sparkles, Trash2 } from "lucide-react";

type QualityValue = "LOW" | "NORMAL" | "GOOD" | "PERFECT" | "OVER";

interface MarketJetEditorProps {
    stats: MarketStatDraft[];
    onChange: (stats: MarketStatDraft[]) => void;
}

function qualityOf(stat: MarketStatDraft): QualityValue {
    return computeStatQuality({
        naturalMin: stat.naturalMin,
        naturalMax: stat.naturalMax,
        actualValue: stat.actualValue,
        origin: stat.origin,
    });
}

export function MarketJetEditor({ stats, onChange }: MarketJetEditorProps) {
    function patch(index: number, partial: Partial<MarketStatDraft>) {
        onChange(stats.map((stat, i) => (i === index ? { ...stat, ...partial } : stat)));
    }

    function remove(index: number) {
        onChange(stats.filter((_, i) => i !== index));
    }

    function addExo(preset: ExoEffectPreset) {
        if (stats.some((stat) => stat.effectId === preset.effectId && stat.origin === "EXO")) return;
        if (stats.length >= MARKET_LIMITS.MAX_STATS) return;
        onChange([...stats, buildExoStatDraft(preset, 1)]);
    }

    function addFreeLine() {
        if (stats.length >= MARKET_LIMITS.MAX_STATS) return;
        const nextId = Math.min(-1, ...stats.map((s) => s.effectId)) - 1;
        onChange([
            ...stats,
            {
                effectId: nextId,
                characteristic: null,
                label: "Effet libre",
                naturalMin: null,
                naturalMax: null,
                actualValue: 0,
                origin: "EXO",
            },
        ]);
    }

    function setPerfect() {
        onChange(
            stats.map((stat) =>
                stat.naturalMax != null ? { ...stat, actualValue: stat.naturalMax } : stat
            )
        );
    }

    return (
        <div className="space-y-4" data-tour="marche-jet">
            <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={setPerfect}>
                    <Sparkles className="h-3.5 w-3.5 text-gold" />
                    ✦ Jet parfait
                </Button>
                {EXO_EFFECT_PRESETS.map((preset) => (
                    <Button
                        key={preset.key}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addExo(preset)}
                    >
                        Exo {preset.label}
                    </Button>
                ))}
                <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={addFreeLine}>
                    <Plus className="h-3.5 w-3.5" />
                    Ligne libre
                </Button>
            </div>

            {stats.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                    Aucun effet natif pour cet objet. Ajoute un exo ou une ligne libre.
                </p>
            ) : (
                <ul className="space-y-2">
                    {stats.map((stat, index) => {
                        const quality = qualityOf(stat);
                        return (
                            <li
                                key={`${stat.effectId}-${stat.origin}-${index}`}
                                className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface/60 px-3 py-2"
                            >
                                <span className="flex min-w-[150px] flex-1 items-center gap-2 text-sm">
                                    <StatIcon characteristicId={stat.characteristic} />
                                    <span className="truncate font-semibold text-foreground">{stat.label}</span>
                                    {stat.origin === "EXO" && (
                                        <span className="rounded-md border border-info/30 bg-info/10 px-1.5 text-[10px] font-black uppercase text-info">
                                            Exo
                                        </span>
                                    )}
                                </span>

                                <span className="text-[11px] tabular-nums text-muted-foreground">
                                    {stat.naturalMin != null && stat.naturalMax != null
                                        ? `${stat.naturalMin} à ${stat.naturalMax}`
                                        : "libre"}
                                </span>

                                <Input
                                    type="number"
                                    value={Number.isFinite(stat.actualValue) ? stat.actualValue : 0}
                                    min={MARKET_LIMITS.STAT_VALUE_MIN}
                                    max={MARKET_LIMITS.STAT_VALUE_MAX}
                                    onChange={(event) => patch(index, { actualValue: Number(event.target.value) })}
                                    className="h-9 w-24"
                                    aria-label={`Valeur réelle — ${stat.label}`}
                                />

                                <span
                                    className={cn(
                                        "w-20 text-center text-[11px] font-black uppercase",
                                        MARKET_QUALITY_CLASSES[quality]
                                    )}
                                >
                                    {MARKET_QUALITY_LABELS[quality]}
                                </span>

                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => remove(index)}
                                    aria-label={`Supprimer ${stat.label}`}
                                >
                                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                            </li>
                        );
                    })}
                </ul>
            )}

            <p className="text-[11px] text-muted-foreground">
                Un over ou un exo n&apos;est <strong>jamais</strong> refusé : SigilOS ne juge pas la
                légitimité du jet, il l&apos;étiquette (parfait / bon / normal / faible / over / exo).
            </p>
        </div>
    );
}
