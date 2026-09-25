/**
 * 🔁 Anti-boucle des alertes God — **incident mesuré le 25/09/2026**.
 *
 * Chaîne observée en bêta (`docker logs` + base) :
 *   `PlatformConfig.godNotifyChannelId` → salon où le bot n'a plus accès (403 / code 50001)
 *   → l'écriture part dans la file `discord-outbox` → refus **permanent** → pas de retry,
 *   alerte immédiate → **cette alerte repostait sur Discord via la même file** → nouveau
 *   job → nouvel échec → nouvelle alerte → …
 *
 * Résultat : **1 000 alertes et 1 000 jobs en 19 minutes** (~1 par seconde), `fin` à
 * 17:42:32, toutes vers le **même** salon.
 *
 * Ce test verrouille les deux garde-fous :
 *  ① l'alerte d'échec d'écriture est **web uniquement** (`webOnly`) : elle n'appelle
 *    jamais `sendChannelMessage` (donc ne recrée jamais de job) ;
 *  ② une panne identique ne produit qu'**une** alerte par heure (`dedupeKey`), et cette
 *    déduplication ne touche **pas** les alertes métier (don, feedback…) qui n'en fournissent pas.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@/lib/prisma", () => ({
    db: {
        platformConfig: { findUnique: vi.fn() },
        godNotification: { create: vi.fn() },
    },
}));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/server/discord", () => ({ sendChannelMessage: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { db } from "@/lib/prisma";
import { rateLimit } from "@/lib/ratelimit";
import { sendChannelMessage } from "@/server/discord";
import { notifyGod } from "@/server/actions/god-notif-actions";

const mockDb = db as any;

/** Alerte type « échec d'écriture Discord » (celle du worker outbox). */
const OUTBOX_ALERT = {
    title: "Discord Outbox : écriture abandonnée",
    message: "L'écriture Discord abc (postMessage) vers le salon 1547020288380637305 a échoué définitivement après 1 tentative(s) · HTTP 403 · code 50001",
    type: "SYSTEM" as const,
    success: false,
    ping: true,
    metadata: { jobId: "abc", kind: "postMessage", channelId: "1547020288380637305", status: 403, attempts: 1 },
};

describe("notifyGod — l'alerte d'échec d'écriture ne repart JAMAIS sur Discord", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.platformConfig.findUnique.mockResolvedValue({
            godNotifyChannelId: "1547020288380637305",
            godNotifyRoleId: "999",
        });
        mockDb.godNotification.create.mockResolvedValue({ id: "notif-1" });
        (rateLimit as any).mockResolvedValue({ success: true, remaining: 0, reset: Date.now() + 3_600_000 });
    });

    it("`webOnly` ⇒ notifiée dans la console God, mais AUCUN envoi Discord", async () => {
        const res = await notifyGod({ ...OUTBOX_ALERT, webOnly: true });

        expect(res.success).toBe(true);
        expect(mockDb.godNotification.create).toHaveBeenCalledTimes(1);
        // Le point critique : pas de `sendChannelMessage` ⇒ pas de nouveau job ⇒ pas de boucle.
        expect(sendChannelMessage).not.toHaveBeenCalled();
    });

    it("alerte normale (sans `webOnly`) ⇒ Discord est bien notifié (non-régression)", async () => {
        await notifyGod({ title: "☕ Nouveau Don Ko-fi", message: "3.00 EUR", type: "SYSTEM", success: true });

        expect(sendChannelMessage).toHaveBeenCalledTimes(1);
        const calls = (sendChannelMessage as unknown as { mock: { calls: unknown[][] } }).mock.calls;
        expect(calls[0][0]).toBe("1547020288380637305");
    });

    it("`dedupeKey` déjà alerté dans la fenêtre ⇒ ni ligne, ni envoi (anti-rafale)", async () => {
        (rateLimit as any).mockResolvedValue({ success: false, remaining: 0, reset: Date.now() });

        await notifyGod({ ...OUTBOX_ALERT, webOnly: true, dedupeKey: "discord-outbox:1547020288380637305" });

        expect(mockDb.godNotification.create).not.toHaveBeenCalled();
        expect(sendChannelMessage).not.toHaveBeenCalled();
    });

    it("la déduplication est ÉTROITE : une alerte métier (sans clé) repasse toujours", async () => {
        await notifyGod({ title: "☕ Nouveau Don Ko-fi", message: "3.00 EUR", type: "SYSTEM", success: true });
        await notifyGod({ title: "☕ Nouveau Don Ko-fi", message: "3.00 EUR", type: "SYSTEM", success: true });

        expect(mockDb.godNotification.create).toHaveBeenCalledTimes(2);
        expect(rateLimit).not.toHaveBeenCalled();
    });
});

describe("invariant : une alerte d'ÉCHEC ne repart jamais sur Discord", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.platformConfig.findUnique.mockResolvedValue({
            godNotifyChannelId: "1547020288380637305",
            godNotifyRoleId: "999",
        });
        mockDb.godNotification.create.mockResolvedValue({ id: "notif-1" });
        (rateLimit as any).mockResolvedValue({ success: true, remaining: 0, reset: Date.now() + 3_600_000 });
    });

    it("`success: false` SANS drapeau ⇒ aucun envoi Discord (c'est le DÉFAUT, pas une convention)", async () => {
        const res = await notifyGod({
            title: "Panne X",
            message: "détail",
            type: "SYSTEM",
            success: false,
            ping: true,
        });

        expect(res.success).toBe(true);
        expect(mockDb.godNotification.create).toHaveBeenCalledTimes(1);
        // Le point critique : un futur appelant qui OUBLIE `webOnly` ne peut plus
        // refermer la boucle « échec → alerte → écriture Discord → échec ».
        expect(sendChannelMessage).not.toHaveBeenCalled();
    });

    it("dérogation explicite `allowDiscordOnFailure` ⇒ un échec peut être posté (cas légitime préservé)", async () => {
        await notifyGod({
            title: "Échec métier sans rapport avec Discord",
            message: "détail",
            type: "SYSTEM",
            success: false,
            allowDiscordOnFailure: true,
        });

        expect(sendChannelMessage).toHaveBeenCalledTimes(1);
    });

    it("erreur Redis sur la déduplication ⇒ l'alerte passe quand même (un doublon vaut mieux qu'un silence)", async () => {
        (rateLimit as any).mockResolvedValue({ success: false, remaining: 0, reset: 0, error: true });

        await notifyGod({ ...OUTBOX_ALERT, webOnly: true, dedupeKey: "discord-outbox:1547020288380637305" });

        expect(mockDb.godNotification.create).toHaveBeenCalledTimes(1);
    });

    it("quota réellement dépassé (sans `error`) ⇒ toujours dédupliqué", async () => {
        (rateLimit as any).mockResolvedValue({ success: false, remaining: 0, reset: 0 });

        await notifyGod({ ...OUTBOX_ALERT, webOnly: true, dedupeKey: "discord-outbox:1547020288380637305" });

        expect(mockDb.godNotification.create).not.toHaveBeenCalled();
    });
});

describe("gardes de source — le worker outbox est bien câblé", () => {
    const worker = readFileSync("src/workers/discord-outbox-worker.ts", "utf8");
    const actions = readFileSync("src/server/actions/god-notif-actions.ts", "utf8");

    it("le worker déclare l'alerte `webOnly` avec une clé de déduplication par salon", () => {
        expect(worker).toMatch(/webOnly: true/);
        expect(worker).toMatch(/dedupeKey: `discord-outbox:\$\{failedChannelId \?\? "sans-salon"\}`/);
    });

    it("`notifyGod` coupe l'envoi Discord pour une alerte web-only (défaut d'échec inclus)", () => {
        expect(actions).toMatch(/if \(targetChannelId && !effectiveWebOnly\)/);
        expect(actions).toMatch(/const effectiveWebOnly = webOnly \|\| \(success === false && !allowDiscordOnFailure\)/);
        expect(actions).toMatch(/dedupeKey/);
    });

    it("le worker met le salon en pause, n'alerte qu'une fois par épisode et lève la pause sur succès", () => {
        // Une seule alerte par salon jusqu'à la prochaine écriture réussie : à 5 000
        // guildes, c'est la différence entre 24 alertes/jour/salon et une alerte.
        expect(worker).toMatch(/markDiscordChannelBlocked\(/);
        expect(worker).toMatch(/failureCount <= 1/);
        expect(worker).toMatch(/buildAggregateOutboxFailureAlert\(/);
        expect(worker).toMatch(/clearDiscordChannelBlock\(/);
    });

    it("le worker n'alerte PAS quand le disjoncteur est la cause de l'échec (sinon le bruit revient)", () => {
        expect(worker).toMatch(/isDiscordChannelBlockedError\(err\)/);
    });
});
