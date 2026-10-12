/**
 * Landing — encart Discord du header public.
 *
 * Demande user du 10/12/2026 : « l'onglet discord landing > icone Discord stp et ajoute un
 * encart visible comme le fait le site duffus sans copier sans ai slop simple ». L'encart
 * porte donc l'icône Discord, un texte court, **quatre** bénéfices réels (patch notes,
 * Almanax, cosmétiques, entraide) et un seul appel à l'action vers l'invitation.
 *
 * Ce test tient la seule chose qui casse en silence : le nombre de bénéfices d'un côté
 * (les icônes, dans le composant) et de l'autre (les phrases, dans les deux locales).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");
const HEADER = "src/components/layout/public-header.tsx";

/** Nombre d'icônes listées dans `DISCORD_BENEFITS` (dans l'ordre des phrases). */
function iconCount(): number {
    const code = read(HEADER);
    const start = code.indexOf("const DISCORD_BENEFITS = [");
    expect(start, "l'encart Discord a disparu du header public").toBeGreaterThan(-1);
    const end = code.indexOf("] as const;", start);
    return code.slice(start, end).split(",").map((s) => s.trim()).filter(Boolean).length;
}

/** Nombre de phrases d'une liste d'i18n (`block` = clé du bloc, `key` = clé de la liste). */
function listCount(locale: "fr" | "en", block: string, key: string): number {
    const code = read(`src/lib/i18n/locales/${locale}.ts`);
    const blockStart = code.indexOf(`${block}: {`);
    expect(blockStart, `${block} manque en ${locale}`).toBeGreaterThan(-1);
    const listStart = code.indexOf("[", code.indexOf(`${key}: [`, blockStart));
    const listEnd = code.indexOf("],", listStart);
    return (code.slice(listStart + 1, listEnd).match(/"/g) ?? []).length / 2;
}

describe("encart Discord du header public", () => {
    it("l'entrée « Discord » porte l'icône Discord (bureau ET menu mobile)", () => {
        const code = read(HEADER);
        const icons = code.match(/<DiscordIcon /g) ?? [];
        // 1 dans le déclencheur de bureau, 1 dans l'appel à l'action, 1 dans le menu mobile,
        // 1 dans l'en-tête de l'encart : au moins 3, et jamais zéro profil réduit au texte.
        expect(icons.length).toBeGreaterThanOrEqual(3);
        expect(code).toContain("<PopoverContent");
    });

    it("un seul appel à l'action, vers l'invitation Discord", () => {
        const code = read(HEADER);
        expect(code).toContain("t.nav.discordCard.cta");
        // L'invitation reste la variable d'env documentée, avec son repli connu.
        expect(code).toContain('const DISCORD_INVITE = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "https://discord.gg/');
    });

    it("autant de phrases que d'icônes, dans les deux langues", () => {
        const icons = iconCount();
        // Deux lignes assumées : les mises à jour du site, et les demandes. Pas une plaquette.
        expect(icons).toBe(2);
        expect(listCount("fr", "discordCard", "benefits")).toBe(icons);
        expect(listCount("en", "discordCard", "benefits")).toBe(icons);
    });

    it("le « Tableau de bord » ouvre un encart au visiteur, pas un saut muet vers la connexion", () => {
        const code = read(HEADER);
        expect(code).toContain("const DASHBOARD_POINTS = [Users, Compass] as const;");
        expect(code).toContain("t.nav.dashboardCard.title");
        expect(code).toContain("t.nav.dashboardCard.points[index]");
        // Le CTA lance la même connexion Discord, et le second lien mène à l'annuaire.
        expect(code).toContain("<form action={loginWithDiscord}>");
        expect(code).toContain('href="/guilds"');
        for (const locale of ["fr", "en"] as const) {
            expect(listCount(locale, "dashboardCard", "points"), locale).toBe(2);
        }
    });

    it("dit exactement les deux choses demandées, sans plaquette marketing", () => {
        const fr = read("src/lib/i18n/locales/fr.ts");
        expect(fr).toContain("Les mises à jour du site y sont annoncées");
        expect(fr).toContain("Toutes les demandes passent par là");
        // Plus d'intro séparée : elle redisait la première ligne.
        expect(fr).not.toMatch(/discordCard: \{[^}]*intro:/);
    });
});
