/**
 * Portée de guilde de la télémétrie — CUID interne **et** snowflake Discord.
 *
 * Le bug d'origine : le sélecteur envoyait `GuildConfig.id` (CUID) alors que les
 * événements stockent le segment d'URL (`/dashboard/<snowflake>/…`). La lecture
 * filtre donc sur les deux espaces, et une sélection inconnue est fail-closed.
 */

import { describe, it, expect } from "vitest";
import { resolveTelemetryGuildScope } from "@/lib/telemetry/guild-scope";

const GUILDS = [
    { id: "cuid-a", discordGuildId: "111111111111111111" },
    { id: "cuid-b", discordGuildId: null },
];

describe("resolveTelemetryGuildScope", () => {
    it("aucune sélection ou « all » ⇒ toutes les guildes", () => {
        expect(resolveTelemetryGuildScope(null, GUILDS)).toEqual({ kind: "all" });
        expect(resolveTelemetryGuildScope(undefined, GUILDS)).toEqual({ kind: "all" });
        expect(resolveTelemetryGuildScope("all", GUILDS)).toEqual({ kind: "all" });
    });

    it("un CUID interne résout les deux espaces (interne + snowflake)", () => {
        expect(resolveTelemetryGuildScope("cuid-a", GUILDS)).toEqual({
            kind: "guild",
            ids: ["cuid-a", "111111111111111111"],
        });
    });

    it("un snowflake résout les deux espaces", () => {
        expect(resolveTelemetryGuildScope("111111111111111111", GUILDS)).toEqual({
            kind: "guild",
            ids: ["cuid-a", "111111111111111111"],
        });
    });

    it("une guilde sans snowflake ne produit qu'un id", () => {
        expect(resolveTelemetryGuildScope("cuid-b", GUILDS)).toEqual({
            kind: "guild",
            ids: ["cuid-b"],
        });
    });

    it("une sélection inconnue est fail-closed (aucun résultat, aucune requête)", () => {
        expect(resolveTelemetryGuildScope("inconnu", GUILDS)).toEqual({ kind: "none", ids: [] });
    });

    it("les doublons sont dédupliqués", () => {
        const duplicate = [{ id: "same", discordGuildId: "same" }];
        expect(resolveTelemetryGuildScope("same", duplicate)).toEqual({
            kind: "guild",
            ids: ["same"],
        });
    });
});
