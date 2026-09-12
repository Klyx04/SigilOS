/**
 * Référentiel des assets visuels officiels Dofus et des couleurs DofusBook pour les caractéristiques / stats.
 */

export interface DofusStatTheme {
    asset: string; // Nom du fichier dans /assets/dofus/stats/
    color: string; // Couleur HEX DofusBook
    label?: string;
}

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
 * Mapping clé (characteristicId ou code court) -> { asset, color }
 */
const STAT_THEMES: Record<string, DofusStatTheme> = {
    // Vitalité
    "11": { asset: "pv.png", color: DOFUSBOOK_COLORS.vitalite, label: "Vitalité" },
    "125": { asset: "pv.png", color: DOFUSBOOK_COLORS.vitalite, label: "Vitalité" },
    vi: { asset: "pv.png", color: DOFUSBOOK_COLORS.vitalite, label: "Vitalité" },

    // Sagesse
    "12": { asset: "sagesse.png", color: DOFUSBOOK_COLORS.sagesse, label: "Sagesse" },
    "124": { asset: "sagesse.png", color: DOFUSBOOK_COLORS.sagesse, label: "Sagesse" },
    sa: { asset: "sagesse.png", color: DOFUSBOOK_COLORS.sagesse, label: "Sagesse" },

    // Force / Terre
    "10": { asset: "terre.png", color: DOFUSBOOK_COLORS.force, label: "Force" },
    "16": { asset: "terre.png", color: DOFUSBOOK_COLORS.force, label: "Force" },
    "118": { asset: "terre.png", color: DOFUSBOOK_COLORS.force, label: "Force" },
    fo: { asset: "terre.png", color: DOFUSBOOK_COLORS.force, label: "Force" },
    "92": { asset: "terre.png", color: DOFUSBOOK_COLORS.force, label: "Dommages Terre" },
    "430": { asset: "terre.png", color: DOFUSBOOK_COLORS.force, label: "Dommages Terre" },
    dtf: { asset: "terre.png", color: DOFUSBOOK_COLORS.force, label: "Dommages Terre" },

    // Intelligence / Feu
    "15": { asset: "feu.png", color: DOFUSBOOK_COLORS.intelligence, label: "Intelligence" },
    "126": { asset: "feu.png", color: DOFUSBOOK_COLORS.intelligence, label: "Intelligence" },
    in: { asset: "feu.png", color: DOFUSBOOK_COLORS.intelligence, label: "Intelligence" },
    "89": { asset: "feu.png", color: DOFUSBOOK_COLORS.intelligence, label: "Dommages Feu" },
    "424": { asset: "feu.png", color: DOFUSBOOK_COLORS.intelligence, label: "Dommages Feu" },
    dff: { asset: "feu.png", color: DOFUSBOOK_COLORS.intelligence, label: "Dommages Feu" },

    // Chance / Eau
    "13": { asset: "eau.png", color: DOFUSBOOK_COLORS.chance, label: "Chance" },
    "123": { asset: "eau.png", color: DOFUSBOOK_COLORS.chance, label: "Chance" },
    ch: { asset: "eau.png", color: DOFUSBOOK_COLORS.chance, label: "Chance" },
    "90": { asset: "eau.png", color: DOFUSBOOK_COLORS.chance, label: "Dommages Eau" },
    "432": { asset: "eau.png", color: DOFUSBOOK_COLORS.chance, label: "Dommages Eau" },
    def: { asset: "eau.png", color: DOFUSBOOK_COLORS.chance, label: "Dommages Eau" },

    // Agilité / Air
    "14": { asset: "air.png", color: DOFUSBOOK_COLORS.agilite, label: "Agilité" },
    "119": { asset: "air.png", color: DOFUSBOOK_COLORS.agilite, label: "Agilité" },
    ag: { asset: "air.png", color: DOFUSBOOK_COLORS.agilite, label: "Agilité" },
    "91": { asset: "air.png", color: DOFUSBOOK_COLORS.agilite, label: "Dommages Air" },
    "428": { asset: "air.png", color: DOFUSBOOK_COLORS.agilite, label: "Dommages Air" },
    daf: { asset: "air.png", color: DOFUSBOOK_COLORS.agilite, label: "Dommages Air" },

    // PA & PM & PO
    "1": { asset: "pa.png", color: DOFUSBOOK_COLORS.pa, label: "PA" },
    "111": { asset: "pa.png", color: DOFUSBOOK_COLORS.pa, label: "PA" },
    pa: { asset: "pa.png", color: DOFUSBOOK_COLORS.pa, label: "PA" },
    "23": { asset: "pm.png", color: DOFUSBOOK_COLORS.pm, label: "PM" },
    "128": { asset: "pm.png", color: DOFUSBOOK_COLORS.pm, label: "PM" },
    pm: { asset: "pm.png", color: DOFUSBOOK_COLORS.pm, label: "PM" },
    "19": { asset: "po.png", color: DOFUSBOOK_COLORS.po, label: "Portée" },
    "117": { asset: "po.png", color: DOFUSBOOK_COLORS.po, label: "Portée" },
    "182": { asset: "po.png", color: DOFUSBOOK_COLORS.po, label: "Portée" },
    po: { asset: "po.png", color: DOFUSBOOK_COLORS.po, label: "Portée" },

    // Coup Critique & Puissance & Dommages
    "18": { asset: "critique.png", color: DOFUSBOOK_COLORS.critique, label: "Critique" },
    cc: { asset: "critique.png", color: DOFUSBOOK_COLORS.critique, label: "Critique" },
    "25": { asset: "puissance.png", color: DOFUSBOOK_COLORS.puissance, label: "Puissance" },
    pu: { asset: "puissance.png", color: DOFUSBOOK_COLORS.puissance, label: "Puissance" },
    "27": { asset: "dommages.png", color: DOFUSBOOK_COLORS.dommages, label: "Dommages" },
    dmg: { asset: "dommages.png", color: DOFUSBOOK_COLORS.dommages, label: "Dommages" },
    "112": { asset: "critique.png", color: DOFUSBOOK_COLORS.critique, label: "Dommages Critiques" },
    "162": { asset: "critique.png", color: DOFUSBOOK_COLORS.critique, label: "Dommages Critiques" },
    dc: { asset: "critique.png", color: DOFUSBOOK_COLORS.critique, label: "Dommages Critiques" },
    "114": { asset: "dommages.png", color: DOFUSBOOK_COLORS.dommages, label: "Dommages Poussée" },
    "164": { asset: "dommages.png", color: DOFUSBOOK_COLORS.dommages, label: "Dommages Poussée" },

    // Neutre
    "93": { asset: "neutre.png", color: DOFUSBOOK_COLORS.neutre, label: "Dommages Neutre" },
    "141": { asset: "neutre.png", color: DOFUSBOOK_COLORS.neutre, label: "Dommages Neutre" },
    "422": { asset: "neutre.png", color: DOFUSBOOK_COLORS.neutre, label: "Dommages Neutre" },
    dnf: { asset: "neutre.png", color: DOFUSBOOK_COLORS.neutre, label: "Dommages Neutre" },

    // Soins & Invocations
    "26": { asset: "soin.png", color: DOFUSBOOK_COLORS.soin, label: "Soins" },
    "178": { asset: "soin.png", color: DOFUSBOOK_COLORS.soin, label: "Soins" },
    so: { asset: "soin.png", color: DOFUSBOOK_COLORS.soin, label: "Soins" },
    "28": { asset: "invocation.png", color: DOFUSBOOK_COLORS.invocation, label: "Invocations" },
    ic: { asset: "invocation.png", color: DOFUSBOOK_COLORS.invocation, label: "Invocations" },

    // Initiative, Prospection, Pods
    "98": { asset: "initiative.png", color: DOFUSBOOK_COLORS.initiative, label: "Initiative" },
    ii: { asset: "initiative.png", color: DOFUSBOOK_COLORS.initiative, label: "Initiative" },
    "100": { asset: "pp.png", color: DOFUSBOOK_COLORS.prospection, label: "Prospection" },
    pp: { asset: "pp.png", color: DOFUSBOOK_COLORS.prospection, label: "Prospection" },
    "102": { asset: "pod.png", color: DOFUSBOOK_COLORS.pods, label: "Pods" },
    pod: { asset: "pod.png", color: DOFUSBOOK_COLORS.pods, label: "Pods" },

    // Fuite, Tacle
    "78": { asset: "fuite.png", color: DOFUSBOOK_COLORS.fuite, label: "Fuite" },
    "752": { asset: "fuite.png", color: DOFUSBOOK_COLORS.fuite, label: "Fuite" },
    fu: { asset: "fuite.png", color: DOFUSBOOK_COLORS.fuite, label: "Fuite" },
    "79": { asset: "tacle.png", color: DOFUSBOOK_COLORS.tacle, label: "Tacle" },
    "753": { asset: "tacle.png", color: DOFUSBOOK_COLORS.tacle, label: "Tacle" },
    ta: { asset: "tacle.png", color: DOFUSBOOK_COLORS.tacle, label: "Tacle" },

    // Retrait & Esquive PA / PM
    "80": { asset: "retraitPA.png", color: DOFUSBOOK_COLORS.retraitPA, label: "Retrait PA" },
    rpa: { asset: "retraitPA.png", color: DOFUSBOOK_COLORS.retraitPA, label: "Retrait PA" },
    "82": { asset: "esquivePA.png", color: DOFUSBOOK_COLORS.esquivePA, label: "Esquive PA" },
    epa: { asset: "esquivePA.png", color: DOFUSBOOK_COLORS.esquivePA, label: "Esquive PA" },
    "83": { asset: "retraitPM.png", color: DOFUSBOOK_COLORS.retraitPM, label: "Retrait PM" },
    "412": { asset: "retraitPM.png", color: DOFUSBOOK_COLORS.retraitPM, label: "Retrait PM" },
    rpm: { asset: "retraitPM.png", color: DOFUSBOOK_COLORS.retraitPM, label: "Retrait PM" },
    "84": { asset: "esquivePM.png", color: DOFUSBOOK_COLORS.esquivePM, label: "Esquive PM" },
    epm: { asset: "esquivePM.png", color: DOFUSBOOK_COLORS.esquivePM, label: "Esquive PM" },

    // Résistances %
    "33": { asset: "resNeutre.png", color: DOFUSBOOK_COLORS.neutre, label: "Résistance Neutre (%)" },
    "34": { asset: "resTerre.png", color: DOFUSBOOK_COLORS.force, label: "Résistance Terre (%)" },
    "35": { asset: "resFeu.png", color: DOFUSBOOK_COLORS.intelligence, label: "Résistance Feu (%)" },
    "36": { asset: "resAir.png", color: DOFUSBOOK_COLORS.agilite, label: "Résistance Air (%)" },
    "37": { asset: "resEau.png", color: DOFUSBOOK_COLORS.chance, label: "Résistance Eau (%)" },
    "48": { asset: "resFeu.png", color: DOFUSBOOK_COLORS.intelligence, label: "Résistance Feu (%)" },
    "213": { asset: "resFeu.png", color: DOFUSBOOK_COLORS.intelligence, label: "Résistance Feu (%)" },
    rfp: { asset: "resFeu.png", color: DOFUSBOOK_COLORS.intelligence, label: "Résistance Feu (%)" },
    "49": { asset: "resEau.png", color: DOFUSBOOK_COLORS.chance, label: "Résistance Eau (%)" },
    "211": { asset: "resEau.png", color: DOFUSBOOK_COLORS.chance, label: "Résistance Eau (%)" },
    rep: { asset: "resEau.png", color: DOFUSBOOK_COLORS.chance, label: "Résistance Eau (%)" },
    "50": { asset: "resAir.png", color: DOFUSBOOK_COLORS.agilite, label: "Résistance Air (%)" },
    "212": { asset: "resAir.png", color: DOFUSBOOK_COLORS.agilite, label: "Résistance Air (%)" },
    rap: { asset: "resAir.png", color: DOFUSBOOK_COLORS.agilite, label: "Résistance Air (%)" },
    "51": { asset: "resTerre.png", color: DOFUSBOOK_COLORS.force, label: "Résistance Terre (%)" },
    "210": { asset: "resTerre.png", color: DOFUSBOOK_COLORS.force, label: "Résistance Terre (%)" },
    rtp: { asset: "resTerre.png", color: DOFUSBOOK_COLORS.force, label: "Résistance Terre (%)" },
    "52": { asset: "resNeutre.png", color: DOFUSBOOK_COLORS.neutre, label: "Résistance Neutre (%)" },
    "214": { asset: "resNeutre.png", color: DOFUSBOOK_COLORS.neutre, label: "Résistance Neutre (%)" },
    rnp: { asset: "resNeutre.png", color: DOFUSBOOK_COLORS.neutre, label: "Résistance Neutre (%)" },

    // Résistances fixes
    rn: { asset: "resNeutre.png", color: DOFUSBOOK_COLORS.neutre, label: "Résistance Neutre" },
    rt: { asset: "resTerre.png", color: DOFUSBOOK_COLORS.force, label: "Résistance Terre" },
    rf: { asset: "resFeu.png", color: DOFUSBOOK_COLORS.intelligence, label: "Résistance Feu" },
    re: { asset: "resEau.png", color: DOFUSBOOK_COLORS.chance, label: "Résistance Eau" },
    ra: { asset: "resAir.png", color: DOFUSBOOK_COLORS.agilite, label: "Résistance Air" },
    "87": { asset: "bouclier.png", color: DOFUSBOOK_COLORS.resistance, label: "Résistance Critiques" },
    "163": { asset: "bouclier.png", color: DOFUSBOOK_COLORS.resistance, label: "Résistance Critiques" },
    rfc: { asset: "bouclier.png", color: DOFUSBOOK_COLORS.resistance, label: "Résistance Critiques" },
    "88": { asset: "bouclier.png", color: DOFUSBOOK_COLORS.resistance, label: "Résistance Poussée" },
    "165": { asset: "bouclier.png", color: DOFUSBOOK_COLORS.resistance, label: "Résistance Poussée" },
    rp: { asset: "bouclier.png", color: DOFUSBOOK_COLORS.resistance, label: "Résistance Poussée" },
    dp: { asset: "bouclier.png", color: DOFUSBOOK_COLORS.resistance, label: "Résistance Poussée" },
};

/**
 * Résout l'asset officiel et la couleur DofusBook pour une caractéristique ou un effet donné.
 */
export function resolveDofusStatTheme(
    characteristicId?: number | null,
    effectId?: number | null,
    charCode?: string | null
): DofusStatTheme | null {
    if (characteristicId != null && STAT_THEMES[String(characteristicId)]) {
        return STAT_THEMES[String(characteristicId)];
    }
    if (effectId != null && STAT_THEMES[String(effectId)]) {
        return STAT_THEMES[String(effectId)];
    }
    if (charCode && STAT_THEMES[charCode.toLowerCase()]) {
        return STAT_THEMES[charCode.toLowerCase()];
    }
    return null;
}

/**
 * Retourne la couleur de texte pour afficher une valeur de stat DofusBook.
 * Si la valeur est négative (malus), renvoie le rouge malus.
 */
export function getDofusStatNumberColor(
    value: number | { from?: number; to?: number },
    characteristicId?: number | null,
    effectId?: number | null,
    charCode?: string | null
): string {
    const isNegative = typeof value === "number"
        ? value < 0
        : (value.from != null && value.from < 0) || (value.to != null && value.to < 0);

    if (isNegative) {
        return DOFUSBOOK_COLORS.malus;
    }

    const theme = resolveDofusStatTheme(characteristicId, effectId, charCode);
    return theme?.color ?? "#a855f7"; // Repli élégant violet
}
