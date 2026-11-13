/**
 * Canal SSE — la règle de fermeture **unique** des routes `text/event-stream`.
 *
 * Ce que ces tests verrouillent (Sentry `JAVASCRIPT-NEXTJS-1T` / `1V`) :
 *   1. une fermeture est **idempotente** — deux signaux concurrents (`abort` + erreur
 *      de lecture) ne produisent jamais un second `close()` sur le contrôleur ;
 *   2. une écriture après fermeture est un **no-op silencieux**, jamais une exception ;
 *   3. le **nettoyage** (intervalles, timeouts) est joué une seule fois, quel que soit
 *      l'ordre d'arrivée des signaux.
 */

import { describe, it, expect, vi } from "vitest";
import { createSseChannel, sseFrame } from "@/lib/sse";

/** Contrôleur factice qui enregistre ce qu'on lui fait. */
function fakeController(options: { enqueueThrows?: boolean; closeThrows?: boolean } = {}) {
    const chunks: Uint8Array[] = [];
    let closes = 0;
    const controller = {
        enqueue(chunk: Uint8Array) {
            if (options.enqueueThrows) throw new TypeError("Invalid state: Controller is already closed");
            chunks.push(chunk);
        },
        close() {
            closes += 1;
            if (options.closeThrows) throw new TypeError("Invalid state: Controller is already closed");
        },
    };
    return { controller, chunks, closes: () => closes };
}

const decode = (chunk: Uint8Array) => new TextDecoder().decode(chunk);

describe("sseFrame", () => {
    it("produit une trame `data:` terminée par une ligne vide", () => {
        expect(sseFrame({ guilds: 3 })).toBe('data: {"guilds":3}\n\n');
    });
});

describe("createSseChannel", () => {
    it("envoie une trame tant que le client est connecté", () => {
        const fake = fakeController();
        const channel = createSseChannel(fake.controller);

        expect(channel.send(sseFrame({ a: 1 }))).toBe(true);
        expect(channel.open).toBe(true);
        expect(fake.chunks.map(decode)).toEqual(['data: {"a":1}\n\n']);
    });

    it("ne ferme le contrôleur qu'une seule fois malgré deux `close()`", () => {
        const fake = fakeController();
        const channel = createSseChannel(fake.controller);

        channel.close();
        channel.close();

        expect(fake.closes()).toBe(1);
        expect(channel.open).toBe(false);
    });

    it("ignore une écriture après fermeture, sans jeter", () => {
        const fake = fakeController();
        const channel = createSseChannel(fake.controller);

        channel.close();

        expect(channel.send(sseFrame({ a: 1 }))).toBe(false);
        expect(fake.chunks).toHaveLength(0);
    });

    it("bascule en fermé quand le runtime refuse l'écriture (client parti)", () => {
        const fake = fakeController({ enqueueThrows: true });
        const channel = createSseChannel(fake.controller);

        expect(channel.send(sseFrame({ a: 1 }))).toBe(false);
        expect(channel.open).toBe(false);
    });

    it("ne jette pas si le contrôleur est déjà fermé par le runtime", () => {
        const fake = fakeController({ closeThrows: true });
        const channel = createSseChannel(fake.controller);

        expect(() => channel.close()).not.toThrow();
        expect(channel.open).toBe(false);
    });

    it("joue le nettoyage une seule fois", () => {
        const fake = fakeController();
        const channel = createSseChannel(fake.controller);
        const cleanup = vi.fn();

        channel.onClose(cleanup);
        channel.close();
        channel.close();

        expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it("joue immédiatement un nettoyage enregistré après la fermeture", () => {
        const fake = fakeController();
        const channel = createSseChannel(fake.controller);
        const cleanup = vi.fn();

        channel.close();
        channel.onClose(cleanup);

        expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it("survit à une erreur du nettoyage (la fermeture reste acquise)", () => {
        const fake = fakeController();
        const channel = createSseChannel(fake.controller);

        channel.onClose(() => {
            throw new Error("boom");
        });

        expect(() => channel.close()).not.toThrow();
        expect(channel.open).toBe(false);
    });

    it("referme sans jeter un vrai contrôleur déjà détruit par le runtime", async () => {
        let captured: ReadableStreamDefaultController<Uint8Array> | undefined;
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                captured = controller;
            },
        });
        const channel = createSseChannel(captured!);

        channel.close();
        // Le runtime refuse bien un second close : c'est le bug d'origine…
        expect(() => captured!.close()).toThrow();
        // …que le canal absorbe.
        expect(() => channel.close()).not.toThrow();

        // Le flux est réellement fermé (aucune donnée en attente).
        const reader = stream.getReader();
        await expect(reader.read()).resolves.toEqual({ value: undefined, done: true });
    });
});
