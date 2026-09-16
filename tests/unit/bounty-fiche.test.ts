/**
 * Chantier « Avis de recherche » (Lot 2) — fiche publique d'un avis.
 *
 * Règles vérifiées : la fiche est construite **à partir de la base** (`Bounty` siphonné +
 * `MonsterStat`), le repli de carte est **annoncé comme tel**, la zone de traque sert
 * d'« emplacement », la prime vient des champs curés (aucune invention) et les critères de
 * quête sont ceux du siphon (texte réel de Dofensive).
 */
import { describe, expect, it } from "vitest";

import {
    bountyBattleMapFallbackLabel,
    bountyCriteriaFromStat,
    bountyRewardLines,
    buildBountyBestiaireEntry,
    buildBountyPublicDungeon,
    buildBountyPublicMeta,
    type BountyRowInput,
} from "@/lib/bounty-fiche";
import { BOUNTY_FALLBACK_MAP, BOUNTY_MAP_FALLBACK_LABEL } from "@/lib/bounty";

/** Ligne `Bounty` d'un avis réel (Predagob 4834) telle que le siphon l'écrit. */
const PREDAGOB: BountyRowInput = {
    id: "bounty-4834",
    name: "Predagob",
    level: 190,
    zoneName: "Nimotopia",
    imageUrl: "/uploads/assets-dofus/monsters/4834.webp",
    position: "-67,28",
    milice: "Base des Justiciers",
    doplons: 1900,
    rewardType: "Aviton",
    rewards: [{ type: "Aviton", amount: 1900 }],
    dofusdbId: 4834,
    slug: "predagob-4834",
    raceId: 32,
    raceName: "Avis de recherche",
    battleMapId: BOUNTY_FALLBACK_MAP.id,
    battleMapSource: "default",
    dofusdbSyncedAt: new Date("2026-09-16T11:05:48.000Z"),
};

/** Fiche `MonsterStat` d'un avis (extrait du siphon : critères de quête RÉELS). */
const PREDAGOB_STAT = {
    id: 4834,
    name: "Predagob",
    bounty: {
        raceId: 32,
        raceName: "Avis de recherche",
        criteria: ["Ne pas être dans la sous-zone #1", "Avoir l'étape #1 de la quête #2 en cours"],
        battleMapId: BOUNTY_FALLBACK_MAP.id,
        battleMapSource: "default",
        battleMapLabel: BOUNTY_MAP_FALLBACK_LABEL,
    },
};

describe("bounty-fiche — entête publique d'un avis", () => {
    it("zone de traque + commande de trajet + milice", () => {
        const meta = buildBountyPublicMeta(PREDAGOB, PREDAGOB_STAT);
        expect(meta.zone).toBe("Nimotopia");
        expect(meta.travelCommand).toBe("/travel -67,28");
        expect(meta.milice).toBe("Base des Justiciers");
        expect(meta.raceName).toBe("Avis de recherche");
        expect(meta.raceId).toBe(32);
    });

    it("sans position : aucune commande de trajet inventée", () => {
        const meta = buildBountyPublicMeta({ ...PREDAGOB, position: null }, PREDAGOB_STAT);
        expect(meta.position).toBeNull();
        expect(meta.travelCommand).toBeNull();
    });

    it("prime : lignes curées, sinon repli sur `rewardType` + `doplons`", () => {
        expect(buildBountyPublicMeta(PREDAGOB, PREDAGOB_STAT).rewards).toEqual([{ type: "Aviton", amount: 1900 }]);

        const fallback = buildBountyPublicMeta({ ...PREDAGOB, rewards: [] }, PREDAGOB_STAT);
        expect(fallback.rewards).toEqual([{ type: "Aviton", amount: 1900 }]);

        expect(bountyRewardLines([{ type: "Aliton", amount: 12 }, { amount: 3 }, { type: "  " }, null])).toEqual([
            { type: "Aliton", amount: 12 },
            { type: "Prime", amount: 3 },
        ]);
        expect(bountyRewardLines("pas un tableau")).toEqual([]);
    });

    it("critères de quête : ceux du siphon, jamais reformulés", () => {
        const meta = buildBountyPublicMeta(PREDAGOB, PREDAGOB_STAT);
        expect(meta.criteria).toEqual([
            "Ne pas être dans la sous-zone #1",
            "Avoir l'étape #1 de la quête #2 en cours",
        ]);
        expect(bountyCriteriaFromStat(null)).toEqual([]);
        expect(bountyCriteriaFromStat({ bounty: { criteria: ["A", null, "  "] } })).toEqual(["A"]);
    });

    it("carte de simulation : le repli est DÉCLARÉ (jamais présenté comme la vraie carte)", () => {
        expect(bountyBattleMapFallbackLabel(PREDAGOB)).toBe(BOUNTY_MAP_FALLBACK_LABEL);
        expect(bountyBattleMapFallbackLabel({ ...PREDAGOB, battleMapSource: "dofensive" })).toBeNull();
        expect(buildBountyPublicMeta(PREDAGOB, PREDAGOB_STAT).battleMapId).toBe(BOUNTY_FALLBACK_MAP.id);
    });

    it("sources et fraîcheur : URLs exactes, date ISO, rien si l'id est absent", () => {
        const meta = buildBountyPublicMeta(PREDAGOB, PREDAGOB_STAT);
        expect(meta.dofusdbUrl).toBe("https://dofusdb.fr/fr/database/monster/4834");
        expect(meta.dofensiveUrl).toBe("https://dofensive.com/fr/monster/4834");
        expect(meta.syncedAt).toBe("2026-09-16T11:05:48.000Z");

        const sansId = buildBountyPublicMeta({ ...PREDAGOB, dofusdbId: null, dofusdbSyncedAt: null }, null);
        expect(sansId.dofusdbUrl).toBeNull();
        expect(sansId.dofensiveUrl).toBeNull();
        expect(sansId.syncedAt).toBeNull();
    });

    it("libellé de race : depuis la table des races, sinon celui de la LIGNE, sinon générique", () => {
        expect(buildBountyPublicMeta({ ...PREDAGOB, raceName: "n'importe quoi" }, null).raceName).toBe("Avis de recherche");
        expect(buildBountyPublicMeta({ ...PREDAGOB, raceId: null, raceName: "Avis de recherche de Frigost" }, null).raceName).toBe("Avis de recherche de Frigost");
        expect(buildBountyPublicMeta({ ...PREDAGOB, raceId: null, raceName: null }, null).raceName).toBe("Avis de recherche");
    });
});

describe("bounty-fiche — entrées de fiche et de catalogue", () => {
    it("la fiche publique utilise la ZONE comme emplacement, l'avis comme entité", () => {
        const d = buildBountyPublicDungeon(PREDAGOB);
        expect(d).toMatchObject({
            kind: "bounty",
            name: "Nimotopia",
            bossName: "Predagob",
            level: 190,
            dofensiveMonsterName: "Predagob",
            dofensiveDungeonName: null,
            dofuspourlesnoobsUrl: null,
        });
        // 15 des 96 avis n'ont AUCUNE sous-zone (mesuré) : l'emplacement retombe sur le nom.
        expect(buildBountyPublicDungeon({ ...PREDAGOB, zoneName: null }).name).toBe("Predagob");
    });

    it("l'entrée de catalogue est de type `bounty` (jamais mélangée aux boss/titans)", () => {
        const e = buildBountyBestiaireEntry(PREDAGOB);
        expect(e).toMatchObject({
            id: "bounty-4834",
            type: "bounty",
            name: "Nimotopia",
            bossName: "Predagob",
            level: 190,
            dofusdbId: 4834,
            isOcreQuest: false,
            dofensiveUrl: "https://dofensive.com/fr/monster/4834",
        });
        expect(e.type).not.toBe("boss");
        expect(buildBountyBestiaireEntry({ ...PREDAGOB, zoneName: null }).name).toBe("Predagob");
    });
});
