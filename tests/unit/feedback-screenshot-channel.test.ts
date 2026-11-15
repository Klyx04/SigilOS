import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
    buildDiscordChannelUrl,
    isDiscordSnowflake,
    isWritableTextChannel,
    resolveFeedbackForumTag,
    sanitizeFeedbackForumTagMap,
} from "@/lib/feedback-screenshot-channel";
import { buildFeedbackForumThreadName } from "@/lib/feedback-ticket-mapping";

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

    it("accepte un salon textuel, d'annonces ou un forum", () => {
        expect(isWritableTextChannel(0)).toBe(true);
        expect(isWritableTextChannel(5)).toBe(true);
        expect(isWritableTextChannel(15)).toBe(true);
        expect(isWritableTextChannel(2)).toBe(false);
        expect(isWritableTextChannel(11)).toBe(false);
        expect(isWritableTextChannel(null)).toBe(false);
    });

    it("construit un titre de post de forum borné à 100 caractères", () => {
        const title = buildFeedbackForumThreadName({
            publicRef: "SIG-123",
            emoji: "🐛",
            label: "Bug technique",
            description: "Le bouton\n  ferme   la modale au lieu d'envoyer le formulaire",
        });
        expect(title.startsWith("[SIG-123] 🐛 Bug technique — ")).toBe(true);
        expect(title).not.toContain("\n");
        expect(title.length).toBeLessThanOrEqual(100);

        const long = buildFeedbackForumThreadName({
            publicRef: "SIG-999",
            emoji: "💬",
            label: "Amélioration",
            description: "x".repeat(500),
        });
        expect(long.length).toBeLessThanOrEqual(100);
        expect(long).toContain("x");
    });

    it("un titre de forum sans description reste lisible", () => {
        const title = buildFeedbackForumThreadName({
            publicRef: "SIG-1",
            emoji: "🐛",
            label: "Bug",
            description: "   ",
        });
        expect(title).toBe("[SIG-1] 🐛 Bug");
    });

    it("valide un snowflake, espaces compris", () => {
        expect(isDiscordSnowflake("123456789012345678")).toBe(true);
        expect(isDiscordSnowflake(" 123456789012345678 ")).toBe(true);
        expect(isDiscordSnowflake("1234")).toBe(false);
        expect(isDiscordSnowflake(undefined)).toBe(false);
    });
});

describe("tags de forum — mapping par type de retour", () => {
    const tags = [
        { id: "111111111111111111", name: "Bug" },
        { id: "222222222222222222", name: "Amélioration" },
        { id: "333333333333333333", name: "Modo", moderated: true },
    ];

    it("applique le tag mappé au type de retour", () => {
        expect(resolveFeedbackForumTag("BUG_TECHNIQUE", { BUG_TECHNIQUE: tags[0].id }, tags)).toBe(tags[0].id);
        expect(resolveFeedbackForumTag("AMELIORATION", { AMELIORATION: tags[1].id }, tags)).toBe(tags[1].id);
    });

    it("retombe sur le premier tag utilisable si le mapping manque ou pointe un tag disparu", () => {
        expect(resolveFeedbackForumTag("AUTRE", {}, tags)).toBe(tags[0].id);
        expect(resolveFeedbackForumTag("AUTRE", { AUTRE: "999999999999999999" }, tags)).toBe(tags[0].id);
    });

    it("ne choisit jamais un tag réservé aux modérateurs", () => {
        expect(resolveFeedbackForumTag("AUTRE", { AUTRE: tags[2].id }, [tags[2]])).toBeNull();
        expect(resolveFeedbackForumTag("AUTRE", {}, [tags[2], tags[0]])).toBe(tags[0].id);
    });

    it("borne le mapping aux types connus et aux snowflakes", () => {
        const map = sanitizeFeedbackForumTagMap(
            { BUG_TECHNIQUE: tags[0].id, INCONNU: tags[1].id, AUTRE: "abc" },
            ["BUG_TECHNIQUE", "AUTRE"]
        );
        expect(map).toEqual({ BUG_TECHNIQUE: tags[0].id });
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
    it("la console Support monte le réglage dans l'onglet Signalements", () => {
        const dashboard = read("src/app/god/components/ticket-dashboard.tsx");
        expect(dashboard).toContain("FeedbackChannelConfig");
        expect(dashboard).toContain("screenshotChannelUrl");
        expect(dashboard).toContain("activeTab === \"feedback\"");
        // Les valeurs viennent du serveur (`/god`), jamais d'un identifiant en dur.
        expect(read("src/app/god/page.tsx")).toContain("resolveFeedbackScreenshotChannel");
    });

    it("la page /god/bugs monte le réglage et résout le lien", () => {
        const page = read(GOD_PAGE);
        expect(page).toContain("FeedbackChannelConfig");
        expect(page).toContain("resolveFeedbackScreenshotChannel");
        expect(page).toContain("getConfiguredFeedbackChannelId");
        expect(read(CONFIG)).toContain("setFeedbackScreenshotChannelAction");
    });

    it("le panneau God règle le tag de chaque type de retour", () => {
        const config = read(CONFIG);
        expect(config).toContain("getFeedbackForumTagSettingsAction");
        expect(config).toContain("setFeedbackForumTagMapAction");
        expect(config).toContain("FEEDBACK_TYPES");
        const actions = read(ACTIONS);
        expect(actions).toContain("setFeedbackForumTagMapAction");
        expect(actions).toContain("feedbackForumTagMap");
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

    it("un forum reçoit un post titré et tagué, et le ticket garde le lien", () => {
        const service = read("src/server/feedback-ticket-service.ts");
        expect(service).toContain("createForumThread");
        expect(service).toContain("channel.type === 15");
        expect(service).toContain("applied_tags");
        expect(service).toContain("buildFeedbackForumThreadName");
        // Le lien du post est conservé sur le ticket (`forumLink`).
        expect(read(ACTIONS)).toContain("forumLink");
    });
});
