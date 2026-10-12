/**
 * Succès « spéciaux » — **vraie explication (DofusDB)**, **icône réelle**, **retrait du pseudo-succès
 * « Donjon validé »** (demande user du 11/10/2026).
 *
 * 🔒 Ce que ce verrou protège :
 *  ① la passerelle DofusDB garde une **garde d'identité** (un nom qui ne correspond pas vraiment
 *     n'écrit rien — jamais « le premier résultat ») et les **conditions sont lues** telles quelles ;
 *  ② la passe est **idempotente** et la simulation **n'écrit pas** ;
 *  ③ l'icône d'un succès passe par le **proxy interne** (fini `/game-data/achievements/{slug}.png`,
 *     qui rendait une case noire quand le fichier n'existait pas) ;
 *  ④ le pseudo-succès « Donjon validé » n'est **plus créé ni rendu**.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
    buildChallengePatch,
    challengeNameKey,
    fetchChallengeDetail,
    siphonChallengeDetails,
    challengeIdFromCriterion,
    specialAchievementName,
    buildSpecialChallengePatch,
    fetchSpecialChallengeForBoss,
    siphonSpecialAchievements,
    type ChallengeRow,
} from "@/lib/achievement-details-siphon";
import { getAchievementIconUrl, getDungeonAchievementIconUrl } from "@/lib/achievement-icon";

const read = (path: string) => readFileSync(path, "utf8");
const PROXY = read("src/app/api/assets-dofus/[type]/[id]/route.ts");

/** Payload DofusDB réel (extrait mesuré le 11/10/2026 pour « Passer l'éponge »). */
const DOFUSDB_CHALLENGE = {
    id: 979,
    name: { fr: "Passer l'éponge" },
    description: {
        fr: "À partir du tour 2, Mob l'éponge doit être poussé ou attiré au moins une fois à chaque tour global.",
    },
    iconId: 977,
    img: "https://api.dofusdb.fr/img/challenges/977.png",
    activationCriterion: "GM>0,928,1&Gm=d",
    completionCriterion: "Ma=1",
};

function jsonResponse(payload: unknown) {
    return { ok: true, json: async () => payload } as unknown as Response;
}

function fakeDb(rows: ChallengeRow[]) {
    const written: Array<{ id: string; data: Record<string, unknown> }> = [];
    return {
        written,
        db: {
            challenge: {
                findMany: async () => rows,
                update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
                    written.push({ id: args.where.id, data: args.data });
                },
            },
        },
    };
}

describe("passerelle DofusDB — garde d'identité et conditions lues", () => {
    it("la clé de nom ignore accents/casse/ponctuation", () => {
        expect(challengeNameKey("Passer l'éponge")).toBe(challengeNameKey("passer l eponge"));
        expect(challengeNameKey("Passer l'éponge")).not.toBe(challengeNameKey("Passer la serviette"));
    });

    it("construit le patch : VRAIE description, icône du proxy, critères BRUTS", () => {
        const patch = buildChallengePatch(DOFUSDB_CHALLENGE);
        expect(patch?.description).toBe(DOFUSDB_CHALLENGE.description.fr);
        expect(patch?.iconUrl).toBe("/api/assets-dofus/challenges/977");
        expect(patch?.conditions).toEqual({ activationCriterion: "GM>0,928,1&Gm=d", completionCriterion: "Ma=1" });
    });

    it("ne fabrique rien : sans description ou sans iconId, aucun patch", () => {
        expect(buildChallengePatch({ ...DOFUSDB_CHALLENGE, description: { fr: "" } })).toBeNull();
        expect(buildChallengePatch({ ...DOFUSDB_CHALLENGE, iconId: -1 })).toBeNull();
    });

    it("un nom qui ne correspond pas ⇒ null (jamais « le premier résultat »)", async () => {
        const autre = async () =>
            jsonResponse({ data: [{ ...DOFUSDB_CHALLENGE, name: { fr: "Passer la serviette" } }] });
        expect(await fetchChallengeDetail("Passer l'éponge", autre as never)).toBeNull();
        const ok = async () => jsonResponse({ data: [DOFUSDB_CHALLENGE] });
        expect(await fetchChallengeDetail("passer l eponge", ok as never)).not.toBeNull();
    });
});

describe("passe de siphon — idempotente, et la simulation n'écrit rien", () => {
    const INCOMPLETE: ChallengeRow[] = [
        { id: "c1", name: "Passer l'éponge", description: "Vaincre tel boss en validant le challenge dédié.", iconUrl: null },
    ];
    const COMPLETE: ChallengeRow[] = [
        { id: "c2", name: "Passer l'éponge", description: DOFUSDB_CHALLENGE.description.fr, iconUrl: "/api/assets-dofus/challenges/977" },
    ];

    it("un challenge déjà complet n'est ni relu ni réécrit", async () => {
        const { db, written } = fakeDb(COMPLETE);
        const jamais = async () => {
            throw new Error("ne doit pas être appelé");
        };
        const report = await siphonChallengeDetails({ db, apply: true, fetchImpl: jamais as never });
        expect(report.alreadyOk).toBe(1);
        expect(report.updated).toBe(0);
        expect(written).toHaveLength(0);
    });

    it("simulation (apply=false) : compte ce qui serait fait, n'écrit AUCUNE ligne", async () => {
        const { db, written } = fakeDb(INCOMPLETE);
        const report = await siphonChallengeDetails({
            db,
            apply: false,
            fetchImpl: (async () => jsonResponse({ data: [DOFUSDB_CHALLENGE] })) as never,
        });
        expect(report.updated).toBe(1);
        expect(report.written).toBe(0);
        expect(written).toHaveLength(0);
    });

    it("apply=true écrit la description réelle, l'icône du proxy et les conditions", async () => {
        const { db, written } = fakeDb(INCOMPLETE);
        const report = await siphonChallengeDetails({
            db,
            apply: true,
            fetchImpl: (async () => jsonResponse({ data: [DOFUSDB_CHALLENGE] })) as never,
        });
        expect(report.written).toBe(1);
        expect(written[0].data.description).toBe(DOFUSDB_CHALLENGE.description.fr);
        expect(written[0].data.iconUrl).toBe("/api/assets-dofus/challenges/977");
    });

    it("un challenge introuvable chez DofusDB reste intact (compté, jamais inventé)", async () => {
        const { db, written } = fakeDb(INCOMPLETE);
        const report = await siphonChallengeDetails({
            db,
            apply: true,
            fetchImpl: (async () => jsonResponse({ data: [] })) as never,
        });
        expect(report.missing).toBe(1);
        expect(written).toHaveLength(0);
    });
});

describe("le cron de nuit complète les succès tout seul (aucune intervention sur le VPS)", () => {
    it("passe branchée dans `sync-monster-stats`, bornée, idempotente, coupée sous Vitest", () => {
        // Pourquoi pas un script à lancer à la main sur le VPS : l'image de prod ne contient ni
        // `src/` ni tsconfig ⇒ un script qui importe du TS n'y tourne pas, et les bases ne publient
        // aucun port. Brancher la passe dans un cron **existant** = zéro ligne crontab, zéro accès
        // shell (même choix que le siphon des boss d'anomalie).
        const cron = read("src/app/api/cron/sync-monster-stats/route.ts");
        expect(cron).toContain('const { siphonChallengeDetails } = await import("@/lib/achievement-details-siphon");');
        expect(cron).toMatch(/siphonChallengeDetails\(\{ db: db as any, apply: true, limit: 25 \}\)/);
        expect(cron).toMatch(/if \(process\.env\.VITEST !== "true"\) \{/);
        expect(cron).toContain("achievementsSiphoned");
    });
});

describe("icône de succès — proxy d'abord, plus de case noire", () => {
    it("une icône DofusDB connue passe par le proxy interne", () => {
        expect(getAchievementIconUrl("passer-eponge", DOFUSDB_CHALLENGE.img)).toBe("/api/assets-dofus/challenges/977");
        expect(getAchievementIconUrl(null, "https://api.dofusdb.fr/img/achievements/10.png")).toBe(
            "/api/assets-dofus/achievements/10"
        );
    });

    it("sans icône DofusDB : asset local historique, sinon null (repli Trophy)", () => {
        expect(getAchievementIconUrl("blitzkrieg", null)).toBe("/game-data/achievements/blitzkrieg.png");
        expect(getAchievementIconUrl(null, null)).toBeNull();
        // Un hôte tiers n'est jamais publié (repli local, puis null).
        expect(getAchievementIconUrl("blitzkrieg", "https://evil.example.com/x.png")).toBe(
            "/game-data/achievements/blitzkrieg.png"
        );
    });

    it("le proxy connaît les deux nouveaux espaces d'icône", () => {
        expect(PROXY).toMatch(/const validTypes = \['monsters', 'items', 'spells', 'challenges', 'achievements'\] as const;/);
        expect(PROXY).toContain("`https://api.dofusdb.fr/img/${assetType}/${safeId}.png`");
    });
});

describe("icône d'un succès de donjon — interne et public résolvent PAREIL (plus d'orange perdu)", () => {
    it("préfère l'icône propre au succès (DungeonAchievement.imageUrl) via le proxy", () => {
        expect(
            getDungeonAchievementIconUrl({
                imageUrl: "https://api.dofusdb.fr/img/achievements/10.png",
                challenge: { slug: "special", iconUrl: "/game-data/achievements/special.png" },
            }),
        ).toBe("/api/assets-dofus/achievements/10");
    });

    it("repli sur l'icône du challenge (proxy d'abord) quand le succès n'a pas la sienne", () => {
        expect(
            getDungeonAchievementIconUrl({
                imageUrl: null,
                challenge: { slug: "passer-eponge", iconUrl: "https://api.dofusdb.fr/img/challenges/977.png" },
            }),
        ).toBe("/api/assets-dofus/challenges/977");
    });

    it("repli final : asset local du slug, sinon null (jamais un chemin brut)", () => {
        expect(getDungeonAchievementIconUrl({ imageUrl: null, challenge: { slug: "duo", iconUrl: null } })).toBe(
            "/game-data/achievements/duo.png",
        );
        expect(getDungeonAchievementIconUrl(null)).toBeNull();
    });
});

describe("succès « spéciaux » par donjon — le vrai intitulé remplace le placeholder « Spécial »", () => {
    /** Payloads DofusDB réels (mesurés le 12/10/2026). */
    const ACHIEVEMENT = { id: 6150, name: { fr: "Mob l'Éponge (Spécial)" }, iconId: 10, objectives: [{ criterion: "(EH>979,0)" }] };
    const CHALLENGE = {
        id: 979,
        name: { fr: "Passer l'éponge" },
        description: { fr: "À partir du tour 2, Mob l'éponge doit être poussé ou attiré au moins une fois à chaque tour global." },
        iconId: 977,
        activationCriterion: "GM>0,928,1&Gm=d",
        completionCriterion: "Ma=1",
    };

    it("extrait l'id du challenge réel depuis le critère d'objectif", () => {
        expect(challengeIdFromCriterion("(EH>979,0)")).toBe(979);
        expect(challengeIdFromCriterion("PL>19")).toBeNull();
        expect(specialAchievementName("Mob l'Eponge")).toBe("Mob l'Eponge (Spécial)");
    });

    it("construit le patch : nom + description + icônes RÉELS (proxy)", () => {
        const patch = buildSpecialChallengePatch(ACHIEVEMENT, CHALLENGE);
        expect(patch?.challengeName).toBe("Passer l'éponge");
        expect(patch?.iconUrl).toBe("/api/assets-dofus/challenges/977");
        expect(patch?.achievementImageUrl).toBe("/api/assets-dofus/achievements/10");
        expect(patch?.description).toBe(CHALLENGE.description.fr);
    });

    it("ne fabrique rien sans identité complète", () => {
        expect(buildSpecialChallengePatch(ACHIEVEMENT, { ...CHALLENGE, iconId: 0 })).toBeNull();
        expect(buildSpecialChallengePatch(ACHIEVEMENT, { ...CHALLENGE, description: { fr: "" } })).toBeNull();
    });

    it("résout le succès par NOM (garde d'identité) puis le challenge", async () => {
        const fetchImpl = (async (url: string) =>
            jsonResponse(
                url.includes("/achievements?") ? { data: [ACHIEVEMENT] } : CHALLENGE,
            )) as never;
        const patch = await fetchSpecialChallengeForBoss("Mob l'Eponge", fetchImpl);
        expect(patch?.challengeName).toBe("Passer l'éponge");
    });

    it("un succès introuvable ⇒ null (jamais le premier résultat)", async () => {
        const fetchImpl = (async () =>
            jsonResponse({ data: [{ ...ACHIEVEMENT, name: { fr: "Autre (Spécial)" } }] })) as never;
        expect(await fetchSpecialChallengeForBoss("Mob l'Eponge", fetchImpl)).toBeNull();
    });

    it("dry-run : compte les updates mais n'écrit rien ; apply : re-pointe vers le challenge réel", async () => {
        const row = {
            id: "da1",
            imageUrl: null,
            dungeon: { bossName: "Mob l'Eponge", name: "Donjon" },
            challenge: { id: "c-generic", name: "Spécial", slug: "sp-cial" },
        };
        const written: Array<{ op: string; args: any }> = [];
        const makeDb = () => ({
            dungeonAchievement: {
                findMany: async () => [row],
                update: async (args: any) => written.push({ op: "update", args }),
            },
            challenge: {
                findFirst: async () => null,
                create: async (args: any) => {
                    written.push({ op: "create", args });
                    return { id: "c-real" };
                },
                update: async (args: any) => written.push({ op: "challengeUpdate", args }),
            },
        });
        const fetchImpl = (async (url: string) =>
            jsonResponse(url.includes("/achievements?") ? { data: [ACHIEVEMENT] } : CHALLENGE)) as never;

        const dryRun = await siphonSpecialAchievements({ db: makeDb() as any, apply: false, fetchImpl });
        expect(dryRun.updated).toBe(1);
        expect(dryRun.written).toBe(0);
        expect(written).toHaveLength(0);

        const applied = await siphonSpecialAchievements({ db: makeDb() as any, apply: true, fetchImpl });
        expect(applied.written).toBe(1);
        expect(written.some((w) => w.op === "create" && w.args.data.name === "Passer l'éponge")).toBe(true);
        const rePoint = written.find((w) => w.op === "update");
        expect(rePoint?.args.data.challengeId).toBe("c-real");
        expect(rePoint?.args.data.imageUrl).toBe("/api/assets-dofus/achievements/10");
    });
});

describe("le cron complète aussi les succès spéciaux (borné, coupé sous Vitest)", () => {
    it("passe branchée dans `sync-monster-stats`", () => {
        const cron = read("src/app/api/cron/sync-monster-stats/route.ts");
        expect(cron).toContain('const { siphonSpecialAchievements } = await import("@/lib/achievement-details-siphon");');
        expect(cron).toMatch(/siphonSpecialAchievements\(\{ db: db as any, apply: true, limit: 10 \}\)/);
    });
});

describe("« Donjon validé » — plus créé, plus rendu", () => {
    it("la fiche publique l'écarte et n'affiche plus de phrase générique", () => {
        const tab = read("src/app/boss/[dungeonId]/_components/PublicBossAchievementsTab.tsx");
        expect(tab).toContain("NO_ACHIEVEMENT_CHALLENGE_SLUG");
        expect(tab).toMatch(/achievements\.filter\(\(a\) => a\.slug !== NO_ACHIEVEMENT_CHALLENGE_SLUG\)/);
        expect(tab).not.toContain("pour l&apos;obtenir");
    });

    it("le hub ET « Mes Succès » ne le reçoivent plus du tout (filtre à la source)", () => {
        // `SuccesTracker` compte `achievements.length` (totaux + « tranches complètes ») : sans ce
        // filtre, le pseudo-succès restait comptabilisé côté interne, même après le retrait du rendu.
        const actions = read("src/server/actions/game-data-actions.ts");
        expect(actions).toContain('import { NO_ACHIEVEMENT_CHALLENGE_SLUG } from "@/lib/dungeon-no-achievement"');
        expect(actions).toMatch(/achievement\?\.challenge\?\.slug !== NO_ACHIEVEMENT_CHALLENGE_SLUG/);
    });

    it("l'outil d'exploitation existe, en dry-run par défaut", () => {
        const script = read("scripts/succes-speciaux.ts");
        expect(script).toContain("siphonChallengeDetails");
        expect(script).toContain('"retirer-donjon-valide"');
        expect(script).toMatch(/--apply/);
        expect(script).toMatch(/if \(!apply\)/);
    });
});

