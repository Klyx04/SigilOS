/**
 * Solveur Comte Harebourg — gestion des invocations et du strip (pur, testé).
 *
 * Source des règles : mécaniques documentées (guides + fiche boss interne) —
 * AUCUNE donnée inventée, aucun appel réseau, aucun état caché :
 * - tours pairs : frapper le Comte le téléporte symétriquement (180°) par
 *   rapport à l'attaquant ; s'il atterrit sur une entité → échange de place
 *   et perte de l'invulnérabilité ; l'allié échangé gagne +100 dommages (1 tour) ;
 * - tours impairs : c'est l'ATTAQUANT qui tourne (pas de vulnérabilité) ;
 * - échange avec une invocation alliée : tous les alliés à 3 cases ou moins de
 *   la position INITIALE du Comte meurent ;
 * - arrivée impossible (mur / hors carte) : toute l'équipe meurt ;
 * - glyphe Mi-temps : croix de taille 3 autour de la case de début de tour du
 *   Comte, centre inclus (depuis la 3.5) — commencer son tour dedans = OS ;
 * - confusions : les sorts sont redirigés de 90/180/270° ; +90° antihoraire par
 *   ligne de dégâts au corps-à-corps ; les invocations contrôlées n'en subissent pas.
 *
 * Distances en Manhattan sur coordonnées {x, y} : approximation assumée (la
 * métrique exacte vit dans les données de map — suivi map-précis prévu).
 */

export interface GridCell {
    x: number;
    y: number;
}

export type HarebourgEntityKind = "ally" | "summon" | "enemy";

export interface HarebourgEntity {
    id: string;
    cell: GridCell;
    kind: HarebourgEntityKind;
}

export type RotationDirection = "clockwise" | "counterclockwise";
export type ConfusionAngle = 90 | 180 | 270;

export function sameCell(a: GridCell, b: GridCell): boolean {
    return a.x === b.x && a.y === b.y;
}

export function manhattan(a: GridCell, b: GridCell): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Symétrie centrale (180°) d'un point par rapport à un centre.
 * Sert aux rotations pair/impair autour du Comte.
 */
export function symmetricOf(point: GridCell, center: GridCell): GridCell {
    return { x: 2 * center.x - point.x, y: 2 * center.y - point.y };
}

/**
 * Cases mortelles du glyphe Mi-temps : croix de rayon 3 autour de la case de
 * début de tour du Comte, centre inclus. Commencer son tour dedans = OS.
 */
export function glyphDangerCells(bossStartCell: GridCell, radius = 3): GridCell[] {
    const cells: GridCell[] = [];
    for (let d = -radius; d <= radius; d++) {
        cells.push({ x: bossStartCell.x + d, y: bossStartCell.y });
        if (d !== 0) cells.push({ x: bossStartCell.x, y: bossStartCell.y + d });
    }
    return cells;
}

/**
 * Applique une confusion (rotation) à une case visée, autour du lanceur.
 * Les invocations contrôlées ignorent la confusion (ne pas appeler pour elles).
 */
export function applyConfusion(
    aimed: GridCell,
    caster: GridCell,
    degrees: ConfusionAngle,
    direction: RotationDirection
): GridCell {
    const dx = aimed.x - caster.x;
    const dy = aimed.y - caster.y;
    const turns = degrees / 90;
    // Sens horaire en repère écran (y vers le bas) : (dx, dy) -> (-dy, dx).
    const step = direction === "clockwise"
        ? (vx: number, vy: number): [number, number] => [-vy, vx]
        : (vx: number, vy: number): [number, number] => [vy, -vx];
    let [vx, vy] = [dx, dy];
    for (let i = 0; i < turns; i++) [vx, vy] = step(vx, vy);
    return { x: caster.x + vx, y: caster.y + vy };
}

/**
 * Dérive de confusion au corps-à-corps : +90° antihoraire PAR ligne de
 * dégâts infligée au contact. Rend l'angle cumulé (modulo 360, 0 = aucune).
 */
export function meleeConfusionDrift(linesDealt: number): 0 | 90 | 180 | 270 {
    return ((linesDealt * 90) % 360) as 0 | 90 | 180 | 270;
}

export interface StripPlanInput {
    /** Case du Comte au moment de la frappe. */
    bossCell: GridCell;
    /** Case de l'attaquant au moment de la frappe. */
    attackerCell: GridCell;
    /** Numéro du tour (1 = premier tour). */
    turnNumber: number;
    /** Entités présentes (l'attaquant et le Comte sont gérés à part). */
    entities: HarebourgEntity[];
    /** Cases d'arrivée impossibles (murs, bords) : y atterrir tue l'équipe. */
    blockedCells: GridCell[];
}

export interface StripPlan {
    /** Tour pair : seul cas où frapper peut lever l'invulnérabilité. */
    isEvenTurn: boolean;
    /** Case d'arrivée calculée (attaquant si impair, Comte si pair). */
    landing: GridCell;
    /** Entité présente sur la case d'arrivée (échange potentiel). */
    swapEntity?: HarebourgEntity;
    /** L'échange lève l'invulnérabilité (tour pair + entité sur l'arrivée). */
    stripsInvulnerability: boolean;
    /** +100 dommages : échange pair avec un ALLIÉ (personnage, pas invocation). */
    allyDamageBonus: boolean;
    /** Alliés (personnages ET invocations) tués si l'échange se fait avec une invocation. */
    killZoneAllies: HarebourgEntity[];
    /** Arrivée impossible : toute l'équipe meurt (« Air du Temps »). */
    teamWipeRisk: boolean;
    /** Verdict lisible pour l'interface. */
    verdict: string;
}

/**
 * Plan de frappe du Comte : où atterrit-on, échange-t-on, que risque-t-on ?
 * Ne joue jamais à la place du joueur : il valide un coup envisagé.
 */
export function planVulnerabilityStrip(input: StripPlanInput): StripPlan {
    const isEvenTurn = input.turnNumber % 2 === 0;
    const landing = isEvenTurn
        ? symmetricOf(input.attackerCell, input.bossCell)
        : symmetricOf(input.bossCell, input.attackerCell);
    const swapEntity = isEvenTurn
        ? input.entities.find((e) => sameCell(e.cell, landing))
        : undefined;
    const teamWipeRisk = input.blockedCells.some((c) => sameCell(c, landing));
    const stripsInvulnerability = isEvenTurn && !!swapEntity && !teamWipeRisk;
    const allyDamageBonus = stripsInvulnerability && swapEntity?.kind === "ally";
    const killZoneAllies =
        stripsInvulnerability && swapEntity?.kind === "summon"
            ? input.entities.filter(
                  (e) =>
                      (e.kind === "ally" || e.kind === "summon") &&
                      manhattan(e.cell, input.bossCell) <= 3
              )
            : [];

    let verdict: string;
    if (teamWipeRisk) {
        verdict = "Arrivée impossible : toute l'équipe meurt. Ne frappez pas d'ici.";
    } else if (!isEvenTurn) {
        verdict = "Tour impair : c'est vous qui tournez, le Comte reste invulnérable.";
    } else if (!swapEntity) {
        verdict = "Tour pair mais case d'arrivée vide : le Comte se déplace sans échanger, il reste invulnérable.";
    } else if (swapEntity.kind === "summon" && killZoneAllies.length > 0) {
        verdict = `Échange avec une invocation : ${killZoneAllies.length} allié(s) à 3 cases ou moins du Comte meurent. Éloignez-les d'abord.`;
    } else if (swapEntity.kind === "summon") {
        verdict = "Échange avec une invocation isolée : invulnérabilité levée, sans perte alliée.";
    } else if (swapEntity.kind === "ally") {
        verdict = "Échange avec un allié : invulnérabilité levée et +100 dommages pour lui ce tour.";
    } else {
        verdict = "Échange avec un ennemi : invulnérabilité levée.";
    }

    return {
        isEvenTurn,
        landing,
        swapEntity,
        stripsInvulnerability,
        allyDamageBonus,
        killZoneAllies,
        teamWipeRisk,
        verdict,
    };
}

export type SummonPurpose = "strip" | "bait" | "block";

export interface SummonPlacementInput {
    candidate: GridCell;
    bossCell: GridCell;
    turnNumber: number;
    allies: HarebourgEntity[];
    occupiedCells: GridCell[];
    purpose: SummonPurpose;
}

export interface SummonPlacementScore {
    score: number;
    safe: boolean;
    notes: string[];
}

/**
 * Score un emplacement d'invocation (0-100) selon son usage :
 * - strip : sur la case d'arrivée d'un échange pair, isolée (alliés hors zone 3) ;
 * - bait : à distance du Comte pour l'occuper (IA agressive, 5 PM), hors glyphe ;
 * - block : au contact d'un gêneur (Cycloïde…), hors glyphe.
 * `occupiedCells` = cases impraticables/occupées connues du joueur (murs, entités).
 */
export function scoreSummonPlacement(input: SummonPlacementInput): SummonPlacementScore {
    const notes: string[] = [];
    let score = 50;

    if (input.occupiedCells.some((c) => sameCell(c, input.candidate))) {
        return { score: 0, safe: false, notes: ["Case occupée ou impraticable."] };
    }

    const glyph = glyphDangerCells(input.bossCell);
    if (glyph.some((c) => sameCell(c, input.candidate))) {
        score -= 40;
        notes.push("Dans le glyphe Mi-temps : l'invocation y commence son tour = morte.");
    }

    const alliesInKillZone = input.allies.filter(
        (a) => manhattan(a.cell, input.bossCell) <= 3
    );

    if (input.purpose === "strip") {
        if (input.turnNumber % 2 !== 0) {
            score -= 30;
            notes.push("Tour impair : aucun échange vulnérabilisant possible.");
        } else {
            score += 20;
            notes.push("Tour pair : échange possible si le Comte atterrit ici.");
        }
        if (alliesInKillZone.length > 0) {
            score -= 15 * alliesInKillZone.length;
            notes.push(
                `${alliesInKillZone.length} allié(s) dans la zone létale (3 cases du Comte) en cas d'échange avec une invocation.`
            );
        } else {
            score += 10;
            notes.push("Zone létale vide : échange sans perte alliée.");
        }
    }

    if (input.purpose === "bait") {
        const dist = manhattan(input.candidate, input.bossCell);
        if (dist <= 4) {
            score += 15;
            notes.push("À portée du Comte : il dépensera ses PM dessus.");
        } else if (dist <= 7) {
            score += 5;
            notes.push("À distance d'appât : il avancera vers elle.");
        } else {
            score -= 10;
            notes.push("Trop loin : le Comte l'ignorera.");
        }
    }

    if (input.purpose === "block") {
        score += 10;
        notes.push("Au contact du gêneur : le bloque ou attire ses coups.");
    }

    // Les invocations ignorent la confusion : bonus structurel, pas de malus.
    score += 5;
    notes.push("Rappel : vos invocations ignorent la confusion.");

    const clamped = Math.max(0, Math.min(100, score));
    return { score: clamped, safe: clamped >= 40, notes };
}
