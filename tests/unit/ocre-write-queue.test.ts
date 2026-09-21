/**
 * File d'écriture Metamob (`@/lib/ocre-write-queue`) — **régression du bug du 21/09**.
 *
 * 🎯 Contexte : valider une cible depuis l'overlay envoie un PATCH par monstre à Metamob.
 * La file regroupe les clics (une écriture à la fois, respiration entre deux) et rend la
 * valeur d'avant au serveur qui refuse (429 Metamob, rate limit, réseau).
 *
 * 🐞 Bug mesuré : avec l'ancien motif (« drapeau vivant » posé au nettoyage d'un
 * `useEffect` de montage), le **double montage** de React en développement (Strict Mode
 * actif par défaut dans Next App Router depuis 13.5.1) laissait le drapeau à `false` —
 * plus aucune écriture ne partait (« le bouton + ne fait rien »). La file est désormais
 * créée DANS l'effet et détruite avec lui : le montage suivant en a une neuve.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createOcreWriteQueue, OCRE_WRITE_DEBOUNCE_MS, OCRE_WRITE_GAP_MS, type OcreWriteQueueError } from "@/lib/ocre-write-queue";

type Deferred = { id: number; qty: number; resolve: (v?: number) => void; reject: (e: Error) => void };
let sent: Array<[number, number]>;
let pending: Deferred[];

/** `send` piloté à la main : on décide quand chaque écriture réussit ou échoue. */
const makeQueue = (over: Partial<Parameters<typeof createOcreWriteQueue>[0]> = {}) =>
  createOcreWriteQueue({
    send: (id, qty) =>
      new Promise<number | undefined>((resolve, reject) => {
        sent.push([id, qty]);
        pending.push({ id, qty, resolve, reject });
      }),
    ...over,
  });

beforeEach(() => {
  sent = [];
  pending = [];
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("file d'écriture — regroupement et sérialisation", () => {
  it("regroupe une rafale : une seule écriture, avec la DERNIÈRE quantité", async () => {
    const queue = makeQueue();
    queue.push(1, 1, 0);
    queue.push(1, 2, 0);
    queue.push(1, 3, 0);
    expect(queue.pendingCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(OCRE_WRITE_DEBOUNCE_MS);
    expect(sent).toEqual([[1, 3]]);
    pending[0].resolve(3);
    await vi.advanceTimersByTimeAsync(0);
    expect(queue.pendingCount()).toBe(0);
  });

  it("n'envoie jamais deux écritures en parallèle (respiration entre les deux)", async () => {
    const queue = makeQueue();
    queue.push(1, 1, 0);
    queue.push(2, 1, 0);

    await vi.advanceTimersByTimeAsync(OCRE_WRITE_DEBOUNCE_MS);
    expect(sent).toEqual([[1, 1]]); // la 2ᵉ attend la fin de la 1ʳᵉ

    pending[0].resolve(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(sent).toEqual([[1, 1]]);

    await vi.advanceTimersByTimeAsync(OCRE_WRITE_GAP_MS);
    expect(sent).toEqual([[1, 1], [2, 1]]);
    pending[1].resolve(1);
  });

  it("prévient quand l'envoi commence et se termine", async () => {
    const states: boolean[] = [];
    const queue = makeQueue({ onBusy: (b) => states.push(b) });
    queue.push(1, 1, 0);
    await vi.advanceTimersByTimeAsync(OCRE_WRITE_DEBOUNCE_MS);
    pending[0].resolve(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(states).toEqual([true, false]);
  });
});

describe("file d'écriture — erreurs & retour arrière", () => {
  it("rend la valeur d'avant quand le serveur refuse (429 Metamob inclus)", async () => {
    const errors: Array<[number, string, number | undefined]> = [];
    const queue = makeQueue({ onError: (id, msg, revert) => errors.push([id, msg, revert]) });

    queue.push(7, 1, 0);
    await vi.advanceTimersByTimeAsync(OCRE_WRITE_DEBOUNCE_MS);
    pending[0].reject(new Error("Trop de requêtes. Veuillez patienter."));
    await vi.advanceTimersByTimeAsync(0);

    expect(errors).toEqual([[7, "Trop de requêtes. Veuillez patienter.", 0]]);
    expect(queue.pendingCount()).toBe(0);
  });

  it("vise la DERNIÈRE valeur confirmée si un pas était déjà en attente", async () => {
    const reverts: Array<number | undefined> = [];
    const queue = makeQueue({ onError: (_id, _msg, revert) => reverts.push(revert) });

    queue.push(7, 1, 0);
    await vi.advanceTimersByTimeAsync(OCRE_WRITE_DEBOUNCE_MS);
    pending[0].resolve(1);
    await vi.advanceTimersByTimeAsync(0);

    queue.push(7, 2, 1);
    await vi.advanceTimersByTimeAsync(OCRE_WRITE_DEBOUNCE_MS);
    pending[1].reject(new Error("refus"));
    await vi.advanceTimersByTimeAsync(0);

    expect(reverts).toEqual([1]);
  });

  it("garde un message lisible quand l'erreur est inconnue", async () => {
    const messages: string[] = [];
    const queue = makeQueue({ onError: (_id, msg) => messages.push(msg) });
    queue.push(1, 1, 0);
    await vi.advanceTimersByTimeAsync(OCRE_WRITE_DEBOUNCE_MS);
    pending[0].reject({} as Error);
    await vi.advanceTimersByTimeAsync(0);
    expect(messages[0]).toBe("Metamob a refusé la modification.");
  });

  it("clear() annule les écritures en attente sans rien envoyer", async () => {
    const queue = makeQueue();
    queue.push(1, 1, 0);
    queue.clear();
    await vi.advanceTimersByTimeAsync(OCRE_WRITE_DEBOUNCE_MS * 2);
    expect(sent).toEqual([]);
    expect(queue.pendingCount()).toBe(0);
  });
});

describe("file d'écriture — cycle de vie (StrictMode)", () => {
  it("une file ARRÊTÉE n'écrit plus, et le montage suivant en a une neuve qui écrit", async () => {
    // 1ᵉʳ montage suivi du nettoyage immédiat (double montage de React en dev).
    const first = makeQueue();
    first.push(1, 1, 0);
    first.stop();
    await vi.advanceTimersByTimeAsync(OCRE_WRITE_DEBOUNCE_MS * 2);
    expect(sent).toEqual([]);
    expect(first.pendingCount()).toBe(0);

    // 2ᵉ montage : la file est recréée dans l'effet → elle écrit normalement.
    const second = makeQueue();
    second.push(1, 1, 0);
    await vi.advanceTimersByTimeAsync(OCRE_WRITE_DEBOUNCE_MS);
    expect(sent).toEqual([[1, 1]]);
    pending[0].resolve(1);
    await vi.advanceTimersByTimeAsync(0);
  });

  it("un push après stop() est ignoré (aucun envoi fantôme)", async () => {
    const queue = makeQueue();
    queue.stop();
    queue.push(1, 1, 0);
    await vi.advanceTimersByTimeAsync(OCRE_WRITE_DEBOUNCE_MS * 2);
    expect(sent).toEqual([]);
  });
});


describe("file d'écriture — spam : pause au lieu de réessayer en boucle", () => {
  it("respecte le délai annoncé par le serveur avant de reprendre", async () => {
    const queue = makeQueue();
    queue.push(1, 1, 0);
    await vi.advanceTimersByTimeAsync(OCRE_WRITE_DEBOUNCE_MS);
    expect(sent).toEqual([[1, 1]]);

    // Une 2ᵉ demande est déjà en attente quand la limite tombe.
    queue.push(2, 1, 0);
    const limited = new Error("Trop de modifications en peu de temps — patiente un instant.") as OcreWriteQueueError;
    limited.pauseMs = 5_000;
    pending[0].reject(limited);
    await vi.advanceTimersByTimeAsync(0);

    expect(queue.pausedFor()).toBeGreaterThan(0);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(sent).toEqual([[1, 1]]); // la file n'a PAS réessayé

    await vi.advanceTimersByTimeAsync(1_500);
    expect(sent).toEqual([[1, 1], [2, 1]]); // puis elle reprend la demande en attente
    pending[1].resolve(1);
    await vi.advanceTimersByTimeAsync(0);
  });

  it("sans délai annoncé, la file avance simplement vers l'écriture suivante", async () => {
    const queue = makeQueue();
    queue.push(1, 1, 0);
    await vi.advanceTimersByTimeAsync(OCRE_WRITE_DEBOUNCE_MS);
    queue.push(2, 1, 0);
    pending[0].reject(new Error("Échec réseau"));
    await vi.advanceTimersByTimeAsync(0);

    expect(queue.pausedFor()).toBe(0);
    await vi.advanceTimersByTimeAsync(OCRE_WRITE_GAP_MS);
    expect(sent).toEqual([[1, 1], [2, 1]]);
    pending[1].resolve(1);
  });
});

