"use client";

/**
 * Module « Marché » — **éditeur de jet FM** (S2.10/S2.11/S2.12).
 *
 * Remplit les lignes **natives** depuis le catalogue (plages `from`→`to`),
 * laisse saisir la valeur réelle, affiche l'**étiquette FM en direct**
 * (malus / exo / à vérifier / over / parfait / bon / faible), propose le bouton
 * **« ✦ Jet parfait »**, les exos PA/PM/PO/invocation **en un clic**, une
 * **ligne libre choisie dans le référentiel FM complet** et le **budget de
 * densité** (101 partagés entre overs et exos, cf. §12.8).
 *
 * ⚠️ Les valeurs sont **recalculées côté serveur** à l'enregistrement ; tout ce
 * qui est affiché ici (étiquette, densité) n'est qu'une aide visuelle — jamais
 * une source de vérité (D17). Un over, un exo ou un malus ne bloque rien (D34).
 */

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    MARKET_FM_STATUS_CLASSES,
    MARKET_FM_STATUS_LABELS,
    MARKET_LIMITS,
} from "@/server/actions/market-constants";
import {
    EXO_EFFECT_PRESETS,
    buildExoStatDraft,
    type ExoEffectPreset,
    type MarketStatDraft,
} from "@/lib/market/effects";
import {
    FM_EFFECTS,
    computeFmBudget,
    describeFmReadonly,
    fmDensity,
    getFmEffect,
    getFmStatus,
    maxOverFromRemaining,
    resolveFmEffectKey,
    type FmEffectDefinition,
    type FmStatus,
} from "@/lib/market/fm-effects";
import { StatIcon } from "@/components/market/stat-icon";
import { cn } from "@/lib/utils";
import { Gauge, Plus, Search, Sparkles, Trash2 } from "lucide-react";

interface MarketJetEditorProps {
    stats: MarketStatDraft[];
    onChange: (stats: MarketStatDraft[]) => void;
}

/** Analyse FM d'une ligne déclarée (pure, jamais persistée). */
type FmLineInfo = {
    /** Définition du référentiel FM, `null` si la ligne n'est pas une ligne FM. */
    definition: FmEffectDefinition | null;
    /** Étiquette affichée (malus / exo / over / parfait / bon / faible / à vérifier). */
    status: FmStatus;
    /** Densité consommée **au-dessus du jet natif** (0 pour une ligne native pure). */
    extraValue: number;
    /** Raison de lecture seule (dégâts d'arme, vol de vie…), sinon `null`. */
    readonlyReason: string | null;
};

/** Analyse une ligne : étiquette FM + densité + éventuelle lecture seule. */
function analyzeLine(stat: MarketStatDraft): FmLineInfo {
    const isNative = stat.origin === "NATIVE" && stat.naturalMax != null;
    const status = getFmStatus({
        currentValue: stat.actualValue,
        nativeMin: stat.naturalMin,
        nativeMax: stat.naturalMax,
        isNativeEffect: isNative,
    });
    const definition = getFmEffect(
        resolveFmEffectKey({
            effectId: stat.effectId,
            characteristic: stat.characteristic,
            label: stat.label,
        })
    );
    // Ce qui consomme de la densité = ce qui dépasse le jet natif maximum.
    const extraValue = isNative
        ? Math.max(0, stat.actualValue - (stat.naturalMax as number))
        : Math.max(0, stat.actualValue);

    return {
        definition,
        status,
        extraValue: definition ? extraValue : 0,
        // Une ligne que le référentiel FM ne sait pas nommer n'est jamais
        // proposée comme forgeable : elle reste affichée en **lecture seule**
        // (dégâts d'arme, vol de vie, bonus de panoplie, conditions…).
        readonlyReason:
            describeFmReadonly(stat.label) ??
            (definition ? null : "Ligne hors jet FM — non forgeable"),
    };
}

export function MarketJetEditor({ stats, onChange }: MarketJetEditorProps) {
    // S7.16 — « Ligne libre FM » : modale du référentiel (52 lignes forgeables),
    // avec recherche, icône officielle, rune et densité.
    const [fmOpen, setFmOpen] = useState(false);
    const [fmQuery, setFmQuery] = useState("");

    /** Référentiel filtré par la recherche (libellé, rune, libellé court). */
    const filteredFmEffects = useMemo(() => {
        const term = fmQuery.trim().toLowerCase();
        if (!term) return FM_EFFECTS;
        return FM_EFFECTS.filter((effect) =>
            `${effect.label} ${effect.shortLabel} ${effect.rune}`.toLowerCase().includes(term)
        );
    }, [fmQuery]);

    /** Analyse FM de chaque ligne (étiquette + densité + lecture seule). */
    const analysis = useMemo(() => stats.map(analyzeLine), [stats]);

    /** Budget de densité : 101 points partagés entre overs et exos (§12.8). */
    const budget = useMemo(
        () =>
            computeFmBudget(
                analysis
                    .filter((line) => line.definition !== null)
                    .map((line) => ({
                        unitWeight: (line.definition as FmEffectDefinition).unitWeight,
                        extraValue: line.extraValue,
                    }))
            ),
        [analysis]
    );

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

    /**
     * Ajoute une **ligne libre** issue du référentiel FM : libellé officiel,
     * plage native inconnue (→ étiquette `EXO` ou `À vérifier`). Aucune saisie
     * sauvage : la liste des lignes proposées est celle du référentiel versionné.
     */
    function addFmLine(key: string) {
        if (stats.length >= MARKET_LIMITS.MAX_STATS) return;
        const definition = getFmEffect(key);
        if (!definition) return;
        if (stats.some((stat) => stat.label === definition.label && stat.origin === "EXO")) return;
        const nextId = Math.min(-1, ...stats.map((s) => s.effectId)) - 1;
        onChange([
            ...stats,
            {
                effectId: nextId,
                characteristic: null,
                label: definition.label,
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
            </div>

            {/* S7.16 — Ligne libre : modale du référentiel FM (52 lignes forgeables) */}
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface/40 px-3 py-2">
                <span className="text-[11px] font-bold uppercase text-muted-foreground">
                    Ligne libre FM
                </span>
                <Dialog
                    open={fmOpen}
                    onOpenChange={(next) => {
                        setFmOpen(next);
                        if (!next) setFmQuery("");
                    }}
                >
                    <DialogTrigger asChild>
                        <Button type="button" variant="outline" size="sm" className="gap-2">
                            <Plus className="h-3.5 w-3.5" />
                            Choisir dans le référentiel ({FM_EFFECTS.length} lignes)
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Ligne libre FM</DialogTitle>
                            <DialogDescription>
                                Rune et densité officielles du référentiel versionné. Un over ou un
                                exo n&apos;est jamais refusé : il est simplement étiqueté.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={fmQuery}
                                onChange={(event) => setFmQuery(event.target.value)}
                                placeholder="Rechercher une caractéristique ou une rune (ex. Vitalité, Cri…)"
                                className="pl-9"
                                autoFocus
                            />
                        </div>

                        <ul className="max-h-[420px] space-y-1 overflow-y-auto custom-scrollbar pr-1">
                            {filteredFmEffects.length === 0 && (
                                <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                                    Aucune ligne FM ne correspond à « {fmQuery} ».
                                </li>
                            )}
                            {filteredFmEffects.map((effect) => {
                                const alreadyAdded = stats.some(
                                    (stat) => stat.label === effect.label && stat.origin === "EXO"
                                );
                                return (
                                    <li key={effect.key}>
                                        <button
                                            type="button"
                                            disabled={alreadyAdded}
                                            onClick={() => {
                                                addFmLine(effect.key);
                                                setFmOpen(false);
                                                setFmQuery("");
                                            }}
                                            className={cn(
                                                "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                                                alreadyAdded
                                                    ? "border-border bg-surface/40 opacity-50"
                                                    : "border-border bg-surface/60 hover:border-border-strong"
                                            )}
                                        >
                                            <StatIcon label={effect.label} />
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-sm font-semibold text-foreground">
                                                    {effect.label}
                                                </span>
                                                <span className="block text-[11px] text-muted-foreground">
                                                    Rune {effect.rune} · {effect.unitWeight} densité/pt
                                                </span>
                                            </span>
                                            <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                                                {effect.canExo ? "Exo" : ""}
                                                {effect.canExo && effect.canOver ? " · " : ""}
                                                {effect.canOver ? `Over +${effect.maxOverStandalone}` : ""}
                                            </span>
                                            {alreadyAdded && (
                                                <span className="shrink-0 text-[10px] font-black uppercase text-muted-foreground">
                                                    déjà ajoutée
                                                </span>
                                            )}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Budget de densité FM : 101 points partagés entre overs et exos (§12.8) */}
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface/40 px-3 py-2 text-[11px]">
                <span className="flex items-center gap-1.5 font-bold uppercase text-muted-foreground">
                    <Gauge className="h-3.5 w-3.5" />
                    Densité FM
                </span>
                <span className="tabular-nums text-foreground">
                    {budget.consumed} / {budget.cap}
                </span>
                <span className="tabular-nums text-muted-foreground">
                    reste {budget.remaining}
                </span>
                {budget.exceeded && (
                    <span className="rounded-md border border-warning/30 bg-warning/10 px-1.5 font-bold uppercase text-warning">
                        Dépasse le plafond — jamais bloquant, à vérifier
                    </span>
                )}
                <span className="ml-auto text-muted-foreground">
                    Ex. : un exo PM (90) laisse 11 de densité, soit +55 Vitalité
                </span>
            </div>

            {stats.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                    Aucun effet natif pour cet objet. S&apos;il en possède, lance « Rattraper les
                    effets natifs » (God → Items &amp; Ressources), puis ajoute un exo ou une ligne
                    libre FM.
                </p>
            ) : (
                <ul className="space-y-2">
                    {stats.map((stat, index) => {
                        const line = analysis[index];
                        const definition = line.definition;
                        const readonly = line.readonlyReason !== null;
                        // Over maximal théorique : plafond du référentiel ET densité restante.
                        const maxOver = definition
                            ? Math.min(
                                  definition.maxOverStandalone,
                                  maxOverFromRemaining(definition, budget.remaining)
                              )
                            : 0;
                        return (
                            <li
                                key={`${stat.effectId}-${stat.origin}-${index}`}
                                className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface/60 px-3 py-2"
                            >
                                <span className="flex min-w-[150px] flex-1 items-center gap-2 text-sm">
                                    <StatIcon
                                        characteristicId={stat.characteristic}
                                        effectId={stat.effectId}
                                        label={stat.label}
                                    />
                                    <span className="truncate font-semibold text-foreground">
                                        {definition ? definition.label : stat.label}
                                    </span>
                                    {definition && (
                                        <span className="rounded-md border border-border bg-muted/30 px-1.5 text-[10px] font-bold uppercase text-muted-foreground">
                                            {definition.rune}
                                        </span>
                                    )}
                                    {stat.origin === "EXO" && (
                                        <span className="rounded-md border border-info/30 bg-info/10 px-1.5 text-[10px] font-black uppercase text-info">
                                            Exo
                                        </span>
                                    )}
                                    {readonly && (
                                        <span
                                            className="rounded-md border border-warning/30 bg-warning/10 px-1.5 text-[10px] font-bold uppercase text-warning"
                                            title={line.readonlyReason ?? undefined}
                                        >
                                            Lecture seule
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
                                    disabled={readonly}
                                    onChange={(event) => patch(index, { actualValue: Number(event.target.value) })}
                                    className="h-9 w-24"
                                    aria-label={`Valeur réelle — ${stat.label}`}
                                />

                                <span
                                    className={cn(
                                        "w-20 text-center text-[11px] font-black uppercase",
                                        MARKET_FM_STATUS_CLASSES[line.status]
                                    )}
                                    title={
                                        definition
                                            ? `Rune ${definition.rune} — ${definition.unitWeight} densité par point`
                                            : line.readonlyReason ?? undefined
                                    }
                                >
                                    {MARKET_FM_STATUS_LABELS[line.status]}
                                </span>

                                <span className="w-32 text-right text-[11px] tabular-nums text-muted-foreground">
                                    {definition
                                        ? line.extraValue > 0
                                            ? `${fmDensity(definition.unitWeight, line.extraValue)} densité`
                                            : `over max +${maxOver}`
                                        : "hors jet FM"}
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
                Un over, un exo ou un malus n&apos;est <strong>jamais</strong> refusé : SigilOS ne juge
                pas la légitimité du jet, il l&apos;étiquette (malus / exo / à vérifier / over /
                parfait / bon / faible) et affiche la <strong>densité FM</strong> consommée par les
                overs et exos déclarés.
            </p>
        </div>
    );
}
