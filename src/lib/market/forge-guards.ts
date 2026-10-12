/**
 * Module « Marché » — **gardes de forge réelle** (S8.10/S8.11 · décisions
 * D40/D41/D42).
 *
 * ⚠️ Fichier **PUR** (zéro Prisma / React / réseau) : le **même** code sert
 *   - à l'**UI** (S8.7/S8.9) pour prévenir l'utilisateur *avant* l'envoi, et
 *   - au **serveur** (S8.11 : `createMarketListing` / `updateMarketListing`)
 *     qui reste **seul juge** : le client n'impose jamais rien.
 *
 * 🎯 Articulation unique avec **D34/D35** : un over ou un exo *déclaré* n'est
 * **jamais** refusé en soi. Le **seul** refus autorisé par le lot est la
 * combinaison avec une **Transcendance** (D40 : « Empêche les futures
 * forgemagies »), qui est un état **déclaratif** (jamais déduit du jet).
 *
 * Les **6** champs persistés (S8.10) :
 *   `transcendenceRuneId` (présence = « Transcendé ») · `transcendenceLabel`
 *   (libellé dénormalisé) · `strikeElement` · `elementPotionId` (pointeur
 *   d'icône, `null` si la potion n'est pas siphonnée) · `elementPotionTier`
 *   (palier 50/65/80 — porte la donnée de jeu, indispensable aux 4 potions du
 *   palier 65 % absentes de `GameItem`) · `huntingWeapon`.
 */

import { z } from "zod";
import {
    SMITHMAGIC_ELEMENTS,
    SMITHMAGIC_POTION_TIERS,
    findElementPotionByAnkamaId,
    findElementPotionByElementTier,
    normalizeSmithmagicKey,
    resolveStrikeElement,
    type SmithmagicPotionTier,
} from "./smithmagic";

// ---------------------------------------------------------------------------
// BORNES & SCHÉMA ZOD (miroir strict des colonnes Prisma, S8.10)
// ---------------------------------------------------------------------------

/** Bornes anti-débilité des champs de forge (D35 : pas des bornes de jeu). */
export const MARKET_FORGE_LIMITS = {
    /** Libellé d'effet d'une rune de Transcendance (dénormalisé). */
    LABEL_MAX: 80,
    /** Libellé d'arme de chasse. */
    WEAPON_MAX: 80,
} as const;

/** Palier de potion (50 / 65 / 80 %) — refusé hors des 3 valeurs de jeu. */
const potionTierSchema = z
    .number()
    .int()
    .refine((value) => (SMITHMAGIC_POTION_TIERS as readonly number[]).includes(value), {
        message: "Palier de potion inconnu (50, 65 ou 80).",
    });

/**
 * Champs de forge d'une annonce — **tous nullables** (additif pur, aucun
 * backfill) : une annonce sans forge n'envoie rien et reste identique.
 * Ce schéma est **fusionné** dans `marketListingBaseSchema`
 * (`market-actions.ts`) : une seule validation pour les 4 types d'annonce.
 */
export const marketForgeFieldsSchema = z.object({
    transcendenceRuneId: z.number().int().positive().nullable().optional(),
    transcendenceLabel: z
        .string()
        .trim()
        .max(MARKET_FORGE_LIMITS.LABEL_MAX)
        .nullable()
        .optional(),
    strikeElement: z.enum(SMITHMAGIC_ELEMENTS).nullable().optional(),
    elementPotionId: z.number().int().positive().nullable().optional(),
    elementPotionTier: potionTierSchema.nullable().optional(),
    huntingWeapon: z
        .string()
        .trim()
        .max(MARKET_FORGE_LIMITS.WEAPON_MAX)
        .nullable()
        .optional(),
});

/** Champs de forge validés (issus de Zod ou d'un état d'UI). */
export type MarketForgeFields = z.infer<typeof marketForgeFieldsSchema>;


// ---------------------------------------------------------------------------
// ARMES — seul support de l'élément de frappe / de l'arme de chasse (S8.11)
// ---------------------------------------------------------------------------

/** Famille DofusDB (`GameItem.superTypeName`) des armes. */
const WEAPON_FAMILY_KEY = "arme";

/**
 * S8.11 — types d'objets DofusDB (`GameItem.typeName`) qui sont des **armes**.
 *
 * 📌 Mesuré en base locale le 13/09/2026 : `superTypeName` est **`NULL` sur
 * 100 %** des lignes de `GameItem` (21 748/21 748 — le siphon ne l'a jamais
 * rempli) ⇒ la détection repose sur le **type**. Les 11 types réels observés
 * sont : `Arc`(78) · `Baguette`(79) · `Bâton`(94) · `Dague`(79) · `Épée`(126) ·
 * `Faux`(16) · `Hache`(76) · `Lance`(20) · `Marteau`(99) · `Pelle`(61) ·
 * `Poignards de Percepteur`(41).
 *
 * ⚠️ Comparaison **exacte** (normalisée sans accents/casse) et **jamais** par
 * sous-chaîne : mesuré aussi, un `includes("arc")` attrape « **Parc**hemin »,
 * « **Arc**hipel » et « Éme d'**arc**himonstre » — soit des milliers de faux
 * positifs qui ouvriraient la garde « arme uniquement ».
 */
const WEAPON_TYPE_NAMES = new Set([
    "arc",
    "baguette",
    "baton",
    "dague",
    "epee",
    "faux",
    "hache",
    "houe",
    "lance",
    "marteau",
    "pelle",
    "poignard",
    "poignards de percepteur",
]);

/**
 * S8.11 — `true` si l'objet est une **arme** (élément de frappe, arme de
 * chasse). La source de vérité est le **catalogue** (`GameItem`) : l'UI passe
 * la fiche locale, le serveur la relit en base et **ne croit jamais** un
 * libellé envoyé par le client.
 */
export function isWeaponItem(input: {
    itemSuperTypeName?: string | null;
    itemTypeName?: string | null;
}): boolean {
    const family = normalizeSmithmagicKey(input.itemSuperTypeName ?? "");
    // Signal fort quand il finira par être siphonné (« Arme », « Armes »).
    if (family.startsWith(WEAPON_FAMILY_KEY)) return true;
    return WEAPON_TYPE_NAMES.has(normalizeSmithmagicKey(input.itemTypeName ?? ""));
}

// ---------------------------------------------------------------------------
// GARDES (S8.11) — appelées par l'UI **et** par le serveur
// ---------------------------------------------------------------------------

/** Ligne de jet exploitée par les gardes (source **serveur** de préférence). */
export type MarketForgeStatLine = {
    label: string;
    /** `NATIVE` | `EXO` (`MarketStatOrigin`). */
    origin: string;
    /** Plage native du catalogue (repli `over` côté UI). */
    naturalMax?: number | null;
    /** Valeur déclarée (repli `over` côté UI). */
    actualValue?: number | null;
    /** Qualité **recalculée serveur** (`OVER`, `PERFECT`…), quand disponible. */
    quality?: string | null;
};

/** Déclaration de forge à contrôler (D40/D41). */
export type MarketForgeDeclaration = {
    itemSuperTypeName?: string | null;
    itemTypeName?: string | null;
    /** `true` = une rune de Transcendance est déclarée (D40). */
    transcendent?: boolean;
    strikeElement?: string | null;
    elementPotionId?: number | null;
    elementPotionTier?: number | null;
    huntingWeapon?: string | null;
    stats?: readonly MarketForgeStatLine[];
};

/**
 * Lignes **incompatibles** avec une Transcendance (D40) : exo et over.
 * `[]` = rien à signaler. L'UI s'en sert pour le bandeau + le blocage du
 * bouton « Continuer » ; le serveur pour refuser (mêmes règles).
 */
export function describeTranscendenceConflicts(
    stats: readonly MarketForgeStatLine[]
): string[] {
    const conflicts: string[] = [];
    for (const stat of stats) {
        const label = stat.label?.trim() || "ligne inconnue";
        if (stat.origin === "EXO") {
            conflicts.push(label);
            continue;
        }
        if (stat.quality === "OVER") {
            conflicts.push(label);
            continue;
        }
        if (stat.naturalMax != null && (stat.actualValue ?? 0) > stat.naturalMax) {
            conflicts.push(label);
        }
    }
    return conflicts;
}

/** Message de refus (D40) — `null` si la Transcendance est compatible. */
export function describeTranscendenceRefusal(
    conflicts: readonly string[]
): string | null {
    if (conflicts.length === 0) return null;
    const shown = conflicts.slice(0, 3).join(", ");
    const rest = conflicts.length > 3 ? ` (+${conflicts.length - 3})` : "";
    return `Objet transcendé : retire les over/exo déclarés (${shown}${rest}) — une rune de Transcendance empêche les futures forgemagies.`;
}

/**
 * S8.11 — **garde complète** d'une déclaration de forge.
 * Renvoie le message de refus, ou `null` si tout est cohérent.
 *
 *   1. D40 : transcende ⇒ **aucun** over / exo (seul refus autorisé du lot) ;
 *   2. élément de frappe / potion / arme de chasse ⇒ **arme** uniquement ;
 *   3. potion **cohérente** avec l'élément et le palier déclarés.
 */
export function validateForgeDeclaration(input: MarketForgeDeclaration): string | null {
    // 1. D40 — la Transcendance exclut over ET exo (jamais l'inverse).
    if (input.transcendent === true) {
        const refusal = describeTranscendenceRefusal(
            describeTranscendenceConflicts(input.stats ?? [])
        );
        if (refusal) return refusal;
    }

    const declaresElement =
        input.strikeElement != null ||
        input.elementPotionId != null ||
        input.elementPotionTier != null;
    const weapon = isWeaponItem(input);

    // 2. L'élément de frappe (et l'arme de chasse) ne s'appliquent qu'aux armes.
    if (declaresElement && !weapon) {
        return "L'élément de frappe (potion de forgemagie) ne s'applique qu'à une arme.";
    }
    if (input.huntingWeapon && !weapon) {
        return "L'arme de chasse ne s'applique qu'à une arme.";
    }
    if (!declaresElement) return null;

    // 3. Cohérence élément ↔ potion ↔ palier.
    const element = input.strikeElement ?? null;
    if (element && !resolveStrikeElement(element)) {
        return "Élément de frappe inconnu (Feu, Eau, Terre, Air ou Neutre).";
    }
    if (
        input.elementPotionTier != null &&
        !(SMITHMAGIC_POTION_TIERS as readonly number[]).includes(input.elementPotionTier)
    ) {
        return "Palier de potion inconnu (50, 65 ou 80).";
    }

    const potion =
        input.elementPotionId != null
            ? findElementPotionByAnkamaId(input.elementPotionId)
            : null;
    if (input.elementPotionId != null && !potion) {
        return "Potion de forgemagie inconnue du référentiel.";
    }
    if (potion) {
        const resolvedElement = element ? resolveStrikeElement(element) : null;
        if (resolvedElement && potion.element !== resolvedElement) {
            return `Cette potion fixe l'élément ${potion.element} : elle est incohérente avec l'élément ${element} déclaré.`;
        }
        if (input.elementPotionTier != null && potion.tier !== input.elementPotionTier) {
            return `Cette potion est de palier ${potion.tier} % : elle est incohérente avec le palier ${input.elementPotionTier} % déclaré.`;
        }
        return null;
    }

    // Potion **non siphonnée** (palier 65 %) : l'ensemble élément × palier doit
    // exister au référentiel — jamais de potion inventée.
    if (!element || input.elementPotionTier == null) {
        return "Une potion de forgemagie demande un élément et un palier (50, 65 ou 80 %).";
    }
    if (!findElementPotionByElementTier(element, input.elementPotionTier)) {
        return `Aucune potion de forgemagie ${element} au palier ${input.elementPotionTier} % : vérifie ta déclaration.`;
    }
    return null;
}

/** Palier de potion validé (repli `null` : valeur hors référentiel). */
export function asSmithmagicPotionTier(
    value: number | null | undefined
): SmithmagicPotionTier | null {
    return typeof value === "number" &&
        (SMITHMAGIC_POTION_TIERS as readonly number[]).includes(value)
        ? (value as SmithmagicPotionTier)
        : null;
}
