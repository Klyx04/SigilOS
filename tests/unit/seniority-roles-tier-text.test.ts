/**
 * Chantier Y, lot **Y-5** — texte **par palier** (demande user : « éditer chaque palier créé et son
 * texte »).
 *
 * 🛡️ Ce que ce test protège :
 * ① la relecture d'une surcharge : champ par champ, borné, **une chaîne vide n'est pas une
 *    surcharge** (elle hérite) — et le texte **survit** au dédoublonnage des rôles (il appartient
 *    au seuil, pas à l'ordre reçu) ;
 * ② la règle d'héritage `resolveTierAnnouncement` : les champs fournis remplacent, les autres
 *    héritent ; **couleur et miniature restent communes** ;
 * ③ le contrat serveur : la surcharge est acceptée bornée, refusée si elle dépasse ou si elle
 *    contient une clé inconnue ;
 * ④ l'écran : un texte par palier + un aperçu **du palier choisi** (le même rendu pur que l'envoi).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import {
    DEFAULT_SENIORITY_ANNOUNCEMENT,
    normalizeSeniorityTiers,
    resolveTierAnnouncement,
    type SeniorityAnnouncementConfig,
    type SeniorityTier,
} from "@/lib/seniority-roles";

const ROLE = "200000000000000001";
const GLOBAL: SeniorityAnnouncementConfig = {
    messageTemplate: "🎉 Bravo {membre}",
    embedTitle: "Nouveau palier",
    embedDescription: "Depuis {anciennete}",
    color: 0x9333ea,
    thumbnail: "avatar",
};

describe("Y-5 — relecture d'une surcharge de texte", () => {
    it("garde les champs fournis et ignore les champs vides", () => {
        const tiers = normalizeSeniorityTiers([
            {
                days: 180,
                roleIds: [ROLE],
                announcement: { embedTitle: "  Six mois déjà !  ", messageTemplate: "", embedDescription: "   " },
            },
        ]);

        expect(tiers[0].announcement).toEqual({ embedTitle: "Six mois déjà !" });
    });

    it("sans surcharge exploitable, le palier reste simple (aucun objet vide)", () => {
        const tiers = normalizeSeniorityTiers([{ days: 30, roleIds: [ROLE], announcement: { embedTitle: "" } }]);

        expect(tiers[0]).toEqual({ days: 30, roleIds: [ROLE] });
        expect("announcement" in tiers[0]).toBe(false);
    });

    it("borne le texte et survit au dédoublonnage des rôles", () => {
        const tiers = normalizeSeniorityTiers([
            // Deux paliers se disputent le même rôle : le premier seuil le garde, mais **son** texte
            // doit survivre à l'arbitrage.
            { days: 30, roleIds: [ROLE], announcement: { embedTitle: "Premier" } },
            { days: 180, roleIds: [ROLE], announcement: { embedTitle: "Deuxième" } },
            { days: 365, roleIds: ["200000000000000002"], announcement: { embedTitle: "x".repeat(400) } },
        ]);

        expect(tiers.map((tier) => tier.days)).toEqual([30, 365]);
        expect(tiers[0].announcement?.embedTitle).toBe("Premier");
        expect(tiers[1].announcement?.embedTitle).toHaveLength(256);
    });
});

describe("Y-5 — héritage du message global", () => {
    it("sans surcharge, l'annonce du palier est le message global (même référence)", () => {
        expect(resolveTierAnnouncement({ announcement: GLOBAL, tier: {} })).toBe(GLOBAL);
    });

    it("remplace champ par champ, et garde la couleur et la miniature communes", () => {
        const tier: Pick<SeniorityTier, "announcement"> = { announcement: { embedTitle: "Six mois !" } };
        const effective = resolveTierAnnouncement({ announcement: GLOBAL, tier });

        expect(effective.embedTitle).toBe("Six mois !");
        expect(effective.messageTemplate).toBe(GLOBAL.messageTemplate);
        expect(effective.embedDescription).toBe(GLOBAL.embedDescription);
        expect(effective.color).toBe(GLOBAL.color);
        expect(effective.thumbnail).toBe(GLOBAL.thumbnail);
        // Une annonce effective ne doit jamais être une vue partielle du global.
        expect(effective).not.toBe(GLOBAL);
    });
});

// ── Contrat serveur : la surcharge traverse la validation, bornée ────────────

const guildConfigFindUnique = vi.fn();
const guildConfigUpdate = vi.fn();

vi.mock("@/lib/prisma", () => ({
    db: {
        guildConfig: {
            findUnique: (...args: unknown[]) => guildConfigFindUnique(...args),
            update: (...args: unknown[]) => guildConfigUpdate(...args),
        },
        userProfile: { findMany: vi.fn().mockResolvedValue([]) },
        seniorityRoleAnnouncement: {
            count: vi.fn().mockResolvedValue(0),
            findFirst: vi.fn().mockResolvedValue(null),
        },
    },
}));

vi.mock("@/server/actions/user-actions", () => ({
    getUserContext: vi.fn().mockResolvedValue({
        isAuthenticated: true,
        isMember: true,
        isAdmin: false,
        canManageMembers: true,
        id: "user-1",
    }),
}));
vi.mock("@/lib/ratelimit", () => ({
    rateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 9, reset: 0 }),
}));
vi.mock("@/server/discord", () => ({ validateChannelBelongsToGuild: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/cron-telemetry", () => ({ getAllCronStatuses: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { updateSeniorityRolesSettings } from "@/server/actions/seniority-roles-actions";

const GUILD_ID = "1290442961380835451";
const PANEL = "src/components/admin/members/seniority-roles-panel.tsx";
const source = (path: string) => readFileSync(path, "utf8");

const settingsInput = (tiers: unknown[]) => ({
    enabled: true,
    tiers,
    announcement: { ...DEFAULT_SENIORITY_ANNOUNCEMENT },
});

beforeEach(() => {
    vi.clearAllMocks();
    guildConfigFindUnique.mockResolvedValue({
        id: "guild-1",
        name: "Sigil",
        iconUrl: null,
        seniorityRolesEnabled: true,
        seniorityRolesChannelId: null,
        seniorityRolesTiers: [],
        seniorityRolesAnnouncement: null,
        seniorityRolesActivatedAt: null,
    });
    guildConfigUpdate.mockResolvedValue({});
});

describe("Y-5 — contrat serveur : la surcharge est bornée", () => {
    it("accepte un texte par palier et l'écrit tel quel", async () => {
        const result = await updateSeniorityRolesSettings(
            GUILD_ID,
            settingsInput([
                { days: 180, roleIds: [ROLE], announcement: { embedTitle: "Six mois !", embedDescription: "Bravo." } },
            ]),
        );

        expect(result.success).toBe(true);
        const written = guildConfigUpdate.mock.calls[0][0].data;
        expect(written.seniorityRolesTiers).toEqual([
            { days: 180, roleIds: [ROLE], announcement: { embedTitle: "Six mois !", embedDescription: "Bravo." } },
        ]);
    });

    it("refuse un texte hors bornes, une clé inconnue, et n'écrit rien", async () => {
        const tooLong = await updateSeniorityRolesSettings(
            GUILD_ID,
            settingsInput([{ days: 180, roleIds: [ROLE], announcement: { embedTitle: "x".repeat(257) } }]),
        );
        expect(tooLong.success).toBe(false);

        const unknownKey = await updateSeniorityRolesSettings(
            GUILD_ID,
            settingsInput([{ days: 180, roleIds: [ROLE], announcement: { color: 1 } }]),
        );
        expect(unknownKey.success).toBe(false);

        expect(guildConfigUpdate).not.toHaveBeenCalled();
    });
});

describe("Y-5 — écran : texte par palier et aperçu du palier choisi", () => {
    it("chaque palier a son texte, replié, avec l'héritage annoncé", () => {
        const code = source(PANEL);
        expect(code).toContain("Texte de ce palier");
        expect(code).toContain("hérite du message global");
        expect(code).toContain("compactTierAnnouncement");
    });

    it("l'aperçu suit le palier choisi, avec le même rendu pur que l'envoi", () => {
        const code = source(PANEL);
        expect(code).toContain("resolveTierAnnouncement");
        expect(code).toContain("Palier relu dans l'aperçu");
    });
});