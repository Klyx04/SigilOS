/**
 * `/legendaire` — **bornes des champs d'embed**.
 *
 * Discord refuse l'interaction entière dès qu'un champ dépasse 1024 caractères :
 * côté utilisateur, cela s'affiche « L'application n'a pas répondu ». Ces règles
 * sont pures, donc testées ici sans Discord.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DISCORD_FIELD_VALUE_MAX, truncate } from "@/lib/discord/embed-limits";
import { formatCrafterList } from "@/lib/discord/legendary-crafters";

const read = (path: string) => readFileSync(path, "utf8");

describe("truncate — limite Discord d'un embed", () => {
    it("laisse intact un texte sous la borne", () => {
        expect(truncate("Mériana", 100)).toBe("Mériana");
    });

    it("coupe avec une ellipse visible au-delà", () => {
        const out = truncate("a".repeat(1200), DISCORD_FIELD_VALUE_MAX);
        expect(out).toHaveLength(DISCORD_FIELD_VALUE_MAX);
        expect(out.endsWith("…")).toBe(true);
    });
});

describe("formatCrafterList — la liste d'artisans ne casse jamais l'interaction", () => {
    const crafters = Array.from({ length: 40 }, (_, index) => ({
        name: `A${index + 1}`,
        discordId: `1000000000000000${String(index).padStart(2, "0")}`,
    }));

    it("mentionne un flocon Discord, et laisse le pseudo seul sans compte lié", () => {
        const value = formatCrafterList(
            [{ name: "Klyx", discordId: "100000000000000001" }, { name: "SansCompte" }],
            { maxLines: 25, overflow: (remaining) => `... et ${remaining}` }
        );
        expect(value).toContain("• **Klyx** (<@100000000000000001>)");
        expect(value).toContain("• **SansCompte**");
        expect(value).not.toContain("SansCompte** (<@");
    });

    it("dit combien d'artisans sont masqués", () => {
        const value = formatCrafterList(crafters, {
            maxLines: 25,
            overflow: (remaining) => `... et ${remaining} autre(s) artisan(s)`,
        });
        expect(value).toContain("... et 15 autre(s) artisan(s)");
    });

    it("ne dépasse jamais 1024 caractères et garde la note de pied", () => {
        const value = formatCrafterList(crafters, {
            maxLines: 40,
            overflow: (remaining) => `... et ${remaining}`,
            footer: "*👉 À valider sur le profil SigilOS une fois la quête terminée.*",
        });
        expect(value.length).toBeLessThanOrEqual(DISCORD_FIELD_VALUE_MAX);
        expect(value).toContain("À valider sur le profil SigilOS");
    });

    it("tronque proprement quand la première ligne dépasse déjà la borne", () => {
        const value = formatCrafterList([{ name: "X".repeat(2000) }], {
            maxLines: 25,
            overflow: (remaining) => `... et ${remaining}`,
        });
        expect(value.length).toBeLessThanOrEqual(DISCORD_FIELD_VALUE_MAX);
        expect(value.endsWith("…")).toBe(true);
        // L'artisan unique n'est pas remplacé par « … et 1 autre ».
        expect(value).toContain("X");
        expect(value).not.toContain("et 1");
    });
});

describe("câblage — le routeur borne l'embed /legendaire", () => {
    const route = read("src/app/api/discord/interactions/route.ts");

    it("passe par les helpers bornés (aucun slice de liste à la main)", () => {
        expect(route).toContain("formatCrafterList(");
        expect(route).toContain("truncate(`✨ ${item.name}`");
        expect(route).not.toContain("eligibleCrafters.slice(0, 25)");
    });
});
