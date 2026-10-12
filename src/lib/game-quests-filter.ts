/**
 * 🎛️ Règles **pures** de la liste des quêtes du panneau God : filtres → `where` Prisma, et fenêtre
 * de pagination.
 *
 * 🐛 Mesure du 10/10/2026 (constat user : « l'interface lag pas mal sur les quêtes, beaucoup de
 * chargement ») : `getGameQuests()` faisait un `findMany` **sans `select` ni `take`** ⇒ ~2 000
 * quêtes × toutes leurs colonnes (dont `contentJson`, le contenu des étapes) descendaient dans le
 * navigateur, qui peignait ensuite une carte **et une image** par quête. Les filtres vivaient côté
 * client : ils ne pouvaient donc **pas** rester côté client si on ne charge qu'une page (sinon
 * « aucune quête trouvée » alors que la quête existe page 12).
 *
 * Ce module ne fait **que** traduire des filtres déjà validés : aucune I/O, aucun import Prisma
 * (le `where` est un objet littéral, typé à l'endroit où Prisma le consomme) ⇒ testable seul.
 */

/** Taille d'une page : 3 colonnes × 16 lignes ≈ un écran plein — jamais 2 000 cartes d'un coup. */
export const GAME_QUESTS_PAGE_SIZE = 48;

export type GameQuestSource = "ALL" | "DOFUSDB" | "MANUAL";

export interface GameQuestFilters {
    /** Recherche libre : nom, catégorie, ou id DofusDB si la saisie est un entier. */
    search: string;
    /** Catégorie exacte (`""` = toutes). */
    category: string;
    levelMin: number | null;
    levelMax: number | null;
    source: GameQuestSource;
    /** Page demandée (0 = première). */
    page: number;
}

/** `where` Prisma — objet littéral, jamais typé ici (cf. en-tête du module). */
export type GameQuestWhere = Record<string, unknown>;

/** Fenêtre Prisma (`skip`/`take`) d'une page — bornée, jamais négative. */
export function gameQuestPageWindow(page: number): { skip: number; take: number } {
    const p = Number.isInteger(page) && page > 0 ? page : 0;
    return { skip: p * GAME_QUESTS_PAGE_SIZE, take: GAME_QUESTS_PAGE_SIZE };
}

/**
 * Traduit les filtres en `where` Prisma **en conservant le sens de l'ancien filtre client** :
 *
 * · **Niveau** — l'ancienne liste comparait le niveau **min** de la quête avec `NULL` traité comme
 *   `1` (`const qMin = q.levelMin ?? 1`). Un `levelMin: { gte: 2 }` exclurait les quêtes sans
 *   niveau : on ne le pose donc que si `levelMin > 1`, et le plafond rend `levelMin: null`
 *   explicitement valide (1 ≤ plafond, toujours vrai). C'est la seule partie non triviale.
 * · **Recherche** — nom OU catégorie (insensible à la casse) ; l'id DofusDB n'est comparé que si
 *   la saisie est un entier (l'ancien `includes` sur une chaîne faisait matcher « 12 » dans
 *   « 120 » : l'égalité est plus précise et indexable).
 * · **Source** — `DOFUSDB` = `dofusDbId` renseigné, `MANUAL` = `null`.
 *
 * Les contraintes sont posées dans un `AND` (jamais deux clés `OR` au même niveau), donc elles ne
 * peuvent pas s'écraser entre elles.
 */
export function buildGameQuestWhere(filters: GameQuestFilters): GameQuestWhere {
    const and: GameQuestWhere[] = [];

    const search = filters.search.trim();
    if (search) {
        const or: GameQuestWhere[] = [
            { name: { contains: search, mode: "insensitive" } },
            { category: { contains: search, mode: "insensitive" } },
        ];
        const asId = Number(search);
        if (Number.isInteger(asId) && asId > 0) or.push({ dofusDbId: asId });
        and.push({ OR: or });
    }

    if (filters.category) and.push({ category: filters.category });

    if (filters.levelMin !== null && filters.levelMin > 1) {
        and.push({ levelMin: { gte: filters.levelMin } });
    }
    if (filters.levelMax !== null) {
        and.push({ OR: [{ levelMin: { lte: filters.levelMax } }, { levelMin: null }] });
    }

    if (filters.source === "DOFUSDB") and.push({ dofusDbId: { not: null } });
    if (filters.source === "MANUAL") and.push({ dofusDbId: null });

    return and.length > 0 ? { AND: and } : {};
}
