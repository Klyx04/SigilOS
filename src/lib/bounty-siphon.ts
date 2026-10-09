/**
 * SIPHON « Avis de recherche » (bounties) — DofusDB + Dofensive.
 *
 * Contrat (règle de la maison : le contenu n'est JAMAIS saisi à la main) :
 *  1. **Liste** = DofusDB `monsters?race={32,90,127,147,156}` (« Avis de recherche », 96 entités).
 *     DofusDB est la source de vérité de l'**appartenance** : le drapeau `isBounty` est faux
 *     pour 14 des 96 — mesuré le 16/09/2026 ⇒ c'est la RACE qui fait foi.
 *  2. **Preuve** = Dofensive `/monsters/{id}` : `Race.Name` « Avis de recherche » ou
 *     `Family.Id` 27 « Créatures de quête ». Faute de preuve, l'entrée n'est pas servie
 *     (`unproven`) ; Dofensive injoignable ⇒ les candidats de la race sont conservés
 *     (`validated: false`), jamais de liste vidée par un incident réseau.
 *  3. **Zone de traque** = `Subareas[]` Dofensive (`IsFavorite` en premier) — 15 des 96 avis
 *     n'en ont aucune : on n'en fabrique pas.
 *  4. **Sorts de combat** = Dofensive `/spells/{id}` (source de vérité combat) ; si l'avis n'est
 *     pas exposé, les sorts sont RECONSTRUITS depuis DofusDB (`buildCombatSpellsFromDofusDb`)
 *     pour que la simulation isométrique fonctionne malgré tout. Le calcul de dégâts
 *     (`src/lib/dofus-monster-damage.ts`) s'applique automatiquement via `mergeDofensiveSpells`.
 *  5. **Carte de simulation** : Dofensive n'expose NI carte NI grille pour un avis (`PreferredMaps`
 *     vide ; les maps sauvages renvoient un stub `Cells: {}`) ⇒ **aucune carte d'emprunt**
 *     (`battleMapId: null`, `battleMapSource: "none"`) : la simulation tourne sur la **grille
 *     vide** (« Map vide », cf. `BOUNTY_MAP_EMPTY_LABEL`). Emprunter la carte d'un donjon
 *     affichait une salle sans rapport avec la traque (constat user du 16/09/2026).
 *  6. **Icônes** = monstre + sorts (DofusDB → WebP disque) : zéro dépendance CDN à l'exécution.
 *  7. **Écriture** = une ligne `Bounty` par avis (**upsert par `dofusdbId`** — des homonymes
 *     existent : 3 × « Ronce »), sinon **adoption de la ligne historique du même nom** quand elle
 *     est unique : mesuré le 27/09/2026, 83 lignes historiques portent la curation God face à 91
 *     avis siphonnés vides ⇒ sans adoption, l'upsert fabrique un **jumeau vide** et la curation
 *     reste invisible (`pickAdoptableBounty`, `src/lib/bounty.ts`). Plus une fiche `MonsterStat`
 *     (stats DofusDB enrichies, sorts de combat fusionnés, métadonnées `bounty`). Les champs
 *     **curés** de `Bounty` (`rewards`, `doplons`, `milice`, `rewardType`, `mechanics`, `position`,
 *     `dpnlUrl`, `mapUrl`, `reward`) ne sont **jamais** écrasés par le siphon.
 *  8. **Exclusions** = un avis **supprimé dans God** entre dans la liste d'exclusion
 *     (`src/lib/bounty-ignore.ts`) : il n'est ni réécrit ni recréé, et le compte est remonté
 *     (`ignored`) — une suppression ne doit jamais être annulée par le cron.
 *
 * Idempotent et fail-soft : relançable sans effet de bord, une erreur unitaire n'interrompt pas
 * la passe. Appelé par la phase 4 du cron `sync-monster-stats` et par le bouton God
 * « Siphonner les avis de recherche ».
 */
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { dofusdbFetch } from "@/lib/dofusdb-fetch";
import { dofensiveFetch } from "@/lib/dofensive-fetch";
import { getIgnoredBountyIds, getIgnoredBountyNames, isIgnoredBounty, isIgnoredBountyName, normalizeBountyName } from "@/lib/bounty-ignore";
import { diffFields, recordGameDataChanges } from "@/lib/game-data-changelog";
import { DB_READABLE, mapWithConcurrency, persistMonsterStat } from "@/lib/dofensive-sync";
import { mergeDofensiveSpells, type DofensiveSpellCombat } from "@/lib/dofensive-spells";
import { siphonAndCompressImage } from "@/lib/dofus-asset-siphon";
import { buildCombatSpellsFromDofusDb, dofusDbStatBonusFromGrades, fetchSpellLevels } from "@/lib/anomaly-boss-siphon";
// 🔴 A1 (28/09/2026) — CŒURS descendus en `src/lib` (worker BullMQ sans session Next, sans jsdom).
import { getDofensiveSpells } from "@/lib/dofensive-api";
import { getMonsterStats } from "@/lib/monster-stats-core";
import {
    BOUNTY_RACE_IDS,
    bountyCriteriaLabels,
    bountyDofensiveSpellIds,
    bountyDropObjectIds,
    bountyLevel,
    bountyLevelRange,
    bountyRaceName,
    bountySlug,
    isBountyRace,
    isIdSuffixedBountySlug,
    isProvenBounty,
    normalizeBountySubareas,
    pickAdoptableBounty,
    pickBountyBattleMap,
    pickBountySubarea,
    uniqueBountySlug,
    type BountyMapSource,
    type BountySubarea,
} from "@/lib/bounty";

/** Concurrence bornée (anti-rate-limit Dofensive) — même valeur que les autres siphons. */
const CONCURRENCY = 4;

/** Bornes de l'instantané « orphelins » (snapshot Redis lu par God, 7 j TTL). */
export const BOUNTY_ORPHANS_SNAPSHOT_MAX = 100;

/** Une ligne `Bounty` orpheline : à examiner (et exclure) dans God, jamais supprimée ici. */
export interface BountyOrphanEntry {
    /** Id de la ligne (pour l'exclusion en masse côté God). */
    id: string;
    dofusdbId: number | null;
    name: string;
    slug: string;
}

/** Un avis résolu par le siphon (sortie = télémétrie God + filtres des écrans). */
export interface BountySiphonEntry {
    id: number;
    name: string;
    slug: string;
    level: number;
    raceId: number;
    raceName: string;
    subareaId: number | null;
    subareaName: string | null;
    mapId: number;
    mapSource: BountyMapSource;
    spells: number;
    validated: boolean;
    imageUrl: string | null;
}

export interface BountySyncResult {
    synced: number;
    unchanged: number;
    errors: string[];
    imagesSiphoned: number;
    /** Candidats écartés faute de preuve d'appartenance (Dofensive joignable mais pas d'avis). */
    unproven: number;
    /** Nombre d'avis par race DofusDB (« 32 » → 38). */
    perRace: Record<string, number>;
    /** Avis servis avec la carte de repli (Dofensive n'expose aucune grille). */
    defaultMap: number;
    /** Avis **exclus volontairement** (supprimés dans God) — non réécrits, non recréés. */
    ignored: number;
    /**
     * 🔶 Lignes `Bounty` **orphelines** (08/10/2026) : ni dans les 5 races DofusDB, ni
     * exclues — historique pré-siphon, jumeaux d'homonymes, graines semées pendant une
     * panne Dofensive. Calculé sur PASSE COMPLÈTE uniquement (un passage par race
     * verrait les autres races comme orphelines — faux positif). Jamais supprimé par
     * le siphon (la curation est sacrée) : God les passe en exclusion en un clic.
     * Borné à `BOUNTY_ORPHANS_SNAPSHOT_MAX` (le total exact est dans `orphanedTotal`).
     */
    orphaned: BountyOrphanEntry[];
    /** Nombre total d'orphelins (avant borne). */
    orphanedTotal: number;
    /** `true` si `orphaned` a été calculé (passe complète — seule source fiable). */
    orphansComputed: boolean;
    /** Fiches dont les grades manquaient et ont été relus depuis la liste (zéro appel en plus). */
    gradesBackfilled: number;
    /** Fiches dont le butin manquait et a été relu (1 appel `items?` borné). */
    dropsBackfilled: number;
    entries: BountySiphonEntry[];
}

/** Avis résolu (liste + métadonnées) — étape intermédiaire entre source et écriture. */
interface BountyTarget {
    id: number;
    name: string;
    slug: string;
    raceId: number;
    raceName: string;
    level: number;
    levelMin: number | null;
    levelMax: number | null;
    subareaId: number | null;
    subareaName: string | null;
    subareas: BountySubarea[];
    mapId: number;
    mapSource: BountyMapSource;
    imageUrl: string | null;
    gfxId: number | null;
    dropObjectIds: number[];
    criteria: string[];
    validated: boolean;
    source: "DOFENSIVE" | "DOFUSDB";
    meta: any | null;
    /** Grades + drops bruts de l'appel de liste (repli sans appel en plus). */
    gradesRaw: any[];
    dropsRaw: any[];
}

/** Sous-zones d'un avis : Dofensive (`Subareas`) d'abord, sinon DofusDB (`subareas`). */
function bountySubareasOf(meta: any, monster: any): BountySubarea[] {
    return normalizeBountySubareas(meta?.Subareas ?? monster?.subareas);
}

/**
 * Siphonne **les 96 avis de recherche** (5 races DofusDB) : fiche `MonsterStat`, ligne `Bounty`,
 * sorts de combat, zone de traque, carte de repli, icônes. Idempotent et fail-soft.
 *
 * @param raceIds Restreint la passe aux races listées (siphon par étape côté
 * God : journal temps réel + appels courts anti-timeout). Absent = les 5 races
 * (cron + compat).
 */
export async function syncBounties(raceIds?: readonly number[]): Promise<BountySyncResult> {
    const result: BountySyncResult = {
        synced: 0,
        unchanged: 0,
        errors: [],
        imagesSiphoned: 0,
        unproven: 0,
        perRace: {},
        defaultMap: 0,
        ignored: 0,
        orphaned: [],
        orphanedTotal: 0,
        orphansComputed: false,
        gradesBackfilled: 0,
        dropsBackfilled: 0,
        entries: [],
    };

    // 1. LISTE — un appel DofusDB par race (les fiches complètes arrivent dans la même réponse ;
    //    `$limit` est plafonné à 50 par l'API et la race la plus fournie en compte 38 : une page
    //    suffit. Si une race atteignait le plafond, on le SIGNALE (jamais de troncature muette) :
    //    `$skip` n'est pas fiable (mesuré : la réponse renvoie `skip: 0` quel que soit le paramètre).
    const wantedRaces = raceIds && raceIds.length > 0 ? raceIds : BOUNTY_RACE_IDS;
    const byId = new Map<number, any>();
    for (const raceId of wantedRaces) {
        const list = await dofusdbFetch<any[]>(`/monsters?race=${raceId}&lang=fr&$limit=50`);
        if (!Array.isArray(list) || list.length === 0) {
            result.errors.push(`DofusDB monsters?race=${raceId} indisponible`);
            continue;
        }
        if (list.length >= 50) {
            result.errors.push(`DofusDB monsters?race=${raceId} sature le plafond de 50 (avis potentiellement tronqués)`);
        }
        for (const monster of list) {
            const id = Math.floor(Number(monster?.id) || 0);
            const name = String(monster?.name?.fr ?? "").trim();
            if (id <= 0 || !name) continue;
            result.perRace[String(raceId)] = (result.perRace[String(raceId)] ?? 0) + 1;
            byId.set(id, { ...monster, __raceId: raceId });
        }
    }
    if (byId.size === 0) return result; // panne totale : rien n'est écrit (jamais destructif)

    // 2. PREUVE + zone de traque + critères de quête (Dofensive) — concurrence bornée, fail-soft.
    const base = [...byId.values()];
    const metaById = new Map<number, any>();
    await mapWithConcurrency(base, CONCURRENCY, async (monster) => {
        const id = Math.floor(Number(monster?.id) || 0);
        try {
            const raw = await dofensiveFetch<any>(`/monsters/${id}?lang=fr`, `bounty-monster-${id}`, true);
            const item = Array.isArray(raw) ? raw[0] : raw;
            if (item) metaById.set(id, item);
        } catch (error) {
            result.errors.push(`Avis ${String(monster?.name?.fr ?? id)}: Dofensive indisponible (${String(error)})`);
        }
    });

    // 3. RÉSOLUTION — un avis prouvé, sa zone de traque, sa carte de simulation.
    const targets: BountyTarget[] = [];
    for (const monster of base) {
        const id = Math.floor(Number(monster?.id) || 0);
        if (id <= 0 || !isBountyRace(monster?.__raceId)) continue;
        const name = String(monster?.name?.fr ?? "").trim();
        const meta = metaById.get(id) ?? null;
        // Preuve disponible ⇒ elle doit passer ; preuve absente (Dofensive down) ⇒ la race reste la
        // source et l'entrée est conservée marquée `validated: false` (jamais de liste vidée).
        if (meta && !isProvenBounty(meta)) {
            result.unproven++;
            continue;
        }
        const subareas = bountySubareasOf(meta, monster);
        const subarea = pickBountySubarea(subareas);
        const { min, max } = bountyLevelRange(monster?.grades);
        const map = pickBountyBattleMap(null); // Dofensive n'expose aucune carte d'avis (mesuré)
        targets.push({
            id,
            name,
            slug: bountySlug(name),
            raceId: Math.floor(Number(monster?.__raceId) || 0),
            raceName: bountyRaceName(monster?.__raceId, meta?.Race?.Name),
            level: bountyLevel(monster?.grades, 1),
            levelMin: min,
            levelMax: max,
            subareaId: subarea?.id ?? null,
            subareaName: subarea?.name ?? null,
            subareas,
            mapId: map.id,
            mapSource: map.source,
            imageUrl: typeof monster?.img === "string" ? monster.img : null,
            gfxId: Number.isFinite(Number(monster?.gfxId)) ? Math.floor(Number(monster.gfxId)) : null,
            dropObjectIds: bountyDropObjectIds(monster),
            criteria: bountyCriteriaLabels(meta),
            validated: !!meta,
            source: meta ? "DOFENSIVE" : "DOFUSDB",
            meta,
            // Repli sans appel en plus : si la fiche détaillée échoue (429…),
            // grades + drops se relisent ici (même format que `getMonsterStats`).
            gradesRaw: Array.isArray(monster?.grades) ? monster.grades : [],
            dropsRaw: Array.isArray(monster?.drops) ? monster.drops : [],
        });
    }
    result.defaultMap = targets.length;

    // 3bis. EXCLUSIONS VOLONTAIRES (God « Supprimer cet avis ») : un avis supprimé ne doit pas
    //       réapparaître à la passe suivante — la liste d'exclusion fait foi (jamais de résurrection).
    //       🔶 08/10/2026 : filtre sur l'id **ou** le nom normalisé. Le nom couvre les lignes
    //       historiques supprimées sans `dofusdbId` (aucune exclusion n'était enregistrée pour
    //       elles et le siphon les recréait) — voir `bounty-ignore.ts`.
    const ignoredIds = getIgnoredBountyIds();
    const ignoredNames = getIgnoredBountyNames();
    const keptTargets = targets.filter(
        (t) => !isIgnoredBounty(t.id, ignoredIds) && !isIgnoredBountyName(t.name, ignoredNames),
    );
    result.ignored = targets.length - keptTargets.length;

    // 3ter. SLUGS PROPRES (décision user 27/09/2026 : « les avis ont un chiffre dans l'URL,
    //       c'est pas propre ») — règle unique, appliquée ici pour TOUS les avis :
    //        · un slug déjà propre est CONSERVÉ (une URL publiée ne bouge pas) ;
    //        · un slug historique `nom-<id>` est nettoyé au passage (idempotent : la prochaine
    //          passe findFirst ne fait plus rien) ;
    //        · homonymes (3 × « Ronce ») ⇒ suffixe `-2`, `-3`… **jamais** l'identifiant.
    //       Les anciennes URL `nom-<id>` restent servies en 308 par la page publique.
    if (DB_READABLE) {
        const rows = await db.bounty.findMany({ select: { dofusdbId: true, slug: true } });
        const taken = new Set<string>();
        const currentSlugByDofusdbId = new Map<number, string>();
        for (const row of rows) {
            const slug = String(row.slug ?? "").trim();
            if (slug) taken.add(slug.toLowerCase());
            const id = Math.floor(Number(row.dofusdbId) || 0);
            if (id > 0) currentSlugByDofusdbId.set(id, slug);
        }
        for (const target of keptTargets) {
            const current = currentSlugByDofusdbId.get(target.id) ?? "";
            if (current && !isIdSuffixedBountySlug(current, target.id) && current.toLowerCase() === bountySlug(target.name)) {
                continue; // slug propre : intouchable
            }
            if (current) taken.delete(current.toLowerCase());
            const next = uniqueBountySlug(target.name, taken);
            taken.add(next.toLowerCase());
            target.slug = next;
        }
    }

    // 4. (Plus de « carte d'emprunt » : un avis n'a AUCUNE carte exposée par la source — la
    //     simulation tourne sur la grille vide, cf. `BOUNTY_MAP_EMPTY_LABEL`. Constat user du
    //     16/09/2026 : la carte « Abysses du temps » affichait une salle sans rapport avec la traque.)

    // 5. SIPHON unitaire : fiche + sorts de combat + ligne `Bounty` + icônes.
    await mapWithConcurrency(keptTargets, CONCURRENCY, async (target) => {
        try {
            const changed = await siphonOneBounty(target, result);
            if (changed) result.synced++;
            else result.unchanged++;
            result.entries.push({
                id: target.id,
                name: target.name,
                slug: target.slug,
                level: target.level,
                raceId: target.raceId,
                raceName: target.raceName,
                subareaId: target.subareaId,
                subareaName: target.subareaName,
                mapId: target.mapId,
                mapSource: target.mapSource,
                spells: target.meta ? bountyDofensiveSpellIds(target.meta).length : 0,
                validated: target.validated,
                imageUrl: target.imageUrl,
            });
        } catch (error) {
            result.errors.push(`Avis ${target.name}: ${String(error)}`);
            logger.warn("[bounty-siphon] avis en échec:", { error: String(error), id: target.id });
        }
    });

    // 5bis. RÉCONCILIATION — lignes `Bounty` orphelines (ni dans les races, ni exclues).
    //        ⚠️ PASSE COMPLÈTE UNIQUEMENT : un passage par race (`raceIds` fourni, bouton
    //        God « Ici ») ne voit qu'une race et prendrait les 4 autres pour des orphelines.
    //        Jamais destructif : on SIGNALE (snapshot God), on ne supprime rien — une ligne
    //        historique peut porter une curation God que seul un humain peut arbitrer.
    if ((!raceIds || raceIds.length === 0) && DB_READABLE) {
        try {
            const memberIds = new Set(byId.keys());
            const memberNames = new Set(
                [...byId.values()].map((m) => normalizeBountyName(String(m?.name?.fr ?? ""))),
            );
            const rows = await db.bounty.findMany({ select: { id: true, dofusdbId: true, name: true, slug: true } });
            const orphans: BountyOrphanEntry[] = [];
            for (const row of rows) {
                const rowId = Math.floor(Number(row?.dofusdbId) || 0);
                const rowName = String(row?.name ?? "");
                const isOrphan = rowId > 0
                    ? !memberIds.has(rowId) && !isIgnoredBounty(rowId, ignoredIds)
                    : !memberNames.has(normalizeBountyName(rowName)) &&
                      !isIgnoredBountyName(rowName, ignoredNames);
                if (!isOrphan) continue;
                orphans.push({
                    id: String(row?.id ?? ""),
                    dofusdbId: rowId > 0 ? rowId : null,
                    name: rowName,
                    slug: String((row as { slug?: unknown })?.slug ?? ""),
                });
            }
            orphans.sort((a, b) => a.name.localeCompare(b.name, "fr"));
            result.orphanedTotal = orphans.length;
            result.orphaned = orphans.slice(0, BOUNTY_ORPHANS_SNAPSHOT_MAX);
            result.orphansComputed = true;
        } catch (error) {
            // Fail-soft : la réconciliation ne doit jamais faire échouer la passe.
            logger.warn("[bounty-siphon] réconciliation orphelins impossible:", { error: String(error) });
        }
    }

    logger.info(
        `[bounty-siphon] ${result.entries.length} avis de recherche résolus ` +
        `(${result.synced} écrits, ${result.unchanged} inchangés, ${result.unproven} non prouvés, ` +
        `${result.ignored} exclu(s), ${result.orphanedTotal} orphelin(s), ${result.errors.length} erreur(s), ` +
        `${result.imagesSiphoned} image(s), ` +
        `${result.gradesBackfilled} grades relus, ${result.dropsBackfilled} butins relus, ` +
        `simulation sur grille vide).`
    );
    return result;
}

/**
 * Siphonne UN avis : fiche `MonsterStat` (stats DofusDB + sorts de combat fusionnés +
 * métadonnées `bounty`), ligne `Bounty` (**upsert par `dofusdbId`**) et icônes (monstre + sorts).
 * Renvoie `true` si la ligne `Bounty` a été créée ou modifiée, `false` si inchangée.
 */
async function siphonOneBounty(target: BountyTarget, result: BountySyncResult): Promise<boolean> {
    const statsRes = await getMonsterStats(target.name, target.subareaName ?? undefined, true, target.id);
    const stats: any = statsRes.success && statsRes.data
        ? statsRes.data
        : { id: target.id, name: target.name, spells: [] };

    // Garde d'identité : la fiche écrite est **celle de l'avis** (id de la race DofusDB). Si la
    // source a résolu un AUTRE monstre (homonymie résiduelle, source incohérente), on le SIGNALE
    // et on garde les données de l'id cible — jamais de fiche croisée dans `MonsterStat`.
    const resolvedId = Math.floor(Number(stats.id) || 0);
    if (resolvedId > 0 && resolvedId !== target.id) {
        result.errors.push(`Avis ${target.name} (${target.id}) : fiche résolue vers l'id ${resolvedId} (homonyme) — données ignorées`);
        stats.id = target.id;
        stats.name = target.name;
        stats.spells = [];
    }

    // Sorts de combat : Dofensive d'abord (source de vérité), DofusDB en repli (avis non exposé
    // ou panne Dofensive) — la simulation doit rester possible malgré tout.
    let combat: DofensiveSpellCombat[] = [];
    if (target.meta) {
        const dRes = await getDofensiveSpells(target.id, undefined, true);
        if (dRes.success && dRes.data) combat = dRes.data;
    }
    if (combat.length === 0) {
        const dbSpells: any[] = Array.isArray(stats.spells) ? stats.spells : [];
        const levels = await fetchSpellLevels(dbSpells.map((s) => Math.floor(Number(s?.id))));
        combat = buildCombatSpellsFromDofusDb(dbSpells, levels, dofusDbStatBonusFromGrades(stats?.grades));
    }

    const payload = {
        ...stats,
        id: target.id,
        name: String(stats.name ?? target.name),
        imageUrl: stats.imageUrl || target.imageUrl || `https://api.dofusdb.fr/img/monsters/${target.id}.png`,
        dofusdbId: target.id,
        spells: combat.length > 0 ? mergeDofensiveSpells(stats.spells ?? [], combat) : (stats.spells ?? []),
        /* Un avis n'a ni salle ni carte Dofensive : jamais de `preferredMaps` inventés. */
        preferredMaps: [],
        isBounty: true,
        bounty: {
            raceId: target.raceId,
            raceName: target.raceName,
            subarea: target.subareaId ? { id: target.subareaId, name: target.subareaName } : null,
            subareas: target.subareas,
            levelMin: target.levelMin,
            levelMax: target.levelMax,
            dropObjectIds: target.dropObjectIds,
            criteria: target.criteria,
            /* Aucune carte d'emprunt : `null` + source `none` ⇒ la fiche utilise la grille vide. */
            battleMapId: target.mapId > 0 ? target.mapId : null,
            battleMapSource: target.mapSource,
            validated: target.validated,
            source: target.source,
        },
    };

    // Repli grades (28/09/2026) : la fiche détaillée échoue parfois (429, panne) et
    // le repli `{ id, name, spells: [] }` n'a ni grades ni drops ⇒ barres vides et
    // résistances à « 0 % ». La liste les porte déjà : on les relit ici même format.
    const { mapBountyDrops, mapBountyGrades } = await import("@/lib/bounty-grades");
    if (!Array.isArray((payload as any).grades) || (payload as any).grades.length === 0) {
        const mapped = mapBountyGrades(target.gradesRaw);
        if (mapped) {
            (payload as any).grades = mapped;
            result.gradesBackfilled++;
        } else {
            result.errors.push(`Avis ${target.name} : grades introuvables (ni détail ni liste) — fiche sans stats`);
        }
    }
    if (!Array.isArray((payload as any).drops) || (payload as any).drops.length === 0) {
        if (target.dropsRaw.length === 0) {
            result.errors.push(`Avis ${target.name} : aucun butin référencé par DofusDB`);
        } else {
            // Un seul appel `items?` borné (40 ids par requête, limiteur partagé).
            const objectIds = Array.from(
                new Set(
                    target.dropsRaw
                        .map((drop: any) => Math.floor(Number(drop?.objectId) || 0))
                        .filter((id: number) => id > 0)
                )
            ).slice(0, 120);
            try {
                const itemsById: Record<number, { nameFr?: string; nameEn?: string | null; img?: string }> = {};
                for (let index = 0; index < objectIds.length; index += 40) {
                    const chunk = objectIds.slice(index, index + 40);
                    const query = chunk.map((id) => `id[$in][]=${id}`).join("&");
                    const itemsData = await dofusdbFetch<any[]>(`/items?${query}&$limit=50&lang=fr`);
                    if (!itemsData) throw new Error("DofusDB items indisponible");
                    for (const item of itemsData) {
                        const id = Math.floor(Number(item?.id) || 0);
                        if (id <= 0) continue;
                        itemsById[id] = {
                            nameFr: item?.name?.fr ?? (typeof item?.name === "string" ? item.name : undefined),
                            nameEn: item?.name?.en ?? null,
                            img: typeof item?.img === "string" ? item.img : undefined,
                        };
                    }
                }
                const mapped = mapBountyDrops(target.dropsRaw, itemsById);
                if (mapped) {
                    (payload as any).drops = mapped;
                    result.dropsBackfilled++;
                } else {
                    result.errors.push(`Avis ${target.name} : butin illisible — onglet masqué`);
                }
            } catch (error) {
                result.errors.push(`Avis ${target.name} : butin non relu (${String(error)})`);
            }
        }
    }
    await persistMonsterStat({ ...payload, dungeonName: target.subareaName });

    // Icônes : monstre + sorts (DofusDB → WebP disque, zéro CDN à l'exécution).
    const monsterImg = await siphonAndCompressImage(target.imageUrl, "monsters", target.id);
    if (monsterImg.success) result.imagesSiphoned++;
    const iconById = new Map<number, string>();
    for (const s of Array.isArray(stats.spells) ? stats.spells : []) {
        const sid = Math.floor(Number(s?.id));
        const url = typeof s?.imageUrl === "string" ? s.imageUrl : "";
        if (sid > 0 && url.startsWith("https://api.dofusdb.fr/")) iconById.set(sid, url);
    }
    for (const [sid, url] of iconById) {
        const iconRes = await siphonAndCompressImage(url, "spells", sid);
        if (iconRes.success) result.imagesSiphoned++;
    }

    return upsertBountyRow(target, monsterImg.localUrl ?? target.imageUrl);
}

/** Champs `Bounty` lus pour décider d'une mise à jour / d'une adoption (mêmes colonnes des deux côtés). */
const BOUNTY_ROW_FIELDS = {
    id: true,
    name: true,
    slug: true,
    dofusdbId: true,
    level: true,
    zoneName: true,
    raceId: true,
    subareaIds: true,
    isBountyMonster: true,
    battleMapId: true,
    battleMapSource: true,
} as const;

/** Champs `Bounty` écrits par le siphon — les champs curés dans God n'y figurent JAMAIS. */
function bountySiphonData(target: BountyTarget, imageUrl: string | null) {
    return {
        name: target.name,
        level: target.level,
        levelMin: target.levelMin,
        levelMax: target.levelMax,
        dofusdbId: target.id,
        slug: target.slug,
        raceId: target.raceId,
        raceName: target.raceName,
        subareaIds: target.subareas.map((s) => s.id),
        isBountyMonster: true,
        battleMapId: target.mapId > 0 ? target.mapId : null,
        battleMapSource: target.mapSource,
        dofusdbSyncedAt: new Date(),
        imageUrl: imageUrl || undefined,
    };
}

/**
 * Ligne `Bounty` **historique** à adopter pour cet avis — `null` s'il n'y en a aucune, ou si
 * plusieurs candidatent (jamais de choix au hasard). Mesure et règles : `pickAdoptableBounty`.
 */
async function adoptLegacyBountyRow(target: BountyTarget) {
    const rows = await db.bounty.findMany({ where: { dofusdbId: null }, select: BOUNTY_ROW_FIELDS });
    const adopted = pickAdoptableBounty(rows, target.name);
    if (adopted) {
        logger.info(
            `[bounty-siphon] adoption de la ligne historique « ${adopted.name} » (${adopted.id}) pour l'avis #${target.id} — curation God conservée`,
        );
    }
    return adopted;
}

/** Création de la ligne `Bounty` d'un avis (aucune ligne à mettre à jour ni à adopter) + journal. */
async function createBountyRow(target: BountyTarget, imageUrl: string | null): Promise<boolean> {
    await db.bounty.create({
        data: {
            ...bountySiphonData(target, imageUrl),
            /* Zone de traque : `null` (jamais « Inconnu ») si la source n'en donne pas. */
            zoneName: target.subareaName ?? null,
            imageUrl: imageUrl ?? null,
        },
    });
    // 🔍 Journal (dataset BOUNTIES) : avis de recherche nouvellement créé.
    await recordGameDataChanges('BOUNTIES', [
        {
            entityType: 'bounty',
            entityId: target.slug,
            entityName: target.name ?? target.slug,
            changeType: 'NEW',
        },
    ]);
    return true;
}

/**
 * Upsert de la ligne `Bounty` d'un avis : par **`dofusdbId`** (3 avis homonymes « Ronce » ⇒
 * l'upsert par nom est impossible), sinon par **adoption** de la ligne historique du même nom
 * (`adoptLegacyBountyRow` — c'est là que vit la curation God). Le siphon n'écrit QUE ses champs :
 * les champs curés (`rewards`, `doplons`, `milice`, `rewardType`, `mechanics`, `position`,
 * `dpnlUrl`, `mapUrl`, `reward`) ne sont jamais écrasés — ils restent la propriété de God.
 *
 * `battleMapId` / `battleMapSource` sont **siphonnés** : un avis n'ayant aucune carte exposée,
 * l'écriture vaut `null` / `"none"` (grille vide), ce qui remet aussi à zéro les anciennes
 * lignes pointant sur la carte d'emprunt « Abysses du temps ».
 */
async function upsertBountyRow(target: BountyTarget, imageUrl: string | null): Promise<boolean> {
    if (!DB_READABLE) return false;
    const subareaIds = target.subareas.map((s) => s.id);
    const existing = (await db.bounty.findUnique({
        where: { dofusdbId: target.id },
        select: BOUNTY_ROW_FIELDS,
    })) ?? (await adoptLegacyBountyRow(target));

    if (!existing) return createBountyRow(target, imageUrl);

    const data = bountySiphonData(target, imageUrl);

    const storedMapId = target.mapId > 0 ? target.mapId : null;
    const changed = existing.level !== target.level
        || existing.raceId !== target.raceId
        || existing.battleMapId !== storedMapId
        || existing.battleMapSource !== target.mapSource
        // `isBountyMonster` faux ⇒ ligne historique non adoptée : c'est LE signal de l'adoption
        // (une ligne déjà `true` porte forcément son `dofusdbId`, cf. `pickAdoptableBounty`).
        || existing.isBountyMonster !== true
        || (target.subareaName !== null && existing.zoneName !== target.subareaName)
        || JSON.stringify(existing.subareaIds ?? []) !== JSON.stringify(subareaIds);

    const payload = { ...data, zoneName: target.subareaName ?? existing.zoneName };

    if (existing.dofusdbId == null) {
        // 🛡️ Ligne HISTORIQUE adoptée : l'écriture est gardée dans le `WHERE` (invariant
        // anti-course) — deux avis homonymes siphonnés en parallèle ne peuvent pas adopter la
        // MÊME ligne : le second voit `count = 0` et crée la sienne.
        const { count } = await db.bounty.updateMany({
            where: { id: existing.id, dofusdbId: null },
            data: payload,
        });
        if (count === 0) return createBountyRow(target, imageUrl);
    } else {
        await db.bounty.update({ where: { id: existing.id }, data: payload });
    }

    // 🔍 Journal : le détail de **ce qui** a changé (niveau, race, carte de combat, zone…).
    if (changed) {
        const fields = diffFields(
            existing as unknown as Record<string, unknown>,
            {
                level: target.level,
                raceId: target.raceId,
                raceName: target.raceName,
                battleMapId: storedMapId,
                battleMapSource: target.mapSource,
                zoneName: target.subareaName ?? existing.zoneName,
                subareaIds,
            },
            ['name', 'level', 'raceId', 'raceName', 'battleMapId', 'battleMapSource', 'zoneName', 'subareaIds'],
        );
        await recordGameDataChanges('BOUNTIES', [
            {
                entityType: 'bounty',
                entityId: existing.id,
                entityName: target.name ?? target.slug,
                changeType: 'MODIFIED',
                fields,
            },
        ]);
    }
    return changed;
}





