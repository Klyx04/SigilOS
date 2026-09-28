import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Kill-switch « Auto-onboarding » (`PlatformConfig.autoOnboardingEnabled`).
 *
 * 🧭 Chantier « purge des onglets morts du God » (28/09/2026) : la **seconde**
 * porte d'écriture `toggleAutoOnboarding()` (ex-`god-roadmap-actions.ts`) est
 * supprimée — elle n'était appelée par **aucun** écran (seul un test la
 * couvrait) et doublonnait `updatePlatformConfig()`, la porte réellement
 * utilisée par le panneau God. Une règle, une porte, un test — ce fichier
 * remplace donc les 2 cas qui visaient la porte morte.
 */
vi.mock("@/lib/prisma", () => ({
    db: { platformConfig: { upsert: vi.fn(), findUnique: vi.fn() } },
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/actions/super-admin-actions", () => ({ isSuperAdmin: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/server/actions/audit-actions", () => ({
    createAuditLog: vi.fn(),
    createGodAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { updatePlatformConfig } from "@/server/actions/changelog-actions";

const mockDb = db as any;
const mockIsSuperAdmin = isSuperAdmin as ReturnType<typeof vi.fn>;

describe("auto-onboarding — une seule porte d'écriture, God only", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "god-1" } });
        mockDb.platformConfig.upsert.mockResolvedValue({ id: "singleton" });
    });

    it("refuse les non-God sans écrire", async () => {
        mockIsSuperAdmin.mockResolvedValue(false);
        const res = await updatePlatformConfig({ autoOnboardingEnabled: false });
        expect(res.success).toBe(false);
        expect(mockDb.platformConfig.upsert).not.toHaveBeenCalled();
    });

    it("refuse une valeur non booléenne (fail-closed)", async () => {
        mockIsSuperAdmin.mockResolvedValue(true);
        const res = await updatePlatformConfig({ autoOnboardingEnabled: "false" as any });
        expect(res.success).toBe(false);
        expect(res.error).toContain("autoOnboardingEnabled");
        expect(mockDb.platformConfig.upsert).not.toHaveBeenCalled();
    });

    it("écrit le singleton quand God, sur la porte unique", async () => {
        mockIsSuperAdmin.mockResolvedValue(true);
        const res = await updatePlatformConfig({ autoOnboardingEnabled: false });
        expect(res.success).toBe(true);
        expect(mockDb.platformConfig.upsert).toHaveBeenCalledWith(
            expect.objectContaining({ update: expect.objectContaining({ autoOnboardingEnabled: false }) })
        );
    });

    it("aucun autre fichier de `src/server` n'écrit ce drapeau", () => {
        // Garde anti-retour de la 2ᵉ porte : on ne compte que les **écritures**
        // (`autoOnboardingEnabled: <valeur>` dans un `update`/`create`/`data`), en
        // excluant les `select: { autoOnboardingEnabled: true }` qui sont des lectures.
        const walk = (dir: string): string[] =>
            readdirSync(dir).flatMap((e) => {
                const full = join(dir, e);
                return statSync(full).isDirectory() ? walk(full) : [full.replace(/\\/g, "/")];
            });
        const writers = walk("src/server")
            .filter((f) => /\.tsx?$/.test(f))
            .filter((f) =>
                readFileSync(f, "utf8")
                    .split(/\r?\n/)
                    .some((line) => /autoOnboardingEnabled\s*:/.test(line) && !/select:\s*\{/.test(line))
            );
        expect(writers).toEqual(["src/server/actions/changelog-actions.ts"]);
    });
});
