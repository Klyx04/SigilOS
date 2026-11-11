/**
 * Hub « Communauté SigilOS » — vue « Échanges Metamob » : **règles pures** (aucune I/O).
 *
 * Le serveur croise deux sources :
 *  · les partenaires que Metamob propose pour la quête du lecteur (`getQuestMatches`) ;
 *  · les profils SigilOS du **même serveur** qui ont accepté d'apparaître (`showOnDirectory`).
 *
 * Ce module ne lit ni la base ni Metamob : il borne, normalise et ne garde que les champs
 * publics. C'est lui que `tests/unit/visitor-trades.test.ts` protège.
 *
 * Invariants :
 *  · l'ordre de Metamob est **conservé** (tri par équilibre donner/recevoir) ;
 *  · un partenaire absent de la liste des profils consentants est **écarté** ;
 *  · le lecteur ne se voit jamais lui-même ;
 *  · aucune clé, aucun champ brut de l'API (avatar, dernière activité, quête du partenaire).
 */

/** Maximum renvoyé par `GET /v1/quests/{slug}/matches` (doc mesurée le 11/11/2026). */
export const TRADE_MATCHES_LIMIT = 50;

/** Partenaires affichés. Au-delà, l'écran compte le reste au lieu de rendre 50 cartes. */
export const TRADE_PARTNERS_SHOWN = 20;

/** Monstres affichés par sens d'échange. Au-delà, l'écran dit « + N autres ». */
export const TRADE_MONSTERS_SHOWN = 3;

/** Le cache des matches est court : une proposition d'échange peut bouger vite. */
export const TRADE_MATCHES_CACHE_TTL = 120;

/** La quête Ocre du compte change rarement : dix minutes suffisent. */
export const TRADE_QUEST_CACHE_TTL = 600;

export type TradeMonster = {
    id: number;
    name: string;
    /** L'offre couvre entièrement le besoin. */
    coversNeed: boolean;
};

export type TradePartner = {
    /** `PublicProfile.id` — sert au lien vers la fiche SigilOS. */
    profileId: string;
    pseudo: string | null;
    /** Id de classe (`iop`, `feca`) : l'icône se résout par `getClass`. */
    classe: string | null;
    /**
     * Pseudo Metamob **déclaré et vérifié** à l'enregistrement. Il n'est publié que dans
     * cette vue : c'est le seul moyen de contacter la personne pour l'échange.
     */
    metamobPseudo: string;
    matchScore: number;
    reciprocal: boolean;
    theyHave: TradeMonster[];
    theyHaveMore: number;
    youHave: TradeMonster[];
    youHaveMore: number;
};

export type TradeBoard = {
    /** Partenaires retenus (profils consentants du serveur), ordre Metamob conservé. */
    partners: TradePartner[];
    /** Nombre de partenaires retenus **avant** la borne d'affichage. */
    partnersCount: number;
    /** Nombre de partenaires renvoyés par Metamob (avant croisement). */
    apiMatches: number;
    /** Total annoncé par Metamob (peut dépasser la borne examinée). */
    apiTotal: number;
    /** Vrai si Metamob a plus de partenaires que la borne examinée. */
    capped: boolean;
    /** Vrai si plus de partenaires retenus que la borne d'affichage. */
    displayCapped: boolean;
};

export type TradeMatchMonsterInput = {
    id: number;
    name: string;
    coversNeed: boolean;
};

export type TradeMatchInput = {
    /** Pseudo Metamob renvoyé par l'API. */
    username: string;
    matchScore: number;
    theyHaveYouWant: ReadonlyArray<TradeMatchMonsterInput>;
    youHaveTheyWant: ReadonlyArray<TradeMatchMonsterInput>;
};

export type TradeVisitorInput = {
    /** `PublicProfile.id`. */
    id: string;
    pseudo: string | null;
    classe: string | null;
    metamobPseudo: string | null;
};

/** Casse et espaces ne doivent jamais faire perdre un partenaire. */
export function normalizeMetamobPseudo(value: string | null | undefined): string {
    return String(value ?? "")
        .trim()
        .normalize("NFKC")
        .toLocaleLowerCase("fr");
}

/** Ramène une liste de monstres à un DTO borné, sans doublon ni nom vide. */
function toTradeMonsters(list: ReadonlyArray<TradeMatchMonsterInput>): TradeMonster[] {
    const out: TradeMonster[] = [];
    const seen = new Set<number>();
    for (const monster of list) {
        const id = Number(monster.id);
        if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
        const name = String(monster.name ?? "").trim().slice(0, 120);
        if (!name) continue;
        seen.add(id);
        out.push({ id: Math.trunc(id), name, coversNeed: !!monster.coversNeed });
    }
    return out;
}

/**
 * Construit le tableau des échanges à partir de deux lectures **déjà filtrées** par le
 * serveur (même serveur, `showOnDirectory: true`).
 *
 * Pourquoi ne garder que les partenaires présents dans `visitors` : l'API et la base sont
 * lues séparément. Si un visiteur retire son consentement entre les deux, il ne doit pas
 * apparaître — on l'écarte, jamais on ne l'invente.
 */
export function buildTradeBoard(input: {
    matches: ReadonlyArray<TradeMatchInput>;
    visitors: ReadonlyArray<TradeVisitorInput>;
    viewerProfileId: string;
    viewerMetamobPseudo: string | null;
    apiTotal?: number;
    partnerCap?: number;
}): TradeBoard {
    const cap = Math.max(1, input.partnerCap ?? TRADE_PARTNERS_SHOWN);

    const visitorsByPseudo = new Map<string, TradeVisitorInput>();
    for (const visitor of input.visitors) {
        if (!visitor.metamobPseudo) continue;
        const key = normalizeMetamobPseudo(visitor.metamobPseudo);
        if (!key || visitorsByPseudo.has(key)) continue;
        visitorsByPseudo.set(key, visitor);
    }

    const viewerKey = normalizeMetamobPseudo(input.viewerMetamobPseudo);
    const seen = new Set<string>();
    const all: TradePartner[] = [];

    for (const match of input.matches) {
        const key = normalizeMetamobPseudo(match.username);
        if (!key || key === viewerKey || seen.has(key)) continue;

        const visitor = visitorsByPseudo.get(key);
        if (!visitor || visitor.id === input.viewerProfileId) continue;

        const metamobPseudo = visitor.metamobPseudo?.trim();
        if (!metamobPseudo) continue;

        const theyHave = toTradeMonsters(match.theyHaveYouWant);
        const youHave = toTradeMonsters(match.youHaveTheyWant);
        if (theyHave.length === 0 && youHave.length === 0) continue;

        seen.add(key);
        all.push({
            profileId: visitor.id,
            pseudo: visitor.pseudo,
            classe: visitor.classe,
            metamobPseudo,
            matchScore: Number.isFinite(match.matchScore)
                ? Math.max(0, Math.trunc(match.matchScore))
                : 0,
            reciprocal: theyHave.length > 0 && youHave.length > 0,
            theyHave: theyHave.slice(0, TRADE_MONSTERS_SHOWN),
            theyHaveMore: Math.max(0, theyHave.length - TRADE_MONSTERS_SHOWN),
            youHave: youHave.slice(0, TRADE_MONSTERS_SHOWN),
            youHaveMore: Math.max(0, youHave.length - TRADE_MONSTERS_SHOWN),
        });
    }

    const apiMatches = input.matches.length;
    const apiTotal = Math.max(apiMatches, input.apiTotal ?? apiMatches);

    return {
        partners: all.slice(0, cap),
        partnersCount: all.length,
        apiMatches,
        apiTotal,
        capped: apiTotal > apiMatches,
        displayCapped: all.length > cap,
    };
}

/** Clés de cache : par **lecteur**, jamais par clé Metamob (aucun secret dans Redis). */
export function publicTradesMatchesCacheKey(userId: string): string {
    return `public-trades:matches:v1:${userId}`;
}

export function publicTradesQuestCacheKey(userId: string): string {
    return `public-trades:quest:v1:${userId}`;
}

export type TradeFailure = "unauthorized" | "unavailable" | "not-found";

/**
 * Traduit l'erreur du client Metamob en état d'écran. Fail-soft : tout ce qui n'est pas
 * une clé refusée ou une quête disparue devient « indisponible » — jamais un accès accordé.
 */
export function classifyTradeFailure(error: unknown): TradeFailure {
    const code =
        typeof error === "object" && error !== null && "code" in error
            ? String((error as { code?: unknown }).code ?? "")
            : "";
    if (code === "UNAUTHORIZED" || code === "FORBIDDEN") return "unauthorized";
    if (code === "NOT_FOUND") return "not-found";
    return "unavailable";
}
