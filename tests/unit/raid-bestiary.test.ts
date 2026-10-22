import { describe, it, expect } from "vitest";
import { RAIDS_DATA, RAIDS_DATA_EN, RAID_BESTIARY } from "@/lib/raid-overlay-data";
import { findUnityMonsterBySlug } from "@/lib/unity-bestiary";

/**
 * Lot 5 — encyclopédie du raid : les 11 entités résolvent dans le bestiaire
 * local (zéro 404 inventé) et chaque étape à boss pointe une entrée valide.
 */
describe("lot 5 — bestiaire du raid gigalodon", () => {
    const index = RAID_BESTIARY.gigalodon ?? [];

    it("index complet : 4 boss + 6 monstres + 1 invocation", () => {
        expect(index).toHaveLength(11);
        expect(index.filter((e) => e.role === "boss")).toHaveLength(4);
        expect(index.filter((e) => e.role === "monstre")).toHaveLength(6);
        expect(index.filter((e) => e.role === "invocation")).toHaveLength(1);
    });

    it("chaque slug résout un monstre du bestiaire local", () => {
        for (const entry of index) {
            const monster = findUnityMonsterBySlug(entry.slug);
            expect(monster, `slug ${entry.slug}`).not.toBeNull();
            expect((monster?.spells ?? []).length).toBeGreaterThan(0);
        }
    });

    it("boss des raids : Mureine / Exécrabe / Willorque / Gigalodon présents", () => {
        for (const slug of ["mureine", "execrabe", "willorque", "gigalodon"]) {
            expect(index.some((e) => e.slug === slug && e.role === "boss")).toBe(true);
        }
    });

    it("relques à score sur les 3 boss intermédiaires", () => {
        const scores = Object.fromEntries(index.filter((e) => e.scorePts).map((e) => [e.slug, e.scorePts]));
        expect(scores).toMatchObject({ mureine: 1000, execrabe: 5000, willorque: 10000 });
    });

    it("toutes les 11 entrées portent un monsterId Unity officiel pour les icônes", () => {
        for (const entry of index) {
            expect(entry.monsterId, `monsterId pour ${entry.slug}`).toBeDefined();
            expect(entry.monsterId).toBeGreaterThan(0);
        }
    });

    it("burstOpti gigalodon : forgelance, ecaflip, sacrieur, enutrof présents, roublard retiré", () => {
        for (const data of [RAIDS_DATA.gigalodon, RAIDS_DATA_EN.gigalodon]) {
            const classIds = (data.burstOpti?.classes ?? []).map((c) => c.classId);
            expect(classIds).not.toContain("roublard");
            expect(classIds).toContain("forgelance");
            expect(classIds).toContain("ecaflip");
            expect(classIds).toContain("sacrieur");
            expect(classIds).toContain("enutrof");
        }
    });

    it("chaque étape à boss (FR + EN) pointe une entrée valide", () => {
        for (const data of [RAIDS_DATA.gigalodon, RAIDS_DATA_EN.gigalodon]) {
            const slugs = new Set(index.map((e) => e.slug));
            const linked = data.steps.filter((s) => s.monsterSlug);
            expect(linked.length).toBeGreaterThanOrEqual(5);
            for (const step of linked) {
                expect(slugs.has(step.monsterSlug!), `${step.id} → ${step.monsterSlug}`).toBe(true);
            }
        }
    });
});
