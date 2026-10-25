/**
 * Chantier Y, lot **Y-4** — vue informative « Prochains paliers » (qui va bientôt basculer).
 *
 * 🛡️ Ce que ce test protège :
 * ① la règle pure `resolveUpcomingTierChange` : prochain palier **non franchi**, jamais celui
 *    déjà atteint, `null` quand tous les paliers sont passés, **indépendante de l'ordre** reçu ;
 * ② la liste côté serveur : **fenêtre** de 30 jours (on n'affiche pas qui basculera dans 3 mois),
 *    tri du plus proche au plus lointain, **plafond** d'affichage avec compteur total ;
 * ③ l'écran : une section **responsive** (tableau desktop / cartes mobile), qui lit la fenêtre
 *    de la règle (jamais un 30 en dur) et n'expose **aucune** action (purement informative).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const guildConfigFindUnique = vi.fn();
const userProfileFindMany = vi.fn();
const announcementCount = vi.fn();
const announcementFindFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
    db: {
        guildConfig: { findUnique: (...args: unknown[]) => guildConfigFindUnique(...args), update: vi.fn() },
        userProfile: { findMany: (...args: unknown[]) => userProfileFindMany(...args) },
        seniorityRoleAnnouncement: {
            count: (...args: unknown[]) => announcementCount(...args),
            findFirst: (...args: unknown[]) => announcementFindFirst(...args),
        },
    },
}));

const getUserContext = vi.fn();
vi.mock("@/server/actions/user-actions", () => ({
    getUserContext: (...args: unknown[]) => getUserContext(...args),
}));

vi.mock("@/lib/ratelimit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/server/discord", () => ({ validateChannelBelongsToGuild: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/cron-telemetry", () => ({ getAllCronStatuses: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { getSeniorityRolesSettings } from "@/server/actions/seniority-roles-actions";
import {
    SENIORITY_UPCOMING_WINDOW_DAYS,
    resolveUpcomingTierChange,
    type SeniorityTier,
} from "@/lib/seniority-roles";

const PANEL = "src/components/admin/members/seniority-roles-panel.tsx";
const source = (path: string) => readFileSync(path, "utf8");

const GUILD_ID = "1290442961380835451";
const TIERS: SeniorityTier[] = [
    { days: 30, roleIds: ["200000000000000001"] },
    { days: 180, roleIds: ["200000000000000002"] },
    { days: 365, roleIds: ["200000000000000003"] },
];

/** Profil actif à `days` jours d'ancienneté (arrivée manuelle), avec de quoi l'afficher. */
const profileAt = (days: number, name: string) => ({
    guildJoinedAt: new Date(Date.now() - days * 86_400_000),
    discordJoinedAt: null,
    createdAt: new Date(),
    pseudoDofus: name,
    discordNickname: null,
    user: { name, image: null },
});

beforeEach(() => {
    vi.clearAllMocks();
    getUserContext.mockResolvedValue({
        isAuthenticated: true,
        isMember: true,
        isAdmin: false,
        canManageMembers: true,
        id: "user-1",
    });
    guildConfigFindUnique.mockResolvedValue({
        id: "guild-1",
        name: "Sigil",
        iconUrl: null,
        seniorityRolesEnabled: true,
        seniorityRolesChannelId: "200000000000000009",
        seniorityRolesTiers: TIERS,
        seniorityRolesAnnouncement: null,
        seniorityRolesActivatedAt: new Date("2026-10-01T04:30:00.000Z"),
    });
    userProfileFindMany.mockResolvedValue([]);
    announcementCount.mockResolvedValue(0);
    announcementFindFirst.mockResolvedValue(null);
});

describe("Y-4 — liste côté serveur : fenêtre, tri, plafond", () => {
    it("ne retient que les membres qui basculent dans la fenêtre", async () => {
        userProfileFindMany.mockResolvedValue([
            profileAt(175, "Bientot"), // palier 180 dans 5 j → dedans
            profileAt(10, "ToutNeuf"), // palier 30 dans 20 j → dedans
            profileAt(100, "PlusTard"), // palier 180 dans 80 j → dehors
            profileAt(400, "Complet"), // tous les paliers franchis → dehors
        ]);

        const result = await getSeniorityRolesSettings(GUILD_ID);
        if (!result.success || !result.data) throw new Error("réglages attendus");

        expect(result.data.upcoming.map((member) => member.displayName)).toEqual(["Bientot", "ToutNeuf"]);
        expect(result.data.upcoming[0]).toMatchObject({ tierDays: 180, daysUntil: 5, seniorityDays: 175 });
        expect(result.data.upcomingTotal).toBe(2);
    });

    it("trie du plus proche au plus lointain, puis par pseudo", async () => {
        userProfileFindMany.mockResolvedValue([
            profileAt(178, "Zoe"), // dans 2 j
            profileAt(29, "Alpha"), // dans 1 j
            profileAt(178, "Anna"), // dans 2 j
        ]);

        const result = await getSeniorityRolesSettings(GUILD_ID);
        if (!result.success || !result.data) throw new Error("réglages attendus");

        expect(result.data.upcoming.map((member) => member.displayName)).toEqual(["Alpha", "Anna", "Zoe"]);
    });

    it("plafonne l'affichage à 25 et rend le total", async () => {
        userProfileFindMany.mockResolvedValue(
            Array.from({ length: 30 }, (_, index) => profileAt(179, `Membre ${index}`)),
        );

        const result = await getSeniorityRolesSettings(GUILD_ID);
        if (!result.success || !result.data) throw new Error("réglages attendus");

        expect(result.data.upcoming).toHaveLength(25);
        expect(result.data.upcomingTotal).toBe(30);
    });

    it("sans palier configuré, la liste est vide (aucune restriction inventée)", async () => {
        const base = await guildConfigFindUnique();
        guildConfigFindUnique.mockResolvedValue({ ...base, seniorityRolesTiers: [] });
        userProfileFindMany.mockResolvedValue([profileAt(175, "Bientot")]);

        const result = await getSeniorityRolesSettings(GUILD_ID);
        if (!result.success || !result.data) throw new Error("réglages attendus");

        expect(result.data.upcoming).toEqual([]);
        expect(result.data.upcomingTotal).toBe(0);
    });
});

describe("Y-4 — l'écran : responsive et purement informatif", () => {
    it("la section existe et lit la fenêtre de la règle (jamais un 30 en dur)", () => {
        const code = source(PANEL);
        expect(code).toContain("Prochains paliers");
        expect(code).toContain("SENIORITY_UPCOMING_WINDOW_DAYS");
        expect(SENIORITY_UPCOMING_WINDOW_DAYS).toBe(30);
    });

    it("est responsive : tableau sur desktop, cartes en dessous de md", () => {
        const code = source(PANEL);
        expect(code).toContain("hidden overflow-hidden rounded-xl border border-border md:block");
        expect(code).toContain("space-y-2 md:hidden");
    });

    it("reste une vue : aucune écriture, seuls les boutons de pagination", () => {
        const code = source(PANEL);
        const start = code.indexOf('<TabsContent value="prochains"');
        const end = code.indexOf('<TabsContent value="etat"');
        expect(start, "onglet « Prochains paliers » introuvable").toBeGreaterThan(-1);
        expect(end).toBeGreaterThan(start);
        const section = code.slice(start, end);
        expect(section).toContain("Prochains paliers");
        expect(section).not.toContain("<Input");
        expect(section).not.toContain("<Switch");
        expect(section).not.toContain("<Textarea");
        expect(section).not.toContain("updateSeniorityRolesSettings");
        // Seule interaction tolérée : la pagination (navigation, aucune mutation).
        const labels = [...section.matchAll(/aria-label="(Page[^"]+)"/g)].map((match) => match[1]);
        expect(labels).toEqual([
            "Page précédente des prochains paliers",
            "Page suivante des prochains paliers",
        ]);
        expect((section.match(/<Button/g) ?? []).length).toBe(2);
    });
});
describe("Y-4 — règle pure : prochain palier", () => {
    it("donne le prochain palier non franchi et les jours restants", () => {
        expect(resolveUpcomingTierChange({ tiers: TIERS, seniorityDays: 10 })).toEqual({
            tierIndex: 0,
            tierDays: 30,
            daysUntil: 20,
        });
        expect(resolveUpcomingTierChange({ tiers: TIERS, seniorityDays: 30 })).toEqual({
            tierIndex: 1,
            tierDays: 180,
            daysUntil: 150,
        });
        expect(resolveUpcomingTierChange({ tiers: TIERS, seniorityDays: 200 })?.daysUntil).toBe(165);
    });

    it("rend `null` quand tous les paliers sont franchis (ou aucun palier configuré)", () => {
        expect(resolveUpcomingTierChange({ tiers: TIERS, seniorityDays: 400 })).toBeNull();
        expect(resolveUpcomingTierChange({ tiers: [], seniorityDays: 10 })).toBeNull();
    });

    it("compare les seuils : l'ordre reçu ne change rien", () => {
        const shuffled: SeniorityTier[] = [TIERS[2], TIERS[0], TIERS[1]];
        expect(resolveUpcomingTierChange({ tiers: shuffled, seniorityDays: 40 })).toEqual({
            // L'index est celui du tableau **reçu** (180 est le 3ᵉ élément ici) : la règle compare
            // les seuils, elle ne réordonne rien — c'est `normalizeSeniorityTiers` qui trie en base.
            tierIndex: 2,
            tierDays: 180,
            daysUntil: 140,
        });
    });

    it("borne une ancienneté absurde à zéro", () => {
        expect(resolveUpcomingTierChange({ tiers: TIERS, seniorityDays: Number.NaN })?.daysUntil).toBe(30);
        expect(resolveUpcomingTierChange({ tiers: TIERS, seniorityDays: -50 })?.daysUntil).toBe(30);
    });
});