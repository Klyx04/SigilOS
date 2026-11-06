/**
 * Espace visiteur (rang 57) — verrou des **actions serveur** du profil public (V1c).
 *
 * Deux familles d'assertions, et chacune protège une règle déjà payée :
 *
 * 1. **Comportement des schémas** : un serveur inconnu, un pseudo hors bornes, une mule en
 *    double ou un métier non déclaré sont refusés — avec un message lisible.
 * 2. **Verrou de source** : chaque action exportée porte sa garde, le fichier passe par le
 *    rate limit, et aucune écriture ne prend un identifiant venu du client.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
    createPublicProfileSchema,
    deletePublicProfileSchema,
    isKnownJobId,
    publicIdentitySchema,
    publicMulesSchema,
    publicProfessionsSchema,
    publicPseudoSchema,
} from "@/lib/public-profile-input";

const ACTIONS = readFileSync("src/server/actions/public-profile-actions.ts", "utf8");

/** Découpe le fichier d'actions en blocs `export async function …`. */
function actionBlocks(): { name: string; body: string }[] {
    const parts = ACTIONS.split(/export async function /).slice(1);
    return parts.map((part) => {
        const name = part.slice(0, part.indexOf("("));
        return { name, body: part };
    });
}

describe("Espace visiteur — entrées bornées", () => {
    it("refuse un serveur hors référentiel et accepte un serveur officiel", () => {
        expect(createPublicProfileSchema.safeParse({ dofusServerId: 999, pseudoDofus: "Testeur" }).success).toBe(false);
        expect(createPublicProfileSchema.safeParse({ dofusServerId: 295, pseudoDofus: "Testeur" }).success).toBe(true);
    });

    it("met le pseudo en forme et refuse une longueur hors bornes", () => {
        expect(publicPseudoSchema.parse("  jean-luc ")).toBe("Jean-luc");
        expect(publicPseudoSchema.safeParse("A").success).toBe(false);
        expect(publicPseudoSchema.safeParse("x".repeat(21)).success).toBe(false);
    });

    it("refuse une mule en double (insensible à la casse)", () => {
        const result = publicMulesSchema.safeParse([
            { pseudo: "Alpha", level: 200 },
            { pseudo: "alpha", level: 100 },
        ]);
        expect(result.success).toBe(false);
    });

    it("refuse un métier déclaré deux fois et un slug inconnu côté action", () => {
        expect(
            publicProfessionsSchema.safeParse([
                { id: "forgeron", level: 200 },
                { id: "forgeron", level: 100 },
            ]).success
        ).toBe(false);
        expect(isKnownJobId("forgeron")).toBe(true);
        expect(isKnownJobId("licorne")).toBe(false);
    });

    it("le nom de guilde déclaré garde sa règle (lettres, espace, apostrophe, tiret)", () => {
        const base = { dofusServerId: 295, pseudoDofus: "Testeur", classe: "iop" };
        expect(publicIdentitySchema.safeParse({ ...base, declaredGuildName: "Les Veilleurs" }).success).toBe(true);
        expect(publicIdentitySchema.safeParse({ ...base, declaredGuildName: "Guilde 1" }).success).toBe(false);
    });

    it("la suppression exige le mot exact", () => {
        expect(deletePublicProfileSchema.safeParse({ confirmation: "supprimer" }).success).toBe(false);
        expect(deletePublicProfileSchema.safeParse({ confirmation: "SUPPRIMER" }).success).toBe(true);
    });
});

describe("Espace visiteur — chaque action porte sa garde et son rate limit", () => {
    const blocks = actionBlocks();

    it("aucune action n'est exportée sans garde de session", () => {
        expect(blocks.length).toBeGreaterThanOrEqual(9);
        for (const block of blocks) {
            const guarded = block.body.includes("getPublicAccount()") || block.body.includes("getPublicSession()");
            expect(guarded, block.name).toBe(true);
        }
    });

    it("le fichier passe par le rate limiter Redis", () => {
        expect(ACTIONS).toMatch(/rateLimit\(`visitor:/);
    });

    it("les écritures du profil visent `userId` (serveur), jamais un id client", () => {
        expect(ACTIONS).toMatch(/where: \{ userId: account\.userId \}/);
        expect(ACTIONS).toMatch(/where: \{ userId: visitor\.userId \}/);
        expect(ACTIONS).not.toMatch(/where: \{ id: parsed\.data\.userId/);
    });

    it("l'export ne sélectionne jamais la clé Metamob", () => {
        const exportBlock = blocks.find((block) => block.name === "exportPublicProfile");
        expect(exportBlock).toBeTruthy();
        expect(exportBlock?.body).not.toMatch(/metamobApiKey/);
    });

    it("la suppression applique D-V10 (vie publique seule si profil ACTIVE)", () => {
        const deleteBlock = blocks.find((block) => block.name === "deletePublicProfile");
        expect(deleteBlock?.body).toMatch(/status: "ACTIVE"/);
        expect(deleteBlock?.body).toMatch(/scope: "PUBLIC_ONLY"/);
        expect(deleteBlock?.body).toMatch(/isSuperAdmin\(\)/);
    });
});
