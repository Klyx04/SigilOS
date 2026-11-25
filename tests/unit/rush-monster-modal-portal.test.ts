import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Fiche monstre du guide — couche d'affichage.
 *
 * Mesure du 25/11/2026 : ouverte depuis un tag de combat, la fiche restait **sous** les
 * cartes de quêtes et l'aside. Le tag vit dans une carte avec `transform`/stacking
 * context : un `position: fixed` posé dedans reste relatif à cet ancêtre. La fiche est
 * désormais portée dans le `<body>` du document propriétaire (page hôte ou PiP).
 */

const MODAL = "src/components/dofus-quests/rush/RushMonsterFicheModal.tsx";
const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("fiche monstre — portail et clavier", () => {
    it("porte la fiche dans le body du document propriétaire", () => {
        const code = read(MODAL);
        expect(code).toContain('import { createPortal } from "react-dom"');
        expect(code).toContain("markerRef.current?.ownerDocument");
        expect(code).toContain("setHost(doc.body)");
        expect(code).toContain("createPortal(");
    });

    it("Échap écoute le document de la PiP, pas seulement `window`", () => {
        const code = read(MODAL);
        expect(code).toContain("host?.ownerDocument ?? document");
        expect(code).toContain("doc.addEventListener(\"keydown\", onKey)");
        expect(code).not.toContain('window.addEventListener("keydown", onKey)');
    });
});
