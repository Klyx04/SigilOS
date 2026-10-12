/**
 * Régression (#184) — intégrité du cache mémoire `config:{guildId}`.
 *
 * `getUserContext` (dashboard) et `internalCheckPermission` (bot `/dj`,
 * `/songes`, `/missions`) partagent ce cache. Écrire dedans avec un `select`
 * partiel — c'était le cas de `internalCheckPermission`
 * (`{ id, discordGuildId, rolesMapping, usersMapping }`) — servait au dashboard
 * une config sans `name`, `dofusServerId` ni `modules` :
 *   - « Le tableau de bord de **Serveur Inconnu** » (`name` absent) ;
 *   - « Configuration en cours » (`isOnboardingComplete: false`) ;
 *   - navbar grisée (tous les modules à false).
 *
 * `isCompleteCachedGuildConfig` est le garde-fou : une entrée incomplète est
 * rejetée (relue en BDD) au lieu d'être servie.
 */

import { describe, it, expect } from "vitest";
import {
    CACHED_GUILD_CONFIG_KEYS,
    isCompleteCachedGuildConfig,
} from "@/lib/guild-config-cache";

/** Config complète telle que produite par `getCachedGuildConfig`. */
function fullConfig() {
    const config: Record<string, unknown> = {};
    for (const key of CACHED_GUILD_CONFIG_KEYS) config[key] = null;
    return {
        ...config,
        id: "guild-uuid-1",
        discordGuildId: "111111111111111111",
        name: "Guilde Test",
        dofusServerId: "1",
        isActive: true,
        deletedAt: null,
        rolesMapping: { "role-membre": ["dashboard:login"] },
        usersMapping: {},
        newsBroadcastEnabled: false,
        missionVitrineMode: false,
        modules: { missions: true },
    };
}

describe("isCompleteCachedGuildConfig — garde-fou du cache config guilde", () => {
    it("accepte une config complète (select complet)", () => {
        expect(isCompleteCachedGuildConfig(fullConfig())).toBe(true);
    });

    it("refuse le select tronqué d'internalCheckPermission (cause du bug #184)", () => {
        // Ex-select de `internalCheckPermission` : ni name, ni dofusServerId, ni modules.
        const truncated = {
            id: "guild-uuid-1",
            discordGuildId: "111111111111111111",
            rolesMapping: { "role-membre": ["dashboard:login"] },
            usersMapping: {},
        };

        expect(isCompleteCachedGuildConfig(truncated)).toBe(false);
    });

    it("refuse une config sans `name` (afficherait « Serveur Inconnu »)", () => {
        const { name, ...withoutName } = fullConfig();
        expect(name).toBeTruthy();
        expect(isCompleteCachedGuildConfig(withoutName)).toBe(false);
    });

    it("refuse une config sans `dofusServerId` (ferait afficher « Configuration en cours »)", () => {
        const { dofusServerId, ...withoutServer } = fullConfig();
        expect(dofusServerId).toBeTruthy();
        expect(isCompleteCachedGuildConfig(withoutServer)).toBe(false);
    });

    it("refuse une config sans `modules` (grillerait toute la navbar)", () => {
        const { modules, ...withoutModules } = fullConfig();
        expect(modules).toBeDefined();
        expect(isCompleteCachedGuildConfig(withoutModules)).toBe(false);
    });

    it("fail-closed sur null / undefined / primitives", () => {
        expect(isCompleteCachedGuildConfig(null)).toBe(false);
        expect(isCompleteCachedGuildConfig(undefined)).toBe(false);
        expect(isCompleteCachedGuildConfig("config")).toBe(false);
        expect(isCompleteCachedGuildConfig(42)).toBe(false);
        expect(isCompleteCachedGuildConfig({})).toBe(false);
    });

    it("accepte les valeurs null (guildes fraîches : @everyone seul)", () => {
        // Un `deletedAt: null` / `modules: null` légitime reste une clé PRÉSENTE :
        // c'est la présence du champ (forme du select) qui compte, pas sa valeur.
        const fresh = { ...fullConfig(), rolesMapping: {}, dofusServerId: null, modules: null };
        expect(isCompleteCachedGuildConfig(fresh)).toBe(true);
    });
});
