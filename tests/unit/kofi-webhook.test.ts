import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
    db: {
        badge: {
            upsert: vi.fn(),
        },
        userProfile: {
            findMany: vi.fn(),
        },
        userBadge: {
            upsert: vi.fn(),
        },
        platformConfig: {
            findUnique: vi.fn(),
        },
        account: {
            findFirst: vi.fn(),
        },
    }
}));

vi.mock("@/lib/logger", () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }
}));

vi.mock("@/server/actions/god-notif-actions", () => ({
    notifyGod: vi.fn().mockResolvedValue({ success: true })
}));

vi.mock("@/server/discord", () => ({
    sendChannelMessage: vi.fn().mockResolvedValue("msg123"),
}));

import { db } from "@/lib/prisma";
import { sendChannelMessage } from "@/server/discord";
import { POST } from "@/app/api/webhooks/kofi/route";

describe("☕ Ko-fi Webhook Route (/api/webhooks/kofi)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.KOFI_VERIFICATION_TOKEN = "test_secret_token_123";
        (db.platformConfig.findUnique as any).mockResolvedValue({ kofiChannelId: "chan_kofi" });
    });

    it("refuse une requête avec un verification_token erroné", async () => {
        const payload = {
            verification_token: "wrong_token",
            from_name: "Guerrier",
            amount: "5.00"
        };

        const params = new URLSearchParams();
        params.append("data", JSON.stringify(payload));

        const req = new Request("http://localhost:3000/api/webhooks/kofi", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString(),
        });

        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it("accepte un don valide et attribue le badge au profil correspondant", async () => {
        const payload = {
            verification_token: "test_secret_token_123",
            from_name: "Guerrier",
            amount: "10.00",
            currency: "EUR",
            message: "Bravo pour SigilOS !"
        };

        (db.badge.upsert as any).mockResolvedValue({
            id: "badge_kofi_id",
            slug: "kofi-supporter",
            name: "☕ Mécène Ko-fi"
        });

        (db.userProfile.findMany as any).mockResolvedValue([
            { id: "profile_1", pseudoDofus: "Guerrier" }
        ]);

        (db.userBadge.upsert as any).mockResolvedValue({
            id: "ub_1",
            profileId: "profile_1",
            badgeId: "badge_kofi_id"
        });

        const params = new URLSearchParams();
        params.append("data", JSON.stringify(payload));

        const req = new Request("http://localhost:3000/api/webhooks/kofi", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString(),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.grantedProfiles).toBe(1);
        expect(db.userBadge.upsert).toHaveBeenCalled();
    });

    it("publie un remerciement public quand is_public est true et le salon est configuré", async () => {
        (db.badge.upsert as any).mockResolvedValue({ id: "badge_kofi_id" });
        (db.userProfile.findMany as any).mockResolvedValue([]);

        const params = new URLSearchParams();
        params.append("data", JSON.stringify({
            verification_token: "test_secret_token_123",
            from_name: "Mécène",
            amount: "5.00",
            currency: "EUR",
            is_public: "true",
        }));

        const req = new Request("http://localhost:3000/api/webhooks/kofi", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString(),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.publicPosted).toBe(true);
        expect(sendChannelMessage).toHaveBeenCalledWith(
            "chan_kofi",
            "",
            expect.objectContaining({ embedTitle: expect.stringContaining("Mécène") })
        );
    });

    it("ne publie rien quand is_public est false (exigence Ko-fi)", async () => {
        (db.badge.upsert as any).mockResolvedValue({ id: "badge_kofi_id" });
        (db.userProfile.findMany as any).mockResolvedValue([]);

        const params = new URLSearchParams();
        params.append("data", JSON.stringify({
            verification_token: "test_secret_token_123",
            from_name: "Discret",
            amount: "5.00",
            is_public: "false",
        }));

        const req = new Request("http://localhost:3000/api/webhooks/kofi", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString(),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.publicPosted).toBe(false);
        expect(sendChannelMessage).not.toHaveBeenCalled();
    });

    it("ping le donateur quand un seul profil Discord est matché", async () => {
        (db.badge.upsert as any).mockResolvedValue({ id: "badge_kofi_id" });
        (db.userProfile.findMany as any).mockResolvedValue([
            { id: "profile_1", userId: "user_1", pseudoDofus: "Mécène" }
        ]);
        (db.account.findFirst as any).mockResolvedValue({ providerAccountId: "123456789012345678" });

        const params = new URLSearchParams();
        params.append("data", JSON.stringify({
            verification_token: "test_secret_token_123",
            from_name: "Mécène",
            amount: "5.00",
            currency: "EUR",
            is_public: "true",
        }));

        const req = new Request("http://localhost:3000/api/webhooks/kofi", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString(),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.publicPosted).toBe(true);
        expect(data.pinged).toBe(true);
        expect(sendChannelMessage).toHaveBeenCalledWith(
            "chan_kofi",
            "",
            expect.objectContaining({ mentionContent: "<@123456789012345678>" })
        );
    });

    it("ne ping personne quand plusieurs profils matchent (ambiguïté)", async () => {
        (db.badge.upsert as any).mockResolvedValue({ id: "badge_kofi_id" });
        (db.userProfile.findMany as any).mockResolvedValue([
            { id: "profile_1", userId: "user_1" },
            { id: "profile_2", userId: "user_2" },
        ]);

        const params = new URLSearchParams();
        params.append("data", JSON.stringify({
            verification_token: "test_secret_token_123",
            from_name: "Dupont",
            amount: "5.00",
            is_public: "true",
        }));

        const req = new Request("http://localhost:3000/api/webhooks/kofi", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString(),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.publicPosted).toBe(true);
        expect(data.pinged).toBe(false);
        expect(db.account.findFirst).not.toHaveBeenCalled();
        const options = (sendChannelMessage as any).mock.calls[0][2];
        expect(options.mentionContent).toBeUndefined();
    });

    it("ne publie rien quand aucun salon n'est configuré (alerte God seule)", async () => {
        (db.badge.upsert as any).mockResolvedValue({ id: "badge_kofi_id" });
        (db.userProfile.findMany as any).mockResolvedValue([]);
        (db.platformConfig.findUnique as any).mockResolvedValue({ kofiChannelId: null });

        const params = new URLSearchParams();
        params.append("data", JSON.stringify({
            verification_token: "test_secret_token_123",
            from_name: "Mécène",
            amount: "5.00",
            is_public: "true",
        }));

        const req = new Request("http://localhost:3000/api/webhooks/kofi", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString(),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.publicPosted).toBe(false);
        expect(sendChannelMessage).not.toHaveBeenCalled();
    });
});
