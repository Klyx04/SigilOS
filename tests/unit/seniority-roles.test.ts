/**
 * Rôles automatiques par ancienneté (chantier Y-1) — règles pures :
 * normalisation bornée des paliers, palier cible, diff à appliquer (ajout / retrait /
 * aucun changement), périmètre fermé, annonce personnalisable (variables en allowlist).
 */

import { describe, expect, it } from "vitest";
import {
    DEFAULT_SENIORITY_ANNOUNCEMENT,
    DEFAULT_SENIORITY_ROLES_CONFIG,
    SENIORITY_ANNOUNCEMENT_DESCRIPTION_MAX_LENGTH,
    SENIORITY_ANNOUNCEMENT_MESSAGE_MAX_LENGTH,
    SENIORITY_ANNOUNCEMENT_TITLE_MAX_LENGTH,
    SENIORITY_ROLES_MAX_DAYS,
    SENIORITY_ROLES_MAX_ROLES_PER_TIER,
    SENIORITY_ROLES_MAX_TIERS,
    buildSeniorityAnnouncementValues,
    computeSeniorityRoleDiff,
    isMemberEligibleForSeniority,
    mergeSeniorityAnnouncement,
    mergeSeniorityRolesConfig,
    normalizeSeniorityRoleIds,
    normalizeSeniorityTiers,
    renderSeniorityAnnouncement,
    renderSeniorityAnnouncementText,
    resolveSeniorityManagedRoleIds,
    resolveSeniorityRoleTier,
    resolveSeniorityTargetRoleIds,
    type GuildSeniorityRolesConfig,
} from "@/lib/seniority-roles";

/** Identifiant synthétique : 18 chiffres (snowflake plausible), unique par index. */
const snowflake = (index: number) => (100000000000000000n + BigInt(index)).toString();

const ROLE_A = snowflake(1);
const ROLE_B = snowflake(2);
const ROLE_C = snowflake(3);
const CHANNEL = snowflake(9);
/** Rôle jamais déclaré dans un palier : il doit rester hors périmètre. */
const ROLE_FREE = snowflake(4);

const config = (overrides: Partial<GuildSeniorityRolesConfig> = {}): GuildSeniorityRolesConfig => ({
    enabled: true,
    channelId: CHANNEL,
    tiers: [
        { days: 30, roleIds: [ROLE_A] },
        { days: 180, roleIds: [ROLE_B] },
        { days: 365, roleIds: [ROLE_C] },
    ],
    announcement: DEFAULT_SENIORITY_ANNOUNCEMENT,
    allowedRoleIds: [],
    excludedRoleIds: [],
    ...overrides,
});

const values = () => ({
    membre: "<@403000342167420929>",
    pseudo: "Klyx",
    anciennete: "6 mois",
    roles: `<@&${ROLE_A}>`,
    guilde: "Sigil",
});

describe("paliers — normalisation bornée (le JSON de la base n'est jamais cru)", () => {
    it("rend un tableau vide pour toute valeur non conforme", () => {
        expect(normalizeSeniorityTiers(undefined)).toEqual([]);
        expect(normalizeSeniorityTiers(null)).toEqual([]);
        expect(normalizeSeniorityTiers("30 jours")).toEqual([]);
        expect(normalizeSeniorityTiers({ days: 30 })).toEqual([]);
        expect(normalizeSeniorityTiers([{}])).toEqual([]);
        expect(normalizeSeniorityTiers([{ days: 30, roleIds: [] }])).toEqual([]);
    });

    it("écarte les seuils hors bornes, non entiers ou mal typés", () => {
        const tiers = normalizeSeniorityTiers([
            { days: 0, roleIds: [ROLE_A] },
            { days: -5, roleIds: [ROLE_A] },
            { days: 10.5, roleIds: [ROLE_A] },
            { days: "30", roleIds: [ROLE_A] },
            { days: SENIORITY_ROLES_MAX_DAYS + 1, roleIds: [ROLE_A] },
            { days: 180, roleIds: [ROLE_B] },
        ]);
        expect(tiers).toEqual([{ days: 180, roleIds: [ROLE_B] }]);
    });

    it("ne garde que de vrais identifiants Discord, sans doublon de rôle", () => {
        const tiers = normalizeSeniorityTiers([
            { days: 30, roleIds: ["@everyone", "Membres", ROLE_A, ROLE_A] },
            { days: 90, roleIds: [ROLE_A, ROLE_B] },
        ]);
        expect(tiers).toEqual([
            { days: 30, roleIds: [ROLE_A] },
            { days: 90, roleIds: [ROLE_B] },
        ]);
    });

    it("trie par seuil croissant et plafonne les rôles d'un palier", () => {
        const manyRoles = Array.from({ length: SENIORITY_ROLES_MAX_ROLES_PER_TIER + 5 }, (_, index) =>
            snowflake(300 + index),
        );
        const tiers = normalizeSeniorityTiers([
            { days: 90, roleIds: manyRoles },
            { days: 30, roleIds: [ROLE_A] },
        ]);
        expect(tiers[0]).toEqual({ days: 30, roleIds: [ROLE_A] });
        expect(tiers[1].days).toBe(90);
        expect(tiers[1].roleIds).toHaveLength(SENIORITY_ROLES_MAX_ROLES_PER_TIER);
    });

    it("plafonne le nombre de paliers", () => {
        const tooManyTiers = Array.from({ length: SENIORITY_ROLES_MAX_TIERS + 5 }, (_, index) => ({
            days: index + 1,
            roleIds: [snowflake(500 + index)],
        }));
        expect(normalizeSeniorityTiers(tooManyTiers)).toHaveLength(SENIORITY_ROLES_MAX_TIERS);
    });
});

describe("palier cible et périmètre", () => {
    const tiers = [
        { days: 30, roleIds: [ROLE_A] },
        { days: 180, roleIds: [ROLE_B] },
        { days: 365, roleIds: [ROLE_C] },
    ];

    it("n'a aucun palier sous le premier seuil, et prend le seuil exact", () => {
        expect(resolveSeniorityRoleTier(tiers, 29)).toBe(-1);
        expect(resolveSeniorityRoleTier(tiers, 30)).toBe(0);
        expect(resolveSeniorityRoleTier(tiers, 179)).toBe(0);
        expect(resolveSeniorityRoleTier(tiers, 730)).toBe(2);
        expect(resolveSeniorityRoleTier(tiers, Number.NaN)).toBe(-1);
    });

    it("compare les seuils sans supposer l'ordre reçu", () => {
        const shuffled = [tiers[2], tiers[0], tiers[1]];
        const index = resolveSeniorityRoleTier(shuffled, 200);
        expect(shuffled[index].days).toBe(180);
        expect(resolveSeniorityTargetRoleIds(shuffled, index)).toEqual([ROLE_A, ROLE_B]);
    });

    it("cumule les rôles de tous les paliers atteints", () => {
        expect(resolveSeniorityTargetRoleIds(tiers, 0)).toEqual([ROLE_A]);
        expect(resolveSeniorityTargetRoleIds(tiers, 1)).toEqual([ROLE_A, ROLE_B]);
        expect(resolveSeniorityTargetRoleIds(tiers, 2)).toEqual([ROLE_A, ROLE_B, ROLE_C]);
        expect(resolveSeniorityTargetRoleIds(tiers, -1)).toEqual([]);
    });

    it("le périmètre fermé est l'union des rôles déclarés", () => {
        expect(resolveSeniorityManagedRoleIds(tiers)).toEqual([ROLE_A, ROLE_B, ROLE_C]);
        expect(resolveSeniorityManagedRoleIds([])).toEqual([]);
    });
});

describe("diff à appliquer", () => {
    it("pose les rôles dus sans toucher au reste", () => {
        const diff = computeSeniorityRoleDiff({
            config: config(),
            seniorityDays: 200,
            currentRoleIds: [ROLE_FREE],
        });
        expect(diff.targetTierIndex).toBe(1);
        expect(diff.targetRoleIds).toEqual([ROLE_A, ROLE_B]);
        expect(diff.toAdd).toEqual([ROLE_A, ROLE_B]);
        expect(diff.toRemove).toEqual([]);
        expect(diff.changed).toBe(true);
    });

    it("ne propose rien quand le membre a déjà exactement ce qu'il doit", () => {
        const diff = computeSeniorityRoleDiff({
            config: config(),
            seniorityDays: 200,
            currentRoleIds: [ROLE_FREE, ROLE_B, ROLE_A],
        });
        expect(diff.toAdd).toEqual([]);
        expect(diff.toRemove).toEqual([]);
        expect(diff.changed).toBe(false);
    });

    it("retire les rôles d'un palier qu'il n'a plus (retour en arrière)", () => {
        const diff = computeSeniorityRoleDiff({
            config: config(),
            seniorityDays: 40,
            currentRoleIds: [ROLE_A, ROLE_B, ROLE_C],
        });
        expect(diff.targetTierIndex).toBe(0);
        expect(diff.toAdd).toEqual([]);
        expect(diff.toRemove).toEqual([ROLE_B, ROLE_C]);
        expect(diff.changed).toBe(true);
    });

    it("ne retire JAMAIS un rôle que la guilde n'a pas déclaré (périmètre fermé)", () => {
        const diff = computeSeniorityRoleDiff({
            config: config(),
            seniorityDays: 400,
            currentRoleIds: [ROLE_FREE, ROLE_C],
        });
        expect(diff.toAdd).toEqual([ROLE_A, ROLE_B]);
        expect(diff.toRemove).toEqual([]);
    });

    it("module éteint ou aucun palier configuré : diff vide (fail-closed)", () => {
        const off = computeSeniorityRoleDiff({
            config: config({ enabled: false }),
            seniorityDays: 400,
            currentRoleIds: [ROLE_B],
        });
        expect(off).toMatchObject({ targetTierIndex: -1, toAdd: [], toRemove: [], changed: false });

        const noTiers = computeSeniorityRoleDiff({
            config: config({ tiers: [] }),
            seniorityDays: 400,
            currentRoleIds: [ROLE_B],
        });
        expect(noTiers).toMatchObject({ targetTierIndex: -1, toAdd: [], toRemove: [], changed: false });
    });

    it("aucun palier atteint : diff vide, on ne déshabille pas un arrivant", () => {
        const diff = computeSeniorityRoleDiff({
            config: config(),
            seniorityDays: 3,
            currentRoleIds: [ROLE_A, ROLE_B],
        });
        expect(diff).toMatchObject({ targetTierIndex: -1, toAdd: [], toRemove: [], changed: false });
    });

    it("ignore les rôles courants qui ne sont pas des identifiants Discord", () => {
        const diff = computeSeniorityRoleDiff({
            config: config(),
            seniorityDays: 200,
            currentRoleIds: ["@everyone", "Membres", ROLE_A],
        });
        expect(diff.toAdd).toEqual([ROLE_B]);
        expect(diff.toRemove).toEqual([]);
    });

    it("borne une ancienneté absurde (négative, NaN) à zéro", () => {
        expect(
            computeSeniorityRoleDiff({ config: config(), seniorityDays: -10, currentRoleIds: [] }).seniorityDays,
        ).toBe(0);
        expect(
            computeSeniorityRoleDiff({ config: config(), seniorityDays: Number.NaN, currentRoleIds: [] }).seniorityDays,
        ).toBe(0);
    });
});

describe("relecture des réglages de guilde", () => {
    it("retombe sur les défauts sans ligne en base", () => {
        expect(mergeSeniorityRolesConfig(null)).toEqual(DEFAULT_SENIORITY_ROLES_CONFIG);
        expect(mergeSeniorityRolesConfig(undefined)).toEqual(DEFAULT_SENIORITY_ROLES_CONFIG);
        expect(mergeSeniorityRolesConfig({})).toEqual(DEFAULT_SENIORITY_ROLES_CONFIG);
    });

    it("n'active que sur un vrai booléen true", () => {
        expect(mergeSeniorityRolesConfig({ seniorityRolesEnabled: true }).enabled).toBe(true);
        expect(mergeSeniorityRolesConfig({ seniorityRolesEnabled: "true" }).enabled).toBe(false);
        expect(mergeSeniorityRolesConfig({ seniorityRolesEnabled: 1 }).enabled).toBe(false);
    });

    it("n'accepte qu'un snowflake comme salon", () => {
        expect(mergeSeniorityRolesConfig({ seniorityRolesChannelId: CHANNEL }).channelId).toBe(CHANNEL);
        expect(mergeSeniorityRolesConfig({ seniorityRolesChannelId: "#annonces" }).channelId).toBeNull();
        expect(mergeSeniorityRolesConfig({ seniorityRolesChannelId: 42 }).channelId).toBeNull();
    });

    it("relit des paliers corrompus sans jamais lever d'erreur", () => {
        expect(mergeSeniorityRolesConfig({ seniorityRolesTiers: { days: 30 } }).tiers).toEqual([]);
        expect(mergeSeniorityRolesConfig({ seniorityRolesTiers: [null, 12] }).tiers).toEqual([]);
    });
});

describe("annonce personnalisable (aperçu et envoi réel : le même texte)", () => {
    it("remplace les variables connues et laisse les inconnues visibles", () => {
        const text = renderSeniorityAnnouncementText("Bravo {pseudo} ({inconnu}) — {guilde}", values());
        expect(text).toBe("Bravo Klyx ({inconnu}) — Sigil");
    });

    it("n'interprète pas les caractères spéciaux d'une valeur injectée", () => {
        const text = renderSeniorityAnnouncementText("{pseudo}", { ...values(), pseudo: "$& $1 <>&" });
        expect(text).toBe("$& $1 <>&");
    });

    it("construit des valeurs prêtes pour Discord (mention, rôles, ancienneté lisible)", () => {
        const built = buildSeniorityAnnouncementValues({
            member: { discordId: "403000342167420929", displayName: "Klyx" },
            guildName: "Sigil",
            seniorityDays: 200,
            awardedRoleIds: [ROLE_A, "@everyone", ROLE_B],
        });
        expect(built.membre).toBe("<@403000342167420929>");
        expect(built.pseudo).toBe("Klyx");
        expect(built.guilde).toBe("Sigil");
        expect(built.roles).toBe(`<@&${ROLE_A}>, <@&${ROLE_B}>`);
        expect(built.anciennete).toBe("6 mois, 20 jours");
    });

    it("borne les trois textes aux limites Discord", () => {
        const rendered = renderSeniorityAnnouncement({
            announcement: {
                ...DEFAULT_SENIORITY_ANNOUNCEMENT,
                messageTemplate: "m".repeat(5000),
                embedTitle: "t".repeat(500),
                embedDescription: "d".repeat(9000),
            },
            values: values(),
        });
        expect(rendered.content).toHaveLength(SENIORITY_ANNOUNCEMENT_MESSAGE_MAX_LENGTH);
        expect(rendered.embedTitle).toHaveLength(SENIORITY_ANNOUNCEMENT_TITLE_MAX_LENGTH);
        expect(rendered.embedDescription).toHaveLength(SENIORITY_ANNOUNCEMENT_DESCRIPTION_MAX_LENGTH);
        expect(rendered.color).toBe(DEFAULT_SENIORITY_ANNOUNCEMENT.color);
        expect(rendered.thumbnail).toBe(DEFAULT_SENIORITY_ANNOUNCEMENT.thumbnail);
    });

    it("relit une annonce partielle : tout ce qui est douteux retombe sur le défaut", () => {
        const merged = mergeSeniorityAnnouncement({ messageTemplate: "   ", color: 0x1234567, thumbnail: "rando" });
        expect(merged.messageTemplate).toBe(DEFAULT_SENIORITY_ANNOUNCEMENT.messageTemplate);
        expect(merged.color).toBe(DEFAULT_SENIORITY_ANNOUNCEMENT.color);
        expect(merged.thumbnail).toBe(DEFAULT_SENIORITY_ANNOUNCEMENT.thumbnail);

        expect(mergeSeniorityAnnouncement({ color: 0x00ff00, thumbnail: "guild" })).toMatchObject({
            color: 0x00ff00,
            thumbnail: "guild",
        });
    });
});

describe("filtres d'éligibilité — rôles autorisés (whitelist) et exclus (blacklist)", () => {
    const ROLE_MEMBER = snowflake(10);
    const ROLE_BOT = snowflake(11);
    const ROLE_GUEST = snowflake(12);

    it("normalise une liste de rôles (snowflakes valides, sans doublons, bornée)", () => {
        expect(normalizeSeniorityRoleIds(null)).toEqual([]);
        expect(normalizeSeniorityRoleIds(undefined)).toEqual([]);
        expect(normalizeSeniorityRoleIds("pas-un-tableau")).toEqual([]);
        expect(normalizeSeniorityRoleIds(["invalide", ROLE_A, ROLE_A, "@everyone"])).toEqual([ROLE_A]);
    });

    it("isMemberEligibleForSeniority : éligible par défaut si aucun filtre", () => {
        expect(isMemberEligibleForSeniority({ memberRoleIds: [ROLE_FREE] })).toBe(true);
        expect(isMemberEligibleForSeniority({ memberRoleIds: [], allowedRoleIds: [], excludedRoleIds: [] })).toBe(true);
    });

    it("isMemberEligibleForSeniority : la blacklist écarte toujours le membre", () => {
        expect(
            isMemberEligibleForSeniority({
                memberRoleIds: [ROLE_MEMBER, ROLE_BOT],
                allowedRoleIds: [ROLE_MEMBER],
                excludedRoleIds: [ROLE_BOT],
            })
        ).toBe(false);
    });

    it("isMemberEligibleForSeniority : la whitelist exige au moins un rôle autorisé", () => {
        expect(
            isMemberEligibleForSeniority({
                memberRoleIds: [ROLE_FREE],
                allowedRoleIds: [ROLE_MEMBER],
            })
        ).toBe(false);

        expect(
            isMemberEligibleForSeniority({
                memberRoleIds: [ROLE_FREE, ROLE_MEMBER],
                allowedRoleIds: [ROLE_MEMBER],
            })
        ).toBe(true);
    });

    it("computeSeniorityRoleDiff : un membre exclu ne reçoit aucun rôle et perd les rôles gérés qu'il portait", () => {
        const diff = computeSeniorityRoleDiff({
            config: config({ excludedRoleIds: [ROLE_GUEST] }),
            seniorityDays: 200,
            currentRoleIds: [ROLE_GUEST, ROLE_A, ROLE_FREE],
        });
        expect(diff.targetTierIndex).toBe(-1);
        expect(diff.toAdd).toEqual([]);
        expect(diff.toRemove).toEqual([ROLE_A]);
        expect(diff.changed).toBe(true);
    });

    it("computeSeniorityRoleDiff : un membre hors whitelist ne reçoit rien", () => {
        const diff = computeSeniorityRoleDiff({
            config: config({ allowedRoleIds: [ROLE_MEMBER] }),
            seniorityDays: 200,
            currentRoleIds: [ROLE_FREE],
        });
        expect(diff.targetTierIndex).toBe(-1);
        expect(diff.toAdd).toEqual([]);
        expect(diff.toRemove).toEqual([]);
        expect(diff.changed).toBe(false);
    });

    it("computeSeniorityRoleDiff : un membre conforme à la whitelist reçoit ses rôles normalement", () => {
        const diff = computeSeniorityRoleDiff({
            config: config({ allowedRoleIds: [ROLE_MEMBER] }),
            seniorityDays: 200,
            currentRoleIds: [ROLE_MEMBER],
        });
        expect(diff.targetTierIndex).toBe(1);
        expect(diff.toAdd).toEqual([ROLE_A, ROLE_B]);
        expect(diff.changed).toBe(true);
    });

    it("mergeSeniorityRolesConfig relit allowedRoleIds et excludedRoleIds depuis seniorityRolesAnnouncement", () => {
        const merged = mergeSeniorityRolesConfig({
            seniorityRolesEnabled: true,
            seniorityRolesChannelId: CHANNEL,
            seniorityRolesTiers: [{ days: 30, roleIds: [ROLE_A] }],
            seniorityRolesAnnouncement: {
                messageTemplate: "Bravo !",
                allowedRoleIds: [ROLE_MEMBER],
                excludedRoleIds: [ROLE_BOT],
            },
        });
        expect(merged.allowedRoleIds).toEqual([ROLE_MEMBER]);
        expect(merged.excludedRoleIds).toEqual([ROLE_BOT]);
    });
});
