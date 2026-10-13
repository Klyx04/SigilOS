/**
 * Sondages **programmés** — cycle de vie d'une **série récurrente** + rattrapage God.
 *
 * 🛡️ Ce que ce test protège :
 * ① la règle pure : la fin de vote d'une occurrence ne dépasse **jamais** le
 *    déclenchement suivant (une série quotidienne avec un vote de 48 h ne peut pas
 *    laisser deux sondages ouverts), et une durée nulle reste « sans date de fin » ;
 * ② l'**identité de série** : elle est une **donnée explicite**
 *    (`ScheduledPoll.seriesId`, colonne + index + migration), jamais un
 *    rapprochement par titre ou par créateur — se tromper de cible clôturerait le
 *    sondage de quelqu'un d'autre ;
 * ③ l'**ordre** : au moment de publier l'occurrence N+1, l'occurrence N est close
 *    (garde d'état dans le `WHERE`) puis son **résultat est publié**, **avant** que
 *    le nouveau sondage n'apparaisse ;
 * ④ la **propagation** : l'occurrence suivante recopie la série, et le créneau
 *    publié l'écrit — une série née avant la colonne s'identifie donc d'elle-même
 *    à sa prochaine publication ;
 * ⑤ la **fabrique unique** de résultat (clôture manuelle **et** automatique) et le
 *    **rattrapage God** des embeds (barres `%`), God uniquement, audité et borné.
 *
 * Lecture seule : code source + fonctions pures.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { expiryForOccurrence, MAX_DURATION_HOURS } from "@/lib/polls/scheduling";

const CORE = "src/server/scheduled-polls-core.ts";
const PUBLISH = "src/server/polls/publish.ts";
const POLL_ACTIONS = "src/server/actions/poll-actions.ts";
const AUDIT_ACTIONS = "src/server/actions/audit-actions.ts";
const GOD_ACTIONS = "src/server/actions/god-system-actions.ts";
const GOD_PANEL = "src/app/god/components/platform-config-panel.tsx";
const SCHEMA = "prisma/schema.prisma";
const MIGRATION = "prisma/migrations/20270104000000_add_scheduled_poll_series/migration.sql";

const source = (path: string) => readFileSync(path, "utf8");
/** Retire les commentaires : un motif interdit ne doit pas se cacher dans la prose. */
const codeOnly = (path: string) =>
    source(path)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("sondages — fin de vote d'une occurrence de série (règle pure)", () => {
    const now = new Date("2026-10-14T21:30:00.000Z");

    it("durée nulle ⇒ aucune date de fin (clôture par le cron à 30 j)", () => {
        expect(expiryForOccurrence(now, null, new Date("2026-10-15T21:30:00.000Z"))).toBeNull();
        expect(expiryForOccurrence(now, null, null)).toBeNull();
    });

    it("sans occurrence suivante, la durée demandée est respectée", () => {
        expect(expiryForOccurrence(now, 24, null)?.toISOString()).toBe("2026-10-15T21:30:00.000Z");
        expect(expiryForOccurrence(now, MAX_DURATION_HOURS, null)?.toISOString()).toBe("2026-11-13T21:30:00.000Z");
    });

    it("la fin de vote ne dépasse JAMAIS le déclenchement suivant", () => {
        const next = new Date("2026-10-15T21:30:00.000Z");
        // Série quotidienne + vote de 48 h : la fin de vote est ramenée au suivant.
        expect(expiryForOccurrence(now, 48, next)?.toISOString()).toBe(next.toISOString());
        // Vote de 12 h, suivant dans 24 h : la durée demandée est conservée.
        expect(expiryForOccurrence(now, 12, next)?.toISOString()).toBe("2026-10-15T09:30:00.000Z");
        // Garde-fou : la règle est un `min`, sans branche cachée — si une occurrence
        // suivante antérieure arrivait (cas impossible : `nextOccurrence` part de
        // `now`), c'est elle qui borne, jamais une durée plus longue.
        const past = new Date("2026-10-13T21:30:00.000Z");
        expect(expiryForOccurrence(now, 24, past)?.toISOString()).toBe(past.toISOString());
    });
});

describe("sondages — la série est une donnée explicite", () => {
    it("colonne + index dans le schéma, migration additive présente", () => {
        const schema = source(SCHEMA);
        expect(schema).toContain("seriesId          String?");
        expect(schema).toContain("@@index([guildId, seriesId])");

        const migration = source(MIGRATION);
        expect(migration).toContain('ADD COLUMN "seriesId"');
        expect(migration).toContain('CREATE INDEX "ScheduledPoll_guildId_seriesId_idx"');
        // Additif pur : aucune réécriture de données dans la migration.
        expect(migration).not.toContain("UPDATE ");
    });

    it("l'occurrence précédente se trouve par `seriesId`, jamais par contenu", () => {
        const core = codeOnly(CORE);
        const lookupStart = core.indexOf("previousSlot = await db.scheduledPoll.findFirst");
        expect(lookupStart, "recherche de l'occurrence précédente absente").toBeGreaterThan(-1);
        const lookup = core.slice(lookupStart, core.indexOf("const pollId = previousSlot"));
        // La cible est désignée par la série + l'antériorité, pas par le titre.
        expect(lookup).toContain("seriesId");
        expect(lookup).toContain("scheduledAt: { lt: before }");
        expect(lookup).not.toContain("title:");
    });

    it("la série se propage : elle est écrite sur le créneau publié et recopiée", () => {
        const core = codeOnly(CORE);
        expect(core).toContain('const seriesId = slot.repeatEvery && slot.repeatUnit ? (slot.seriesId ?? slot.id) : null');
        // Recopiée vers l'occurrence suivante ET écrite sur le créneau publié.
        const writes = core.match(/seriesId,/g) || [];
        expect(writes.length).toBeGreaterThanOrEqual(2);
    });
});

describe("sondages — l'occurrence précédente est close, son résultat publié", () => {
    it("la clôture a lieu AVANT la publication de la nouvelle occurrence", () => {
        const core = codeOnly(CORE);
        const close = core.indexOf("closePreviousSeriesOccurrence(slot.guild.id");
        const publish = core.indexOf("publishPollToDiscord(discordGuildId, pollId, channelId");
        expect(close, "appel de clôture absent").toBeGreaterThan(-1);
        expect(publish, "publication de l'embed absente").toBeGreaterThan(-1);
        expect(close).toBeLessThan(publish);
    });

    it("le gel du vote porte la garde d'état dans le WHERE (jamais de course)", () => {
        const core = codeOnly(CORE);
        expect(core).toMatch(
            /updateMany\(\{\s*where: \{ id: previousPoll\.id, status: "ACTIVE" \},\s*data: \{ status: "CLOSED", closedAt: now \}/
        );
        // Une occurrence déjà close (ou supprimée) n'est jamais retraitée.
        expect(core).toContain('if (!previousPoll || previousPoll.status !== "ACTIVE") return null');
    });

    it("le résultat vient de la fabrique UNIQUE (clôture auto ET manuelle)", () => {
        const publish = codeOnly(PUBLISH);
        expect(publish).toContain("export async function publishPollResultToDiscord");
        // Un seul endroit construit le bloc de résultats, dans tout le module.
        const all = codeOnly(CORE) + publish + codeOnly(POLL_ACTIONS);
        expect(all.match(/## 📊 Résultats du vote/g)?.length).toBe(1);
        // … et la clôture manuelle y délègue (plus de rendu local dans les actions).
        const actions = codeOnly(POLL_ACTIONS);
        expect(actions).toContain("publishPollResultToDiscord(discordGuildId, pollId");
        expect(actions).not.toContain("getProgressBar");
    });

    it("l'embed de vote précédent est retiré (jamais deux embeds cliquables)", () => {
        const core = codeOnly(CORE);
        expect(core).toContain("deleteChannelMessage(previousPoll.discordChannelId, previousPoll.discordMessageId)");
    });
});

describe("God — rattrapage des embeds de sondages (barres de %)", () => {
    it("la publication sait dire ce qu'elle a fait (dont « ID non résolu »)", () => {
        const publish = codeOnly(PUBLISH);
        expect(publish).toContain("export type PollPublishOutcome");
        expect(publish).toContain('return "updated"');
        expect(publish).toContain('return "unresolved"');
        expect(publish).toContain('return "sent"');
    });

    it("l'action God est ouverte par `isSuperAdmin`, bornée et auditée", () => {
        const god = codeOnly(GOD_ACTIONS);
        const start = god.indexOf("export async function godRefreshPollEmbeds");
        expect(start, "action de rattrapage absente").toBeGreaterThan(-1);
        const action = god.slice(start, god.indexOf("export async function godProcessInactivePosts"));
        expect(action).toContain("await isSuperAdmin()");
        expect(action).toContain('if (!isAdmin) return { success: false, error: "Non autorisé" }');
        expect(action).toContain("GOD_POLL_EMBED_RESYNC_LIMIT");
        expect(action).toContain('action: "GOD_POLL_EMBED_RESYNC"');
        // Édition du message existant : jamais un nouveau message, jamais un ping.
        expect(action).toMatch(/publishPollToDiscord\([\s\S]{0,220}?undefined,\s*true,?\s*\)/);
        expect(action).not.toContain("console.log");
        expect(codeOnly(AUDIT_ACTIONS)).toContain('"GOD_POLL_EMBED_RESYNC"');
    });

    it("le bouton vit dans l'écran God, nulle part côté guilde", () => {
        const panel = codeOnly(GOD_PANEL);
        expect(panel).toContain("godRefreshPollEmbeds");
        expect(panel).toContain("Rattrapage des embeds de sondages");
        expect(panel).toContain("Lancer le rattrapage maintenant");
        expect(codeOnly(POLL_ACTIONS)).not.toContain("refreshPollEmbeds");
    });
});
