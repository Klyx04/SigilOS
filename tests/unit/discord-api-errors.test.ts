/**
 * Alertes Discord Outbox : classification des échecs + contenu de l'alerte God.
 *
 * Bug corrigé (18/09) — alerte reçue : « Discord Outbox : écriture abandonnée …
 * (postMessage) a échoué définitivement après 8 tentatives : Discord a refusé la
 * demande », avec pour seuls indices `jobId` (hash sha256 du payload), `kind` et
 * `attempts`. Impossible de savoir quel salon, quelle fonctionnalité, ni pourquoi
 * (statut masqué), ET 8 tentatives inutiles (~10 min + ~24 requêtes HTTP) pour un
 * refus définitif de Discord.
 */

import { describe, it, expect } from "vitest";
import {
    DiscordApiError,
    PermanentDiscordWriteError,
    buildDiscordOutboxFailureAlert,
    describeDiscordRefusal,
    getDiscordApiCode,
    getDiscordApiStatus,
    isPermanentDiscordHttpStatus,
    isPermanentDiscordWriteFailure,
} from "@/lib/discord-api-errors";

describe("isPermanentDiscordHttpStatus — rejeu inutile vs panne passagère", () => {
    it("refus PERMANENT : 4xx hors 429 (400 corps invalide, 401 token, 403 permissions, 404 salon)", () => {
        for (const status of [400, 401, 403, 404, 405, 413, 415]) {
            expect(isPermanentDiscordHttpStatus(status), `HTTP ${status}`).toBe(true);
        }
    });

    it("RETENTABLE : 429 (rate limit), 5xx et statut inconnu", () => {
        for (const status of [429, 500, 502, 503, 504, 0]) {
            expect(isPermanentDiscordHttpStatus(status), `HTTP ${status}`).toBe(false);
        }
        expect(isPermanentDiscordHttpStatus(Number.NaN)).toBe(false);
    });
});

describe("isPermanentDiscordWriteFailure — décision de retry du worker", () => {
    it("DiscordApiError 400 / 403 / 404 → définitif", () => {
        expect(isPermanentDiscordWriteFailure(new DiscordApiError("Discord a refusé la demande", 400, 50035))).toBe(true);
        expect(isPermanentDiscordWriteFailure(new DiscordApiError("Permission bloquée", 403))).toBe(true);
        expect(isPermanentDiscordWriteFailure(new DiscordApiError("Salon introuvable", 404))).toBe(true);
    });

    it("DiscordApiError 429 / 500 et erreur réseau → retentable", () => {
        expect(isPermanentDiscordWriteFailure(new DiscordApiError("rate limited", 429))).toBe(false);
        expect(isPermanentDiscordWriteFailure(new DiscordApiError("server error", 500))).toBe(false);
        expect(isPermanentDiscordWriteFailure(new Error("Failed to fetch after 3 retries"))).toBe(false);
    });

    it("PermanentDiscordWriteError → définitif, et porte le nom compris par BullMQ", () => {
        const err = new PermanentDiscordWriteError("refus", { status: 400, discordCode: 50035, channelId: "123" });
        expect(isPermanentDiscordWriteFailure(err)).toBe(true);
        // BullMQ (Job.shouldRetryJob) teste le nom : aucun retry même si le worker
        // oubliait la conversion explicite en UnrecoverableError.
        expect(err.name).toBe("UnrecoverableError");
    });

    it("une erreur quelconque nommée UnrecoverableError → définitif", () => {
        const err = new Error("boom");
        err.name = "UnrecoverableError";
        expect(isPermanentDiscordWriteFailure(err)).toBe(true);
    });
});

describe("describeDiscordRefusal — motif lisible", () => {
    it("expose statut et code Discord (jamais le corps brut — F-15)", () => {
        expect(describeDiscordRefusal(new DiscordApiError("Discord a refusé la demande", 400, 50035))).toBe(" · HTTP 400 · code 50035");
    });

    it("vide si aucun statut connu (échec réseau)", () => {
        expect(describeDiscordRefusal(new Error("network"))).toBe("");
        expect(describeDiscordRefusal(null)).toBe("");
    });

    it("lit le statut/code posés sur une erreur enrichie par le worker", () => {
        const err = Object.assign(new Error("refus"), { status: 401, discordCode: 0 });
        expect(getDiscordApiStatus(err)).toBe(401);
        expect(getDiscordApiCode(err)).toBe(0);
        expect(getDiscordApiCode(new Error("x"))).toBeUndefined();
        expect(getDiscordApiStatus(new Error("x"))).toBe(0);
    });
});

describe("buildDiscordOutboxFailureAlert — alerte God exploitable", () => {
    it("identifie le salon, la nature de l'écriture et la cause exacte", () => {
        const alert = buildDiscordOutboxFailureAlert({
            jobId: "78e8f094ee7150ebaa339875798f375dace7715622987d7bd135f000dfe8b26e",
            kind: "postMessage",
            channelId: "123456789012345678",
            attempts: 1,
            error: new PermanentDiscordWriteError("Discord a refusé la demande", {
                status: 400,
                discordCode: 50035,
                channelId: "123456789012345678",
            }),
        });

        expect(alert.title).toBe("Discord Outbox : écriture abandonnée");
        expect(alert.type).toBe("SYSTEM");
        expect(alert.success).toBe(false);
        expect(alert.ping).toBe(true);

        expect(alert.message).toContain("postMessage");
        expect(alert.message).toContain("salon 123456789012345678");
        expect(alert.message).toContain("HTTP 400");
        expect(alert.message).toContain("code 50035");
        expect(alert.message).toContain("Discord a refusé la demande");
    });

    it("n'émet que 5 champs max (limite d'affichage de notifyGod)", () => {
        const alert = buildDiscordOutboxFailureAlert({
            jobId: "job-1",
            kind: "patchMessage",
            channelId: "42",
            attempts: 8,
            error: new Error("Discord outbox: patchMessage a échoué"),
        });

        expect(Object.keys(alert.metadata)).toHaveLength(5);
        expect(alert.metadata).toMatchObject({
            jobId: "job-1",
            kind: "patchMessage",
            channelId: "42",
            attempts: 8,
        });
        // Statut inconnu (patch/delete renvoient un booléen) : signalé honnêtement.
        expect(alert.metadata.status).toBe("?");
    });

    it("reste robuste sur un job sans payload exploitable", () => {
        const alert = buildDiscordOutboxFailureAlert({ attempts: 1, error: undefined });
        expect(alert.metadata.jobId).toBe("?");
        expect(alert.message).toContain("échoué définitivement");
    });
});

