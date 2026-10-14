import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import {
    PRESENTATION_INTERNAL_RULES_MAX_LENGTH,
    PRESENTATION_INTERNAL_RULES_TEMPLATE,
    isInternalRulesEmpty,
} from "@/lib/presentation-rules";

/**
 * Présentation guilde — règlement intérieur (demande user : « pouvoir écrire un
 * règlement, y mettre des emoji, markdown possible, très intuitif pour les non
 * initiés, invisible côté rendu public, juste en interne »).
 *
 * 🛡️ Ce que ce test verrouille :
 * ① la règle pure (modèle en 8 sections Dofus, borne, détection de vide) ;
 * ② le cloisonnement public (le public reçoit `null`, la vue publique ne connaît
 *    même pas le champ) et le rendu interne (guild-hub + page dashboard) ;
 * ③ l'édition intuitive (TipTap WYSIWYG avec emoji + collage Markdown intégrés,
 *    modèle pré-rempli, bouton de réinsertion, 6 étapes).
 * Lecture seule (fichiers + lib pure), aucune base.
 */

const ACTIONS = "src/server/actions/presentation-actions.ts";
const FORM = "src/app/dashboard/[guildId]/admin/presentation/_components/presentation-form.tsx";
const INTERNAL = "src/app/dashboard/[guildId]/guild-hub/_components/presentation-content.tsx";
const LEGACY = "src/app/dashboard/[guildId]/presentation/page.tsx";
const PUBLIC_VIEW = "src/app/guilds/[guildId]/_components/guild-public-view.tsx";
const SCHEMA = "prisma/schema.prisma";
const MIGRATION =
    "prisma/migrations/20270106000000_add_presentation_internal_rules/migration.sql";

const read = (p: string) => readFileSync(p, "utf8");

describe("règlement intérieur — règle pure", () => {
    it("borne à 20 000 caractères HTML", () => {
        expect(PRESENTATION_INTERNAL_RULES_MAX_LENGTH).toBe(20_000);
    });

    it("modèle : 8 sections Dofus, sans donnée de guilde en dur", () => {
        const sections = [
            "Esprit de la guilde",
            "Recrutement",
            "Activité et absences",
            "Sorties",
            "Mules",
            "Discord",
            "Artisanat",
            "Manquements",
        ];
        for (const s of sections) expect(PRESENTATION_INTERNAL_RULES_TEMPLATE).toContain(s);
        // Le modèle tient dans la borne, avec marge pour les retouches.
        expect(PRESENTATION_INTERNAL_RULES_TEMPLATE.length).toBeLessThan(
            PRESENTATION_INTERNAL_RULES_MAX_LENGTH
        );
        expect(isInternalRulesEmpty(PRESENTATION_INTERNAL_RULES_TEMPLATE)).toBe(false);
    });

    it("modèle : que du HTML d'éditeur (h2/p/ul/li), jamais de script", () => {
        expect(PRESENTATION_INTERNAL_RULES_TEMPLATE).not.toMatch(/<script/i);
        expect(PRESENTATION_INTERNAL_RULES_TEMPLATE).toMatch(/<h2>/);
        expect(PRESENTATION_INTERNAL_RULES_TEMPLATE).toMatch(/<ul>/);
    });

    it("détecte le vide (null, texte blanc, balises vides)", () => {
        expect(isInternalRulesEmpty(null)).toBe(true);
        expect(isInternalRulesEmpty(undefined)).toBe(true);
        expect(isInternalRulesEmpty("")).toBe(true);
        expect(isInternalRulesEmpty("   ")).toBe(true);
        expect(isInternalRulesEmpty("<p></p>")).toBe(true);
        expect(isInternalRulesEmpty("<p> &nbsp; </p>")).toBe(true);
        expect(isInternalRulesEmpty("<p>Bonjour</p>")).toBe(false);
    });
});

describe("règlement intérieur — cloisonnement public", () => {
    it("migration additive : colonne nullable, sans réécriture", () => {
        expect(existsSync(MIGRATION)).toBe(true);
        const sql = read(MIGRATION);
        expect(sql).toContain("presentationInternalRules");
        expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS/i);
    });

    it("schéma : champ nullable sur GuildConfig", () => {
        expect(read(SCHEMA)).toMatch(/presentationInternalRules\s+String\?/);
    });

    it("serveur : le public reçoit `null` (ni page, ni payload)", () => {
        const src = read(ACTIONS);
        expect(src).toContain("presentationInternalRules: true");
        expect(src).toContain("internalRules: checkEnabled ? null");
    });

    it("serveur : écriture assainie en HTML riche borné, jamais en strict", () => {
        const src = read(ACTIONS);
        expect(src).toContain("PRESENTATION_INTERNAL_RULES_MAX_LENGTH");
        expect(src).toContain("presentationInternalRules: sanitizedRules");
    });

    it("vue publique : ne connaît même pas le champ", () => {
        expect(read(PUBLIC_VIEW)).not.toContain("internalRules");
    });

    it("rendu interne : guild-hub affiche le règlement assaini + mention interne", () => {
        const src = read(INTERNAL);
        expect(src).toContain("guild.internalRules");
        expect(src).toContain("DocContent");
        expect(src).toContain("Invisible de l");
    });

    it("rendu interne : la page dashboard affiche aussi le règlement (édition seule si vide)", () => {
        const src = read(LEGACY);
        expect(src).toContain("guild.internalRules");
        expect(src).toContain("DocContent");
    });
});

describe("règlement intérieur — édition intuitive", () => {
    it("formulaire : étape Règlement dédiée (6 étapes, badge interne)", () => {
        const src = read(FORM);
        expect(src).toContain('{ id: "rules", label: "Règlement"');
        expect(src).toContain("Étape 4 sur 6 · Règlement");
    });

    it("formulaire : éditeur visuel (gras/listes/emoji/collage Markdown intégrés)", () => {
        const src = read(FORM);
        expect(src).toContain("AdvancedEditor");
        expect(src).toContain('key={`reglement-${rulesEditorKey}`}');
    });

    it("formulaire : pré-rempli du modèle + réinsertion en un clic + compteur borné", () => {
        const src = read(FORM);
        expect(src).toContain("PRESENTATION_INTERNAL_RULES_TEMPLATE");
        expect(src).toContain("Réinsérer le modèle");
        expect(src).toContain("PRESENTATION_INTERNAL_RULES_MAX_LENGTH");
    });

    it("formulaire : le règlement part à la sauvegarde et salit la garde anti-oubli", () => {
        const src = read(FORM);
        expect(src).toContain("internalRules: internalRules.trim()");
        expect(src).toContain("history, internalRules, activities");
    });
});
