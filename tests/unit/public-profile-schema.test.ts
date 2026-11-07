/**
 * Espace visiteur (rang 57) — verrou de **schéma** du lot V1a.
 *
 * Trois invariants, et chacun protège une décision déjà payée :
 *
 * 1. **Isolation structurelle** (D-V1) : `PublicProfile` ne porte **aucun** `guildId` et
 *    aucune FK vers `GuildConfig`. Si quelqu'un en ajoute un, un visiteur peut se retrouver
 *    rattaché à une guilde sans passer par les gardes.
 * 2. **Serveur obligatoire** (06/11/2026) : `dofusServerId` est `Int`, pas `Int?`. C'est la
 *    clé du ladder Ankama et le filtre de l'annuaire ; un profil sans serveur est un profil
 *    qui ne peut rien synchroniser.
 * 3. **Consentements fermés** (D-V4 / D9) : `showOnDirectory` et `showPresence` valent
 *    `false` par défaut. Un défaut ouvert publierait des gens sans qu'ils l'aient demandé.
 *
 * Le verrou lit le **source brut** : la prose des commentaires est retirée avant les
 * assertions négatives (piège déjà payé dans le module Rush).
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const SCHEMA = readFileSync("prisma/schema.prisma", "utf8");
const PRISMA_CLIENT = readFileSync("src/lib/prisma.ts", "utf8");

/** Corps d'un modèle Prisma, sans les commentaires. */
function modelBody(name: string): string {
    const match = SCHEMA.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`));
    expect(match, `modèle ${name} absent`).not.toBeNull();
    return (match?.[1] ?? "").replace(/\/\/\/[^\n]*/g, "");
}

describe("Espace visiteur — les quatre tables existent", () => {
    it("les modèles sont déclarés dans le schéma", () => {
        for (const model of [
            "PublicProfile",
            "PublicRushProgress",
            "PublicProfession",
            "PublicDungeonAchievement",
        ]) {
            expect(SCHEMA, model).toMatch(new RegExp(`model ${model} \\{`));
        }
    });

    it("`User` porte sa vie publique, `DungeonAchievement` ses coches visiteurs", () => {
        expect(modelBody("User")).toMatch(/publicProfile\s+PublicProfile\?/);
        expect(modelBody("DungeonAchievement")).toMatch(
            /publicAchievedBy\s+PublicDungeonAchievement\[\]/
        );
    });
});

describe("Espace visiteur — isolation et consentement", () => {
    it("aucun `guildId` ne rentre dans le profil public (D-V1)", () => {
        const body = modelBody("PublicProfile");
        expect(body).not.toMatch(/guildId/);
        expect(body).not.toMatch(/GuildConfig/);
    });

    it("le serveur est obligatoire — `Int`, jamais `Int?`", () => {
        const body = modelBody("PublicProfile");
        expect(body).toMatch(/\bdofusServerId\s+Int\s/);
        expect(body).not.toMatch(/dofusServerId\s+Int\?/);
    });

    it("les deux consentements sont fermés par défaut", () => {
        const body = modelBody("PublicProfile");
        expect(body).toMatch(/showOnDirectory\s+Boolean\s+@default\(false\)/);
        expect(body).toMatch(/showPresence\s+Boolean\s+@default\(false\)/);
    });

    it("la progression est unique par (profil, guide, personnage)", () => {
        expect(modelBody("PublicRushProgress")).toMatch(
            /@@unique\(\[publicProfileId, guideId, characterSlot\]\)/
        );
    });

    it("l'emplacement est une chaîne, comme les trois tables internes", () => {
        // Un entier obligerait à inventer un index : il se décale dès que la liste des mules
        // change, et la progression saute d'un personnage à l'autre (mesure du 06/11/2026).
        expect(modelBody("PublicRushProgress")).toMatch(/characterSlot\s+String\s+@default\("PRINCIPAL"\)/);
        for (const model of ["PlayerGuideProgress", "PlayerGuideResourceCheck", "PlayerGuideDungeonState"]) {
            expect(modelBody(model)).toMatch(/characterSlot\s+String\s+@default\("PRINCIPAL"\)/);
        }
    });

    it("les métiers sont normalisés et indexés pour le filtre", () => {
        const body = modelBody("PublicProfession");
        expect(body).toMatch(/@@unique\(\[publicProfileId, metierId\]\)/);
        expect(body).toMatch(/@@index\(\[metierId, level\]\)/);
    });
});

describe("Espace visiteur — la migration accompagne le schéma", () => {
    const dir = readdirSync("prisma/migrations").find((name) => name.endsWith("_public_profile"));
    const file = dir ? `prisma/migrations/${dir}/migration.sql` : "";
    /**
     * ⚠️ Le verrou lit le **code**, pas la prose : l'en-tête de la migration cite
     * lui-même « ADD CONSTRAINT IF NOT EXISTS » et « DROP TABLE ». Retirer les
     * commentaires d'abord (piège déjà payé deux fois dans le module Rush).
     */
    const code = file ? readFileSync(file, "utf8").replace(/--[^\n]*/g, "") : "";

    it("une migration dédiée existe", () => {
        expect(dir, "migration `*_public_profile` introuvable").toBeTruthy();
        expect(existsSync(file)).toBe(true);
    });

    it("elle est additive : quatre tables, aucun `DROP`", () => {
        for (const table of [
            "PublicProfile",
            "PublicRushProgress",
            "PublicProfession",
            "PublicDungeonAchievement",
        ]) {
            expect(code, table).toMatch(
                new RegExp(`CREATE TABLE IF NOT EXISTS "${table}"`)
            );
        }
        expect(code).not.toMatch(/\bDROP\s+(TABLE|COLUMN)\b/i);
    });

    it("les clés étrangères sont posées une seule fois (pas de doublon au rejeu)", () => {
        // Toute clé étrangère doit vivre DANS le bloc `DO $$ … pg_constraint …` : une FK
        // posée en clair ferait échouer `migrate deploy` au second passage.
        const guard = code.indexOf("DO $$");
        expect(guard).toBeGreaterThan(-1);
        const firstConstraint = code.indexOf('ADD CONSTRAINT "');
        expect(firstConstraint).toBeGreaterThan(guard);
        expect(code).toMatch(/pg_constraint WHERE conname = 'PublicProfile_userId_fkey'/);
        expect(code).toMatch(/pg_constraint WHERE conname = 'PublicRushProgress_publicProfileId_fkey'/);
        expect(code).toMatch(/pg_constraint WHERE conname = 'PublicProfession_publicProfileId_fkey'/);
        expect(code).toMatch(
            /pg_constraint WHERE conname = 'PublicDungeonAchievement_dungeonAchievementId_fkey'/
        );
    });
});

describe("Espace visiteur — la clé Metamob est chiffrée comme celle de l'interne", () => {
    it("le profil public est couvert à l'écriture ET à la lecture", () => {
        expect(PRISMA_CLIENT).toMatch(/publicProfile:\s*\{/);
        // Écriture : create / update / updateMany (le trou F-05 venait d'updateMany).
        expect(PRISMA_CLIENT.match(/if \(typeof data\.metamobApiKey === 'string'\) data\.metamobApiKey = encrypt\(data\.metamobApiKey\);/g)?.length).toBeGreaterThanOrEqual(4);
        // Lecture : la valeur rendue est déchiffrée.
        expect(PRISMA_CLIENT).toMatch(/return decrypt\(profile\.metamobApiKey\);/);
    });
describe("Espace visiteur — V1c : logo retiré, mules, métiers en slug", () => {
    it("aucun logo de guilde déclaré ne reste dans le schéma (D-V7)", () => {
        expect(modelBody("PublicProfile")).not.toMatch(/declaredGuildLogoUrl/);
    });

    it("les mules sont une colonne JSON, même forme que le profil interne", () => {
        expect(modelBody("PublicProfile")).toMatch(/altPseudos\s+Json\?/);
    });

    it("le métier est un slug texte, pas un entier inventé", () => {
        const body = modelBody("PublicProfession");
        expect(body).toMatch(/metierId\s+String/);
        expect(body).not.toMatch(/metierId\s+Int/);
    });

    it("la migration V1c fait les trois changements, sans perte", () => {
        const dir = readdirSync("prisma/migrations").find((name) => name.endsWith("_visitor_profile_v1c"));
        expect(dir, "migration `*_visitor_profile_v1c` introuvable").toBeTruthy();
        const code = readFileSync(`prisma/migrations/${dir}/migration.sql`, "utf8").replace(/--[^\n]*/g, "");
        expect(code).toMatch(/DROP COLUMN IF EXISTS "declaredGuildLogoUrl"/);
        expect(code).toMatch(/ADD COLUMN IF NOT EXISTS "altPseudos" JSONB/);
        expect(code).toMatch(/ALTER COLUMN "metierId" TYPE TEXT/);
    });
});

});
