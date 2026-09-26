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
import { runInOutboxFailureContext } from "@/lib/discord-outbox-context";

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

    it("alerte d'ÉCHEC métier (`success: false`) ⇒ Discord est TOUJOURS notifié (on n'éteint pas la surveillance)", async () => {
        // Mesure : 15 sites du dépôt envoient une alerte d'échec LÉGITIME (NSFW bloqué,
        // API tierce en difficulté, guilde orpheline, stockage critique, workers…).
        // Un garde-fou général « échec ⇒ jamais Discord » les aurait toutes muettes.
        await notifyGod({
            title: "NSFW bloqué",
            message: "tentative sur une preuve",
            type: "SECURITY_ALERT",
            success: false,
        });

        expect(sendChannelMessage).toHaveBeenCalledTimes(1);
    });

    it("émise PENDANT le traitement d'un échec outbox ⇒ AUCUN envoi Discord (garde-fou structurel)", async () => {
        // C'est le ciblage par CONTEXTE qui rend la boucle impossible, même si un futur
        // appelant oubliait `webOnly` : l'alerte ne peut pas retourner dans la file
        // qui vient d'échouer.
        await runInOutboxFailureContext(() =>
            notifyGod({
                title: "Panne d'écriture",
                message: "détail",
                type: "SYSTEM",
                success: false,
            }),
        );

        expect(sendChannelMessage).not.toHaveBeenCalled();
        expect(mockDb.godNotification.create).toHaveBeenCalledTimes(1);
    });

    it("le contexte est bien borné : une alerte APRÈS le traitement d'échec renotifie Discord", async () => {
        await runInOutboxFailureContext(async () => undefined);
        await notifyGod({ title: "Reprise", message: "ok", type: "SYSTEM", success: true });

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

    it("`notifyGod` coupe l'envoi Discord hors ET dans le contexte d'échec outbox", () => {
        expect(actions).toMatch(/if \(targetChannelId && !effectiveWebOnly\)/);
        expect(actions).toMatch(/const effectiveWebOnly = webOnly \|\| isOutboxFailureContext\(\)/);
        expect(actions).toMatch(/dedupeKey/);
    });

    it("le worker émet ses alertes DANS le contexte d'échec outbox (anti-boucle structurel)", () => {
        expect(worker).toMatch(/runInOutboxFailureContext\(\(\) => notifyGod\(\{/);
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

describe("notifyGod — le retour dit la VÉRITÉ sur l'envoi Discord", () => {
    /**
     * Mesure du 26/09/2026 : le bouton God « Test Alerte » annonçait « Alerte ADMIN
     * envoyée avec succès ! » alors qu'aucun message n'existait dans le salon (bot sans
     * accès / salon en pause d'écriture). Ces trois cas verrouillent le champ qui
     * permet à l'appelant de distinguer « confié à la file » de « rien n'est parti ».
     */
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.platformConfig.findUnique.mockResolvedValue({
            godNotifyChannelId: "1547020288380637305",
            godNotifyRoleId: "999",
        });
        mockDb.godNotification.create.mockResolvedValue({ id: "notif-1" });
        (rateLimit as any).mockResolvedValue({ success: true, remaining: 0, reset: Date.now() + 3_600_000 });
    });

    it("écriture confiée à la file ⇒ `discordMessageId` renseigné", async () => {
        (sendChannelMessage as any).mockResolvedValue("outbox:job-abc");

        const res = await notifyGod({
            title: "Sauvegarde Système (TEST)",
            message: "test",
            type: "SYSTEM",
            success: true,
        });

        expect(res.discordMessageId).toBe("outbox:job-abc");
    });

    it("envoi refusé par le disjoncteur (`sendChannelMessage` → null) ⇒ `discordMessageId: null`", async () => {
        (sendChannelMessage as any).mockResolvedValue(null);

        const res = await notifyGod({
            title: "Sauvegarde Système (TEST)",
            message: "test",
            type: "SYSTEM",
            success: true,
        });

        // La notif existe quand même dans la console God…
        expect(mockDb.godNotification.create).toHaveBeenCalledTimes(1);
        expect(res.success).toBe(true);
        // … mais RIEN n'est parti sur Discord : c'est ce champ que « Test Alerte » lit
        // pour ne plus annoncer un succès mensonger.
        expect(res.discordMessageId).toBeNull();
    });

    it("alerte `webOnly` ⇒ aucun envoi Discord, donc `discordMessageId: null`", async () => {
        const res = await notifyGod({ ...OUTBOX_ALERT, webOnly: true });

        expect(res.discordMessageId).toBeNull();
    });
});

