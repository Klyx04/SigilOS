/**
 * Module « Marché » (S2) — référentiel d'effets & caractéristiques Dofus.
 *
 * ⚠️ Fichier **PUR** : aucune dépendance React / Prisma. Il est consommé par
 * le siphon serveur (`game-item-actions`), l'éditeur de jet FM et la carte d'item.
 *
 * 🔄 S2.5bis — les tables ci-dessous (codées en dur, historiquement dans
 * `ItemSearchPanel.tsx`) sont **doublées par les référentiels siphonnés**
 * `GameEffect` / `GameCharacteristic` : les fonctions acceptent un `referential`
 * optionnel fourni par la base (data-driven) et retombent ici en repli si la
 * base n'est pas encore alimentée (fail-soft).
 */

/**
 * Effet natif d'un item (plage min–max issue du CATALOGUE, jamais du client).
 *
 * Correction 13/09 — deux champs **optionnels** peuvent être **résolus côté
 * serveur** au moment où l'item part vers l'écran de déclaration
 * (`enrichNativeEffects`) :
 *   - `label` : libellé d'infobulle (`resolveStatLabel`) ;
 *   - `isNegative` : la ligne est un **malus** (`GameEffect.isNegativeValue`).
 * Ils ne sont **jamais** obligatoires : une donnée historique (JSONB écrit avant
 * le correctif) retombe sur la résolution runtime — c'est ce qui garantit qu'un
 * référentiel indisponible côté client ne réintroduit ni « Effet » ni « +30 ».
 */
export type MarketNativeEffect = {
    effectId: number;
    characteristic: number | null;
    from: number;
    to: number;
    category: number | null;
    elementId: number | null;
    /** Libellé d'infobulle résolu serveur (facultatif : données historiques). */
    label?: string | null;
    /** `true` si l'effet s'affiche « négatif » (malus) — signe à rétablir. */
    isNegative?: boolean | null;
};

/** Effet DofusDB tolérant (formes `int_id` / `effectId` / `characteristic`). */
export type DofusItemEffectLike = {
    int_id?: number | null;
    effectId?: number | null;
    characteristic?: number | null;
    from?: number | null;
    to?: number | null;
    /**
     * Forme **BRUTE** DofusDB (`/items`) — c'est elle qui est stockée telle
     * quelle dans `GameItem.effects` quand la ligne n'a jamais été re-siphonnée.
     * Tolérée ici pour que les données périmées restent exploitables (S2.12).
     */
    diceNum?: number | null;
    diceSide?: number | null;
    int_name?: string | null;
    category?: number | null;
    elementId?: number | null;
};

/**
 * Libellés FR par `characteristicId` **ou** `effectId` DofusDB (repli hors base).
 *
 * ⚠️ **Valeurs de caractéristiques alignées sur le référentiel siphonné**
 * (`GameCharacteristic`, vérifié en base le 11/09/2026) : `10` = Force, `16` =
 * **Dommages**, `26` = **Invocation**, `27`/`28` = **Esquive PA/PM**, `33`→`37` =
 * résistances élémentaires (%), `40` = Pods, `44` = Initiative, `48` = Prospection,
 * `49` = Soins, `50` = Renvoi.
 * Les ancres historiques étaient **fausses** sur plusieurs de ces ids
 * (`16`/`26`/`27`/`28`/`48`/`49`/`50`) : c'était **la** cause des libellés
 * « Effet » et des mauvaises icônes (§S7.1).
 *
 * Les clés `111`/`117`/`118`/`119`/`123`/`124`/`126`/`128` (PA, PM, Portée,
 * Force, Agilité, Chance, Sagesse, Intelligence), `162`→`165`, `178`,
 * `210`→`214`, `422`→`432`, `752`/`753` sont des **`effectId`** : l'objet ne
 * porte alors pas toujours de `characteristic`. Elles sont alignées sur
 * `EXO_EFFECT_PRESETS`.
 *
 * ⚠️ **Correction 13/09 (2ᵉ passe, constat user sur la Cape de Glourdorak)** —
 * cette table porte désormais le **libellé de l'infobulle du jeu**, vérifié
 * `effectId` par `effectId` contre les **gabarits de description FR** de DofusDB
 * (`/effects/{id}?lang=fr` → « #2 Dommage(s) Critiques », « -#2 Résistance(s)
 * Critiques ») et contre `GameCharacteristic` (121 lignes) :
 *   - la table **prime** désormais sur le référentiel siphonné
 *     (`resolveStatLabel`) : `GameEffect.name` est le nom **court de la
 *     caractéristique** jointe (« Critiques (fixe) », « Terre (%) »), moins
 *     précis que l'infobulle (« Résistance Critiques », « Résistance Terre (%) ») ;
 *   - les **séries de pénalités** (`101/105/116/127/133…431/754/755`) sont
 *     cartographiées au même libellé que leur bonus — le **signe** ne vient
 *     jamais de la table mais de `GameEffect.isNegativeValue` ;
 *   - `112` = **Dommages** (et non « Dommages Critiques » : l'ancienne ancre
 *     désignait la pénalité `105`/`265`), `93`/`141` ne sont **pas** des
 *     « Dommages Neutre » (`141` = **Sorts (%)**).
 */
export const CHAR_NAMES: Record<number, string> = {
    // PA / PM / Portée
    1: "PA",
    111: "PA",
    23: "PM",
    128: "PM",
    19: "Portée",
    117: "Portée",
    // Caractéristiques primaires (ids officiels)
    10: "Force",
    118: "Force",
    11: "Vitalité",
    125: "Vitalité",
    12: "Sagesse",
    124: "Sagesse",
    13: "Chance",
    123: "Chance",
    14: "Agilité",
    119: "Agilité",
    15: "Intelligence",
    126: "Intelligence",
    // Combat
    16: "Dommages",
    18: "Critique",
    115: "Critique (%)",
    25: "Puissance",
    138: "Puissance",
    26: "Invocation",
    182: "Invocations",
    27: "Esquive PA",
    160: "Esquive PA",
    162: "Esquive PA",
    28: "Esquive PM",
    161: "Esquive PM",
    163: "Esquive PM",
    80: "Retrait PA",
    82: "Retrait PA",
    410: "Retrait PA",
    83: "Retrait PM",
    412: "Retrait PM",
    31: "Maitrise d'arme",
    29: "Points d'énergie",
    139: "Points d'énergie",
    40: "Pods",
    158: "Pods",
    44: "Initiative",
    174: "Initiative",
    48: "Prospection",
    176: "Prospection",
    49: "Soins",
    178: "Soins",
    50: "Renvoi",
    54: "Terre (fixe)",
    // Résistances élémentaires (%) — caractéristiques officielles 33→37,
    // relayées par les `effectId` 210→214 (corrigé le 13/09 : `210` = **Terre**,
    // `213` = **Feu** — les deux entrées étaient inversées).
    33: "Résistance Terre (%)",
    210: "Résistance Terre (%)",
    215: "Résistance Terre (%)",
    34: "Résistance Feu (%)",
    213: "Résistance Feu (%)",
    218: "Résistance Feu (%)",
    35: "Résistance Eau (%)",
    211: "Résistance Eau (%)",
    216: "Résistance Eau (%)",
    36: "Résistance Air (%)",
    212: "Résistance Air (%)",
    217: "Résistance Air (%)",
    37: "Résistance Neutre (%)",
    214: "Résistance Neutre (%)",
    219: "Résistance Neutre (%)",
    // Réductions
    20: "Réduction des dégâts magiques",
    21: "Réduction des dégâts physiques",
    /**
     * ⚠️ Correction 13/09 (2ᵉ passe, constat user) — **série de pénalités**.
     *
     * DofusDB porte chaque stat d'objet en **deux** `effectId` : le bonus
     * (`418` = « 21 à 30 Dommages Critiques ») **et** la pénalité
     * (`419` = « -30 Dommages Critiques »). Le libellé est identique ; c'est le
     * référentiel (`GameEffect.isNegativeValue`) qui rétablit le signe. Les deux
     * séries sont donc cartographiées ici : sans cela, un item à malus
     * (« Cape de Glourdorak », `421`) affichait « Effet » puis « +30 ».
     */
    // Dommages élémentaires : bonus 422/424/426/428/430, pénalités 423/425/427/429/431
    // (`432` n'est pas une stat d'objet). Corrigé le 13/09 : `422` = **Terre**,
    // `430` = **Neutre**, `426` = **Eau**, `424` = **Feu**, `428` = **Air**.
    //
    // ⚠️ `91`/`92` sont **ambigus** : comme `effectId` ce sont les lignes « vol
    // de vie » (`91` = 73 items, `92` = 30 items), comme `characteristic` les
    // dommages air/neutre **fixes**. La table retient le sens **`effectId`**
    // (c'est lui qui porte les lignes natives des cartes) ; les caractéristiques
    // 91/92 restent servies par le référentiel siphonné (`GameCharacteristic`).
    88: "Dommages Terre",
    422: "Dommages Terre",
    423: "Dommages Terre",
    89: "Dommages Feu",
    424: "Dommages Feu",
    425: "Dommages Feu",
    90: "Dommages Eau",
    426: "Dommages Eau",
    427: "Dommages Eau",
    91: "Vol de vie Air",
    92: "Vol de vie Terre",
    141: "Sorts (%)",
    428: "Dommages Air",
    429: "Dommages Air",
    430: "Dommages Neutre",
    431: "Dommages Neutre",
    // Dommages fixes (112 = « Dommages », et non « Dommages Critiques » : c'était
    // la pénalité `105`/`265` qui était mal ancrée), critiques et poussée.
    105: "Dommages",
    112: "Dommages",
    265: "Dommages",
    414: "Dommages Poussée",
    415: "Dommages Poussée",
    416: "Résistance Poussée",
    417: "Résistance Poussée",
    84: "Dommages Poussée",
    85: "Résistance Poussée",
    86: "Dommages Critiques",
    418: "Dommages Critiques",
    419: "Dommages Critiques",
    87: "Résistance Critiques",
    420: "Résistance Critiques",
    421: "Résistance Critiques",
    114: "Dommages Poussée",
    164: "Dommages Poussée",
    165: "Dommages (%)",
    // Réductions fixes par élément (240→244) et leurs pénalités (245→249).
    240: "Terre (fixe)",
    245: "Terre (fixe)",
    241: "Eau (fixe)",
    246: "Eau (fixe)",
    242: "Air (fixe)",
    247: "Air (fixe)",
    243: "Feu (fixe)",
    248: "Feu (fixe)",
    244: "Neutre (fixe)",
    249: "Neutre (fixe)",
    // Ancêtres des caractéristiques primaires (`effectId` historiques encore
    // portés par des items : 607/609/610, et les pénalités 152→157, 101/127,
    // 133/134, 168/169, 171).
    607: "Force",
    609: "Agilité",
    610: "Vitalité",
    152: "Chance",
    153: "Vitalité",
    154: "Agilité",
    155: "Intelligence",
    156: "Sagesse",
    157: "Force",
    101: "PA",
    133: "PA",
    168: "PA",
    127: "PM",
    134: "PM",
    169: "PM",
    171: "Critique (%)",
    175: "Initiative",
    177: "Prospection",
    179: "Soins",
    186: "Puissance",
    // Fuite / tacle (bonus 752/753, pénalités 754/755)
    78: "Fuite",
    752: "Fuite",
    754: "Fuite",
    79: "Tacle",
    753: "Tacle",
    755: "Tacle",
    // Vol de vie / soins élémentaires : les noms siphonnés sont des gabarits
    // (« } vol Eau », « } soins Feu ») ⇒ ignorés, donc on les nomme ici
    // (`91`/`92` sont déclarés avec la famille des dommages élémentaires).
    93: "Vol de vie Air",
    94: "Vol de vie Feu",
    95: "Vol de vie Neutre",
    108: "Soins Feu",
    // Dommages de BASE d'une arme (`effectId` 96→100, gabarit « X dommages Y »).
    // La mention « (arme) » est volontaire : la ligne n'est pas forgeable
    // (section « Dommages » de DofusDB) et ne doit pas être confondue avec un
    // bonus « Dommages X » (422/424/426/428/430).
    96: "Dommages Eau (arme)",
    97: "Dommages Terre (arme)",
    98: "Dommages Air (arme)",
    99: "Dommages Feu (arme)",
    100: "Dommages Neutre (arme)",
    // Pénalités des primaires / secondaires (série négative du référentiel).
    116: "Portée",
    145: "Dommages",
    172: "Réduction des dégâts magiques",
    173: "Réduction des dégâts physiques",
    1033: "Vitalité (%)",
    1077: "Résistance (%)",
    1079: "PA",
    1080: "PM",
    1172: "Dommages finaux (%)",
    2415: "Dommages Poussée (%)",
    // « % » mêlée / distance / armes / sorts (2801→2814 : pénalités DofusDB).
    2801: "Dommages mêlée (%)",
    2802: "Résistance mêlée (%)",
    2805: "Dommages distance (%)",
    2806: "Résistance distance (%)",
    2809: "Dommages d'armes (%)",
    2810: "Résistance aux armes (%)",
    2813: "Dommages aux sorts (%)",
    2814: "Résistance aux sorts (%)",
    // « % » des caractéristiques (2835→2861 : toutes des pénalités DofusDB).
    2835: "Force (%)",
    2837: "Agilité (%)",
    2839: "Intelligence (%)",
    2841: "Chance (%)",
    2843: "Sagesse (%)",
    2845: "Vitalité (%)",
    2847: "PA (%)",
    2849: "PM (%)",
    2851: "Tacle (%)",
    2853: "Fuite (%)",
    2855: "Esquive PA (%)",
    2857: "Esquive PM (%)",
    2859: "Retrait PA (%)",
    2861: "Retrait PM (%)",
};


/**
 * Libellés FR par code court historique (`int_name` DofusBook/Solomonk).
 * Sert aussi de table de résolution **icône** (un code = une famille visuelle).
 */
export const BOOK_STAT_NAMES: Record<string, string> = {
    vi: "Vitalité",
    fo: "Force",
    sa: "Sagesse",
    ag: "Agilité",
    in: "Intelligence",
    ch: "Chance",
    pu: "Puissance",
    cc: "Coup Critique",
    dmg: "Dommages",
    ii: "Initiative",
    pi: "Dommages Piège",
    pp: "Prospection",
    po: "Portée",
    pod: "Pods",
    ic: "Invocations",
    pa: "PA",
    pm: "PM",
    ta: "Tacle",
    fu: "Fuite",
    so: "Soins",
    rpa: "Retrait PA",
    epa: "Esquive PA",
    rpm: "Retrait PM",
    epm: "Esquive PM",
    dnf: "Dommages Neutre",
    dtf: "Dommages Terre",
    dff: "Dommages Feu",
    def: "Dommages Eau",
    daf: "Dommages Air",
    rnp: "Résistance Neutre (%)",
    rtp: "Résistance Terre (%)",
    rfp: "Résistance Feu (%)",
    rep: "Résistance Eau (%)",
    rap: "Résistance Air (%)",
    rn: "Résistance Neutre",
    rt: "Résistance Terre",
    rf: "Résistance Feu",
    re: "Résistance Eau",
    ra: "Résistance Air",
    dc: "Dommages Critiques",
    dp: "Résistance Poussée",
    rfc: "Résistance Critiques",
    rp: "Résistance Poussée",
};

/** Slugs d'icônes reconnus (mappés vers des composants lucide par les consommateurs). */
export type StatIconName =
    | "heart" | "brain" | "droplet" | "wind" | "flame" | "sword" | "zap"
    | "footprints" | "target" | "eye" | "star" | "plus" | "shield"
    | "shieldCheck" | "sparkles" | "pkg";

/**
 * Spécification visuelle d'une stat (icône + couleur **token** du design system).
 * Clés = `characteristicId` DofusDB **et** code court historique (`vi`, `fo`, `dmg`…).
 */
export const STAT_ICON_SPECS: Record<string, { icon: StatIconName; color: string }> = {
    // Caractéristiques (ids DofusDB)
    "11": { icon: "heart", color: "text-danger" },
    "125": { icon: "heart", color: "text-danger" },
    "12": { icon: "brain", color: "text-violet-400" },
    "13": { icon: "droplet", color: "text-info" },
    "14": { icon: "wind", color: "text-success" },
    "15": { icon: "flame", color: "text-warning" },
    "16": { icon: "sword", color: "text-warning" },
    "1": { icon: "zap", color: "text-warning" },
    "23": { icon: "footprints", color: "text-success" },
    "18": { icon: "target", color: "text-info" },
    "19": { icon: "eye", color: "text-info" },
    "25": { icon: "star", color: "text-fuchsia-400" },
    "26": { icon: "plus", color: "text-success" },
    "28": { icon: "plus", color: "text-warning" },
    "80": { icon: "shield", color: "text-muted-foreground" },
    "83": { icon: "shield", color: "text-muted-foreground" },
    "412": { icon: "shield", color: "text-muted-foreground" },
    "87": { icon: "shieldCheck", color: "text-danger" },
    // Codes courts (DofusBook / Solomonk)
    vi: { icon: "heart", color: "text-danger" },
    fo: { icon: "sword", color: "text-warning" },
    sa: { icon: "brain", color: "text-violet-400" },
    ag: { icon: "wind", color: "text-success" },
    in: { icon: "flame", color: "text-warning" },
    ch: { icon: "droplet", color: "text-info" },
    pu: { icon: "star", color: "text-fuchsia-400" },
    cc: { icon: "target", color: "text-info" },
    dmg: { icon: "plus", color: "text-danger" },
    ii: { icon: "zap", color: "text-warning" },
    pi: { icon: "sparkles", color: "text-info" },
    pp: { icon: "eye", color: "text-info" },
    po: { icon: "eye", color: "text-info" },
    ic: { icon: "target", color: "text-success" },
    pa: { icon: "zap", color: "text-warning" },
    pm: { icon: "footprints", color: "text-success" },
    ta: { icon: "plus", color: "text-green-500" },
    fu: { icon: "star", color: "text-warning" },
    so: { icon: "heart", color: "text-danger" },
    pod: { icon: "pkg", color: "text-warning" },
    dnf: { icon: "sword", color: "text-muted-foreground" },
    dtf: { icon: "sword", color: "text-warning" },
    dff: { icon: "flame", color: "text-warning" },
    def: { icon: "droplet", color: "text-info" },
    daf: { icon: "wind", color: "text-success" },
    rnp: { icon: "shield", color: "text-muted-foreground" },
    rtp: { icon: "shield", color: "text-warning" },
    rfp: { icon: "shield", color: "text-warning" },
    rep: { icon: "shield", color: "text-info" },
    rap: { icon: "shield", color: "text-success" },
    rn: { icon: "shieldCheck", color: "text-muted-foreground" },
    rt: { icon: "shieldCheck", color: "text-warning" },
    rf: { icon: "shieldCheck", color: "text-warning" },
    re: { icon: "shieldCheck", color: "text-info" },
    ra: { icon: "shieldCheck", color: "text-success" },
    rfc: { icon: "shield", color: "text-danger" },
    rp: { icon: "shield", color: "text-warning" },
    rpa: { icon: "shield", color: "text-muted-foreground" },
    rpm: { icon: "shield", color: "text-muted-foreground" },
    epa: { icon: "shieldCheck", color: "text-info" },
    epm: { icon: "shieldCheck", color: "text-success" },
};

/**
 * S7.4 — **Normalise une plage native**.
 *
 * ⚠️ DofusDB : quand le **second dé est absent**, l'effet est une **valeur
 * fixe** et `diceSide` vaut `0`. Une lecture naïve produit alors `[10 à 0]`
 * (plage décroissante) et fait passer la valeur déclarée pour « sous la plage »
 * alors que l'objet est parfait. Toute plage se terminant à `0` ou décroissante
 * est donc ramenée à la **valeur fixe du premier dé** : on n'invente jamais de
 * plage, et on ne rend jamais une plage décroissante.
 *
 * Appliqué **à l'écriture** (`toNativeEffects`) **et à la lecture**
 * (`findNativeRange`) → les lignes **déjà en base** sont soignées sans
 * migration.
 */
export function normalizeNativeRange(from: number, to: number): { from: number; to: number } {
    const min = Number.isFinite(from) ? from : 0;
    const max = Number.isFinite(to) ? to : min;
    // Second dé **absent** (DofusDB renvoie alors `diceSide = 0`) ⇒ valeur FIXE,
    // y compris pour un malus (`diceNum = -30, diceSide = 0` = « -30 »).
    if (max === 0 && min !== 0) return { from: min, to: min };
    // Plage décroissante **positive** (`10 → 5`, donnée impossible côté DofusDB)
    // ⇒ même conclusion : valeur fixe, jamais « [10 à 5] ».
    if (min > 0 && max < min) return { from: min, to: min };
    // Correction 13/09 (constat user) — une plage **négative décroissante** est
    // LÉGITIME : DofusDB écrit un malus en plage (`from: -6, to: -8` ⇒
    // « **-6 à -8** Esquive PA »). L'ancien test `max < min` l'effondrait en
    // valeur fixe (`-6`), ce qui masquait la borne basse du malus.
    return { from: min, to: max };
}

/**
 * Constat beta (14/09/2026) — **une ligne d'effet sans valeur n'est pas un jet**.
 *
 * 📏 Mesure en base (sonde locale `_probe-cosmetic-noise.mjs`) :
 * DofusDB range dans `GameItem.nativeEffects` des **métadonnées** d'objet,
 * toujours écrites `0 → 0` — `983` « Échangeable : » (**3 330** fiches),
 * `1179` « Compatible avec : » (**2 603**), `811` « Combat restant », `805`
 * « Reçu le : », `981` « Lié au personnage », `149` « Change l'apparence »,
 * `3830` « Fertile », `949` « Monter/Descendre d'une monture », `2825`
 * « Empêche les futures forgemagies »… Portée mesurée : **4 203** fiches
 * `equipment` + **2 196** `cosmetics` (+200 `consumables`, +34 `resources`).
 *
 * Sans cette règle, l'objet `23559` *Gladius Moldus* (monture d'apparat) partait
 * en déclaration avec **deux lignes fantômes** (« +0 Échangeable : [0] »,
 * « +0 Compatible avec : [0] ») : la carte les affichait **et** la garde de
 * famille refusait ensuite la publication (« aucune statistique ne peut être
 * déclarée ») alors que le vendeur n'avait **rien** déclaré — cul-de-sac.
 *
 * ⚠️ Le test porte sur la plage **normalisée** : `2 → 0` (Portée, valeur fixe)
 * et `30 → 0` (malus, valeur fixe) gardent leur valeur et ne sont **jamais**
 * écartés.
 */
export function isStatBearingNativeEffect(fx: Pick<MarketNativeEffect, "from" | "to">): boolean {
    const range = normalizeNativeRange(fx.from, fx.to);
    return range.from !== 0 || range.to !== 0;
}

/**
 * 🧨 Constat beta du **14/09/2026** — la carte d'une *Pestilence de Corruption*
 * (`22412`) affichait **« +15975 Effet [15975] »** (carte d'annonce, image OG et
 * bloc « Jet déclaré »).
 *
 * 📏 Cause **mesurée** (sonde `_probe-effet-15975.mjs` + `api.dofusdb.fr`) :
 * l'`effectId` **1175** est un **porteur de capacité légendaire** — son `diceNum`
 * est l'**identifiant du pouvoir** (« Nuée Pestilentielle » → `15975`), jamais un
 * montant. DofusDB **écarte lui-même** cette ligne de son tableau normalisé
 * `effects` (mesuré sur `/items/22412` : **17** entrées dans la forme brute
 * `possibleEffects`, **16** dans `effects`) ; notre siphon copie la forme brute,
 * d'où la valeur parasite. Portée mesurée : **334** fiches en base.
 *
 * Le libellé du référentiel est un gabarit (« Effet 1175 ») que
 * `isPlaceholderStatLabel` écarte déjà ⇒ l'UI affichait « Effet ».
 *
 * ⚪ La capacité elle-même n'est **pas** une statistique de vente : elle n'est ni
 * affichée, ni déclarable (sa restitution est une évolution, plan §S6/V1.1).
 */
export const NON_STAT_EFFECT_IDS: readonly number[] = [1175];

/** Index du filtre (recherche O(1) sur chaque ligne). */
const NON_STAT_EFFECT_ID_SET = new Set<number>(NON_STAT_EFFECT_IDS);

/** La ligne porte-t-elle un **pouvoir** (capacité légendaire), pas un jet ? */
export function isNonStatNativeEffect(fx: Pick<MarketNativeEffect, "effectId">): boolean {
    return NON_STAT_EFFECT_ID_SET.has(fx.effectId);
}

/**
 * 🏅 **Objet légendaire** (décision user du 14/09/2026) — la carte n'affiche
 * que la **mention**, jamais le texte du pouvoir.
 *
 * 📏 Le drapeau `GameItem.isLegendary` (siphon DofusDB) **ne peut pas** marquer
 * ces objets : DofusDB **n'expose pas** `isLegendary` dans `/items/{id}` (mesuré
 * sur `22412` → notre colonne vaut `false`). Le **vrai marqueur du jeu** est la
 * ligne de capacité légendaire (`effectId` **1175**, la même que celle écartée
 * des stats) — c'est **elle** qui dit « objet légendaire ».
 *
 * ⚠️ À lire **avant** tout filtre d'affichage : c'est la donnée brute
 * (`nativeEffects` du catalogue) qu'on interroge, jamais une liste déjà nettoyée.
 */
export function hasLegendaryCapacity(
    nativeEffects: Pick<MarketNativeEffect, "effectId">[] | null | undefined
): boolean {
    if (!Array.isArray(nativeEffects)) return false;
    return nativeEffects.some((fx) => NON_STAT_EFFECT_ID_SET.has(fx.effectId));
}

/**
 * Ligne native **affichable / déclarable** : ni métadonnée (`0 → 0`), ni
 * porteuse d'un **pouvoir**. Règle **unique** partagée par le pré-remplissage de
 * l'éditeur, la lecture client et le siphon (§13.4).
 */
export function isDisplayableNativeEffect(
    fx: Pick<MarketNativeEffect, "from" | "to" | "effectId">
): boolean {
    return isStatBearingNativeEffect(fx) && !isNonStatNativeEffect(fx);
}

/**
 * Miroir **côté lignes persistées** (`MarketListingStat`) de la règle
 * ci-dessus — pour les annonces écrites **avant** la garde d'écriture
 * (aucune migration : le filtre est appliqué à la lecture).
 *
 * ⚠️ Une ligne **EXO** (`naturalMin` / `naturalMax` nuls) porte toujours sa
 * valeur déclarée : seule une plage `0 → 0` **avec** une valeur `0` est du bruit.
 */
export function isStatBearingStatRow(stat: {
    effectId?: number | null;
    naturalMin?: number | null;
    naturalMax?: number | null;
    actualValue?: number | null;
}): boolean {
    // 🧨 Constat beta 14/09/2026 — miroir de `isNonStatNativeEffect` : une ligne
    // **persistée** sur l'`effectId` d'un **pouvoir légendaire** (`1175`, valeur =
    // identifiant du pouvoir) n'est jamais un jet. Filtre de **lecture** : les
    // annonces écrites avant la garde d'écriture disparaissent des écrans, de
    // l'image OG et du payload Discord (aucune migration).
    if (stat.effectId != null && NON_STAT_EFFECT_ID_SET.has(stat.effectId)) return false;
    const min = stat.naturalMin ?? null;
    const max = stat.naturalMax ?? null;
    if (min == null && max == null) return true;
    return !((min ?? 0) === 0 && (max ?? 0) === 0 && (stat.actualValue ?? 0) === 0);
}

/**
 * ⚙️ S2.2 — Convertit les effets DofusDB en version **LÉGÈRE** (`nativeEffects`)
 * stockée sur `GameItem` : ce sont les **plages natives** (source serveur) que
 * l'éditeur de jet pré-remplit et que la carte d'item affiche.
 * Renvoie `null` si l'item n'a aucun effet natif.
 * ⚠️ S2.12 — tolère la forme **BRUTE** DofusDB (`diceNum`/`diceSide`) : les
 * lignes siphonnées avant l'existence de `nativeEffects` restent exploitables
 * (filet de sécurité, le backfill les répare définitivement côté God).
 * ⚠️ S7.4 — les plages sont **normalisées** (`normalizeNativeRange`) : jamais de
 * `[10 à 0]`.
 */
export function toNativeEffects(
    raw: { effects?: DofusItemEffectLike[] | null } | null | undefined
): MarketNativeEffect[] | null {
    const source = Array.isArray(raw?.effects) ? raw!.effects! : [];
    const mapped = source
        .map((fx) => {
            const range = normalizeNativeRange(
                Number(fx.from ?? fx.diceNum ?? 0),
                Number(fx.to ?? fx.diceSide ?? 0)
            );
            return {
                effectId: Number(fx.effectId ?? fx.int_id ?? 0),
                characteristic: fx.characteristic != null ? Number(fx.characteristic) : null,
                from: range.from,
                to: range.to,
                category: fx.category != null ? Number(fx.category) : null,
                elementId: fx.elementId != null ? Number(fx.elementId) : null,
            };
        })
        .filter(
            (fx) =>
                Number.isFinite(fx.effectId) &&
                fx.effectId > 0 &&
                // 🧨 Constat beta 14/09 — la ligne « pouvoir » (`1175`) n'entre
                // jamais dans les plages natives : DofusDB l'écarte lui-même de
                // `effects` (mesuré sur `/items/22412`).
                !NON_STAT_EFFECT_ID_SET.has(fx.effectId)
        );

    return mapped.length > 0 ? mapped : null;
}

/**
 * 🛡️ S2.12 — Plages natives **exploitables** d'un item, avec filet de sécurité.
 *
 * La colonne `GameItem.nativeEffects` (S2.2) est vide sur les fiches siphonnées
 * **avant** son ajout : on dérive alors les plages depuis `effects` (forme brute
 * DofusDB tolérée — `diceNum`/`diceSide`). Les lecteurs catalogue (recherche,
 * fiche item, recalcul serveur des annonces) ne peuvent donc **jamais** afficher
 * « aucun effet natif » sur un objet qui en possède.
 *
 * ⚠️ Aucune écriture : la réparation définitive est `backfillNativeEffects()`
 * (panneau God) et le prochain siphon DofusDB.
 */
export function resolveNativeEffects(
    item: { nativeEffects?: unknown; effects?: unknown } | null | undefined
): MarketNativeEffect[] | null {
    const stored = item?.nativeEffects as MarketNativeEffect[] | null;
    // 3ᵉ passe — dédoublonnage à la **lecture** (source unique) : DofusDB
    // duplique la ligne de dommages de base d'une arme (`effectId` 96→100).
    if (Array.isArray(stored) && stored.length > 0) return dedupeNativeEffects(stored);
    return dedupeNativeEffects(
        toNativeEffects({ effects: (item?.effects ?? null) as DofusItemEffectLike[] | null })
    );
}

/**
 * Libellé FR d'un effet.
 *
 * S7.3 — résolution **en cascade**, jamais un libellé muet :
 *   1. **référentiel data-driven** (base, S2.5bis) sur la `characteristic` puis
 *      l'`effectId` (`GameCharacteristic` est la source officielle) ;
 *   2. `int_name` historique (codes DofusBook / Solomonk) ;
 *   3. `CHAR_NAMES` (repli codé, aligné sur le référentiel siphonné) ;
 *   4. `« Effet »` en dernier recours seulement.
 *
 * ⚠️ Avant S7.3, la cascade prenait `characteristic ?? effectId` **en un seul
 * essai** : une `characteristic` présente mais non cartographiée masquait un
 * `effectId` pourtant connu → libellé « Effet », ligne FM en « lecture seule ».
 */
export function getStatLabel(
    fx: Pick<DofusItemEffectLike, "int_name" | "characteristic" | "effectId" | "int_id">,
    referential?: Record<number, string>
): string {
    const ids = [fx.characteristic, fx.effectId, fx.int_id].filter(
        (value): value is number => typeof value === "number" && Number.isFinite(value)
    );

    if (referential) {
        for (const id of ids) {
            const label = referential[id];
            if (label && !isPlaceholderStatLabel(label)) return label;
        }
    }
    if (fx.int_name && BOOK_STAT_NAMES[fx.int_name]) return BOOK_STAT_NAMES[fx.int_name];
    if (fx.int_name) return fx.int_name;
    for (const id of ids) {
        if (CHAR_NAMES[id]) return CHAR_NAMES[id];
    }
    return "Effet";
}

/**
 * ⚠️ Correction 13/09 (3ᵉ passe, constat user « tu n'y arrives pas avec les
 * malus ») — **repli déterministe du SIGNE**.
 *
 * DofusDB porte chaque stat en **deux `effectId`** : le bonus et la
 * **pénalité** (mêmes dés, tous positifs) — `418` = « +21 à 30 Dommages
 * Critiques » / `419` = « -11 à -15 Dommages Critiques », `160` = « +4 à 6
 * Esquive PA » / `162` = « -6 à -8 Esquive PA »… Le signe d'affichage vient du
 * drapeau `GameEffect.isNegativeValue` (gabarit FR `-#1{{~1~2 à -}}#2`).
 *
 * Cette liste est la **copie mesurée en base le 13/09/2026** de ces 86
 * `effectId` négatifs (requête `SELECT id FROM "GameEffect" WHERE
 * "isNegativeValue"`). Elle sert de **repli** : sans elle, une lecture du
 * référentiel en échec (cache vide, `prisma generate` oublié après migration,
 * `statReferential === null` côté client) réaffichait « +100 Force » sur un objet
 * qui porte « -71 à -100 Force » (Rouleau à Pâtisserie d'Aermyne, `13649`).
 *
 * Ordre de confiance : `fx.isNegative` (résolu serveur) → `referential
 * .negativeEffectIds` → **cette liste**. Une mise à jour de jeu se reflète au
 * prochain siphon **et** à la prochaine mise à jour de cette copie.
 */
export const NEGATIVE_EFFECT_IDS: readonly number[] = [
    101, 105, 116, 127, 133, 134, 145,
    152, 153, 154, 155, 156, 157, 159,
    162, 163, 168, 169, 171, 172, 173, 175, 177, 179, 186, 195,
    215, 216, 217, 218, 219,
    245, 246, 247, 248, 249,
    265, 411, 413, 415, 417, 419, 421, 423, 425, 427, 429, 431, 754, 755,
    1033, 1047, 1048, 1077, 1079, 1080, 1172, 2415,
    2801, 2802, 2805, 2806, 2809, 2810, 2813, 2814,
    2835, 2837, 2839, 2841, 2843, 2845, 2847, 2849, 2851, 2853, 2855, 2857, 2859, 2861,
    2972, 2990, 3409, 3804, 3807, 3808,
];

/** Index du repli (recherche O(1) sur chaque ligne d'item). */
const NEGATIVE_EFFECT_ID_SET = new Set<number>(NEGATIVE_EFFECT_IDS);

/**
 * Correction 13/09 (3ᵉ passe) — la ligne est-elle un **malus** (à afficher
 * négative) ?
 *
 * Le signe n'est **jamais** lu dans les dés d'un item (toujours positifs côté
 * DofusDB) : il vient du drapeau référentiel, puis du repli curated ci-dessus.
 * `false` explicite (référentiel lu et disant « non négatif ») n'empêche pas le
 * repli : la copie curated est la même donnée, mesurée — elle évite justement
 * de propager un **référentiel vide** (cas mesuré : libellés justes mais signes
 * perdus, capture user du 13/09).
 */
export function isNegativeNativeEffect(
    effectId: number,
    options?: { isNegative?: boolean | null; negativeEffectIds?: readonly number[] | null }
): boolean {
    if (options?.isNegative === true) return true;
    if (options?.negativeEffectIds?.includes(effectId)) return true;
    return NEGATIVE_EFFECT_ID_SET.has(effectId);
}

/**
 * ⚠️ Correction 13/09 (3ᵉ passe) — **anti-doublon** des lignes natives.
 *
 * DofusDB duplique la ligne de **dommages de base d'une arme** dans `effects`
 * (mesuré sur le Rouleau à Pâtisserie d'Aermyne `13649` : deux entrées
 * `{ effectId: 100, 9 → 14 }` strictement identiques, y compris dans la réponse
 * API `/items/13649`). La carte affichait donc deux fois « +14 … [9 à 14] ».
 * Deux lignes **rigoureusement identiques** (même `effectId`, même
 * caractéristique, même plage) sont ramenées à une seule ; des plages
 * différentes ne sont **jamais** fusionnées.
 */
export function dedupeNativeEffects(
    nativeEffects: MarketNativeEffect[] | null | undefined
): MarketNativeEffect[] | null {
    if (!Array.isArray(nativeEffects) || nativeEffects.length === 0) return null;
    const seen = new Set<string>();
    const unique: MarketNativeEffect[] = [];
    for (const fx of nativeEffects) {
        const key = `${fx.effectId}|${fx.characteristic ?? ""}|${fx.from}|${fx.to}`;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(fx);
    }
    return unique;
}

/**
 * S7.3 — `true` si un libellé du référentiel est un **placeholder** DofusDB.
 *
 * Le siphon `/effects` renvoie le catalogue des **effets de sorts** : beaucoup
 * de libellés y sont des gabarits (`« Effet 63 »`, `« }{ soins »`). Les prendre
 * pour un libellé d'objet écraserait un nom correct par du bruit ⇒ on les
 * ignore et on retombe sur la table codée (`CHAR_NAMES`).
 */
export function isPlaceholderStatLabel(label: string | null | undefined): boolean {
    if (!label) return true;
    const trimmed = label.trim();
    if (!trimmed) return true;
    if (/^effet\s+\d+$/i.test(trimmed)) return true;
    return trimmed.includes("{") || trimmed.includes("}");
}
/**
 * 🧹 Retire la **ponctuation de gabarit** (`{`, `}`) d'un libellé d'effet et **refuse**
 * tout ce qui ressemble encore à un gabarit (`~`, `#`, « Effet N », moins de 3 lettres) :
 * aucune invention, on ne fait que dé-punctuariser un libellé réel.
 *
 * Sert la purge `GameEffect.name` (S8.5). Mesure du 23/09/2026 en base : **135 des 368**
 * gabarits sont dans ce cas (« Vole } PM » → « Vole PM », « } soins » → « soins ») ; les
 * 233 autres sont de vrais « Effet N » que DofusDB ne nomme pas — ils restent tels quels.
 */
export function cleanTemplateBraces(name: string): string | null {
    const cleaned = name.replace(/[{}]/g, " ").replace(/\s{2,}/g, " ").trim();
    if (!cleaned || cleaned === name) return null;
    if (/[~#]/.test(cleaned)) return null;
    if (/^Effet \d+$/.test(cleaned)) return null;
    if (!/[A-Za-zÀ-ÿ]{3}/.test(cleaned)) return null;
    return cleaned;
}
/**
 * Correction 13/09 (2ᵉ passe) — libellé **curated** d'une ligne, ou `null`.
 *
 * ⚠️ La table `CHAR_NAMES` mélange **deux espaces de clés** (`characteristicId`
 * **et** `effectId`). On essaie donc la **caractéristique d'abord**, puis
 * l'`effectId` — exactement la cascade historique de `getStatLabel`, sans quoi
 * une ligne brute DofusDB (`{ characteristic: 11, effectId: 10 }`) serait
 * étiquetée « Force » (id 10) au lieu de « Vitalité » (id 11).
 * Les lignes **natives** du marché n'ont pas de `characteristic` : c'est
 * l'`effectId` qui décide, et il est spécifique à la ligne (421 → « Résistance
 * Critiques » là où la caractéristique 87 est partagée).
 */
export function curatedStatLabel(match: {
    effectId?: number | null;
    characteristic?: number | null;
}): string | null {
    if (match.characteristic != null && CHAR_NAMES[match.characteristic]) {
        return CHAR_NAMES[match.characteristic];
    }
    if (match.effectId != null && CHAR_NAMES[match.effectId]) return CHAR_NAMES[match.effectId];
    return null;
}

/**
 * Correction 13/09 (2ᵉ passe) — **ordre de résolution de référence** :
 *
 *   1. **table codée** (`curatedStatLabel`) : libellé d'**infobulle** vérifié
 *      (« Résistance Critiques », « Dommages Terre », « Résistance Terre (%) ») ;
 *   2. **référentiel siphonné** (`GameEffect.name`, gabarits exclus) : complète
 *      les `effectId` que la table ne couvre pas (effets de jeu exotiques) ;
 *   3. `null` ⇒ l'appelant décide du repli (jamais un libellé muet en silence).
 *
 * ⚠️ Avant le 13/09 l'ordre était **inversé** : le nom siphonné — qui est le nom
 * **court de la caractéristique** jointe (« Critiques (fixe) », « Terre (%) ») —
 * écrasait le libellé d'infobulle ; et la moindre panne du référentiel (cache,
 * `prisma generate` oublié après migration) faisait réapparaître les libellés
 * « Effet » signalés par le user.
 */
export function resolveStatLabel(
    match: { effectId?: number | null; characteristic?: number | null },
    referentialLabel?: string | null
): string | null {
    const curated = curatedStatLabel(match);
    if (curated) return curated;
    if (referentialLabel && !isPlaceholderStatLabel(referentialLabel)) return referentialLabel;
    return null;
}



/**
 * S7.3 — libellé **sûr** d'une ligne de jet **déjà persistée**.
 *
 * Les tables de libellés ont été corrigées (S7.1/S7.3) alors que la base
 * conserve le libellé **figé à la déclaration** (« Effet » pour les annonces
 * créées avant le correctif). On re-résout donc depuis les identifiants — sans
 * jamais remplacer un libellé existant par le repli « Effet ».
 */
export function resolveStoredStatLabel(stat: {
    characteristic?: number | null;
    effectId?: number | null;
    label?: string | null;
}): string {
    const resolved = getStatLabel({
        characteristic: stat.characteristic ?? null,
        effectId: stat.effectId ?? null,
    });
    if (resolved !== "Effet") return resolved;
    return stat.label && stat.label.trim() ? stat.label : "Effet";
}

/** Spécification visuelle (icône + couleur) d'une stat — `null` si inconnue. */
export function resolveStatIconSpec(
    characteristicId?: number | null,
    charCode?: string | null
): { icon: StatIconName; color: string } | null {
    const key = charCode || (characteristicId != null ? String(characteristicId) : "");
    return key ? STAT_ICON_SPECS[key] ?? null : null;
}

/** `true` si la valeur s'exprime en pourcentage (résistances…). */
export function isPercentStat(label: string | null | undefined): boolean {
    return !!label && (label.includes("%") || /pourcent/i.test(label));
}

/** Formate la valeur d'une stat pour l'affichage (« +12 % » / « +12 »). */
export function formatStatValue(value: number, label?: string | null): string {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value}${isPercentStat(label) ? " %" : ""}`;
}

// ---------------------------------------------------------------------------
// S2.8 — Plages natives : source SERVEUR (jamais le client, §12.8)
// ---------------------------------------------------------------------------

/**
 * Retrouve la plage native (`from` → `to`) d'un effet dans les `nativeEffects`
 * du catalogue. La correspondance se fait par `effectId` d'abord (stable
 * inter-versions), puis par `characteristic` en repli. Renvoie `null` si
 * l'effet n'est pas natif (→ ligne EXO ou valeur libre).
 */
export function findNativeRange(
    nativeEffects: MarketNativeEffect[] | null | undefined,
    match: { effectId?: number | null; characteristic?: number | null }
): { from: number; to: number } | null {
    if (!Array.isArray(nativeEffects) || nativeEffects.length === 0) return null;
    const byEffectId = match.effectId != null
        ? nativeEffects.find((fx) => fx.effectId === match.effectId)
        : undefined;
    const found = byEffectId
        ?? (match.characteristic != null
            ? nativeEffects.find((fx) => fx.characteristic === match.characteristic)
            : undefined);
    // S7.4 — la normalisation s'applique aussi **à la lecture** : une plage
    // inversée déjà persistée (`[10 à 0]`) est ramenée à la valeur fixe.
    return found ? normalizeNativeRange(found.from, found.to) : null;
}

/** `true` si l'effet est natif de l'objet (sinon → EXO). */
export function isNativeEffect(
    nativeEffects: MarketNativeEffect[] | null | undefined,
    match: { effectId?: number | null; characteristic?: number | null }
): boolean {
    return findNativeRange(nativeEffects, match) !== null;
}

/** Ligne de jet prête à saisir par l'éditeur (pré-remplie depuis le catalogue). */
export type MarketStatDraft = {
    effectId: number;
    characteristic: number | null;
    label: string;
    naturalMin: number | null;
    naturalMax: number | null;
    actualValue: number;
    origin: "NATIVE" | "EXO";
};

/**
 * S2.8/S2.10 — Construit les lignes natives pré-remplies de l'éditeur FM à
 * partir des `nativeEffects` du catalogue. La valeur par défaut est le **max
 * natif** (un vendeur annonce rarement un jet bas) et l'état est recalculé
 * côté serveur à l'enregistrement.
 */
/** Entrées de résolution d'une ligne native (toutes optionnelles). */
export type MarketStatReferentialInput = {
    /** `id` (**effectId** ou `characteristicId`) → libellé FR officiel. */
    labels?: Record<number, string> | null;
    /**
     * Correction 13/09 — `effectId` dont la ligne s'**affiche négative**
     * (`GameEffect.isNegativeValue`, dérivé du gabarit DofusDB `-#1…`).
     * Les dés d'un objet sont **toujours positifs** : c'est ce drapeau qui
     * rétablit le malus (« **-6 à -8** » au lieu de « +6 à +8 »).
     */
    negativeEffectIds?: readonly number[] | null;
};

/**
 * Correction 13/09 — rétablit le **signe** d'une plage d'effet.
 * **Idempotent** (`-Math.abs`) : une donnée déjà négative (malus à dés signés)
 * reste juste, une donnée positive devient le malus affiché par DofusDB.
 */
export function applyEffectSign(
    range: { from: number; to: number },
    isNegative: boolean
): { from: number; to: number } {
    return isNegative
        ? { from: -Math.abs(range.from), to: -Math.abs(range.to) }
        : range;
}

/**
 * Libellé d'une ligne **native** : l'`effectId` est **spécifique** à la ligne
 * (il porte le libellé exact), alors que la `characteristic` est **partagée**
 * entre plusieurs effets et ne sert que de repli.
 *
 * Correction 13/09 (2ᵉ passe) — l'ordre est désormais **table d'infobulle →
 * référentiel siphonné** (`resolveStatLabel`) : le nom publié par `GameEffect`
 * est celui de la **caractéristique jointe** (« Critiques (fixe) », « Terre (%) »),
 * moins précis que l'infobulle du jeu. Le libellé **déjà résolu serveur**
 * (`fx.label`) prime sur tout : il a été calculé avec le référentiel chargé.
 */
export function resolveNativeStatLabel(
    fx: Pick<MarketNativeEffect, "effectId" | "characteristic" | "label">,
    referential?: MarketStatReferentialInput | null
): string {
    if (fx.label && !isPlaceholderStatLabel(fx.label)) return fx.label;
    const labels = referential?.labels ?? null;
    const byEffect = labels && fx.effectId != null ? labels[fx.effectId] : undefined;
    const byChar = labels && fx.characteristic != null ? labels[fx.characteristic] : undefined;
    return (
        resolveStatLabel(
            { effectId: fx.effectId, characteristic: fx.characteristic },
            byEffect ?? byChar
        ) ?? getStatLabel({ characteristic: fx.characteristic, effectId: fx.effectId })
    );
}

/**
 * Correction 13/09 (2ᵉ passe) — **résout les lignes natives côté SERVEUR** :
 * chaque entrée repart avec son libellé d'infobulle (`label`) et son drapeau de
 * malus (`isNegative`).
 *
 * Pourquoi ici plutôt que dans le client : la carte du catalogue et l'éditeur de
 * jet consommaient le référentiel via un **second aller-retour** (server action
 * `getMarketStatReferential`). Si cet appel échouait ou arrivait après le choix
 * de l'objet (cas mesuré : `prisma generate` oublié après migration ⇒ lecture
 * `GameEffect` en échec ⇒ référentiel vide), les lignes s'affichaient
 * « +30 Effet » au lieu de « -30 Résistance Critiques ». Le libellé et le signe
 * voyagent maintenant **avec l'item** : plus de course, plus de dépendance.
 *
 * ⚠️ **Pure** : aucune I/O, le référentiel est injecté (testable sans base).
 * Les lignes rigoureusement identiques sont dédoublonnées (`dedupeNativeEffects`).
 */
export function enrichNativeEffects(
    nativeEffects: MarketNativeEffect[] | null | undefined,
    referential?: MarketStatReferentialInput | null
): MarketNativeEffect[] | null {
    // Anti-doublon **ici aussi** : l'enrichissement est le point par lequel
    // passent les lignes envoyées au client (recherche, fiche, rattrapage God).
    const deduped = dedupeNativeEffects(nativeEffects);
    if (!deduped) return null;
    // 🧨 Constat beta 14/09 — les lignes « pouvoir » (capacité légendaire,
    // `effectId 1175`) ne partent **jamais** vers un écran : la valeur stockée
    // est l'identifiant du pouvoir (« +15975 Effet »).
    const unique = deduped.filter((fx) => !isNonStatNativeEffect(fx));
    if (unique.length === 0) return null;
    const labels = referential?.labels ?? null;
    return unique.map((fx) => {
        const referentialLabel = labels
            ? labels[fx.effectId] ??
              (fx.characteristic != null ? labels[fx.characteristic] : null)
            : null;
        const label =
            fx.label ??
            resolveStatLabel(
                { effectId: fx.effectId, characteristic: fx.characteristic },
                referentialLabel
            );
        return {
            ...fx,
            // Jamais de libellé muet persisté : on n'écrit `label` que lorsqu'il
            // est réellement résolu (sinon le consommateur peut encore le tenter).
            ...(label ? { label } : {}),
            // Signe : drapeau déjà résolu → référentiel → repli curated (3ᵉ passe).
            isNegative: isNegativeNativeEffect(fx.effectId, {
                isNegative: fx.isNegative,
                negativeEffectIds: referential?.negativeEffectIds,
            }),
        };
    });
}

/**
 * S2.8/S2.10 — Construit les lignes natives pré-remplies de l'éditeur FM à
 * partir des `nativeEffects` du catalogue.
 *
 * Correction 13/09 (constat user) :
 *   - la plage est **normalisée** ici aussi (fin du « 1 à 0 » : un PA natif
 *     s'affiche « 1 », pas « 1 à 0 ») ;
 *   - le **signe** est rétabli pour les lignes malus (« -6 à -8 Esquive PA ») —
 *     il vient du champ `isNegative` résolu serveur, sinon de
 *     `referential.negativeEffectIds` ;
 *   - la valeur par défaut est le **max natif** — jamais `0` sur une ligne qui
 *     existe (c'est ce `0` qui apparaissait sur PA / Invocations).
 */
export function buildNativeStatDrafts(
    nativeEffects: MarketNativeEffect[] | null | undefined,
    referential?: MarketStatReferentialInput | null
): MarketStatDraft[] {
    if (!Array.isArray(nativeEffects)) return [];
    // Constat beta (14/09) — les lignes de **métadonnées** du catalogue
    // (« Échangeable : », « Compatible avec : »…) arrivent en `0 → 0` : elles ne
    // sont **pas des jets** et ne sont donc jamais pré-remplies. Sans ce filtre,
    // un cosmétique partait en déclaration avec des lignes que le serveur
    // refusait ensuite (« aucune statistique ne peut être déclarée »).
    // 🧨 2ᵉ constat du 14/09 (même règle) — une ligne **pouvoir** (`effectId`
    // `1175`, valeur = identifiant de la capacité légendaire) n'est pas non plus
    // un jet : « +15975 Effet » ne doit jamais entrer dans l'éditeur.
    return nativeEffects.filter(isDisplayableNativeEffect).map((fx) => {
        const range = applyEffectSign(
            normalizeNativeRange(fx.from, fx.to),
            // 3ᵉ passe — le signe ne dépend plus d'un référentiel disponible :
            // `fx.isNegative` (résolu serveur) → référentiel → repli curated.
            isNegativeNativeEffect(fx.effectId, {
                isNegative: fx.isNegative,
                negativeEffectIds: referential?.negativeEffectIds,
            })
        );
        return {
            effectId: fx.effectId,
            characteristic: fx.characteristic,
            label: resolveNativeStatLabel(fx, referential),
            naturalMin: range.from,
            naturalMax: range.to,
            actualValue: range.to,
            origin: "NATIVE" as const,
        };
    });
}

/**
 * S2.11 — Effets exotiques proposés **en un clic** dans l'éditeur.
 * Un exo n'est jamais refusé (D34) : il est simplement marqué `EXO` et mis en
 * avant sur la carte. Les `effectId` sont les identifiants canoniques Dofus des
 * lignes exo (PA / PM / PO / invocation).
 */
export const EXO_EFFECT_PRESETS = [
    { key: "pa", effectId: 111, characteristic: 1, label: "PA", code: "pa" },
    { key: "pm", effectId: 128, characteristic: 23, label: "PM", code: "pm" },
    { key: "po", effectId: 117, characteristic: 19, label: "Portée", code: "po" },
    // S7.3 — la caractéristique « Invocation » est officiellement **26**
    // (`GameCharacteristic`) : l'ancienne valeur `28` désignait « Esquive PM ».
    { key: "invocation", effectId: 182, characteristic: 26, label: "Invocations", code: "ic" },
] as const;

export type ExoEffectPreset = (typeof EXO_EFFECT_PRESETS)[number];

/** Construit une ligne EXO prête à insérer (plage native inconnue). */
export function buildExoStatDraft(preset: ExoEffectPreset, value = 1): MarketStatDraft {
    return {
        effectId: preset.effectId,
        characteristic: preset.characteristic,
        label: preset.label,
        naturalMin: null,
        naturalMax: null,
        actualValue: value,
        origin: "EXO",
    };
}

