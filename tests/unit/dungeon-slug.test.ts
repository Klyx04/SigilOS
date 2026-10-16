/**
 * Règle **unique** du slug d'un donjon (`resolveUniqueDungeonSlug`) : elle sert au
 * God (`createDungeon`), à l'import God, au siphon d'anomalie, au backfill SQL de la
 * migration et — depuis le 16/10/2026 — aux **deux seeds**. Une seule source, jamais
 * une copie dans un écran ou dans un script.
 *
 * 🐛 Mesure du 16/10/2026 (bêta ET base locale rejouée, même erreur) :
 * `prisma/seed-data/seed.ts` créait un `Dungeon` **sans `slug`**, alors que la colonne
 * est REQUISE et UNIQUE depuis la migration `20260919130000_add_dungeon_slug`. Prisma
 * valide l'entrée `create` d'un upsert **avant** de savoir si la ligne existe ⇒
 * « Argument `slug` is missing » au PREMIER donjon, transaction annulée,
 * `process.exit(1)` : le déploiement s'arrêtait à l'étape 5/5 — images neuves, mais
 * données de jeu **jamais** synchronisées, et un `exit 1` à chaque passage.
 *
 * 🔒 Verrouillé ici :
 *  ① le comportement de la règle (suffixe ordinal, repli, borne, `excludeId`) — sans
 *    base de données : le client est injecté, c'est ce qui rend la règle testable ;
 *  ② les deux seeds passent bien LEUR transaction (`{ client }`) au moment du `create` ;
 *  ③ un `update` de seed ne porte **jamais** de `slug` : une URL publiée ne bouge pas.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { resolveUniqueDungeonSlug } from "@/server/game/dungeon-slug";

const REPO_ROOT = path.resolve(__dirname, "../..");
const readSource = (relativePath: string) => fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");

/**
 * Client factice : `slug` déjà pris ⇒ renvoie une ligne, sinon `null` (exactement le
 * contrat de `DungeonSlugClient`). `excludeId` (renommage) ne collisionne jamais.
 */
function fakeClient(taken: string[], seen: Array<Record<string, unknown>> = []) {
    const set = new Set(taken);
    return {
        dungeon: {
            findFirst: async (args: { where: Record<string, unknown>; select: { id: true } }) => {
                seen.push(args.where);
                if (args.where.id) return null;
                return set.has(String(args.where.slug)) ? { id: "clash" } : null;
            },
        },
    };
}

describe("resolveUniqueDungeonSlug — la règle de nommage", () => {
    it("prend le slug libre, puis suffixe « -2 », « -3 »… (mêmes cas que le backfill SQL)", async () => {
        expect(await resolveUniqueDungeonSlug("Minotoror", { client: fakeClient([]) })).toBe("minotoror");
        expect(await resolveUniqueDungeonSlug("Minotoror", { client: fakeClient(["minotoror"]) })).toBe("minotoror-2");
        expect(
            await resolveUniqueDungeonSlug("Minotoror", { client: fakeClient(["minotoror", "minotoror-2"]) })
        ).toBe("minotoror-3");
    });

    it("slugifie le nom du boss (accents dépliés, ponctuation → tiret)", async () => {
        expect(await resolveUniqueDungeonSlug("Tournesol Affamé", { client: fakeClient([]) })).toBe(
            "tournesol-affame"
        );
        expect(await resolveUniqueDungeonSlug("Mob l'Éponge", { client: fakeClient([]) })).toBe("mob-l-eponge");
    });

    it("retombe sur un segment sûr quand le nom ne donne rien (jamais un slug vide)", async () => {
        expect(await resolveUniqueDungeonSlug("", { client: fakeClient([]) })).toBe("boss");
        expect(await resolveUniqueDungeonSlug("!!! ???", { client: fakeClient([]) })).toBe("boss");
    });

    it("ne boucle pas à l'infini quand toutes les variantes sont prises (borne puis repli unique)", async () => {
        const taken = ["tournesol", ...Array.from({ length: 199 }, (_, i) => `tournesol-${i + 2}`)];
        const slug = await resolveUniqueDungeonSlug("Tournesol", { client: fakeClient(taken) });

        expect(slug.startsWith("tournesol-")).toBe(true);
        expect(taken).not.toContain(slug);
    });

    it("ignore le donjon lui-même au renommage (excludeId transmis à la requête)", async () => {
        const seen: Array<Record<string, unknown>> = [];
        const slug = await resolveUniqueDungeonSlug("Minotoror", {
            client: fakeClient(["minotoror"], seen),
            excludeId: "dungeon-1",
        });

        expect(slug).toBe("minotoror");
        expect(seen[0].id).toEqual({ not: "dungeon-1" });
    });
});

describe("seeds — le slug est posé à la création, jamais déplacé ensuite", () => {
    it("les deux seeds passent leur transaction au générateur de slug", () => {
        // ⚠️ Sans `{ client }`, la résolution interrogerait le client applicatif
        // (`@/lib/prisma`) depuis le processus du seed : un second pool de connexions,
        // et surtout un slug aveugle aux donjons créés plus tôt dans la MÊME passe.
        expect(readSource("prisma/seed-data/seed.ts")).toContain(
            "slug: await resolveUniqueDungeonSlug(dungeon.bossName, { client: tx })"
        );
        expect(readSource("prisma/seed.ts")).toContain(
            "slug: await resolveUniqueDungeonSlug(dungeon.bossName, { client: prisma })"
        );
    });

    it("un `update` de seed ne réécrit jamais le slug (une URL publiée ne bouge pas)", () => {
        for (const file of ["prisma/seed-data/seed.ts", "prisma/seed.ts"]) {
            expect(readSource(file), file).not.toMatch(/update: \{[^}]*\bslug:/s);
        }
    });
});
