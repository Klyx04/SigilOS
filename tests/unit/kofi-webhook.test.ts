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

import { db } from "@/lib/prisma";
import { POST } from "@/app/api/webhooks/kofi/route";

describe("☕ Ko-fi Webhook Route (/api/webhooks/kofi)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.KOFI_VERIFICATION_TOKEN = "test_secret_token_123";
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
});
