/**
 * 📋 Siphon des **conditions d'équipement structurées** (DofusDude) → `GameItem.conditions`.
 *
 * Pourquoi cette source : le DSL DofusDB (`criterions` : `CP<12|CM<6`, `pk<2`) utilise des codes
 * courts non documentés. DofusDude expose le même contenu en **arbre** avec des noms français
 * (`PA`, `PM`, `Sagesse`, `Bonus de panoplies`…) — c'est ce qui permet d'afficher et de **bloquer**
 * une variante sans table de codes écrite à la main (mesure du 25/10/2026 : **4 095** équipements,
 * **264** avec condition).
 *
 * ⚠️ **Pourquoi ce cœur vit dans `src/lib` et non dans un script** (mesure du 26/10/2026) :
 * l'image de production est un build standalone et `node scripts/*.mjs` y échoue —
 * `ERR_MODULE_NOT_FOUND: @prisma/driver-adapter-utils` (dépendance transitive de l'adaptateur,
 * absente du traçage de Next). Le même code exécuté **par l'application** (route cron) fonctionne.
 *
 * Invariants :
 *   · **idempotent** : comparaison sur une sérialisation **stable** (clés triées) — Postgres
 *     réordonne les clés JSONB, une comparaison naïve réécrirait tout à chaque passe ;
 *   · **borné et fail-closed** : arbre illisible ou démesuré ⇒ l'objet est **refusé avec sa
 *     raison** (jamais une condition partielle écrite : elle bloquerait une variante légitime) ;
 *   · **`apply` explicite** : par défaut on ne fait que mesurer ;
 *   · un objet **absent de la base** est compté (`missing`), jamais créé ici (le siphon des objets
 *     reste la seule porte d'entrée de `GameItem`).
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { stableStringify } from "@/lib/stable-json";
import type { Prisma } from "@prisma/client";

/** Source officielle (lecture seule). */
export const ITEM_CONDITIONS_API = "https://api.dofusdu.de/dofus3/v1/fr/items/equipment/all";
/** Mesuré : 4 095 équipements en une page (la source plafonne à 5 000). */
export const ITEM_CONDITIONS_PAGE_SIZE = 5000;
/** Garde anti-boucle : 4 095 objets ⇒ 1 page ; 20 est une marge, jamais atteinte. */
export const ITEM_CONDITIONS_MAX_PAGES = 20;
/** Un arbre de condition plus gros que ça n'est pas une condition : c'est un payload inattendu. */
export const ITEM_CONDITIONS_MAX_BYTES = 8_000;

export interface ItemConditionsSiphonReport {
    /** Équipements lus chez DofusDude. */
    fetched: number;
    /** Ceux qui portent une condition (les autres sont sans intérêt ici). */
    withConditions: number;
    /** Conditions qui diffèrent de la base. */
    toWrite: number;
    written: number;
    unchanged: number;
    /** Objets conditionnés **absents** de `GameItem` (le siphon des objets doit passer avant). */
    missing: number;
    /** Refus explicites : jamais une écriture partielle. */
    skipped: Array<{ id: number | null; reason: string }>;
}

function emptyReport(): ItemConditionsSiphonReport {
    return { fetched: 0, withConditions: 0, toWrite: 0, written: 0, unchanged: 0, missing: 0, skipped: [] };
}

/** Vrai arbre de condition : objet ou tableau **non vide**. */
function isConditionTree(value: unknown): boolean {
    if (Array.isArray(value)) return value.length > 0;
    return !!value && typeof value === "object" && Object.keys(value as object).length > 0;
}

/** Une page DofusDude. Une erreur HTTP **remonte** (le cron doit échouer franchement). */
async function fetchEquipmentPage(page: number): Promise<{ items: unknown[]; hasNext: boolean }> {
    const url = `${ITEM_CONDITIONS_API}?page=${page}&page_size=${ITEM_CONDITIONS_PAGE_SIZE}`;
    const response = await fetch(url, {
        headers: {
            Accept: "application/json",
            "User-Agent": "SigilOS/1.0 (+https://sigilos.fr)",
        },
        signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
        throw new Error(`DofusDude ${response.status} (conditions d'équipement)`);
    }
    const payload = (await response.json()) as { items?: unknown[]; _links?: { next?: unknown } };
    return {
        items: Array.isArray(payload?.items) ? payload.items : [],
        hasNext: Boolean(payload?._links?.next),
    };
}

/**
 * Passe du siphon.
 *
 * @param apply `false` (défaut) = **dry-run** : rien n'est écrit.
 */
export async function siphonItemConditionsCore(
    options: { apply?: boolean } = {},
): Promise<ItemConditionsSiphonReport> {
    const apply = options.apply === true;
    const report = emptyReport();

    const collected: unknown[] = [];
    for (let page = 1; page <= ITEM_CONDITIONS_MAX_PAGES; page += 1) {
        const { items, hasNext } = await fetchEquipmentPage(page);
        if (items.length === 0) break;
        collected.push(...items);
        if (!hasNext) break;
    }
    report.fetched = collected.length;

    for (const raw of collected) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
        const entry = raw as { ankama_id?: unknown; conditions?: unknown };
        const ankamaId = Number(entry.ankama_id);
        if (!Number.isInteger(ankamaId) || ankamaId <= 0) continue;
        if (!isConditionTree(entry.conditions)) continue;

        const condition = entry.conditions;
        report.withConditions += 1;

        // Borne : un arbre démesuré est un payload inattendu, pas une condition.
        if (stableStringify(condition).length > ITEM_CONDITIONS_MAX_BYTES) {
            report.skipped.push({ id: ankamaId, reason: "arbre de condition démesuré" });
            continue;
        }

        const current = await db.gameItem.findUnique({
            where: { ankamaId },
            select: { id: true, conditions: true },
        });
        if (!current) {
            // Jamais créé ici : `GameItem` n'a qu'une porte d'entrée (le siphon des objets).
            report.missing += 1;
            continue;
        }

        // Comparaison **stable** : Postgres réordonne les clés JSONB.
        if (stableStringify(current.conditions) === stableStringify(condition)) {
            report.unchanged += 1;
            continue;
        }

        report.toWrite += 1;
        if (!apply) continue;

        await db.gameItem.update({
            where: { id: current.id },
            data: { conditions: condition as unknown as Prisma.InputJsonValue },
        });
        report.written += 1;
    }

    logger.info("[item-conditions-siphon] passe terminée", {
        apply,
        fetched: report.fetched,
        withConditions: report.withConditions,
        toWrite: report.toWrite,
        written: report.written,
        unchanged: report.unchanged,
        missing: report.missing,
        skipped: report.skipped.length,
    });

    return report;
}
