/**
 * Status ping Discord — garde-fou anti-spam + living status robuste.
 * - `resolveStatusFrequency` : le réglage God 5m/15m/1h est assaini (défaut 15).
 * - `shouldSkipStatusPing` : on saute les ticks redondants (1 seul embed, pas 1/tick).
 * - `isDiscordSnowflake` : un ID stocké non-snowflake (ex. `outbox:<jobId>`)
 *   ne doit jamais servir au PATCH living (cause de spam en boucle).
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ db: {} }));
vi.mock("@/lib/redis", () => ({ redis: {} }));
vi.mock("@/server/discord", () => ({
    sendChannelMessage: vi.fn(),
    updateChannelMessage: vi.fn(),
}));

import {
    isDiscordSnowflake,
    resolveStatusFrequency,
    shouldSkipStatusPing,
    STATUS_PING_DEFAULT_FREQUENCY_MIN,
} from "@/server/status-ping-core";

describe("isDiscordSnowflake", () => {
    it("accepte les snowflakes Discord (15-21 chiffres)", () => {
        expect(isDiscordSnowflake("1468401237136707588")).toBe(true);
        expect(isDiscordSnowflake("123456789012345")).toBe(true);
        expect(isDiscordSnowflake("123456789012345678901")).toBe(true);
    });

    it("rejette tout le reste (dont les IDs outbox)", () => {
        expect(isDiscordSnowflake("outbox:abc123")).toBe(false);
        expect(isDiscordSnowflake(null)).toBe(false);
        expect(isDiscordSnowflake(undefined)).toBe(false);
        expect(isDiscordSnowflake("")).toBe(false);
        expect(isDiscordSnowflake("12345")).toBe(false);
        expect(isDiscordSnowflake(1468401237136707588)).toBe(false);
        expect(isDiscordSnowflake(" 1468401237136707588 ")).toBe(false);
    });
});

describe("resolveStatusFrequency", () => {
    it("défaut 15 si absent/invalide", () => {
        expect(STATUS_PING_DEFAULT_FREQUENCY_MIN).toBe(15);
        expect(resolveStatusFrequency(undefined)).toBe(15);
        expect(resolveStatusFrequency(null)).toBe(15);
        expect(resolveStatusFrequency(0)).toBe(15);
        expect(resolveStatusFrequency(-5)).toBe(15);
        expect(resolveStatusFrequency(Number.NaN)).toBe(15);
    });

    it("accepte les réglages God 5/15/60", () => {
        expect(resolveStatusFrequency(5)).toBe(5);
        expect(resolveStatusFrequency(15)).toBe(15);
        expect(resolveStatusFrequency(60)).toBe(60);
        expect(resolveStatusFrequency("60")).toBe(60);
    });

    it("borne à 24 h", () => {
        expect(resolveStatusFrequency(99999)).toBe(1440);
    });
});

describe("shouldSkipStatusPing", () => {
    const now = 1_000_000_000_000;

    it("n'envoie pas de doublon avant la fréquence (15 min)", () => {
        // Dernier envoi il y a 5 min, fréquence 15 → skip.
        expect(shouldSkipStatusPing(now - 5 * 60_000, now, 15)).toBe(true);
        // Dernier envoi il y a 14 min → skip (marge 45 s).
        expect(shouldSkipStatusPing(now - 14 * 60_000, now, 15)).toBe(true);
    });

    it("envoie une fois la fréquence écoulée", () => {
        expect(shouldSkipStatusPing(now - 16 * 60_000, now, 15)).toBe(false);
        expect(shouldSkipStatusPing(now - 61 * 60_000, now, 60)).toBe(false);
        expect(shouldSkipStatusPing(now - 6 * 60_000, now, 5)).toBe(false);
    });

    it("envoie si aucun envoi précédent (premier tick)", () => {
        expect(shouldSkipStatusPing(null, now, 15)).toBe(false);
        expect(shouldSkipStatusPing(undefined, now, 15)).toBe(false);
        expect(shouldSkipStatusPing(0, now, 15)).toBe(false);
    });

    it("envoie si l'horloge est incohérente (fail-open monitoring)", () => {
        expect(shouldSkipStatusPing(now + 60_000, now, 15)).toBe(false);
    });
});
