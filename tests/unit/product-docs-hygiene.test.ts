import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { load } from "cheerio";

/** Dossier volatile des docs produit (absent en CI : les tests de contenu sont alors sautés). */
const DOCS_DIR = join("src", "temp", "docs");

/**
 * Vocabulaire interdit dans une doc produit : elle s'adresse aux **membres et au staff d'une guilde**.
 * L'exploitation de la plateforme n'existe pas pour eux — la nommer, c'est fuiter l'outil interne.
 */
const INTERDITS: Array<{ motif: RegExp; libelle: string }> = [
    { motif: /\bgod\b/i, libelle: "mention de l'interface d'exploitation" },
    { motif: /super-?admin/i, libelle: "rôle d'exploitation" },
    { motif: /\/god\//i, libelle: "route d'exploitation" },
    { motif: /dofusdb|dofensive/i, libelle: "fournisseur interne" },
    { motif: /\bslug\b/i, libelle: "vocabulaire interne (slug)" },
    { motif: /\bprisma\b|\bmigration\b|\bDocPage\b/i, libelle: "vocabulaire interne (persistance)" },
    { motif: /code 20001|\b403\b/i, libelle: "code d'API Discord" },
];

const docsLocales = (): string[] =>
    existsSync(DOCS_DIR) ? readdirSync(DOCS_DIR).filter((f) => f.endsWith(".html")) : [];

/**
 * Garde de la **documentation produit** (boutons « Documentation » des modules).
 *
 * Règle (24/10/2026) : le contenu d'une doc produit vit en base (`DocPage`, édité via
 * God → Docs). On l'écrit **en local** dans `src/temp/docs/<slug>.html` — zone volatile
 * **jamais commitée** — et le mainteneur l'uploade lui-même. Le dépôt ne porte que le
 * **slug** et le bouton. Références : `.clinerules/04-docs.md`, `docs/agents/zone-volatile.md`.
 */
describe("documentation produit", () => {
    it("le module Commandes expose un bouton Documentation sur le slug `commandes-discord`", () => {
        const page = readFileSync("src/app/dashboard/[guildId]/admin/commandes/page.tsx", "utf8");
        expect(page).toContain("ModuleHelpActions");
        expect(page).toContain('docSlug="commandes-discord"');
    });

    it("le module Services expose un bouton Documentation sur le slug `services`", () => {
        const page = readFileSync("src/app/dashboard/[guildId]/services/page.tsx", "utf8");
        expect(page).toContain("ModuleHelpActions");
        expect(page).toContain('docSlug="services"');
    });

    it("la règle « doc produit locale, jamais commitée » est écrite dans le harnais", () => {
        const rule = readFileSync(".clinerules/04-docs.md", "utf8");
        expect(rule).toContain("src/temp/docs/");
        expect(rule).toMatch(/jamais\s+commitée/);
        const zone = readFileSync("docs/agents/zone-volatile.md", "utf8");
        expect(zone).toContain("src/temp/docs/<slug>.html");
    });

    it("la règle interdit l'exploitation dans une doc produit (espace guilde uniquement)", () => {
        const rule = readFileSync(".clinerules/04-docs.md", "utf8");
        expect(rule).toContain("espace guilde");
        expect(rule).toContain("src/app/god*");
        expect(rule).toContain("demandez l'activation au support");
        // et la forme : drawer étroit, 2 colonnes max, 44 caractères en `pre`
        expect(rule).toContain("2 colonnes maximum");
        expect(rule).toContain("44 caractères");
    });

    it("aucune doc produit locale ne parle de l'exploitation (vocabulaire des guildes only)", () => {
        const violations: string[] = [];
        for (const fichier of docsLocales()) {
            const html = readFileSync(join(DOCS_DIR, fichier), "utf8");
            for (const { motif, libelle } of INTERDITS) {
                const trouve = html.match(motif);
                if (trouve) violations.push(`${fichier} → ${libelle} : « ${trouve[0]} »`);
            }
        }
        expect(violations).toEqual([]);
    });

    it("une doc produit tient dans le drawer latéral (pre ≤ 44 car., tableau ≤ 2 colonnes)", () => {
        const violations: string[] = [];
        for (const fichier of docsLocales()) {
            const html = readFileSync(join(DOCS_DIR, fichier), "utf8");
            // Le texte **affiché** vient du parseur, jamais d'une découpe de balises par
            // expression régulière : une seule passe de `replace(/<[^>]+>/)` laisse du balisage
            // (alerte CodeQL « incomplete multi-character sanitization »).
            const $ = load(html);

            // 1. Blocs `pre` : une ligne trop longue déborde du drawer (~340 px utiles sur mobile).
            for (const bloc of $("pre").toArray()) {
                const lignes = $(bloc)
                    .text()
                    .split(/\r?\n/)
                    .map((l) => l.trimEnd());
                lignes.forEach((ligne, index) => {
                    if (ligne.length > 44) {
                        violations.push(`${fichier} → pre ligne ${index + 1} : ${ligne.length} car.`);
                    }
                });
            }

            // 2. Tableaux : au-delà de 2 colonnes, les cellules se tassent et le texte se coupe mal.
            for (const table of $("table").toArray()) {
                const colonnes = $(table).find("tr").first().find("th").length;
                if (colonnes > 2) {
                    violations.push(`${fichier} → tableau de ${colonnes} colonnes`);
                }
            }
        }
        expect(violations).toEqual([]);
    });
});
