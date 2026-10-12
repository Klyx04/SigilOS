/**
 * Registre recrutement — **filtres** (règles pures) : rôle Discord ciblé, inscription au dashboard
 * et lignes « hors dashboard ».
 *
 * 🐛 Constat user du 27/09/2026 : « je comprends pas pk les non présents dashboard y sont pas » +
 * « j'aimerais cibler un des rôles au choix sur cette page ». Mesure : le registre est bâti sur
 * `userProfile` (profils dashboard) ⇒ un membre Discord **sans profil** n'existait pas dans la
 * liste, et la base ne cache qu'UN rôle par profil (`UserProfile.discordRoleName`) ⇒ impossible de
 * cibler les autres. Les règles ci-dessous portent les deux comportements, testées sans UI.
 *
 * Invariant central : une ligne « hors dashboard » ne porte **ni essai ni recruteur** ⇒ les filtres
 * correspondants l'excluent (jamais de correspondance par accident).
 */
import { describe, expect, it } from "vitest";

import {
    DEFAULT_REGISTRY_FILTERS,
    discordRoleColorHex,
    matchesDiscordOnlyFilters,
    matchesDiscordRole,
    matchesRegistryFilters,
    matchesRegistrySearch,
    registryRoleOptions,
    topDiscordRole,
    type RegistryFilters,
} from "@/lib/member-registry";

const filters = (patch: Partial<RegistryFilters> = {}): RegistryFilters => ({
    ...DEFAULT_REGISTRY_FILTERS,
    ...patch,
});

const DASHBOARD_ROW = {
    displayName: "Wylan",
    discordId: "111",
    pseudoDofus: "Wylan",
    discordNickname: "Wylan",
    ankamaId: "Wylan#1234",
};

const DISCORD_ONLY_ROW = {
    displayName: "Zoltan",
    discordId: "222",
    username: "zoltan",
    roles: ["role-membre"],
};

describe("registre — recherche libre", () => {
    it("ne filtre rien quand la recherche est vide", () => {
        expect(matchesRegistrySearch(DASHBOARD_ROW, "")).toBe(true);
        expect(matchesRegistrySearch(DASHBOARD_ROW, "   ")).toBe(true);
    });

    it("cherche dans le pseudo dashboard, le pseudo Dofus, le pseudo Discord, le tag Ankama et l'ID", () => {
        expect(matchesRegistrySearch(DASHBOARD_ROW, "wyLaN")).toBe(true);
        expect(matchesRegistrySearch(DASHBOARD_ROW, "wylan#1234")).toBe(true);
        expect(matchesRegistrySearch(DASHBOARD_ROW, "111")).toBe(true);
        expect(matchesRegistrySearch(DASHBOARD_ROW, "zoltan")).toBe(false);
    });

    it("tolère les champs absents (une ligne hors dashboard n'a pas de tag Ankama)", () => {
        expect(matchesRegistrySearch({ displayName: "Zoltan", discordId: "222" }, "zoltan")).toBe(true);
        expect(matchesRegistrySearch({ displayName: "Zoltan", discordId: "222" }, "ankama")).toBe(false);
    });
});

describe("registre — rôle Discord", () => {
    it("`ALL` (ou vide) ne filtre rien", () => {
        expect(matchesDiscordRole(["r1"], "ALL")).toBe(true);
        expect(matchesDiscordRole([], "ALL")).toBe(true);
        expect(matchesDiscordRole(null, "ALL")).toBe(true);
        expect(matchesDiscordRole(undefined, "")).toBe(true);
    });

    it("filtre sur l'appartenance réelle au rôle", () => {
        expect(matchesDiscordRole(["r1", "r2"], "r2")).toBe(true);
        expect(matchesDiscordRole(["r1"], "r2")).toBe(false);
        expect(matchesDiscordRole(null, "r2")).toBe(false);
        expect(matchesDiscordRole(undefined, "r2")).toBe(false);
    });
});


describe("registre — filtres d'une ligne « profil dashboard »", () => {
    const row = { row: DASHBOARD_ROW, trial: "non" as const, recruitedById: "profile-lypi", roles: ["r1"] };

    it("passe quand aucun filtre n'est posé", () => {
        expect(matchesRegistryFilters(row, filters())).toBe(true);
    });

    it("une ligne dashboard n'est JAMAIS une ligne « hors dashboard »", () => {
        expect(matchesRegistryFilters(row, filters({ dashboard: "MISSING" }))).toBe(false);
        expect(matchesRegistryFilters(row, filters({ dashboard: "DASHBOARD" }))).toBe(true);
    });

    it("applique essai, recruteur et rôle", () => {
        expect(matchesRegistryFilters(row, filters({ trial: "non" }))).toBe(true);
        expect(matchesRegistryFilters(row, filters({ trial: "oui" }))).toBe(false);
        expect(matchesRegistryFilters(row, filters({ recruiterId: "profile-lypi" }))).toBe(true);
        expect(matchesRegistryFilters(row, filters({ recruiterId: "profile-autre" }))).toBe(false);
        expect(matchesRegistryFilters(row, filters({ roleId: "r1" }))).toBe(true);
        expect(matchesRegistryFilters(row, filters({ roleId: "r9" }))).toBe(false);
    });
});

describe("registre — filtres d'une ligne « hors dashboard »", () => {
    it("apparaît par défaut et sur le filtre `MISSING`, jamais sur `DASHBOARD`", () => {
        expect(matchesDiscordOnlyFilters(DISCORD_ONLY_ROW, filters())).toBe(true);
        expect(matchesDiscordOnlyFilters(DISCORD_ONLY_ROW, filters({ dashboard: "MISSING" }))).toBe(true);
        expect(matchesDiscordOnlyFilters(DISCORD_ONLY_ROW, filters({ dashboard: "DASHBOARD" }))).toBe(false);
    });

    it("est exclue dès qu'un filtre « essai » ou « recruteur » est posé (données inexistantes)", () => {
        expect(matchesDiscordOnlyFilters(DISCORD_ONLY_ROW, filters({ trial: "non" }))).toBe(false);
        expect(matchesDiscordOnlyFilters(DISCORD_ONLY_ROW, filters({ recruiterId: "profile-lypi" }))).toBe(false);
    });

    it("reste filtrable par recherche et par rôle Discord", () => {
        expect(matchesDiscordOnlyFilters(DISCORD_ONLY_ROW, filters({ search: "zolt" }))).toBe(true);
        expect(matchesDiscordOnlyFilters(DISCORD_ONLY_ROW, filters({ search: "wylan" }))).toBe(false);
        expect(matchesDiscordOnlyFilters(DISCORD_ONLY_ROW, filters({ roleId: "role-membre" }))).toBe(true);
        expect(matchesDiscordOnlyFilters(DISCORD_ONLY_ROW, filters({ roleId: "role-chef" }))).toBe(false);
    });
});

describe("registre — options du filtre « rôle Discord »", () => {
    const ROLES = [
        { id: "chef", name: "Chef de guilde", color: 0x9b59b6, position: 10 },
        { id: "membre", name: "Membre", color: 0, position: 5 },
        { id: "vide", name: "Rôle que personne ne porte", color: 0xffffff, position: 50 },
        { id: "chef2", name: "Chef bis", color: -1, position: 10 },
    ];

    it("ne garde que les rôles réellement portés, du plus haut au plus bas", () => {
        const options = registryRoleOptions(ROLES, [
            { roles: ["chef", "membre"] },
            { roles: ["membre"] },
            { roles: ["chef2"] },
        ]);
        expect(options.map((o) => o.id)).toEqual(["chef2", "chef", "membre"]);
    });

    it("compte les membres par rôle (un membre compté une fois par rôle, doublons ignorés)", () => {
        const options = registryRoleOptions(ROLES, [
            { roles: ["membre", "membre"] },
            { roles: ["membre"] },
            { roles: [] },
            { roles: null },
        ]);
        expect(options.find((o) => o.id === "membre")?.count).toBe(2);
        expect(options.some((o) => o.id === "vide")).toBe(false);
    });

    it("trie par nom à position égale et normalise les couleurs invalides", () => {
        const options = registryRoleOptions(ROLES, [{ roles: ["chef", "chef2"] }]);
        expect(options.map((o) => o.name)).toEqual(["Chef bis", "Chef de guilde"]);
        expect(options.find((o) => o.id === "chef2")?.color).toBe(0);
        expect(options.find((o) => o.id === "chef")?.color).toBe(0x9b59b6);
    });

    it("tolère l'absence d'entrée (Discord injoignable)", () => {
        expect(registryRoleOptions(null, null)).toEqual([]);
        expect(registryRoleOptions(undefined, [])).toEqual([]);
    });
});

describe("registre — affichage du rôle principal", () => {
    const options = registryRoleOptions(
        [
            { id: "chef", name: "Chef", color: 0, position: 10 },
            { id: "membre", name: "Membre", color: 0xff0000, position: 5 },
        ],
        [{ roles: ["chef", "membre"] }]
    );

    it("rend le rôle le plus haut de la hiérarchie portée par le membre", () => {
        expect(topDiscordRole(["membre", "chef"], options)?.id).toBe("chef");
        expect(topDiscordRole(["membre"], options)?.id).toBe("membre");
    });

    it("rend `null` si le membre ne porte aucun rôle connu (jamais de rôle inventé)", () => {
        expect(topDiscordRole(["inconnu"], options)).toBeNull();
        expect(topDiscordRole([], options)).toBeNull();
        expect(topDiscordRole(null, options)).toBeNull();
        expect(topDiscordRole(undefined, [])).toBeNull();
    });

    it("convertit la couleur Discord en `#rrggbb`, `null` si le rôle n'a pas de couleur", () => {
        expect(discordRoleColorHex(0x5865f2)).toBe("#5865f2");
        expect(discordRoleColorHex(0)).toBeNull();
        expect(discordRoleColorHex(-1)).toBeNull();
        expect(discordRoleColorHex(0x1000000)).toBeNull();
        expect(discordRoleColorHex(null)).toBeNull();
        expect(discordRoleColorHex(undefined)).toBeNull();
    });
});
