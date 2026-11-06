/**
 * Espace visiteur (rang 57) — verrou de l'onglet **Succès** (V1i).
 *
 * Trois choses, une seule échelle :
 *  · les **tranches de niveau** viennent d'une règle partagée, consommée par le tracker
 *    interne ET par l'onglet visiteur (plus de liste recopiée) ;
 *  · l'action **groupée** ne peut viser qu'une tranche de cette liste (aucune plage
 *    arbitraire envoyée par le client), elle garde, limite et n'écrit que sur le profil
 *    public du compte connecté ;
 *  · la page lit le **niveau**, le **slug** et l'**icône résolue** — le lien boss vise
 *    `/boss/<slug>`.
 *
 * Le comportement est testé sur la règle pure ; le câblage est verrouillé à la source,
 * comme les autres verrous visiteurs (`visitor-verifications`, `visitor-assets`).
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
    ALL_SUCCES_LEVELS_ID,
    SUCCES_DUNGEONS_TAKE,
    SUCCES_LEVEL_BRACKETS,
    findSuccesLevelBracket,
    findSuccesLevelBracketStrict,
    matchesSuccesLevelBracket,
    succesLevelBracketLabel,
    succesLevelBracketScopeLabel,
} from "@/lib/succes-level-brackets";

const read = (path: string) => readFileSync(path, "utf8");

const TRACKER = "src/components/succes/SuccesTracker.tsx";
const CHECKLIST = "src/app/espace-visiteur/_components/achievements-checklist.tsx";
const PAGE = "src/app/espace-visiteur/succes/page.tsx";
const ACTIONS = "src/server/actions/public-profile-actions.ts";

describe("Tranches de succès — une échelle, aucun trou", () => {
    it("les paliers réels se suivent sans trou (99+1=100, 149+1=150, 199+1=200)", () => {
        const reels = SUCCES_LEVEL_BRACKETS.filter((bracket) => bracket.id !== ALL_SUCCES_LEVELS_ID);

        expect(reels.map((bracket) => bracket.id)).toEqual(["1-99", "100-149", "150-199", "200+"]);
        for (let index = 1; index < reels.length; index += 1) {
            expect(reels[index].min, reels[index].id).toBe(reels[index - 1].max + 1);
        }
    });

    it("la tranche « tout » ouvre le jeu entier et reste la première (défaut de l'UI)", () => {
        const all = findSuccesLevelBracket(ALL_SUCCES_LEVELS_ID);

        expect(SUCCES_LEVEL_BRACKETS[0]).toBe(all);
        expect(all.min).toBe(1);
        expect(all.max).toBeGreaterThanOrEqual(1000);
    });

    it("les bornes sont inclusives", () => {
        const oneTo99 = findSuccesLevelBracket("1-99");
        const oneHundred = findSuccesLevelBracket("100-149");

        expect(matchesSuccesLevelBracket(1, oneTo99)).toBe(true);
        expect(matchesSuccesLevelBracket(99, oneTo99)).toBe(true);
        expect(matchesSuccesLevelBracket(100, oneTo99)).toBe(false);
        expect(matchesSuccesLevelBracket(100, oneHundred)).toBe(true);
        expect(matchesSuccesLevelBracket(149, oneHundred)).toBe(true);
        expect(matchesSuccesLevelBracket(150, oneHundred)).toBe(false);
    });

    it("la tranche « 200+ » couvre le plafond du jeu", () => {
        const high = findSuccesLevelBracket("200+");

        expect(matchesSuccesLevelBracket(200, high)).toBe(true);
        expect(matchesSuccesLevelBracket(1000, high)).toBe(true);
        expect(matchesSuccesLevelBracket(199, high)).toBe(false);
    });

    it("un id inconnu retombe sur « tout » dans l'UI, mais la résolution serveur refuse", () => {
        expect(findSuccesLevelBracket("tranche-forgée").id).toBe(ALL_SUCCES_LEVELS_ID);
        expect(findSuccesLevelBracketStrict("tranche-forgée")).toBeNull();
    });

    it("libellés : les deux formes restent lisibles", () => {
        const all = findSuccesLevelBracket(ALL_SUCCES_LEVELS_ID);
        const mid = findSuccesLevelBracket("100-149");

        expect(succesLevelBracketLabel(all)).toBe("Tous les niveaux");
        expect(succesLevelBracketLabel(mid)).toBe("Niveau 100-149");
        expect(succesLevelBracketScopeLabel(all)).toBe("du jeu");
        expect(succesLevelBracketScopeLabel(findSuccesLevelBracket("200+"))).toBe("Niv. 200+");
    });
});

describe("Les deux écrans consomment la même source", () => {
    it("le tracker interne n'a plus de liste locale", () => {
        const tracker = read(TRACKER);

        expect(tracker).toContain('from "@/lib/succes-level-brackets"');
        expect(tracker).not.toMatch(/const LEVEL_PRESETS/);
        expect(tracker).not.toMatch(/min: 1,\s*max: 1000/);
    });

    it("l'onglet visiteur filtre et valide avec cette échelle", () => {
        const checklist = read(CHECKLIST);

        expect(checklist).toContain('from "@/lib/succes-level-brackets"');
        expect(checklist).toContain("matchesSuccesLevelBracket(");
        expect(checklist).toContain("succesLevelBracketLabel(");
        expect(checklist).toContain("togglePublicDungeonAchievementsBracket");
    });

    it("la page lit le niveau, le slug et l'icône résolue (source unique)", () => {
        const page = read(PAGE);

        expect(page).toContain("level: true");
        expect(page).toContain("slug: true");
        expect(page).toContain("getDungeonAchievementIconUrl");
        expect(page).toContain("SUCCES_DUNGEONS_TAKE");
        expect(page).toMatch(/orderBy: \[\{ level: "asc" \}, \{ name: "asc" \}\]/);
    });

    it("le lien boss vise le slug public", () => {
        expect(read(CHECKLIST)).toContain("/boss/${dungeon.slug}");
    });

    it("l'action groupée et la page partagent la même borne de donjons", () => {
        expect(SUCCES_DUNGEONS_TAKE).toBe(200);
        expect(read(PAGE)).toContain("take: SUCCES_DUNGEONS_TAKE");
        expect(read(ACTIONS)).toContain("take: SUCCES_DUNGEONS_TAKE");
    });
});

describe("Action groupée — garde, borne, cloisonnement", () => {
    const source = read(ACTIONS);
    const start = source.indexOf("export async function togglePublicDungeonAchievementsBracket");
    const next = source.indexOf("export async function", start + 1);
    const body = source.slice(start, next === -1 ? undefined : next);

    it("l'action existe et n'écrit que sur le profil public du compte connecté", () => {
        expect(start).toBeGreaterThan(-1);
        expect(body).toContain("getPublicAccount()");
        expect(body).toContain("account.profile.id");
        expect(body).toContain("publicProfileId");
        expect(body).not.toContain("guildId");
    });

    it("elle porte un rate limit et une résolution stricte de la tranche", () => {
        expect(body).toContain('limit("achievement-bracket"');
        expect(body).toContain("findSuccesLevelBracketStrict(");
        expect(body).toContain("if (!bracket)");
    });

    it("l'entrée est bornée (Zod : longueur et action fermée)", () => {
        expect(source).toContain("bracketId: z.string().min(1).max(16)");
        expect(source).toContain('action: z.enum(["validate", "unvalidate"])');
    });

    it("l'écriture est idempotente (contrainte unique) et la cible est relue en base", () => {
        expect(body).toContain("skipDuplicates: true");
        expect(body).toContain("db.dungeon.findMany");
        expect(body).toContain("level: { gte: bracket.min, lte: bracket.max }");
    });
});
