/**
 * Module « Marché » — référentiel de **la forge réelle** (S8.1 · décisions D40/D41).
 *
 * ⚠️ Fichier **PUR** (aucune dépendance React / Prisma) → importable côté client
 * comme côté serveur, exactement comme `fm-effects.ts`.
 *
 * 🎯 Rôle : décrire les **deux mécaniques de forge DofusDB** que le module ne
 * savait pas représenter jusqu'ici :
 *
 *   1. **Rune de Transcendance** (`GameItem.typeId = 211`, 81 items en base) :
 *      pose un bonus **définitif** et **empêche les futures forgemagies** (D40).
 *      Le bonus est porté par `effects[].from` (le `to` vaut `0` dans le siphon).
 *      Les 3 paliers sont **Ta** / **PaTa** / **RaTa**.
 *   2. **Potion de forgemagie** (`GameItem.typeId = 26`) : fixe l'**élément de
 *      frappe** d'une arme (Feu / Eau / Terre / Air) et conserve
 *      50 / 65 / 80 % des dégâts selon le palier.
 *
 * 🔌 **Data-driven (D41)** : la source de vérité est la table `GameItem` (siphon
 * DofusDB `/items`, **aucun nouveau siphon**). Ce fichier ne contient donc que :
 *   - la **structure stable** (paliers, libellés, éléments, taux, libellé
 *     « Empêche les futures forgemagies ») — c'est de la donnée de jeu figée ;
 *   - les **parseurs purs** qui transforment une ligne `GameItem` en modèle.
 * Le pont vers la base est fait côté serveur par `getSmithmagicReferential()`
 * (S8.3, `src/server/actions/market-actions.ts`).
 *
 * ⚠️ Rappel D34/D35 : rien ici ne **bloque** un over/exo. La seule règle
 * bloquante est celle de D40 (recalc serveur, S8.11) : un objet **déclaré
 * transcendé** ne peut pas porter d'over/exo.
 *
 * 📌 Vérifié en base locale le 12/09/2026 : `typeId 211` = **81** runes
 * (36 Ta + 25 PaTa + 20 RaTa) · `typeId 26` = **8** potions siphonnées sur les
 * **12** existantes (le palier 65 % — Flambée / Éboulement / Averse / Rafale —
 * n'est pas encore dans `GameItem` ⇒ il est fourni **statiquement** ci-dessous et
 * sera repris automatiquement dès que le siphon l'aura ramené).
 */

import { FM_TRANSCENDENCE_LABEL } from "./fm-effects";

/** `typeId` DofusDB des **runes de Transcendance**. */
export const SMITHMAGIC_TRANSCENDENCE_TYPE_ID = 211;
/** `typeId` DofusDB des **potions de forgemagie** (élément de frappe). */
export const SMITHMAGIC_ELEMENT_POTION_TYPE_ID = 26;

/**
 * Libellé d'effet officiel d'un objet transcendé (encyclopédie DOFUS).
 * **Source unique** : `FM_TRANSCENDENCE_LABEL` dans `fm-effects.ts` (S8.2).
 */
export const TRANSCENDENCE_LABEL = FM_TRANSCENDENCE_LABEL;

/** Les 3 paliers de Transcendance, du plus faible au plus fort. */
export const SMITHMAGIC_PALIERS = ["Ta", "PaTa", "RaTa"] as const;
export type SmithmagicPalier = (typeof SMITHMAGIC_PALIERS)[number];

/** Éléments de frappe possibles après application d'une potion de forgemagie. */
export const SMITHMAGIC_ELEMENTS = ["Feu", "Eau", "Terre", "Air", "Neutre"] as const;
export type SmithmagicElement = (typeof SMITHMAGIC_ELEMENTS)[number];

/** Paliers de conservation des dégâts par les potions de forgemagie. */
export const SMITHMAGIC_POTION_TIERS = [50, 65, 80] as const;
export type SmithmagicPotionTier = (typeof SMITHMAGIC_POTION_TIERS)[number];

/** Rune de Transcendance résolue (issue d'une ligne `GameItem`). */
export type TranscendenceRune = {
    /** `ankamaId` DofusDB (identifiant stable de l'item). */
    ankamaId: number;
    /** Nom exact en base (« Rune Ta Age »). */
    name: string;
    /** Palier Ta / PaTa / RaTa. */
    palier: SmithmagicPalier;
    /** Niveau DofusDB de l'objet-rune. */
    level: number;
    /** `effectId` DofusDB du bonus porté par la rune. */
    effectId: number;
    /** Libellé FR du bonus (« Agilité », « Dommages Feu »). */
    statLabel: string;
    /** Valeur du bonus accordé (issue de `effects[].from`). */
    bonus: number;
    /**
     * S8.9 — **icône officielle** de la rune (proxy `/api/assets-dofus/items`).
     * Dérivée de l'`ankamaId` : jamais une image cassée (le proxy a un repli).
     */
    iconUrl: string | null;
};

/** Potion de forgemagie résolue (élément de frappe). */
export type ElementPotion = {
    /** `ankamaId` DofusDB si la ligne est présente en base, sinon `null`. */
    ankamaId: number | null;
    /** Nom exact en base (« Potion de Secousse »). */
    name: string;
    /** Élément de frappe appliqué à l'arme. */
    element: SmithmagicElement;
    /** Palier de conservation des dégâts (50 / 65 / 80 %). */
    tier: SmithmagicPotionTier;
    /**
     * S8.9 — icône officielle de la potion siphonnée, `null` quand la ligne
     * n'est **pas** en base (palier 65 %) : l'UI retombe alors sur l'icône de
     * l'**élément** (`StatIcon`), jamais sur une image cassée.
     */
    iconUrl: string | null;
};

/** Forme minimale d'une ligne `GameItem` exploitée par les parseurs (pure). */
export type SmithmagicItemRow = {
    ankamaId: number;
    name: string;
    level?: number | null;
    nativeEffects?: unknown;
    effects?: unknown;
};

// ---------------------------------------------------------------------------
// POTIONS DE FORGEMAGIE — élément de frappe
// ---------------------------------------------------------------------------

/**
 * Les **12 potions de forgemagie** (3 paliers × 4 éléments). Le mapping
 * nom → élément/palier est de la **connaissance de jeu stable** ; il est donc
 * déclaré ici (et non lu en base) pour couvrir le palier 65 % encore absent du
 * siphon. `ankamaId` est utilisé pour reconnaître une ligne `GameItem` ; il vaut
 * `null` pour les potions non encore siphonnées.
 */
export const ELEMENT_POTION_DEFINITIONS: ReadonlyArray<{
    name: string;
    aliases: readonly string[];
    element: SmithmagicElement;
    tier: SmithmagicPotionTier;
    ankamaId: number | null;
}> = [
    { name: "Potion d'Étincelle", aliases: ["etincelle"], element: "Feu", tier: 50, ankamaId: 1333 },
    { name: "Potion de Crachin", aliases: ["crachin"], element: "Eau", tier: 50, ankamaId: 1335 },
    { name: "Potion de Secousse", aliases: ["secousse"], element: "Terre", tier: 50, ankamaId: 1338 },
    { name: "Potion de Courant d'Air", aliases: ["courant d'air"], element: "Air", tier: 50, ankamaId: 1337 },
    { name: "Potion de Flambée", aliases: ["flambee"], element: "Feu", tier: 65, ankamaId: null },
    { name: "Potion d'Averse", aliases: ["averse"], element: "Eau", tier: 65, ankamaId: null },
    { name: "Potion d'Éboulement", aliases: ["eboulement"], element: "Terre", tier: 65, ankamaId: null },
    { name: "Potion de Rafale", aliases: ["rafale"], element: "Air", tier: 65, ankamaId: null },
    { name: "Potion d'Incendie", aliases: ["incendie"], element: "Feu", tier: 80, ankamaId: 1345 },
    { name: "Potion de Tsunami", aliases: ["tsunami"], element: "Eau", tier: 80, ankamaId: 1346 },
    { name: "Potion de Séisme", aliases: ["seisme"], element: "Terre", tier: 80, ankamaId: 1348 },
    { name: "Potion d'Ouragan", aliases: ["ouragan"], element: "Air", tier: 80, ankamaId: 1347 },
];

// ---------------------------------------------------------------------------
// ICÔNES OFFICIELLES (S8.9) — exigence user : des assets dans les listes
// ---------------------------------------------------------------------------

/**
 * Base du proxy d'assets DofusDB (route `src/app/api/assets-dofus/[type]/[id]`).
 * Elle siphonne l'image au premier appel et **ne renvoie jamais 404** (repli
 * SVG intégré) ⇒ l'UI peut toujours afficher l'icône d'un item siphonné.
 */
export const DOFUSDB_ITEM_ASSET_BASE = "/api/assets-dofus/items";

/**
 * URL de l'icône officielle d'un item DofusDB, `null` si l'`ankamaId` est
 * inconnu (`null`, non entier ou ≤ 0). Fonction **pure** : le repli
 * d'affichage appartient à l'appelant.
 */
export function smithmagicItemIconUrl(ankamaId: number | null | undefined): string | null {
    return typeof ankamaId === "number" && Number.isInteger(ankamaId) && ankamaId > 0
        ? `${DOFUSDB_ITEM_ASSET_BASE}/${ankamaId}`
        : null;
}

/**
 * S8.9 — asset DofusBook (`/assets/dofus/stats/<asset>`, cf.
 * `dofusStatAssetUrl`) de l'icône d'un **élément de frappe**. C'est le repli
 * d'affichage d'une potion non siphonnée (palier 65 %) : jamais d'image cassée.
 */
export const STRIKE_ELEMENT_ASSET: Record<SmithmagicElement, string> = {
    Feu: "feu.png",
    Eau: "eau.png",
    Terre: "terre.png",
    Air: "air.png",
    Neutre: "neutre.png",
};

/**
 * Icône d'une **potion de forgemagie** : l'asset siphoné quand il existe, sinon
 * `null` (les 4 potions du palier 65 % ne sont pas encore dans `GameItem`) ⇒
 * l'UI affiche l'icône de l'**élément** à la place.
 */
export function elementPotionIconUrl(potion: { ankamaId: number | null }): string | null {
    return smithmagicItemIconUrl(potion.ankamaId);
}

/** Nom d'asset DofusBook d'un élément de frappe (jamais `null`). */
export function strikeElementAsset(element: SmithmagicElement): string {
    return STRIKE_ELEMENT_ASSET[element] ?? STRIKE_ELEMENT_ASSET.Neutre;
}

/** Normalise un libellé pour comparaison (accents/apostrophes/espaces). */
export function normalizeSmithmagicKey(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[\u2019']/g, " ")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Résout l'**élément de frappe** d'après un libellé (nom de potion OU nom
 * d'élément). Ex. « Potion de Secousse » → `Terre`, « air » → `Air`.
 */
export function resolveStrikeElement(label: string | null | undefined): SmithmagicElement | null {
    if (!label) return null;
    const key = normalizeSmithmagicKey(label);
    for (const element of SMITHMAGIC_ELEMENTS) {
        if (normalizeSmithmagicKey(element) === key) return element;
    }
    for (const definition of ELEMENT_POTION_DEFINITIONS) {
        if (normalizeSmithmagicKey(definition.name) === key) return definition.element;
        if (definition.aliases.some((alias) => normalizeSmithmagicKey(alias) === key)) {
            return definition.element;
        }
    }
    return null;
}

/** Résout la potion de forgemagie d'une ligne `GameItem` (par nom ou `ankamaId`). */
export function parseElementPotion(row: SmithmagicItemRow): ElementPotion | null {
    const key = normalizeSmithmagicKey(row.name);
    const definition = ELEMENT_POTION_DEFINITIONS.find(
        (candidate) =>
            normalizeSmithmagicKey(candidate.name) === key || candidate.ankamaId === row.ankamaId
    );
    if (!definition) return null;
    return {
        ankamaId: row.ankamaId,
        name: definition.name,
        element: definition.element,
        tier: definition.tier,
        iconUrl: smithmagicItemIconUrl(row.ankamaId),
    };
}

/** Résout les potions présentes dans un lot de lignes `GameItem`. */
export function parseElementPotions(rows: SmithmagicItemRow[]): ElementPotion[] {
    const potions: ElementPotion[] = [];
    for (const row of rows) {
        const potion = parseElementPotion(row);
        if (potion) potions.push(potion);
    }
    return potions;
}

/**
 * Référentiel **complet** des 12 potions (S8.3) : les définitions canoniques,
 * enrichies de l'`ankamaId` réel quand la ligne existe en base. Une potion non
 * siphonnée garde `ankamaId: null` (elle reste proposable en saisie manuelle) —
 * l'éditeur n'est donc **jamais** amputé par un siphon partiel.
 */
export function resolveElementPotions(rows: SmithmagicItemRow[]): ElementPotion[] {
    const idsByName = new Map<string, number>();
    for (const row of rows) {
        idsByName.set(normalizeSmithmagicKey(row.name), row.ankamaId);
    }
    return ELEMENT_POTION_DEFINITIONS.map((definition) => {
        const dbId = idsByName.get(normalizeSmithmagicKey(definition.name));
        const ankamaId = typeof dbId === "number" ? dbId : definition.ankamaId;
        return {
            ankamaId,
            name: definition.name,
            element: definition.element,
            tier: definition.tier,
            iconUrl: smithmagicItemIconUrl(ankamaId),
        };
    });
}

/** Éléments **obtenables** par une potion de forgemagie (Feu / Eau / Terre / Air). */
export const ELEMENT_POTION_ELEMENTS: readonly SmithmagicElement[] = Array.from(
    new Set(ELEMENT_POTION_DEFINITIONS.map((definition) => definition.element))
);

/** Construit la potion canonique d'une définition (jamais de donnée inventée). */
function toElementPotion(definition: (typeof ELEMENT_POTION_DEFINITIONS)[number]): ElementPotion {
    return {
        ankamaId: definition.ankamaId,
        name: definition.name,
        element: definition.element,
        tier: definition.tier,
        iconUrl: smithmagicItemIconUrl(definition.ankamaId),
    };
}

/**
 * S8.9/S8.11 — potion du référentiel par `ankamaId`, `null` si l'identifiant
 * n'est pas celui d'une potion de forgemagie connue (jamais d'invention).
 */
export function findElementPotionByAnkamaId(
    ankamaId: number | null | undefined
): ElementPotion | null {
    if (typeof ankamaId !== "number" || !Number.isInteger(ankamaId)) return null;
    const definition = ELEMENT_POTION_DEFINITIONS.find((candidate) => candidate.ankamaId === ankamaId);
    if (!definition) return null;
    return { ...toElementPotion(definition), ankamaId };
}

/** Potion du référentiel par nom exact ou alias (« Potion de Secousse »). */
export function findElementPotionByName(name: string | null | undefined): ElementPotion | null {
    if (!name) return null;
    const key = normalizeSmithmagicKey(name);
    const definition = ELEMENT_POTION_DEFINITIONS.find(
        (candidate) =>
            normalizeSmithmagicKey(candidate.name) === key ||
            candidate.aliases.some((alias) => normalizeSmithmagicKey(alias) === key)
    );
    return definition ? toElementPotion(definition) : null;
}

/**
 * Potion d'une combinaison **élément × palier** (les 12 combinaisons existent en
 * jeu) — c'est la garde de cohérence de S8.11 : un élément sans potion pour le
 * palier déclaré est refusé.
 */
export function findElementPotionByElementTier(
    element: string | null | undefined,
    tier: number | null | undefined
): ElementPotion | null {
    if (!element || typeof tier !== "number") return null;
    const resolved = resolveStrikeElement(element);
    if (!resolved) return null;
    const definition = ELEMENT_POTION_DEFINITIONS.find(
        (candidate) => candidate.element === resolved && candidate.tier === tier
    );
    return definition ? toElementPotion(definition) : null;
}

// ---------------------------------------------------------------------------
// BLOC STATUT — description affichée sur la carte d'item (S8.4)
// ---------------------------------------------------------------------------

export type SmithmagicStatusKind = "TRANSCENDED" | "STRIKE_ELEMENT" | "HUNTING_WEAPON";

export type SmithmagicStatusLine = {
    kind: SmithmagicStatusKind;
    label: string;
    /** Valeur courte, prête à afficher (« Feu », « Arc de Chasse »). */
    value?: string | null;
};

export type SmithmagicStatusInput = {
    /** Objet **déclaré** transcendé (D40 — jamais déduit du jet). */
    transcended?: boolean;
    /** Libellé d'effet affiché (repli : `TRANSCENDENCE_LABEL`). */
    transcendenceLabel?: string | null;
    /** Élément de frappe déclaré (arme). */
    strikeElement?: string | null;
    /** Arme de chasse déclarée. */
    huntingWeapon?: string | null;
};

/**
 * Construit les lignes du **bloc STATUT** de la carte (S8.4), dans l'ordre
 * d'affichage validé : Transcendance → Élément de frappe → Arme de chasse.
 * Une ligne n'apparaît que si l'information est **déclarée** (jamais déduite).
 *
 * 📌 `MarketItemCard` ne fait **que** rendre le résultat de cette fonction : le
 * mapping carte → lignes est donc couvert par des tests unitaires purs.
 */
export function describeSmithmagicStatus(input: SmithmagicStatusInput): SmithmagicStatusLine[] {
    const lines: SmithmagicStatusLine[] = [];
    if (input.transcended) {
        lines.push({
            kind: "TRANSCENDED",
            label: input.transcendenceLabel?.trim() || TRANSCENDENCE_LABEL,
        });
    }
    const element = resolveStrikeElement(input.strikeElement);
    if (element) {
        lines.push({ kind: "STRIKE_ELEMENT", label: "Élément de frappe", value: element });
    }
    if (input.huntingWeapon) {
        lines.push({ kind: "HUNTING_WEAPON", label: "Arme de chasse", value: input.huntingWeapon });
    }
    return lines;
}

// ---------------------------------------------------------------------------
// RUNES DE TRANSCENDANCE — code du nom → libellé FR
// ---------------------------------------------------------------------------

/**
 * Le nom d'une rune encode son effet sous forme **abrégée Dofus**
 * (« Rune Ta Ré Per Di » = palier *Ta*, *Résistance % Distance*). C'est cette
 * abréviation qui fait foi : les libellés `GameEffect` de certains `effectId`
 * exotiques sont ambigus (ex. `2800` et `2803` renvoient tous deux
 * « Mêlée (%) »). La clé est le code **normalisé** (accents retirés, minuscules,
 * espaces réduits).
 */
export const RUNE_CODE_LABELS: Record<string, string> = {
    age: "Agilité",
    cha: "Chance",
    cri: "Critique",
    "do air": "Dommages Air",
    "do cri": "Dommages Critiques",
    "do eau": "Dommages Eau",
    "do feu": "Dommages Feu",
    "do neutre": "Dommages Neutre",
    "do per ar": "Dommages Armes (%)",
    "do per di": "Dommages Distance (%)",
    "do per me": "Dommages Mêlée (%)",
    "do per so": "Dommages Sorts (%)",
    "do pou": "Dommages Poussée",
    "do terre": "Dommages Terre",
    fo: "Force",
    fui: "Fuite",
    ine: "Intelligence",
    ini: "Initiative",
    pod: "Pods",
    pui: "Puissance",
    "re cri": "Résistance Critiques",
    "re pa": "Esquive PA",
    "re per air": "Résistance % Air",
    "re per di": "Résistance Distance (%)",
    "re per eau": "Résistance % Eau",
    "re per feu": "Résistance % Feu",
    "re per me": "Résistance Mêlée (%)",
    "re per neutre": "Résistance % Neutre",
    "re per terre": "Résistance % Terre",
    "re pme": "Esquive PM",
    "re pou": "Résistance Poussée",
    "ret pa": "Retrait PA",
    "ret pme": "Retrait PM",
    so: "Soins",
    tac: "Tacle",
    vi: "Vitalité",
};

/** Normalise un code de rune (« Ré Per Di » → `re per di`). */
export function normalizeRuneCode(code: string): string {
    return code
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

/** Découpe un nom de rune : `{ palier, code }` — `null` si le nom ne colle pas. */
export function parseTranscendenceRuneName(
    name: string | null | undefined
): { palier: SmithmagicPalier; code: string } | null {
    if (!name) return null;
    const match = /^\s*Rune\s+(Ta|Pata|Rata)\s+(.+?)\s*$/i.exec(name);
    if (!match) return null;
    const rawPalier = match[1].toLowerCase();
    const palier: SmithmagicPalier = rawPalier === "ta" ? "Ta" : rawPalier === "pata" ? "PaTa" : "RaTa";
    return { palier, code: normalizeRuneCode(match[2]) };
}

/** Premier effet d'une valeur JSON tolérante (formes `from`/`to` / `diceNum`). */
function firstEffectBonus(...sources: unknown[]): { effectId: number | null; bonus: number } {
    for (const source of sources) {
        if (!Array.isArray(source) || source.length === 0) continue;
        const fx = source[0] as Record<string, unknown> | null;
        if (!fx || typeof fx !== "object") continue;
        const rawId = fx.effectId ?? fx.int_id;
        const effectId = typeof rawId === "number" ? rawId : null;
        // `from` est la valeur du bonus ; `to` vaut `0` dans le siphon des runes.
        const rawBonus = fx.from ?? fx.diceNum ?? fx.to;
        const bonus = typeof rawBonus === "number" ? rawBonus : 0;
        return { effectId, bonus };
    }
    return { effectId: null, bonus: 0 };
}

/**
 * Transforme une ligne `GameItem` (`typeId 211`) en `TranscendenceRune`.
 * Renvoie `null` si le nom n'est pas une rune de Transcendance reconnaissable.
 */
export function parseTranscendenceRune(row: SmithmagicItemRow): TranscendenceRune | null {
    const parsed = parseTranscendenceRuneName(row.name);
    if (!parsed) return null;
    const statLabel = RUNE_CODE_LABELS[parsed.code];
    if (!statLabel) return null;
    const { effectId, bonus } = firstEffectBonus(row.nativeEffects, row.effects);
    return {
        ankamaId: row.ankamaId,
        name: row.name,
        palier: parsed.palier,
        level: typeof row.level === "number" ? row.level : 0,
        effectId: effectId ?? -1,
        statLabel,
        bonus,
        iconUrl: smithmagicItemIconUrl(row.ankamaId),
    };
}

/** Résout l'ensemble des runes d'un lot de lignes `GameItem` (data-driven). */
export function parseTranscendenceRunes(rows: SmithmagicItemRow[]): TranscendenceRune[] {
    const runes: TranscendenceRune[] = [];
    for (const row of rows) {
        const rune = parseTranscendenceRune(row);
        if (rune) runes.push(rune);
    }
    return runes.sort(
        (a, b) => a.palier.localeCompare(b.palier) || a.statLabel.localeCompare(b.statLabel, "fr")
    );
}

