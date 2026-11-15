/**
 * Feedback visiteur — **garde de bannissement** (mini-lot du 15/11/2026).
 *
 * Mesure : `submitVisitorFeedbackAction` ne vérifiait que `auth()`. Un compte
 * banni dont le JWT était encore valide pouvait donc créer un ticket. La garde
 * passe désormais par `getPublicSession()` (session **et** compte non banni),
 * sans changer le parcours du bouton : l'UI reste inchangée.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/logger", () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/server/public-account", () => ({ getPublicSession: vi.fn() }));
vi.mock("@/server/actions/user-actions", () => ({ getUserContext: vi.fn() }));
vi.mock("@/server/god-notifications", () => ({ notifyGod: vi.fn() }));
vi.mock("@/server/feedback-ticket-service", () => ({
    ensurePublicRef: vi.fn(),
    sendFeedbackEmbed: vi.fn(),
}));
vi.mock("@/server/feedback-screenshot-channel", () => ({
    getFeedbackForumTagMap: vi.fn(),
    getFeedbackForumTags: vi.fn(),
    resolveFeedbackScreenshotChannel: vi.fn(),
    validateFeedbackScreenshotChannel: vi.fn(),
}));

const { mockDb } = vi.hoisted(() => ({
    mockDb: {
        account: { findFirst: vi.fn() },
        user: { findUnique: vi.fn() },
        userProfile: { findFirst: vi.fn() },
        supportTicket: { create: vi.fn(), update: vi.fn() },
    },
}));

vi.mock("@/lib/prisma", () => ({ db: mockDb }));

import { rateLimit } from "@/lib/ratelimit";
import { getPublicSession } from "@/server/public-account";
import { ensurePublicRef, sendFeedbackEmbed } from "@/server/feedback-ticket-service";
import { notifyGod } from "@/server/god-notifications";
import { submitVisitorFeedbackAction } from "@/server/actions/feedback-actions";

const mockedSession = getPublicSession as unknown as ReturnType<typeof vi.fn>;
const mockedRateLimit = rateLimit as unknown as ReturnType<typeof vi.fn>;
const mockedPublicRef = ensurePublicRef as unknown as ReturnType<typeof vi.fn>;
const mockedSendEmbed = sendFeedbackEmbed as unknown as ReturnType<typeof vi.fn>;
const mockedNotifyGod = notifyGod as unknown as ReturnType<typeof vi.fn>;

const input = {
    feedbackType: "BUG_TECHNIQUE" as const,
    description: "Le bouton de signalement ne répond pas.",
    sourcePage: "public:/boss",
    targetSlug: null,
    userAgent: "vitest",
    context: null,
};

beforeEach(() => {
    vi.clearAllMocks();
    mockedSession.mockResolvedValue({ userId: "user-1" });
    mockedRateLimit.mockResolvedValue({
        success: true,
        remaining: 4,
        reset: Date.now() + 3_600_000,
    });
    mockDb.account.findFirst.mockResolvedValue({ providerAccountId: "discord-1" });
    mockDb.user.findUnique.mockResolvedValue({ name: "Wyla" });
    mockDb.userProfile.findFirst.mockResolvedValue(null);
    mockDb.supportTicket.create.mockResolvedValue({ id: "ticket-1" });
    mockedPublicRef.mockResolvedValue("SIG-1");
    mockedSendEmbed.mockResolvedValue(null);
    mockedNotifyGod.mockResolvedValue(true);
});

describe("feedback visiteur : session + bannissement", () => {
    it("refuse un compte banni ou sans session (aucun ticket écrit)", async () => {
        mockedSession.mockResolvedValue(null);

        const result = await submitVisitorFeedbackAction(input);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Connecte-toi");
        expect(mockDb.supportTicket.create).not.toHaveBeenCalled();
    });

    it("rattache le ticket au userId de la session, sans guilde fournie par le client", async () => {
        const result = await submitVisitorFeedbackAction(input);

        expect(result).toEqual({ success: true, ticketId: "SIG-1" });
        const data = mockDb.supportTicket.create.mock.calls[0][0].data;
        expect(data.creatorUserId).toBe("user-1");
        expect(data.creatorDiscordName).toBe("Wyla");
        expect(data.guildId).toBeNull();
        expect(data.discordGuildId).toBeNull();
    });

    it("retombe sur « Visiteur » quand le compte n'a pas de nom", async () => {
        mockDb.user.findUnique.mockResolvedValue(null);

        await submitVisitorFeedbackAction(input);

        const data = mockDb.supportTicket.create.mock.calls[0][0].data;
        expect(data.creatorDiscordName).toBe("Visiteur");
    });
});
