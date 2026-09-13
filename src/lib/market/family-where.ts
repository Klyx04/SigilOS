/**
 * Module « Marché » — construction du **filtre Prisma de famille** (BUG-11/T10).
 *
 * ⚠️ Fichier **serveur** (types Prisma).
 *
 * 🎯 Pourquoi un module à part : le premier jet utilisait `NOT: { OR: [...] }`,
 * ce qui **ne marche pas** — les colonnes `typeId` / `superTypeId` peuvent être
 * **NULL** et, en SQL, `NULL IN (...)` vaut `NULL` : `NOT NULL` = `NULL` ⇒ la
 * ligne est **exclue**. Résultat constaté en beta : « Bois de Tremble »
 * (typeId 38) introuvable dans « Ressources / Autres ».
 *
 * ✅ Ici chaque signal est testé **positivement**, avec sa branche `NULL`
 * explicite. Le signal principal est `typeId` (toujours renseigné) ; les deux
 * autres couvrent les fiches historiques incomplètes.
 */

import { Prisma } from "@prisma/client";
import {
    MARKET_COSMETIC_SUPERTYPE_IDS,
    MARKET_COSMETIC_TYPE_IDS,
    MARKET_COSMETIC_TYPE_NAMES,
    MARKET_EQUIPMENT_SUPERTYPE_IDS,
    MARKET_EQUIPMENT_TYPE_IDS,
    MARKET_EQUIPMENT_TYPE_NAMES,
    type MarketItemFamily,
} from "@/lib/market/item-families";

/** Branches « appartient à cette famille » (positif + repli si `typeId` est NULL). */
function membershipBranches(
    typeIds: number[],
    superTypeIds: number[],
    typeNames: readonly string[]
): Prisma.GameItemWhereInput[] {
    return [
        { typeId: { in: typeIds } },
        { superTypeId: { in: superTypeIds } },
        { typeName: { in: [...typeNames] } },
    ];
}

/**
 * Filtre Prisma d'une famille. Les signaux sont évalués en **OR** (un seul suffit
 * à rattacher l'objet à la famille) ; `RESOURCES_OTHER` est le **complément** des
 * deux autres familles, `NULL` inclus.
 */
export function buildMarketFamilyWhere(family: MarketItemFamily): Prisma.GameItemWhereInput {
    if (family === "EQUIPMENT") {
        return {
            OR: membershipBranches(
                MARKET_EQUIPMENT_TYPE_IDS,
                MARKET_EQUIPMENT_SUPERTYPE_IDS,
                MARKET_EQUIPMENT_TYPE_NAMES
            ),
        };
    }
    if (family === "COSMETIC") {
        return {
            OR: membershipBranches(
                MARKET_COSMETIC_TYPE_IDS,
                MARKET_COSMETIC_SUPERTYPE_IDS,
                MARKET_COSMETIC_TYPE_NAMES
            ),
        };
    }

    // `RESOURCES_OTHER` = **aucun** des signaux équipement/cosmétique.
    // Chaque signal est écrit « NULL **ou** hors liste » : un `typeId` NULL ne
    // doit pas exclure la ligne (logique ternaire SQL — cause du bug constaté).
    return {
        AND: [
            notInUnlessNull("typeId", [...MARKET_EQUIPMENT_TYPE_IDS, ...MARKET_COSMETIC_TYPE_IDS]),
            notInUnlessNull("superTypeId", [
                ...MARKET_EQUIPMENT_SUPERTYPE_IDS,
                ...MARKET_COSMETIC_SUPERTYPE_IDS,
            ]),
            notInUnlessNull("typeName", [
                ...MARKET_EQUIPMENT_TYPE_NAMES,
                ...MARKET_COSMETIC_TYPE_NAMES,
            ]),
        ],
    };
}

/** `champ` NULL **ou** hors de la liste (jamais `NULL IN (...)`). */
function notInUnlessNull(
    field: "typeId" | "superTypeId" | "typeName",
    values: readonly (string | number)[]
): Prisma.GameItemWhereInput {
    // `typeName` est **non nullable** (valeur par défaut « Item ») : `notIn`
    // suffit et reste sûr (pas de logique ternaire).
    if (field === "typeName") {
        return { typeName: { notIn: [...values] as string[] } };
    }
    return {
        OR: [
            { [field]: null },
            { [field]: { notIn: [...values] as number[] } },
        ] as Prisma.GameItemWhereInput[],
    };
}
