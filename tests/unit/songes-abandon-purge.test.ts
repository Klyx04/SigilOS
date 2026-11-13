import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Verrou — **une seule clôture de run Songes, et elle purge Discord**.
 *
 * Incident mesuré le 05/11/2026 : une run créée le 29/10 avait disparu du site mais son
 * sujet de forum restait vivant, boutons compris, et répondait « Cette run n'accepte plus
 * de candidatures ». Cause racine : le job `daily-cleanup` du worker passait la run en
 * `ABANDONED` au bout de **3 jours**, sans rappel ni suppression de l'embed.
 *
 * Ce que ce fichier verrouille : ① le worker ne clôture plus rien ; ② `abandonDreamRun`
 * est la seule porte, avec garde d'état **dans le WHERE** et purge de l'embed ; ③ les
 * références Discord ne sont perdues que si la suppression a réussi ; ④ le cron applique
 * la règle pure J+7/15/20/21 sur les deux statuts actifs et répare les posts déjà
 * orphelins ; ⑤ le meneur qui quitte passe par la même porte.
 *
 * Lecture seule (aucune base, aucun réseau).
 */

const read = (path: string) => readFileSync(path, "utf8");

/** Retire les commentaires : on juge le CODE, pas la prose (les docblocks citent l'ancien défaut). */
const codeOnly = (path: string) =>
    read(path)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const WORKER = "src/workers/metamob-worker.ts";
const SERVICE = "src/server/songes-service.ts";
const CRON = "src/server/inactive-posts.ts";
const ACTIONS = "src/server/actions/songes/dream-run-actions.ts";

describe("clôture d'une run Songes — une seule porte, et elle nettoie Discord", () => {
    it("le worker ne clôture plus aucune run (plus de calendrier à J+3)", () => {
        const worker = codeOnly(WORKER);
        expect(worker).not.toMatch(/status:\s*"ABANDONED"/);
        expect(worker).not.toContain("inactiveRuns");
        // Le reste du job (candidatures expirées à 24 h) est conservé.
        expect(worker).toContain("dreamJoinRequest.update");
    });

    it("`abandonDreamRun` est la seule transition, avec garde d'état et purge", () => {
        const service = codeOnly(SERVICE);
        expect(service).toContain("export async function abandonDreamRun");
        // Garde d'état DANS le WHERE : une run déjà close n'est jamais réécrite.
        expect(service).toMatch(
            /updateMany\(\{[\s\S]{0,300}status:\s*\{\s*in:\s*\["RECRUITING",\s*"IN_PROGRESS"\]/
        );
        // La purge Discord est appelée par la même porte.
        expect(service).toMatch(/abandonDreamRun[\s\S]{0,900}await deleteDiscordRunEmbed\(guildId, runId\)/);
        // Le code mort à J+3 ne revient pas.
        expect(service).not.toContain("export async function cleanupInactiveRuns");
    });

    it("les références Discord ne sont perdues que si la suppression a réussi", () => {
        const service = codeOnly(SERVICE);
        expect(service).toMatch(/const deleted = await deleteChannelMessage/);
        expect(service).toMatch(/if \(deleted\)/);
        expect(service).toMatch(/ok = false/);
        expect(service).toMatch(/return ok;/);
    });

    it("le cron applique le calendrier pur, sur les deux statuts actifs", () => {
        const cron = codeOnly(CRON);
        expect(cron).toMatch(/status:\s*\{\s*in:\s*\["RECRUITING",\s*"IN_PROGRESS"\]/);
        expect(cron).toContain("resolveSongesReminderStep(");
        expect(cron).toContain("await abandonDreamRun(guildConfig.discordGuildId, run.id)");
        // Un rappel ne doit plus avancer `updatedAt` (le bug qui repoussait J+21).
        expect(cron).toMatch(/lastReminderAt: now, updatedAt: run\.updatedAt/);
        // La réparation des posts déjà orphelins est branchée et comptée.
        expect(cron).toContain("songesEmbedsPurged");
        expect(cron).toContain("await deleteDiscordRunEmbed(orphan.guildId, orphan.id)");
    });

    it("le meneur qui quitte passe par la même porte", () => {
        const actions = codeOnly(ACTIONS);
        expect(actions).not.toMatch(/data:\s*\{\s*status:\s*"ABANDONED"/);
        expect(actions).toContain("await abandonDreamRun(guildId, runId)");
    });
});
