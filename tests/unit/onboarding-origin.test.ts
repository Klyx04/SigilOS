/**
 * Régression — **origine d'une guilde** : self-onboarding vs pré-approuvée.
 *
 * 🎯 Audit du 24/09/2026 (mémo `temp/`), confirmé sur pièces : le gateway bot crée
 * DÉJÀ la ligne `AllowedGuild` (`tier: "BETA"`, `addedBy: "SYSTEM_GATEWAY"`) quand
 * il est invité, **avant** que l'admin clique « Déployer ». Trois conséquences
 * mesurées :
 *  1. `onboardGuild` (`isAutonomous = !existingAllowed`) annonçait
 *     « VIP / WHITELIST » à un self-onboarding normal ;
 *  2. la console God affichait « 👑 VIP Manuel » pour la même guilde
 *     (heuristique `notes ~ /autonomie/ || tier === "COMMUNITY"`) ;
 *  3. le kill-switch God (`autoOnboardingEnabled === false`) était **contourné** :
 *     la ligne existant (même inactive), `isAutonomous` valait `false` ⇒ aucune
 *     gate, et l'ancien `else if (!isActive)` réactivait la guilde.
 *
 * Ces tests verrouillent : ① la règle pure unique ; ② son usage effectif (aucune
 * heuristique locale ne doit réapparaître) ; ③ le flow réel `onboardGuild` ; ④ le
 * refus fail-closed d'une guilde gelée.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@/lib/prisma", () => ({
    db: {
        platformBan: { findFirst: vi.fn() },
        platformConfig: { findUnique: vi.fn() },
        guildConfig: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
        allowedGuild: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
        userProfile: { updateMany: vi.fn() },
    },
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/server/discord", () => ({ fetchGuild: vi.fn() }));
vi.mock("@/server/actions/guards", () => ({ requireGuildAdmin: vi.fn() }));
vi.mock("@/server/actions/god-notif-actions", () => ({ notifyGod: vi.fn() }));
vi.mock("@/server/actions/audit-actions", () => ({ logAction: vi.fn(), createAuditLog: vi.fn() }));
vi.mock("@/server/actions/user-actions", () => ({
    invalidateGuildCache: vi.fn(),
    flushGuildUserContextCache: vi.fn(),
}));
vi.mock("@/server/actions/super-admin-actions", () => ({
    invalidateAllowedGuildCache: vi.fn(),
    isSuperAdmin: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { rateLimit } from "@/lib/ratelimit";
import { fetchGuild } from "@/server/discord";
import { requireGuildAdmin } from "@/server/actions/guards";
import { notifyGod } from "@/server/actions/god-notif-actions";
import { onboardGuild } from "@/server/actions/admin-actions";
import {
    isSelfOnboardedGuild,
    resolveOnboardingOrigin,
    SYSTEM_GATEWAY_ADDED_BY,
} from "@/lib/onboarding-gating";

const GUILD = "111111111111111111";

describe("règle pure — origine d'une guilde", () => {
    it("aucune ligne = self-onboarding (c'est onboardGuild qui la créera)", () => {
        expect(isSelfOnboardedGuild(null)).toBe(true);
        expect(resolveOnboardingOrigin(null)).toMatchObject({ kind: "AUTONOME", tag: "AUTONOME" });
    });

    it("ligne créée par le gateway bot = AUTONOME (le cas NORMAL, celui qui était mal étiqueté)", () => {
        const gateway = { tier: "BETA", notes: "Auto-déployable via Gateway bot on 2026-09-24.", addedBy: SYSTEM_GATEWAY_ADDED_BY };
        expect(isSelfOnboardedGuild(gateway)).toBe(true);
        expect(resolveOnboardingOrigin(gateway)).toMatchObject({ kind: "AUTONOME", tag: "AUTONOME" });
    });

    it("ligne créée par onboardGuild (tier COMMUNITY) = AUTONOME", () => {
        expect(isSelfOnboardedGuild({ tier: "COMMUNITY", notes: "Onboarding en autonomie", addedBy: "123" })).toBe(true);
    });

    it("note historique « autonomie » = AUTONOME (compatibilité)", () => {
        expect(isSelfOnboardedGuild({ tier: "BETA", notes: "Onboarding en Autonomie", addedBy: "123" })).toBe(true);
    });

    it("whitelist God (ajoutée par un humain) = PRÉ-APPROUVÉE, jamais autonome", () => {
        const godRow = { tier: "BETA", notes: "Ajout manuel", addedBy: "424242424242424242" };
        expect(isSelfOnboardedGuild(godRow)).toBe(false);
        expect(resolveOnboardingOrigin(godRow)).toMatchObject({ kind: "ACCOMPAGNEE", tag: "WHITELIST" });
    });

    it("validation par ticket (tier VIP) = accompagnée, tag VIP", () => {
        expect(resolveOnboardingOrigin({ tier: "VIP", notes: "Validé via ticket #12", addedBy: "4242" }))
            .toMatchObject({ kind: "ACCOMPAGNEE", tag: "VIP" });
    });
});


describe("usage unique — aucune heuristique locale ne doit réapparaître", () => {
    // On lit le CODE (commentaires retirés) : les commentaires expliquent
    // l'ancien bug et citeraient sinon les motifs interdits.
    const codeOf = (p: string) =>
        readFileSync(p, "utf8")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    const GOD_TABLE = codeOf("src/app/god/components/guild-table.tsx");
    const ADMIN_ACTIONS = codeOf("src/server/actions/admin-actions.ts");
    const BOT = codeOf("services/discord-bot/index.ts");

    it("la console God consomme la règle partagée", () => {
        expect(GOD_TABLE).toMatch(/from ['"]@\/lib\/onboarding-gating['"]/);
        expect(GOD_TABLE).toContain("isSelfOnboardedGuild(");
        expect(GOD_TABLE).toContain("resolveOnboardingOrigin(");
    });

    it("l'ancienne heuristique de la console God a disparu", () => {
        expect(GOD_TABLE).not.toMatch(/notes\?\.toLowerCase\(\)\.includes\("autonomie"\)/);
        expect(GOD_TABLE).not.toContain("👑 VIP Manuel");
    });

    it("onboardGuild ne déduit plus l'autonomie de la seule existence de la ligne", () => {
        expect(ADMIN_ACTIONS).not.toMatch(/isAutonomous\s*=\s*!existingAllowed/);
        expect(ADMIN_ACTIONS).toMatch(/resolveOnboardingOrigin\(existingAllowed\)/);
        expect(ADMIN_ACTIONS).not.toContain("VIP / WHITELIST");
    });

    it("le bot dit la même vérité en base et dans Discord (embed branché sur le kill-switch)", () => {
        expect(BOT).toMatch(/autoOnboardingOn \? 'GUILD_CREATE_AUTO' : 'GUILD_CREATE_UNWHITELISTED'/);
        expect(BOT).toMatch(/embeds: \[autoOnboardingOn \?/);
        // le vert « auto-actif » et le rouge « action requise » coexistent, sur la même condition
        expect(BOT).toContain("🟢 Nouveau serveur (auto-actif)");
        expect(BOT).toContain("🚨 Nouveau serveur non-whitelisté");
    });
});

describe("onboardGuild — flow réel (bot déjà invité, ligne SYSTEM_GATEWAY active)", () => {
    const mockDb = db as any;

    beforeEach(() => {
        vi.clearAllMocks();
        (auth as any).mockResolvedValue({ user: { id: "god-1", name: "God" } });
        (rateLimit as any).mockResolvedValue({ success: true });
        (requireGuildAdmin as any).mockResolvedValue({ isAuthorized: true, discordUserId: "424242424242424242" });
        (fetchGuild as any).mockResolvedValue({ id: GUILD, name: "Kamas NOT Found", owner_id: "42", icon: null });
        mockDb.platformBan.findFirst.mockResolvedValue(null);
        mockDb.platformConfig.findUnique.mockResolvedValue({ autoOnboardingEnabled: true });
        mockDb.guildConfig.findUnique.mockResolvedValue(null);
        mockDb.guildConfig.create.mockResolvedValue({ id: "cfg-1" });
        mockDb.allowedGuild.create.mockResolvedValue({});
        mockDb.allowedGuild.update.mockResolvedValue({});
    });

    it("annonce AUTONOME (et non « VIP / WHITELIST ») et ne retouche pas la ligne du bot", async () => {
        mockDb.allowedGuild.findUnique.mockResolvedValue({
            discordGuildId: GUILD, tier: "BETA", isActive: true, addedBy: SYSTEM_GATEWAY_ADDED_BY,
        });

        const res = await onboardGuild(GUILD);

        expect(res.success).toBe(true);
        expect(mockDb.allowedGuild.create).not.toHaveBeenCalled();
        expect(mockDb.allowedGuild.update).not.toHaveBeenCalled();
        const notif = (notifyGod as any).mock.calls[0][0];
        expect(notif.title).toContain("autonome");
        expect(notif.metadata.type).toBe("AUTONOME");
        expect(notif.message).not.toContain("VIP");
    });

    it("pré-approuvée par le staff ⇒ tag WHITELIST", async () => {
        mockDb.allowedGuild.findUnique.mockResolvedValue({
            discordGuildId: GUILD, tier: "BETA", isActive: true, addedBy: "424242424242424242",
        });

        const res = await onboardGuild(GUILD);

        expect(res.success).toBe(true);
        expect((notifyGod as any).mock.calls[0][0].metadata.type).toBe("WHITELIST");
    });

    it("kill-switch God : une ligne du bot ACTIVE ne se déploie plus quand l'auto-onboarding est fermé", async () => {
        mockDb.allowedGuild.findUnique.mockResolvedValue({
            discordGuildId: GUILD, tier: "BETA", isActive: true, addedBy: SYSTEM_GATEWAY_ADDED_BY,
        });
        mockDb.platformConfig.findUnique.mockResolvedValue({ autoOnboardingEnabled: false });

        const res = await onboardGuild(GUILD);

        expect(res.success).toBe(false);
        expect(res.error).toContain("suspendus");
        expect(mockDb.guildConfig.create).not.toHaveBeenCalled();
    });

    it("guilde gelée (isActive:false) ⇒ refus fail-closed, jamais de réactivation silencieuse", async () => {
        mockDb.allowedGuild.findUnique.mockResolvedValue({
            discordGuildId: GUILD, tier: "BETA", isActive: false, addedBy: SYSTEM_GATEWAY_ADDED_BY,
        });

        const res = await onboardGuild(GUILD);

        expect(res.success).toBe(false);
        expect(mockDb.allowedGuild.update).not.toHaveBeenCalled();
        expect(mockDb.guildConfig.create).not.toHaveBeenCalled();
    });
});
