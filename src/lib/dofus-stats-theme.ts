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
    27: "apDodge",
    82: "apDodge",
    28: "mpDodge",
    84: "mpDodge",
    80: "apReduction",
    83: "mpReduction",
    412: "mpReduction",
    31: "damage",
    40: "pods",
    44: "initiative",
    48: "prospecting",
    49: "heals",
    178: "heals",
    50: "shield",
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
    // Dommages élémentaires
    89: "fireDamage",
    424: "fireDamage",
    90: "waterDamage",
    432: "waterDamage",
    91: "airDamage",
    428: "airDamage",
    92: "earthDamage",
    430: "earthDamage",
    93: "neutralDamage",
    141: "neutralDamage",
    422: "neutralDamage",
    // Critique & poussée
    112: "criticalDamage",
    162: "criticalDamage",
    87: "criticalResistance",
    163: "criticalResistance",
    114: "pushDamage",
    164: "pushDamage",
    88: "pushResistance",
    165: "pushResistance",
    // Fuite / tacle
    78: "dodge",
    752: "dodge",
    79: "tackle",
    753: "tackle",
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
        (characteristicId != null ? THEME_BY_ID[characteristicId] : undefined) ??
        (effectId != null ? THEME_BY_ID[effectId] : undefined) ??
        (charCode ? THEME_BY_CODE[charCode.toLowerCase()] : undefined) ??
        (label ? LABEL_THEME_PATTERNS.find((entry) => entry.pattern.test(label))?.theme : undefined);

    return key ? STAT_THEMES[key] : null;
}
