import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { getMultiBossConfig, isMultiBossDungeon, MULTI_BOSS_DUNGEONS } from "@/lib/dungeon-multi-boss";

const OVERLAY = readFileSync("src/components/boss-overlay/BossOverlayClient.tsx", "utf8");
const PUBLIC_DETAIL = readFileSync("src/app/boss/[dungeonId]/_components/PublicBossDetailClient.tsx", "utf8");
const INTERNAL_GUIDE = readFileSync("src/components/succes/SuccesBossGuide.tsx", "utf8");

describe("dungeon-multi-boss — configuration et helpers", () => {
    it("reconnaît le Sanctuaire du dernier espoir par slug, bossName ou nom", () => {
        expect(isMultiBossDungeon({ slug: "sanctuaire-du-dernier-espoir" })).toBe(true);
        expect(isMultiBossDungeon({ bossName: "Sanctuaire du dernier espoir" })).toBe(true);
        expect(isMultiBossDungeon({ name: "Tempête de l'Eliocalypse" })).toBe(true);
    });

    it("fournit les 4 boss dans l'ordre pour le Sanctuaire", () => {
        const config = getMultiBossConfig("sanctuaire-du-dernier-espoir");
        expect(config).not.toBeNull();
        expect(config?.bossNames).toEqual(["Servitude", "Guerre", "Misère", "Corruption"]);
        expect(config?.label).toBe("Quatuor");
        expect(config?.coordinates).toEqual({ x: 15, y: -20, worldMapId: 1 });
        expect(config?.locationImageUrl).toBe("/game-data/worldmap/sanctuaire-cavaliers.webp");
        expect(config?.zoneName).toBe("Sanctuaire du dernier espoir");
    });

    it("ne match pas un donjon standard ou double boss Frigost", () => {
        expect(isMultiBossDungeon({ slug: "comte-et-klime", bossName: "Comte et Klime" })).toBe(false);
        expect(isMultiBossDungeon({ slug: "bouftou-royal", bossName: "Bouftou Royal" })).toBe(false);
    });

    it("intègre le support multi-boss dans l'overlay et les fiches", () => {
        expect(OVERLAY).toContain("getMultiBossConfig");
        expect(OVERLAY).toContain("isMultiBoss");
        expect(PUBLIC_DETAIL).toContain("getMultiBossConfig");
        expect(PUBLIC_DETAIL).toContain("locationImageUrl");
        expect(INTERNAL_GUIDE).toContain("getMultiBossConfig");
        expect(INTERNAL_GUIDE).toContain("locationImageUrl");
    });
});
