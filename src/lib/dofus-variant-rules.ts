import { VARIANT_SLOTS, type SavedVariant } from "@/lib/dofus-variant-utils";
import type { DofusbookItem } from "@/lib/dofusbook-utils";

/**
 * Règles de **légalité d'une variante** (règles pures, sans I/O).
 *
 * 🎯 Constat user du 25/10/2026 : « aujourd'hui on peut poser des items en variante n'importe
 * comment ». Ce module verrouille ce qui est **décidable sans nouvelle donnée** :
 *   · slot connu + type d'objet compatible ;
 *   · niveau de l'objet ≤ niveau du build ;
 *   · **aucun doublon** (deux anneaux identiques, même objet dans deux slots).
 *
 * ⚠️ Restent volontairement **hors périmètre** (données absentes de `GameItem`, lot séparé) :
 * armes à deux mains vs bouclier (`twoHanded`), conditions d'objet (`criterions` DofusDB),
 * et règles de panoplie (N pièces max). Elles exigeront une **migration** de schéma.
 *
 * Le serveur (`saveBuildVariant`) applique ces règles **avant toute écriture** : le client ne
 * fait qu'afficher le refus.
 */
export type VariantRuleCode =
    | "slot-unknown"
    | "type-mismatch"
    | "level-too-high"
    | "duplicate-item"
    | "prysmaradite-limit";

export interface VariantRuleViolation {
    code: VariantRuleCode;
    message: string;
    slot: string;
}

export type VariantRuleResult = { ok: true } | { ok: false; violation: VariantRuleViolation };

/** L'objet candidat peut-il occuper ce slot ? (type inconnu ⇒ refus, jamais d'acceptation muette) */
export function slotAcceptsItemType(slot: string, typeName: string | null | undefined): boolean {
    const info = VARIANT_SLOTS[slot];
    if (!info) return false;
    const name = (typeName ?? "").trim().toLowerCase();
    if (!name) return false;
    // Rétro-compatibilité : une variante enregistrée avant le typage porte le **libellé du
    // slot** en guise de type (`normalizeSavedVariants`). On l'accepte pour ce slot précis —
    // refuser ici casserait toutes les variantes existantes au premier enregistrement.
    if (name === info.slotName.toLowerCase()) return true;
    return info.typeNames.some((type) => type.toLowerCase() === name);
}

function slotLabel(slot: string): string {
    return VARIANT_SLOTS[slot]?.slotName ?? slot;
}

/**
 * Valide **un** slot de variante.
 *
 * @param occupiedIds objets effectivement équipés dans les **autres** slots (base + variantes),
 *                    pour détecter un doublon (l'appelant exclut le slot en cours).
 */
export function validateVariantSlot(input: {
    slot: string;
    /** Objet candidat — `official` (id Ankama) est l'identité commune avec les items du build. */
    item: Pick<DofusbookItem, "id" | "name" | "level" | "typeName"> & { official?: number };
    buildLevel: number;
    occupiedIds: Array<{ slot: string; id: number }>;
}): VariantRuleResult {
    const { slot, item, buildLevel, occupiedIds } = input;

    if (!VARIANT_SLOTS[slot]) {
        return { ok: false, violation: { code: "slot-unknown", slot, message: `Emplacement inconnu : ${slot}.` } };
    }

    if (!slotAcceptsItemType(slot, item.typeName)) {
        return {
            ok: false,
            violation: {
                code: "type-mismatch",
                slot,
                message: `« ${item.name} » n'est pas un objet de type ${slotLabel(slot)}.`,
            },
        };
    }

    const level = Number(item.level);
    if (!Number.isFinite(level) || level < 1 || level > buildLevel) {
        return {
            ok: false,
            violation: {
                code: "level-too-high",
                slot,
                message: `« ${item.name} » est niveau ${Number.isFinite(level) ? level : "?"} — le build est niveau ${buildLevel}.`,
            },
        };
    }

    const candidateId = Number(item.official || item.id);
    const duplicate = occupiedIds.find((other) => other.slot !== slot && other.id === candidateId);
    if (duplicate) {
        return {
            ok: false,
            violation: {
                code: "duplicate-item",
                slot,
                message: `« ${item.name} » est déjà équipé (${slotLabel(duplicate.slot)}) : un objet ne peut pas être posé deux fois.`,
            },
        };
    }

    return { ok: true };
}

/**
 * Construit la liste `{ slot, id }` des objets **effectifs** (stuff d'origine + variantes),
 * brique commune au client et au serveur.
 */
export function effectiveSlotIds(
    baseItems: Record<string, DofusbookItem | null | undefined> | null | undefined,
    variants: SavedVariant | null | undefined,
): Array<{ slot: string; id: number }> {
    const out: Array<{ slot: string; id: number }> = [];
    const slots = new Set<string>([...Object.keys(baseItems ?? {}), ...Object.keys(variants ?? {})]);

    for (const slot of slots) {
        const variant = variants?.[slot];
        const item = variant ?? baseItems?.[slot];
        // ⚠️ `id` d'un item Dofusbook = id **interne** ; une variante porte l'id **Ankama**
        // dans `official`. L'identité commune (doublons) est donc `official || id`.
        const id = Number(item?.official || item?.id || 0);
        if (id > 0) out.push({ slot, id });
    }
    return out;
}

/** Une seule **Prysmaradite** par personnage (partage le 1ᵉʳ emplacement Dofus/Trophée). */
export const MAX_PRYSMARADITES = 1;

export function isPrysmaraditeType(typeName: string | null | undefined): boolean {
    return (typeName ?? "").trim().toLowerCase() === "prysmaradite";
}

/**
 * Règle **de catégorie** (devblog Ankama, reprise par la doc « Comprendre les interactions
 * d'équipement dans DOFUS » § Prysmaradites) : les Prysmaradites partagent le **premier**
 * emplacement des Dofus/Trophées ⇒ **une seule** peut être portée, quel que soit le slot choisi.
 *
 * `typeNames` = types des objets **effectivement équipés** (stuff d'origine + variantes),
 * résolus côté serveur depuis `GameItem` (le payload Dofusbook ne porte pas le type).
 */
export function validatePrysmaraditeLimit(typeNames: Array<string | null | undefined>): VariantRuleResult {
    const count = typeNames.filter(isPrysmaraditeType).length;
    if (count <= MAX_PRYSMARADITES) return { ok: true };

    return {
        ok: false,
        violation: {
            code: "prysmaradite-limit",
            slot: "d1",
            message: "Une seule Prysmaradite peut être équipée : elle partage le premier emplacement Dofus / Trophée.",
        },
    };
}

/**
 * Types d'objet **hors** `VARIANT_SLOTS` (veille — Lot E « types/slots »).
 *
 * Pourquoi : `VARIANT_SLOTS` est écrit à la main. Si Dofus ajoute un type d'objet, la recherche
 * de variante ne le proposerait **pas** ; la veille doit le **signaler**, jamais le deviner en
 * élargissant un slot au hasard.
 */
export function unknownVariantItemTypes(typeNames: readonly string[]): string[] {
    const known = new Set<string>();
    for (const info of Object.values(VARIANT_SLOTS)) {
        known.add(info.slotName.trim().toLowerCase());
        for (const type of info.typeNames) known.add(type.trim().toLowerCase());
    }

    const unique = new Set<string>();
    for (const raw of typeNames) {
        const name = String(raw ?? "").trim();
        if (name) unique.add(name);
    }

    return [...unique]
        .filter((name) => !known.has(name.toLowerCase()))
        .sort((a, b) => a.localeCompare(b));
}

/**
 * Valide **toute** une variante contre un build (utilisé côté serveur, fail-closed).
 * Renvoie la **première** violation, avec un message prêt à afficher.
 */
export function validateSavedVariants(input: {
    baseItems: Record<string, DofusbookItem | null | undefined> | null | undefined;
    variants: SavedVariant;
    buildLevel: number;
}): VariantRuleResult {
    const { baseItems, variants, buildLevel } = input;
    const allIds = effectiveSlotIds(baseItems, variants);

    for (const [slot, item] of Object.entries(variants)) {
        const result = validateVariantSlot({
            slot,
            item,
            buildLevel,
            occupiedIds: allIds.filter((entry) => entry.slot !== slot),
        });
        if (!result.ok) return result;
    }

    return { ok: true };
}
