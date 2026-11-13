/**
 * Sécurité — verrous de l'audit rate-limit / IDOR (octobre 2026).
 *
 * Ce que ce test protège : les correctifs appliqués sans casse —
 * fenêtres `60` ms devenues `60_000`, gardes d'appartenance à la guilde,
 * vérification du `.success` du limiteur. Lecture seule : code source.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/** Retire les commentaires : un motif interdit ne doit pas se cacher dans la prose. */
const codeOnly = (path: string) =>
    readFileSync(path, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("Rate limit — fenêtres réelles (pas 60 ms)", () => {
    it("ocre-actions : aucun rateLimit avec une fenêtre nue de 60", () => {
        const src = codeOnly("src/server/actions/ocre-actions.ts");
        expect(src).not.toMatch(/rateLimit\([^)]*,\s*60\)/);
        expect(src).toContain("60_000");
    });

    it("profile-actions : fenêtre minute + test du .success", () => {
        const src = codeOnly("src/server/actions/profile-actions.ts");
        expect(src).toContain("rateLimit(rateLimitKey, 10, 60_000)");
        expect(src).toContain("isRateLimited.success");
        expect(src).not.toMatch(/if\s*\(!isRateLimited\)\s*return/);
    });
});

describe("IDOR — écritures gardées par l'appartenance", () => {
    it("grantRewards : session + bornes + cible existante", () => {
        const src = codeOnly("src/server/actions/mission-actions.ts");
        const start = src.indexOf("export async function grantRewards");
        expect(start).toBeGreaterThan(-1);
        const body = src.slice(start, src.indexOf("export async function", start + 10));
        expect(body).toContain("await auth()");
        expect(body).toContain("Number.isFinite");
        expect(body).toContain("findUnique({ where: { id: profileId }");
    });

    it("getWeeklyGuildatons : session requise + semaine/année bornées", () => {
        const src = codeOnly("src/server/actions/mission-actions.ts");
        const start = src.indexOf("export async function getWeeklyGuildatons");
        expect(start).toBeGreaterThan(-1);
        const body = src.slice(start, src.indexOf("export async function", start + 10));
        expect(body).toContain("await auth()");
    });

    it("deleteGuildImage : membre de la guilde requis", () => {
        const src = codeOnly("src/server/actions/upload-actions.ts");
        const start = src.indexOf("export async function deleteGuildImage");
        expect(start).toBeGreaterThan(-1);
        const body = src.slice(start, src.indexOf("export async function", start + 10));
        expect(body).toContain("await auth()");
        expect(body).toContain("isMember");
    });

    it("refreshBuildMetadata : membre + propriétaire ou admin", () => {
        const src = codeOnly("src/server/actions/gallery-actions.ts");
        const start = src.indexOf("export async function refreshBuildMetadata");
        expect(start).toBeGreaterThan(-1);
        const body = src.slice(start, src.indexOf("export async function", start + 10));
        expect(body).toContain("isMember");
        expect(body).toContain("profile.userId !== user.id");
    });

    it("storeClientDofusbookPreview : membre + persistance au propriétaire ou admin", () => {
        const src = codeOnly("src/server/actions/gallery-actions.ts");
        const start = src.indexOf("export async function storeClientDofusbookPreview");
        expect(start).toBeGreaterThan(-1);
        const body = src.slice(start, src.indexOf("export async function", start + 10));
        expect(body).toContain("isMember");
        expect(body).toContain("owner.userId !== user.id");
    });

    it("expireBonus : session + membre de la guilde du bonus", () => {
        const src = codeOnly("src/server/actions/bonus-actions.ts");
        const start = src.indexOf("export async function expireBonus");
        expect(start).toBeGreaterThan(-1);
        const body = src.slice(start, src.indexOf("export async function", start + 10));
        expect(body).toContain("await auth()");
        expect(body).toContain("isMember");
    });
});

describe("Tickets — anti-spam et anti-usurpation", () => {
    it("createSupportTicket : rate limit par auteur Discord", () => {
        const src = codeOnly("src/server/actions/ticket-actions.ts");
        expect(src).toContain("ticket:create:${data.creatorDiscordId}");
    });

    it("closeSupportTicket : rate limit + identité du fermeur vérifiée", () => {
        const src = codeOnly("src/server/actions/ticket-actions.ts");
        const start = src.indexOf("export async function closeSupportTicket");
        expect(start).toBeGreaterThan(-1);
        const body = src.slice(start, src.indexOf("export async function", start + 10));
        expect(body).toContain("ticket:close:");
        expect(body).toContain("providerAccountId");
    });
});

describe("Doc — RULES montre le vrai helper", () => {
    it("RULES.md : rateLimit de @/lib/ratelimit, pas checkRateLimit", () => {
        const doc = readFileSync("docs/RULES.md", "utf8");
        expect(doc).not.toContain("checkRateLimit");
        expect(doc).toContain('@/lib/ratelimit');
    });
});
