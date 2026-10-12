/**
 * Documentation — le slug se **déduit** du titre, personne ne le gère.
 *
 * Demandes user du 10/12/2026 : « je ne veux pas avoir à gérer des slug ou je ne sais quoi dans
 * la doc » et « on sépare bien doc dispo pour le staff ou non via la bonne rbac je crois ? à
 * revérifier ».
 *
 * Mesure du RBAC (lecture seule de `doc-actions.ts`) : la séparation staff/public **est** bien
 * dans le RBAC, pas dans le slug — `getDocBySlug` refuse `!isPublished`, exige super-admin ou
 * `canViewAdminDocs` pour `ADMIN`, une session authentifiée pour `MEMBER`, et filtre la guilde ;
 * `getAllDocs` ne montre à un visiteur que `PUBLIC`. Le seul défaut était le **libellé** de
 * `isPublished`, affiché « Visibilité publique » (d'où la contradiction apparente avec un niveau
 * d'accès « Administration »).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { docSlugFromTitle, docSlugOrFallback } from "@/lib/doc-slug";

const read = (p: string) => readFileSync(p, "utf8");
const EDITOR = "src/app/god/docs/_components/doc-editor.tsx";
const ACTIONS = "src/server/actions/doc-actions.ts";

describe("slug de documentation — déduit du titre", () => {
    it("normalise un vrai titre (accents, « & », majuscules)", () => {
        expect(docSlugFromTitle("Audit Technique & Gestion des Membres"))
            .toBe("audit-technique-gestion-des-membres");
        expect(docSlugFromTitle("Quête de l'Ocre")).toBe("quete-de-l-ocre");
        expect(docSlugFromTitle("  Espaces   en trop  ")).toBe("espaces-en-trop");
    });

    it("ne produit jamais un slug vide ni un tiret orphelin", () => {
        expect(docSlugOrFallback("!!! ??? ...")).toBe("documentation");
        const long = docSlugFromTitle("Mot ".repeat(40));
        expect(long.length).toBeLessThanOrEqual(80);
        expect(long.endsWith("-")).toBe(false);
        expect(long).toMatch(/^[a-z0-9-]+$/);
    });
});

describe("le God ne demande plus de slug", () => {
    it("l'éditeur affiche l'adresse au lieu de la faire saisir", () => {
        const editor = read(EDITOR);
        expect(editor).not.toContain('handleChange("slug"');
        expect(editor).toContain("Déduit du titre");
        expect(editor).toContain("docSlugFromTitle(formData.title)");
    });

    it("le serveur dédoublonne les titres au lieu de refuser la création", () => {
        const actions = read(ACTIONS);
        expect(actions).toContain("docSlugOrFallback");
        // Le message d'échec ne doit plus exister en tant que CODE (le commentaire qui l'explique, si).
        expect(actions).not.toContain('error: "Slug already exists"');
        expect(actions).toContain("while (await db.docPage.findUnique({ where: { slug }");
    });

    it("la bascule dit « publiée », plus « visibilité publique » (la visibilité = le RBAC)", () => {
        const editor = read(EDITOR);
        expect(editor).not.toContain("Visibilité publique");
        expect(editor).toContain(">Publiée<");
    });
});

describe("import d'une page HTML déjà mise en forme", () => {
    it("l'éditeur accepte un fichier .html et n'en garde que le corps", () => {
        const editor = read(EDITOR);
        expect(editor).toContain('accept=".html,.htm,text/html"');
        expect(editor).toContain("new DOMParser()");
        expect(editor).toContain('querySelectorAll("script, style, link, meta")');
        expect(editor).toContain("parsed.body?.innerHTML");
    });

    it("le HTML importé est assaini deux fois (serveur ET rendu)", () => {
        expect(read(ACTIONS)).toContain("sanitizeHtml(data.content, 5000000, false)");
        expect(read("src/components/doc/doc-content.tsx")).toContain("sanitizeHtml(content)");
    });
});
