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

/** Effet natif d'un item (plage min–max issue du CATALOGUE, jamais du client). */
export type MarketNativeEffect = {
    effectId: number;
    characteristic: number | null;
    from: number;
    to: number;
    category: number | null;
    elementId: number | null;
};

/** Effet DofusDB tolérant (formes `int_id` / `effectId` / `characteristic`). */
export type DofusItemEffectLike = {
    int_id?: number | null;
    effectId?: number | null;
    characteristic?: number | null;
    from?: number | null;
    to?: number | null;
    int_name?: string | null;
    category?: number | null;
    elementId?: number | null;
};

/** Libellés FR par `characteristicId` DofusDB (repli hors base). */
export const CHAR_NAMES: Record<number, string> = {
    11: "Vitalité",
    12: "Sagesse",
    13: "Chance",
    14: "Agilité",
    15: "Intelligence",
    16: "Force",
    18: "Critique",
    19: "Portée",
    1: "PA",
    23: "PM",
    25: "Puissance",
    26: "Soins",
    27: "Dommages",
    28: "Invocations",
    48: "Résistance Feu (%)",
    49: "Résistance Eau (%)",
    50: "Résistance Air (%)",
    51: "Résistance Terre (%)",
    52: "Résistance Neutre (%)",
    89: "Dommages Feu",
    90: "Dommages Eau",
    91: "Dommages Air",
    92: "Dommages Terre",
    93: "Dommages Neutre",
    141: "Dommages Neutre",
    78: "Fuite",
    79: "Tacle",
    80: "Retrait PA",
    82: "Esquive PA",
    83: "Retrait PM",
    84: "Esquive PM",
    412: "Retrait PM",
    87: "Résistance Critiques",
    88: "Résistance Poussée",
    112: "Dommages Critiques",
    114: "Dommages Poussée",
    125: "Vitalité",
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
 * ⚙️ S2.2 — Convertit les effets DofusDB en version **LÉGÈRE** (`nativeEffects`)
 * stockée sur `GameItem` : ce sont les **plages natives** (source serveur) que
 * l'éditeur de jet pré-remplit et que la carte d'item affiche.
 * Renvoie `null` si l'item n'a aucun effet natif.
 */
export function toNativeEffects(
    raw: { effects?: DofusItemEffectLike[] | null } | null | undefined
): MarketNativeEffect[] | null {
    const source = Array.isArray(raw?.effects) ? raw!.effects! : [];
    const mapped = source
        .map((fx) => ({
            effectId: Number(fx.effectId ?? fx.int_id ?? 0),
            characteristic: fx.characteristic != null ? Number(fx.characteristic) : null,
            from: Number(fx.from ?? 0),
            to: Number(fx.to ?? 0),
            category: fx.category != null ? Number(fx.category) : null,
            elementId: fx.elementId != null ? Number(fx.elementId) : null,
        }))
        .filter((fx) => Number.isFinite(fx.effectId) && fx.effectId > 0);

    return mapped.length > 0 ? mapped : null;
}

/**
 * Libellé FR d'un effet.
 * Priorité : **référentiel data-driven** (base, S2.5bis) → `int_name` → `CHAR_NAMES`.
 */
export function getStatLabel(
    fx: Pick<DofusItemEffectLike, "int_name" | "characteristic" | "effectId" | "int_id">,
    referential?: Record<number, string>
): string {
    const cid = fx.characteristic ?? fx.effectId ?? fx.int_id ?? null;
    if (cid != null && referential && referential[cid]) return referential[cid];
    if (fx.int_name && BOOK_STAT_NAMES[fx.int_name]) return BOOK_STAT_NAMES[fx.int_name];
    if (fx.int_name) return fx.int_name;
    if (cid != null && CHAR_NAMES[cid]) return CHAR_NAMES[cid];
    return "Effet";
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
    return found ? { from: found.from, to: found.to } : null;
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
export function buildNativeStatDrafts(
    nativeEffects: MarketNativeEffect[] | null | undefined,
    referential?: Record<number, string> | null
): MarketStatDraft[] {
    if (!Array.isArray(nativeEffects)) return [];
    return nativeEffects.map((fx) => {
        const label = getStatLabel(
            { characteristic: fx.characteristic, effectId: fx.effectId },
            referential ?? undefined
        );
        return {
            effectId: fx.effectId,
            characteristic: fx.characteristic,
            label,
            naturalMin: fx.from,
            naturalMax: fx.to,
            actualValue: fx.to,
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
    { key: "invocation", effectId: 182, characteristic: 28, label: "Invocations", code: "ic" },
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

