"use client";

/**
 * **Prévisu de dégâts** de la simulation tactique — panneau flottant posé DANS le plateau.
 *
 * 🎯 Valeur ajoutée (retour user 21/09/2026) : « estime damage mais que c'est nul ! » — l'ancien
 * affichage se limitait à une fourchette collée au-dessus de chaque cible, sans dire **d'où** elle
 * vient ni ce que la **dégressivité de zone** retire. Ici on montre les trois niveaux qui servent
 * à décider en combat :
 *   ① les jets réels du sort, **par élément** (icône + couleur du jeu) ;
 *   ② le total **par cible à la case visée** (aucun malus) ;
 *   ③ le total **réellement infligé sur la zone** : la somme des cibles corrigée par la règle du
 *      jeu `dégâts × (10 − éloignement)/10` (chaque badge de la grille porte sa propre valeur).
 *
 * ⚠️ Aucune valeur inventée : les jets viennent du serveur (caractéristiques du monstre appliquées),
 * la seule transformation est la formule de zone, rappelée en pied de panneau.
 */

import { Move, Swords, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";
import { formatDamageRange, type SpellDamageLine, type SpellElementKey } from "@/lib/dofus-spells";
import { DOFUS_STAT_ASSET_BASE, STAT_THEMES, dofusStatHex } from "@/lib/dofus-stats-theme";

/** Élément → entrée du thème de stats (icône locale + couleur réelle du jeu). */
const ELEMENT_STAT_KEY: Record<SpellElementKey, keyof typeof STAT_THEMES> = {
    terre: "earthDamage",
    feu: "fireDamage",
    eau: "waterDamage",
    air: "airDamage",
    neutre: "neutralDamage",
};

interface SimulationDamageHudProps {
    /** Lignes de dégâts du sort, telles que servies par le serveur (une par élément). */
    lines: SpellDamageLine[];
    /** Total des lignes, sans aucun malus (la cible est sur la case visée). */
    total: { min: number; max: number; critMin: number | null; critMax: number | null };
    /** Distance de poussée éventuelle (cases) — affichée telle quelle, jamais convertie. */
    push: number | null;
    /** Cibles prises dans la zone d'effet + le total **dégressif** qu'elles encaissent. */
    targets: {
        count: number;
        total: { min: number; max: number; critMin: number | null; critMax: number | null };
    };
    /** `% Dommages subis` cumulés (boosts/malus de cible) — `0` quand aucun. */
    damageTakenPercent?: number;
    /** `board` = posé sur le plateau (palette de jeu) · `page` = surface thémée. */
    variant?: "board" | "page";
}

/**
 * Jet **normal**, suivi de son jet **critique** entre parenthèses quand la source en publie un —
 * exactement la forme de l'infobulle du jeu : `146 – 158 (248 – 259)`.
 */
export function damageRangeWithCrit(
    range: { min: number; max: number },
    crit?: { min: number; max: number } | null
): string {
    const normal = formatDamageRange(range.min, range.max);
    return crit ? `${normal} (${formatDamageRange(crit.min, crit.max)})` : normal;
}

export function SimulationDamageHud({
    lines,
    total,
    push,
    targets,
    damageTakenPercent = 0,
    variant = "board",
}: SimulationDamageHudProps) {
    const { t } = useI18n();
    const simT = t.tacticalSim;
    const isBoard = variant === "board";

    const rowLabel = cn("text-[10px] font-bold uppercase tracking-[0.12em]", isBoard ? "text-zinc-500" : "text-muted-foreground");
    const valueLabel = cn("text-[11px] font-black tabular-nums", isBoard ? "text-white" : "text-foreground");

    return (
        <div
            className={cn(
                "pointer-events-auto w-[13.5rem] space-y-1.5 rounded-xl border p-2 shadow-xl",
                isBoard ? "border-white/15 bg-[#121218]/95 backdrop-blur-md" : "border-border bg-popover"
            )}
        >
            <p className={cn("flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em]", isBoard ? "text-zinc-400" : "text-muted-foreground")}>
                <Swords className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {simT.damageHudTitle}
            </p>

            {lines.map((line) => {
                const theme = STAT_THEMES[ELEMENT_STAT_KEY[line.element]];
                return (
                    <div key={line.element} className="flex items-center gap-1.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`${DOFUS_STAT_ASSET_BASE}/${theme.asset}`} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />
                        <span className={cn("min-w-0 flex-1 truncate text-[11px] font-bold", isBoard ? "text-zinc-300" : "text-foreground")}>
                            {theme.label}
                        </span>
                        <span className="text-[11px] font-black tabular-nums" style={{ color: dofusStatHex(theme.asset) }}>
                            {damageRangeWithCrit(line, line.crit)}
                        </span>
                    </div>
                );
            })}

            <div className={cn("flex items-center justify-between gap-2 border-t pt-1.5", isBoard ? "border-white/10" : "border-border")}>
                <span className={rowLabel}>{simT.damageHudPerTarget}</span>
                <span className={valueLabel}>
                    {damageRangeWithCrit(
                        total,
                        total.critMin !== null && total.critMax !== null
                            ? { min: total.critMin, max: total.critMax }
                            : null
                    )}
                </span>
            </div>

            <div className={cn("flex items-center justify-between gap-2", isBoard ? "text-zinc-400" : "text-muted-foreground")}>
                <span className={cn(rowLabel, "flex items-center gap-1")}>
                    <Users className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {simT.damageHudTargets.replace("{count}", String(targets.count))}
                </span>
                <span className={cn(valueLabel, targets.count === 0 && (isBoard ? "text-zinc-500" : "text-muted-foreground"))}>
                    {damageRangeWithCrit(
                        targets.total,
                        targets.total.critMin !== null && targets.total.critMax !== null
                            ? { min: targets.total.critMin, max: targets.total.critMax }
                            : null
                    )}
                </span>
            </div>

            {damageTakenPercent > 0 && (
                <div className={cn("flex items-center justify-between gap-2", isBoard ? "text-amber-300" : "text-warning")}>
                    <span className={rowLabel}>{simT.damageHudTakenLabel}</span>
                    <span className={cn(valueLabel, isBoard ? "text-amber-300" : "text-warning")}>
                        {simT.damageHudTaken.replace("{percent}", String(damageTakenPercent))}
                    </span>
                </div>
            )}

            {push !== null && (
                <div className={cn("flex items-center gap-1.5", isBoard ? "text-zinc-300" : "text-foreground")}>
                    <Move className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="text-[11px] font-bold">{simT.damagePush.replace("{count}", String(push))}</span>
                </div>
            )}

            <p className={cn("text-[9px] leading-tight", isBoard ? "text-zinc-500" : "text-muted-foreground")}>
                {simT.damageHudCritNote}
            </p>
            <p className={cn("text-[9px] leading-tight", isBoard ? "text-zinc-500" : "text-muted-foreground")}>
                {simT.damageHudRule}
            </p>
        </div>
    );
}
