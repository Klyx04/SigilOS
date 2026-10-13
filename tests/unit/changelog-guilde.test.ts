/**
 * Changelog — page guilde interne + fin des liens morts (refonte).
 *
 * Verrouille : la page `/dashboard/[guildId]/changelog` (gate membre, brouillons
 * exclus, rendu réel), le recâblage des 4 liens `/changelog` morts, la suppression
 * du widget orphelin, et des embeds Discord qui pointent vers de vraies pages.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
    CHANGELOG_CATEGORY_LABELS,
    CHANGELOG_CATEGORY_ORDER,
    CHANGELOG_CATEGORY_EMOJI,
    CHANGELOG_CATEGORY_COLORS,
    changelogCategoryLabel,
} from "@/lib/changelog-meta";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
const exists = (p: string) => existsSync(join(root, p));
const codeOnly = (source: string) =>
    source
        .split("\n")
        .filter((line) => {
            const t = line.trim();
            return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
        })
        .join("\n");

describe("changelog-meta — référentiel unique", () => {
    it("nomme les 5 catégories en français, sans emoji", () => {
        expect(CHANGELOG_CATEGORY_LABELS).toEqual({
            FEATURE: "Fonctionnalité",
            BUGFIX: "Correction",
            SECURITY: "Sécurité",
            PERFORMANCE: "Performance",
            DOCUMENTATION: "Documentation",
        });
        for (const label of Object.values(CHANGELOG_CATEGORY_LABELS)) {
            expect(label).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
        }
    });

    it("ordonne, illustre et colore les 5 catégories (Discord)", () => {
        expect(CHANGELOG_CATEGORY_ORDER).toHaveLength(5);
        for (const cat of CHANGELOG_CATEGORY_ORDER) {
            expect(CHANGELOG_CATEGORY_EMOJI[cat].length).toBeGreaterThan(0);
            expect(CHANGELOG_CATEGORY_COLORS[cat]).toBeGreaterThan(0);
        }
    });

    it("replie l'inconnu sur son code, jamais sur du vide", () => {
        expect(changelogCategoryLabel("FEATURE")).toBe("Fonctionnalité");
        expect(changelogCategoryLabel("BIDULE")).toBe("BIDULE");
        expect(changelogCategoryLabel(null)).toBe("Mise à jour");
    });
});

describe("changelog — page guilde interne", () => {
    const PAGE = "src/app/dashboard/[guildId]/changelog/page.tsx";

    it("existe, verrouillée aux membres (fail-closed)", () => {
        expect(exists(PAGE)).toBe(true);
        const code = read(PAGE);
        expect(code).toContain("getUserContext(guildId)");
        expect(code).toContain("AccessDenied");
        expect(code).toContain("isMember");
    });

    it("ne lit que les entrées publiques et rend le contenu réel", () => {
        const code = read(PAGE);
        expect(code).toContain("getChangelogEntries(undefined, true");
        expect(code).toContain("ChangelogContent");
        expect(code).toContain("UnifiedModuleHeader");
    });
});

describe("changelog — fin des liens morts", () => {
    it("sidebar, pied de sidebar et palette pointent vers la page guilde", () => {
        for (const file of [
            "src/components/layout/app-sidebar.tsx",
            "src/components/layout/command-menu.tsx",
        ]) {
            const code = read(file);
            expect(code, file).toContain("/dashboard/${guildId}/changelog");
        }
    });

    it("aucun href mort /changelog ne subsiste dans le code", () => {
        for (const file of [
            "src/components/layout/app-sidebar.tsx",
            "src/components/layout/command-menu.tsx",
            "src/server/actions/changelog-actions.ts",
            "src/lib/public-routes.ts",
        ]) {
            const code = codeOnly(read(file));
            expect(code, `${file} : href mort`).not.toContain('href="/changelog"');
            expect(code, `${file} : href mort`).not.toContain("href={`/changelog`}");
            expect(code, `${file} : URL morte`).not.toContain("appUrl}/changelog");
            expect(code, `${file} : revalidation morte`).not.toContain("revalidatePath('/changelog')");
        }
    });

    it("le widget orphelin a disparu (zéro import, page morte)", () => {
        expect(exists("src/components/changelog/changelog-widget.tsx")).toBe(false);
    });

    it("le broadcast lie chaque guilde à SA page, le hub ne promet plus de lien", () => {
        const code = read("src/server/actions/changelog-actions.ts");
        expect(code).toContain("dashboard/${guild.discordGuildId}/changelog");
    });
});

describe("changelog — page God sans slop", () => {
    const PAGE = "src/app/god/changelog/page.tsx";

    it("type ses entrées et partage les libellés (plus de any, plus de doublon)", () => {
        const code = read(PAGE);
        expect(code).not.toContain("useState<any");
        expect(code).not.toContain("entry: any");
        expect(code).toContain("CHANGELOG_CATEGORY_LABELS");
        expect(code).not.toContain("'Fonctionnalité'");
    });

    it("offre une recherche et des actions visibles au tactile", () => {
        const code = read(PAGE);
        expect(code).toContain("Version, titre");
        expect(code).toContain("md:group-hover:opacity-100");
    });
});
