/**
 * Anti-résurrection (backlog ⑥, session 27/09/2026) — une suppression à la main doit SURVIVRE.
 *
 * 🐛 Mesures : ① le seed de déploiement (`prisma/seed-data/seed.ts`) rejouait 82 donjons et
 * 28 succès par upsert ⇒ tout ce que le God avait supprimé revenait ; ② le siphon d'anomalie
 * upsertait la paire `(carte, gardien)` sans regarder les lignes déclarées à la main ⇒ doublons
 * (`/boss/qilby-2`, `/boss/agonie-la-deterree-2` mesurés dans le sitemap beta) ; ③ le pseudo-succès
 * « Donjon validé » était recréé à chaque passe (siphon + enregistrement d'un donjon sans succès).
 *
 * Règle : les listes `public/game-data/ignored-dungeons.json` / `ignored-challenges.json` sont la
 * mémoire des suppressions — les seeds, l'import God et les siphons les respectent ; le siphon
 * d'anomalie **ADOPTE** la ligne déclarée à la main au lieu d'en créer une seconde.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
    dungeonIgnoreKey,
    isIgnoredChallenge,
    isIgnoredDungeon,
    normalizeIgnoredChallenges,
    normalizeIgnoredDungeons,
} from "@/lib/game-data-ignores";
import { isAnomalyGuardianIgnored, pickAdoptableDungeon } from "@/lib/anomaly-boss";

const REPO_ROOT = path.resolve(__dirname, "../..");
const readSource = (relativePath: string) => fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");

describe("exclusions — la mémoire des suppressions du God", () => {
    it("la clé d'un donjon neutralise accents, casse et ponctuation", () => {
        expect(dungeonIgnoreKey("Caverne d'Aguabrial", "Agonie la Déterrée")).toBe(
            dungeonIgnoreKey("caverne  d'aguabrial ", "AGONIE LA DETERREE")
        );
    });

    it("normalise les listes : entrées incomplètes écartées, doublons fusionnés", () => {
        const entries = normalizeIgnoredDungeons([
            { name: "Tour minérale", bossName: "Qilby", dofusdbId: 8131 },
            { name: "tour minerale", bossName: "QILBY" }, // même clé → une seule entrée
            { name: "Sans boss" },
            null,
        ]);
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({ name: "Tour minérale", bossName: "Qilby", dofusdbId: 8131 });
    });

    it("reconnaît un donjon exclu (liste injectée : aucune relecture disque en boucle)", () => {
        const ignored = [{ name: "Abysses du temps", bossName: "Qilby" }];
        expect(isIgnoredDungeon({ name: "abysses du temps", bossName: "QILBY" }, ignored)).toBe(true);
        expect(isIgnoredDungeon({ name: "Abysses du temps", bossName: "Autre" }, ignored)).toBe(false);
        expect(isIgnoredDungeon({}, ignored)).toBe(false);
    });

    it("succès : slug normalisé, accepté en objet ou en slug nu", () => {
        expect(
            normalizeIgnoredChallenges(["donjon-valide", { slug: "Donjon-Validé", name: "Donjon validé" }])
        ).toHaveLength(1);
        expect(isIgnoredChallenge("Donjon-Validé", [{ slug: "donjon-valide" }])).toBe(true);
        expect(isIgnoredChallenge("autre", [{ slug: "donjon-valide" }])).toBe(false);
        expect(isIgnoredChallenge(null)).toBe(false);
    });
});

describe("siphon d'anomalie — ADOPTION de la ligne déclarée à la main (fin des doublons)", () => {
    const rows = [
        { id: "d1", name: "Caverne d'Aguabrial", bossName: "Agonie la Déterrée", dofusdbId: null, dofensiveMonsterName: null },
        { id: "d2", name: "Qilby", bossName: "Qilby", dofusdbId: 8131, dofensiveMonsterName: "Qilby" },
    ];

    it("adopte l'entrée du God quand c'est le même gardien, quel que soit le libellé du donjon", () => {
        // Cas mesuré : « Qilby » déclaré à la main ; le siphon créait « Abysses du temps / Qilby »
        // → `/boss/qilby-2`. Désormais il complète SA ligne.
        expect(
            pickAdoptableDungeon(rows, { name: "Qilby", mapName: "Abysses du temps", dofusdbId: 8131 })?.id
        ).toBe("d2");
    });

    it("retrouve aussi par le nom seul et par la paire exacte", () => {
        expect(pickAdoptableDungeon(rows, { name: "Agonie la Déterrée", mapName: "Tour minérale" })?.id).toBe("d1");
        expect(
            pickAdoptableDungeon(rows, { name: "Agonie la Déterrée", mapName: "Caverne d'Aguabrial" })?.id
        ).toBe("d1");
    });

    it("n'invente rien quand rien ne correspond (le siphon crée alors sa ligne)", () => {
        expect(pickAdoptableDungeon(rows, { name: "Nouveau Gardien", mapName: "Tour minérale" })).toBeNull();
        expect(pickAdoptableDungeon([], { name: "Qilby" })).toBeNull();
        expect(pickAdoptableDungeon(rows, { name: "  " })).toBeNull();
    });

    it("un gardien exclu n'est jamais recréé (couple, entité ou id)", () => {
        const ignored = [{ name: "Abysses du temps", bossName: "Qilby", dofusdbId: 8131 }];
        expect(isAnomalyGuardianIgnored({ name: "Qilby", mapName: "Abysses du temps" }, ignored)).toBe(true);
        expect(isAnomalyGuardianIgnored({ name: "Qilby", mapName: "autre carte" }, ignored)).toBe(true);
        expect(isAnomalyGuardianIgnored({ name: "X", dofusdbId: 8131 }, ignored)).toBe(true);
        expect(isAnomalyGuardianIgnored({ name: "Nouveau", mapName: "Tour minérale" }, ignored)).toBe(false);
        expect(isAnomalyGuardianIgnored({ name: "Qilby" }, [])).toBe(false);
    });
});

describe("câblage — seeds, import God, siphon et pseudo-succès respectent les exclusions", () => {
    it("les deux seeds (déploiement + dev) sautent les donjons et les succès exclus", () => {
        for (const file of ["prisma/seed-data/seed.ts", "prisma/seed.ts"]) {
            const src = readSource(file);
            expect(src, file).toContain("isIgnoredDungeon(");
            expect(src, file).toContain("isIgnoredChallenge(");
            expect(src, file).toContain("getIgnoredDungeons()");
        }
    });

    it("l'import God saute les entrées exclues", () => {
        const src = readSource("src/server/actions/game-data-admin-actions.ts");
        expect(src).toContain("isIgnoredDungeon({ name: dungeon.name, bossName: dungeon.bossName }, ignoredDungeons)");
        expect(src).toContain("isIgnoredChallenge(challenge.slug, ignoredChallenges)");
    });

    it("supprimer mémorise, créer/éditer réintègre — avec « Restaurer » dans l'éditeur Donjons", () => {
        const src = readSource("src/server/actions/game-data-admin-actions.ts");
        expect(src).toContain("addIgnoredDungeon(target)");
        expect(src).toContain("addIgnoredChallenge(target.slug, target.name)");
        expect(src).toContain("removeIgnoredDungeon(");
        expect(src).toContain("removeIgnoredChallenge(");

        const ui = readSource("src/components/admin/DungeonManager.tsx");
        expect(ui).toContain("getIgnoredDungeonsAction");
        expect(ui).toContain("restoreDungeonAction");
    });

    it("le pseudo-succès « Donjon validé » n'est plus recréé après une suppression volontaire", () => {
        expect(readSource("src/lib/dungeon-no-achievement.ts")).toContain(
            "if (isIgnoredChallenge(NO_ACHIEVEMENT_CHALLENGE_SLUG)) return null;"
        );
    });

    it("le siphon d'anomalie adopte puis complète — plus d'upsert aveugle de la paire (carte, gardien)", () => {
        const src = readSource("src/lib/anomaly-boss-siphon.ts");
        expect(src).toContain("pickAdoptableDungeon(");
        expect(src).toContain("isAnomalyGuardianIgnored(");
        expect(src).toContain("db.dungeon.create({");
        expect(src).not.toContain("db.dungeon.upsert(");
    });
});

