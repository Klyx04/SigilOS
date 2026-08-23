import { describe, it, expect } from "vitest";
import {
    buildDiscordAvatarUrl,
    buildGuildAvatarUrl,
    normalizeDiscordAvatarUrl,
    discordAvatarErrorFallback,
    isDiscordAvatarUrl,
    isDiscordAvatarHostname,
    extractUserIdFromAvatarUrl,
    getDefaultDiscordAvatar,
} from "@/lib/discord-avatars";

describe("discord-avatars — URLs d'avatar (chantier #23, hardening F-29)", () => {
    describe("isDiscordAvatarHostname", () => {
        it("accepte les hôtes Discord exacts", () => {
            expect(isDiscordAvatarHostname("cdn.discordapp.com")).toBe(true);
            expect(isDiscordAvatarHostname("discordapp.com")).toBe(true);
            expect(isDiscordAvatarHostname("media.discordapp.net")).toBe(true);
            expect(isDiscordAvatarHostname("images.discordapp.net")).toBe(true);
        });

        it("rejette les hôtes de type evildiscordapp.com (F-29 CodeQL)", () => {
            expect(isDiscordAvatarHostname("evildiscordapp.com")).toBe(false);
            expect(isDiscordAvatarHostname("notdiscordapp.com")).toBe(false);
            expect(isDiscordAvatarHostname("cdn.discordapp.com.evil.io")).toBe(false);
            expect(isDiscordAvatarHostname("evilcdn.discordapp.com")).toBe(false);
            expect(isDiscordAvatarHostname("www.example.com")).toBe(false);
        });

        it("fail-closed sur entrées vides/invalides", () => {
            expect(isDiscordAvatarHostname(null)).toBe(false);
            expect(isDiscordAvatarHostname(undefined)).toBe(false);
            expect(isDiscordAvatarHostname("")).toBe(false);
        });
    });

    describe("isDiscordAvatarUrl", () => {
        it("parse l'URL réelle et vérifie l'hôte", () => {
            expect(isDiscordAvatarUrl("https://cdn.discordapp.com/avatars/1/hash.png")).toBe(true);
            expect(isDiscordAvatarUrl("https://media.discordapp.net/avatars/1/hash.png?width=256")).toBe(true);
            expect(isDiscordAvatarUrl("https://discordapp.com/avatars/1/hash.png")).toBe(true);
        });

        it("rejette les subterfuges de sous-chaîne (F-29)", () => {
            expect(isDiscordAvatarUrl("https://example.com/cdn.discordapp.com/avatars/1/h.png")).toBe(false);
            expect(isDiscordAvatarUrl("https://example.com/?next=cdn.discordapp.com")).toBe(false);
            expect(isDiscordAvatarUrl("https://evildiscordapp.com/avatars/1/h.png")).toBe(false);
            expect(isDiscordAvatarUrl("http://cdn.discordapp.com.evil.io/avatars/1/h.png")).toBe(false);
        });

        it("fail-closed sur URL invalide", () => {
            expect(isDiscordAvatarUrl("not a url")).toBe(false);
            expect(isDiscordAvatarUrl(null)).toBe(false);
            expect(isDiscordAvatarUrl("")).toBe(false);
        });
    });

    describe("buildDiscordAvatarUrl / buildGuildAvatarUrl", () => {
        it("construit une URL CDN bornée à 256px (webp, gif si animé)", () => {
            expect(buildDiscordAvatarUrl("123", "hash")).toBe(
                "https://cdn.discordapp.com/avatars/123/hash.webp?size=256"
            );
            expect(buildDiscordAvatarUrl("123", "a_hash")).toBe(
                "https://cdn.discordapp.com/avatars/123/a_hash.gif?size=256"
            );
            expect(buildGuildAvatarUrl("guild", "user", "h")).toBe(
                "https://cdn.discordapp.com/guilds/guild/users/user/avatars/h.webp?size=256"
            );
        });

        it("retourne null sans userId/hash", () => {
            expect(buildDiscordAvatarUrl("", "h")).toBeNull();
            expect(buildDiscordAvatarUrl("123", null)).toBeNull();
            expect(buildGuildAvatarUrl("guild", "", "h")).toBeNull();
        });
    });

    describe("normalizeDiscordAvatarUrl", () => {
        it("normalise une URL OAuth sans ?size en webp 256px", () => {
            expect(normalizeDiscordAvatarUrl("https://cdn.discordapp.com/avatars/42/hash.png")).toBe(
                "https://cdn.discordapp.com/avatars/42/hash.webp?size=256"
            );
        });

        it("préserve les avatars animés en gif", () => {
            expect(normalizeDiscordAvatarUrl("https://cdn.discordapp.com/avatars/42/a_hash.gif")).toBe(
                "https://cdn.discordapp.com/avatars/42/a_hash.gif?size=256"
            );
        });

        it("laisse les URLs non-Discord inchangées", () => {
            const external = "https://example.com/avatar.png";
            expect(normalizeDiscordAvatarUrl(external)).toBe(external);
        });

        it("laisse inchangée une URL sur un hôte type evildiscordapp.com (F-29)", () => {
            const evil = "https://evildiscordapp.com/avatars/42/hash.png";
            expect(normalizeDiscordAvatarUrl(evil)).toBe(evil);
        });

        it("retourne null sur entrée vide", () => {
            expect(normalizeDiscordAvatarUrl(null)).toBeNull();
            expect(normalizeDiscordAvatarUrl("")).toBeNull();
        });
    });

    describe("discordAvatarErrorFallback", () => {
        it("bascule cdn → media avec width/height 256", () => {
            expect(
                discordAvatarErrorFallback("https://cdn.discordapp.com/avatars/1/h.png?size=1024")
            ).toBe("https://media.discordapp.net/avatars/1/h.png?width=256&height=256");
            expect(
                discordAvatarErrorFallback("https://cdn.discordapp.com/avatars/1/h.webp?size=256")
            ).toBe("https://media.discordapp.net/avatars/1/h.webp?width=256&height=256");
        });

        it("retourne null si l'hôte n'est pas exactement cdn.discordapp.com (F-29)", () => {
            expect(discordAvatarErrorFallback("https://media.discordapp.net/avatars/1/h.png")).toBeNull();
            expect(discordAvatarErrorFallback("https://evilcdn.discordapp.com/avatars/1/h.png")).toBeNull();
            expect(discordAvatarErrorFallback("https://example.com/cdn.discordapp.com/x")).toBeNull();
            expect(discordAvatarErrorFallback("https://cdn.discordapp.com.evil.io/avatars/1/h.png")).toBeNull();
        });

        it("retourne null sur entrée invalide", () => {
            expect(discordAvatarErrorFallback("not a url")).toBeNull();
            expect(discordAvatarErrorFallback(null)).toBeNull();
        });
    });

    describe("extractUserIdFromAvatarUrl (#134)", () => {
        it("extrait le snowflake d'une URL CDN d'avatar", () => {
            expect(extractUserIdFromAvatarUrl("https://cdn.discordapp.com/avatars/123/hash.webp?size=256")).toBe("123");
        });

        it("extrait aussi depuis le miroir media.discordapp.net", () => {
            expect(extractUserIdFromAvatarUrl("https://media.discordapp.net/avatars/456/h.png?width=256&height=256")).toBe("456");
        });

        it("rejette les hôtes non-Discord et les faux avatars (F-29)", () => {
            expect(extractUserIdFromAvatarUrl("https://example.com/avatars/123/h.png")).toBeUndefined();
            expect(extractUserIdFromAvatarUrl("https://evildiscordapp.com/avatars/123/h.png")).toBeUndefined();
            expect(extractUserIdFromAvatarUrl("https://cdn.discordapp.com/guilds/1/users/2/avatars/h.png")).toBeUndefined();
        });

        it("fail-closed sur entrées vides/invalides", () => {
            expect(extractUserIdFromAvatarUrl(null)).toBeUndefined();
            expect(extractUserIdFromAvatarUrl(undefined)).toBeUndefined();
            expect(extractUserIdFromAvatarUrl("not a url")).toBeUndefined();
        });
    });

    describe("getDefaultDiscordAvatar (#134)", () => {
        it("produit une URL embed/avatars bornée à l'index 0..5", () => {
            for (const id of ["111111111111111111", "222222222222222222", "123456789012345678", "1", "123"]) {
                const url = getDefaultDiscordAvatar(id);
                expect(url).toMatch(/^https:\/\/cdn\.discordapp\.com\/embed\/avatars\/[0-5]\.png$/);
            }
        });

        it("est déterministe (même snowflake → même index)", () => {
            expect(getDefaultDiscordAvatar("111111111111111111")).toBe(getDefaultDiscordAvatar("111111111111111111"));
        });

        it("recalcule l'index via (id >> 22) % 6", () => {
            const id = "123456789012345678";
            const expected = ((BigInt(id) >> 22n) % 6n).toString();
            expect(getDefaultDiscordAvatar(id)).toBe(`https://cdn.discordapp.com/embed/avatars/${expected}.png`);
        });

        it("fail-closed sur entrées vides/invalides", () => {
            expect(getDefaultDiscordAvatar(null)).toBeNull();
            expect(getDefaultDiscordAvatar(undefined)).toBeNull();
            expect(getDefaultDiscordAvatar("")).toBeNull();
            expect(getDefaultDiscordAvatar("not-a-number")).toBeNull();
        });
    });
});
