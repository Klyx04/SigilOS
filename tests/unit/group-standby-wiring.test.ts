/**
 * Branchement du « stand-by » (30/10/2026) — **gardes de source**.
 *
 * La règle pure est testée dans `group-standby.test.ts` ; ici on verrouille le câblage,
 * parce que c'est là que le bug coûte cher : un cron qui n'interroge pas `standBy` pinge
 * un groupe que son créateur a suspendu, et un bouton sans contrôle de créateur laisse
 * n'importe qui geler un groupe de huit personnes.
 *
 * Ce que ce fichier défend :
 *  ① les 4 crons de rappel + les relances d'inactivité **lisent** la colonne et **skippent** ;
 *  ② la clôture d'office du calendrier n'attrape pas un événement gelé ;
 *  ③ les rappels **manuels** refusent aussi (sinon la pause est un faux silence) ;
 *  ④ les 3 embeds portent le bouton, et le handler Discord compare l'auteur au créateur ;
 *  ⑤ les 3 actions serveur passent par `canToggleStandBy` / `buildStandBy` ;
 *  ⑥ schéma + migration existent ensemble (sinon `SELECT standBy` casse en prod).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/** Retire commentaires et chaînes de doc : on ne verrouille que du **code**. */
function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const read = (path: string) => codeOnly(readFileSync(path, "utf8"));

describe("Crons de rappel — le stand-by suspend le ping", () => {
    it("DJ / quêtes : la colonne est lue et le post sauté AVANT tout envoi", () => {
        const code = read("src/server/dj-reminder-service.ts");
        expect(code).toMatch(/standBy: true/);
        expect(code).toMatch(/isStandByActive\(post\.standBy\)/);
        expect(code).toMatch(/bump\(STAND_BY_SKIP_REASON\)/);
        // L'ordre compte : un skip placé après l'envoi ne sert à rien.
        expect(code.indexOf("isStandByActive(post.standBy)")).toBeLessThan(
            code.indexOf("await sendChannelMessage(")
        );
    });

    it("Songes : idem, sur `run.standBy`", () => {
        const code = read("src/server/songes-reminder-service.ts");
        expect(code).toMatch(/standBy: true/);
        expect(code).toMatch(/isStandByActive\(run\.standBy\)/);
        expect(code.indexOf("isStandByActive(run.standBy)")).toBeLessThan(
            code.indexOf("await sendChannelMessage(")
        );
    });

    it("événements calendrier : refus explicite par la décision", () => {
        const code = read("src/server/event-reminder-service.ts");
        expect(code).toMatch(/standBy: true/);
        expect(code).toMatch(/isStandByActive\(event\.standBy\)/);
        expect(code).toMatch(/reason: STAND_BY_SKIP_REASON/);
    });

    it("raids : les TROIS passes (H-24, H-1, clôture) sautent un raid gelé", () => {
        const code = read("src/server/raid-reminder-service.ts");
        const skips = code.match(/isStandByActive\(event\.standBy\)/g) ?? [];
        expect(skips).toHaveLength(3);
        const selects = code.match(/standBy: true/g) ?? [];
        expect(selects).toHaveLength(3);
    });

    it("relances d'inactivité : ni relance ni clôture J+21 sur un groupe gelé", () => {
        const code = read("src/server/actions/inactive-posts-actions.ts");
        expect(code).toMatch(/isStandByActive\(post\.standBy\)/);
        expect(code).toMatch(/isStandByActive\(run\.standBy\)/);
        // Le contrôle du profil (banni/archivé) reste AVANT : un partant ferme son post.
        expect(code.indexOf('post.profile.status !== "ACTIVE"')).toBeLessThan(
            code.indexOf("isStandByActive(post.standBy)")
        );
    });
});

describe("Clôture d'office du calendrier", () => {
    it("la règle pure refuse un événement gelé", () => {
        const code = read("src/lib/calendar-auto-close.ts");
        expect(code).toMatch(/isStandBy\?: boolean/);
        expect(code).toMatch(/if \(isStandBy\) return false;/);
    });

    it("la passe de fond exclut la colonne en SQL (une passe saturée ne prive pas les autres)", () => {
        const code = read("src/server/calendar-auto-close-core.ts");
        expect(code).toMatch(/standBy: \{ equals: Prisma\.DbNull \}/);
        expect(code).toMatch(/isStandBy: isStandByActive\(event\.standBy\)/);
    });
});

describe("Rappels manuels — la pause n'est pas contournable", () => {
    it("les deux relances DJ refusent", () => {
        const code = read("src/server/actions/dungeon-finder-actions.ts");
        const refusals = code.match(/en stand-by : reprends-le avant d'envoyer/g) ?? [];
        expect(refusals).toHaveLength(2);
    });
});

describe("Embeds Discord — un bouton par module, état calculé au rendu", () => {
    it("DJ : bouton sur le post simple ET sur le chapeau multi", () => {
        const code = read("src/server/actions/dungeon-finder-actions.ts");
        expect(code).toMatch(/custom_id: `dj:standby:\$\{post\.id\}`/);
        expect(code).toMatch(/function buildDjStandByRow/);
        expect(code).toMatch(/function buildMultiChapeauRow\(guildId: string, post: any\)/);
        // Les 3 appels du chapeau passent désormais le post (sinon l'état est inconnu).
        expect((code.match(/buildMultiChapeauRow\(guildId, post\)/g) ?? []).length).toBe(3);
    });

    it("Songes : bouton + champ « Stand-by » re-rendu à chaque PATCH", () => {
        const code = read("src/server/songes-service.ts");
        expect(code).toMatch(/custom_id: `songes:standby:\$\{run\.id\}`/);
        expect(code).toMatch(/standByEmbedLine\(run\.standBy\)/);
    });

    it("Calendrier : bouton dans la publication ET dans le rafraîchissement", () => {
        const code = read("src/server/calendar-service.ts");
        expect((code.match(/custom_id: `calendar:standby:\$\{event\.id\}`/g) ?? []).length).toBe(2);
        expect((code.match(/standByEmbedLine\(event\.standBy\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
    });
});

describe("Handler Discord — seul le créateur (ou un admin côté dashboard)", () => {
    const code = read("src/app/api/discord/interactions/route.ts");

    it("le bouton est branché, une fois, avant les autres préfixes", () => {
        expect(code).toMatch(/async function handleStandByButton/);
        expect(code).toMatch(/action === "standby"/);
        expect(code).toMatch(/handleStandByButton\(\{/);
    });

    it("comparaison stricte avec le créateur, refus éphémère", () => {
        expect(code).toMatch(/creatorUserId !== accountUserId/);
        expect(code).toMatch(/Seul le créateur du groupe peut le mettre en stand-by/);
        expect(code).toMatch(/return ephemeralDiscordRefusal/);
    });

    it("la réponse part avant l'édition de l'embed (`after`)", () => {
        const handler = code.slice(code.indexOf("async function handleStandByButton"));
        expect(handler).toMatch(/after\(async \(\) => \{/);
        expect(handler.indexOf("after(async")).toBeLessThan(handler.indexOf("return ephemeralDiscordMessage("));
    });

    it("isolation de guilde : chaque cible est relue avec `guildId`, les miroirs refusés", () => {
        const handler = code.slice(code.indexOf("async function handleStandByButton"));
        expect(handler).toMatch(/guildId: guildConfig\.id/);
        expect(handler).toMatch(/isAgendaMirror\(event\.metadata\)/);
    });
});

describe("Actions serveur — autorisation et écriture uniques", () => {
    it("DJ : créateur ou admin, écriture par `buildStandBy`", () => {
        const code = read("src/server/actions/dungeon-finder-actions.ts");
        expect(code).toMatch(/export async function setDjPostStandBy/);
        expect(code).toMatch(/canToggleStandBy\(\{ isCreator: post\.profileId === user\.profileId, isAdmin: Boolean\(user\.isAdmin\) \}\)/);
        expect(code).toMatch(/standBy: Prisma\.DbNull/);
        expect(code).toMatch(/FINDER_POST_STANDBY/);
    });

    it("Songes : leader ou admin", () => {
        const code = read("src/server/actions/songes/dream-run-actions.ts");
        expect(code).toMatch(/export async function setDreamRunStandBy/);
        expect(code).toMatch(/canToggleStandBy\(\{ isCreator: run\.leaderId === ctx\.userId/);
        expect(code).toMatch(/standBy: Prisma\.DbNull/);
    });

    it("Calendrier : créateur, admin ou gestionnaire du calendrier ; miroir refusé", () => {
        const code = read("src/server/actions/calendar-actions.ts");
        expect(code).toMatch(/export async function setEventStandBy/);
        expect(code).toMatch(/canToggleStandBy\(\{/);
        expect(code).toMatch(/if \(isAgendaMirror\(event\.metadata\)\) return \{ success: false, error: MIRROR_READONLY_ERROR \}/);
        expect(code).toMatch(/standBy: Prisma\.DbNull/);
    });
});

describe("Miroir agenda — une seule vérité", () => {
    it("la pause de la source est recopiée sur le miroir", () => {
        const code = read("src/server/agenda-mirror-sync.ts");
        const copies = code.match(/standBy: standByForMirror\(/g) ?? [];
        expect(copies).toHaveLength(4); // DJ update+create, Songes update+create
        expect(code).toMatch(/function standByForMirror/);
    });
});

describe("Schéma et migration — la colonne existe des deux côtés", () => {
    it("trois colonnes `standBy Json?` dans le schéma", () => {
        const schema = readFileSync("prisma/schema.prisma", "utf8");
        expect((schema.match(/^\s*standBy\s+Json\?/gm) ?? [])).toHaveLength(3);
    });

    it("la migration est additive et idempotente (aucune donnée réécrite)", () => {
        const sql = readFileSync("prisma/migrations/20270122000000_group_standby/migration.sql", "utf8");
        for (const table of ["DjSearchPost", "DreamRun", "GuildEvent"]) {
            expect(sql).toMatch(new RegExp(`ALTER TABLE "${table}"\\s+ADD COLUMN IF NOT EXISTS "standBy" JSONB;`));
        }
        expect(sql).not.toMatch(/\bDELETE\b|\bUPDATE\b|\bDROP\b/i);
    });
});
