/**
 * 🔤 **Lignes de statistiques d'un objet** — règle pure, **source unique** de la lecture des
 * effets natifs (catalogue `GameItem.nativeEffects`, repli `GameItem.effects`).
 *
 * 🎯 Pourquoi ce module existe (constats mesurés du 26/10/2026) :
 *
 *   1. **`characteristic: 0` n'est pas une caractéristique.** DofusDB range dans `effects` des
 *      **métadonnées** dont la caractéristique vaut `0` : traits de monture (`3829`, `3831`…),
 *      portées de sort (`281`–`297`), titres (`724`), jauges (`720`…). L'ancien code faisait
 *      `characteristic ?? effectId` — or `0` n'est **pas** `null` : le repli ne prenait jamais,
 *      et `case 0: "vi"` créditait la ligne en **Vitalité**. Mesure : Dragodinde Dorée et Indigo
 *      affichait `5401` PV (`400 + 1 + 5000`), Volkorne/Muldo `5001`, Casque Keutumedi `93 545`.
 *      Portée : **452 fiches** (308 montures + ~144 autres équipements).
 *
 *   2. **Un même nombre ne veut pas dire la même chose dans les deux espaces d'ids.** La table
 *      historique mélangeait `characteristic` et `effectId` dans un seul `switch` : `123` y
 *      valait « Chance » (effectId) alors que la caractéristique `123` est **« Sorts (%) »**,
 *      `124` « Sagesse » (effectId) alors que la caractéristique `124` est **« Mêlée (%) »**,
 *      `125` « Vitalité » (effectId) alors que la caractéristique `125` est **« Mêlée (%) »**.
 *      Mesure : Arcaniste (trophée 30455) affichait « Chance +6 / 121 -6 / Sagesse -6 » pour
 *      `+6 % Dommages sorts / -6 % Rés. distance / -6 % Rés. mêlée`. Portée : **60 fiches**
 *      (boucliers, dagues, épées, capes, trophées…).
 *
 * ⚖️ **Règle unique** : la **caractéristique d'abord** (elle est univoque), l'`effectId` en
 * repli (lignes héritées sans caractéristique), et **jamais** un code non cartographié — un
 * effet inconnu est *ignoré*, pas affiché « 3829 » ni « at ». Les libellés/icônes restent
 * résolus par le référentiel (`VARIANT_STAT_FILTERS` / `GameCharacteristic`).
 *
 * ⚠️ Ce module ne décide **pas** si une panoplie est refusable : voir `item-sets-siphon`
 * (`isUnmappedCharacteristic`), qui doit continuer de refuser une **stat** non cartographiée
 * alors qu'une **métadonnée** est simplement ignorée.
 */

import { getStatLabel } from "./dofus-variant-utils";

/** Traduction d'une **caractéristique** DofusDB (`/characteristics`) vers un code court. */
export const CHARACTERISTIC_CODES: Readonly<Record<number, string>> = {
    // Vitals & élémentaires (mesurés le 26/10/2026 sur `/characteristics`)
    1: "pa",
    23: "pm",
    19: "po",
    11: "vi",
    10: "fo",
    15: "in",
    13: "ch",
    14: "ag",
    12: "sa",
    25: "pu",
    18: "cc",
    49: "so",
    26: "invo",
    44: "ini",
    48: "pp",
    16: "df",
    78: "fu",
    79: "ta",
    27: "epa",
    28: "epm",
    80: "rpa",
    83: "rpm",
    84: "dp",
    85: "rp",
    86: "dc",
    87: "rc",
    40: "pod",
    50: "rv",
    // Dommages / résistances par élément (88–92 = dommages, 33–37 = % rés., 54–58 = fixe)
    88: "dtf",
    89: "dff",
    90: "def",
    91: "daf",
    92: "dnf",
    33: "rtp",
    34: "rfp",
    35: "rep",
    36: "rap",
    37: "rnp",
    54: "rt",
    55: "rf",
    56: "re",
    57: "ra",
    58: "rn",
    // % dommages (120–125 mesurés le 26/10/2026 : `dealt*` = dégâts, `received*` = résistance)
    120: "di",
    121: "rd",
    122: "da",
    123: "ds",
    124: "rm",
    125: "dm",
    // Pièges
    69: "ppi",
    70: "dpi",
};


/**
 * Traduction d'un **`effectId`** (`/effects`) vers un code court — **repli uniquement**.
 *
 * Seuls les ids qui ne peuvent pas être confondus avec une caractéristique sont listés : les
 * petits ids (≤ 92) et les ids `10`/`11`/`12`… existent dans **les deux** espaces avec des sens
 * différents (`10` = « Attitude » comme effet, « Force » comme caractéristique) ; les inclure ici
 * réintroduirait exactement le bug de la table plate.
 */
export const EFFECT_CODES: Readonly<Record<number, string>> = {
    111: "pa",
    112: "df",
    115: "cc",
    117: "po",
    118: "fo",
    119: "ag",
    123: "ch",
    125: "vi",
    126: "in",
    128: "pm",
    138: "pu",
    159: "pod",
    160: "epa",
    161: "epm",
    162: "epa",
    163: "epm",
    174: "ini",
    176: "pp",
    178: "so",
    182: "invo",
    410: "rpa",
    411: "rpa",
    412: "rpm",
    413: "rpm",
    414: "dp",
    416: "rp",
    418: "dc",
    420: "rc",
    422: "dtf",
    424: "dff",
    426: "def",
    428: "daf",
    430: "dnf",
    431: "dnf",
    752: "fu",
    753: "ta",
    755: "ta",
};

/**
 * Effets **jamais statistiques** (mesurés en base le 26/10/2026, `GameItem.nativeEffects`) :
 *
 *   · `3825`–`3844` traits de monture (« Sage », « Endurante », « Fertile »…) — `category 6`,
 *     `showInTooltip: false`, `characteristic: 0` ; c'est ce bloc qui fabriquait les 5 000 PV ;
 *   · `281`–`297` descripteurs de sorts (« #1 : +#3 Portée maximale », `hideValueInTooltip`) ;
 *   · `720`–`725` « Nombre de victimes », « Titre », « Renommer la guilde », « Ajouter un sort
 *     temporaire » ; `812` « #2/#3 » ; `130` « Vole des kamas » ; `983`/`984` métadonnées
 *     (« Échangeable », « Compatible avec ») ; `1175` capacité légendaire (déjà écartée par le
 *     Marché, cf. `NON_STAT_EFFECT_IDS` de `src/lib/market/effects.ts`) ;
 *   · `10` « Attitude » (émote : la valeur est un id d'attitude — l'ancienne carte de build
 *     affichait « at +185 »).
 */
export const NON_STAT_EFFECT_IDS: readonly number[] = [
    10, 130, 281, 282, 283, 286, 287, 288, 289, 290, 291, 293, 295, 297,
    720, 721, 722, 723, 724, 725, 812, 983, 984, 1175,
];

const NON_STAT_EFFECT_RANGES: ReadonlyArray<readonly [number, number]> = [[3825, 3844]];

const NON_STAT_EFFECT_SET = new Set<number>(NON_STAT_EFFECT_IDS);

/** La ligne porte-t-elle une **métadonnée** (titre, trait, portée de sort…) et non une stat ? */
export function isNonStatEffectId(effectId: number | null | undefined): boolean {
    if (typeof effectId !== "number" || !Number.isFinite(effectId) || effectId <= 0) return false;
    if (NON_STAT_EFFECT_SET.has(effectId)) return true;
    return NON_STAT_EFFECT_RANGES.some(([min, max]) => effectId >= min && effectId <= max);
}

/** Ligne brute telle qu'elle sort de `GameItem.nativeEffects` (ou des `effects` DofusDB). */
export interface NativeStatLineLike {
    characteristic?: unknown;
    effectId?: unknown;
    int_id?: unknown;
    from?: unknown;
    to?: unknown;
    min?: unknown;
    max?: unknown;
    value?: unknown;
    diceNum?: unknown;
    diceSide?: unknown;
    isNegative?: unknown;
}

function toNumber(raw: unknown): number | null {
    if (raw === null || raw === undefined || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

/**
 * Code de stat d'une ligne, ou `null` si la ligne n'est pas une statistique.
 *
 * Ordre **strict** : caractéristique (`> 0`) → `effectId` → rien. Un code non cartographié est
 * refusé (jamais « 3829 », jamais « at »).
 */
export function resolveStatLineCode(line: {
    characteristic?: unknown;
    effectId?: unknown;
}): string | null {
    const characteristic = toNumber(line.characteristic);
    if (characteristic !== null && characteristic > 0) {
        const byCharacteristic = CHARACTERISTIC_CODES[characteristic];
        if (byCharacteristic) return byCharacteristic;
    }
    const effectId = toNumber(line.effectId);
    if (effectId !== null && effectId > 0) {
        if (isNonStatEffectId(effectId)) return null;
        const byEffect = EFFECT_CODES[effectId];
        if (byEffect) return byEffect;
    }
    return null;
}

/** Ligne exploitable par les écrans (aucune ligne non résolue ne sort d'ici). */
export interface ItemStatLine {
    code: string;
    label: string;
    value: number;
    min: number;
    max: number;
    isNegative: boolean;
}

/** Borne de sécurité : un objet ne porte jamais 60 lignes de statistiques. */
export const MAX_STAT_LINES = 60;

/**
 * Lit les statistiques d'un objet depuis ses **effets natifs** (repli `effects`).
 *
 * ⚠️ Aucune ligne n'est **inventée** : une métadonnée, un effet inconnu ou une valeur nulle est
 * ignoré. Plusieurs lignes d'un même code se **cumulent** (comportement historique de la modale).
 */
export function readItemStatLines(item: {
    nativeEffects?: unknown;
    effects?: unknown;
} | null | undefined): ItemStatLine[] {
    if (!item) return [];
    const source =
        Array.isArray(item.nativeEffects) && item.nativeEffects.length > 0
            ? (item.nativeEffects as NativeStatLineLike[])
            : Array.isArray(item.effects)
              ? (item.effects as NativeStatLineLike[])
              : [];

    const stats = new Map<string, ItemStatLine>();

    for (const fx of source) {
        if (!fx || typeof fx !== "object" || stats.size >= MAX_STAT_LINES) continue;

        const from = toNumber(fx.from ?? fx.min ?? fx.diceNum ?? fx.value) ?? 0;
        const to = toNumber(fx.to ?? fx.max) ?? (toNumber(fx.diceSide) || from);
        const value = Math.max(from, to);
        if (value === 0) continue;

        const effectId = toNumber(fx.effectId ?? fx.int_id);
        if (isNonStatEffectId(effectId)) continue;

        const code = resolveStatLineCode({ characteristic: fx.characteristic, effectId });
        if (!code) continue;

        const isNegative = fx.isNegative === true || value < 0;
        const signedValue = isNegative ? -Math.abs(value) : Math.abs(value);
        const min = Math.min(from, to);
        const max = Math.max(from, to);
        const previous = stats.get(code);
        if (previous) {
            previous.value += signedValue;
            previous.max += max;
            continue;
        }
        stats.set(code, {
            code,
            label: getStatLabel(code),
            value: signedValue,
            min,
            max,
            isNegative,
        });
    }

    return [...stats.values()];
}

