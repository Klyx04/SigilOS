import { describe, it, expect } from "vitest";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { MOUNT_DATABASE, MountInfo } from "@/data/mount-data";

describe("Studio Élevage — Base de données des montures (MàJ 3.7)", () => {
    it("contient toutes les espèces d'élevage Dofus", () => {
        const families = new Set(MOUNT_DATABASE.map(m => m.family));
        expect(families.has("dragodinde")).toBe(true);
        expect(families.has("muldo")).toBe(true);
        expect(families.has("volkorne")).toBe(true);
    });

    it("contient 228 montures réelles en jeu (66 Dragodindes, 82 Muldos, 80 Volkornes) sur 10 générations", () => {
        const byFamily = (f: MountInfo["family"]) => MOUNT_DATABASE.filter(m => m.family === f);
        expect(byFamily("dragodinde")).toHaveLength(66);
        expect(byFamily("muldo")).toHaveLength(82);
        expect(byFamily("volkorne")).toHaveLength(80);

        for (const f of ["dragodinde", "muldo", "volkorne"] as const) {
            const gens = byFamily(f).map(m => m.generation);
            expect(Math.min(...gens)).toBe(1);
            expect(Math.max(...gens)).toBe(10);
        }
    });

    it("chaque monture possède des métadonnées complètes et valides", () => {
        const ids = new Set<string>();
        for (const mount of MOUNT_DATABASE) {
            expect(mount.id).toBeTruthy();
            expect(ids.has(mount.id), `id dupliqué: ${mount.id}`).toBe(false);
            ids.add(mount.id);
            expect(mount.name).toBeTruthy();
            expect(mount.generation).toBeGreaterThanOrEqual(1);
            expect(mount.generation).toBeLessThanOrEqual(10);
            expect(mount.stats).toBeTruthy();
            expect(mount.statTags.length).toBeGreaterThan(0);
            expect(mount.img).toBe(`/images/guides/elevage/mounts/${mount.id}.webp`);
        }
    });

    /**
     * Non-régression du 29/10/2026 : la page /elevage (onglet « Arbres des 10 Générations »)
     * affichait des carrés **noirs** pour les 228 montures. Les URLs pointaient vers
     * `/api/assets-dofus/items/<iconId>` — l'espace « id d'objet » du proxy, alors que ces
     * nombres sont des **iconId** : DofusDB ne trouvait rien et le proxy renvoyait son PNG
     * 1×1 transparent (HTTP 200, donc aucune erreur visible en console).
     * Garde : l'icône est un fichier **local** et il existe vraiment sur disque.
     */
    it("chaque monture a une icône locale réellement présente (aucun carré noir)", () => {
        const missing: string[] = [];
        for (const mount of MOUNT_DATABASE) {
            expect(mount.img.startsWith("/images/guides/elevage/mounts/"), `${mount.name}: icône non locale (${mount.img})`).toBe(true);
            const file = path.join(process.cwd(), "public", mount.img.replace(/^\//, ""));
            if (!existsSync(file) || statSync(file).size < 200) missing.push(`${mount.name} → ${mount.img}`);
        }
        expect(missing, `icônes absentes ou vides:\n${missing.join("\n")}`).toEqual([]);
    });

    it("les croisements référencent des parents connus de la même espèce", () => {
        const byName = new Map(MOUNT_DATABASE.map(m => [m.name, m]));

        for (const mount of MOUNT_DATABASE) {
            if (!mount.parents) continue;
            expect(mount.parents.length).toBe(2);
            for (const p of mount.parents) {
                const parent = byName.get(p);
                expect(parent, `${mount.name} parent inconnu: ${p}`).toBeDefined();
                expect(parent?.family, `${mount.name} parent d'une autre espèce: ${p}`).toBe(mount.family);
            }
        }
    });

    it("tout croisement vérifie gen = max(parents) + 1 (règle d'élevage Dofus)", () => {
        const genOf = new Map(MOUNT_DATABASE.map(m => [m.name, m.generation]));

        for (const mount of MOUNT_DATABASE) {
            if (!mount.parents) continue;
            const [p1, p2] = mount.parents;
            const g1 = genOf.get(p1);
            const g2 = genOf.get(p2);
            if (g1 === undefined || g2 === undefined) continue; // parent sauvage hors base
            expect(
                mount.generation,
                `${mount.name} gen ${mount.generation} incohérente (${p1} gen ${g1} + ${p2} gen ${g2})`,
            ).toBe(Math.max(g1, g2) + 1);
        }
    });

    it("les tags de filtre UI (+1PM/+1PA/+1PO) reflètent le bonus de base affiché", () => {
        for (const mount of MOUNT_DATABASE) {
            expect(
                mount.statTags.includes("pm"),
                `${mount.name} tagué +1PM sans "1 PM" (${mount.stats})`,
            ).toBe(mount.stats.includes("1 PM"));
            expect(
                mount.statTags.includes("pa"),
                `${mount.name} tagué +1PA sans "1 PA" (${mount.stats})`,
            ).toBe(mount.stats.includes("1 PA"));
            expect(
                mount.statTags.includes("po"),
                `${mount.name} tagué +1PO sans "Portée" (${mount.stats})`,
            ).toBe(mount.stats.includes("Portée"));
        }
    });

    it("les valeurs correspondent au jeu (ère 400 Vitalité, Dofus 3.x)", () => {
        const ddIvoire = MOUNT_DATABASE.find(m => m.name === "Dragodinde Ivoire");
        expect(ddIvoire?.generation).toBe(7);
        expect(ddIvoire?.stats).toBe("400 Vitalité, 90 Puissance");

        const ddPruneIvoire = MOUNT_DATABASE.find(m => m.name === "Dragodinde Prune et Ivoire");
        expect(ddPruneIvoire?.generation).toBe(10);
        expect(ddPruneIvoire?.stats).toBe("400 Vitalité, 70 Puissance, 1 Portée");

        const ddEmeraude = MOUNT_DATABASE.find(m => m.name === "Dragodinde Emeraude");
        expect(ddEmeraude?.generation).toBe(9);
        expect(ddEmeraude?.stats).toContain("14% Chance critique");

        const muldoPrune = MOUNT_DATABASE.find(m => m.name === "Muldo Prune");
        expect(muldoPrune?.generation).toBe(7);
        expect(muldoPrune?.stats).toContain("12% Chance critique");

        const muldoDore = MOUNT_DATABASE.find(m => m.name === "Muldo Doré");
        expect(muldoDore?.generation).toBe(1);
        expect(muldoDore?.stats).toContain("70 Puissance");

        const volkPrune = MOUNT_DATABASE.find(m => m.name === "Volkorne Prune");
        expect(volkPrune?.generation).toBe(5);
        expect(volkPrune?.stats).toContain("60 Résistance critique");
        expect(volkPrune?.statTags).toContain("pa");

        const volkIvoire = MOUNT_DATABASE.find(m => m.name === "Volkorne Ivoire");
        expect(volkIvoire?.generation).toBe(3);

        const volkDore = MOUNT_DATABASE.find(m => m.name === "Volkorne Doré");
        expect(volkDore?.generation).toBe(7);
        expect(volkDore?.stats).toContain("250 Vitalité");

        const volkAmetyste = MOUNT_DATABASE.find(m => m.name === "Volkorne Améthyste");
        expect(volkAmetyste?.generation).toBe(9);
        expect(volkAmetyste?.stats).toContain("14% Résistance Air");
    });
});
