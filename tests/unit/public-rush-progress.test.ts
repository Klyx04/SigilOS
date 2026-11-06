/**
 * Espace visiteur (rang 57) — verrou de la **progression en base** (V1d).
 *
 * Ce que ce test protège, dans l'ordre où ça peut casser :
 *
 * 1. **bornes** : une progression trafiquée (2 001 donjons, 301 blocs, 501 étapes) est
 *    **refusée** — jamais tronquée en silence, sinon une donnée courte serait indiscernable
 *    d'une progression réellement plus courte ;
 * 2. **cloisonnement** : le `publicProfileId` vient du compte, le `guideId` est une constante
 *    serveur, et le fichier ne contient **aucun** `guildId` ;
 * 3. **idempotence** : l'adoption ne peut pas écraser une progression existante
 *    (`skipDuplicates`) ;
 * 4. **silence réseau** : un visiteur non connecté n'appelle **rien**.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
    PUBLIC_RUSH_MAX_DUNGEON_CHECKS,
    PUBLIC_RUSH_MAX_MILESTONES,
    PUBLIC_RUSH_MAX_STEPS_PER_MILESTONE,
    PUBLIC_RUSH_GUIDE_ID,
    publicRushProgressSchema,
    publicRushResetSchema,
    toPublicRushColumns,
} from "@/lib/public-rush-progress";

const read = (path: string) => readFileSync(path, "utf8");
const stripComments = (code: string) =>
    code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const STORE = "src/server/rush-public-store.ts";
const ACTIONS = "src/app/guides/rush-sylvestre/_actions/rush-progress.ts";
const CLIENT = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";
const PAGE = "src/app/guides/rush-sylvestre/page.tsx";

const VALID = {
    characterSlot: "moniop-295",
    characterName: "MonIop",
    classe: "iop",
    completedMilestones: ["ms-1"],
    completedSteps: { "ms-1": ["seq-1"] },
    bookmarks: { "ms-1": "seq-1" },
    dungeonChecks: { "seq-1::donjon-1": "done" as const },
};

describe("Progression en base — bornes et forme", () => {
    it("accepte une progression normale et remplit les champs absents", () => {
        const parsed = publicRushProgressSchema.parse(VALID);
        expect(parsed.completedMilestones).toEqual(["ms-1"]);
        expect(parsed.currentStep ?? null).toBeNull();
        expect(publicRushProgressSchema.parse({ characterSlot: "PRINCIPAL" }).completedMilestones).toEqual([]);
    });

    it("refuse un emplacement qui n'est pas une clé", () => {
        for (const slot of ["", "../../etc/passwd", "a".repeat(61), "mon iop"]) {
            expect(publicRushProgressSchema.safeParse({ ...VALID, characterSlot: slot }).success).toBe(false);
        }
    });

    it("refuse une progression au-delà des plafonds, jamais une troncature", () => {
        const tooManyMilestones = {
            ...VALID,
            completedMilestones: Array.from({ length: PUBLIC_RUSH_MAX_MILESTONES + 1 }, (_, i) => `ms-${i}`),
        };
        expect(publicRushProgressSchema.safeParse(tooManyMilestones).success).toBe(false);

        const tooManySteps = {
            ...VALID,
            completedSteps: {
                "ms-1": Array.from({ length: PUBLIC_RUSH_MAX_STEPS_PER_MILESTONE + 1 }, (_, i) => `s-${i}`),
            },
        };
        expect(publicRushProgressSchema.safeParse(tooManySteps).success).toBe(false);

        const tooManyDungeons = {
            ...VALID,
            dungeonChecks: Object.fromEntries(
                Array.from({ length: PUBLIC_RUSH_MAX_DUNGEON_CHECKS + 1 }, (_, i) => [`q-${i}::d-${i}`, "done"])
            ),
        };
        expect(publicRushProgressSchema.safeParse(tooManyDungeons).success).toBe(false);
    });

    it("n'accepte que done/todo comme état de donjon", () => {
        expect(
            publicRushProgressSchema.safeParse({ ...VALID, dungeonChecks: { "q::d": "peut-etre" } }).success
        ).toBe(false);
    });

    it("la réinitialisation ne vise qu'un emplacement", () => {
        expect(publicRushResetSchema.safeParse({ characterSlot: "moniop-295" }).success).toBe(true);
        expect(publicRushResetSchema.safeParse({}).success).toBe(false);
    });

    it("les colonnes Prisma reçoivent `null`, jamais `undefined`", () => {
        const columns = toPublicRushColumns(publicRushProgressSchema.parse({ characterSlot: "PRINCIPAL" }));
        expect(columns.characterName).toBeNull();
        expect(columns.classe).toBeNull();
        expect(columns.currentStep).toBeNull();
    });
});

describe("Progression en base — le périmètre vient du compte", () => {
    const store = stripComments(read(STORE));

    it("garde et identifiant serveur sur les quatre opérations", () => {
        expect(store).toContain("getPublicAccount()");
        expect(store).toContain("publicProfileId: account.profile.id");
        expect(store).toContain("publicProfileId_guideId_characterSlot");
    });

    it("aucune donnée de guilde, aucun guide venu du client", () => {
        expect(store).not.toMatch(/guildId/);
        expect(store).toContain("guideId: PUBLIC_RUSH_GUIDE_ID");
        expect(store).not.toContain("parsed.data.guideId");
    });

    it("l'adoption ne peut pas écraser une progression existante", () => {
        expect(store).toContain("skipDuplicates: true");
    });

    it("la remise à zéro est ciblée (deleteMany + emplacement)", () => {
        const reset = store.slice(store.indexOf("resetPublicRushProgress"));
        expect(reset).toContain("deleteMany");
        expect(reset).toContain("characterSlot: parsed.data.characterSlot");
    });

    it("chaque mutation passe par le rate limit", () => {
        expect(store).toContain('limit("rush-save"');
        expect(store).toContain('limit("rush-adopt"');
        expect(store).toContain('limit("rush-reset"');
    });
});

describe("Progression en base — le guide n'appelle rien sans session", () => {
    const client = stripComments(read(CLIENT));

    it("les quatre appels existent et sont gardés par `isConnected`", () => {
        expect(client).toContain("saveMyRushProgress(");
        expect(client).toContain("adoptMyRushProgress(");
        expect(client).toContain("resetMyRushProgress(");
        expect(client).toContain("loadMyRushProgress(");
        expect(client).toContain("if (!isConnected) return;");
    });

    it("la page transmet la session sans requête supplémentaire", () => {
        const page = stripComments(read(PAGE));
        expect(page).toContain("isConnected={!!session?.user}");
    });

    it("les actions ne font que déléguer au store", () => {
        const actions = stripComments(read(ACTIONS));
        expect(actions).toContain("loadPublicRushProgress");
        expect(actions).toContain("savePublicRushProgress");
        expect(actions).toContain("adoptPublicRushProgress");
        expect(actions).toContain("resetPublicRushProgress");
    });

    it("le guide et le store partagent le même identifiant de guide", () => {
        expect(PUBLIC_RUSH_GUIDE_ID).toBe("rush-sylvestre");
    });
});
