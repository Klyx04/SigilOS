/**
 * SigilOS — **thème graphique des caractéristiques Dofus** (vrais assets).
 *
 * ⚠️ Fichier **PUR** (aucune dépendance React / Prisma / Node) → importable
 * côté client comme côté serveur.
 *
 * 🎯 Rôle : résoudre un effet déclaré (jet FM, carte d'item, fiche d'annonce)
 * vers **l'icône officielle** de Dofus (`public/assets/dofus/stats/*.png`), son
 * **libellé** et sa **couleur** — exactement comme la galerie de stuff
 * (`dofusbook-preview.tsx`) et l'overlay boss, qui utilisaient déjà ces PNG.
 *
 * Résolution en **cascade** (jamais d'exception, jamais d'icône cassée) :
 *   1. `characteristicId` DofusDB (ids de caractéristique **et** d'effet) ;
 *   2. `effectId` DofusDB (repli : certaines fiches n'ont que l'un des deux) ;
 *   3. code court historique (`vi`, `fo`, `dmg`… DofusBook / Solomonk) ;
 *   4. **mots-clés du libellé** (« Dommages Eau », « Résistance Feu (%) »…) —
 *      dernier filet quand l'id n'est pas encore cartographié.
 *
 * `null` ⇒ l'appelant garde son repli (icônes lucide de `stat-icon.tsx`) : on
 * ne remplace jamais une icône inconnue par une icône fausse.
 *
 * 📌 Les assets sont **statiques** (`public/`) : aucun siphon réseau n'est
 * nécessaire, et les 31 fichiers existent déjà (dont `sagesse.png` et
 * `invocation.png`, ajoutés en S2.5).
 */

/** Base publique des icônes de caractéristiques officielles. */
export const DOFUS_STAT_ASSET_BASE = "/assets/dofus/stats";

/** Thème d'une caractéristique : asset officiel + libellé + couleur (token). */
export type DofusStatAsset = {
    /** Nom du fichier dans `public/assets/dofus/stats/` (jamais un chemin). */
    asset: string;
    /** Libellé d'affichage (« Vitalité », « Dommages Feu », « Esquive PA »). */
    label: string;
    /** Classe de couleur du design system (jamais une couleur en dur). */
    color: string;
};

/** Alias rétro-compatible */
export type DofusStatTheme = DofusStatAsset;

/**
 * Palette de couleurs authentiques DofusBook.
 */
export const DOFUSBOOK_COLORS = {
    vitalite: "#22c55e",
    sagesse: "#a855f7",
    force: "#d97706",
    intelligence: "#ef4444",
    chance: "#0ea5e9",
    agilite: "#10b981",
    pa: "#f59e0b",
    pm: "#22c55e",
    po: "#06b6d4",
    critique: "#eab308",
    puissance: "#f87171",
    soin: "#f97316",
    dommages: "#ef4444",
    neutre: "#94a3b8",
    invocation: "#38bdf8",
    initiative: "#f43f5e",
    prospection: "#14b8a6",
    pods: "#a16207",
    fuite: "#34d399",
    tacle: "#6366f1",
    retraitPA: "#f59e0b",
    esquivePA: "#38bdf8",
    retraitPM: "#10b981",
    esquivePM: "#34d399",
    resistance: "#94a3b8",
    malus: "#ef4444",
} as const;

/**
 * Thèmes officiels, indexés par clé interne stable.
 * ⚠️ Seuls des fichiers **réellement présents** dans `public/assets/dofus/stats/`
 * sont référencés ici (vérifié : 31 PNG).
 */
const STAT_THEMES = {
    vitality: { asset: "pv.png", label: "Vitalité", color: "text-danger" },
    strength: { asset: "terre.png", label: "Force", color: "text-warning" },
    intelligence: { asset: "feu.png", label: "Intelligence", color: "text-danger" },
    chance: { asset: "eau.png", label: "Chance", color: "text-info" },
    agility: { asset: "air.png", label: "Agilité", color: "text-success" },
    wisdom: { asset: "sagesse.png", label: "Sagesse", color: "text-violet-400" },
    power: { asset: "puissance.png", label: "Puissance", color: "text-fuchsia-400" },
    actionPoints: { asset: "pa.png", label: "PA", color: "text-warning" },
    movementPoints: { asset: "pm.png", label: "PM", color: "text-success" },
    range: { asset: "po.png", label: "Portée", color: "text-info" },
    summons: { asset: "invocation.png", label: "Invocations", color: "text-warning" },
    criticalHits: { asset: "critique.png", label: "Coup critique", color: "text-info" },
    heals: { asset: "soin.png", label: "Soins", color: "text-success" },
    damage: { asset: "dommages.png", label: "Dommages", color: "text-danger" },
    criticalDamage: { asset: "dommages.png", label: "Dommages Critiques", color: "text-danger" },
    pushDamage: { asset: "dommages.png", label: "Dommages Poussée", color: "text-danger" },
    neutralDamage: { asset: "neutre.png", label: "Dommages Neutre", color: "text-foreground" },
    earthDamage: { asset: "terre.png", label: "Dommages Terre", color: "text-warning" },
    fireDamage: { asset: "feu.png", label: "Dommages Feu", color: "text-danger" },
    waterDamage: { asset: "eau.png", label: "Dommages Eau", color: "text-info" },
    airDamage: { asset: "air.png", label: "Dommages Air", color: "text-success" },
    criticalResistance: { asset: "bouclier.png", label: "Résistance Critiques", color: "text-danger" },
    pushResistance: { asset: "bouclier.png", label: "Résistance Poussée", color: "text-warning" },
    neutralResistance: { asset: "resNeutre.png", label: "Résistance Neutre", color: "text-foreground" },
    earthResistance: { asset: "resTerre.png", label: "Résistance Terre", color: "text-warning" },
    fireResistance: { asset: "resFeu.png", label: "Résistance Feu", color: "text-danger" },
    waterResistance: { asset: "resEau.png", label: "Résistance Eau", color: "text-info" },
    airResistance: { asset: "resAir.png", label: "Résistance Air", color: "text-success" },
    initiative: { asset: "initiative.png", label: "Initiative", color: "text-foreground" },
    prospecting: { asset: "pp.png", label: "Prospection", color: "text-info" },
    pods: { asset: "pod.png", label: "Pods", color: "text-warning" },
    dodge: { asset: "fuite.png", label: "Fuite", color: "text-info" },
    tackle: { asset: "tacle.png", label: "Tacle", color: "text-success" },
    /**
     * Correction 14/09/2026 (constat beta « icône assets ko : +5 % Mêlée (%) ») —
     * les deux résistances **de contact** n'avaient **aucun** thème : la ligne
     * tombait sur le repli lucide (éclair), jamais sur l'asset officiel.
     * Le référentiel DofusDB les nomme `Mêlée (%)` (`tx_resMelee`) et
     * `Distance (%)` (`tx_distanceRes`) — le **bouclier** est l'asset des autres
     * résistances (`Résistance Critiques`, `Résistance Poussée`).
     */
    meleeResistance: { asset: "bouclier.png", label: "Résistance Mêlée", color: "text-danger" },
    distanceResistance: { asset: "bouclier.png", label: "Résistance Distance", color: "text-info" },
    apReduction: { asset: "retraitPA.png", label: "Retrait PA", color: "text-muted-foreground" },
    mpReduction: { asset: "retraitPM.png", label: "Retrait PM", color: "text-muted-foreground" },
    apDodge: { asset: "esquivePA.png", label: "Esquive PA", color: "text-info" },
    mpDodge: { asset: "esquivePM.png", label: "Esquive PM", color: "text-success" },
    erosion: { asset: "erosion.png", label: "Érosion", color: "text-warning" },
    shield: { asset: "bouclier.png", label: "Bouclier", color: "text-info" },
} as const satisfies Record<string, DofusStatAsset>;

type StatThemeKey = keyof typeof STAT_THEMES;

/**
 * `characteristicId` **et** `effectId` DofusDB → thème.
 *
 * ⚠️ Les valeurs de **caractéristique** sont alignées sur le référentiel
 * siphonné (`GameCharacteristic`, vérifié en base le 11/09/2026) : `10` = Force,
 * `16` = **Dommages**, `26` = **Invocation**, `27`/`28` = **Esquive PA/PM**,
 * `33`→`37` = résistances élémentaires (%), `40` = Pods, `44` = Initiative,
 * `48` = Prospection, `49` = Soins, `50` = Renvoi.
 * Les identifiants d'**effet** connus (`111` PA, `117` Portée, `128` PM,
 * `182` Invocations, `162`→`165`, `178`, `210`→`214`, `422`→`432`, `752`/`753`)
 * sont ajoutés dans le même espace, comme `CHAR_NAMES` — la résolution essaie
 * toujours la caractéristique **puis** l'`effectId`.
 */
const THEME_BY_ID: Record<number, StatThemeKey> = {
    // Points d'action / mouvement / portée / invocations
    1: "actionPoints",
    111: "actionPoints",
    23: "movementPoints",
    128: "movementPoints",
    19: "range",
    117: "range",
    26: "summons",
    182: "summons",
    // Caractéristiques primaires
    10: "strength",
    118: "strength",
    11: "vitality",
    125: "vitality",
    12: "wisdom",
    124: "wisdom",
    13: "chance",
    123: "chance",
    14: "agility",
    119: "agility",
    15: "intelligence",
    126: "intelligence",
    25: "power",
    // Combat & utilitaires
    16: "damage",
    18: "criticalHits",
    /**
     * ⚠️ Correction 14/09/2026 — **audit de tous les ids de cette carte** contre
     * le référentiel siphonné (`GameCharacteristic` / `GameEffect`, sonde
     * `_probe-stat-icons-audit.mjs`) : trois entrées donnaient une
     * **mauvaise** icône (le référentiel est la source de vérité) :
     *   · `82` = « Retrait PA » (`tx_attackAP`) — était `apDodge` ;
     *   · `84` = « Poussée » (`tx_push`) — était `mpDodge` ;
     *   · `88` = « Terre » (`tx_strength`, dommages) — était `pushResistance`.
     */
    27: "apDodge",
    160: "apDodge",
    82: "apReduction",
    28: "mpDodge",
    161: "mpDodge",
    80: "apReduction",
    410: "apReduction",
    83: "mpReduction",
    412: "mpReduction",
    31: "damage",
    40: "pods",
    158: "pods",
    44: "initiative",
    174: "initiative",
    175: "initiative",
    48: "prospecting",
    176: "prospecting",
    49: "heals",
    178: "heals",
    50: "shield",
    115: "criticalHits",
    116: "range",
    138: "power",
    // Résistances élémentaires (%) — caractéristiques 33→37 et effects 210→214
    33: "earthResistance",
    213: "earthResistance",
    34: "fireResistance",
    210: "fireResistance",
    35: "waterResistance",
    211: "waterResistance",
    36: "airResistance",
    212: "airResistance",
    37: "neutralResistance",
    214: "neutralResistance",
    // Résistances élémentaires **fixes** (« Terre (fixe) »…) — ids mesurés
    240: "earthResistance",
    241: "waterResistance",
    242: "airResistance",
    243: "fireResistance",
    244: "neutralResistance",
    // Dommages élémentaires
    89: "fireDamage",
    424: "fireDamage",
    90: "waterDamage",
    426: "waterDamage",
    432: "waterDamage",
    91: "airDamage",
    428: "airDamage",
    88: "earthDamage",
    92: "earthDamage",
    423: "earthDamage",
    430: "earthDamage",
    93: "neutralDamage",
    141: "neutralDamage",
    422: "neutralDamage",
    // Critique & poussée
    112: "criticalDamage",
    162: "criticalDamage",
    418: "criticalDamage",
    419: "criticalDamage",
    87: "criticalResistance",
    163: "criticalResistance",
    420: "criticalResistance",
    421: "criticalResistance",
    114: "pushDamage",
    84: "pushDamage",
    164: "pushDamage",
    414: "pushDamage",
    165: "pushResistance",
    416: "pushResistance",
    417: "pushResistance",
    /**
     * Résistances **au corps à corps** (constat beta du 14/09 : « +5 % Mêlée (%) »
     * avec une icône cassée) — `2803` = « Mêlée (%) », `2804`/`2807` =
     * « Distance (%) » (référentiel `/effects/2803` : `characteristic: 124`,
     * description FR « …% Résistance mêlée », `isInPercent: true`).
     */
    2803: "meleeResistance",
    2804: "distanceResistance",
    2807: "distanceResistance",
    // Fuite / tacle
    78: "dodge",
    752: "dodge",
    754: "dodge",
    79: "tackle",
    753: "tackle",
    755: "tackle",
};

/**
 * ⚠️ Correction 14/09/2026 — **collision d'identifiants** (constat beta
 * « +5 % Mêlée (%) ») : `124` désigne **deux choses** dans DofusDB —
 * l'`effectId` **124** = *Sagesse* et la `characteristicId` **124** =
 * *Mêlée (%)* (`receivedDamageMultiplierMelee`, asset `tx_resMelee`).
 *
 * `THEME_BY_ID` ne peut donc pas être juste pour les deux à la fois : la
 * résolution **caractéristique → thème** passe par cette carte **d'abord**
 * (c'est la même donnée que `GameCharacteristic`, vérifiée en base), puis
 * retombe sur `THEME_BY_ID` pour la compatibilité, et enfin l'`effectId` est
 * résolu dans `THEME_BY_ID`. Résultat : la caracteristique 124 donne
 * « Résistance Mêlée » et l'`effectId` 124 donne toujours « Sagesse ».
 */
const THEME_BY_CHARACTERISTIC: Record<number, StatThemeKey> = {
    120: "distanceResistance",
    121: "distanceResistance",
    124: "meleeResistance",
};

/** Code court historique (DofusBook / Solomonk) → thème. */
const THEME_BY_CODE: Record<string, StatThemeKey> = {
    vi: "vitality",
    fo: "strength",
    sa: "wisdom",
    ag: "agility",
    in: "intelligence",
    ch: "chance",
    pu: "power",
    cc: "criticalHits",
    dmg: "damage",
    ii: "initiative",
    pp: "prospecting",
    po: "range",
    pod: "pods",
    ic: "summons",
    pa: "actionPoints",
    pm: "movementPoints",
    ta: "tackle",
    fu: "dodge",
    so: "heals",
    rpa: "apReduction",
    epa: "apDodge",
    rpm: "mpReduction",
    epm: "mpDodge",
    dnf: "neutralDamage",
    dtf: "earthDamage",
    dff: "fireDamage",
    def: "waterDamage",
    daf: "airDamage",
    rn: "neutralResistance",
    rnp: "neutralResistance",
    rt: "earthResistance",
    rtp: "earthResistance",
    rf: "fireResistance",
    rfp: "fireResistance",
    re: "waterResistance",
    rep: "waterResistance",
    ra: "airResistance",
    rap: "airResistance",
    rfc: "criticalResistance",
    rp: "pushResistance",
    /**
     * Famille « dégâts / réductions critiques & poussée » — ids Dofusbook relevés dans
     * les payloads réels (`cloths[].effects[]`) : `410 dc` (Dommages Critiques),
     * `420 dp` (Dommages Poussée), `430 rc` (réduction des dégâts critiques subis),
     * `440 rp` (réduction des dégâts de poussée subis — déduit de la même série).
     * Référentiel DofusDB : `86` Critiques, `87` Critiques (fixe), `84` Poussée,
     * `85` Poussée (fixe).
     */
    dc: "criticalDamage",
    dp: "pushDamage",
    /**
     * `rc` = réduction des **dégâts critiques** subis.
     * Preuve : payload brut Dofusbook (`cloths[].effects[]`) → l'effet porte
     * `{"id":430,"name":"rc","value":10}`, juste après `{"id":420,"name":"dp"}`
     * (Dommages Poussée) ; le référentiel DofusDB nomme la stat `87` = « Critiques (fixe) »
     * (`criticalDamageReduction`). C'est donc **la même famille** que `rfc`
     * (asset `bouclier.png`) — jamais `critique.png` (coups critiques *infligés*).
     */
    rc: "criticalResistance",
};

/**
 * Filet par **mots-clés du libellé** — l'ordre est **significatif** (du plus
 * spécifique au plus général : « Résistance Feu » avant « Feu »).
 */
const LABEL_THEME_PATTERNS: { pattern: RegExp; theme: StatThemeKey }[] = [
    // S7.16 — libellés courts du référentiel FM (« PA », « PM », « PO »).
    { pattern: /^\s*pa\s*$/i, theme: "actionPoints" },
    { pattern: /^\s*pm\s*$/i, theme: "movementPoints" },
    { pattern: /^\s*po\s*$/i, theme: "range" },
    { pattern: /retrait\s+pa/i, theme: "apReduction" },
    { pattern: /retrait\s+pm/i, theme: "mpReduction" },
    { pattern: /esquive\s+pa/i, theme: "apDodge" },
    { pattern: /esquive\s+pm/i, theme: "mpDodge" },
    // Constat beta 14/09 — libellés du référentiel sans motif : « Critiques (fixe) »
    // et « Poussée (fixe) » sont des **résistances** (char. 87 / 85), à traiter
    // AVANT les motifs génériques « critique » / « poussée » (dégâts).
    { pattern: /critiques?\s*\(fixe\)/i, theme: "criticalResistance" },
    { pattern: /pouss[eé]e\s*\(fixe\)/i, theme: "pushResistance" },
    { pattern: /pouss[eé]e/i, theme: "pushDamage" },
    // « Mêlée (%) » / « Distance (%) » (chars 124 / 120-121) : résistances au
    // contact — l'asset officiel est le **bouclier** (aucun PNG dédié).
    { pattern: /m[eê]l[eé]e/i, theme: "meleeResistance" },
    { pattern: /distance/i, theme: "distanceResistance" },
    { pattern: /r[eé]sistance[^a-z]*critique/i, theme: "criticalResistance" },
    { pattern: /r[eé]sistance[^a-z]*pouss/i, theme: "pushResistance" },
    { pattern: /r[eé]sistance[^a-z]*neutre/i, theme: "neutralResistance" },
    { pattern: /r[eé]sistance[^a-z]*terre/i, theme: "earthResistance" },
    { pattern: /r[eé]sistance[^a-z]*feu/i, theme: "fireResistance" },
    { pattern: /r[eé]sistance[^a-z]*eau/i, theme: "waterResistance" },
    { pattern: /r[eé]sistance[^a-z]*air/i, theme: "airResistance" },
    { pattern: /dommages?[^a-z]*critique/i, theme: "criticalDamage" },
    { pattern: /dommages?[^a-z]*pouss/i, theme: "pushDamage" },
    { pattern: /dommages?[^a-z]*neutre/i, theme: "neutralDamage" },
    { pattern: /dommages?[^a-z]*terre/i, theme: "earthDamage" },
    { pattern: /dommages?[^a-z]*feu/i, theme: "fireDamage" },
    { pattern: /dommages?[^a-z]*eau/i, theme: "waterDamage" },
    { pattern: /dommages?[^a-z]*air/i, theme: "airDamage" },
    { pattern: /dommages?/i, theme: "damage" },
    { pattern: /vitalit/i, theme: "vitality" },
    { pattern: /force/i, theme: "strength" },
    { pattern: /intelligence/i, theme: "intelligence" },
    { pattern: /chance/i, theme: "chance" },
    { pattern: /agilit/i, theme: "agility" },
    { pattern: /sagesse/i, theme: "wisdom" },
    { pattern: /puissance/i, theme: "power" },
    { pattern: /invocation/i, theme: "summons" },
    { pattern: /critique/i, theme: "criticalHits" },
    { pattern: /soin/i, theme: "heals" },
    { pattern: /prospection/i, theme: "prospecting" },
    { pattern: /initiative/i, theme: "initiative" },
    { pattern: /pod/i, theme: "pods" },
    { pattern: /fuite/i, theme: "dodge" },
    { pattern: /tacle/i, theme: "tackle" },
    { pattern: /port[eé]e/i, theme: "range" },
    { pattern: /[eé]rosion/i, theme: "erosion" },
    { pattern: /renvoi/i, theme: "shield" },
    { pattern: /bouclier/i, theme: "shield" },
];

/** URL publique de l'icône officielle d'un thème. */
export function dofusStatAssetUrl(asset: string): string {
    return `${DOFUS_STAT_ASSET_BASE}/${asset}`;
}

/**
 * Thème d'une stat, ou `null` si elle n'est pas identifiable (⇒ repli lucide).
 *
 * Cascade : `characteristicId` → `effectId` → code court → mots-clés du libellé.
 */
export function resolveDofusStatTheme(
    characteristicId?: number | null,
    effectId?: number | null,
    charCode?: string | null,
    label?: string | null
): DofusStatAsset | null {
    const key =
        (characteristicId != null
            ? THEME_BY_CHARACTERISTIC[characteristicId] ?? THEME_BY_ID[characteristicId]
            : undefined) ??
        (effectId != null ? THEME_BY_ID[effectId] : undefined) ??
        (charCode ? THEME_BY_CODE[charCode.toLowerCase()] : undefined) ??
        (label ? LABEL_THEME_PATTERNS.find((entry) => entry.pattern.test(label))?.theme : undefined);

    return key ? STAT_THEMES[key] : null;
}

/**
 * Retourne la couleur de texte pour afficher une valeur de stat DofusBook.
 * Si la valeur est négative (malus), renvoie le rouge malus.
 */
export function getDofusStatNumberColor(
    value: number | { from?: number; to?: number },
    characteristicId?: number | null,
    effectId?: number | null,
    charCode?: string | null,
    label?: string | null
): string {
    const isNegative = typeof value === "number"
        ? value < 0
        : (value.from != null && value.from < 0) || (value.to != null && value.to < 0);

    if (isNegative) {
        return DOFUSBOOK_COLORS.malus;
    }

    const theme = resolveDofusStatTheme(characteristicId, effectId, charCode, label);
    if (!theme) return "#a855f7";

    switch (theme.asset) {
        case "pv.png": return DOFUSBOOK_COLORS.vitalite;
        case "terre.png": return DOFUSBOOK_COLORS.force;
        case "feu.png": return DOFUSBOOK_COLORS.intelligence;
        case "eau.png": return DOFUSBOOK_COLORS.chance;
        case "air.png": return DOFUSBOOK_COLORS.agilite;
        case "sagesse.png": return DOFUSBOOK_COLORS.sagesse;
        case "puissance.png": return DOFUSBOOK_COLORS.puissance;
        case "pa.png": return DOFUSBOOK_COLORS.pa;
        case "pm.png": return DOFUSBOOK_COLORS.pm;
        case "po.png": return DOFUSBOOK_COLORS.po;
        case "critique.png": return DOFUSBOOK_COLORS.critique;
        case "soin.png": return DOFUSBOOK_COLORS.soin;
        case "dommages.png": return DOFUSBOOK_COLORS.dommages;
        case "neutre.png": return DOFUSBOOK_COLORS.neutre;
        case "invocation.png": return DOFUSBOOK_COLORS.invocation;
        case "initiative.png": return DOFUSBOOK_COLORS.initiative;
        case "pp.png": return DOFUSBOOK_COLORS.prospection;
        case "pod.png": return DOFUSBOOK_COLORS.pods;
        case "fuite.png": return DOFUSBOOK_COLORS.fuite;
        case "tacle.png": return DOFUSBOOK_COLORS.tacle;
        case "retraitPA.png": return DOFUSBOOK_COLORS.retraitPA;
        case "retraitPM.png": return DOFUSBOOK_COLORS.retraitPM;
        case "esquivePA.png": return DOFUSBOOK_COLORS.esquivePA;
        case "esquivePM.png": return DOFUSBOOK_COLORS.esquivePM;
        case "bouclier.png":
        case "resNeutre.png":
        case "resTerre.png":
        case "resFeu.png":
        case "resEau.png":
        case "resAir.png":
            return DOFUSBOOK_COLORS.resistance;
        default:
            return "#a855f7";
    }
}
