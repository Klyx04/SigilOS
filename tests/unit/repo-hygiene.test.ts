import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * Garde d'hygiène de l'arborescence.
 *
 * Contexte : `src/components/dofus-quests/aide-module` était un fichier texte
 * (notes brutes + ID Discord) commité au milieu des composants React, sans
 * extension et sans être importé. Il a fallu un audit pour le trouver.
 *
 * Cette garde échoue si un fichier suivi par git dans `src/` n'a pas
 * d'extension : un composant, un module ou une page doit toujours en avoir une
 * (`.ts`, `.tsx`, `.css`, ...). Un fichier de notes n'a rien à faire dans
 * `src/`.
 *
 * Référence : AGENTS.md §1 et §5.11 (dépôt public, zéro empreinte).
 */
describe("hygiène de l'arborescence", () => {
    it("n'autorise aucun fichier sans extension dans src/", () => {
        const output = execFileSync("git", ["ls-files", "-z", "src"], {
            encoding: "utf8",
        });

        const files = output.split("\0").filter(Boolean);
        const sansExtension = files.filter((file) => path.extname(file) === "");

        expect(sansExtension).toEqual([]);
    });
});
