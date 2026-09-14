/**
 * 🧺 Marché — **lot multiple** (décision user du 14/09/2026, **option A**).
 *
 * Règles métier **pures** (zéro I/O, zéro Prisma) : bornes du lot, prix **par
 * objet**, cycle de vie d'un objet, avancement, dérivation du statut de
 * l'annonce. Partagé par l'assistant (client), les server actions et le moteur
 * Discord ⇒ **une seule vérité**, testée unitairement (§13.4).
 *
 * Décisions actées : **2 à 5 objets** (familles mélangées) · **le prix vit sur
 * l'objet**, jamais sur le lot · chaque objet est réservable séparément à son
 * prix et publié dans **son** message Discord (option A).
 *
 * Plan : `src/temp/refonte-marche/PLAN-LOT-MULTIPLE.md`.
 */

import { z } from "zod";

/** Un lot se compose au minimum de **2** objets (sinon c'est une annonce simple). */
export const MARKET_BUNDLE_MIN_ITEMS = 2;

/** … et au maximum de **5** objets (décision user, bornes de l'assistant). */
export const MARKET_BUNDLE_MAX_ITEMS = 5;

/** Statuts d'**un objet** de lot (miroir exact de l'enum `MarketComponentStatus`). */
export type BundleItemStatus = "AVAILABLE" | "RESERVED" | "SOLD";

/** Motifs de refus d'une réservation sur un objet (typés, jamais de throw §13.5). */
export type BundleReserveRefusal = "NOT_AVAILABLE" | "ALREADY_RESERVED" | "SOLD";

/**
 * Objet minimal dont dépend la logique pure. `name`/`quantity` sont optionnels
 * pour accepter aussi bien un `MarketListingComponent` complet qu'une projection
 * `{ status }` (redérivation du statut d'annonce en base).
 */
export interface BundleComponentLike {
    id?: string;
    name?: string;
    quantity?: number;
    priceKamas?: number | null;
    status?: BundleItemStatus | null;
    position?: number | null;
}

/** Saisie d'un objet de lot (formulaire de l'assistant). */
export interface BundleItemInput {
    dofusDbItemId?: number | null;
    name: string;
    iconUrl?: string | null;
    quantity: number;
    unitLabel?: string | null;
    priceKamas: number;
}

/**
 * Schéma Zod d'**un** objet de lot.
 *
 * `priceKamas` est **obligatoire et strictement positif** : on ne publie jamais
 * un objet « à négocier » dans un lot (c'est le rôle de `WANTED`). Borne haute
 * volontaire (1 000 000 000) : garde-fou anti-saisie.
 */
export const bundleItemSchema = z.object({
    dofusDbItemId: z.number().int().positive().nullable().optional(),
    name: z.string().trim().min(1).max(120),
    iconUrl: z.string().trim().max(500).nullable().optional(),
    quantity: z.number().int().min(1).max(100_000),
    unitLabel: z.string().trim().max(24).nullable().optional(),
    priceKamas: z.number().int().min(1).max(1_000_000_000),
});

/**
 * Schéma Zod du **lot complet** : 2 à 5 objets, **noms uniques** (deux fois le
 * même objet rendrait les boutons Discord indiscernables).
 */
export const bundleItemsSchema = z
    .array(bundleItemSchema)
    .min(MARKET_BUNDLE_MIN_ITEMS, `Un lot doit contenir au moins ${MARKET_BUNDLE_MIN_ITEMS} objets.`)
    .max(MARKET_BUNDLE_MAX_ITEMS, `Un lot ne peut pas dépasser ${MARKET_BUNDLE_MAX_ITEMS} objets.`)
    .refine(
        (items) => new Set(items.map((item) => item.name.toLowerCase())).size === items.length,
        { message: "Un lot ne peut pas contenir deux fois le même objet." }
    );

/** Total du lot = somme des prix **par objet** (calculé serveur, jamais le client). */
export function computeBundleTotal(items: readonly { priceKamas?: number | null }[]): number {
    return items.reduce((sum, item) => sum + Math.max(0, Math.trunc(item.priceKamas ?? 0)), 0);
}

/**
 * Prix à l'unité d'un objet (affichage « 1 000 — 12 k / unité »).
 * `null` si la quantité est ≤ 0 : on n'affiche jamais un prix faux.
 */
export function computeItemUnitPrice(priceKamas: number, quantity: number): number | null {
    if (quantity <= 0) return null;
    return Math.round(Math.max(0, priceKamas) / quantity);
}

/** « 12 500 » → `12 500 kamas` (lecture FR). */
export function formatKamas(value: number): string {
    return `${Math.max(0, Math.trunc(value)).toLocaleString("fr-FR")} kamas`;
}

/**
 * Un objet peut-il être réservé ?
 *
 * `status` absent = `AVAILABLE` : les objets créés **avant** la migration
 * restent réservables sans backfill. Refus **typés** pour que l'UI et Discord
 * disent *pourquoi* (§13.5, jamais muet).
 */
export function canReserveComponent(
    component: Pick<BundleComponentLike, "status">
): { ok: true } | { ok: false; refusal: BundleReserveRefusal } {
    const status: BundleItemStatus = component.status ?? "AVAILABLE";
    if (status === "SOLD") return { ok: false, refusal: "SOLD" };
    if (status === "RESERVED") return { ok: false, refusal: "ALREADY_RESERVED" };
    return { ok: true };
}

/** Message d'UI associé à un refus (aucun montant, aucun pseudo §13.7). */
export const BUNDLE_REFUSAL_MESSAGES: Record<BundleReserveRefusal, string> = {
    NOT_AVAILABLE: "Cet objet n'est plus disponible.",
    ALREADY_RESERVED: "Cet objet est déjà réservé par un autre membre.",
    SOLD: "Cet objet a déjà été vendu.",
};

/** Avancement d'un lot (compteurs + part vendue, pour la barre de progression). */
export interface BundleProgress {
    total: number;
    available: number;
    reserved: number;
    sold: number;
    /** Part vendue en pourcentage entier (0-100), arrondie — jamais `NaN`. */
    percentSold: number;
}

export function describeBundleProgress(components: readonly BundleComponentLike[]): BundleProgress {
    const total = components.length;
    let available = 0;
    let reserved = 0;
    let sold = 0;

    for (const component of components) {
        switch (component.status ?? "AVAILABLE") {
            case "SOLD":
                sold += 1;
                break;
            case "RESERVED":
                reserved += 1;
                break;
            default:
                available += 1;
        }
    }

    return {
        total,
        available,
        reserved,
        sold,
        percentSold: total === 0 ? 0 : Math.round((sold / total) * 100),
    };
}

/**
 * Statut de l'**annonce** déduit de ses objets : `SOLD` seulement si **tous**
 * les objets sont vendus, `RESERVED` dès qu'un objet est réservé, `ACTIVE`
 * sinon. Un lot sans objet reste `ACTIVE` (état transitoire de création).
 */
export function deriveBundleListingStatus(
    components: readonly BundleComponentLike[]
): "ACTIVE" | "RESERVED" | "SOLD" {
    if (components.length === 0) return "ACTIVE";
    if (components.every((component) => (component.status ?? "AVAILABLE") === "SOLD")) {
        return "SOLD";
    }
    if (components.some((component) => (component.status ?? "AVAILABLE") !== "AVAILABLE")) {
        return "RESERVED";
    }
    return "ACTIVE";
}

/** Résumé d'un lot sur une ligne : `3/5 disponible(s) · 1 vendu(s) · 25 000 kamas`. */
export function summarizeBundle(components: readonly BundleComponentLike[]): string {
    const progress = describeBundleProgress(components);
    return [
        `${progress.available}/${progress.total} disponible(s)`,
        progress.reserved > 0 ? `${progress.reserved} réservé(s)` : null,
        progress.sold > 0 ? `${progress.sold} vendu(s)` : null,
        formatKamas(computeBundleTotal(components)),
    ]
        .filter((part): part is string => part !== null)
        .join(" · ");
}
