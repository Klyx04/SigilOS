/**
 * Chantier « Avis de recherche » (Lot 2) — fiche publique d'un avis.
 *
 * Règles vérifiées : la fiche est construite **à partir de la base** (`Bounty` siphonné +
 * `MonsterStat`), le repli de carte est **annoncé comme tel**, la zone de traque sert
 * d'« emplacement », la prime vient des champs curés (aucune invention) et les critères de
 * quête sont ceux du siphon (texte réel de Dofensive).
 *
 * L'encart « Prime » est verrouillé ici aussi : **une seule** résolution d'icônes
 * (`bountyRewardIcon`), montée telle quelle sur la fiche interne **et** la fiche publique, et
 * réutilisée par la fiche de zone worldmap (plus de table recopiée, plus de hotlink CDN).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
    bountyBattleMapLabel,
    bountyCriteriaFromStat,
    bountyRewardIcon,
    bountyRewardLines,
    buildBountyBestiaireEntry,
    buildBountyPublicDungeon,
    buildBountyPublicMeta,
    type BountyRowInput,
} from "@/lib/bounty-fiche";
import { BOUNTY_MAP_EMPTY_LABEL } from "@/lib/bounty";

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
    battleMapId: null,
    battleMapSource: "none",
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
        battleMapSource: "none",
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

    it("carte de simulation : GRILLE VIDE (aucune carte d'emprunt pour un avis)", () => {
        expect(bountyBattleMapLabel(PREDAGOB)).toBe(BOUNTY_MAP_EMPTY_LABEL);
        expect(bountyBattleMapLabel({ ...PREDAGOB, battleMapSource: "dofensive" })).toBeNull();
        expect(buildBountyPublicMeta(PREDAGOB, PREDAGOB_STAT).battleMapId).toBeNull();
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

/** Lecture brute d'un composant : ces gardes verrouillent un **emplacement**, pas un rendu. */
const sourceOf = (path: string) => readFileSync(path, "utf8");

/**
 * Encart « Prime » — retour user 28/09/2026, verbatim : « il faut aussi afficher un petit encart
 * (avis interne et externe publique) la récompense avec la bonne icone locale, aviton aliton,
 * kamas de glace ». Les trois assets vivent dans `public/assets/avis/`
 * (`avitons.png`, `aliton.png`, `kamas_de_glace.png`).
 */
describe("prime d'un avis — encart et icônes locales (une seule source)", () => {
    it("chaque monnaie d'avis a son asset local — et rien n'est inventé pour le reste", () => {
        expect(bountyRewardIcon("Aviton")).toBe("/assets/avis/avitons.png");
        expect(bountyRewardIcon("aliton")).toBe("/assets/avis/aliton.png");
        expect(bountyRewardIcon(" Aliton ")).toBe("/assets/avis/aliton.png");
        expect(bountyRewardIcon("Kama de glace")).toBe("/assets/avis/kamas_de_glace.png");
        // Le « Dofus des glaces » est un **item** du jeu : proxy d'assets interne, jamais le CDN
        // DofusDB depuis le navigateur (convention du dépôt).
        expect(bountyRewardIcon("Dofus des glaces")).toBe("/api/assets-dofus/items/11756");
        // Ce qui n'est pas reconnu reste **sans icône** (texte seul) : on n'affiche pas un
        // « Aviton » de complaisance pour un type inconnu.
        for (const unknown of ["Doplon", "Kamas", "", "   ", null, undefined]) {
            expect(bountyRewardIcon(unknown)).toBeNull();
        }
    });

    it("les deux fiches (interne + publique) montent le MÊME encart, sans URL inventée", () => {
        const interne = sourceOf("src/components/succes/SuccesAvisTab.tsx");
        const publique = sourceOf("src/app/boss/[dungeonId]/_components/PublicBossDetailClient.tsx");
        for (const src of [interne, publique]) {
            expect(src).toContain("<BountyRewardCard rewards=");
        }

        const card = sourceOf("src/components/succes/BountyRewardCard.tsx");
        expect(card).toMatch(/bountyRewardIcon\(reward\.type\)/);
        // Aucun hotlink : les icônes viennent du dépôt (ou du proxy interne via le helper).
        expect(card).not.toMatch(/https?:\/\//);
        // Sans récompense : rien du tout — jamais un encart vide.
        expect(card).toMatch(/if \(lines\.length === 0\) return null;/);
    });

    it("la fiche de zone worldmap réutilise cette résolution (fin du doublon et du hotlink)", () => {
        const zone = sourceOf("src/components/worldmap/ZoneDetailModal.tsx");
        expect(zone).toMatch(/import \{ bountyRewardIcon \} from '@\/lib\/bounty-fiche';/);
        expect(zone).toMatch(/<RewardIcon type=/);
        // Les deux défauts mesurés : table d'icônes recopiée en clair, et icône servie par le CDN
        // DofusDB (`https://static.dofusdb.fr/items/11756.png`) — désormais centralisés.
        expect(zone).not.toContain("static.dofusdb.fr");
        expect(zone).not.toContain("dofus des glaces");
        expect(zone).not.toMatch(/iconSrc = '\/assets\/avis/);
    });
});

