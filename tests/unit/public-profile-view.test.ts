/**
 * Espace visiteur (rang 57) — verrou du **DTO étanche** (lot V1c).
 *
 * Défaut mesuré le 06/11/2026 : `getPublicAccount()` rendait la ligne Prisma entière, et le
 * hook de `src/lib/prisma.ts` **déchiffre** `metamobApiKey` à la lecture. La clé Metamob
 * partait donc dans le payload RSC dès la première page. Ce test verrouille trois choses :
 *
 * 1. la vue ne porte **jamais** `metamobApiKey` (seulement `hasMetamobApiKey`) ;
 * 2. les mules et activités sont **normalisées** à la lecture (une ligne abîmée ne casse
 *    pas l'écran, et une activité inconnue ne passe pas) ;
 * 3. le serveur garde un `select` **explicite** — pas de `findUnique` nu.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
    normalizeDeclaredMules,
    normalizePreferredActivities,
    toPublicProfileView,
    type PublicProfileRow,
} from "@/lib/public-profile-dto";

const ACTIVITIES = ["pvm", "economie", "raids"];

function row(overrides: Partial<PublicProfileRow> = {}): PublicProfileRow {
    return {
        id: "profile-1",
        userId: "user-1",
        dofusServerId: 295,
        pseudoDofus: "Testeur",
        classe: "iop",
        declaredGuildName: "Les Veilleurs",
        altPseudos: [],
        introduction: null,
        objectifs: null,
        preferredActivities: [],
        metamobPseudo: "testeur",
        metamobApiKey: "secret-key",
        metamobVerified: true,
        alignment: null,
        alignmentOrder: null,
        alignmentLevel: 0,
        dofusLevel: 200,
        totalXp: 0n,
        successPoints: 100,
        lastLadderSync: null,
        showOnDirectory: false,
        showPresence: false,
        showRushProgress: false,
        createdAt: new Date("2026-11-06T00:00:00Z"),
        updatedAt: new Date("2026-11-06T00:00:00Z"),
        ...overrides,
    };
}

describe("Espace visiteur — la clé Metamob ne sort jamais", () => {
    it("la vue n'expose pas `metamobApiKey`, seulement son existence", () => {
        const view = toPublicProfileView(row(), ACTIVITIES);
        expect(Object.keys(view)).not.toContain("metamobApiKey");
        expect(view.hasMetamobApiKey).toBe(true);
    });

    it("une clé absente ou vide donne `hasMetamobApiKey = false`", () => {
        expect(toPublicProfileView(row({ metamobApiKey: null }), ACTIVITIES).hasMetamobApiKey).toBe(false);
        expect(toPublicProfileView(row({ metamobApiKey: "" }), ACTIVITIES).hasMetamobApiKey).toBe(false);
    });

    it("`totalXp` (BigInt) ne franchit pas la frontière RSC", () => {
        const view = toPublicProfileView(row(), ACTIVITIES);
        expect(Object.keys(view)).not.toContain("totalXp");
    });

    it("la garde serveur garde un `select` explicite (pas de `findUnique` nu)", () => {
        const source = readFileSync("src/server/public-account.ts", "utf8");
        expect(source).toMatch(/select:\s*PUBLIC_PROFILE_SELECT/);
        expect(source).toMatch(/metamobApiKey:\s*true/);
        expect(source).not.toMatch(/findUnique\(\{\s*where:\s*\{\s*userId\s*\}\s*\}\)/);
        expect(source).not.toMatch(/from "@prisma\/client"/);
        expect(source).not.toMatch(/profile:\s*PublicProfile\s*[;}]/);
    });
});

describe("Espace visiteur — normalisation à la lecture", () => {
    it("écarte une mule sans pseudo, déduplique, et borne la liste", () => {
        const mules = normalizeDeclaredMules([
            { pseudo: "  Alpha ", classe: "iop", level: 200 },
            { pseudo: "alpha", classe: "cra", level: 1 },
            { pseudo: "" },
            null,
        ]);
        expect(mules).toHaveLength(1);
        expect(mules[0]).toMatchObject({ pseudo: "Alpha", classe: "iop", level: 200 });
    });

    it("borne à `PUBLIC_MULES_MAX` même si le JSON en contient plus", () => {
        const raw = Array.from({ length: 25 }, (_, index) => ({ pseudo: `Mule${index}` }));
        expect(normalizeDeclaredMules(raw)).toHaveLength(10);
    });

    it("filtre une activité hors liste blanche (jamais un slug inventé)", () => {
        expect(normalizePreferredActivities(["pvm", "inconnu", 42], ACTIVITIES)).toEqual(["pvm"]);
        expect(normalizePreferredActivities("pvm", ACTIVITIES)).toEqual([]);
    });
});
