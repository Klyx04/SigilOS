/**
 * Carte « raid en cours » du dashboard — **charte + visuel réel** (31/10/2026).
 *
 * Avant ce lot : carte en `rounded-3xl` avec anneau lumineux (`ring-danger/30`) et animation
 * d'entrée, **9** `font-black`, un titre en **italique + majuscules**, un glyphe générique
 * (`Swords` + badge `Zap`) au lieu du visuel du raid, et une pastille CTA `rounded-2xl`.
 *
 * Le visuel vient de `resolveEventImagePath("RAID_OFFICIAL", metadata)` : **Gigalodon** et
 * **Sanctuaire des Jardins Éternels** ont chacun leur illustration — jamais un glyphe générique.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const BANNER = readFileSync(
    join(process.cwd(), "src/app/dashboard/[guildId]/_components/raid-hero-banner.tsx"),
    "utf8",
);

describe("carte raid du dashboard — charte", () => {
    it("aucun `font-black`", () => {
        expect(BANNER).not.toMatch(/\bfont-black\b/);
    });

    it("aucun italique ni majuscules décoratives", () => {
        expect(BANNER).not.toMatch(/\bitalic\b/);
        expect(BANNER).not.toMatch(/\buppercase\b/);
        expect(BANNER).not.toMatch(/\btracking-widest\b/);
    });

    it("rayons ≤ 12 px (pas de `rounded-2xl`/`3xl`)", () => {
        expect(BANNER).not.toMatch(/rounded-(?:2|3)xl/);
    });

    it("aucun anneau lumineux ni animation d'entrée", () => {
        expect(BANNER).not.toMatch(/\bring-\d/);
        expect(BANNER).not.toMatch(/animate-in|slide-in-from/);
    });
});

describe("carte raid du dashboard — visuel réel", () => {
    it("utilise l'illustration du raid (source unique du calendrier)", () => {
        expect(BANNER).toContain('resolveEventImagePath("RAID_OFFICIAL", raid.metadata)');
    });

    it("prévoit un repli si l'image ne charge pas", () => {
        expect(BANNER).toContain("/assets/calendar/calendar_raid_official.png");
    });

    it("plus de glyphe générique (Swords / Zap)", () => {
        expect(BANNER).not.toMatch(/\bSwords\b/);
        expect(BANNER).not.toMatch(/\bZap\b/);
    });
});
