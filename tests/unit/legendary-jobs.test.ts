/**
 * Métiers de la modale « Nouvel Objet Légendaire » (`LegendaryManager`).
 *
 * 08/10/2026 (bêta) : la modale codait sa liste en dur et oubliait **Forgeron**.
 * La liste est désormais dérivée de la source unique `DOFUS_JOBS` (`dofus-assets.ts`) :
 * ce test verrouille la dérivation côté modale et le contenu côté source.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { DOFUS_JOBS, JOB_CATEGORIES } from "@/lib/dofus-assets";

const REPO_ROOT = path.resolve(__dirname, "../..");
const readSource = (relativePath: string) => fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");

describe("modale objet légendaire — métiers requis", () => {
    it("la source artisanat contient Forgeron (nom + icône servie)", () => {
        const artisanat = DOFUS_JOBS[JOB_CATEGORIES.ARTISANAT];
        const forgeron = artisanat.find((j) => j.id === "forgeron");
        expect(forgeron).toMatchObject({ id: "forgeron", name: "Forgeron" });
        expect(String(forgeron?.icon)).toContain("/assets/dofus/jobs/forgeron.png");
        // Le fichier existe (sinon la modale affiche un cadre vide).
        expect(fs.existsSync(path.join(REPO_ROOT, "public", String(forgeron?.icon).replace(/^\//, "")))).toBe(true);
    });

    it("la modale dérive de la source unique (plus de liste codée en dur)", () => {
        const modal = readSource("src/components/admin/LegendaryManager.tsx");
        expect(modal).toContain("DOFUS_JOBS[JOB_CATEGORIES.ARTISANAT]");
        expect(modal).not.toContain('{ id: "tailleur"');
        expect(modal).not.toContain('{ id: "bijoutier"');
    });

    it("seul `bricoleur` est exclu des métiers légendaires (statu quo, pas de scope creep)", () => {
        const modal = readSource("src/components/admin/LegendaryManager.tsx");
        expect(modal).toContain('!== "bricoleur"');
    });
});
