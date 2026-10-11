/**
 * Fiches des **monstres normaux** — règle pure et partagée.
 *
 * 🎯 Demande user (11/10/2026) : « un onglet fiche qui liste tous les monstres normaux
 * hors boss de dj / avis de recherche / anomalie / titans / boss de raid » — ce sont
 * exactement les monstres de salle déjà remontés par les familles des boss.
 *
 * Deux responsabilités, une seule source :
 *   · `isNormalMonster` / `listNormalMonsters` — QUI a droit à sa fiche (le filtre) ;
 *   · `monsterFicheHref` — OÙ elle vit (`/bestiaire/<slug>`, slug = `slugifyBossName`,
 *     le même algorithme que les fiches boss : jamais un slug recalculé à la main).
 */
import { slugifyBossName } from "./boss-slug";

export interface MonsterLike {
    name: string;
    /** Libellé de famille / race affiché à côté du nom (`raceName` des datasets locaux). */
    raceName?: string | null;
    /** Boss principal de la salle (le sujet de la fiche : il a déjà la sienne). */
    isBoss?: boolean | null;
    /** Monstre d'anomalie (Briko/Bruto/Gromo) : il vit dans la fiche du gardien. */
    isCompanion?: boolean | null;
    /** Marqué « avis de recherche » par le siphon (`Bounty.isBountyMonster`). */
    isBounty?: boolean | null;
    /** Marqué « boss de raid » (donjon `isRaidBoss`). */
    isRaidBoss?: boolean | null;
    /** Marqué « boss d'anomalie » (donjon `isAnomalyBoss`). */
    isAnomalyBoss?: boolean | null;
    /** Famille (raceId Ankama) — seule dimension « métier » disponible localement (cf. facettes). */
    raceId?: number | null;
    /** Super-famille (« Créatures de quête », « Créatures Archimonstres »…) — regroupement d'affichage. */
    superRaceId?: number | null;
    superRaceName?: string | null;
    /** Nature explicite quand la source la connaît (`boss` | `titan` | `monstre`…). */
    kind?: string | null;
    type?: string | null;
}

const SEGMENTS_EXCLUS = new Set(["boss", "titan", "anomalie", "anomaly", "raid", "bounty", "avis"]);

/**
 * A-t-il droit à SA fiche publique de monstre ? Non pour tout ce qui a déjà la sienne :
 * boss de donjon (y compris de raid / d'anomalie), titans, avis de recherche.
 */
export function isNormalMonster(monster: MonsterLike): boolean {
    if (!monster?.name || monster.name.trim() === "") return false;
    if (monster.isBoss) return false;
    if (monster.isCompanion) return false;
    if (monster.isBounty) return false;
    if (monster.isAnomalyBoss) return false;
    if (monster.isRaidBoss) return false;
    const kind = (monster.kind ?? monster.type ?? "").toLowerCase();
    if (kind && SEGMENTS_EXCLUS.has(kind)) return false;
    return true;
}

/** Liste filtrée **sans doublon de nom** (une même espèce ne s'affiche qu'une fois). */
export function listNormalMonsters<T extends MonsterLike>(monsters: T[]): T[] {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const monster of monsters ?? []) {
        if (!isNormalMonster(monster)) continue;
        const key = slugifyBossName(monster.name);
        if (key === "" || seen.has(key)) continue;
        seen.add(key);
        out.push(monster);
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/**
 * Lien vers la fiche d'un monstre normal. `null` = pas de nom exploitable (jamais d'URL
 * inventée) ; la surface (interne / publique) ne change pas la destination — la fiche
 * d'un monstre est publique et lisible par tous.
 */
export function monsterFicheHref(name: string | null | undefined): string | null {
    const slug = slugifyBossName(String(name ?? ""));
    return slug === "" ? null : `/bestiaire/${slug}`;
}

/** Normalise une recherche de monstre (« Pïou  ROUGE » → « piourouge »). */
export function normalizeMonsterQuery(value: string | null | undefined): string {
    return String(value ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "")
        .trim();
}

/**
 * Recherche des **monstres normaux** : filtre (`isNormalMonster`), dédoublonnage par
 * nom, tri alphabétique, puis correspondance normalisée (accents et ponctuation ignorés)
 * sur le nom **et** le libellé de famille — bornée par `limit` (`0` = aucun résultat).
 *
 * Pure (aucun accès base ni réseau) : les mêmes règles servent la liste interne et la
 * recherche de l'overlay, et les tests les vérifient sans infrastructure.
 */
export function searchNormalMonsters<T extends MonsterLike>(
    monsters: T[],
    query: string,
    limit = 60,
    /**
     * Filtre **2ᵉ niveau** : famille (raceId Ankama). `null`/absent = toutes les familles.
     * Les libellés de famille viennent de DofusDB (ex. « Monstres de quête »,
     * « Monstres de quête d'alignement ») : c'est ce qui rend le filtre « intelligent »
     * sans inventer de catégorie.
     */
    familyId: number | null = null
): T[] {
    const max = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
    if (max === 0) return [];
    const q = normalizeMonsterQuery(query);
    const family = familyId === null || familyId === undefined ? null : Math.floor(Number(familyId));
    let pool = listNormalMonsters(monsters);
    if (family !== null && Number.isFinite(family)) {
        pool = pool.filter((m) => Math.floor(Number(m.raceId) || 0) === family);
    }
    const matched = q === ""
        ? pool
        : pool.filter(
            (m) =>
                normalizeMonsterQuery(m.name).includes(q) ||
                normalizeMonsterQuery(m.raceName ?? "").includes(q)
        );
    return matched.slice(0, max);
}

/** Une famille (race) proposée comme 2ᵉ niveau de filtre, avec son poids réel. */
export interface MonsterFamilyFacet {
    raceId: number;
    /** Libellé officiel de la race (« Monstres de quête », « Blops »…) — jamais inventé. */
    name: string;
    /** Super-famille officielle (« Créatures de quête », « Créatures Archimonstres »…) : regroupement. */
    superRaceId: number | null;
    superRaceName: string | null;
    count: number;
    /** Monstre représentatif : son sprite réel sert d'icône au filtre (proxy d'assets). */
    sampleMonsterId: number | null;
}

/**
 * Facettes de familles des monstres **normaux** : un group-by par `raceId` sur la liste déjà
 * filtrée, trié par poids décroissant puis par nom.
 *
 * ⚠️ Une famille dont le **libellé n'est pas connu** n'est **pas** proposée : 132 `raceId` du
 * bestiaire n'ont pas de nom dans le référentiel local (1 483 monstres, mesuré le 11/10/2026)
 * — les afficher produirait des pastilles « Monstre » ×N, impossibles à distinguer (constat
 * UI/UX du user). Ces créatures restent trouvables par la recherche et le niveau ; on
 * n'invente jamais un nom de famille.
 */
export function groupMonsterFamilies<T extends MonsterLike & { monsterId?: number | null }>(
    monsters: T[]
): MonsterFamilyFacet[] {
    const byRace = new Map<number, MonsterFamilyFacet>();
    for (const monster of monsters ?? []) {
        const raceId = Math.floor(Number(monster.raceId) || 0);
        const label = String(monster.raceName ?? "").trim();
        if (raceId <= 0 || label === "") continue;
        const existing = byRace.get(raceId);
        if (existing) {
            existing.count += 1;
            if (existing.sampleMonsterId === null && monster.monsterId) existing.sampleMonsterId = monster.monsterId;
            continue;
        }
        byRace.set(raceId, {
            raceId,
            name: label,
            superRaceId: Math.floor(Number(monster.superRaceId) || 0) || null,
            superRaceName: String(monster.superRaceName ?? "").trim() || null,
            count: 1,
            sampleMonsterId: monster.monsterId ?? null,
        });
    }
    return [...byRace.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "fr"));
}

/**
 * Sprite **officiel** d'un monstre via le proxy d'assets du dépôt (`/api/assets-dofus/monsters/<id>`
 * — les URL `static.ankama.com` renvoient 403 en direct). `null` = pas d'identifiant exploitable :
 * on n'affiche alors **rien** plutôt qu'une URL inventée. Source unique de cette URL pour les
 * surfaces publiques (sommaire `/bestiaire`, filtre des familles).
 */
export function monsterSpriteUrl(monsterId: number | null | undefined): string | null {
    const id = Math.floor(Number(monsterId) || 0);
    return id > 0 ? `/api/assets-dofus/monsters/${id}` : null;
}
