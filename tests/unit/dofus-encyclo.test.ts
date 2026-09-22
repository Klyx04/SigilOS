import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
    encycloGrade,
    encycloIdentity,
    encycloProperties,
    resolveEncycloNames,
} from "@/lib/dofus-encyclo";
import { DOFUSDB_PATH_RE } from "@/lib/dofusdb-fetch";

/**
 * Lot B « encyclopédie Dofus » — siphon enrichi.
 * Payload mesuré : Cire Momore (7222), `api.dofusdb.fr/monsters?id=7222`
 * (race 277, subarea 1031, 6 grades). Aucune valeur inventée : absent ou
 * hors bornes ⇒ `null`, et la fiche masque la ligne.
 */

const REPO_ROOT = path.resolve(__dirname, "../..");
const readSource = (relativePath: string) => fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");

// Extrait mesuré du grade 1 de Cire Momore (champs utiles uniquement).
const GRADE_1 = {
    grade: 1,
    monsterId: 7222,
    level: 900,
    lifePoints: 41000,
    actionPoints: 25,
    movementPoints: 2,
    vitality: 0,
    paDodge: 100,
    pmDodge: 1000,
    wisdom: 640,
    earthResistance: 15,
    airResistance: 15,
    fireResistance: 15,
    waterResistance: 15,
    neutralResistance: 15,
    gradeXp: 3140000,
    strength: 800,
    intelligence: 800,
    chance: 800,
    agility: 800,
};

// Extrait mesuré du niveau monstre (Cire Momore).
const MONSTER = {
    id: 7222,
    race: 277,
    subareas: [1031],
    aggressiveZoneSize: 3,
    aggressiveLevelDiff: 50,
    isBoss: true,
    isMiniBoss: false,
    canTackle: true,
    canBePushed: false,
    canSwitchPos: false,
    canSwitchPosOnTarget: false,
    canBeCarried: false,
    canUsePortal: false,
    soulCaptureForbidden: true,
};

describe("encycloGrade — caractéristiques par grade (mesuré 7222)", () => {
    it("extrait les caractéristiques exactes du grade 1", () => {
        expect(encycloGrade(GRADE_1)).toEqual({
            level: 900,
            lifePoints: 41000,
            actionPoints: 25,
            movementPoints: 2,
            wisdom: 640,
            strength: 800,
            intelligence: 800,
            chance: 800,
            agility: 800,
            paDodge: 100,
            pmDodge: 1000,
            gradeXp: 3140000,
            resists: { neutral: 15, earth: 15, fire: 15, water: 15, air: 15 },
        });
    });

    it("accepte les formes `pa`/`pm` (repli historique du builder)", () => {
        const g = encycloGrade({ ...GRADE_1, pa: 25, pm: 2, actionPoints: undefined, movementPoints: undefined });
        expect(g.actionPoints).toBe(25);
        expect(g.movementPoints).toBe(2);
    });

    it("borné : NaN, hors plage ou absent ⇒ null (jamais inventé)", () => {
        const g = encycloGrade({ level: "x", lifePoints: -5, actionPoints: 9999, resists: null });
        expect(g.level).toBeNull();
        expect(g.lifePoints).toBeNull();
        expect(g.actionPoints).toBeNull();
        expect(g.movementPoints).toBeNull();
        expect(g.resists.neutral).toBeNull();
    });
});

describe("encycloIdentity — race, zone, agression, restrictions (mesuré 7222)", () => {
    it("extrait l'identité exacte", () => {
        expect(encycloIdentity(MONSTER)).toEqual({
            raceId: 277,
            isBoss: true,
            isMiniBoss: false,
            subareaIds: [1031],
            aggressiveZoneSize: 3,
            aggressiveLevelDiff: 50,
            canTackle: true,
            canBePushed: false,
            canSwitchPos: false,
            canSwitchPosOnTarget: false,
            canBeCarried: false,
            canUsePortal: false,
            soulCaptureForbidden: true,
        });
    });

    it("filtre les subareas invalides et borne à 10", () => {
        const id = encycloIdentity({ ...MONSTER, subareas: [0, -3, "x", 1031, 1031] });
        expect(id.subareaIds).toEqual([1031, 1031]);
    });
});

describe("encycloProperties — libellés façon DofusDB", () => {
    it("rend les 8 lignes exactes de Cire Momore, dans l'ordre", () => {
        expect(encycloProperties(encycloIdentity(MONSTER), 900)).toEqual([
            "Zone d'agression de 3 cases",
            "Agressif jusqu'au niveau 850",
            "Ne peut pas être capturé",
            "Ne peut pas être porté",
            "Ne peut pas être poussé",
            "Ne peut pas échanger de position",
            "Ne peut pas échanger de position avec la cible",
            "Ne peut pas utiliser de portail",
        ]);
    });

    it("pluriel d'une seule case + aucune restriction ⇒ 2 lignes", () => {
        const id = encycloIdentity({
            ...MONSTER,
            aggressiveZoneSize: 1,
            soulCaptureForbidden: false,
            canBeCarried: true,
            canBePushed: true,
            canSwitchPos: true,
            canSwitchPosOnTarget: true,
            canUsePortal: true,
        });
        expect(encycloProperties(id, 900)).toEqual([
            "Zone d'agression de 1 case",
            "Agressif jusqu'au niveau 850",
        ]);
    });

    it("sans agression ni niveau ⇒ aucune ligne d'agression", () => {
        const id = encycloIdentity({ ...MONSTER, aggressiveZoneSize: 0, aggressiveLevelDiff: 0 });
        const lines = encycloProperties(id, null);
        expect(lines.some((l) => l.includes("agression") || l.includes("Agressif"))).toBe(false);
    });

    it("niveau calculé < 1 (Mob l'Éponge niv. 20, diff 50) ⇒ ligne masquée", () => {
        const id = encycloIdentity({ ...MONSTER, aggressiveZoneSize: 3, aggressiveLevelDiff: 50 });
        const lines = encycloProperties(id, 20);
        expect(lines).toEqual([
            "Zone d'agression de 3 cases",
            "Ne peut pas être capturé",
            "Ne peut pas être porté",
            "Ne peut pas être poussé",
            "Ne peut pas échanger de position",
            "Ne peut pas échanger de position avec la cible",
            "Ne peut pas utiliser de portail",
        ]);
    });
});

describe("resolveEncycloNames — fail-soft sans réseau", () => {
    const prev = process.env.DOFUSDB_OFFLINE;
    beforeEach(() => {
        process.env.DOFUSDB_OFFLINE = "1";
    });
    afterEach(() => {
        if (prev === undefined) delete process.env.DOFUSDB_OFFLINE;
        else process.env.DOFUSDB_OFFLINE = prev;
    });

    it("DofusDB injoignable ⇒ noms null (la fiche masque, jamais d'invention)", async () => {
        await expect(resolveEncycloNames(encycloIdentity(MONSTER))).resolves.toEqual({
            raceName: null,
            superRaceName: null,
            zoneName: null,
        });
    });
});

describe("garde SSRF — allowlist étendue aux 2 collections encyclo", () => {
    it("accepte monster-super-races et subareas, refuse le reste", () => {
        expect(DOFUSDB_PATH_RE.test("/monster-super-races?id=1&$limit=1&lang=fr")).toBe(true);
        expect(DOFUSDB_PATH_RE.test("/subareas?id=1031&$limit=1&lang=fr")).toBe(true);
        expect(DOFUSDB_PATH_RE.test("/monster-races?id=277&$limit=1&lang=fr")).toBe(true);
        expect(DOFUSDB_PATH_RE.test("/admin")).toBe(false);
        expect(DOFUSDB_PATH_RE.test("https://evil.example.com/monsters")).toBe(false);
        expect(DOFUSDB_PATH_RE.test("/monsters;DROP")).toBe(false);
    });
});

describe("câblage siphon — le builder persiste l'encyclo", () => {
    it("resultData porte `encyclo` + `carac` par grade (futures lignes resync)", () => {
        const src = readSource("src/server/actions/game-data-actions.ts");
        expect(src).toContain("encyclo: { ...encycloId, names: encycloNames }");
        expect(src).toContain("carac: {");
        expect(src).toContain('from "@/lib/dofus-encyclo"');
    });
});
