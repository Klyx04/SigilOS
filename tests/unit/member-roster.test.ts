/**
 * Roster unifié du module Membres — **règles pures** (chantier B, lot B-1).
 *
 * Ce que la garde protège :
 * - la FUSION des trois vues historiques (profils dashboard, registre RH, membres Discord hors
 *   dashboard) en **une seule liste**, sans jamais dupliquer un `discordId` ;
 * - le fait qu'une ligne hors dashboard ne porte **ni statut, ni essai, ni recruteur** (jamais de
 *   correspondance par accident sur un filtre de statut) ;
 * - les filtres (recherche, inscription, statut, rôle Discord), le tri et la pagination numérotée.
 */
import { describe, expect, it } from "vitest";

import {
    buildMemberRoster,
    DEFAULT_ROSTER_FILTERS,
    DEFAULT_ROSTER_SORT,
    matchesRosterFilters,
    paginateRoster,
    queryRoster,
    rosterCounts,
    rosterRoleOptions,
    sortRoster,
    type RosterDiscordOnlyInput,
    type RosterFilters,
    type RosterProfileInput,
    type RosterRow,
} from "@/lib/member-roster";

const filters = (patch: Partial<RosterFilters> = {}): RosterFilters => ({
    ...DEFAULT_ROSTER_FILTERS,
    ...patch,
});

const profile = (patch: Partial<RosterProfileInput> = {}): RosterProfileInput => ({
    profileId: "p1",
    userId: "u1",
    discordId: "111",
    displayName: "Wylan",
    avatar: "https://cdn.example/wylan.png",
    status: "ACTIVE",
    pseudoDofus: "Wylan",
    discordNickname: "Wylan",
    ankamaId: "Wylan#1234",
    joinedAt: "2026-01-01T00:00:00.000Z",
    seniorityDays: 100,
    trialValidated: true,
    trialEndsAt: null,
    trialRemainingDays: null,
    recruitedById: "p9",
    recruiterName: "Lyphi",
    recruiterAvatar: null,
    mules: [{ pseudo: "Wylanette" }],
    comments: [],
    ...patch,
});

const discordOnly = (patch: Partial<RosterDiscordOnlyInput> = {}): RosterDiscordOnlyInput => ({
    discordId: "222",
    displayName: "Zolt",
    username: "zolt",
    avatar: null,
    joinedAt: "2026-02-01T00:00:00.000Z",
    roles: ["role-membre"],
    ...patch,
});

const build = (patch: Partial<Parameters<typeof buildMemberRoster>[0]> = {}): RosterRow[] =>
    buildMemberRoster({
        profiles: [profile()],
        discordOnly: [discordOnly()],
        rolesByProfileId: { p1: ["role-membre", "role-chef"] },
        trialDurationDays: 15,
        now: new Date("2026-04-11T00:00:00.000Z"),
        ...patch,
    });

describe("buildMemberRoster — une seule liste pour les trois vues", () => {
    it("fusionne profils dashboard et membres hors dashboard", () => {
        const rows = build();
        expect(rows).toHaveLength(2);
        expect(rows.map((r) => r.key)).toEqual(["profile:p1", "discord:222"]);
    });

    it("porte profileId ET discordId dès B-1", () => {
        const [dashboardRow, onlyRow] = build();
        expect(dashboardRow.profileId).toBe("p1");
        expect(dashboardRow.discordId).toBe("111");
        expect(onlyRow.profileId).toBeNull();
        expect(onlyRow.discordId).toBe("222");
    });

    it("marque le hors dashboard : ni statut, ni essai, ni recruteur (tant que rien n'est saisi)", () => {
        const onlyRow = build().find((r) => !r.dashboard)!;
        expect(onlyRow.dashboard).toBe(false);
        expect(onlyRow.status).toBeNull();
        expect(onlyRow.trial).toBeNull();
        expect(onlyRow.recruiter).toBeNull();
        // L'ancienneté est calculable dès que l'arrivée Discord est connue.
        expect(onlyRow.seniorityDays).toBe(69);
    });

    it("remonte les données de registre saisies pour un membre hors dashboard (B-2)", () => {
        const rows = build({
            discordOnly: [
                discordOnly({
                    joinedAt: "2026-02-01T00:00:00.000Z",
                    entry: {
                        pseudoDofus: "Zolt",
                        ankamaId: "Zolt#0001",
                        guildJoinedAt: "2026-01-15T00:00:00.000Z",
                        trialValidated: true,
                        trialEndsAt: null,
                        mules: [{ pseudo: "Zoltette" }],
                        comments: [
                            {
                                id: "c1",
                                body: "Recrue motivée",
                                authorName: "Lyphi",
                                authorUserId: "u9",
                                createdAt: "2026-02-02T00:00:00.000Z",
                            },
                        ],
                    },
                    recruiterId: "p9",
                    recruiterName: "Lyphi",
                    recruiterAvatar: null,
                    seniorityDays: 86,
                }),
            ],
        });
        const onlyRow = rows.find((r) => !r.dashboard)!;
        expect(onlyRow.pseudoDofus).toBe("Zolt");
        expect(onlyRow.ankamaId).toBe("Zolt#0001");
        expect(onlyRow.joinedAt).toBe("2026-01-15T00:00:00.000Z");
        expect(onlyRow.seniorityDays).toBe(86);
        expect(onlyRow.trial?.validated).toBe(true);
        expect(onlyRow.recruiter).toEqual({ id: "p9", name: "Lyphi", avatar: null });
        expect(onlyRow.mules).toEqual([{ pseudo: "Zoltette" }]);
        expect(onlyRow.comments).toHaveLength(1);
    });

    it("ne duplique jamais un discordId déjà couvert par un profil", () => {
        const rows = build({ discordOnly: [discordOnly({ discordId: "111" })] });
        expect(rows).toHaveLength(1);
        expect(rows[0].key).toBe("profile:p1");
    });

    it("attache les rôles Discord au profil et calcule la décision d'essai", () => {
        const dashboardRow = build()[0];
        expect(dashboardRow.roles).toEqual(["role-membre", "role-chef"]);
        expect(dashboardRow.trial?.decision).toBe("oui");
        expect(dashboardRow.recruiter).toEqual({ id: "p9", name: "Lyphi", avatar: null });
    });
});

describe("matchesRosterFilters", () => {
    const rows = build();
    const dashboardRow = rows[0];
    const onlyRow = rows[1];

    it("recherche par pseudo, tag Ankama et ID Discord", () => {
        expect(matchesRosterFilters(dashboardRow, filters({ search: "wylan" }))).toBe(true);
        expect(matchesRosterFilters(dashboardRow, filters({ search: "Wylan#1234" }))).toBe(true);
        expect(matchesRosterFilters(onlyRow, filters({ search: "zolt" }))).toBe(true);
        expect(matchesRosterFilters(dashboardRow, filters({ search: "zolt" }))).toBe(false);
    });

    it("filtre par rôle Discord (les deux natures de lignes)", () => {
        expect(matchesRosterFilters(dashboardRow, filters({ roleId: "role-chef" }))).toBe(true);
        expect(matchesRosterFilters(onlyRow, filters({ roleId: "role-membre" }))).toBe(true);
        expect(matchesRosterFilters(onlyRow, filters({ roleId: "role-chef" }))).toBe(false);
    });

    it("inscription DASHBOARD exclut le hors dashboard, MISSING l'inverse", () => {
        expect(matchesRosterFilters(onlyRow, filters({ dashboard: "DASHBOARD" }))).toBe(false);
        expect(matchesRosterFilters(dashboardRow, filters({ dashboard: "DASHBOARD" }))).toBe(true);
        expect(matchesRosterFilters(dashboardRow, filters({ dashboard: "MISSING" }))).toBe(false);
        expect(matchesRosterFilters(onlyRow, filters({ dashboard: "MISSING" }))).toBe(true);
    });

    it("ALL garde tout le monde ; un statut précis n'atteint jamais une ligne sans statut", () => {
        expect(matchesRosterFilters(onlyRow, filters({ status: "ALL" }))).toBe(true);
        expect(matchesRosterFilters(onlyRow, filters({ status: "ACTIVE" }))).toBe(false);
        expect(matchesRosterFilters(dashboardRow, filters({ status: "ACTIVE" }))).toBe(true);
        expect(matchesRosterFilters(dashboardRow, filters({ status: "ARCHIVED" }))).toBe(false);
    });
});

describe("rosterCounts", () => {
    it("compte par statut et sépare dashboard / hors dashboard", () => {
        const rows = build({
            profiles: [
                profile({ profileId: "p1", discordId: "111", status: "ACTIVE" }),
                profile({ profileId: "p2", discordId: "333", status: "ARCHIVED" }),
                profile({ profileId: "p3", discordId: "444", status: "BANNED" }),
            ],
            discordOnly: [discordOnly({ discordId: "222" })],
        });
        expect(rosterCounts(rows)).toEqual({
            total: 4,
            active: 1,
            archived: 1,
            banned: 1,
            dashboard: 3,
            discordOnly: 1,
        });
    });
});

describe("sortRoster", () => {
    const rows = build({
        profiles: [
            profile({ profileId: "p1", discordId: "111", displayName: "Beta", joinedAt: "2026-01-01T00:00:00.000Z", seniorityDays: 10 }),
            profile({ profileId: "p2", discordId: "333", displayName: "Alpha", joinedAt: "2026-03-01T00:00:00.000Z", seniorityDays: 5 }),
        ],
        discordOnly: [discordOnly({ discordId: "222", displayName: "Zeta", joinedAt: null })],
    });

    it("trie par nom (fr)", () => {
        expect(sortRoster(rows, { key: "name", direction: "asc" }).map((r) => r.displayName)).toEqual([
            "Alpha",
            "Beta",
            "Zeta",
        ]);
    });

    it("trie par arrivée, valeurs absentes en dernier", () => {
        const desc = sortRoster(rows, { key: "joinedAt", direction: "desc" }).map((r) => r.displayName);
        expect(desc).toEqual(["Alpha", "Beta", "Zeta"]);
        const asc = sortRoster(rows, { key: "joinedAt", direction: "asc" }).map((r) => r.displayName);
        expect(asc).toEqual(["Beta", "Alpha", "Zeta"]);
    });

    it("trie par ancienneté, valeurs absentes en dernier", () => {
        expect(sortRoster(rows, { key: "seniority", direction: "desc" }).map((r) => r.displayName)).toEqual([
            "Beta",
            "Alpha",
            "Zeta",
        ]);
    });
});

describe("paginateRoster", () => {
    const rows = Array.from({ length: 25 }, (_, i) => `row-${i + 1}`);

    it("découpe en pages numérotées", () => {
        const page1 = paginateRoster(rows, 1, 10);
        expect(page1.items).toHaveLength(10);
        expect(page1.totalPages).toBe(3);
        expect(page1.hasPrev).toBe(false);
        expect(page1.hasNext).toBe(true);
    });

    it("borne une page hors plage sur la dernière", () => {
        const page = paginateRoster(rows, 99, 10);
        expect(page.page).toBe(3);
        expect(page.items).toEqual(["row-21", "row-22", "row-23", "row-24", "row-25"]);
        expect(page.hasNext).toBe(false);
    });

    it("reste sûr si la liste est vide", () => {
        const page = paginateRoster([], 1, 10);
        expect(page).toMatchObject({ total: 0, totalPages: 1, page: 1, hasPrev: false, hasNext: false });
    });
});

describe("queryRoster", () => {
    it("enchaîne filtres → tri → pagination", () => {
        const rows = build();
        const { filtered, page } = queryRoster(rows, filters({ status: "ACTIVE" }), DEFAULT_ROSTER_SORT, 1, 10);
        expect(filtered).toHaveLength(1);
        expect(page.items[0].profileId).toBe("p1");
    });
});

describe("rosterRoleOptions", () => {
    it("ne propose que les rôles portés par au moins un membre", () => {
        const rows = build();
        const options = rosterRoleOptions(
            [
                { id: "role-membre", name: "Membre", color: 0, position: 1 },
                { id: "role-chef", name: "Chef", color: 0, position: 2 },
                { id: "role-vide", name: "Vide", color: 0, position: 3 },
            ],
            rows
        );
        expect(options.map((o) => o.id)).toEqual(["role-chef", "role-membre"]);
    });
});
