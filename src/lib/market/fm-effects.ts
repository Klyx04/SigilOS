/**
 * Module « Marché » — **référentiel FM** (Forge de Magie), versionné (S2.12).
 *
 * ⚠️ Fichier **PUR** (aucune dépendance React / Prisma) → importable côté client.
 *
 * 🎯 Rôle : décrire la **Forge de Magie** indépendamment du snapshot catalogue
 * DofusDB. DofusDB donne les *jets natifs* d'un objet (`GameItem.nativeEffects`),
 * mais **ne connaît pas** les densités, les runes, le plafond de 101, ni ce qui
 * est forgeable — ces données sont **communautaires** (affichées en jeu sur
 * chaque rune) et doivent donc être maintenues **à la main dans ce fichier**.
 *
 * Règles fondatrices respectées :
 * - D34/D35 : un `OVER` ou un `EXO` n'est **jamais** refusé, seulement étiqueté ;
 * - D17 : la classification affichée ici est une **aide visuelle** — la valeur
 *   de référence reste recalculée côté serveur (`computeStatQuality`) ;
 * - le plafond de densité supplémentaire ajoutable à un objet est de **101**,
 *   partagé entre overs et exos (ex. un exo PM = 90 → il reste 11 → +55 Vitalité).
 *
 * 📌 Toute modification de densité doit être **revue ligne par ligne** : c'est
 * la seule source de vérité du calcul `maxOver` (jamais dérivé de DofusDB).
 */

import { isPlaceholderStatLabel } from "./effects";

/** Plafond de densité **supplémentaire** ajoutable à un objet (règle FM). */
export const FM_DENSITY_CAP = 101;

/**
 * Clés techniques des lignes FM. Elles sont **stables** et servent de pont entre
 * le référentiel, l'éditeur de jet et l'affichage (jamais persistées telles
 * quelles : la base stocke `effectId` / `characteristic` DofusDB).
 */
export type FmEffectKey =
    | "actionPoints"
    | "movementPoints"
    | "range"
    | "summons"
    | "vitality"
    | "strength"
    | "intelligence"
    | "chance"
    | "agility"
    | "wisdom"
    | "power"
    | "initiative"
    | "pods"
    | "prospecting"
    | "criticalHits"
    | "heals"
    | "reflectDamage"
    | "tackle"
    | "dodge"
    | "apReduction"
    | "mpReduction"
    | "apDodge"
    | "mpDodge"
    | "damage"
    | "neutralDamage"
    | "earthDamage"
    | "fireDamage"
    | "waterDamage"
    | "airDamage"
    | "criticalDamage"
    | "pushbackDamage"
    | "trapDamage"
    | "weaponDamagePercent"
    | "spellDamagePercent"
    | "meleeDamagePercent"
    | "rangedDamagePercent"
    | "trapPower"
    | "neutralResistance"
    | "earthResistance"
    | "fireResistance"
    | "waterResistance"
    | "airResistance"
    | "criticalResistance"
    | "pushbackResistance"
    | "neutralResistancePercent"
    | "earthResistancePercent"
    | "fireResistancePercent"
    | "waterResistancePercent"
    | "airResistancePercent"
    | "meleeResistancePercent"
    | "rangedResistancePercent"
    | "huntingWeapon";

/**
 * Définition d'une ligne forgeable.
 * `maxOverStandalone` = ⌊101 / unitWeight⌋ : over maximal **si la ligne est le
 * seul ajout FM au-dessus du jet naturel**.
 */
export interface FmEffectDefinition {
    key: FmEffectKey;
    /** Libellé affiché complet (« Coups critiques »). */
    label: string;
    /** Libellé court (badges, cartes PNG) — « CC ». */
    shortLabel: string;
    /** Rune de forge correspondante (« Cri »). */
    rune: string;
    /** Densité consommée **par point** (Vitalité = 0,2 ; CC = 10…). */
    unitWeight: number;
    /** Over maximal théorique si la ligne est le seul ajout FM (⌊101/densité⌋). */
    maxOverStandalone: number;
    /** La ligne peut être ajoutée en **exotique** (hors jet natif). */
    canExo: boolean;
    /** La ligne peut être **sur-forgée** (over sur un jet natif existant). */
    canOver: boolean;
    /** Restriction d'équipement (arme de chasse = armes uniquement). */
    itemKind?: "weapon";
}

/**
 * Référentiel FM complet (52 lignes forgeables, ordre d'affichage officiel).
 * ⚠️ Modification de densité = **revue communautaire obligatoire** (cf. §12.8).
 */
export const FM_EFFECTS: FmEffectDefinition[] = [
    {
        key: "actionPoints",
        label: "PA",
        shortLabel: "PA",
        rune: "Ga Pa",
        unitWeight: 100,
        maxOverStandalone: 1,
        canExo: true,
        canOver: false,
    },
    {
        key: "movementPoints",
        label: "PM",
        shortLabel: "PM",
        rune: "Ga Pme",
        unitWeight: 90,
        maxOverStandalone: 1,
        canExo: true,
        canOver: false,
    },
    {
        // D38 — la Portée n'est **jamais** sur-forgeable : 2 PO = 2 × 51 = 102 > 101,
        // donc un over de +1 PO au-dessus d'un jet natif de 1 PO est illégal.
        // Elle reste **ajoutable en exo** (51 ≤ 101). Confirmé par la source
        // communautaire de référence (§12.8.4).
        key: "range",
        label: "Portée",
        shortLabel: "PO",
        rune: "Po",
        unitWeight: 51,
        maxOverStandalone: 1,
        canExo: true,
        canOver: false,
    },
    {
        key: "summons",
        label: "Invocations",
        shortLabel: "Invo",
        rune: "Invo",
        unitWeight: 30,
        maxOverStandalone: 3,
        canExo: true,
        canOver: true,
    },
    {
        key: "vitality",
        label: "Vitalité",
        shortLabel: "Vita",
        rune: "Vi",
        unitWeight: 0.2,
        maxOverStandalone: 505,
        canExo: true,
        canOver: true,
    },
    {
        key: "strength",
        label: "Force",
        shortLabel: "Fo",
        rune: "Fo",
        unitWeight: 1,
        maxOverStandalone: 101,
        canExo: true,
        canOver: true,
    },
    {
        key: "intelligence",
        label: "Intelligence",
        shortLabel: "Int",
        rune: "Ine",
        unitWeight: 1,
        maxOverStandalone: 101,
        canExo: true,
        canOver: true,
    },
    {
        key: "chance",
        label: "Chance",
        shortLabel: "Cha",
        rune: "Cha",
        unitWeight: 1,
        maxOverStandalone: 101,
        canExo: true,
        canOver: true,
    },
    {
        key: "agility",
        label: "Agilité",
        shortLabel: "Agi",
        rune: "Age",
        unitWeight: 1,
        maxOverStandalone: 101,
        canExo: true,
        canOver: true,
    },
    {
        key: "wisdom",
        label: "Sagesse",
        shortLabel: "Sa",
        rune: "Sa",
        unitWeight: 3,
        maxOverStandalone: 33,
        canExo: true,
        canOver: true,
    },
    {
        key: "power",
        label: "Puissance",
        shortLabel: "Pui",
        rune: "Pui",
        unitWeight: 2,
        maxOverStandalone: 50,
        canExo: true,
        canOver: true,
    },
    {
        key: "initiative",
        label: "Initiative",
        shortLabel: "Ini",
        rune: "Ini",
        unitWeight: 0.1,
        maxOverStandalone: 1010,
        canExo: true,
        canOver: true,
    },
    {
        key: "pods",
        label: "Pods",
        shortLabel: "Pod",
        rune: "Pod",
        // ⚠️ S4.0c / Q15 — densité **non tranchée** : 0,1 (code historique) vs 0,25
        // (sources communautaires) vs 0,025 (guide SEO à corriger). Le plan impose de
        // **ne rien changer sans la capture de la rune** fournie par le user ⇒ valeur
        // gelée volontairement (test dédié) + signalée au rapport.
        unitWeight: 0.1,
        maxOverStandalone: 1010,
        canExo: true,
        canOver: true,
    },
    {
        key: "prospecting",
        label: "Prospection",
        shortLabel: "Pros",
        rune: "Prospe",
        unitWeight: 3,
        maxOverStandalone: 33,
        canExo: true,
        canOver: true,
    },
    {
        key: "criticalHits",
        label: "Coups critiques",
        shortLabel: "CC",
        rune: "Cri",
        unitWeight: 10,
        maxOverStandalone: 10,
        canExo: true,
        canOver: true,
    },
    {
        key: "heals",
        label: "Soins",
        shortLabel: "So",
        rune: "So",
        unitWeight: 10,
        maxOverStandalone: 10,
        canExo: true,
        canOver: true,
    },
    {
        key: "reflectDamage",
        label: "Renvoi de dommages",
        shortLabel: "Do Ren",
        rune: "Do Ren",
        unitWeight: 10,
        maxOverStandalone: 10,
        canExo: true,
        canOver: true,
    },
    {
        key: "tackle",
        label: "Tacle",
        shortLabel: "Tac",
        rune: "Tac",
        unitWeight: 4,
        maxOverStandalone: 25,
        canExo: true,
        canOver: true,
    },
    {
        key: "dodge",
        label: "Fuite",
        shortLabel: "Fui",
        rune: "Fui",
        unitWeight: 4,
        maxOverStandalone: 25,
        canExo: true,
        canOver: true,
    },
    {
        key: "apReduction",
        label: "Retrait PA",
        shortLabel: "Ret Pa",
        rune: "Ret Pa",
        unitWeight: 7,
        maxOverStandalone: 14,
        canExo: true,
        canOver: true,
    },
    {
        key: "mpReduction",
        label: "Retrait PM",
        shortLabel: "Ret Pme",
        rune: "Ret Pme",
        unitWeight: 7,
        maxOverStandalone: 14,
        canExo: true,
        canOver: true,
    },
    {
        key: "apDodge",
        label: "Esquive PA",
        shortLabel: "Ré Pa",
        rune: "Ré Pa",
        unitWeight: 7,
        maxOverStandalone: 14,
        canExo: true,
        canOver: true,
    },
    {
        key: "mpDodge",
        label: "Esquive PM",
        shortLabel: "Ré Pme",
        rune: "Ré Pme",
        unitWeight: 7,
        maxOverStandalone: 14,
        canExo: true,
        canOver: true,
    },
    {
        key: "damage",
        label: "Dommages",
        shortLabel: "Do",
        rune: "Do",
        unitWeight: 20,
        maxOverStandalone: 5,
        canExo: true,
        canOver: true,
    },
    {
        key: "neutralDamage",
        label: "Dommages Neutre",
        shortLabel: "Do Neutre",
        rune: "Do Neutre",
        unitWeight: 5,
        maxOverStandalone: 20,
        canExo: true,
        canOver: true,
    },
    {
        key: "earthDamage",
        label: "Dommages Terre",
        shortLabel: "Do Terre",
        rune: "Do Terre",
        unitWeight: 5,
        maxOverStandalone: 20,
        canExo: true,
        canOver: true,
    },
    {
        key: "fireDamage",
        label: "Dommages Feu",
        shortLabel: "Do Feu",
        rune: "Do Feu",
        unitWeight: 5,
        maxOverStandalone: 20,
        canExo: true,
        canOver: true,
    },
    {
        key: "waterDamage",
        label: "Dommages Eau",
        shortLabel: "Do Eau",
        rune: "Do Eau",
        unitWeight: 5,
        maxOverStandalone: 20,
        canExo: true,
        canOver: true,
    },
    {
        key: "airDamage",
        label: "Dommages Air",
        shortLabel: "Do Air",
        rune: "Do Air",
        unitWeight: 5,
        maxOverStandalone: 20,
        canExo: true,
        canOver: true,
    },
    {
        key: "criticalDamage",
        label: "Dommages critiques",
        shortLabel: "Do Cri",
        rune: "Do Cri",
        unitWeight: 5,
        maxOverStandalone: 20,
        canExo: true,
        canOver: true,
    },
    {
        key: "pushbackDamage",
        label: "Dommages poussée",
        shortLabel: "Do Pou",
        rune: "Do Pou",
        unitWeight: 5,
        maxOverStandalone: 20,
        canExo: true,
        canOver: true,
    },
    {
        key: "trapDamage",
        label: "Dommages pièges",
        shortLabel: "Pi",
        rune: "Pi",
        unitWeight: 5,
        maxOverStandalone: 20,
        canExo: true,
        canOver: true,
    },
    {
        key: "weaponDamagePercent",
        label: "% Dommages d'armes",
        shortLabel: "% Do Ar",
        rune: "Do Per Ar",
        unitWeight: 15,
        maxOverStandalone: 6,
        canExo: true,
        canOver: true,
    },
    {
        key: "spellDamagePercent",
        label: "% Dommages aux sorts",
        shortLabel: "% Do So",
        rune: "Do Per So",
        unitWeight: 15,
        maxOverStandalone: 6,
        canExo: true,
        canOver: true,
    },
    {
        key: "meleeDamagePercent",
        label: "% Dommages mêlée",
        shortLabel: "% Do mêlée",
        rune: "Do Per Mé",
        unitWeight: 15,
        maxOverStandalone: 6,
        canExo: true,
        canOver: true,
    },
    {
        key: "rangedDamagePercent",
        label: "% Dommages distance",
        shortLabel: "% Do dist",
        rune: "Do Per Di",
        unitWeight: 15,
        maxOverStandalone: 6,
        canExo: true,
        canOver: true,
    },
    {
        key: "trapPower",
        label: "Puissance des pièges",
        shortLabel: "Pi Per",
        rune: "Pi Per",
        unitWeight: 2,
        maxOverStandalone: 50,
        canExo: true,
        canOver: true,
    },
    {
        key: "neutralResistance",
        label: "Résistance Neutre",
        shortLabel: "Ré Neutre",
        rune: "Ré Neutre",
        unitWeight: 2,
        maxOverStandalone: 50,
        canExo: true,
        canOver: true,
    },
    {
        key: "earthResistance",
        label: "Résistance Terre",
        shortLabel: "Ré Terre",
        rune: "Ré Terre",
        unitWeight: 2,
        maxOverStandalone: 50,
        canExo: true,
        canOver: true,
    },
    {
        key: "fireResistance",
        label: "Résistance Feu",
        shortLabel: "Ré Feu",
        rune: "Ré Feu",
        unitWeight: 2,
        maxOverStandalone: 50,
        canExo: true,
        canOver: true,
    },
    {
        key: "waterResistance",
        label: "Résistance Eau",
        shortLabel: "Ré Eau",
        rune: "Ré Eau",
        unitWeight: 2,
        maxOverStandalone: 50,
        canExo: true,
        canOver: true,
    },
    {
        key: "airResistance",
        label: "Résistance Air",
        shortLabel: "Ré Air",
        rune: "Ré Air",
        unitWeight: 2,
        maxOverStandalone: 50,
        canExo: true,
        canOver: true,
    },
    {
        key: "criticalResistance",
        label: "Résistance critiques",
        shortLabel: "Ré Cri",
        rune: "Ré Cri",
        unitWeight: 2,
        maxOverStandalone: 50,
        canExo: true,
        canOver: true,
    },
    {
        key: "pushbackResistance",
        label: "Résistance poussée",
        shortLabel: "Ré Pou",
        rune: "Ré Pou",
        unitWeight: 2,
        maxOverStandalone: 50,
        canExo: true,
        canOver: true,
    },
    {
        key: "neutralResistancePercent",
        label: "% Résistance Neutre",
        shortLabel: "% Ré Neutre",
        rune: "Ré Per Neutre",
        unitWeight: 6,
        maxOverStandalone: 16,
        canExo: true,
        canOver: true,
    },
    {
        key: "earthResistancePercent",
        label: "% Résistance Terre",
        shortLabel: "% Ré Terre",
        rune: "Ré Per Terre",
        unitWeight: 6,
        maxOverStandalone: 16,
        canExo: true,
        canOver: true,
    },
    {
        key: "fireResistancePercent",
        label: "% Résistance Feu",
        shortLabel: "% Ré Feu",
        rune: "Ré Per Feu",
        unitWeight: 6,
        maxOverStandalone: 16,
        canExo: true,
        canOver: true,
    },
    {
        key: "waterResistancePercent",
        label: "% Résistance Eau",
        shortLabel: "% Ré Eau",
        rune: "Ré Per Eau",
        unitWeight: 6,
        maxOverStandalone: 16,
        canExo: true,
        canOver: true,
    },
    {
        key: "airResistancePercent",
        label: "% Résistance Air",
        shortLabel: "% Ré Air",
        rune: "Ré Per Air",
        unitWeight: 6,
        maxOverStandalone: 16,
        canExo: true,
        canOver: true,
    },
    {
        key: "meleeResistancePercent",
        label: "% Résistance mêlée",
        shortLabel: "% Ré mêlée",
        rune: "Ré Per Mé",
        unitWeight: 15,
        maxOverStandalone: 6,
        canExo: true,
        canOver: true,
    },
    {
        key: "rangedResistancePercent",
        label: "% Résistance distance",
        shortLabel: "% Ré dist",
        rune: "Ré Per Di",
        unitWeight: 15,
        maxOverStandalone: 6,
        canExo: true,
        canOver: true,
    },
    {
        // Propriété binaire d'arme : jamais « over » ni cumulable (max 1),
        // proposée uniquement pour les armes (cf. §12.8, « hors jet »).
        key: "huntingWeapon",
        label: "Arme de chasse",
        shortLabel: "Chasse",
        rune: "Chasse",
        unitWeight: 5,
        maxOverStandalone: 1,
        canExo: true,
        canOver: false,
        itemKind: "weapon",
    },
];

/** Index par clé (accès O(1) sans recalcul). */
export const FM_EFFECTS_BY_KEY: Record<FmEffectKey, FmEffectDefinition> = FM_EFFECTS.reduce(
    (acc, effect) => {
        acc[effect.key] = effect;
        return acc;
    },
    {} as Record<FmEffectKey, FmEffectDefinition>
);

/** Définition d'une ligne FM (ou `null` si la clé est inconnue). */
export function getFmEffect(key: string | null | undefined): FmEffectDefinition | null {
    if (!key) return null;
    return (FM_EFFECTS_BY_KEY as Record<string, FmEffectDefinition>)[key] ?? null;
}

// ---------------------------------------------------------------------------
// CLASSIFICATION (§12.8) — purement visuelle, jamais bloquante (D34/D35)
// ---------------------------------------------------------------------------

/**
 * Étiquette FM d'une ligne déclarée.
 * - `MALUS` : valeur négative (ou malus natif modifié) ;
 * - `EXO` : la ligne n'existe pas sur l'objet ;
 * - `A_VERIFIER` : plage native absente/incomplète côté catalogue ;
 * - `OVER` / `PARFAIT` / `BON` / `FAIBLE` : position dans la plage native.
 */
export type FmStatus =
    | "MALUS"
    | "EXO"
    | "A_VERIFIER"
    | "OVER"
    | "PARFAIT"
    | "BON"
    | "FAIBLE";

/**
 * Calcule l'étiquette FM d'une ligne.
 * ⚠️ Une valeur atypique n'est **jamais** refusée : au pire → `A_VERIFIER`.
 */
export function getFmStatus(input: {
    currentValue: number;
    nativeMin?: number | null;
    nativeMax?: number | null;
    isNativeEffect: boolean;
}): FmStatus {
    const { currentValue, nativeMin, nativeMax, isNativeEffect } = input;

    // Le signe prime : un malus reste un malus, natif ou modifié.
    if (currentValue < 0) return "MALUS";

    if (!isNativeEffect) return "EXO";

    if (nativeMax == null) return "A_VERIFIER";

    if (currentValue > nativeMax) return "OVER";
    if (currentValue === nativeMax) return "PARFAIT";
    if (currentValue >= (nativeMin ?? 0)) return "BON";
    return "FAIBLE";
}

// ---------------------------------------------------------------------------
// RÉSOLUTION — retrouver la ligne FM derrière un effet DofusDB
// ---------------------------------------------------------------------------

/**
 * Libellés FR **vérifiés** des caractéristiques DofusDB utilisées par la FM
 * (recoupés le 11/09/2026 : `GET /characteristics/{id}` → `name.fr` **et** table
 * locale `GameCharacteristic` siphonnée). C'est la **source de vérité** du
 * mapping ci-dessous : `FM_CHARACTERISTIC_KEYS` doit être exactement la
 * traduction de cette table (test d'intégrité D39).
 *
 * ❌ Volontairement **absents** (hors jet FM) : `51` Perte d'énergie,
 * `52` Points d'honneur, `80` Rayon d'auto-agression JcJ, `93` Nombre max
 * d'invocations de bombes, `141` Sorts (%) (résistance aux sorts : aucun rune).
 */
export const FM_CHARACTERISTIC_LABELS: Record<number, string> = {
    1: "PA",
    10: "Force",
    11: "Vitalité",
    12: "Sagesse",
    13: "Chance",
    14: "Agilité",
    15: "Intelligence",
    16: "Dommages",
    18: "Critique",
    19: "Portée",
    23: "PM",
    25: "Puissance",
    26: "Invocation",
    27: "Esquive PA",
    28: "Esquive PM",
    33: "Terre (%)",
    34: "Feu (%)",
    35: "Eau (%)",
    36: "Air (%)",
    37: "Neutre (%)",
    40: "Pods",
    44: "Initiative",
    48: "Prospection",
    49: "Soins",
    50: "Renvoi",
    78: "Fuite",
    79: "Tacle",
    82: "Retrait PA",
    83: "Retrait PM",
    84: "Poussée",
    85: "Poussée (fixe)",
    86: "Critiques",
    87: "Critiques (fixe)",
    88: "Terre",
    89: "Feu",
    90: "Eau",
    91: "Air",
    92: "Neutre",
    121: "Distance (%)",
    125: "Mêlée (%)",
};

/**
 * `characteristicId` DofusDB → clé FM. **Uniquement des ids vérifiés**
 * (D39 : recoupés avec `FM_CHARACTERISTIC_LABELS`, `/characteristics/{id}` et le
 * référentiel siphonné `GameCharacteristic`) : aucun id n'est deviné ici.
 *
 * ⚠️ Réécrit en S4.0b (audit §12.8.4) : l'ancienne table était **fausse sur 20
 * ids** (16, 26, 27, 28, 48-52, 80, 82-84, 88, 92, 93, 112, 114, 125, 141) et il
 * lui manquait Force (10), % Rés. (33-37), Pods (40), Initiative (44) et les
 * dommages élémentaires par élément. Le bug était **masqué** parce que les
 * `effects` siphonnés n'embarquent pas de champ `characteristic` (repli libellé).
 * ⚠️ `112`/`114` ne sont **pas** des caractéristiques (`112` est un `effectId`,
 * `114` renvoie 404) ⇒ retirés.
 */
export const FM_CHARACTERISTIC_KEYS: Record<number, FmEffectKey> = {
    1: "actionPoints",
    10: "strength",
    11: "vitality",
    12: "wisdom",
    13: "chance",
    14: "agility",
    15: "intelligence",
    16: "damage",
    18: "criticalHits",
    19: "range",
    23: "movementPoints",
    25: "power",
    26: "summons",
    27: "apDodge",
    28: "mpDodge",
    33: "earthResistancePercent",
    34: "fireResistancePercent",
    35: "waterResistancePercent",
    36: "airResistancePercent",
    37: "neutralResistancePercent",
    40: "pods",
    44: "initiative",
    48: "prospecting",
    49: "heals",
    50: "reflectDamage",
    78: "dodge",
    79: "tackle",
    82: "apReduction",
    83: "mpReduction",
    84: "pushbackDamage",
    85: "pushbackResistance",
    86: "criticalDamage",
    87: "criticalResistance",
    88: "earthDamage",
    89: "fireDamage",
    90: "waterDamage",
    91: "airDamage",
    92: "neutralDamage",
    121: "rangedResistancePercent",
    125: "meleeDamagePercent",
};

/**
 * `effectId` DofusDB → clé FM. On ne référence ici que les effets **utilisés
 * comme lignes FM canoniques** (exos PA/PM/PO/invocation, cf. `EXO_EFFECT_PRESETS`).
 * Le reste est résolu par le libellé FR (référentiel data-driven).
 */
export const FM_EFFECT_ID_KEYS: Record<number, FmEffectKey> = {
    111: "actionPoints",
    117: "range",
    128: "movementPoints",
    182: "summons",
};

/**
 * Normalise un libellé pour la résolution FM : minuscules, sans accents, sans
 * ponctuation, « % » toujours en **préfixe** (« Résistance Feu (%) » et
 * « % Résistance Feu » donnent la même clé).
 */
export function normalizeFmLabel(label: string): string {
    const cleaned = label
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/['’`]/g, " ")
        .replace(/[^a-z0-9%]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");

    const hasPercent = cleaned.includes("%");
    const words = cleaned.split(" ").filter((word) => word.length > 0 && word !== "%");
    return `${hasPercent ? "% " : ""}${words.join(" ")}`;
}

/**
 * Alias de libellés (normalisés) → clé FM. Couvre les libellés officiels
 * DofusDB, les codes courts historiques (`int_name`) et les abréviations FR.
 */
export const FM_LABEL_ALIASES: Record<string, FmEffectKey> = {
    pa: "actionPoints",
    "ga pa": "actionPoints",
    "points d action": "actionPoints",
    pm: "movementPoints",
    "ga pme": "movementPoints",
    "points de mouvement": "movementPoints",
    portee: "range",
    po: "range",
    invocation: "summons",
    invocations: "summons",
    invo: "summons",
    pv: "vitality",
    vi: "vitality",
    vitalite: "vitality",
    "points de vie": "vitality",
    vie: "vitality",
    fo: "strength",
    force: "strength",
    int: "intelligence",
    ine: "intelligence",
    intelligence: "intelligence",
    cha: "chance",
    chance: "chance",
    agi: "agility",
    age: "agility",
    agilite: "agility",
    sa: "wisdom",
    sagesse: "wisdom",
    pui: "power",
    puissance: "power",
    ini: "initiative",
    initiative: "initiative",
    pod: "pods",
    pods: "pods",
    poids: "pods",
    pp: "prospecting",
    prospe: "prospecting",
    prospection: "prospecting",
    cc: "criticalHits",
    cri: "criticalHits",
    critique: "criticalHits",
    "coup critique": "criticalHits",
    "coups critiques": "criticalHits",
    so: "heals",
    soins: "heals",
    "do ren": "reflectDamage",
    "renvoi de dommages": "reflectDamage",
    renvoi: "reflectDamage",
    tac: "tackle",
    tacle: "tackle",
    fui: "dodge",
    fuite: "dodge",
    rpa: "apReduction",
    "ret pa": "apReduction",
    "retrait pa": "apReduction",
    rpm: "mpReduction",
    "ret pme": "mpReduction",
    "retrait pm": "mpReduction",
    epa: "apDodge",
    "re pa": "apDodge",
    "esquive pa": "apDodge",
    epm: "mpDodge",
    "re pme": "mpDodge",
    "esquive pm": "mpDodge",
    do: "damage",
    dmg: "damage",
    dommages: "damage",
    dnf: "neutralDamage",
    "do neutre": "neutralDamage",
    "dommages neutre": "neutralDamage",
    dtf: "earthDamage",
    "do terre": "earthDamage",
    "dommages terre": "earthDamage",
    dff: "fireDamage",
    "do feu": "fireDamage",
    "dommages feu": "fireDamage",
    def: "waterDamage",
    "do eau": "waterDamage",
    "dommages eau": "waterDamage",
    daf: "airDamage",
    "do air": "airDamage",
    "dommages air": "airDamage",
    "do cri": "criticalDamage",
    "dommages critique": "criticalDamage",
    "dommages critiques": "criticalDamage",
    "do pou": "pushbackDamage",
    "dommages poussee": "pushbackDamage",
    pi: "trapDamage",
    "dommages piege": "trapDamage",
    "dommages pieges": "trapDamage",
    "do per ar": "weaponDamagePercent",
    "dommages d armes": "weaponDamagePercent",
    "% do ar": "weaponDamagePercent",
    "% dommages d armes": "weaponDamagePercent",
    "do per so": "spellDamagePercent",
    "dommages aux sorts": "spellDamagePercent",
    "% do so": "spellDamagePercent",
    "% dommages aux sorts": "spellDamagePercent",
    "do per me": "meleeDamagePercent",
    "dommages melee": "meleeDamagePercent",
    "% do melee": "meleeDamagePercent",
    "% dommages melee": "meleeDamagePercent",
    "do per di": "rangedDamagePercent",
    "dommages distance": "rangedDamagePercent",
    "% do dist": "rangedDamagePercent",
    "% dommages distance": "rangedDamagePercent",
    "pi per": "trapPower",
    "puissance des pieges": "trapPower",
    "re neutre": "neutralResistance",
    "resistance neutre": "neutralResistance",
    "re terre": "earthResistance",
    "resistance terre": "earthResistance",
    "re feu": "fireResistance",
    "resistance feu": "fireResistance",
    "re eau": "waterResistance",
    "resistance eau": "waterResistance",
    "re air": "airResistance",
    "resistance air": "airResistance",
    "re cri": "criticalResistance",
    "resistance critique": "criticalResistance",
    "resistance critiques": "criticalResistance",
    "re pou": "pushbackResistance",
    "resistance poussee": "pushbackResistance",
    "re per neutre": "neutralResistancePercent",
    "% re neutre": "neutralResistancePercent",
    "% resistance neutre": "neutralResistancePercent",
    "re per terre": "earthResistancePercent",
    "% re terre": "earthResistancePercent",
    "% resistance terre": "earthResistancePercent",
    "re per feu": "fireResistancePercent",
    "% re feu": "fireResistancePercent",
    "% resistance feu": "fireResistancePercent",
    "re per eau": "waterResistancePercent",
    "% re eau": "waterResistancePercent",
    "% resistance eau": "waterResistancePercent",
    "re per air": "airResistancePercent",
    "% re air": "airResistancePercent",
    "% resistance air": "airResistancePercent",
    "re per me": "meleeResistancePercent",
    "% re melee": "meleeResistancePercent",
    "% resistance melee": "meleeResistancePercent",
    "re per di": "rangedResistancePercent",
    "% re dist": "rangedResistancePercent",
    "% resistance distance": "rangedResistancePercent",
    // ── Libellés du référentiel DofusDB `/characteristics` (vérifiés S4.0b / D39) ──
    // DofusDB nomme « Terre (%) », « Poussée (fixe) », « Mêlée (%) », « Retrait PA »…
    // là où la communauté écrit « % Résistance Terre », « Do Pou », « Do Mêlée ».
    // Les deux formes doivent résoudre la **même** ligne FM : ce libellé est le
    // repli réel, car les `effects` siphonnés n'embarquent pas de `characteristic`
    // (cf. test d'intégrité sur `FM_CHARACTERISTIC_LABELS`).
    terre: "earthDamage",
    feu: "fireDamage",
    eau: "waterDamage",
    air: "airDamage",
    neutre: "neutralDamage",
    poussee: "pushbackDamage",
    critiques: "criticalDamage",
    "poussee fixe": "pushbackResistance",
    "critiques fixe": "criticalResistance",
    "% terre": "earthResistancePercent",
    "% feu": "fireResistancePercent",
    "% eau": "waterResistancePercent",
    "% air": "airResistancePercent",
    "% neutre": "neutralResistancePercent",
    "% distance": "rangedResistancePercent",
    "% melee": "meleeDamagePercent",
    chasse: "huntingWeapon",
    "arme de chasse": "huntingWeapon",
};

/**
 * Résout la ligne FM d'un effet, dans l'ordre de fiabilité :
 * `characteristicId` → `effectId` → libellé FR normalisé.
 * `null` = effet hors FM (dégâts d'arme, vol de vie, bonus de panoplie…).
 */
export function resolveFmEffectKey(input: {
    effectId?: number | null;
    characteristic?: number | null;
    label?: string | null;
}): FmEffectKey | null {
    // S8.5 — un libellé **gabarit** DofusDB (« Effet 63 », « }{ soins ») ne doit
    // jamais être interprété comme une ligne FM : mieux vaut `null` (ligne hors
    // référentiel, affichée en lecture seule) qu'une clé inventée.
    if (input.label && isPlaceholderStatLabel(input.label)) return null;
    if (input.characteristic != null && FM_CHARACTERISTIC_KEYS[input.characteristic]) {
        return FM_CHARACTERISTIC_KEYS[input.characteristic];
    }
    if (input.effectId != null && FM_EFFECT_ID_KEYS[input.effectId]) {
        return FM_EFFECT_ID_KEYS[input.effectId];
    }
    if (input.label) {
        const normalized = normalizeFmLabel(input.label);
        const direct = FM_LABEL_ALIASES[normalized];
        if (direct) return direct;
        // Repli : la rune seule sert d'alias (« Vi », « Do Feu », « Ret Pa »…).
        const withoutPercent = normalized.replace(/^%\s*/, "");
        const runeMatch = FM_EFFECTS.find(
            (effect) => normalizeFmLabel(effect.rune) === withoutPercent
        );
        if (runeMatch) return runeMatch.key;
    }
    return null;
}

// ---------------------------------------------------------------------------
// LIGNES HORS JET FM (§12.8) — affichées en lecture seule dans l'éditeur
// ---------------------------------------------------------------------------

/** Motifs de lignes visibles sur un objet mais **non forgeables**. */
export const FM_READONLY_PATTERNS: { pattern: RegExp; reason: string }[] = [
    { pattern: /vol de vie/i, reason: "Vol de vie — non ajoutable par rune" },
    {
        pattern: /(?:dommages?|d[ée]g[âa]ts?)\s+(?:de\s+)?l['’]arme/i,
        reason: "Dégâts de base de l'arme — lecture seule",
    },
    { pattern: /panoplie/i, reason: "Bonus de panoplie — dépend du stuff équipé" },
    { pattern: /condition/i, reason: "Condition d'équipement — hors jet FM" },
    {
        pattern: /(?:sort|sortil[èe]ge|d[ée]clenchement|apparence|titre|apparat|avatar|montilier)/i,
        reason: "Effet hors jet FM",
    },
    {
        // S8.2 (D40) — ligne apposée par une **rune de Transcendance** : l'objet
        // devient définitif, plus aucune forgemagie n'est possible dessus.
        pattern: /emp[êe]che\s+les\s+futures\s+forgemagies/i,
        reason: "Objet transcendé — les futures forgemagies sont bloquées (D40)",
    },
];

/**
 * S8.2 — **exceptions** au filet de lecture seule : des lignes bel et bien
 * **forgeables** dont le libellé contient malencontreusement un mot-clé d'un
 * motif ci-dessus (« **Arme de chasse** » contient « arme »). Elles sont donc
 * exemptées et restent éditables.
 */
export const FM_READONLY_EXCEPTIONS: RegExp[] = [
    /arme\s+de\s+chasse/i,
    /^\s*chasse\s*$/i,
];

/** Raison de lecture seule d'un libellé, ou `null` s'il est forgeable. */
export function describeFmReadonly(label: string | null | undefined): string | null {
    if (!label) return null;
    // Une exception (arme de chasse) prime sur les motifs génériques.
    if (FM_READONLY_EXCEPTIONS.some((pattern) => pattern.test(label))) return null;
    const hit = FM_READONLY_PATTERNS.find((entry) => entry.pattern.test(label));
    return hit ? hit.reason : null;
}

// ---------------------------------------------------------------------------
// S8.2 — TRANSCENDANCE (D40) : libellé d'effet + seuils de pose
// ---------------------------------------------------------------------------

/**
 * S8.2 (D40) — libellé d'effet **officiel** apposé sur un objet transcendé.
 * Source unique : `src/lib/market/smithmagic.ts` le ré-exporte sous le nom
 * `TRANSCENDENCE_LABEL` (jamais dupliqué).
 */
export const FM_TRANSCENDENCE_LABEL = "Empêche les futures forgemagies";

/** Paliers de Transcendance, du plus faible au plus fort. */
export const FM_TRANSCENDENCE_PALIERS = ["Ta", "PaTa", "RaTa"] as const;
export type FmTranscendencePalier = (typeof FM_TRANSCENDENCE_PALIERS)[number];

/** Familles de caractéristiques partageant les mêmes seuils de pose. */
export type FmTranscendenceFamily =
    | "simple"
    | "extended"
    | "elementalDamage"
    | "percent"
    | "retAndDodge";

/** Seuils de pose d'une famille : jet natif **maximal** accepté par palier. */
export type FmTranscendenceSeuils = Record<FmTranscendencePalier, number>;

/**
 * S8.2 (D40) — **seuils de pose** des runes de Transcendance.
 *
 * Une rune de palier `P` n'est posable que si le **jet natif** de la
 * caractéristique correspondante est **≤ seuil[P]** (Ta est le plus permissif,
 * RaTa le plus exigeant). Au-delà, la Transcendance de ce palier est refusée par
 * le jeu — la rune du palier inférieur peut encore passer.
 *
 * ⚠️ Donnée **communautaire** (au même titre que les densités `FM_EFFECTS`) :
 * elle est **purement indicative** et **ne bloque jamais** une saisie
 * (D34/D35). Elle sert à afficher « palier posable » dans l'éditeur de jet.
 */
export const FM_TRANSCENDENCE_SEUILS: Record<FmTranscendenceFamily, FmTranscendenceSeuils> = {
    /** Caractéristiques de base (Agilité, Chance, Force, Intelligence, Vitalité…). */
    simple: { Ta: 61, PaTa: 41, RaTa: 21 },
    /** Caractéristiques « étendues » (Pods, Initiative). */
    extended: { Ta: 301, PaTa: 204, RaTa: 105 },
    /** Dommages élémentaires bruts (Do Terre / Eau / Feu / Air / Neutre). */
    elementalDamage: { Ta: 8, PaTa: 5, RaTa: 3 },
    /** % dommages et % résistances (« … (%) »). */
    percent: { Ta: 12, PaTa: 8, RaTa: 4 },
    /** Retraits et esquives PA / PM. */
    retAndDodge: { Ta: 6, PaTa: 4, RaTa: 2 },
};

/**
 * Range un libellé d'effet (tel que produit par `smithmagic.ts`) dans sa famille
 * de seuils. Renvoie `null` si le libellé n'est pas une caractéristique connue.
 */
export function fmTranscendenceFamily(label: string | null | undefined): FmTranscendenceFamily | null {
    if (!label) return null;
    const normalized = normalizeFmLabel(label);
    if (!normalized) return null;
    if (normalized.includes("%") || normalized.includes("pourcent")) return "percent";
    if (/^(?:pods?|initiative)$/.test(normalized)) return "extended";
    if (/(?:retrait|esquive)\s*(?:pa|pm|pme)$/.test(normalized)) return "retAndDodge";
    if (/^dommages? (?:terre|eau|feu|air|neutre)$/.test(normalized)) return "elementalDamage";
    if (
        /^(?:agilit|chance|force|intelligence|vitalit|puissance|soins|critique|fuite|tacle|sagesse|prospection)/.test(
            normalized
        )
    ) {
        return "simple";
    }
    // Dommages / Résistance Poussée & Critiques : même barème que les stats de base.
    if (/^(?:dommages?|resistance) (?:poussee|critiques?)$/.test(normalized)) return "simple";
    return null;
}

/**
 * Palier de Transcendance **posable** pour un jet donné, ou `null` si le jet
 * dépasse déjà tous les seuils (aucune rune de ce type n'est acceptée).
 * Renvoie le palier **le plus fort** dont le seuil couvre le jet.
 */
export function fmTranscendencePalierFor(
    label: string | null | undefined,
    jet: number
): FmTranscendencePalier | null {
    const family = fmTranscendenceFamily(label);
    if (!family || !Number.isFinite(jet)) return null;
    const seuils = FM_TRANSCENDENCE_SEUILS[family];
    // Du plus fort au plus faible : Ta est le plus permissif.
    const ordered: FmTranscendencePalier[] = ["RaTa", "PaTa", "Ta"];
    for (const palier of ordered) {
        if (jet <= seuils[palier]) return palier;
    }
    return null;
}

// ---------------------------------------------------------------------------
// DENSITÉ — budget de 101 points, partagé entre overs et exos
// ---------------------------------------------------------------------------

/** Ligne contribuant au budget de densité. */
export type FmBudgetLine = {
    /** Densité par point de la ligne (référentiel FM). */
    unitWeight: number;
    /** Points ajoutés **au-dessus du jet natif** (0 pour une ligne native pure). */
    extraValue: number;
};

export type FmBudget = {
    /** Plafond légal (101 par défaut). */
    cap: number;
    /** Densité consommée par les overs/exos déclarés (3 décimales max). */
    consumed: number;
    /** Densité encore disponible (`cap - consumed`, jamais négative). */
    remaining: number;
    /** `true` si les overs/exos dépassent le plafond (signalé, jamais bloqué). */
    exceeded: boolean;
};

/** Densité d'une valeur (arrondie à 3 décimales : évite 0.30000000000004). */
export function fmDensity(unitWeight: number, value: number): number {
    return Math.round(Math.abs(unitWeight * value) * 1000) / 1000;
}

/** Consomme le budget de densité des lignes fournies (plafond `cap`). */
export function computeFmBudget(lines: FmBudgetLine[], cap = FM_DENSITY_CAP): FmBudget {
    const consumed = lines.reduce((total, line) => {
        if (line.extraValue <= 0) return total;
        return total + fmDensity(line.unitWeight, line.extraValue);
    }, 0);
    const rounded = Math.round(consumed * 1000) / 1000;
    return {
        cap,
        consumed: rounded,
        remaining: Math.max(0, Math.round((cap - rounded) * 1000) / 1000),
        exceeded: rounded > cap,
    };
}

/**
 * Over maximal théorique absorbable par la densité restante (« over max » affiché
 * au vendeur = ⌊restant / densité par point⌋).
 */
export function maxOverFromRemaining(
    definition: FmEffectDefinition,
    remainingDensity: number
): number {
    if (definition.unitWeight <= 0 || remainingDensity <= 0) return 0;
    return Math.max(0, Math.floor(remainingDensity / definition.unitWeight));
}

/** Ligne pesée par `computeItemWeight()` (jet **natif absolu**, pas l'over). */
export type FmItemWeightLine = {
    /** Densité par point de la ligne (référentiel FM). */
    unitWeight: number;
    /** Valeur du jet : positive = bonus, **négative = malus qui allège** l'objet. */
    value: number;
};

/**
 * 🧮 S4.0d — **poids FM total** d'un objet = **Σ (valeur × densité/pt)** sur
 * l'ensemble de ses lignes (jets natifs **absolus**).
 *
 * ⚠️ Ne **remplace pas** `computeFmBudget()` (surplus face au plafond 101) : il le
 * **complète** — ne pas confondre avec les **pods** d'inventaire (`GameItem.realWeight`,
 * pied de carte). Le signe est conservé : un malus **allège** l'objet.
 *
 * Référence vérifiée (§12.8.4) : `Anneau du Cycloïde` (id 14092) → **482** au jet
 * parfait, **355,3** au jet minimum, plafond FM **583** (= 482 + 101).
 */
export function computeItemWeight(lines: FmItemWeightLine[]): number {
    const total = lines.reduce((sum, line) => {
        if (!Number.isFinite(line.unitWeight) || !Number.isFinite(line.value)) return sum;
        return sum + line.unitWeight * line.value;
    }, 0);
    return Math.round(total * 1000) / 1000;
}

