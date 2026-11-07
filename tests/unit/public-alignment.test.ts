/**
 * Alignement du visiteur (V2a-4) — la donnée qui manquait.
 *
 * Mesure du 07/11/2026 : `PublicProfile.alignment` existait en base mais **aucune action
 * ne l'écrivait**, donc la tuile « Alignement » du guide public ne pouvait rien changer.
 * Ce fichier verrouille les trois choses qui rendent l'écriture sûre :
 *
 * 1. le schéma est **borné** (cité connue, Ordre court) ;
 * 2. le client public appelle une **action colocalisée** et n'importe toujours aucun
 *    `@/server/` (le verrou de parité reste vrai) ;
 * 3. l'Ordre est **vérifié contre la cité** côté serveur — une valeur du client n'est
 *    jamais crue sur parole.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { publicAlignmentSchema } from "@/lib/public-profile-input";

const read = (path: string) => readFileSync(path, "utf8");
const stripComments = (code: string) =>
    code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const MODAL = "src/app/guides/rush-sylvestre/_components/PublicAlignmentModal.tsx";
const CLIENT = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";
const ACTION = "src/server/actions/public-profile-actions.ts";

describe("Alignement — le schéma borne ce qui entre", () => {
    it("accepte une cité connue avec l'un de ses Ordres", () => {
        expect(publicAlignmentSchema.safeParse({ alignment: "bontarien", alignmentOrder: "vaillant" }).success).toBe(
            true
        );
        expect(publicAlignmentSchema.safeParse({ alignment: "neutre", alignmentOrder: null }).success).toBe(true);
    });

    it("refuse une cité inventée et un Ordre démesuré", () => {
        expect(publicAlignmentSchema.safeParse({ alignment: "pirate", alignmentOrder: null }).success).toBe(false);
        expect(
            publicAlignmentSchema.safeParse({ alignment: "bontarien", alignmentOrder: "x".repeat(25) }).success
        ).toBe(false);
        expect(publicAlignmentSchema.safeParse({ alignment: "bontarien" }).success).toBe(false);
    });
});

describe("Alignement — cliquable aussi SANS compte (choix local)", () => {
    it("la tuile ouvre la modale pour tout le monde", () => {
        const client = stripComments(read(CLIENT));
        expect(client).toMatch(/onClick=\{\(\) => setAlignmentOpen\(true\)\}/);
        expect(client).not.toMatch(/return visitor \? \(\s*<button[\s\S]{0,200}setAlignmentOpen/);
    });

    it("l'anonyme enregistre localement, et sa cité pilote la route", () => {
        const client = stripComments(read(CLIENT));
        expect(client).toMatch(/localOnly=\{!visitor\}/);
        expect(client).toMatch(/onLocalSave=\{handleLocalAlignment\}/);
        // Même règle que « Ma cité » : le camp local filtre la route (`resolveRushRoute`).
        expect(client).toMatch(
            /handleRouteChange\(value\.alignment === "neutre" \? null : value\.alignment\)/
        );
    });

    it("la modale n'appelle l'action serveur QUE hors mode local", () => {
        const modal = stripComments(read(MODAL));
        expect(modal).toMatch(/if \(localOnly\) \{[\s\S]{0,400}onLocalSave\?\.\(payload\)/);
        expect(modal.indexOf("if (localOnly)")).toBeLessThan(modal.indexOf("await updateMyAlignment"));
    });
});

describe("Alignement — le client reste une surface purement cliente", () => {
    it("la modale écrit par l'action colocalisée, jamais par `@/server/`", () => {
        const modal = stripComments(read(MODAL));
        expect(modal).toMatch(/from "\.\.\/_actions\/public-alignment"/);
        expect(modal).not.toMatch(/@\/server\//);
    });

    it("le guide public n'importe toujours aucun code serveur", () => {
        expect(stripComments(read(CLIENT))).not.toMatch(/@\/server\//);
    });

    it("l'action vérifie que l'Ordre appartient à la cité avant d'écrire", () => {
        const actions = stripComments(read(ACTION));
        // L'écriture est `where: { userId }` — l'identifiant vient du serveur, jamais du client.
        expect(actions).toMatch(/Cet Ordre n'appartient pas à la cité choisie\./);
        expect(actions).toMatch(/where: \{ userId: account\.userId \}/);
        expect(actions).toMatch(/revalidatePath\(RUSH_GUIDE_PATH\)/);
    });
});