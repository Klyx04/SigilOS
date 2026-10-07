import { describe, it, expect, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
    db: {
        guildConfig: { findUnique: vi.fn(), findFirst: vi.fn() },
        guildEvent: { findUnique: vi.fn() },
        eventParticipant: { create: vi.fn() },
        userProfile: { findFirst: vi.fn() },
    },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/server/discord", () => ({
    deleteChannelMessage: vi.fn(),
}));

vi.mock("@/server/actions/user-actions", () => ({
    getUserContext: vi.fn(),
}));

vi.mock("@/server/calendar-service", () => ({
    processRegistration: vi.fn(),
    processUnregistration: vi.fn(),
}));

import { getUserContext } from "@/server/actions/user-actions";
import { registerForEvent, unregisterFromEvent } from "@/server/actions/calendar-actions";

describe("calendar site gate — même exigence que Discord (03/10/2026)", () => {
    it("membre sans canViewCalendar → refusé (fail-closed, même si isMember)", async () => {
        vi.mocked(getUserContext).mockResolvedValue({
            isAuthenticated: true,
            isMember: true,
            canViewCalendar: false,
            id: "u1",
        } as any);
        const res = await registerForEvent("g1", "e1");
        expect(res.success).toBe(false);
        expect(String((res as any).error)).toMatch(/calendrier/i);
    });

    it("membre avec canViewCalendar → passe au service", async () => {
        vi.mocked(getUserContext).mockResolvedValue({
            isAuthenticated: true,
            isMember: true,
            canViewCalendar: true,
            id: "u1",
        } as any);
        const { processRegistration } = await import("@/server/calendar-service");
        vi.mocked(processRegistration).mockResolvedValue({ success: true } as any);
        const res = await registerForEvent("g1", "e1");
        expect(res.success).toBe(true);
    });

    it("désinscription sans canViewCalendar → refusée", async () => {
        vi.mocked(getUserContext).mockResolvedValue({
            isAuthenticated: true,
            isMember: true,
            canViewCalendar: false,
            id: "u1",
        } as any);
        const res = await unregisterFromEvent("g1", "e1");
        expect(res.success).toBe(false);
    });
});
