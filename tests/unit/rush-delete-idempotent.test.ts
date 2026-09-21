/**
 * Garde — suppression des blocs et des quêtes du Rush Sylvestre : **IDEMPOTENTE**.
 *
 * 🎯 La panne mesurée (studio GOD, 20/09/2026) : `db.guideMilestone.delete({ where: { id } })`
 * jetait un **P2025** Prisma — « An operation failed because it depends on one or more records
 * that were required but not found. No record was found for a delete. » — dès que la ligne
 * n'existait déjà plus (second clic sur une liste pas encore rafraîchie, suppression depuis un
 * autre onglet). L'erreur remontait brute dans le studio au lieu d'un simple « déjà supprimée ».
 *
 * 🛡️ Ce que ce test verrouille :
 *  - **0 ligne touchée ⇒ succès** (`alreadyDeleted: true`) : l'état visé est atteint, pas d'exception ;
 *  - le `guideId` reste **dans le `WHERE`** : aucune suppression hors du guide rush ;
 *  - `delete()` — le chemin qui jette — n'est **jamais** rappelé (les espions jettent s'ils sont appelés) ;
 *  - le cas nominal supprime bien **et** revalide les surfaces concernées ;
 *  - un appelant sans accès God ne touche à rien.
 *
 * ⚠️ Lecture seule : aucune base, aucun réseau (dépendances mockées, comme `blacklist-guild-isolation.test.ts`).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
    db: {
        optimizedGuide: { findUnique: vi.fn() },
        guideMilestone: {
            deleteMany: vi.fn(),
            // Chemin d'origine (non idempotent) : à ne jamais rappeler — il jette.
            delete: vi.fn(() => {
                throw new Error("delete() non idempotent : chemin interdit");
            }),
        },
        guideSequence: {
            deleteMany: vi.fn(),
            delete: vi.fn(() => {
                throw new Error("delete() non idempotent : chemin interdit");
            }),
        },
    },
}));
vi.mock("@/server/actions/super-admin-actions", () => ({
    isSuperAdmin: vi.fn(),
    canAccessBrick: vi.fn(),
}));
vi.mock("@/server/actions/user-actions", () => ({ getUserContext: vi.fn() }));
vi.mock("@/server/actions/audit-actions", () => ({ createGodAuditLog: vi.fn() }));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: vi.fn(async () => ({ success: true })) }));
vi.mock("@/lib/guide-realtime", () => ({
    publishGuideEvent: vi.fn(),
    parseStepKey: vi.fn(() => null),
    getCachedGuideProgress: vi.fn(async () => null),
    invalidateGuideProgressCache: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { db } from "@/lib/prisma";
import { isSuperAdmin, canAccessBrick } from "@/server/actions/super-admin-actions";
import { revalidatePath } from "next/cache";
import { deleteRushMilestone, deleteRushSequence } from "@/server/actions/optimized-guide-actions";

const RUSH_GUIDE = { id: "guide-rush-sylvestre" };

const mockFindGuide = db.optimizedGuide.findUnique as unknown as ReturnType<typeof vi.fn>;
const mockDeleteMilestones = db.guideMilestone.deleteMany as unknown as ReturnType<typeof vi.fn>;
const mockLegacyDeleteMilestone = db.guideMilestone.delete as unknown as ReturnType<typeof vi.fn>;
const mockDeleteSequences = db.guideSequence.deleteMany as unknown as ReturnType<typeof vi.fn>;
const mockLegacyDeleteSequence = db.guideSequence.delete as unknown as ReturnType<typeof vi.fn>;
const mockIsSuperAdmin = isSuperAdmin as unknown as ReturnType<typeof vi.fn>;
const mockCanAccessBrick = canAccessBrick as unknown as ReturnType<typeof vi.fn>;
const mockRevalidate = revalidatePath as unknown as ReturnType<typeof vi.fn>;

/** Aucun chemin non idempotent ne doit avoir été emprunté. */
function expectNoLegacyDelete() {
    expect(mockLegacyDeleteMilestone, "delete() milestone rappelé").not.toHaveBeenCalled();
    expect(mockLegacyDeleteSequence, "delete() séquence rappelé").not.toHaveBeenCalled();
}

beforeEach(() => {
    vi.clearAllMocks();
    mockIsSuperAdmin.mockResolvedValue(true);
    mockCanAccessBrick.mockResolvedValue(true);
    mockFindGuide.mockResolvedValue(RUSH_GUIDE);
});

describe("deleteRushMilestone / deleteRushSequence — suppression idempotente", () => {
    it("bloc déjà absent (0 ligne) ⇒ succès, pas d'exception", async () => {
        mockDeleteMilestones.mockResolvedValue({ count: 0 });

        const res = await deleteRushMilestone("bloc-deja-supprime");

        expect(res).toEqual({ success: true, alreadyDeleted: true });
        // La garde d'état vit DANS le WHERE : id + guide du rush.
        expect(mockDeleteMilestones).toHaveBeenCalledWith({
            where: { id: "bloc-deja-supprime", guideId: RUSH_GUIDE.id },
        });
        expectNoLegacyDelete();
    });

    it("bloc existant ⇒ supprimé et surfaces revalidées", async () => {
        mockDeleteMilestones.mockResolvedValue({ count: 1 });

        const res = await deleteRushMilestone("bloc-1");

        expect(res).toEqual({ success: true, alreadyDeleted: false });
        expect(mockRevalidate).toHaveBeenCalledWith("/god/rush-sylvestre");
        expect(mockRevalidate).toHaveBeenCalledWith("/dashboard");
        expectNoLegacyDelete();
    });

    it("guide rush introuvable ⇒ aucune écriture, succès idempotent", async () => {
        mockFindGuide.mockResolvedValue(null);

        const res = await deleteRushMilestone("bloc-1");

        expect(res).toEqual({ success: true, alreadyDeleted: true });
        expect(mockDeleteMilestones).not.toHaveBeenCalled();
        expectNoLegacyDelete();
    });

    it("quête déjà absente (0 ligne) ⇒ succès, pas d'exception", async () => {
        mockDeleteSequences.mockResolvedValue({ count: 0 });

        const res = await deleteRushSequence("quete-deja-supprimee");

        expect(res).toEqual({ success: true, alreadyDeleted: true });
        expect(mockDeleteSequences).toHaveBeenCalledWith({ where: { id: "quete-deja-supprimee" } });
        expectNoLegacyDelete();
    });

    it("sans accès God, rien ne part : le refus vient avant toute écriture", async () => {
        mockIsSuperAdmin.mockResolvedValue(false);
        mockCanAccessBrick.mockResolvedValue(false);

        await expect(deleteRushMilestone("bloc-1")).rejects.toThrow("Accès non autorisé");
        await expect(deleteRushSequence("quete-1")).rejects.toThrow("Accès non autorisé");

        expect(mockDeleteMilestones).not.toHaveBeenCalled();
        expect(mockDeleteSequences).not.toHaveBeenCalled();
        expectNoLegacyDelete();
    });
});
