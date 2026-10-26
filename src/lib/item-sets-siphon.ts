/**
 * 🧩 Siphon du référentiel des **panoplies** (DofusDB `/item-sets`).
 *
 * Pourquoi ce siphon existe : le payload Dofusbook ne contient que le **palier actif** d'une
 * panoplie. Recalculer les bonus quand une variante remplace une pièce exige donc les
 * **paliers complets** — c'est exactement ce que DofusDB expose :
 *
 *   · `effects` est un tableau **indexé par palier** (`index = pièces − 1`) ;
 *   · chaque ligne porte `{ characteristic, from, to, effectId, elementId }` ;
 *   · `characteristic` se normalise en code court (`fo`, `ini`, `ta`…) via la règle partagée
 *     `resolveStatLineCode()` (`src/lib/dofus-stat-lines.ts`) — caractéristique d'abord, puis
 *     `effectId`, et **jamais** de métadonnée (titre, trait, portée de sort) comptée en bonus ;
 *
 * Invariants (mêmes que `game-items-siphon`) :
 *   · **upsert par id** de panoplie (jamais de doublon) ;
 *   · **hash de changement** sur une sérialisation **stable** (JSONB réordonne les clés) :
 *     une panoplie inchangée n'est pas réécrite ;
 *   · **fail-closed** : une caractéristique non normalisable fait **refuser la panoplie**
 *     (elle sera signalée « inconnue » au calcul, jamais approximée) ;
 *   · **`--apply` explicite** : le mode par défaut ne fait que mesurer.
 *
 * ⚠️ Le payload est volumineux (mesuré : **56 ko par panoplie**, 940 au total) : on ne garde
 * que `{ id, name, items[].id, effects }` avant toute écriture.
 */

import crypto from "crypto";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { dofusDbFetch } from "@/lib/dofusdb-limiter";
import {
    DOFUSDB_THROTTLE_MAX_REPLAYS,
    dofusDbFailureMessage,
    isLocalThrottle,
    throttleWaitMs,
} from "@/lib/dofusdb-throttle";
import { DOFUSDB_PAGE_MAX, hasMorePages } from "@/lib/dofusdb-pagination";
import { normalizeItemSetTiers } from "@/lib/dofus-set-bonuses";
import { isNonStatEffectId, resolveStatLineCode } from "@/lib/dofus-stat-lines";
import { stableStringify } from "@/lib/stable-json";

/** Endpoint de référence (lecture seule). */
export const ITEM_SETS_API = "https://api.dofusdb.fr/item-sets";
/** 940 panoplies / 50 par page = 19 pages ; marge de sécurité, jamais une boucle infinie. */
export const ITEM_SETS_MAX_PAGES = 40;

/** Palier normalisé tel qu'il est persisté dans `GameItemSet.tiers`. */
export interface SiphonedItemSetTier {
    count: number;
    effects: Array<{ code: string; value: number; effectId: number }>;
}

/** Panoplie normalisée, prête pour l'upsert. */
export interface SiphonedItemSet {
    id: number;
    name: string;
    itemCount: number;
    itemsIds: number[];
    tiers: SiphonedItemSetTier[];
    dataHash: string;
}

/** Bilan d'une passe — ce que l'opérateur lit (dry-run ou `--apply`). */
export interface ItemSetSiphonReport {
    fetched: number;
    toWrite: number;
    written: number;
    unchanged: number;
    /** Panoplies refusées : la raison est **explicite**, jamais une écriture partielle. */
    skipped: Array<{ id: number | null; reason: string }>;
    /**
     * Décalage à repasser pour **continuer** la passe (`null` = référentiel couvert).
     * Utile quand la passe est bornée (`maxPages`) pour rester sous un timeout de proxy.
     */
    nextSkip: number | null;
    /** Filigrane effectivement appliqué (`null` = passe complète, pas de filtre de date). */
    since: string | null;
}

/** Paliers DofusDB (`effects` indexé par palier) → paliers normalisés. */
function normalizeTiers(rawTiers: unknown[]): { ok: true; tiers: SiphonedItemSetTier[] } | { ok: false; reason: string } {
    const tiers: SiphonedItemSetTier[] = [];

    for (let index = 0; index < rawTiers.length; index += 1) {
        const rawTier = rawTiers[index];
        if (!Array.isArray(rawTier) || rawTier.length === 0) continue;

        const effects: SiphonedItemSetTier["effects"] = [];
        for (const rawEffect of rawTier) {
            if (!rawEffect || typeof rawEffect !== "object") continue;
            const line = rawEffect as { characteristic?: unknown; from?: unknown; effectId?: unknown };
            const effectId = Number(line.effectId);
            const value = Number(line.from ?? 0);
            /**
             * 🧨 Correction du 26/10/2026 — **une métadonnée n'est pas un bonus**.
             *
             * L'ancien code résolvait le code depuis `characteristic` via `normalizeStatCode`,
             * où `0 → "vi"` : les lignes cosmétiques (`effectId 724` « Titre : ») entraient dans
             * les paliers comme de la **Vitalité** (9 panoplies / 63 lignes / 9 406 PV fantômes).
             * On écarte la ligne **avant** la garde fail-closed, pour ne jamais refuser une
             * panoplie à cause d'un trait décoratif.
             */
            if (isNonStatEffectId(effectId) || !Number.isFinite(value) || value === 0) continue;
            const code = resolveStatLineCode({ characteristic: line.characteristic, effectId });
            if (!code) {
                return { ok: false, reason: `caractéristique ${String(line.characteristic)} non normalisable` };
            }
            effects.push({
                code,
                value: Math.round(value),
                effectId: Number.isInteger(effectId) && effectId > 0 ? effectId : 0,
            });
        }

        // Palier non vide : `count` = index + 1 (tableau indexé par nombre de pièces, mesuré).
        if (effects.length > 0) tiers.push({ count: index + 1, effects });
    }

    /**
     * Aucun palier exploitable = panoplie **sans bonus** (cosmétique), cas réel et mesuré
     * (`/item-sets` 504-535 le 26/10/2026). Elle doit être **connue avec zéro bonus**, sinon
     * un build qui la porte serait déclaré « panoplie inconnue » et ses variantes refusées.
     */
    return { ok: true, tiers };
}


/**
 * Normalise une panoplie DofusDB.
 *
 * Renvoie une **raison** en cas de refus : le siphon ne devine jamais une donnée.
 */
export function normalizeItemSet(
    raw: unknown,
): { ok: true; set: SiphonedItemSet } | { ok: false; id: number | null; reason: string } {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return { ok: false, id: null, reason: "panoplie illisible" };
    }
    const payload = raw as Record<string, unknown>;

    const id = Number(payload.id);
    if (!Number.isInteger(id) || id <= 0) return { ok: false, id: null, reason: "id invalide" };

    const rawName = payload.name as { fr?: unknown } | string | undefined;
    const name = typeof rawName === "string"
        ? rawName.trim()
        : typeof rawName?.fr === "string"
            ? rawName.fr.trim()
            : "";
    if (!name) return { ok: false, id, reason: "nom français absent" };

    // `items` = objets complets (56 ko/panoplie) : on ne garde que l'id Ankama.
    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    const itemsIds = [...new Set(
        rawItems
            .map((entry) => Number((entry as { id?: unknown })?.id))
            .filter((itemId) => Number.isInteger(itemId) && itemId > 0),
    )];
    if (itemsIds.length === 0) return { ok: false, id, reason: "aucune pièce" };

    // Contrat DofusDB : `effects` **doit** être un tableau (indexé par palier). Absent ou d'un
    // autre type = forme inattendue ⇒ refus explicite (jamais une panoplie « vide » par accident).
    if (!Array.isArray(payload.effects)) {
        return { ok: false, id, reason: "paliers absents (contrat DofusDB)" };
    }
    const tiers = normalizeTiers(payload.effects);
    if (!tiers.ok) return { ok: false, id, reason: tiers.reason };

    const dataHash = crypto
        .createHash("md5")
        .update(stableStringify({ name, itemsIds, tiers: tiers.tiers }))
        .digest("hex");

    return {
        ok: true,
        set: {
            id,
            name: name.slice(0, 120),
            itemCount: itemsIds.length,
            itemsIds,
            // Revalidation par le **même** validateur que la lecture en base.
            tiers: normalizeItemSetTiers(tiers.tiers) as SiphonedItemSetTier[],
            dataHash,
        },
    };
}

/**
 * Valide un filigrane de veille ciblée.
 *
 * Règle pure : seule une date **ISO parseable** est acceptée ; tout le reste rend `null`, ce qui
 * signifie « passe complète ». On ne devine jamais un filigrane — un filigrane invalide qui
 * passerait pour valide ferait relire **zéro** panoplie et laisserait le référentiel se périmer
 * en silence.
 */
export function normalizeSince(value: unknown): string | null {
    if (typeof value !== "string" || value.trim() === "") return null;
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return null;
    return new Date(parsed).toISOString();
}

/** Une page DofusDB : le `total` annoncé fait foi pour savoir s'il reste des pages. */
async function fetchItemSetPage(
    skip: number,
    since: string | null = null,
): Promise<{ data: unknown[]; total: number | null }> {
    // `updatedAt[$gt]` est **mesuré** comme honoré par DofusDB (26/10/2026 : 555 panoplies sur
    // 940 modifiées depuis le 01/10) — c'est ce qui rend la veille hebdomadaire supportable.
    const filter = since ? `&updatedAt%5B%24gt%5D=${encodeURIComponent(since)}` : "";
    for (let attempt = 0; ; attempt += 1) {
        const res = await dofusDbFetch(`${ITEM_SETS_API}?$limit=${DOFUSDB_PAGE_MAX}&$skip=${skip}${filter}`, {
            headers: {
                Accept: "application/json",
                "User-Agent": "SigilOS/1.0 (+https://sigilos.fr)",
            },
            signal: AbortSignal.timeout(30_000),
        });

        if (res.ok) {
            const payload = await res.json() as { data?: unknown[]; total?: unknown };
            const total = Number(payload?.total);
            return {
                data: Array.isArray(payload?.data) ? payload.data : [],
                total: Number.isFinite(total) ? total : null,
            };
        }

        // Budget local partagé (30 req/min) : on attend le reste de la fenêtre et on rejoue.
        if (isLocalThrottle(res) && attempt < DOFUSDB_THROTTLE_MAX_REPLAYS) {
            await new Promise((resolve) => setTimeout(resolve, throttleWaitMs(res)));
            continue;
        }

        throw new Error(dofusDbFailureMessage(res.status, isLocalThrottle(res)));
    }
}

/**
 * Avance d'une page : **règle pure**, testable sans réseau.
 *
 * ⚠️ Le `total` annoncé par l'API fait foi — jamais `data.length`. L'erreur d'**ordre**
 * (avancer `skip` **puis** tester la fin) faisait perdre la dernière page : mesuré
 * 900 panoplies lues sur 940 le 26/10/2026.
 */
export function nextPageState(
    skip: number,
    pageLength: number,
    total: number | null,
): { nextSkip: number; more: boolean } {
    return {
        nextSkip: skip + pageLength,
        more: hasMorePages(skip, pageLength, total),
    };
}

/**
 * Passe du référentiel.
 *
 * @param apply     `false` (défaut) = **dry-run** : rien n'est écrit.
 * @param maxPages  borne le nombre de pages lues (défaut : le maximum) — utile derrière un proxy.
 * @param startSkip décalage de reprise (permet d'enchaîner plusieurs appels bornés).
 * @param since     **veille ciblée** : ne lit que les panoplies modifiées depuis cette date ISO
 *                  (`updatedAt[$gt]`). Un filigrane illisible est **ignoré** (passe complète) —
 *                  jamais interprété comme « tout est à jour ».
 */
export async function siphonItemSetsCore(
    options: { apply?: boolean; maxPages?: number; startSkip?: number; since?: string | null } = {},
): Promise<ItemSetSiphonReport> {
    const apply = options.apply === true;
    const since = normalizeSince(options.since);
    const maxPages = Math.max(1, Math.min(ITEM_SETS_MAX_PAGES, options.maxPages ?? ITEM_SETS_MAX_PAGES));
    const startSkip = Number.isFinite(Number(options.startSkip))
        ? Math.max(0, Math.floor(Number(options.startSkip)))
        : 0;

    const report: ItemSetSiphonReport = {
        fetched: 0,
        toWrite: 0,
        written: 0,
        unchanged: 0,
        skipped: [],
        nextSkip: null,
        since,
    };

    let skip = startSkip;
    let more = true;
    for (let page = 0; page < maxPages; page += 1) {
        const { data, total } = await fetchItemSetPage(skip, since);
        if (data.length === 0) {
            more = false;
            break;
        }
        report.fetched += data.length;

        for (const raw of data) {
            const normalized = normalizeItemSet(raw);
            if (!normalized.ok) {
                report.skipped.push({ id: normalized.id, reason: normalized.reason });
                continue;
            }
            const set = normalized.set;

            const current = await db.gameItemSet.findUnique({
                where: { id: set.id },
                select: { dataHash: true },
            });
            // Hash identique ⇒ aucune écriture (idempotence : le JSONB réordonne les clés).
            if (current?.dataHash === set.dataHash) {
                report.unchanged += 1;
                continue;
            }

            report.toWrite += 1;
            if (!apply) continue;

            await db.gameItemSet.upsert({
                where: { id: set.id },
                create: {
                    id: set.id,
                    name: set.name,
                    itemCount: set.itemCount,
                    itemsIds: set.itemsIds,
                    tiers: set.tiers,
                    dataHash: set.dataHash,
                },
                update: {
                    name: set.name,
                    itemCount: set.itemCount,
                    itemsIds: set.itemsIds,
                    tiers: set.tiers,
                    dataHash: set.dataHash,
                },
            });
            report.written += 1;
        }

        /**
         * ⚠️ La fin se déduit du `total` annoncé, **avant** d'avancer `skip` : `hasMorePages`
         * compare déjà `skip + longueur de page` au total. Avancer d'abord faisait perdre la
         * dernière page (mesuré : 900/940 panoplies lues au lieu de 940).
         */
        const state = nextPageState(skip, data.length, total);
        skip = state.nextSkip;
        more = state.more;
        logger.info("[item-sets-siphon] page lue", { skip, page: page + 1, total });
        if (!more) break;
    }

    // Reprise : `null` = référentiel couvert ; sinon le prochain `skip` à demander.
    report.nextSkip = more ? skip : null;

    logger.info("[item-sets-siphon] passe terminée", {
        apply,
        since,
        fetched: report.fetched,
        toWrite: report.toWrite,
        written: report.written,
        unchanged: report.unchanged,
        skipped: report.skipped.length,
        nextSkip: report.nextSkip,
    });

    return report;
}
