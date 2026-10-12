/**
 * Télémétrie — règles d'**agrégation** pures (D-2).
 *
 * Chaque fonction remplace un calcul qui était faux ou inventé dans l'écran God :
 * - entonnoir d'activation (pourcentages négatifs : 3 populations mélangées) ;
 * - « Guild Health Index » (seuils 150 / 40 sortis de nulle part, score `80 + actions/50`) ;
 * - « Features à faible engagement » (bas d'un top 15 présenté comme un flop) ;
 * - « membres actifs » d'un module (= pages vues ÷ 3).
 *
 * Règle : **aucun seuil magique**. Ce qui dépend des données est dérivé de la distribution
 * observée ; ce qui ne dépend que du format est une constante nommée et documentée.
 */

// ---------------------------------------------------------------------------
// Entonnoir d'activation
// ---------------------------------------------------------------------------

export interface FunnelStepInput {
    readonly step: string;
    readonly count: number;
}

export interface FunnelStep {
    /** Libellé de l'étape. */
    step: string;
    /** Effectif borné (jamais négatif). */
    count: number;
    /** Perte entre l'étape précédente et celle-ci, **toujours** dans `[0, 100]`. */
    dropoffRate: number;
    /** Part de l'étape par rapport à la première marche, **toujours** dans `[0, 100]`. */
    conversionRate: number;
    /**
     * `true` si l'étape compte **plus** d'éléments que la précédente : signal d'un entonnoir
     * mal construit (populations non imbriquées) ou de données incohérentes. À afficher, jamais à masquer.
     */
    exceedsPrevious: boolean;
}

/**
 * Construit un entonnoir **monotone** : chaque taux est borné et une étape qui dépasse la
 * précédente est signalée (`exceedsPrevious`) au lieu de produire un pourcentage négatif.
 */
export function buildFunnel(steps: readonly FunnelStepInput[]): FunnelStep[] {
    if (steps.length === 0) return [];

    const normalizeCount = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0);
    const base = normalizeCount(steps[0]?.count ?? 0);

    return steps.map((current, index) => {
        const count = normalizeCount(current.count);
        const previous = index === 0 ? count : normalizeCount(steps[index - 1]?.count ?? 0);

        const exceedsPrevious = index > 0 && count > previous;
        const rawDropoff = index === 0 || previous <= 0 ? 0 : ((previous - count) / previous) * 100;
        const rawConversion = base <= 0 ? 0 : (count / base) * 100;

        return {
            step: current.step,
            count,
            dropoffRate: Number(Math.min(100, Math.max(0, rawDropoff)).toFixed(1)),
            conversionRate: Number(Math.min(100, Math.max(0, rawConversion)).toFixed(1)),
            exceedsPrevious,
        };
    });
}

// ---------------------------------------------------------------------------
// Santé des guildes
// ---------------------------------------------------------------------------

export type GuildHealthStatus = "THRIVING" | "HEALTHY" | "AT_RISK" | "DORMANT";

export interface GuildActivityInput {
    readonly id: string;
    readonly discordGuildId?: string | null;
    readonly name: string;
    readonly actions7d: number;
}

export interface GuildHealth {
    id: string;
    discordGuildId: string | null;
    name: string;
    actions7d: number;
    healthStatus: GuildHealthStatus;
    /** Rang centile (0-100) **dans l'échantillon mesuré** — pas une note absolue. */
    healthScore: number;
}

/**
 * Statut de santé **dérivé de la distribution observée**, sans seuil inventé :
 * - 0 action sur 7 j ⇒ `DORMANT`, score 0 ;
 * - guildes actives classées par quartile : premier quart `THRIVING`, moitié suivante `HEALTHY`,
 *   reste `AT_RISK` ; avec au moins deux guildes actives, il y a **toujours** au moins une
 *   `HEALTHY` (sinon une deuxième guilde active serait étiquetée « à risque » sans référence) ;
 * - `healthScore` = rang centile de la guilde parmi toutes les guildes connues.
 *
 * Garantie : un plus grand nombre d'actions ne peut **jamais** donner un statut moins bon.
 */
export function deriveGuildHealth(guilds: readonly GuildActivityInput[]): GuildHealth[] {
    if (guilds.length === 0) return [];

    const total = guilds.length;
    const normalized = guilds
        .map((guild) => ({
            id: guild.id,
            discordGuildId: guild.discordGuildId ?? null,
            name: guild.name,
            actions7d: Number.isFinite(guild.actions7d) ? Math.max(0, Math.trunc(guild.actions7d)) : 0,
        }))
        .sort((a, b) => b.actions7d - a.actions7d);

    const activeCount = normalized.filter((guild) => guild.actions7d > 0).length;
    const thrivingMaxRank = Math.max(1, Math.ceil(activeCount * 0.25));
    const healthyMaxRank = Math.max(thrivingMaxRank + (activeCount > thrivingMaxRank ? 1 : 0), Math.ceil(activeCount * 0.5));

    return normalized.map((guild, index) => {
        if (guild.actions7d <= 0) {
            return { ...guild, healthStatus: "DORMANT" as const, healthScore: 0 };
        }

        const rank = index + 1;
        const percentile = Math.round(((total - index) / total) * 100);
        const healthStatus: GuildHealthStatus =
            rank <= thrivingMaxRank ? "THRIVING" : rank <= healthyMaxRank ? "HEALTHY" : "AT_RISK";

        return { ...guild, healthStatus, healthScore: Math.min(100, Math.max(1, percentile)) };
    });
}

// ---------------------------------------------------------------------------
// Clics : tête et queue de classement
// ---------------------------------------------------------------------------

export interface EngagementSlice {
    readonly elementId: string;
    readonly count: number;
}

export interface EngagementSplit {
    /** Tête de classement (les `topSize` premiers). */
    top: EngagementSlice[];
    /**
     * Queue de classement — `null` tant qu'elle n'est pas exploitable : avec moins de
     * `2 × topSize + 1` identifiants distincts, la queue **recouvre** la tête, et l'afficher
     * reviendrait à présenter les mêmes lignes comme un « flop » (bug d'origine).
     */
    tail: EngagementSlice[] | null;
    /** Nombre d'identifiants distincts nécessaires pour que la queue soit exploitable. */
    minDistinctForTail: number;
    /** Nombre d'identifiants distincts reçus. */
    distinctCount: number;
}

/** Taille de la tête de classement affichée par l'écran God. */
export const ENGAGEMENT_TOP_SIZE = 7;

/**
 * Sépare un classement de clics en tête / queue **sans jamais se recouvrir**.
 * La queue reste `null` si l'échantillon est trop pauvre : l'écran doit dire pourquoi.
 */
export function splitEngagement(
    items: readonly EngagementSlice[],
    topSize: number = ENGAGEMENT_TOP_SIZE
): EngagementSplit {
    const size = Math.max(1, Math.trunc(topSize));
    const minDistinctForTail = size * 2 + 1;
    const sorted = [...items].sort((a, b) => b.count - a.count);

    return {
        top: sorted.slice(0, size),
        tail: sorted.length >= minDistinctForTail ? sorted.slice(-size).reverse() : null,
        minDistinctForTail,
        distinctCount: sorted.length,
    };
}
