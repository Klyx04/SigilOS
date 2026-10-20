/**
 * Double boss d'un donjon — règle pure (voir `src/lib/dungeon-boss-pair.ts`).
 *
 * Cas réels mesurés en base le 20/10/2026 : les 4 donjons de Frigost portent
 * `bossName = "<donjon>"` mais `dofensiveMonsterName` = l'associé, et
 * `dofensiveDungeonName = "Donjon du Comte Harebourg"`.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { resolveDungeonBossPair } from "@/lib/dungeon-boss-pair";

const PAGE = readFileSync("src/app/boss/[dungeonId]/page.tsx", "utf8");
const CLIENT = readFileSync(
    "src/app/boss/[dungeonId]/_components/PublicBossDetailClient.tsx",
    "utf8"
);

const FRIGOST = [
    { slug: "comte-et-klime", name: "Comte et Klime", monstre: "Klime" },
    { slug: "comte-et-missiz-frizz", name: "Comte et Missiz Frizz", monstre: "Missiz Frizz" },
    { slug: "comte-et-nileza", name: "Comte et Nileza", monstre: "Nileza" },
    { slug: "comte-et-sylargh", name: "Comte et Sylargh", monstre: "Sylargh" },
];

describe("resolveDungeonBossPair — identité d'un donjon", () => {
    it("① les 4 donjons de Frigost : le focus est l'associé, le partner est le Comte", () => {
        for (const cas of FRIGOST) {
            const pair = resolveDungeonBossPair({
                name: cas.name,
                bossName: cas.name,
                dofensiveMonsterName: cas.monstre,
                dofensiveDungeonName: "Donjon du Comte Harebourg",
            });
            expect(pair, cas.slug).toEqual({
                focus: cas.monstre,
                partner: "Comte Harebourg",
                isDoubleBoss: true,
            });
        }
    });

    it("② un donjon classique reste centré sur son boss (aucun partenaire inventé)", () => {
        expect(
            resolveDungeonBossPair({
                name: "Forgefroide de Missiz Frizz",
                bossName: "Missiz Frizz",
                dofensiveMonsterName: null,
                dofensiveDungeonName: null,
            })
        ).toEqual({ focus: "Missiz Frizz", partner: null, isDoubleBoss: false });
    });

    it("③ sans nom de donjon Dofensive, il n'y a pas de second boss", () => {
        const pair = resolveDungeonBossPair({
            name: "Comte et Nileza",
            bossName: "Comte et Nileza",
            dofensiveMonsterName: "Nileza",
            dofensiveDungeonName: null,
        });
        expect(pair).toEqual({ focus: "Nileza", partner: null, isDoubleBoss: false });
    });

    it("④ si le partenaire déduit est le focus, il est écarté (jamais deux fois le même)", () => {
        const pair = resolveDungeonBossPair({
            name: "Donjon du Comte",
            bossName: "Comte",
            dofensiveMonsterName: "Comte",
            dofensiveDungeonName: "Donjon du Comte",
        });
        expect(pair).toEqual({ focus: "Comte", partner: null, isDoubleBoss: false });
    });

    it("⑤ casse et espaces ne changent rien", () => {
        const pair = resolveDungeonBossPair({
            name: "  Comte et Nileza ",
            bossName: "Comte et Nileza",
            dofensiveMonsterName: "  nileza ",
            dofensiveDungeonName: "Donjon du   Comte Harebourg",
        });
        expect(pair.focus).toBe("nileza");
        expect(pair.partner).toBe("Comte Harebourg");
        expect(pair.isDoubleBoss).toBe(true);
    });

    it("⑥ un nom de donjon sans préfixe générique est conservé tel quel", () => {
        const pair = resolveDungeonBossPair({
            name: "X",
            bossName: "X",
            dofensiveMonsterName: "Nileza",
            dofensiveDungeonName: "Comte Harebourg",
        });
        expect(pair.partner).toBe("Comte Harebourg");
    });

    it("⑦ la page résout stats/sorts/carte sur le boss de la salle, jamais sur le nom du donjon", () => {
        expect(PAGE).toContain("resolveDungeonBossPair(");
        expect(PAGE).toMatch(/getMonsterStats\(\s*focusMonsterName/);
        expect(PAGE).toMatch(/getBossDofensiveSpells\(\s*focusMonsterName/);
        expect(PAGE).toMatch(/getDofensiveDungeonForBoss\(\s*focusMonsterName/);
        // L'ancien branchement (nom du donjon) est ce qui affichait les stats du Comte.
        expect(PAGE).not.toMatch(/getMonsterStats\(\s*bossName/);
    });

    it("⑧ l'écran expose les deux boss et laisse sélectionner le second", () => {
        expect(CLIENT).toContain("const bossName = bossPair.focus;");
        expect(CLIENT).toContain('data-testid="boss-pair"');
        // `m.isBoss` neutralisait la sélection : le second boss renvoyait toujours le focus.
        expect(CLIENT).not.toMatch(/if \(m\.isBoss \|\| m\.name === bossName\)/);
    });
});
