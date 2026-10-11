/**
 * Hub Succès — **onglet « Raids »** + **filtre par tranche de niveau**.
 *
 * Demandes user (11/10/2026, verbatim) : « rajoute un onglet monstres raid qui filtre tous les
 * boss/monstres des raids (si des nouveaux raids sortent dans le futur ca doit etre propre) » et
 * « ajoute aussi un filtre par tranche de niveau » (capture du hub : cartes `LVL 10/20/30…`).
 *
 * 🔒 Ce que ce verrou protège :
 *  ① les **paliers de niveau** sont une échelle UNIQUE (`@/lib/level-brackets`) : contigus, sans
 *     trou ni recouvrement — le hub et le catalogue public ne peuvent plus diverger ;
 *  ② l'onglet « Raids » filtre sur la **donnée** `isRaidBoss`, jamais sur une liste de noms :
 *     un raid publié demain apparaît sans toucher au code ;
 *  ③ le filtre de niveau est bien branché dans la liste, et changer de tranche referme la fiche
 *     ouverte (sinon une fiche hors filtre resterait affichée).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
    ALL_LEVELS_ID,
    BOSS_LEVEL_BRACKETS,
    findLevelBracket,
    levelBracketLabel,
    matchesLevelBracket,
} from "@/lib/level-brackets";

const read = (path: string) => readFileSync(path, "utf8");
const CLIENT = read("src/components/succes/SuccesClient.tsx");
const GUIDE = read("src/components/succes/SuccesBossGuide.tsx");
const PUBLIC_CATALOG = read("src/app/boss/_components/PublicBossCatalogClient.tsx");

describe("tranches de niveau — une seule échelle pour tout le projet", () => {
    it("paliers réels contigus, bornes incluses (1-50 → 191-200)", () => {
        const real = BOSS_LEVEL_BRACKETS.filter((bracket) => bracket.id !== ALL_LEVELS_ID);
        expect(real[0].min).toBe(1);
        for (let i = 1; i < real.length; i++) {
            expect(real[i].min).toBe(real[i - 1].max + 1);
        }
        expect(real[real.length - 1].max).toBe(200);
    });

    it("la tranche « tout » couvre tout, y compris un niveau absent (jamais inventé)", () => {
        const all = findLevelBracket(ALL_LEVELS_ID);
        expect(all.max).toBe(Number.POSITIVE_INFINITY);
        for (const level of [1, 200, 250, 0, null, undefined]) {
            expect(matchesLevelBracket(level as number, all)).toBe(true);
        }
    });

    it("un id inconnu retombe sur « tout », jamais sur undefined", () => {
        expect(findLevelBracket("151-999").id).toBe(ALL_LEVELS_ID);
        expect(findLevelBracket(null).id).toBe(ALL_LEVELS_ID);
        expect(findLevelBracket("").id).toBe(ALL_LEVELS_ID);
    });

    it("bornes inclusives des deux côtés", () => {
        const bracket = findLevelBracket("151-190");
        expect(matchesLevelBracket(151, bracket)).toBe(true);
        expect(matchesLevelBracket(190, bracket)).toBe(true);
        expect(matchesLevelBracket(150, bracket)).toBe(false);
        expect(matchesLevelBracket(191, bracket)).toBe(false);
        expect(levelBracketLabel(bracket)).toBe("Niveau 151 — 190");
        expect(levelBracketLabel(findLevelBracket(ALL_LEVELS_ID))).toBe("Tous les niveaux");
    });

    it("le catalogue public ET le hub consomment cette échelle (plus de liste recopiée)", () => {
        for (const source of [PUBLIC_CATALOG, GUIDE]) {
            expect(source).toContain('from "@/lib/level-brackets"');
            expect(source).not.toMatch(/min: 151,\s*max: 190/);
        }
        expect(PUBLIC_CATALOG).toContain("BOSS_LEVEL_BRACKETS.map(");
        expect(GUIDE).toContain("{BOSS_LEVEL_BRACKETS.map((bracket) => {");
    });
});

describe("onglet « Raids » — filtre sur la DONNÉE, jamais sur une liste de noms", () => {
    it("l'onglet est déclaré, routé, et les fiches passent par `scope`", () => {
        expect(CLIENT).toMatch(/type FicheTab = "boss" \| "anomalies" \| "bounties" \| "titans" \| "raids" \| "monstres";/);
        expect(CLIENT).toMatch(/\{ id: "raids", label: "Raids"/);
        expect(CLIENT).toMatch(/value === "raids"/);
        expect(CLIENT).toMatch(
            /activeFiche === "raids" \? \(\s*<SuccesBossGuide guildId=\{guildId\} scope="raid" \/>/
        );
        expect(CLIENT).toMatch(/scope="anomalie"/);
        // Le booléen `anomalyOnly` est remplacé par le périmètre typé (une seule façon de filtrer).
        expect(CLIENT).not.toContain("anomalyOnly");
    });

    it("l'onglet « Monstres » du hub route vers la fiche de monstre partagée", () => {
        // 🎯 Demande user (11/10/2026) : « pas de fiche monstres normaux ni interne/ni publique ».
        expect(CLIENT).toMatch(/\{ id: "monstres", label: "Monstres"/);
        expect(CLIENT).toMatch(/value === "monstres"/);
        expect(CLIENT).toMatch(/activeFiche === "monstres" \? \(\s*<SuccesMonstresTab \/>/);
    });

    it("le périmètre raid lit `isRaidBoss` — un raid publié demain entre sans code", () => {
        expect(GUIDE).toMatch(/raid: \{\s*match: \(d\) => !!d\.isRaidBoss,/);
        expect(GUIDE).toMatch(/isRaidBoss: !!d\.isRaidBoss,/);
        // Aucun nom de raid en dur (le contrôle « propre dans le futur »).
        for (const raidName of ["Gigalodon", "Kimbo", "Nemroz", "Sanctuaire"]) {
            expect(GUIDE).not.toContain(raidName);
        }
    });
});

describe("filtre par tranche de niveau — branché dans la liste", () => {
    it("la liste filtre dessus et le changement de tranche referme la fiche ouverte", () => {
        expect(GUIDE).toMatch(/const \[levelBracketId, setLevelBracketId\] = useState<string>\(ALL_LEVELS_ID\)/);
        expect(GUIDE).toContain("matchesLevelBracket(d.level, levelBracket)");
        expect(GUIDE).toMatch(/aria-pressed=\{active\}/);
        expect(GUIDE).toMatch(/data-tour="succes-levels"/);
    });
});
