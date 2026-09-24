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
 *     existent : 3 × « Ronce ») + une fiche `MonsterStat` (stats DofusDB enrichies, sorts de
 *     combat fusionnés, métadonnées `bounty`). Les champs **curés** de `Bounty`
 *     (`rewards`, `doplons`, `milice`, `rewardType`, `mechanics`, `position`, `dpnlUrl`, `mapUrl`,
 *     `reward`) ne sont **jamais** écrasés par le siphon.
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
import { getIgnoredBountyIds, isIgnoredBounty } from "@/lib/bounty-ignore";
import { diffFields, recordGameDataChanges } from "@/lib/game-data-changelog";
import { DB_READABLE, mapWithConcurrency, persistMonsterStat } from "@/lib/dofensive-sync";
import { mergeDofensiveSpells, type DofensiveSpellCombat } from "@/lib/dofensive-spells";
import { siphonAndCompressImage } from "@/lib/dofus-asset-siphon";
import { buildCombatSpellsFromDofusDb, fetchSpellLevels } from "@/lib/anomaly-boss-siphon";
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
    isProvenBounty,
    normalizeBountySubareas,
    pickBountyBattleMap,
    pickBountySubarea,
    type BountyMapSource,
    type BountySubarea,
} from "@/lib/bounty";

/** Concurrence bornée (anti-rate-limit Dofensive) — même valeur que les autres siphons. */
const CONCURRENCY = 4;

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
            slug: bountySlug(name, id),
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
        });
    }
    result.defaultMap = targets.length;

    // 3bis. EXCLUSIONS VOLONTAIRES (God « Supprimer cet avis ») : un avis supprimé ne doit pas
    //       réapparaître à la passe suivante — la liste d'exclusion fait foi (jamais de résurrection).
    const ignoredIds = getIgnoredBountyIds();
    const keptTargets = targets.filter((t) => !isIgnoredBounty(t.id, ignoredIds));
    result.ignored = targets.length - keptTargets.length;

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

    logger.info(
        `[bounty-siphon] ${result.entries.length} avis de recherche résolus ` +
        `(${result.synced} écrits, ${result.unchanged} inchangés, ${result.unproven} non prouvés, ` +
        `${result.ignored} exclu(s), ${result.errors.length} erreur(s), ${result.imagesSiphoned} image(s), ` +
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
    // Imports dynamiques : ces deux modules tirent la chaîne d'auth Next (`@/auth`) et n'ont
    // aucune raison d'être chargés pour les helpers purs (ni dans les tests unitaires).
    const { getMonsterStats } = await import("@/server/actions/game-data-actions");
    const { getDofensiveSpells } = await import("@/server/actions/dofensive-actions");

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
        combat = buildCombatSpellsFromDofusDb(dbSpells, levels);
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

/**
 * Upsert de la ligne `Bounty` d'un avis, **par `dofusdbId`** (3 avis homonymes « Ronce » ⇒
 * l'upsert par nom est impossible). Le siphon n'écrit QUE ses champs : les champs curés
 * (`rewards`, `doplons`, `milice`, `rewardType`, `mechanics`, `position`, `dpnlUrl`, `mapUrl`,
 * `reward`) ne sont jamais écrasés — ils restent la propriété de l'onglet God.
 *
 * `battleMapId` / `battleMapSource` sont **siphonnés** : un avis n'ayant aucune carte exposée,
 * l'écriture vaut `null` / `"none"` (grille vide), ce qui remet aussi à zéro les anciennes
 * lignes pointant sur la carte d'emprunt « Abysses du temps ».
 */
async function upsertBountyRow(target: BountyTarget, imageUrl: string | null): Promise<boolean> {
    if (!DB_READABLE) return false;
    const subareaIds = target.subareas.map((s) => s.id);
    const existing = await db.bounty.findUnique({
        where: { dofusdbId: target.id },
        select: {
            id: true,
            level: true,
            zoneName: true,
            raceId: true,
            subareaIds: true,
            isBountyMonster: true,
            battleMapId: true,
            battleMapSource: true,
        },
    });

    const data = {
        name: target.name,
        level: target.level,
        levelMin: target.levelMin,
        levelMax: target.levelMax,
        dofusdbId: target.id,
        slug: target.slug,
        raceId: target.raceId,
        raceName: target.raceName,
        subareaIds,
        isBountyMonster: true,
        battleMapId: target.mapId > 0 ? target.mapId : null,
        battleMapSource: target.mapSource,
        dofusdbSyncedAt: new Date(),
        imageUrl: imageUrl || undefined,
    };

    if (!existing) {
        await db.bounty.create({
            data: {
                ...data,
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

    const storedMapId = target.mapId > 0 ? target.mapId : null;
    const changed = existing.level !== target.level
        || existing.raceId !== target.raceId
        || existing.battleMapId !== storedMapId
        || existing.battleMapSource !== target.mapSource
        || existing.isBountyMonster !== true
        || (target.subareaName !== null && existing.zoneName !== target.subareaName)
        || JSON.stringify(existing.subareaIds ?? []) !== JSON.stringify(subareaIds);

    await db.bounty.update({
        where: { id: existing.id },
        data: { ...data, zoneName: target.subareaName ?? existing.zoneName },
    });

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





