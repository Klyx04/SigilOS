import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { allGuides, getGuideBySlug, getGuideContent, getPublishedGuides } from "@/content/guides";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@/lib/i18n/types";

/**
 * Gardes de traduction : le site est bilingue FR/EN, mais le vocabulaire Dofus
 * doit rester celui du client anglais (cf. src/content/guides/GLOSSARY-EN.md).
 * Ces tests empêchent qu'une fiche repasse en français en silence.
 */

const REPO_ROOT = path.resolve(__dirname, "../..");

/** Mots-outils français qui ne doivent jamais fuiter dans une fiche anglaise. */
const FRENCH_MARKERS =
    /\b(le|la|les|des|une|pour|avec|dans|vous|votre|aux|du|chaque|plusieurs|niveau|sans|est|sur)\b/i;

/** Le balisage technique (chemins d'images FR, classes) n'est pas du texte traduit. */
function stripMarkup(html: string): string {
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
}

function countTags(html: string, tag: string): number {
    return (html.match(new RegExp(`<${tag}[\\s>/]`, "g")) ?? []).length;
}

function readSource(relativePath: string): string {
    return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

describe("guides — parité FR/EN du registre", () => {
    it("expose le même registre publié dans les deux langues", () => {
        expect(allGuides.length).toBeGreaterThan(0);
        expect(getPublishedGuides("en")).toHaveLength(getPublishedGuides("fr").length);
        expect(SUPPORTED_LOCALES).toContain("en");
        expect(DEFAULT_LOCALE).toBe("fr");
    });

    it("traduit réellement les métadonnées de chaque fiche", () => {
        for (const fr of allGuides) {
            const en = getGuideBySlug(fr.slug, "en");

            expect(en, fr.slug).not.toBeNull();
            expect(en!.title, fr.slug).not.toBe(fr.title);
            expect(en!.description, fr.slug).not.toBe(fr.description);
            expect(en!.category, fr.slug).not.toBe(fr.category);
            // Les dates et l'état de publication sont, eux, partagés.
            expect(en!.publishedAt).toBe(fr.publishedAt);
            expect(en!.updatedAt).toBe(fr.updatedAt);
            expect(en!.draft).toBe(fr.draft);
        }
    });

    it("fournit un corps HTML anglais sans mot-outil français", async () => {
        for (const guide of allGuides) {
            const en = await getGuideContent(guide.slug, "en");

            expect(en, guide.slug).not.toBeNull();
            expect(en!.body.length, guide.slug).toBeGreaterThan(500);
            expect(stripMarkup(en!.body), guide.slug).not.toMatch(FRENCH_MARKERS);
        }
    });

    it("ne perd aucune section entre le FR et l'EN", async () => {
        const structuralTags = ["h2", "h3", "table", "thead", "tbody", "tr", "th", "td", "ul", "ol", "li", "img", "p", "strong", "em", "code", "pre", "hr", "a"];

        for (const guide of allGuides) {
            const [fr, en] = await Promise.all([
                getGuideContent(guide.slug, "fr"),
                getGuideContent(guide.slug, "en"),
            ]);

            for (const tag of structuralTags) {
                expect(countTags(en!.body, tag), `${guide.slug} <${tag}>`).toBe(countTags(fr!.body, tag));
            }
        }
    });

    it("retombe sur le français quand aucune locale n'est demandée", async () => {
        const fr = await getGuideContent("guide-brisage-rentabilite-runes");

        expect(fr?.title).toContain("Brisage");
        expect(getGuideBySlug("guide-inexistant", "en")).toBeNull();
        expect(await getGuideContent("guide-inexistant", "en")).toBeNull();
    });

    it("utilise le vocabulaire officiel du client anglais dans les métadonnées EN", () => {
        const runes = getGuideBySlug("poids-runes-forgemagie-dofus", "en");
        const elevage = getGuideBySlug("guide-elevage-enclos-guilde-dofus", "en");
        const brisage = getGuideBySlug("guide-brisage-rentabilite-runes", "en");

        expect(runes?.category).toBe("Smithmagic");
        expect(elevage?.title).toContain("Breeder");
        expect(brisage?.description.toLowerCase()).toContain("crushing");
    });
});

describe("journal — traductions EN côté base", () => {
    it("déclare les colonnes de traduction et le repli FR", () => {
        const schema = readSource("prisma/schema.prisma");
        const migration = readSource("prisma/migrations/20260919120000_add_changelog_translations/migration.sql");
        const actions = readSource("src/server/actions/changelog-actions.ts");

        for (const column of ["titleEn", "summaryEn", "contentEn"]) {
            expect(schema, "schema.prisma").toContain(column);
            expect(migration, "migration.sql").toContain(`"${column}"`);
            expect(actions, "changelog-actions.ts").toContain(column);
        }

        // Repli : une traduction absente affiche le texte source, jamais du vide.
        expect(actions).toContain("localizeChangelogEntry");
        expect(actions).toContain("entry.titleEn?.trim() || entry.title");
    });

    it("branche la locale sur la page publique et la modale", () => {
        expect(readSource("src/app/changelog/page.tsx")).toContain("getChangelogEntries(undefined, !session, locale)");
        expect(readSource("src/server/actions/changelog-actions.ts")).toContain("getLatestChangelogEntry(await getServerLocale())");
        expect(readSource("src/app/god/changelog/page.tsx")).toContain("titleEn");
        expect(readSource("scripts/backfill-changelog-en.mjs")).toContain('COALESCE("titleEn"');
    });
});

describe("almanax — zaap du Sanctuaire", () => {
    it("nomme le bon zaap (Plaine des Porkass / Lousy Pig Plain)", () => {
        const page = readSource("src/app/almanax/page.tsx");

        expect(page).toContain("Zaap Plaine des Porkass");
        expect(page).toContain("Lousy Pig Plain Zaap");
        expect(page).not.toContain("Scarafly");
        expect(page).not.toContain("Zaap Plaine des Scarafeuilles");
    });
});
