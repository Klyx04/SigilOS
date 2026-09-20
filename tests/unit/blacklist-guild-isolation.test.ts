/**
 * Garde d'isolation de guilde — `editBlacklistEntry` (F3 · S-14, 20/09/2026).
 *
 * 🎯 La faille mesurée : le RBAC était vérifié sur la guilde **déclarée**, puis le
 * signalement était lu **et** écrit par son seul `id` — un admin de la guilde A
 * pouvait donc modifier une entrée de la guilde B (message Discord de B compris)
 * en connaissant son cuid. Violation d'`AGENTS.md` §5.2 (« vérifier que la cible
 * appartient à la guilde avant toute écriture ») ; seul IDOR réel du lot d'audit
 * du 20/09/2026 (muse CYB-01, arbitrage §4-B du croisement).
 *
 * 🛡️ Ce que ce test verrouille :
 *  - la lecture **et** l'écriture portent `guildId` (résolu côté serveur) ;
 *  - une entrée d'une autre guilde ⇒ refus **et aucune écriture** (base **et** Discord) ;
 *  - la garde d'état en course : `count === 0` ⇒ « introuvable », jamais une écriture
 *    à côté (`AGENTS.md` §5.9) ;
 *  - le retour aux appels **non filtrés** est impossible : `findUnique` / `update` sont
 *    des espions qui **jettent** — s'ils étaient rappelés, les tests tomberaient.
 *
 * ⚠️ Lecture seule : aucun accès base ni réseau (dépendances mockées, comme `guards.test.ts`).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
    db: {
        guildConfig: { findUnique: vi.fn() },
        blacklistEntry: {
            // Chemin **filtré** (attendu après F3) :
            findFirst: vi.fn(),
            updateMany: vi.fn(),
            // Chemins **non filtrés** (à ne jamais rappeler) : ils jettent.
            findUnique: vi.fn(() => {
                throw new Error("findUnique non filtré : chemin interdit");
            }),
            update: vi.fn(() => {
                throw new Error("update non filtré : chemin interdit");
            }),
        },
    },
}));

vi.mock("@/server/discord", () => ({
    sendChannelMessage: vi.fn(),
    updateChannelMessage: vi.fn(),
    deleteChannelMessage: vi.fn(),
    validateChannelBelongsToGuild: vi.fn(),
}));

vi.mock("@/server/actions/user-actions", () => ({ getUserContext: vi.fn() }));
vi.mock("@/server/actions/audit-actions", () => ({ createAuditLog: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { getUserContext } from "@/server/actions/user-actions";
import { updateChannelMessage } from "@/server/discord";
import { editBlacklistEntry } from "@/server/actions/blacklist-actions";

/** Guilde déclarée par l'appelant (snowflake Discord) et sa ligne interne. */
const DISCORD_GUILD_A = "1468000000000000001";
const GUILD_A = { id: "guilde-interne-A", blacklistChannelId: "chan-A" };

/** Entrée de la guilde **B** : l'attaquant connaît son cuid, pas sa guilde. */
const ENTRY_B = {
    id: "entree-B",
    guildId: "guilde-interne-B",
    discordMessageId: "msg-B",
    content: "contenu de B",
};

/** Entrée légitime de la guilde **A**. */
const ENTRY_A = {
    id: "entree-A",
    guildId: "guilde-interne-A",
    discordMessageId: "msg-A",
    content: "contenu d'origine",
};

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockContext = getUserContext as unknown as ReturnType<typeof vi.fn>;
const mockGuildFindUnique = db.guildConfig.findUnique as unknown as ReturnType<typeof vi.fn>;
const mockFindFirst = db.blacklistEntry.findFirst as unknown as ReturnType<typeof vi.fn>;
const mockUpdateMany = db.blacklistEntry.updateMany as unknown as ReturnType<typeof vi.fn>;
const mockLegacyFindUnique = db.blacklistEntry.findUnique as unknown as ReturnType<typeof vi.fn>;
const mockLegacyUpdate = db.blacklistEntry.update as unknown as ReturnType<typeof vi.fn>;
const mockUpdateChannelMessage = updateChannelMessage as unknown as ReturnType<typeof vi.fn>;

/** Aucun chemin non filtré ne doit avoir été emprunté. */
function expectNoUnscopedAccess() {
    expect(mockLegacyFindUnique, "lecture non filtrée rappelée").not.toHaveBeenCalled();
    expect(mockLegacyUpdate, "écriture non filtrée rappelée").not.toHaveBeenCalled();
}

beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1", name: "Admin A" } });
    mockContext.mockResolvedValue({
        isAdmin: true,
        canManageMembers: true,
        name: "Admin A",
        image: null,
    });
    mockGuildFindUnique.mockResolvedValue(GUILD_A);
});

describe("editBlacklistEntry — isolation de guilde (F3)", () => {
    it("refuse une entrée d'une autre guilde et n'écrit nulle part", async () => {
        // Guilde A demandée → la lecture filtrée ne peut pas trouver l'entrée de B.
        mockFindFirst.mockResolvedValue(null);

        const res = await editBlacklistEntry(DISCORD_GUILD_A, ENTRY_B.id, "contenu pirate");

        expect(res).toEqual({ success: false, error: "Entrée introuvable" });
        expect(mockFindFirst, "la lecture doit porter la guilde interne résolue").toHaveBeenCalledWith({
            where: { id: ENTRY_B.id, guildId: GUILD_A.id },
        });
        expect(mockUpdateMany, "aucune écriture en base").not.toHaveBeenCalled();
        expect(mockUpdateChannelMessage, "aucune écriture Discord").not.toHaveBeenCalled();
        expectNoUnscopedAccess();
    });

    it("lit et écrit avec la guilde (cas nominal A → A)", async () => {
        mockFindFirst.mockResolvedValue(ENTRY_A);
        mockUpdateMany.mockResolvedValue({ count: 1 });

        const res = await editBlacklistEntry(DISCORD_GUILD_A, ENTRY_A.id, "  contenu corrigé  ");

        expect(res).toEqual({ success: true });
        expect(mockUpdateMany).toHaveBeenCalledWith({
            where: { id: ENTRY_A.id, guildId: GUILD_A.id },
            data: { content: "contenu corrigé" },
        });
        // La synchro Discord continue de fonctionner (même guilde, même message).
        // ⚠️ Comportement **préexistant** (hors périmètre F3, non modifié) : Discord reçoit
        // le texte **brut**, la base reçoit le texte **nettoyé** (`content.trim()`).
        expect(mockUpdateChannelMessage).toHaveBeenCalledWith(
            "chan-A",
            "msg-A",
            "  contenu corrigé  ",
            expect.anything(),
        );
        expectNoUnscopedAccess();
    });

    it("course : entrée disparue entre la lecture et l'écriture ⇒ « introuvable »", async () => {
        mockFindFirst.mockResolvedValue(ENTRY_A);
        // L'entrée n'appartient plus à la guilde (déplacée/supprimée) : 0 ligne touchée.
        mockUpdateMany.mockResolvedValue({ count: 0 });

        const res = await editBlacklistEntry(DISCORD_GUILD_A, ENTRY_A.id, "contenu corrigé");

        expect(res).toEqual({ success: false, error: "Entrée introuvable" });
        expectNoUnscopedAccess();
    });

    it("un membre sans droit « gérer les membres » ne touche à rien", async () => {
        mockContext.mockResolvedValue({ isAdmin: false, canManageMembers: false });

        const res = await editBlacklistEntry(DISCORD_GUILD_A, ENTRY_B.id, "contenu pirate");

        expect(res).toEqual({ success: false, error: "Permission requise" });
        expect(mockGuildFindUnique).not.toHaveBeenCalled();
        expect(mockFindFirst).not.toHaveBeenCalled();
        expect(mockUpdateMany).not.toHaveBeenCalled();
        expectNoUnscopedAccess();
    });
});
