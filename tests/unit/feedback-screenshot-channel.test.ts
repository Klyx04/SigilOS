import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
    buildDiscordChannelUrl,
    isDiscordSnowflake,
    isWritableTextChannel,
} from "@/lib/feedback-screenshot-channel";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const PANEL = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayFeedbackPanel.tsx";
const VISITOR = "src/components/feedback/visitor-feedback-button.tsx";
const QUEST = "src/components/dofus-quests/QuestFeedbackButton.tsx";
const ACTIONS = "src/server/actions/feedback-actions.ts";
const SERVICE = "src/server/feedback-screenshot-channel.ts";
const GOD_PAGE = "src/app/god/bugs/page.tsx";
const CONFIG = "src/components/feedback/feedback-channel-config.tsx";

describe("lien du salon des captures — règle pure", () => {
    it("construit le lien à partir du serveur et du salon", () => {
        expect(buildDiscordChannelUrl("123456789012345678", "987654321098765432")).toBe(
            "https://discord.com/channels/123456789012345678/987654321098765432"
        );
    });

    it("refuse un identifiant absent, court ou non numérique", () => {
        expect(buildDiscordChannelUrl(null, "987654321098765432")).toBeNull();
        expect(buildDiscordChannelUrl("123456789012345678", "")).toBeNull();
        expect(buildDiscordChannelUrl("abc", "987654321098765432")).toBeNull();
        expect(buildDiscordChannelUrl("123456789012345678", "12")).toBeNull();
    });

    it("n'accepte que les salons textuels ou d'annonces", () => {
        expect(isWritableTextChannel(0)).toBe(true);
        expect(isWritableTextChannel(5)).toBe(true);
        expect(isWritableTextChannel(2)).toBe(false);
        expect(isWritableTextChannel(11)).toBe(false);
        expect(isWritableTextChannel(null)).toBe(false);
    });

    it("valide un snowflake, espaces compris", () => {
        expect(isDiscordSnowflake("123456789012345678")).toBe(true);
        expect(isDiscordSnowflake(" 123456789012345678 ")).toBe(true);
        expect(isDiscordSnowflake("1234")).toBe(false);
        expect(isDiscordSnowflake(undefined)).toBe(false);
    });
});

describe("surfaces — aucune invitation en dur", () => {
    it("le panneau Rush n'a plus d'invitation ni de repli discord.gg", () => {
        const panel = read(PANEL);
        expect(panel).not.toContain("discord.gg");
        expect(panel).not.toContain("DISCORD_INVITE_URL");
        expect(panel).toContain("useFeedbackScreenshotChannel");
        expect(panel).toContain("Ouvrir le salon des captures");
    });

    it("les deux autres formulaires proposent le salon configuré", () => {
        expect(read(VISITOR)).toContain("useFeedbackScreenshotChannel");
        expect(read(VISITOR)).toContain("Ouvrir le salon des captures");
        expect(read(QUEST)).toContain("useFeedbackScreenshotChannel");
        expect(read(QUEST)).toContain("Ouvrir le salon des captures");
    });
});

describe("God — le salon est paramétrable, jamais en dur", () => {
    it("la page /god/bugs monte le réglage et résout le lien", () => {
        const page = read(GOD_PAGE);
        expect(page).toContain("FeedbackChannelConfig");
        expect(page).toContain("resolveFeedbackScreenshotChannel");
        expect(page).toContain("getConfiguredFeedbackChannelId");
        expect(read(CONFIG)).toContain("setFeedbackScreenshotChannelAction");
    });

    it("l'écriture est God + rate limit + salon validé", () => {
        const actions = read(ACTIONS);
        const start = actions.indexOf("export async function setFeedbackScreenshotChannelAction");
        expect(start).toBeGreaterThan(-1);
        const fn = actions.slice(start);
        expect(fn).toContain("isSuperAdmin");
        expect(fn).toContain("rateLimit(");
        expect(fn).toContain("validateFeedbackScreenshotChannel");
        expect(fn).toContain("questFeedbackChannelId");
    });

    it("la lecture publique ne demande aucune session", () => {
        const actions = read(ACTIONS);
        const start = actions.indexOf("export async function getFeedbackScreenshotChannelAction");
        const end = actions.indexOf("export async function setFeedbackScreenshotChannelAction");
        expect(start).toBeGreaterThan(-1);
        expect(end).toBeGreaterThan(start);
        const fn = actions.slice(start, end);
        expect(fn).not.toContain("await auth()");
        expect(fn).not.toContain("isSuperAdmin");
    });

    it("le service est fail-closed : aucune panne ne fabrique un lien", () => {
        const service = read(SERVICE);
        expect(service).toContain('redis.status !== "ready"');
        expect(service).toContain("return null");
        expect(service).not.toMatch(/discord\.gg/);
    });
});
