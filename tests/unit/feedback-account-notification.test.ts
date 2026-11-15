/**
 * Réponse God à un signalement → boîte **compte** (rang 65, lot N4).
 *
 * Le trou mesuré : `notifyMemberFeedbackAction` appelait `createNotification`,
 * fail-closed sans guilde. Un visiteur sans guilde ne recevait donc **rien**.
 * Le correctif branche explicitement :
 *  · guilde identifiable → cloche de guilde (comportement historique) ;
 *  · pas de guilde → notification de compte (`guildId: null`), sans doublon.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationCategory, NotificationType } from "@prisma/client";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/logger", () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/server/public-account", () => ({ getPublicSession: vi.fn() }));
vi.mock("@/server/actions/user-actions", () => ({ getUserContext: vi.fn() }));
vi.mock("@/server/god-notifications", () => ({ notifyGod: vi.fn() }));
vi.mock("@/server/account-notifications", () => ({ createAccountNotification: vi.fn() }));
vi.mock("@/server/actions/notification-actions", () => ({ createNotification: vi.fn() }));
vi.mock("@/server/actions/super-admin-actions", () => ({ isSuperAdmin: vi.fn() }));
vi.mock("@/server/feedback-ticket-service", () => ({
    appendMemberReply: vi.fn(() => []),
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
        supportTicket: { findUnique: vi.fn(), update: vi.fn() },
    },
}));

vi.mock("@/lib/prisma", () => ({ db: mockDb }));

import { auth } from "@/auth";
import { createAccountNotification } from "@/server/account-notifications";
import { createNotification } from "@/server/actions/notification-actions";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { notifyMemberFeedbackAction } from "@/server/actions/feedback-actions";

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedIsSuperAdmin = isSuperAdmin as unknown as ReturnType<typeof vi.fn>;
const mockedAccountNotification = createAccountNotification as unknown as ReturnType<typeof vi.fn>;
const mockedGuildNotification = createNotification as unknown as ReturnType<typeof vi.fn>;

const baseTicket = {
    id: "ticket-1",
    publicRef: "SIG-1",
    origin: "FEEDBACK",
    creatorUserId: "user-1",
    guildId: null,
    discordGuildId: null,
    description: "[BUG_TECHNIQUE] Le bouton ne répond pas",
    transcript: [],
};

const input = {
    ticketRef: "SIG-1",
    memberName: "Wyla",
    emoji: "🐞",
    message: "C'est corrigé.",
};

beforeEach(() => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({ user: { id: "god-1", name: "God" } });
    mockedIsSuperAdmin.mockResolvedValue(true);
    mockDb.supportTicket.findUnique.mockResolvedValue(baseTicket);
    mockDb.supportTicket.update.mockResolvedValue({});
    mockedAccountNotification.mockResolvedValue({ success: true, id: "n1" });
    mockedGuildNotification.mockResolvedValue(undefined);
});

describe("réponse à un signalement : le bon canal, sans doublon", () => {
    it("un visiteur sans guilde reçoit une notification de compte", async () => {
        const result = await notifyMemberFeedbackAction(input);

        expect(result).toEqual({ success: true });
        expect(mockedGuildNotification).not.toHaveBeenCalled();
        expect(mockedAccountNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: "user-1",
                type: NotificationType.SYSTEM_INFO,
                category: NotificationCategory.SYSTEM,
                link: "/espace-visiteur/general",
            })
        );
    });

    it("un membre avec guilde garde la cloche de guilde, sans doublon compte", async () => {
        mockDb.supportTicket.findUnique.mockResolvedValue({
            ...baseTicket,
            guildId: "guild-1",
            discordGuildId: "123456789012345678",
        });

        const result = await notifyMemberFeedbackAction(input);

        expect(result).toEqual({ success: true });
        expect(mockedGuildNotification).toHaveBeenCalledTimes(1);
        expect(mockedAccountNotification).not.toHaveBeenCalled();
    });
});
