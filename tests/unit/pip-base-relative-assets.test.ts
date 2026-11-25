import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Fenêtre PiP — les assets relatifs doivent se résoudre comme dans la page hôte.
 *
 * Mesure du 25/11/2026 : la modale « Mon Ocre » du dashboard chargeait toutes les
 * vignettes ; dans l'overlay PiP, les mêmes `OcreMonsterThumb` étaient cassées.
 * Le document PiP est un `about:blank` : sans `<base>`, `/uploads/...` et
 * `/api/assets-dofus/...` se résolvent contre `about:blank`.
 */

const PIP = "src/hooks/use-guide-pip.ts";
const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("PiP — base des URL relatives", () => {
    it("preparePipDocument ancre le document sur l'URL de l'hôte", () => {
        const code = read(PIP);
        expect(code).toContain('doc.createElement("base")');
        expect(code).toContain("base.href = document.baseURI");
        expect(code).toContain("doc.head.prepend(base)");
    });

    it("le <base> est posé avant les feuilles de style (les url(...) en dépendent)", () => {
        const code = read(PIP);
        expect(code.indexOf("doc.head.prepend(base)")).toBeLessThan(
            code.indexOf("Copie des feuilles de style")
        );
    });
});
