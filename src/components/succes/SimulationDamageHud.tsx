"use client";

/**
 * **Prévisu de dégâts** de la simulation tactique — panneau flottant posé DANS le plateau.
 *
 * 🎯 Retour user (22/09/2026, verbatim) : « regarde l'ui : c juste catastrophique les entiers on voit
 * rien au degat sur les autres · refais moi les bloc degat estime et le bloc placement toggle degat
 * estimé de 0 , je veux une composant ultra optimisé ui ux ».
 *
 *   · **« c juste catastrophique »** — la ligne « {count} cible(s) dans la zone » partageait SA ligne
 *     avec sa valeur : le libellé (long) et le total se chevauchaient à l'affichage
 *     (« 4 TARGET(S) IN THE 4348 ZONE (3743) »). Désormais : un libellé **tronquable** (`min-w-0
 *     flex-1 truncate`) et une valeur **jamais compressée** (`shrink-0 whitespace-nowrap`) ;
 *   · **« on voit rien au degat sur les autres »** — le panneau ne montrait qu'un **total agrégé**,
 *     sans dire QUI encaisse quoi. Il liste maintenant **chaque cible** de la zone (repère, cases
 *     d'éloignement, malus de zone, ses jets par élément corrigés) ;
 *   · **« degat estimé de 0 »** — plus de panneau muet : l'état vide dit **quoi faire** pour obtenir
 *     une valeur (poser un poutch, survoler une case en portée).
 *
 * 🔒 Aucune valeur inventée : les jets viennent du serveur (caractéristiques du monstre appliquées)
 * ou de `computeSpellDamage` (stuff) ; la seule transformation est la formule de zone, rappelée en
 * pied de panneau. Le composant **ne calcule aucun dégât** : il affiche les props.
 */

import { EyeOff, Move, Swords, Target, Users } from "lucide-react";
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

/** Une cible prise dans la zone d'effet : son repère, son éloignement et ses jets corrigés. */
export interface SimulationDamageHudTarget {
    /** Clé de case `x,y` (stable, jamais affichée). */
    key: string;
    /** Repère lisible (« Case visée », « Ennemi 2 »…) — jamais un identifiant technique. */
    label: string;
    /** Éloignement (cases du jeu) depuis la **case visée**. */
    offset: number;
    /** Part des dégâts conservée, en % (`60` = −40 % de perte). */
    falloff: number;
    lines: SpellDamageLine[];
    total: { min: number; max: number; critMin: number | null; critMax: number | null };
}

/** Identité du sort simulé (bandeau du panneau) — tout est optionnel. */
export interface SimulationDamageHudSpell {
    name: string;
    imageUrl?: string;
    apCost?: number;
    minRange?: number;
    maxRange?: number;
}

/**
 * **Anti-chevauchement des pastilles** de dégâts.
 *
 * 🎯 Retour user (22/09/2026, verbatim) : « regarde les bugs d'affichage superposé c bc trop laid ·
 * j'en ai par dessus la tête · une case vide visée ne doit rien afficher ».
 *
 * Les pastilles étaient posées **une par une** (`damageBadgePlacement`, bornée au cadre) : deux
 * cibles voisines pouvaient donc se recouvrir, et celle de la case visée recouvrait celle de
 * l'allié (défaut visible en capture). Ici la passe est **globale** et pure : chaque boîte garde son
 * placement nominal tant qu'elle ne touche personne, sinon elle **glisse vers le haut** (elle reste
 * au-dessus de sa case), et **vers le bas** seulement si le cadre est déjà plein — jamais dehors.
 */
export interface DamageBadgeInput {
    /** Clé stable de la cible (celle de `damageTargets`). */
    key: string;
    /** Position écran de la CASE visée par la pastille (source unique : `cellScreenPos`). */
    sx: number;
    sy: number;
    /** Boîte déduite du contenu (`damageBadgeWidth` + hauteur des lignes). */
    width: number;
    height: number;
}

export interface DamageBadgePlacement extends DamageBadgeInput {
    /** Coin haut-gauche RÉEL de la pastille (borné au cadre, sans chevauchement). */
    x: number;
    y: number;
    /** Posée au-dessus de sa case (sinon en dessous). */
    above: boolean;
    /** Décalage vertical appliqué par l'anti-chevauchement (0 = place nominale). */
    shifted: number;
}

export function damageBadgeLayout(
    boxes: DamageBadgeInput[],
    frame: { viewX: number; viewY: number; viewW: number; viewH: number },
    gap = 4
): DamageBadgePlacement[] {
    const laid: DamageBadgePlacement[] = boxes.map((box) => {
        const place = damageBadgePlacement({
            sx: box.sx,
            sy: box.sy,
            boxW: box.width,
            boxH: box.height,
            ...frame,
        });
        return { ...box, x: place.x, y: place.y, above: place.above, shifted: 0 };
    });

    /** Deux boîtes se touchent-elles (une `y` candidate pour `a`) ? */
    const overlaps = (a: DamageBadgePlacement, ay: number, b: DamageBadgePlacement) =>
        a.x < b.x + b.width + gap &&
        a.x + a.width + gap > b.x &&
        ay < b.y + b.height + gap &&
        ay + a.height + gap > b.y;

    // Pose de haut en bas : la pastille la plus haute garde sa place, les suivantes s'écartent.
    const placed: DamageBadgePlacement[] = [];
    for (const box of [...laid].sort((a, b) => a.y - b.y || a.x - b.x)) {
        let y = box.y;
        let guard = 0;
        while (guard++ < 32 && placed.some((p) => overlaps(box, y, p))) y -= box.height + gap;
        if (y < frame.viewY) {
            // Plus de place au-dessus : on redescend, en restant DANS le cadre.
            y = box.y;
            guard = 0;
            while (guard++ < 32 && placed.some((p) => overlaps(box, y, p))) y += box.height + gap;
            y = Math.max(frame.viewY, Math.min(y, frame.viewY + frame.viewH - box.height));
        }
        box.shifted = Math.round(y - box.y);
        box.y = y;
        placed.push(box);
    }

    return laid;
}

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
    /** Détail **par cible** (case visée + personnages touchés), source unique de la grille. */
    perTarget?: SimulationDamageHudTarget[];
    /** Sort simulé (icône + nom + PA/PO) — posé en tête du panneau quand il est fourni. */
    spell?: SimulationDamageHudSpell | null;
    /** Fermeture du panneau (l'option « Dégâts estimés » repasse à faux). */
    onClose?: () => void;
    /**
     * Classes du conteneur — permet de le poser **dans un rail** (modale plein écran) plutôt que
     * de le laisser flotter sur le plateau : `w-full max-h-none` remplace alors `w-60 max-h-full`
     * (mergé par `cn`, donc la dernière classe gagne). Aucune géométrie recopiée.
     */
    className?: string;
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

/** Le couple critique d'un total, sous la forme attendue par `damageRangeWithCrit`. */
function critPair(total: { critMin: number | null; critMax: number | null }): { min: number; max: number } | null {
    return total.critMin !== null && total.critMax !== null ? { min: total.critMin, max: total.critMax } : null;
}

/** Une ligne dessinée dans une pastille de dégâts (voir `damageBadgeWidth`). */
export interface DamageBadgeRow {
    text: string;
    /** Taille de police réelle de la ligne (px) — la largeur en dépend linéairement. */
    fontSize: number;
    /** Ligne précédée de l'icône d'élément (l'icône occupe 10 px, le texte démarre à 13 px). */
    icon?: boolean;
}

/** Largeur moyenne d'un chiffre/lettre en graisse 800–900, en em (mesurée sur « 59–98 »). */
const BADGE_CHAR_EM = 0.62;
/** Marge interne de la pastille, de chaque côté (px). */
const BADGE_PADDING_X = 6;
/** Départ du texte d'une ligne à icône : icône de 10 px + 3 px d'écart (px). */
const BADGE_ICON_X = 13;
/** Plancher visuel : plus étroite que la tuile, la pastille paraît vide. */
export const DAMAGE_BADGE_MIN_WIDTH = 78;

/**
 * Largeur d'une **pastille de dégâts** (badge posé sur une case), **déduite de son contenu**.
 *
 * 🔁 22/09/2026 — retour user « les dégâts affichés sortent du composant ». La boîte avait une
 * largeur **figée** (78 px, 104 px dès qu'un jet critique existait) : c'était un pari implicite sur
 * la longueur du texte, qui va pourtant de « 59–98 » (5 caractères à 12 px) à
 * « CC 4348–4521 » (12). Trop étroite, la ligne déborde de la pastille ; trop large, la pastille
 * masque les cases voisines pour rien. La largeur suit maintenant la plus longue ligne
 * **réellement dessinée** (plancher `DAMAGE_BADGE_MIN_WIDTH` compris) : elle ne peut plus déborder.
 *
 * Règle pure (aucun IO) : testable sans navigateur, et **source unique** de la géométrie du badge.
 */
export function damageBadgeWidth(rows: DamageBadgeRow[]): number {
    const textPx = (row: DamageBadgeRow) => Math.round(String(row.text || "").length * row.fontSize * BADGE_CHAR_EM);
    /** Lignes centrées dans la boîte : repère de cible, total, dégressivité, coup critique. */
    const centered = rows.filter((row) => !row.icon).reduce((max, row) => Math.max(max, textPx(row)), 0);
    /** Lignes à icône : un jet par élément (icône 10 px, texte à x = 13). */
    const withIcon = rows.filter((row) => row.icon).reduce((max, row) => Math.max(max, BADGE_ICON_X + textPx(row)), 0);
    return Math.max(DAMAGE_BADGE_MIN_WIDTH, centered + BADGE_PADDING_X * 2, withIcon + BADGE_PADDING_X);
}

/** Écart entre la case et sa pastille (px) — la pastille ne doit pas toucher le personnage. */
const BADGE_GAP = 26;
/** Marge de sécurité contre le bord du cadre (px). */
const BADGE_FRAME_MARGIN = 4;

/**
 * Position d'une pastille **dans le repère du plateau**, toujours **à l'intérieur du cadre**.
 *
 * 🔁 22/09/2026 — retour user « les dégâts affichés sortent du composant ». La pastille était posée
 * **systématiquement au-dessus** de sa case (`sy - 26 - hauteur`), et le SVG rogne tout ce qui sort
 * de son `viewBox`. **Mesure** (plateau réel « Cache de Kankreblath », `viewBox = -36 -36 964 692`,
 * relevé par sonde navigateur) : une case de la première ligne a `sy ≈ 16` ⇒ l'ancienne formule
 * donnait `y = 16 - 26 - 66 = -76`, soit **40 px au-dessus du bord haut du cadre** : la pastille
 * était coupée. Deux règles, désormais mesurables :
 *   · au-dessus de la case **s'il y a la place**, en dessous sinon ;
 *   · recentrée sur les bords gauche/droite pour rester **entièrement dans le cadre**.
 *
 * Règle pure (aucun IO / aucun rendu) : testable sans navigateur.
 */
export function damageBadgePlacement(input: {
    /** Centre de la case (repère du plateau, en px). */
    sx: number;
    sy: number;
    /** Boîte de la pastille (`damageBadgeWidth` × hauteur du contenu). */
    boxW: number;
    boxH: number;
    /** Cadre visible du plateau (`viewBox` du SVG). */
    viewX: number;
    viewY: number;
    viewW: number;
    viewH: number;
}): { x: number; y: number; above: boolean } {
    const clamp = (value: number, min: number, max: number) => (max < min ? value : Math.min(Math.max(value, min), max));
    const above = input.sy - BADGE_GAP - input.boxH >= input.viewY + BADGE_FRAME_MARGIN;
    const y = above ? input.sy - BADGE_GAP - input.boxH : input.sy + BADGE_GAP;
    return {
        x: clamp(
            input.sx - input.boxW / 2,
            input.viewX + BADGE_FRAME_MARGIN,
            input.viewX + input.viewW - input.boxW - BADGE_FRAME_MARGIN
        ),
        y: clamp(y, input.viewY + BADGE_FRAME_MARGIN, input.viewY + input.viewH - input.boxH - BADGE_FRAME_MARGIN),
        above,
    };
}

/** Portée lisible du sort (« 1 à 8 PO », « 3 PO ») — même convention que le bandeau de la grille. */
function rangeLabel(spell: SimulationDamageHudSpell): string | null {
    const max = Number(spell.maxRange) || 0;
    if (max <= 0) return null;
    const min = Math.max(0, Number(spell.minRange) || 0);
    return min === max ? `${max} PO` : `${min} à ${max} PO`;
}

export function SimulationDamageHud({
    lines,
    total,
    push,
    targets,
    damageTakenPercent = 0,
    variant = "board",
    perTarget = [],
    spell = null,
    onClose,
    className,
}: SimulationDamageHudProps) {
    const { t } = useI18n();
    const simT = t.tacticalSim;
    const isBoard = variant === "board";

    const rowLabel = cn("text-[10px] font-bold uppercase tracking-[0.12em]", isBoard ? "text-zinc-500" : "text-muted-foreground");
    const valueLabel = cn("shrink-0 whitespace-nowrap text-[11px] font-black tabular-nums", isBoard ? "text-white" : "text-foreground");
    const rowText = cn("min-w-0 flex-1 truncate text-[10px] font-bold", isBoard ? "text-zinc-300" : "text-foreground");
    const section = cn(
        "flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.14em]",
        isBoard ? "text-zinc-500" : "text-muted-foreground"
    );
    const divider = cn("border-t", isBoard ? "border-white/10" : "border-border");
    /** Trame commune : le libellé se tronque, **la valeur ne bouge jamais** (bug corrigé). */
    const row = "flex min-w-0 items-baseline justify-between gap-2";
    /** Barre de défilement fine dans les deux palettes (le panneau est borné en hauteur). */
    const scroll = "[scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.18)_transparent]";

    return (
        <div
            className={cn(
                // ⚠️ Le panneau est borné par son **conteneur** (le plateau), jamais par la fenêtre :
                // `max-h-[min(58vh,24rem)]` le laissait atteindre 384 px alors qu'une grille libre
                // 17×17 n'en fait que ~370 ⇒ il **sortait de la carte du plateau** (et se faisait
                // rogner dans la fenêtre de jeu, dont le plateau est en `overflow-hidden`).
                // `max-h-full` le garde DANS le plateau, `w-60 max-w-full min-w-0` l'empêche de
                // sortir par la droite, `ml-auto` le recolle à droite même quand la rangée se replie.
                "pointer-events-auto ml-auto w-60 min-w-0 max-w-full space-y-1.5 overflow-y-auto rounded-xl border p-2 shadow-xl",
                "max-h-full",
                isBoard ? "border-white/15 bg-[#121218]/95 backdrop-blur-md" : "border-border bg-popover",
                scroll,
                className
            )}
        >
            {/* En-tête : identité du panneau + fermeture (l'option « Dégâts estimés » repasse à faux). */}
            <div className="flex min-w-0 items-center justify-between gap-2">
                <p
                    className={cn(
                        "flex min-w-0 items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em]",
                        isBoard ? "text-zinc-400" : "text-muted-foreground"
                    )}
                >
                    <Swords className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{simT.damageHudTitle}</span>
                </p>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        title={simT.damageHudClose}
                        aria-label={simT.damageHudClose}
                        className={cn(
                            "shrink-0 cursor-pointer rounded-md p-0.5 transition-colors",
                            isBoard ? "text-zinc-400 hover:text-white" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                )}
            </div>

            {/* Le sort simulé en tête : on sait TOUJOURS de quels jets on parle. */}
            {spell && (
                <div
                    className={cn(
                        "flex min-w-0 items-center gap-1.5 rounded-lg border px-1.5 py-1",
                        isBoard ? "border-white/10 bg-white/[0.04]" : "border-border bg-surface"
                    )}
                >
                    {spell.imageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={spell.imageUrl} alt="" className="h-4 w-4 shrink-0 rounded-[3px] object-contain" />
                    ) : (
                        <Swords className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
                    )}
                    <span
                        className={cn("min-w-0 flex-1 truncate text-[11px] font-bold", isBoard ? "text-zinc-100" : "text-foreground")}
                        title={spell.name}
                    >
                        {spell.name}
                    </span>
                    <span
                        className={cn(
                            "shrink-0 whitespace-nowrap text-[10px] font-bold tabular-nums",
                            isBoard ? "text-zinc-400" : "text-muted-foreground"
                        )}
                    >
                        {[spell.apCost ? `${spell.apCost} PA` : null, rangeLabel(spell)].filter(Boolean).join(" · ")}
                    </span>
                </div>
            )}

            {/* Section ① — les jets RÉELS du sort, un par élément (icône + couleur du jeu). */}
            <p className={section}>{simT.damageHudElements}</p>
            {lines.map((line) => {
                const theme = STAT_THEMES[ELEMENT_STAT_KEY[line.element]];
                return (
                    <div key={line.element} className="flex min-w-0 items-center gap-1.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`${DOFUS_STAT_ASSET_BASE}/${theme.asset}`} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />
                        <span className={rowText} title={theme.label}>
                            {theme.label}
                        </span>
                        <span
                            className="shrink-0 whitespace-nowrap text-[11px] font-black tabular-nums"
                            style={{ color: dofusStatHex(theme.asset) }}
                        >
                            {damageRangeWithCrit(line, line.crit)}
                        </span>
                    </div>
                );
            })}

            {/* Section ② — QUI encaisse quoi : une ligne par cible de la zone (repère, malus, jets). */}
            <div className={cn("space-y-1 pt-1.5", divider)}>
                <p className={section}>
                    <Target className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {simT.damageHudBreakdown}
                </p>
                {perTarget.length === 0 ? (
                    <p className={cn("text-[10px] leading-snug", isBoard ? "text-zinc-500" : "text-muted-foreground")}>
                        {simT.damageHudEmpty}
                    </p>
                ) : (
                    perTarget.map((target) => (
                        <div key={target.key} className={row}>
                            <span
                                className={rowText}
                                title={`${target.label} · ${simT.damageOffsetShort.replace("{count}", String(target.offset))}`}
                            >
                                {target.label}
                            </span>
                            {target.falloff < 100 && (
                                <span className="shrink-0 whitespace-nowrap rounded bg-amber-500/20 px-1 text-[9px] font-black tabular-nums text-amber-300">
                                    {simT.damageFalloffShort.replace("{percent}", String(100 - target.falloff))}
                                </span>
                            )}
                            <span className={valueLabel}>{damageRangeWithCrit(target.total, critPair(target.total))}</span>
                        </div>
                    ))
                )}
            </div>

            {/* Section ③ — les totaux : la cible sur la case visée, puis la somme réelle de la zone. */}
            <div className={cn("space-y-1 pt-1.5", divider)}>
                <div className={row}>
                    <span className={rowLabel}>{simT.damageHudPerTarget}</span>
                    <span className={valueLabel}>{damageRangeWithCrit(total, critPair(total))}</span>
                </div>

                <div className={row}>
                    <span className={cn(rowLabel, "flex min-w-0 items-center gap-1")}>
                        <Users className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">{simT.damageHudTargets.replace("{count}", String(targets.count))}</span>
                    </span>
                    <span
                        className={cn(
                            valueLabel,
                            targets.count === 0 && (isBoard ? "text-zinc-500" : "text-muted-foreground")
                        )}
                    >
                        {damageRangeWithCrit(targets.total, critPair(targets.total))}
                    </span>
                </div>

                {damageTakenPercent > 0 && (
                    <div className={row}>
                        <span className={rowLabel}>{simT.damageHudTakenLabel}</span>
                        <span className={cn(valueLabel, isBoard ? "text-amber-300" : "text-warning")}>
                            {simT.damageHudTaken.replace("{percent}", String(damageTakenPercent))}
                        </span>
                    </div>
                )}

                {push !== null && (
                    <div className="flex min-w-0 items-center gap-1.5">
                        <Move className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className={cn("text-[11px] font-bold", isBoard ? "text-zinc-300" : "text-foreground")}>
                            {simT.damagePush.replace("{count}", String(push))}
                        </span>
                    </div>
                )}
            </div>

            <p className={cn("text-[9px] leading-tight", isBoard ? "text-zinc-500" : "text-muted-foreground")}>
                {simT.damageHudCritNote}
            </p>
            <p className={cn("text-[9px] leading-tight", isBoard ? "text-zinc-500" : "text-muted-foreground")}>
                {simT.damageHudRule}
            </p>
        </div>
    );
}
