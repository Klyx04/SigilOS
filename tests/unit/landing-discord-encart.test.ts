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

/** Nombre de phrases dans `nav.discordCard.benefits` d'une locale. */
function benefitCount(locale: "fr" | "en"): number {
    const code = read(`src/lib/i18n/locales/${locale}.ts`);
    const cardStart = code.indexOf("discordCard: {");
    expect(cardStart, `nav.discordCard manque en ${locale}`).toBeGreaterThan(-1);
    const listStart = code.indexOf("[", code.indexOf("benefits: [", cardStart));
    const listEnd = code.indexOf("],", listStart);
    // On compte les guillemets, pas les virgules : les phrases en contiennent (« … Dofus, dès … »).
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
        expect(icons).toBeGreaterThanOrEqual(3);
        expect(benefitCount("fr")).toBe(icons);
        expect(benefitCount("en")).toBe(icons);
    });
});
