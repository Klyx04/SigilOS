/**
 * Référentiel des effets passifs officiels des Dofus et objets spéciaux.
 * Éradique complètement l'affichage de slop brut Dofusbook (ex: "sp 6828-1").
 */

export const DOFUS_PASSIVES: Record<string, string> = {
    "dofus abyssal":
        "Au début du tour : confère 1 PM si aucun ennemi n'est en ligne de vue à 4 cases ou moins, sinon confère 1 PA pendant 1 tour.",
    "dofus ivoire":
        "En début de tour, confère l'effet « Réduction des dommages » (50%). Cet effet est consommé dès la première attaque subie.",
    "dofus ebene":
        "À la fin du tour, confère 1 charge d'Ébène (max 5). Au début du tour, si 5 charges sont atteintes, la prochaine attaque directe applique un poison sur la cible pendant 3 tours.",
    "dofus nebuleux":
        "Aux tours impairs : confère 20% de dommages finaux. Aux tours pairs : retire 10% de dommages finaux.",
    "dofus emeraude":
        "À la fin du tour, confère 10% des PV max en bouclier pour chaque ennemi au contact (cumulable jusqu'à 20%).",
    "dofus pourpre":
        "Lorsque le porteur subit des dommages à distance, ses dommages finaux sont augmentés de 1% pendant 1 tour (cumulable 20 fois).",
    "dofus turquoise":
        "Lors d'un Coup Critique, augmente les dommages finaux de 1% pendant 3 tours (cumulable 10 fois). Si un échec critique est évité, augmente les dommages de 5%.",
    "dofus argente":
        "En fin de tour, si les points de vie sont inférieurs à 20%, soigne 20% des PV max et confère 20% de résistance pendant 1 tour (1 fois par combat).",
    "dofus argente scintillant":
        "En fin de tour, si les points de vie sont inférieurs à 20%, soigne 40% des PV max et confère 20% de résistance pendant 1 tour (1 fois par combat).",
    "dofus forgelave":
        "Lorsque le porteur est déplacé par une poussée, une attirance ou un échange de position, confère 150 points de bouclier pendant 1 tour.",
    "dofus tachete":
        "En début de tour, soigne le porteur et les alliés proches selon les altérations subies.",
    "dofus cauchemar":
        "À chaque début de tour, confère de la puissance et du bouclier selon la proximité des ennemis.",
    "dofus sylvestre":
        "À la fin du tour, applique l'effet Sylvestre augmentant les résistances ou soignant les alliés.",
    "dofus des glaces":
        "Confère 25 Dommages Fixes dans tous les éléments (Neutre, Terre, Feu, Eau, Air).",
    "dofus ocre":
        "Confère 1 Point d'Action (PA) permanent.",
    "dofus vulbis":
        "Confère 1 Point de Mouvement (PM) permanent. À la fin du tour, si aucun dommage n'a été subi, augmente les dommages finaux de 10% pendant 1 tour.",
    "dofus des veilleurs":
        "En début de tour, soigne de 7% de leurs PV max les alliés situés en ligne ou en diagonale avec le porteur.",
    "dofus dolmanax":
        "Confère 50 Force, 50 Intelligence, 50 Chance et 50 Agilité.",
    "dofus dokoko":
        "Au début du combat puis tous les 4 tours : soigne 25% des PV max.",
    "dofus domakuro":
        "Au début des 5 premiers tours de jeu, confère 16 à 20 Dommages Fixes cumulables.",
    "dofus cawotte":
        "Confère 60 Sagesse.",
    "dofus kaliptus":
        "Confère de 6 à 30 Prospection.",
};

/**
 * Normalise une chaîne pour recherche tolérante (sans accents ni ponctuation).
 */
function normalizeKey(str: string): string {
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Récupère la description passive authentique d'un Dofus ou équipement légendaire.
 */
export function getPassiveDescription(itemName: string): string | null {
    if (!itemName) return null;
    const clean = normalizeKey(itemName);

    for (const [key, desc] of Object.entries(DOFUS_PASSIVES)) {
        if (clean.includes(key) || key.includes(clean)) {
            return desc;
        }
    }

    if (clean.includes("prysmaradite") || clean.includes("prysmarune")) {
        return "Effet tactique déclenché lors du premier tour de combat.";
    }

    return null;
}
