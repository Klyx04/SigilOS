/**
 * Espace visiteur (rang 57) — verrou de l'onglet **Métiers**.
 *
 * L'écran reprend la lecture du profil de guilde (`src/components/profile/jobs-grid.tsx`) :
 * un onglet par **catégorie** de `JOB_CATEGORIES`, une carte par métier avec l'icône réelle
 * de `DOFUS_JOBS`. Aucune liste recopiée : ajouter un métier au référentiel doit suffire.
 *
 * Différence assumée et verrouillée : pas de bouton « Gérer » (l'écran visiteur est déjà
 * en édition) ; la source reste `PublicProfession`, jamais le `Json` `metiers`.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { JOB_CATEGORIES } from "@/lib/dofus-assets";

const read = (path: string) => readFileSync(path, "utf8");

const FORM = "src/app/espace-visiteur/_components/professions-form.tsx";
const PAGE = "src/app/espace-visiteur/metiers/page.tsx";

describe("Métiers visiteur — le référentiel fait foi", () => {
    it("les quatre catégories viennent de `JOB_CATEGORIES`, pas d'une liste locale", () => {
        const form = read(FORM);

        expect(form).toContain("Object.values(JOB_CATEGORIES)");
        expect(form).not.toMatch(/\[\s*"Récolte"\s*,\s*"Artisanat"/);
        expect(Object.values(JOB_CATEGORIES)).toHaveLength(4);
    });

    it("chaque carte lit l'icône et le nom du référentiel `DOFUS_JOBS`", () => {
        const form = read(FORM);

        expect(form).toContain("DOFUS_JOBS[category].map");
        expect(form).toContain("src={job.icon}");
        expect(form).toContain("{job.name}");
        expect(form).toContain("Niv. ${levels[job.id]}");
    });

    it("l'état actif est porté par l'accent `warning`, comme le profil de guilde", () => {
        const form = read(FORM);

        expect(form).toContain("border-warning/40 bg-warning/10");
        expect(form).toContain("text-warning");
    });

    it("pas de bouton « Gérer » : l'écran visiteur est déjà en édition", () => {
        const form = read(FORM);

        // Aucun libellé « Gérer » rendu en JSX (la mention du commentaire d'en-tête ne compte pas).
        expect(form).not.toMatch(/>\s*Gérer\s*</);
        expect(form).not.toContain("JobsGrid");
        expect(form).toContain("Enregistrer mes métiers");
    });

    it("la page ne lit que la table normalisée `PublicProfession`", () => {
        const page = read(PAGE);

        expect(page).toContain("db.publicProfession.findMany");
        expect(page).not.toContain("metiers: true");
    });
});
