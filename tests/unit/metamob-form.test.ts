import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { publicMetamobSchema } from "@/lib/public-profile-input";

const FORM = readFileSync("src/app/espace-visiteur/_components/metamob-form.tsx", "utf8");
const stripComments = (code: string) =>
    code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("Formulaire Metamob — fiche liée et déliement", () => {
    it("une fois la clé liée, propose vérifier / remplacer / délier au lieu du champ", () => {
        const form = stripComments(FORM);
        expect(form).toContain("Ton compte Metamob est lié");
        expect(form).toContain("Remplacer la clé");
        expect(form).toContain("Délier mon compte");
        expect(form).toContain('setMode("form")');
        expect(form).toContain('setMode("unlink")');
    });

    it("le déliement utilise l'action existante avec des chaînes vides", () => {
        const form = stripComments(FORM);
        expect(form).toContain('updatePublicMetamob({ metamobPseudo: "", apiKey: "" })');
        expect(form).toContain("Confirmer le déliement");
        // La clé n'est jamais lue ni affichée par le formulaire.
        expect(form).not.toContain("metamobApiKey");
    });

    it("le schéma accepte un déliement (pseudo et clé vides)", () => {
        expect(publicMetamobSchema.safeParse({ metamobPseudo: "", apiKey: "" }).success).toBe(true);
    });
});
