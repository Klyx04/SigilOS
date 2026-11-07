/**
 * Guide public du Rush — **bandeau du visiteur connecté** (V2a).
 *
 * Deux règles, et une seule façon de les casser :
 *
 * 1. **DTO étanche** : cinq scalaires (pseudo, classe, serveur, niveau, points de succès) —
 *    jamais les mules, jamais la clé Metamob, jamais `userId` ;
 * 2. **anonyme = inchangé** : la page ne lit le profil que s'il y a une session, et le
 *    bandeau n'est rendu que si l'identité existe. Un visiteur non connecté ne doit voir
 *    ni le bandeau, ni une requête en plus.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { toPublicGuideVisitor } from "@/lib/public-guide-visitor";

const read = (path: string) => readFileSync(path, "utf8");
const stripComments = (code: string) =>
    code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const PAGE = "src/app/guides/rush-sylvestre/page.tsx";
const CLIENT = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";

describe("Bandeau du guide — cinq scalaires, rien d'autre", () => {
    it("recopie exactement les cinq champs publics", () => {
        const visitor = toPublicGuideVisitor({
            pseudoDofus: "MonIop",
            classe: "iop",
            dofusServerId: 295,
            dofusLevel: 200,
            successPoints: 12_345,
        });
        expect(visitor).toEqual({
            pseudo: "MonIop",
            classe: "iop",
            serverId: 295,
            level: 200,
            successPoints: 12_345,
        });
        expect(Object.keys(visitor).sort()).toEqual(["classe", "level", "pseudo", "serverId", "successPoints"]);
    });

    it("accepte un profil incomplet sans inventer de valeur", () => {
        const visitor = toPublicGuideVisitor({
            pseudoDofus: null,
            classe: null,
            dofusServerId: 295,
            dofusLevel: null,
            successPoints: null,
        });
        expect(visitor.pseudo).toBeNull();
        expect(visitor.classe).toBeNull();
        expect(visitor.level).toBeNull();
    });
});

describe("Bandeau du guide — jamais de données privées, jamais pour un anonyme", () => {
    const page = stripComments(read(PAGE));
    const client = stripComments(read(CLIENT));

    it("la page ne lit le profil que s'il y a une session", () => {
        expect(page).toContain("session?.user ? await getPublicAccount() : null");
        expect(page).toContain("visitor={guideVisitor}");
    });

    it("le bandeau n'est rendu que si l'identité existe", () => {
        expect(client).toContain("{visitor ? (");
        expect(client).toContain("visitor?: PublicGuideVisitor | null");
    });

    it("aucune donnée privée dans le bandeau ni dans le DTO", () => {
        const lib = stripComments(read("src/lib/public-guide-visitor.ts"));
        for (const code of [client, lib]) {
            expect(code).not.toMatch(/metamob/i);
            expect(code).not.toMatch(/altPseudos/);
            expect(code).not.toMatch(/userId/);
        }
    });

    it("le client continue de n'importer aucun code serveur (verrou de parité)", () => {
        expect(client).not.toMatch(/@\/server\//);
    });
});
