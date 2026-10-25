/**
 * « En guilde en jeu » — règle pure de l'onglet Mules.
 *
 * Décision user du 25/10/2026 : compter les personnages réellement en guilde dans Dofus
 * à partir de deux déclarations — les **rôles Discord** cochés (une personne portant
 * plusieurs rôles cochés = **une seule** entrée) et les **mules taguées**.
 */

import { describe, it, expect } from "vitest";
import {
    IN_GAME_GUILD_MAX_ROLES,
    isInGameGuildRoleId,
    isMuleInGameGuild,
    mulePseudoKey,
    normalizeInGameGuildRoleIds,
    tallyInGameGuild,
    withMuleInGameGuild,
} from "@/lib/in-game-guild";
import type { RosterRow } from "@/lib/member-roster";

const ROLE_A = "111111111111111111";
const ROLE_B = "222222222222222222";
const ROLE_C = "333333333333333333";

function row(overrides: Partial<RosterRow>): RosterRow {
    return {
        key: "discord:1",
        profileId: "profile-1",
        discordId: "1",
        userId: "user-1",
        displayName: "Membre",
        username: null,
        avatar: null,
        status: "ACTIVE",
        dashboard: true,
        roles: [],
        joinedAt: null,
        seniorityDays: null,
        pseudoDofus: null,
        discordNickname: null,
        ankamaId: null,
        trial: null,
        recruiter: null,
        mules: [],
        comments: [],
        vacationStart: null,
        vacationEnd: null,
        ...overrides,
    };
}

describe("tallyInGameGuild — une personne, une entrée", () => {
    it("ne compte qu'UNE fois une personne portant plusieurs rôles cochés", () => {
        const rows = [row({ key: "discord:1", roles: [ROLE_A, ROLE_B] })];
        expect(tallyInGameGuild({ roleIds: [ROLE_A, ROLE_B], rows })).toEqual({
            members: 1,
            mules: 0,
            total: 1,
        });
    });

    it("compte les membres hors dashboard comme les autres", () => {
        const rows = [
            row({ key: "discord:1", profileId: null, dashboard: false, roles: [ROLE_A] }),
            row({ key: "discord:2", profileId: null, dashboard: false, roles: [] }),
        ];
        expect(tallyInGameGuild({ roleIds: [ROLE_A], rows }).members).toBe(1);
    });

    it("ajoute les mules taguées au total (membres + mules)", () => {
        const rows = [
            row({
                key: "discord:1",
                roles: [ROLE_A],
                mules: [
                    { pseudo: "Mule 1", inGameGuild: true },
                    { pseudo: "Mule 2" },
                ],
            }),
        ];
        expect(tallyInGameGuild({ roleIds: [ROLE_A], rows })).toEqual({
            members: 1,
            mules: 1,
            total: 2,
        });
    });

    it("sélection vide ⇒ aucun membre (jamais de repli permissif), mais les mules restent comptées", () => {
        const rows = [row({ key: "discord:1", roles: [ROLE_A], mules: [{ pseudo: "Mule", inGameGuild: true }] })];
        expect(tallyInGameGuild({ roleIds: [], rows })).toEqual({ members: 0, mules: 1, total: 1 });
    });

    it("un rôle non sélectionné ne compte personne", () => {
        const rows = [row({ key: "discord:1", roles: [ROLE_C] })];
        expect(tallyInGameGuild({ roleIds: [ROLE_A], rows }).members).toBe(0);
    });

    it("un compte de bot Discord n'est jamais compté, même avec le rôle (ni ses mules)", () => {
        const rows = [
            row({
                key: "discord:bot",
                profileId: null,
                dashboard: false,
                isBot: true,
                roles: [ROLE_A],
                mules: [{ pseudo: "Mule de bot", inGameGuild: true }],
            }),
            row({ key: "discord:1", roles: [ROLE_A] }),
        ];
        expect(tallyInGameGuild({ roleIds: [ROLE_A], rows })).toEqual({
            members: 1,
            mules: 0,
            total: 1,
        });
    });
});

describe("normalizeInGameGuildRoleIds — borné et filtré", () => {
    it("déduplique et écarte les identifiants invalides", () => {
        expect(normalizeInGameGuildRoleIds([ROLE_A, ROLE_A, "pas-un-id", 42, null])).toEqual([ROLE_A]);
    });

    it("écarte les rôles inconnus du serveur (`allowed`)", () => {
        expect(normalizeInGameGuildRoleIds([ROLE_A, ROLE_B], new Set([ROLE_A]))).toEqual([ROLE_A]);
    });

    it("borne la sélection", () => {
        const many = Array.from({ length: IN_GAME_GUILD_MAX_ROLES + 5 }, (_, index) =>
            (100000000000000000n + BigInt(index)).toString()
        );
        expect(normalizeInGameGuildRoleIds(many)).toHaveLength(IN_GAME_GUILD_MAX_ROLES);
    });

    it("refuse ce qui n'est pas un snowflake", () => {
        expect(isInGameGuildRoleId("123")).toBe(false);
        expect(isInGameGuildRoleId(ROLE_A)).toBe(true);
    });
});

describe("withMuleInGameGuild — tag d'une mule, rien d'autre", () => {
    const mules = [
        { pseudo: "Pori-Wairyth", classe: "iop", level: 129 },
        { pseudo: "Haito-Nazone", classe: "cra", level: 186 },
    ];

    it("pose le tag sur le bon pseudo, sans toucher aux autres mules", () => {
        const next = withMuleInGameGuild(mules, "Pori-Wairyth", true);
        expect(next[0]).toEqual({ pseudo: "Pori-Wairyth", classe: "iop", level: 129, inGameGuild: true });
        expect(next[1]).toEqual(mules[1]);
    });

    it("compare sans tenir compte de la casse ni des accents", () => {
        expect(withMuleInGameGuild(mules, "pori-wairyth", true)[0].inGameGuild).toBe(true);
        expect(mulePseudoKey("Éliotrope")).toBe("eliotrope");
    });

    it("retirer le tag supprime la clé (pas de `false` qui traîne)", () => {
        const tagged = withMuleInGameGuild(mules, "Haito-Nazone", true);
        const untagged = withMuleInGameGuild(tagged, "Haito-Nazone", false);
        expect("inGameGuild" in untagged[1]).toBe(false);
        expect(isMuleInGameGuild(untagged[1])).toBe(false);
    });
});
