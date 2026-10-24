/**
 * Module « Marché » — **schémas Zod partagés** (client + serveur, 10/10/2026).
 *
 * ⚠️ Fichier **PUR** (Zod + constantes, zéro Prisma / réseau / React) : l'assistant de
 * création **pré-valide** le même payload que le serveur, **avant** l'appel — fini les
 * refus découverts au clic « Publier » avec un message brut en anglais.
 *
 * Règles :
 *   · **chaque** contrainte porte un message **français** (garde de test : aucun message
 *     Zod brut ne traverse vers un toast) ;
 *   · `describeMarketIssue` traduit **tout** reliquat (y compris futur) en français à partir
 *     du chemin + du code — jamais de `errors[0].message` brut à l'écran ;
 *   · les règles métier (plages natives, familles, forge) restent calculées côté **serveur**
 *     (D17) : ces schémas ne portent que la **forme** (types, bornes, présence).
 */

import { z } from "zod";

import { MARKET_LIMITS } from "@/server/actions/market-constants";
import { KAMAS_MAX } from "@/lib/market/kamas";
import { bundleItemSchema, MARKET_BUNDLE_MAX_ITEMS } from "@/lib/market/bundle";
import { marketForgeFieldsSchema } from "@/lib/market/forge-guards";

/** Ligne de lot de ressources (lot simple / composite). */
export const marketComponentSchema = z.object({
    dofusDbItemId: z
        .number({ message: "Référence d'objet invalide." })
        .int("Référence d'objet invalide.")
        .positive("Référence d'objet invalide.")
        .nullable()
        .optional(),
    name: z
        .string({ message: "Nom d'objet manquant." })
        .trim()
        .min(1, "Nom d'objet manquant : choisis-le dans le catalogue.")
        .max(120, "Nom d'objet trop long (120 caractères max)."),
    iconUrl: z
        .string()
        .trim()
        .max(500, "Adresse d'icône trop longue.")
        .nullable()
        .optional(),
    quantity: z
        .number({ message: "Quantité invalide : un nombre entier est attendu." })
        .int("Quantité invalide : un nombre entier est attendu.")
        .positive("Quantité invalide : au moins 1.")
        .max(1_000_000_000, "Quantité trop élevée."),
    unitLabel: z.string().trim().max(40, "Libellé d'unité trop long.").nullable().optional(),
});

/** Ligne de jet déclaré (plages recalculées serveur, D17 — ici : la forme seule). */
export const marketStatSchema = z.object({
    effectId: z
        .number({ message: "Ligne de jet incomplète : effet non reconnu." })
        .int("Ligne de jet incomplète : effet non reconnu."),
    characteristic: z
        .number({ message: "Ligne de jet incomplète : caractéristique non reconnue." })
        .int("Ligne de jet incomplète : caractéristique non reconnue.")
        .nullable()
        .optional(),
    label: z
        .string({ message: "Ligne de jet sans nom." })
        .trim()
        .min(1, "Ligne de jet sans nom : supprime-la ou choisis un effet dans la liste.")
        .max(80, "Nom d'effet trop long."),
    naturalMin: z
        .number({ message: "Plage native invalide." })
        .int("Plage native invalide.")
        .nullable()
        .optional(),
    naturalMax: z
        .number({ message: "Plage native invalide." })
        .int("Plage native invalide.")
        .nullable()
        .optional(),
    actualValue: z
        .number({ message: "Valeur de jet invalide : un nombre entier est attendu." })
        .int("Valeur de jet invalide : un nombre entier est attendu.")
        .min(MARKET_LIMITS.STAT_VALUE_MIN, "Valeur invraisemblable, vérifie ta saisie")
        .max(MARKET_LIMITS.STAT_VALUE_MAX, "Valeur invraisemblable, vérifie ta saisie"),
    origin: z.enum(["NATIVE", "EXO"]).default("NATIVE"),
});

/** Lot M1 — un critère de jet d'une recherche d'achat (forme seule). */
export const marketWantedCriterionSchema = z.object({    effectId: z
        .number({ message: "Critère incomplet : effet non reconnu." })
        .int("Critère incomplet : effet non reconnu.")
        .positive("Critère incomplet : effet non reconnu."),
    characteristic: z
        .number({ message: "Critère incomplet : caractéristique non reconnue." })
        .int("Critère incomplet : caractéristique non reconnue.")
        .nullable()
        .optional(),
    label: z
        .string({ message: "Critère sans nom." })
        .trim()
        .min(1, "Critère sans nom : supprime-le ou choisis un effet dans la liste.")
        .max(80, "Nom d'effet trop long."),
    minValue: z
        .number({ message: "Valeur minimale invalide : un nombre entier est attendu." })
        .int("Valeur minimale invalide : un nombre entier est attendu.")
        .min(1, "Valeur minimale invalide : au moins 1.")
        .max(MARKET_LIMITS.STAT_VALUE_MAX, "Valeur invraisemblable, vérifie ta saisie"),
    exo: z.boolean().default(false),
});

/**
 * Lot M1 — règle WANTED **pure** (source unique, testée) : objet + quantité
 * + budget > 0 + négociable. Consommée par la cohérence serveur
 * (`market-actions.ts`) ET testée ici. Les règles catalogue (existence de
 * l'objet, nativité des effets, pastilles) restent serveur (D17).
 */
export function wantedBasicsError(input: {
    dofusDbItemId?: number | null;
    quantity?: number | null;
    priceKamas?: number | null;
    negotiable?: boolean;
    /** Lignes de jet / lot / forge : interdites sur une recherche (critères seuls). */
    statsCount?: number;
    componentsCount?: number;
    itemsCount?: number;
    hasForge?: boolean;
}): string | null {
    if (!Number.isInteger(input.dofusDbItemId) || (input.dofusDbItemId as number) <= 0) {
        return "Choisis un objet du catalogue pour une recherche d'achat.";
    }
    if (!Number.isInteger(input.quantity) || (input.quantity as number) < 1) {
        return "Renseigne la quantité recherchée (au moins 1).";
    }
    if (!Number.isInteger(input.priceKamas) || (input.priceKamas as number) <= 0) {
        return "Renseigne ton budget maximum en kamas (au moins 1).";
    }
    if (input.negotiable === false) {
        return "Une recherche d'achat reste négociable : ce sont les propositions qui font le prix.";
    }
    if ((input.statsCount ?? 0) > 0 || (input.componentsCount ?? 0) > 0 || (input.itemsCount ?? 0) > 0) {
        return "Une recherche ne porte ni jet déclaré ni lot : objet + budget + critères uniquement.";
    }
    if (input.hasForge) {
        return "Une recherche ne déclare pas de forge : décris-la dans tes critères ou ta note.";
    }
    return null;
}

/**
 * Lot M1-finalisation — règle de prix d'une VENTE (source unique, testée) :
 * prix > 0 **ou** troc accepté. Une annonce « Kamas uniquement » sans montant
 * est un cul-de-sac (réservation et offre au prix impossibles). BUNDLE exclu :
 * le prix vit par objet (validé par `bundleItemsSchema`).
 */
export function salePriceError(input: {
    priceKamas?: number | null;
    acceptsTrade?: boolean;
}): string | null {
    if (input.acceptsTrade) return null;
    if (!Number.isInteger(input.priceKamas) || (input.priceKamas as number) <= 0) {
        return "Renseigne un prix en kamas (au moins 1) ou accepte le troc.";
    }
    return null;
}

export const marketListingBaseSchema = z.object({
    // 🧺 Décision user du 14/09/2026 — `BUNDLE` = lot de 2 à 5 objets, **prix par objet**.
    type: z.enum(["EQUIPMENT", "RESOURCE", "SERVICE", "WANTED", "BUNDLE"]),
    title: z.string().trim().min(3, "Titre trop court (3 caractères minimum).").max(MARKET_LIMITS.TITLE_MAX),
    description: z.string().trim().max(MARKET_LIMITS.DESCRIPTION_MAX).nullable().optional(),
    forgedBy: z.string().trim().max(80).nullable().optional(),
    priceKamas: z
        .number({ message: "Prix invalide : un nombre entier de kamas est attendu." })
        .int("Prix invalide : un nombre entier de kamas est attendu.")
        .min(0, "Prix invalide : pas de montant négatif.")
        .max(KAMAS_MAX, "Prix trop élevé : vérifie ta saisie.")
        .nullable()
        .optional(),
    negotiable: z.boolean().default(true),
    acceptsTrade: z.boolean().default(false),
    dofusDbItemId: z
        .number({ message: "Objet du catalogue invalide." })
        .int("Objet du catalogue invalide.")
        .positive("Objet du catalogue invalide.")
        .nullable()
        .optional(),
    itemName: z.string().trim().max(160).nullable().optional(),
    itemIconUrl: z.string().trim().max(500).nullable().optional(),
    itemLevel: z
        .number({ message: "Niveau d'objet invalide." })
        .int("Niveau d'objet invalide.")
        .min(0, "Niveau d'objet invalide.")
        .max(300, "Niveau d'objet invraisemblable.")
        .nullable()
        .optional(),
    itemTypeName: z.string().trim().max(80).nullable().optional(),
    quantity: z
        .number({ message: "Quantité invalide : un nombre entier est attendu." })
        .int("Quantité invalide : un nombre entier est attendu.")
        .positive("Quantité invalide : au moins 1.")
        .max(1_000_000_000, "Quantité trop élevée.")
        .nullable()
        .optional(),
    unitLabel: z.string().trim().max(40).nullable().optional(),
    minQuantity: z
        .number({ message: "Quantité minimale invalide." })
        .int("Quantité minimale invalide.")
        .positive("Quantité minimale invalide : au moins 1.")
        .max(1_000_000_000, "Quantité minimale trop élevée.")
        .nullable()
        .optional(),
    components: z.array(marketComponentSchema).max(MARKET_LIMITS.MAX_COMPONENTS).default([]),
    /**
     * 🧺 Lot multiple — objets **avec leur prix** (transport). ⚠️ Le schéma porte
     * uniquement le **type d'un objet** et la borne haute : `.default([])` est
     * **validé** par Zod, donc y mettre la règle « au moins 2 objets » rejetterait
     * toutes les annonces non-lot. La règle métier (2 → 5, noms uniques) vit dans
     * `bundleItemsSchema`, appliquée par le moteur `createBundleListingCore`
     * (§13.4 : une seule source de vérité, jamais dupliquée).
     */
    items: z.array(bundleItemSchema).max(MARKET_BUNDLE_MAX_ITEMS).default([]),
    stats: z
        .array(marketStatSchema)
        .max(MARKET_LIMITS.MAX_STATS)
        .default([])
        .refine(
            (rows) =>
                new Set(rows.map((row) => `${row.effectId}|${row.origin ?? "NATIVE"}`)).size === rows.length,
            { message: "Ligne de jet en double : un effet ne peut être déclaré qu'une fois." }
        ),
    // Lot M1 — critères de jet d'une recherche d'achat (WANTED) : ici la
    // FORME seule (effet + valeur min bornée) ; le serveur valide l'effet
    // (référentiel GameEffect), la nativité (catalogue) et calcule les
    // pastilles EXO / OVER. `wantedTranscendence` : ANY | REQUIRED | FORBIDDEN.
    wantedTranscendence: z.enum(["ANY", "REQUIRED", "FORBIDDEN"]).default("ANY"),
    criteria: z.array(marketWantedCriterionSchema).max(MARKET_LIMITS.WANTED_MAX_CRITERIA).default([]),
    // S8.10 — forge réelle déclarée (source unique : `forge-guards.ts`).
    ...marketForgeFieldsSchema.shape,
});

export type MarketListingPayload = z.input<typeof marketListingBaseSchema>;

/** `true` si le texte est un message Zod brut (anglais) : à traduire, jamais à afficher. */
export const ENGLISH_ZOD_MESSAGE_RE =
    /must contain|must be|expected .*, received|invalid (enum value|type|literal|union|discriminator|string|number|boolean|date|array)|too small|too big|not_finite|unrecognized key/i;

/** Libellé lisible d'un segment de chemin Zod (`items.2.priceKamas` → lisible). */
function segmentLabel(segment: PropertyKey): string {
    if (typeof segment === "number") return `n°${segment + 1}`;
    const normalized = typeof segment === "symbol" ? segment.toString() : segment;
    const labels: Record<string, string> = {
        title: "titre",
        description: "description",
        priceKamas: "prix",
        items: "objets du lot",
        components: "contenu du lot",
        stats: "jet déclaré",
        quantity: "quantité",
        minQuantity: "quantité minimale",
        criteria: "critères de jet",
        minValue: "valeur minimale",
        exo: "exo",
        wantedTranscendence: "souhait de forge",        unitLabel: "libellé d'unité",
        name: "nom",
        label: "nom de la ligne",
        actualValue: "valeur",
        effectId: "effet",
        characteristic: "caractéristique",
        iconUrl: "icône",
        itemIconUrl: "icône",
        dofusDbItemId: "objet du catalogue",
        itemName: "nom de l'objet",
        itemLevel: "niveau",
        itemTypeName: "type d'objet",
        negotiable: "négociable",
        acceptsTrade: "troc",
        forgedBy: "mention « modifié par »",
    };
    return labels[String(normalized)] ?? String(normalized);
}

/** `items.2.priceKamas` → « objet n°3 — prix » (contexte de lot conservé). */
export function fieldLabel(path: readonly PropertyKey[]): string {
    if (path.length === 0) return "formulaire";
    const [head, ...rest] = path;
    if ((head === "items" || head === "components" || head === "stats" || head === "criteria") && typeof rest[0] === "number") {
        const index = rest[0] + 1;
        const scope = head === "stats" ? "ligne de jet" : head === "criteria" ? "critère" : "objet";
        const tail = rest.slice(1).map(segmentLabel).join(" — ");
        return `${scope} n°${index}${tail ? ` — ${tail}` : ""}`;
    }
    return path.map(segmentLabel).join(" — ");
}

/** Code Zod → phrase française générique (repli quand le message n'est pas déjà FR). */
function genericFrenchMessage(issue: z.ZodIssue, label: string): string {
    switch (issue.code) {
        case "too_small":
            // zod 4 : le type de valeur contrôlée est porté par `origin` (plus `type`).
            if ((issue as { origin?: string }).origin === "string") return `« ${label} » : champ à compléter.`;
            return `« ${label} » : valeur trop petite.`;
        case "too_big":
            return `« ${label} » : valeur trop grande, vérifie ta saisie.`;
        case "invalid_type":
            return `« ${label} » : saisie invalide, vérifie ce champ.`;
        case "invalid_value":
            // Remplace l'ancien `invalid_enum_value` (fusionné en v4).
            return `« ${label} » : choix invalide.`;
        default:
            return `« ${label} » : saisie invalide, vérifie ce champ.`;
    }
}

/**
 * Traduit **une** anomalie Zod en français (jamais de brut anglais à l'écran).
 * Un message sur mesure (non anglais) est conservé tel quel, préfixé du champ —
 * sans toucher à sa casse.
 */
export function describeMarketIssue(issue: z.ZodIssue): { field: string; message: string } {
    const field = fieldLabel([...issue.path]);
    const raw = issue.message ?? "";
    if (raw && !ENGLISH_ZOD_MESSAGE_RE.test(raw)) {
        return { field, message: field === "formulaire" ? raw : `${field} : ${raw}` };
    }
    return { field, message: genericFrenchMessage(issue, field) };
}

/** Première anomalie d'une erreur Zod, en français, avec son champ. */
export function firstFrenchError(error: z.ZodError): { field: string; message: string } {
    const first = error.issues[0];
    if (!first) return { field: "formulaire", message: "Données invalides, vérifie ta saisie." };
    return describeMarketIssue(first);
}

/** Toutes les anomalies, en français, dans l'ordre. */
export function frenchMarketErrors(error: z.ZodError): { field: string; message: string }[] {
    return error.issues.map(describeMarketIssue);
}

/**
 * Pré-validation **partagée** (assistant + garde-fou avant l'appel serveur) :
 * mêmes schémas, mêmes messages. Le serveur reste seul juge (D17) ; le client
 * évite l'aller-retour pour les fautes de forme.
 */
export function validateMarketPayload(payload: unknown):
    | { success: true; data: MarketListingPayload }
    | { success: false; issues: { field: string; message: string }[] } {
    const parsed = marketListingBaseSchema.safeParse(payload);
    if (parsed.success) return { success: true, data: parsed.data };
    return { success: false, issues: frenchMarketErrors(parsed.error) };
}
