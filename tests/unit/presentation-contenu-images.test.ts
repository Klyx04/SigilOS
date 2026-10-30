/**
 * Contenu riche — **images contrôlées** (régression du 30/10/2026).
 *
 * Constat : sur `/dashboard/<guild>/admin/presentation`, l'éditeur Markdown acceptait un
 * import d'image hors pipeline — URL libre saisie dans la boîte de dialogue, collage base64
 * ou HTML contenant une image distante. Le règlement était ensuite enregistré tel quel
 * (`sanitizeHtml` non strict) : le navigateur chargeait une ressource non contrôlée
 * (traçage, hotlink, base64 hors quota).
 *
 * Règle : une image n'a de légitimité que si son `src` est un **chemin interne rendu par un
 * de nos uploads** (`/uploads/…`, `/images/…`, `/assets/…`, `/game-data/…`). Le règlement,
 * lui, n'a **aucun** pipeline d'image : le serveur retire la balise, quoi qu'envoie le client.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

import { isControlledImageSrc } from "@/lib/content-images";
import { sanitizeInternalRules } from "@/lib/presentation-rules";

const EDITOR = "src/components/editor/advanced-editor.tsx";
const SLASH = "src/components/editor/extensions/slash-command.tsx";
const FORM = "src/app/dashboard/[guildId]/admin/presentation/_components/presentation-form.tsx";
const ACTIONS = "src/server/actions/presentation-actions.ts";

/** Retire les commentaires : on verrouille le **code**, pas la prose. */
function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const code = (path: string) => codeOnly(readFileSync(path, "utf8"));

describe("isControlledImageSrc — seules les images rendues par un upload passent", () => {
    it.each([
        "/uploads/docs/abc.webp",
        "/uploads/guides/abc.webp",
        "/uploads/guilds/guild/proofs/abc.webp",
        "/images/guides/elevage/mounts/1.webp",
        "/assets/dofus/icons/quests.png",
        "/game-data/hd_maps/1.webp",
        "  /uploads/docs/abc.webp  ",
    ])("accepte %s", (src) => {
        expect(isControlledImageSrc(src)).toBe(true);
    });

    it.each([
        ["URL externe", "https://exemple.test/pixel.gif"],
        ["HTTP", "http://exemple.test/pixel.gif"],
        ["protocol-relative", "//exemple.test/pixel.gif"],
        ["base64", "data:image/png;base64,iVBORw0KGgo="],
        ["data SVG", "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="],
        ["javascript", "javascript:alert(1)"],
        ["blob", "blob:https://exemple.test/uuid"],
        ["chemin nu", "uploads/docs/abc.webp"],
        ["vide", ""],
        ["absente", null],
        ["non textuelle", 42],
    ])("refuse %s", (_label, src) => {
        expect(isControlledImageSrc(src)).toBe(false);
    });
});

describe("règlement intérieur — aucune image, même si le client en envoie", () => {
    it("retire une image distante et une image base64", () => {
        const html = [
            "<h2>Règles</h2>",
            '<p>Bonjour <img src="https://exemple.test/pixel.gif" alt="x"> monde</p>',
            '<p><img src="data:image/png;base64,iVBORw0KGgo="></p>',
        ].join("");
        const sanitized = sanitizeInternalRules(html) ?? "";
        expect(sanitized).not.toContain("<img");
        expect(sanitized).not.toContain("exemple.test");
        expect(sanitized).toContain("<h2>Règles</h2>");
        expect(sanitized).toContain("Bonjour");
    });

    it("conserve la mise en forme et les liens", () => {
        const sanitized = sanitizeInternalRules(
            '<h3>Section</h3><ul><li><strong>Fort</strong></li></ul><p><a href="https://dofus.com">Dofus</a></p>'
        ) ?? "";
        expect(sanitized).toContain("<h3>Section</h3>");
        expect(sanitized).toContain("<strong>Fort</strong>");
        expect(sanitized).toContain('href="https://dofus.com"');
    });

    it("borne le HTML à 20 000 caractères", () => {
        // La troncature porte sur l'entrée ; DOMPurify referme ensuite les balises
        // ouvertes (quelques octets), d'où la marge.
        const sanitized = sanitizeInternalRules(`<p>${"a".repeat(25_000)}</p>`) ?? "";
        expect(sanitized.length).toBeLessThanOrEqual(20_100);
        expect(sanitized.length).toBeGreaterThan(19_000);
    });

    it("une valeur absente reste absente", () => {
        expect(sanitizeInternalRules(null)).toBeNull();
        expect(sanitizeInternalRules(undefined)).toBeNull();
        expect(sanitizeInternalRules("")).toBeNull();
    });
});

describe("câblage — l'éditeur ne peut plus importer une image hors contrôle", () => {
    const editor = code(EDITOR);

    it("le nœud image refuse le base64", () => {
        expect(editor).toContain("allowBase64: false");
        expect(editor).not.toContain("allowBase64: true");
    });

    it("l'URL libre est validée par la règle partagée", () => {
        expect(editor).toContain("isControlledImageSrc(url)");
        expect(editor).toContain('import { isControlledImageSrc } from "@/lib/content-images"');
    });

    it("le collage HTML retire les images non contrôlées", () => {
        expect(editor).toContain("transformPastedHTML");
        expect(editor).toContain('querySelectorAll("img")');
    });

    it("les images peuvent être coupées pour un contenu sans pipeline d'upload", () => {
        expect(editor).toContain("enableImages = true");
        expect(editor).toContain("if (!enableImages) return false;");
        expect(code(SLASH)).toContain('item.id !== "image"');
    });

    it("le règlement de guilde désactive les images et le serveur les retire", () => {
        expect(code(FORM)).toContain("enableImages={false}");
        expect(code(ACTIONS)).toContain("sanitizeInternalRules(data.internalRules)");
        expect(code(ACTIONS)).not.toContain("sanitizeHtml(data.internalRules");
    });
});
