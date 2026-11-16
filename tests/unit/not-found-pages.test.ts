/**
 * 404 personnalisées — **verrou d'existence et de contenu**.
 *
 * Le dépôt n'a pas d'outillage HTTP : le statut 404 se prouve par `curl` sur une instance
 * lancée (`/cette-page-n-existe-pas`, `/dashboard/<id>/inconnu`, `/espace-visiteur/inconnu`).
 * Ici on verrouille ce qui ne doit pas régresser silencieusement : les trois écrans existent,
 * la 404 publique est chartée et noindex, le dashboard ne réaffiche jamais le chemin brut,
 * et `/god` reste sans écran dédié (404 vide du proxy).
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const PUBLIC = "src/app/not-found.tsx";
const DASHBOARD = "src/app/dashboard/[guildId]/not-found.tsx";
const VISITOR = "src/app/espace-visiteur/not-found.tsx";

describe("pages 404 personnalisées", () => {
    it("les trois écrans existent aux trois endroits attendus", () => {
        for (const file of [PUBLIC, DASHBOARD, VISITOR]) {
            expect(fs.existsSync(path.join(ROOT, file)), `${file} manquant`).toBe(true);
        }
    });

    it("la 404 publique est chartée (chrome de la landing) et noindex", () => {
        const src = read(PUBLIC);
        expect(src).toContain("PublicHeader");
        expect(src).toContain("GalacticFooter");
        expect(src).toMatch(/robots:\s*\{\s*index:\s*false/);
        expect(src).toContain("logNotFound");
        expect(src).toContain("<h1");
    });

    it("la 404 publique ne réaffiche jamais le chemin demandé", () => {
        const src = read(PUBLIC);
        expect(src).not.toContain("x-pathname");
        expect(src).not.toContain("searchParams");
    });

    it("la 404 du dashboard borne le guildId et ne rend jamais le chemin brut", () => {
        const src = read(DASHBOARD);
        expect(src).toContain("/^\\/dashboard\\/(\\d{17,20})(?:\\/|$)/");
        expect(src).toContain("x-pathname");
        expect(src).not.toMatch(/\{pathname\}/);
        expect(src).toContain("logNotFound");
    });

    it("la 404 visiteur reste dans l'espace (retour utile) et journalise", () => {
        const src = read(VISITOR);
        expect(src).toContain("/espace-visiteur/general");
        expect(src).toContain("logNotFound");
    });

    it("aucun écran 404 n'est ajouté dans /god (le proxy garde le 404 vide)", () => {
        expect(fs.existsSync(path.join(ROOT, "src/app/god/not-found.tsx"))).toBe(false);
        expect(fs.existsSync(path.join(ROOT, "src/app/god-files/not-found.tsx"))).toBe(false);
    });

    it("aucune 404 personnalisée sous /api (les routes rendent leur propre JSON)", () => {
        expect(fs.existsSync(path.join(ROOT, "src/app/api/not-found.tsx"))).toBe(false);
    });
});
