import { describe, expect, it } from "vitest";

import npcs from "../../prisma/seed-data/npcs/npcs-client.json";

/**
 * Garde du référentiel PNJ siphonné du client (`scripts/siphon-npcs-client.py`).
 * Le JSON est la source de `searchNpcsLocal` : une extraction dégradée
 * (noms illisibles, trous) ne doit jamais être committée.
 */
describe("npcs-client — référentiel siphonné du client", () => {
    it("contient le bestiaire complet avec des noms exploitables", () => {
        expect(Array.isArray(npcs)).toBe(true);
        expect(npcs.length).toBeGreaterThan(6000);
        for (const npc of npcs as { id: unknown; name: unknown; look: unknown }[]) {
            expect(Number.isInteger(npc.id)).toBe(true);
            expect(typeof npc.name).toBe("string");
            expect((npc.name as string).length).toBeGreaterThan(0);
            // Aucun caractère de remplacement : l'extraction UTF-8 est propre.
            expect(npc.name as string).not.toContain("�");
        }
    });

    it("épingle des PNJ connus (non-régression du siphon)", () => {
        const byId = new Map((npcs as { id: number; name: string }[]).map((n) => [n.id, n.name]));
        expect(byId.get(196)).toBe("Wogew l'hewmite");
        expect(byId.get(389)).toBe("Mama Ayuto");
        expect(byId.get(2205)).toBe("Mériana");
    });
});
