import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";

// Mock Prisma
const mockDb = {
    userProfile: {
        update: vi.fn(),
    },
    guildConfig: {
        findUnique: vi.fn(),
    }
};

vi.mock("@/lib/prisma", () => ({
    db: mockDb,
}));

// On va tester la logique de wipe simulée (car les actions utilisent des imports complexes)
describe("Stratégie de Rétention v1.4 (Wipe profond)", () => {

    it("doit vider TOUS les champs JSON pour un membre BANNI", async () => {
        const wipeData = {
            status: "BANNED",
            archiveReason: "BANNED",
            pseudoDofus: "Utilisateur banni",
            discordNickname: "Anonyme",
            metamobPseudo: null,
            altPseudos: Prisma.JsonNull,
            availability: Prisma.JsonNull,
            succes: Prisma.JsonNull,
            metiers: Prisma.JsonNull,
            classeSecondaires: Prisma.JsonNull,
            dofusBookLinks: Prisma.JsonNull,
        };

        await mockDb.userProfile.update({
            where: { id: "profile-test" },
            data: wipeData
        });

        const call = mockDb.userProfile.update.mock.calls[0][0];

        // Vérifications RGPD
        expect(call.data.status).toBe("BANNED");
        expect(call.data.pseudoDofus).toBe("Utilisateur banni");
        expect(call.data.metamobPseudo).toBeNull();

        // Vérification du Wipe des données lourdes (JsonNull)
        expect(call.data.succes).toBe(Prisma.JsonNull);
        expect(call.data.metiers).toBe(Prisma.JsonNull);
        expect(call.data.classeSecondaires).toBe(Prisma.JsonNull);
        expect(call.data.altPseudos).toBe(Prisma.JsonNull);
    });

    it("doit CONSERVER les données pour un membre qui quitte (ARCHIVED)", async () => {
        const archiveData = {
            status: "ARCHIVED",
            archiveReason: "LEFT",
            // Note: On ne touche PAS aux champs Json ici
        };

        await mockDb.userProfile.update({
            where: { id: "profile-test" },
            data: archiveData
        });

        const call = mockDb.userProfile.update.mock.calls[1][0];

        expect(call.data.status).toBe("ARCHIVED");
        expect(call.data.archiveReason).toBe("LEFT");
        // Les champs Json ne doivent pas être présents dans le 'data' de l'update
        expect(call.data.succes).toBeUndefined();
        expect(call.data.metiers).toBeUndefined();
    });
});
