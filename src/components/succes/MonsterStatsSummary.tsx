"use client";

/**
 * `MonsterStatsSummary` — bloc de caractéristiques d'un monstre, **partagé** par les trois
 * surfaces d'une fiche boss : publique (`PublicBossDetailClient`), interne du module Succès
 * (`SuccesBossGuide`) et fiche Titan (`SuccesTitanTab`).
 *
 * **Pourquoi ce composant existe (mesure du 30/10/2026)** : la fiche Titan portait sa propre
 * version du bloc — pictos `/assets/module-succes/*`, cinq couleurs d'accent
 * (`info`/`danger`/`warning`/`success`), pastilles « Butin 4..8 » et rayons 16 px — là où les
 * deux fiches boss utilisaient déjà `/assets/dofus/stats/*` et des valeurs neutres. Trois
 * implémentations pour la même donnée : le Titan ne ressemblait pas à une fiche boss et le
 * sélecteur de « Butin » mentait sur son sens (c'est un **rang** de monstre, pas une tranche de butin).
 *
 * Une seule présentation désormais (règles UI : rayons ≤ 12 px, aucun accent décoratif) :
 *   · 3 cartes PV / PA / PM (`/assets/dofus/stats/{pv,pa,pm}.png`) ;
 *   · encadré résistances (une valeur **négative** est la seule à porter `text-danger`) ;
 *   · sélecteur de rang 1..N (état actif neutre `bg-foreground text-background`) ;
 *   · Tacle / Fuite / Esq PA / Esq PM, puis Retraits / Puissance / Soins, puis Initiative.
 *
 * Les valeurs passent par les règles pures existantes (`readGradeResists`,
 * `deriveGradeCombatStats`) : aucune lecture ad hoc, aucun `0` inventé — absent ⇒ « — ».
 */

import { ArrowRight, Flame, Loader2 } from "lucide-react";

import {
    deriveGradeCombatStats,
    EMPTY_GRADE_RESISTS,
    readGradeResists,
    toInteger,
} from "@/lib/dofus-monster-grades";
import { cn } from "@/lib/utils";

/** Un grade tel que le rendent nos producteurs (`MonsterStat.stats.grades[]`). */
export interface MonsterStatsGradeView {
    level?: number | null;
    lifePoints?: number | null;
    actionPoints?: number | null;
    movementPoints?: number | null;
    resists?: {
        neutral?: number | null;
        earth?: number | null;
        fire?: number | null;
        water?: number | null;
        air?: number | null;
    } | null;
    carac?: {
        agility?: number | null;
        paDodge?: number | null;
        pmDodge?: number | null;
    } | null;
    tackle?: number | null;
    evade?: number | null;
    initiative?: number | null;
    apDodge?: number | null;
    mpDodge?: number | null;
    apRemoval?: number | null;
    mpRemoval?: number | null;
    power?: number | null;
    healBonus?: number | null;
}

export interface MonsterStatsSummaryProps {
    /** Grades du monstre (`stats.grades`) — vide ⇒ tout affiché « — », jamais 0. */
    grades: MonsterStatsGradeView[] | null | undefined;
    /** Rang sélectionné ; `null` ou hors bornes ⇒ le dernier grade (le plus haut). */
    activeGradeIndex: number | null;
    onGradeChange?: (index: number) => void;
    locale?: "fr" | "en";
    loading?: boolean;
    loadingLabel?: string;
    /** Affiche le raccourci vers l'onglet « Rangs & Paliers » (fiche publique). */
    onGradesOpen?: () => void;
}

/** Pictogrammes officiels Dofus — une seule racine d'assets pour les trois surfaces. */
const STAT_ICONS = {
    hp: "/assets/dofus/stats/pv.png",
    ap: "/assets/dofus/stats/pa.png",
    mp: "/assets/dofus/stats/pm.png",
    tackle: "/assets/dofus/stats/tacle.png",
    evade: "/assets/dofus/stats/fuite.png",
    apDodge: "/assets/dofus/stats/esquivePA.png",
    mpDodge: "/assets/dofus/stats/esquivePM.png",
    apRemoval: "/assets/dofus/stats/retraitPA.png",
    mpRemoval: "/assets/dofus/stats/retraitPM.png",
    power: "/assets/dofus/stats/puissance.png",
    heal: "/assets/dofus/stats/soin.png",
    initiative: "/assets/dofus/stats/initiative.png",
    resNeutral: "/assets/dofus/stats/resNeutre.png",
    resEarth: "/assets/dofus/stats/resTerre.png",
    resFire: "/assets/dofus/stats/resFeu.png",
    resWater: "/assets/dofus/stats/resEau.png",
    resAir: "/assets/dofus/stats/resAir.png",
} as const;

const LABELS = {
    fr: {
        loading: "Chargement des caractéristiques…",
        hp: "Points de vie",
        hpShort: "PV",
        ap: "PA",
        mp: "PM",
        resistance: "Résistances",
        neutral: "Neutre",
        earth: "Terre",
        fire: "Feu",
        water: "Eau",
        air: "Air",
        rank: "Rang :",
        rankWord: "Rang",
        levelShort: "Niv.",
        tackle: "Tacle",
        evade: "Fuite",
        apDodge: "Esq PA",
        mpDodge: "Esq PM",
        apRemoval: "Ret PA",
        mpRemoval: "Ret PM",
        power: "Puissance",
        heal: "Soin",
        initiative: "Initiative",
        openGrades: "Ouvrir l'onglet des grades & paliers",
    },
    en: {
        loading: "Loading characteristics…",
        hp: "Health Points",
        hpShort: "HP",
        ap: "AP",
        mp: "MP",
        resistance: "Resistances",
        neutral: "Neutral",
        earth: "Earth",
        fire: "Fire",
        water: "Water",
        air: "Air",
        rank: "Rank:",
        rankWord: "Rank",
        levelShort: "Lv.",
        tackle: "Lock",
        evade: "Dodge",
        apDodge: "AP Dodge",
        mpDodge: "MP Dodge",
        apRemoval: "AP Red",
        mpRemoval: "MP Red",
        power: "Power",
        heal: "Heal",
        initiative: "Initiative",
        openGrades: "Open grades & tiers tab",
    },
} as const;

/** Nombre formaté selon la langue de l'écran ; absent ⇒ « — » (jamais un 0 inventé). */
function formatValue(value: number | null | undefined, numberLocale: string): string {
    return typeof value === "number" ? value.toLocaleString(numberLocale) : "—";
}

/** Une caractéristique avancée : picto Dofus + libellé + valeur (« — » si absente). */
function StatCell({ icon, label, value }: { icon: string; label: string; value: number | null }) {
    return (
        <div className="flex min-w-0 flex-col items-center">
            <span className="flex items-center gap-1 font-sans text-[10px] uppercase text-muted-foreground">
                <img src={icon} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />
                <span className="truncate">{label}</span>
            </span>
            <span className="mt-0.5 font-semibold tabular-nums text-foreground">{value ?? "—"}</span>
        </div>
    );
}

export function MonsterStatsSummary({
    grades,
    activeGradeIndex,
    onGradeChange,
    locale = "fr",
    loading = false,
    loadingLabel,
    onGradesOpen,
}: MonsterStatsSummaryProps) {
    const labels = LABELS[locale];
    const numberLocale = locale === "en" ? "en-US" : "fr-FR";
    const list = grades ?? [];

    if (loading) {
        return (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-surface/60 px-3.5 py-3 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span className="text-xs">{loadingLabel ?? labels.loading}</span>
            </div>
        );
    }

    // Rang demandé hors bornes (liste rechargée) ⇒ le dernier grade, comme les fiches boss.
    const boundedIndex =
        activeGradeIndex !== null && activeGradeIndex >= 0 && activeGradeIndex < list.length
            ? activeGradeIndex
            : list.length - 1;
    const grade = boundedIndex >= 0 ? list[boundedIndex] : null;

    const resists = readGradeResists(grade) ?? EMPTY_GRADE_RESISTS;
    const combat = deriveGradeCombatStats(grade, grade?.carac);
    const power = toInteger(grade?.power);
    const heal = toInteger(grade?.healBonus);
    const initiative = combat.initiative;

    const hasSecondary =
        combat.apRemoval !== null || combat.mpRemoval !== null || (power ?? 0) > 0 || (heal ?? 0) > 0;
    const hasCombat =
        combat.tackle !== null ||
        combat.evade !== null ||
        combat.apDodge !== null ||
        combat.mpDodge !== null ||
        hasSecondary ||
        (initiative ?? 0) > 0;

    const cards = [
        { id: "hp", title: labels.hp, short: labels.hpShort, icon: STAT_ICONS.hp, value: grade?.lifePoints },
        { id: "ap", title: labels.ap, short: labels.ap, icon: STAT_ICONS.ap, value: grade?.actionPoints },
        { id: "mp", title: labels.mp, short: labels.mp, icon: STAT_ICONS.mp, value: grade?.movementPoints },
    ];
    const resistRows = [
        { key: "neutral", label: labels.neutral, icon: STAT_ICONS.resNeutral, value: resists.neutral },
        { key: "earth", label: labels.earth, icon: STAT_ICONS.resEarth, value: resists.earth },
        { key: "fire", label: labels.fire, icon: STAT_ICONS.resFire, value: resists.fire },
        { key: "water", label: labels.water, icon: STAT_ICONS.resWater, value: resists.water },
        { key: "air", label: labels.air, icon: STAT_ICONS.resAir, value: resists.air },
    ] as const;

    return (
        <div className="space-y-3">
            {/* PV / PA / PM — valeur plus compacte sous 640 px : « 100 000 » ne déborde pas. */}
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                {cards.map(({ id, title, short, icon, value }) => (
                    <div
                        key={id}
                        className="min-w-0 rounded-lg border border-border bg-surface/60 px-2 py-2 sm:px-3.5"
                        title={title}
                    >
                        <span className="flex items-baseline gap-1.5">
                            <img src={icon} alt="" className="h-4 w-4 shrink-0 self-center object-contain" />
                            <span className="font-mono text-sm font-semibold tabular-nums text-foreground sm:text-xl md:text-2xl">
                                {formatValue(value, numberLocale)}
                            </span>
                            <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
                                {short}
                            </span>
                        </span>
                    </div>
                ))}
            </div>

            <div className="rounded-lg border border-border bg-surface/60 px-3.5 py-2.5">
                <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">
                    {labels.resistance}
                </span>
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        {resistRows.map(({ key, label, icon, value }) => (
                            <span key={key} className="inline-flex items-center gap-1.5" title={`${label} %`}>
                                <img src={icon} alt="" className="h-4 w-4 object-contain" />
                                <span
                                    className={cn(
                                        "font-mono text-[13px] tabular-nums",
                                        typeof value === "number" && value < 0
                                            ? "text-danger"
                                            : "text-foreground/90",
                                    )}
                                >
                                    {typeof value === "number" ? `${value}%` : "—"}
                                </span>
                                <span className="hidden text-[11px] text-muted-foreground sm:inline">
                                    {label}
                                </span>
                            </span>
                        ))}
                    </div>

                    {list.length > 1 && onGradeChange && (
                        <div className="flex items-center gap-2">
                            <div className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background/70 p-0.5">
                                <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    {labels.rank}
                                </span>
                                {list.map((row, index) => (
                                    <button
                                        key={index}
                                        type="button"
                                        onClick={() => onGradeChange(index)}
                                        aria-pressed={index === boundedIndex}
                                        className={cn(
                                            "h-5 min-w-[22px] cursor-pointer rounded-[4px] px-1.5 font-mono text-[10px] transition-colors",
                                            index === boundedIndex
                                                ? "bg-foreground font-semibold text-background"
                                                : "text-muted-foreground hover:text-foreground",
                                        )}
                                        title={`${labels.rankWord} ${index + 1} · ${labels.levelShort} ${row?.level ?? "—"}`}
                                    >
                                        {index + 1}
                                    </button>
                                ))}
                            </div>
                            {onGradesOpen && (
                                <button
                                    type="button"
                                    onClick={onGradesOpen}
                                    className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                                    title={labels.openGrades}
                                    aria-label={labels.openGrades}
                                >
                                    <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {hasCombat && (
                <div className="space-y-2 rounded-lg border border-border bg-surface/40 p-2.5 font-mono text-[11px]">
                    <div className="grid grid-cols-4 gap-2">
                        <StatCell icon={STAT_ICONS.tackle} label={labels.tackle} value={combat.tackle} />
                        <StatCell icon={STAT_ICONS.evade} label={labels.evade} value={combat.evade} />
                        <StatCell icon={STAT_ICONS.apDodge} label={labels.apDodge} value={combat.apDodge} />
                        <StatCell icon={STAT_ICONS.mpDodge} label={labels.mpDodge} value={combat.mpDodge} />
                    </div>

                    {hasSecondary && (
                        <div className="grid grid-cols-4 gap-2 border-t border-border pt-1.5">
                            {combat.apRemoval !== null && (
                                <StatCell
                                    icon={STAT_ICONS.apRemoval}
                                    label={labels.apRemoval}
                                    value={combat.apRemoval}
                                />
                            )}
                            {combat.mpRemoval !== null && (
                                <StatCell
                                    icon={STAT_ICONS.mpRemoval}
                                    label={labels.mpRemoval}
                                    value={combat.mpRemoval}
                                />
                            )}
                            {(power ?? 0) > 0 && (
                                <StatCell icon={STAT_ICONS.power} label={labels.power} value={power} />
                            )}
                            {(heal ?? 0) > 0 && (
                                <StatCell icon={STAT_ICONS.heal} label={labels.heal} value={heal} />
                            )}
                        </div>
                    )}

                    {initiative !== null && initiative > 0 && (
                        <div className="flex items-center justify-between border-t border-border px-1 pt-1.5 text-[11px]">
                            <span className="flex items-center gap-1.5 font-sans text-muted-foreground">
                                <img src={STAT_ICONS.initiative} alt="" className="h-3.5 w-3.5 object-contain" />
                                {labels.initiative}
                            </span>
                            <span className="font-semibold tabular-nums text-foreground">
                                {initiative.toLocaleString(numberLocale)}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
