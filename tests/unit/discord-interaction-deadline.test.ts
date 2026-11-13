import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { raceWithDeadline } from "@/lib/discord/deadline";

/**
 * Budget d'attente des appels Discord dans une interaction.
 *
 * Discord exige un ACK < 3 s ; la bêta mesure un `PATCH .../messages/*` à **2,66 s**
 * au p95 (24/10/2026). On attend, mais **pas plus** qu'un budget : au-delà, la
 * promesse n'est pas annulée (elle aboutit en tâche de fond) et l'appelant journalise.
 */
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("raceWithDeadline", () => {
    it("rend la valeur quand l'appel tient dans le budget", async () => {
        const outcome = await raceWithDeadline(Promise.resolve("ok"), 50);
        expect(outcome).toEqual({ status: "done", value: "ok" });
    });

    it("bascule en timeout sans annuler l'appel (il continue derrière)", async () => {
        let finished = false;
        const slow = (async () => {
            await sleep(80);
            finished = true;
            return "trop tard";
        })();

        const outcome = await raceWithDeadline(slow, 10);
        expect(outcome.status).toBe("timeout");

        // La promesse d'origine n'est pas annulée : elle aboutit après coup.
        await slow;
        expect(finished).toBe(true);
    });

    it("ne produit pas de rejet non géré quand le délai gagne (échec tardif)", async () => {
        const failing = (async () => {
            await sleep(40);
            throw new Error("Discord 500");
        })();

        const outcome = await raceWithDeadline(failing, 5);
        expect(outcome.status).toBe("timeout");
        // Laisse la promesse rejeter : le helper a déjà branché un catch.
        await sleep(60);
    });

    it("un budget de 0 bascule immédiatement", async () => {
        const outcome = await raceWithDeadline(sleep(20).then(() => "jamais"), 0);
        expect(outcome.status).toBe("timeout");
    });
});

describe("usage dans les tickets — contrats de source", () => {
    const route = readFileSync("src/app/api/discord/interactions/route.ts", "utf8");
    const tickets = readFileSync("src/server/actions/ticket-bot-actions.ts", "utf8");

    it("l'interaction est chronométrée et une lente (> 2,5 s) est journalisée avec son chemin", () => {
        expect(route).toContain("interactionStartedAt");
        expect(route).toContain("interaction lente (> budget)");
        expect(route).toContain("interactionLabel");
    });

    it("le PATCH du message d'accueil est borné à la fermeture ET à la réouverture", () => {
        const calls = tickets.match(/await patchWelcomeWithinDeadline\(/g) ?? [];
        expect(calls).toHaveLength(2);
        expect(tickets).toContain("TICKET_PATCH_DEADLINE_MS");
        // Le dépassement est journalisé, jamais silencieux.
        expect(tickets).toContain("au-delà du budget");
    });
});
