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
    isChallengeDetailComplete,
    isPlaceholderChallengeDescription,
    isSpecialAchievementRow,
    findSpecialAchievement,
    nestedChallengeOf,
    specialAchievementKey,
    buildSpecialChallengePatch,
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

    it("un chemin local STOCKÉ prime sur le slug — bug « Spécial » (l'accent est perdu par le slug)", () => {
        // Mesure du 12/10/2026 (`select slug, \"iconUrl\" from \"Challenge\"`) : le challenge est
        // seedé `slug: "sp-cial"` (le slugifier transforme « é » en « - ») avec
        // `iconUrl: "/game-data/achievements/spécial.png"` — et ce fichier **existe** au dépôt.
        // Reconstruire le chemin depuis le slug demandait `sp-cial.png` ⇒ 404 + case noire.
        //
        // ⚠️ Mesure du 16/10/2026 : l'URL encodée de `spécial.png` répondait **200** et le
        // succès restait pourtant **noir** dans les fiches interne et externe (accent dans un
        // chemin = encodage, cache d'un ancien 404, mojibake, normalisation du FS). On sert
        // donc la forme **ASCII** — le nom jumeau déjà présent au dépôt, comme les 27 autres.
        expect(getAchievementIconUrl("sp-cial", "/game-data/achievements/spécial.png")).toBe(
            "/game-data/achievements/special.png"
        );
        // Même en NFD (le « é » décomposé) : la sortie reste ASCII.
        expect(getAchievementIconUrl("sp-cial", "/game-data/achievements/spe\u0301cial.png")).toBe(
            "/game-data/achievements/special.png"
        );
        // Le repli par slug reste en vigueur quand la base ne porte AUCUN chemin.
        expect(getAchievementIconUrl("sp-cial", null)).toBe("/game-data/achievements/sp-cial.png");
        // Un hôte tiers reste ignoré même en présence d'un chemin local stocké.
        expect(getAchievementIconUrl("sp-cial", "/game-data/achievements/special.png")).toBe(
            "/game-data/achievements/special.png"
        );
    });

    it("forme PLATE (payload public) : l'icône du challenge est lue, pas seulement imageUrl", () => {
        // 🐛 Régression du 12/10/2026 : l'onglet public passe `PublicDungeonAchievement`
        // ({ imageUrl, slug, iconUrl } — le challenge est DÉPLIÉ, sans objet `challenge`).
        // La règle ne lisait que `imageUrl` (nul tant que le succès n'est pas siphonné)
        // ⇒ placeholder Trophy sur TOUS les succès (« les icônes ne s'affichent même plus »).
        expect(
            getDungeonAchievementIconUrl({
                imageUrl: null,
                slug: "duo",
                iconUrl: "/game-data/achievements/duo.png",
            })
        ).toBe("/game-data/achievements/duo.png");
        // La forme IMBRIQUÉE (lignes Prisma internes) reste servie à l'identique.
        expect(
            getDungeonAchievementIconUrl({
                imageUrl: null,
                challenge: { slug: "duo", iconUrl: "/game-data/achievements/duo.png" },
            })
        ).toBe("/game-data/achievements/duo.png");
        // L'icône PROPRE au donjon prime quand elle a été siphonnée (proxy interne).
        expect(
            getDungeonAchievementIconUrl({
                imageUrl: "https://api.dofusdb.fr/img/achievements/10.png",
                slug: "duo",
                iconUrl: "/game-data/achievements/duo.png",
            })
        ).toBe("/api/assets-dofus/achievements/10");
        expect(getDungeonAchievementIconUrl(null)).toBeNull();
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

describe("succès « spéciaux » par donjon — titre « Spécial », mécanique réelle PAR donjon", () => {
    /** Payloads DofusDB réels (mesurés le 12/10/2026 + le 10/12/2026). */
    const CHALLENGE = {
        id: 979,
        className: "ChallengeData",
        name: { fr: "Passer l'éponge" },
        description: { fr: "À partir du tour 2, Mob l'éponge doit être poussé ou attiré au moins une fois à chaque tour global." },
        iconId: 977,
    };
    /** 🔑 Le challenge voyage **imbriqué** dans le critère d'objectif (`readableCriterion`). */
    const ACHIEVEMENT = {
        id: 6150,
        name: { fr: "Mob l'Éponge (Spécial)" },
        iconId: 10,
        objectives: [{ criterion: "(EH>979,0)", readableCriterion: [["Avoir réussi le challenge ", CHALLENGE]] }],
    };

    it("extrait l'id du challenge réel depuis le critère d'objectif", () => {
        expect(challengeIdFromCriterion("(EH>979,0)")).toBe(979);
        expect(challengeIdFromCriterion("PL>19")).toBeNull();
        expect(specialAchievementKey("Mob l'Éponge (Spécial)")).toBe("mobleponge");
        expect(specialAchievementKey("Tynrils (Spécial)")).toBe("tynrils");
    });

    it("construit le patch : la mécanique réelle + l'icône du succès (proxy)", () => {
        const patch = buildSpecialChallengePatch(ACHIEVEMENT, CHALLENGE);
        expect(patch?.description).toBe(CHALLENGE.description.fr);
        expect(patch?.achievementImageUrl).toBe("/api/assets-dofus/achievements/10");
    });

    it("ne fabrique rien sans identité complète", () => {
        expect(buildSpecialChallengePatch(ACHIEVEMENT, { ...CHALLENGE, iconId: 0 })).toBeNull();
        expect(buildSpecialChallengePatch(ACHIEVEMENT, { ...CHALLENGE, description: { fr: "" } })).toBeNull();
    });

    it("le challenge est lu **imbriqué** (aucune requête par boss)", () => {
        expect(nestedChallengeOf(ACHIEVEMENT)?.id).toBe(979);
        expect(nestedChallengeOf({ objectives: [{ criterion: "PL>19" }] })).toBeNull();
        expect(nestedChallengeOf({ objectives: [{ criterion: "(EH>979,0)" }] })).toBeNull();
    });

    it("apparie le boss par libellé : exact, préfixe (`Tynril` → `Tynrils`), puis par MOTS", () => {
        const index = new Map<string, any>([
            ["mobleponge", ACHIEVEMENT],
            ["tynrils", { id: 6204, name: { fr: "Tynrils (Spécial)" } }],
            ["blopindigo", { id: 3, name: { fr: "Blop Indigo (Spécial)" } }],
            ["blopcoco", { id: 4, name: { fr: "Blop Coco (Spécial)" } }],
            ["grozillaetgrasmerasomnambules", { id: 5, name: { fr: "Grozilla et Grasmera Somnambules (Spécial)" } }],
        ]);
        expect(findSpecialAchievement(index, "Mob l'Éponge")?.id).toBe(6150);
        // 🐛 Mesure du 10/12/2026 (constat user « ton scraping est forcément mauvais ») : le lookup
        // par nom exact ratait `Tynril` → **`Tynrils (Spécial)`** (id 6204).
        expect(findSpecialAchievement(index, "Tynril")?.id).toBe(6204);
        // Libellé qui ne partage pas le préfixe : on exige TOUS les mots du boss (mesure : DofusDB
        // nomme « Grozilla et Grasmera Somnambules » là où notre donjon dit « Grozilla Somnambule »).
        expect(findSpecialAchievement(index, "Grozilla Somnambule")?.id).toBe(5);
        // Deux candidats et un seul mot ⇒ AUCUN (jamais « le premier venu »), ni pour un nom vide.
        expect(findSpecialAchievement(index, "Blop")).toBeNull();
        expect(findSpecialAchievement(index, "")).toBeNull();
    });

    /** Ligne « Spécial » nominale : jamais touchée par une passe antérieure (seed `imageUrl: null`). */
    const rowSpeciale = {
        id: "da1",
        description: null as string | null,
        imageUrl: null as string | null,
        dungeon: { bossName: "Mob l'Eponge", name: "Donjon" },
        challenge: { id: "c-generic", name: "Spécial", slug: "sp-cial" },
    };
    const genericChallenge = { id: "c-generic", name: "Spécial", slug: "sp-cial" };

    it("dry-run : compte les updates mais n'écrit rien ; apply : « Spécial » + texte du donjon", async () => {
        const written: Array<{ op: string; args: any }> = [];
        const makeDb = () => ({
            dungeonAchievement: {
                findMany: async () => [rowSpeciale],
                update: async (args: any) => written.push({ op: "update", args }),
            },
            challenge: { findFirst: async () => genericChallenge },
        });
        // La passe charge **l'index** des « (Spécial) » (`name.fr[$regex]`) — une seule fois.
        const fetchImpl = (async (url: string) =>
            jsonResponse(url.includes("%24regex") ? { data: [ACHIEVEMENT] } : { data: [] })) as never;

        const dryRun = await siphonSpecialAchievements({ db: makeDb() as any, apply: false, fetchImpl });
        expect(dryRun.updated).toBe(1);
        expect(dryRun.written).toBe(0);
        expect(written).toHaveLength(0);

        const applied = await siphonSpecialAchievements({ db: makeDb() as any, apply: true, fetchImpl });
        expect(applied.written).toBe(1);
        const rePoint = written.find((w) => w.op === "update");
        // Le titre affiché reste « Spécial » : la ligne RESTE sur le challenge **partagé**…
        expect(rePoint?.args.data.challengeId).toBe("c-generic");
        // …et c'est la **mécanique du donjon** qui est écrite sur le succès.
        expect(rePoint?.args.data.description).toBe(CHALLENGE.description.fr);
        expect(rePoint?.args.data.imageUrl).toBe("/api/assets-dofus/achievements/10");
    });

    it("une ligne re-pointée par une passe ANTÉRIEURE (imageUrl posée) est récupérée", () => {
        // « Meulou y es-tu ? » avait remplacé le titre « Spécial » : on la ramène (marqueur = `imageUrl`).
        expect(
            isSpecialAchievementRow({
                imageUrl: "/api/assets-dofus/achievements/20",
                challenge: { id: "c-real", name: "Meulou y es-tu ?", slug: "meulou-y-es-tu" },
            })
        ).toBe(true);
        expect(isSpecialAchievementRow(rowSpeciale)).toBe(true);
        // Un succès ordinaire (« Duo ») n'a jamais d'`imageUrl` posée par cette passe : jamais touché.
        expect(
            isSpecialAchievementRow({ imageUrl: null, challenge: { id: "c2", name: "Duo", slug: "duo" } })
        ).toBe(false);
    });

    it("ligne déjà complète : aucune requête réseau, aucun budget consommé", async () => {
        const jamais = async () => {
            throw new Error("aucun appel réseau attendu");
        };
        const db = {
            dungeonAchievement: {
                findMany: async () => [
                    { ...rowSpeciale, description: CHALLENGE.description.fr, imageUrl: "/api/assets-dofus/achievements/10" },
                ],
                update: async () => {},
            },
            challenge: { findFirst: async () => genericChallenge },
        };
        const report = await siphonSpecialAchievements({ db: db as any, apply: true, fetchImpl: jamais as never });
        expect(report.alreadyOk).toBe(1);
        expect(report.updated).toBe(0);
        expect(report.written).toBe(0);
    });

    it("notre budget partagé fermé (429 local) ⇒ « différé », JAMAIS « introuvable »", async () => {
        // Mesure du 10/12/2026 : 82 succès déclarés « introuvables » alors que `Batofu (Spécial)`
        // répondait `total: 1` — c'était ce 429 **local** (30 req/min) maquillé en absence.
        const throttle = () =>
            ({
                ok: false,
                status: 429,
                headers: {
                    get: (name: string) => (name.toLowerCase() === "x-sigilos-throttle" ? "local" : "1"),
                },
                json: async () => ({}),
            }) as unknown as Response;
        const db = {
            dungeonAchievement: {
                findMany: async () => [{ ...rowSpeciale, dungeon: { bossName: "Batofu", name: "Donjon du Batofu" } }],
                update: async () => {},
            },
            challenge: { findFirst: async () => genericChallenge },
        };
        const report = await siphonSpecialAchievements({
            db: db as any,
            apply: true,
            fetchImpl: (async () => throttle()) as never,
        });
        expect(report.deferred).toBe(true);
        expect(report.missing).toBe(0);
        expect(report.errors).toBe(0);
        expect(report.written).toBe(0);
    });
});

describe("le cron complète aussi les succès spéciaux (borné, coupé sous Vitest)", () => {
    it("passe branchée dans `sync-monster-stats`", () => {
        const cron = read("src/app/api/cron/sync-monster-stats/route.ts");
        expect(cron).toContain('const { siphonSpecialAchievements } = await import("@/lib/achievement-details-siphon");');
        expect(cron).toMatch(/siphonSpecialAchievements\(\{ db: db as any, apply: true, limit: 25 \}\)/);
    });
});

/**
 * 🐛 Demande user du 12/10/2026 : « je veux le vrai dialogue de la **mécanique** pour chaque
 * succès spécial de chaque boss **qui s'affiche aux gens dans la fiche du boss interne/public** ».
 *
 * Mesure de départ : la fiche **publique** affichait déjà `challenge.description` (la mécanique
 * siphonnée), mais l'**interne** non — `getDungeonDirectory` ne transmettait que le nom et
 * l'icône, et la modale donjon de la carte du monde ne peignait rien de plus.
 */
/** Le placeholder du seed n'est pas une « vraie » description : la ligne reste à siphonner. */
describe("couverture du siphon — le gabarit « Vaincre tel boss » est re-siphonné", () => {
    it("une ligne encore générique n'est PAS déclarée complète, même avec l'icône au proxy", async () => {
        const row: ChallengeRow = {
            id: "c9",
            name: "Trio",
            slug: "trio",
            description: "Vaincre tel boss dans son donjon en validant le challenge Trio.",
            iconUrl: "/api/assets-dofus/challenges/10024",
        };
        expect(isPlaceholderChallengeDescription(row.description)).toBe(true);
        expect(isChallengeDetailComplete(row)).toBe(false);

        const written: Array<{ data: Record<string, unknown> }> = [];
        const db = {
            challenge: {
                findMany: async () => [row],
                update: async (args: any) => {
                    written.push(args);
                },
            },
        };
        const fetchImpl = async () => jsonResponse({ data: [{ ...DOFUSDB_CHALLENGE, name: { fr: "Trio" } }] });
        const report = await siphonChallengeDetails({ db, apply: true, fetchImpl: fetchImpl as never });

        expect(report.updated).toBe(1);
        expect(report.written).toBe(1);
        expect(written[0].data.description).toBe(DOFUSDB_CHALLENGE.description.fr);
    });

    it("le challenge placeholder « Spécial » est écarté SANS appel réseau", async () => {
        const row: ChallengeRow = {
            id: "c10",
            name: "Spécial",
            slug: "sp-cial",
            description: "Vaincre tel boss dans son donjon en validant le challenge dédié.",
            iconUrl: null,
        };
        const jamais = async () => {
            throw new Error("aucun appel réseau attendu");
        };
        const db = { challenge: { findMany: async () => [row], update: async () => {} } };
        const report = await siphonChallengeDetails({ db, apply: true, fetchImpl: jamais as never });

        expect(report.alreadyOk).toBe(1);
        expect(report.updated).toBe(0);
        expect(report.written).toBe(0);
    });
});

describe("la mécanique réelle du succès s'affiche aussi côté INTERNE (guilde)", () => {
    const finder = read("src/server/actions/dungeon-finder-actions.ts");
    const modal = read("src/components/worldmap/DungeonDetailModal.tsx");
    const directory = read("src/components/succes/SuccesDirectory.tsx");

    it("l'annuaire transmet la mécanique PAR DONJON (sur le succès, puis le challenge)", () => {
        expect(finder).toContain("challenge: { select: { name: true, iconUrl: true, slug: true, description: true } }");
        expect(finder).toContain("description: a.description ?? a.challenge?.description ?? null");
    });

    it("la modale donjon l'affiche (parcours interne ET public)", () => {
        expect(modal).toContain("description?: string | null;");
        expect(modal).toContain("description: a.description ?? a.challenge?.description ?? null");
        expect(modal).toContain("{achv.description && (");
    });

    it("l'annuaire Succès de guilde l'affiche aussi", () => {
        expect(directory).toContain("description?: string | null;");
        expect(directory).toContain("{achv.description && (");
    });
});

/**
 * Outil d'exploitation `scripts/succes-speciaux.ts` — il doit faire **les deux passes** et être
 * **lançable sur le VPS** (bundle dans l'image).
 *
 * 🐛 Mesures du 12/10/2026 : le fichier était **cassé** (le `return` de `connectionString()`
 * avait migré **après** `void main()` ⇒ `SyntaxError` à l'exécution, invisible en CI car
 * `tsconfig.json` **exclut** `scripts/`), et il ne lançait **que** la passe « détails » — donc le
 * placeholder « Vaincre tel boss… » resté sur des donjons ne pouvait être réparé que par le cron
 * (10 donjons par passage, une fois par jour). Constat user : « j'ai toujours “Vaincre tel boss…”,
 * je dois forcer un cron ou autre action ? ».
 */
describe("outil d'exploitation des succès spéciaux — complet et lançable en production", () => {
    const script = read("scripts/succes-speciaux.ts");
    const pkg = read("package.json");
    const docker = read("Dockerfile");

    it("fait les DEUX passes (détails + succès spéciaux par donjon)", () => {
        expect(script).toContain("siphonChallengeDetails");
        expect(script).toContain("siphonSpecialAchievements");
        // Dry-run par défaut : aucune écriture sans `--apply`.
        expect(script).toContain('args.includes("--apply")');
    });

    it("ne noie jamais les lignes à traiter dans le compte rendu", () => {
        // Mesure du 10/12/2026 : 55 succès écrits ⇒ les « aucun succès (Spécial) » disparaissaient
        // dans le `slice(0, 20)`. Ils sortent maintenant **tous**, avant les succès.
        expect(script).toContain("function printDetails(");
        expect(script).toMatch(/line\.includes\("aucune écriture"\)/);
        expect(script).toContain("printDetails(special.details);");
    });

    it("sait purger les challenges orphelins (God les listait encore)", () => {
        // ⚠️ Le critère est **strict** : aucun rattachement ET `conditions` non nulles (les 28
        // challenges du seed ont `conditions: null`) — un challenge créé à la main dans God est
        // rattaché à un donjon, donc jamais visé.
        expect(script).toContain('"purger-challenges-speciaux"');
        expect(script).toContain("dungeonAchievements: { none: {} }");
        expect(script).toContain("conditions: { not: Prisma.AnyNull }");
    });

    it("le `return` de la connexion est DANS sa fonction (plus de SyntaxError)", () => {
        const connexion = script.slice(
            script.indexOf("function connectionString"),
            script.indexOf("async function runSiphon")
        );
        expect(connexion).toContain("return `${scheme}");
    });

    it("est bundlé et lançable dans le conteneur (`succes:prod`)", () => {
        expect(pkg).toContain('"succes:prod": "node scripts/succes-speciaux.js"');
        expect(pkg).toContain("outfile=scripts/succes-speciaux.js");
        expect(docker).toContain("npm run build:succes");
        // Le stage `runner` copie déjà tout `scripts/` ⇒ le bundle voyage avec l'image.
        expect(docker).toContain("COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts");
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


/**
 * Le module Donjons & Quêtes doit passer par **la même règle** que la page GOD `?tab=game-data`.
 *
 * 🐛 Récidive mesurée le 16/10/2026 : les modales DJ affichaient des icônes **assombries**
 * (champ brut / repli `?? iconUrl`) et parfois **aucune icône** — soit parce que le chemin
 * accentué (`spécial.png`) partait brut dans le `<img>`, soit parce que la liste de clôture
 * testait `Array.isArray(post.dungeonsJson)`, faux dès que le post porte l'enveloppe
 * `{ _items }` (rappels, ids de messages) ⇒ **toutes** les icônes remplacées par Trophy.
 *
 * 🐛 Même date, cause suivante (même famille) : trois succès portaient un chemin **mort**
 * (`…/econome.webp`, `…/intouchable.webp`, `…/temps-qui-court.webp` — en base, absents du dépôt)
 * et les écrans DJ rendaient `<img>` **sans repli** ⇒ glyphe « image cassée » du navigateur.
 * D'où le composant **unique** `<AchievementIcon>` (résolution + repli sur `onError`) : plus
 * aucun écran ne décide seul comment rendre une icône de succès.
 */
describe("module Donjons & Quêtes — l'icône passe par LA règle, jamais le champ brut", () => {
    const FILES = [
        "src/components/dungeon-finder/DjPostCard.tsx",
        "src/components/dungeon-finder/DjPostDetailModal.tsx",
        "src/components/dungeon-finder/DjEditModal.tsx",
        "src/components/dungeon-finder/DjCloseModal.tsx",
        "src/components/dungeon-finder/DjMultiDungeonModal.tsx",
        "src/components/dungeon-finder/DjPostCreateModal.tsx",
        "src/components/admin/ChallengeManager.tsx",
    ];

    it("aucun écran DJ ne rend l'URL stockée brute", () => {
        for (const file of FILES) {
            const src = readFileSync(file, "utf8");
            expect(src, `${file} : doit rendre l'icône par <AchievementIcon>`).toContain("<AchievementIcon");
            expect(src, `${file} : plus de normalizeChallengeIconUrl`).not.toContain("normalizeChallengeIconUrl");
            expect(src, `${file} : l'URL stockée ne part jamais dans un src`).not.toMatch(/src=\{[^}]*\.iconUrl\}/);
            // Ni la règle appelée à la main (une seule source : le composant).
            expect(src, `${file} : la résolution passe par le composant, pas par un appel local`)
                .not.toContain("getAchievementIconUrl(");
        }
    });

    it("le composant partagé résout la règle ET replie sur le glyphe (jamais d'image cassée)", () => {
        const src = readFileSync("src/components/ui/achievement-icon.tsx", "utf8");
        expect(src).toContain("getAchievementIconUrl(");
        expect(src).toContain("onError");
        expect(src).toContain("<Trophy");
        // Le repli est rendu quand il n'y a rien à charger OU que l'image a échoué.
        expect(src).toMatch(/if \(!src \|\| broken\)/);
    });

    it("la liste de clôture tolère l'enveloppe `{ _items }` (sinon zéro icône)", () => {
        const src = readFileSync("src/components/dungeon-finder/DjCloseModal.tsx", "utf8");
        expect(src).toContain("getMultiDungeons(post.dungeonsJson)");
        expect(src).not.toContain("Array.isArray(post.dungeonsJson)");
    });
});

