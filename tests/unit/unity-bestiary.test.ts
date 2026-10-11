import { describe, it, expect } from "vitest";
import { findUnityMonsterBySlug, getUnityBestiary, getUnityMonster, listUnityMonsters } from "@/lib/unity-bestiary";

describe("unity-bestiary — chargement et résolution du bestiaire Unity", () => {
    it("charge le dictionnaire du bestiaire sans erreur", () => {
        const bestiary = getUnityBestiary();
        expect(bestiary).toBeDefined();
        expect(typeof bestiary).toBe("object");
    });

    it("résout un monstre par son nom ou son ID", () => {
        const bestiary = getUnityBestiary();
        const firstEntry = Object.values(bestiary)[0];
        if (firstEntry) {
            const byId = getUnityMonster(firstEntry.id);
            expect(byId).not.toBeNull();
            expect(byId?.id).toBe(firstEntry.id);

            const byName = getUnityMonster(firstEntry.name);
            expect(byName).not.toBeNull();
            expect(byName?.name.toLowerCase()).toBe(firstEntry.name.toLowerCase());
        }
    });

    it("retourne null pour un identifiant inconnu", () => {
        expect(getUnityMonster(-999999)).toBeNull();
        expect(getUnityMonster("MonstreCompletementInconnu123456")).toBeNull();
    });

    it("résout un monstre par son slug d'URL (`/bestiaire/<slug>`, même algorithme que les fiches)", () => {
        expect(findUnityMonsterBySlug("piou-rouge")?.name).toBe("Piou Rouge");
        expect(findUnityMonsterBySlug("  PIOU-ROUGE  ")?.name).toBe("Piou Rouge");
        expect(findUnityMonsterBySlug("piou-inexistant-xyz")).toBeNull();
        expect(findUnityMonsterBySlug("")).toBeNull();
    });

    it("expose la liste complète, triée par nom, sans copie par appel", () => {
        const list = listUnityMonsters();
        expect(list.length).toBe(Object.keys(getUnityBestiary()).length);
        expect(list[0].name.localeCompare(list[1].name, "fr")).toBeLessThanOrEqual(0);
        // Référence stable : un second appel ne reconstruit rien.
        expect(listUnityMonsters()).toBe(list);
    });
});
