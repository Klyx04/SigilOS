/**
 * Rôles de contact affichés à un membre exclu — **règle pure** (`rolesGrantingMemberManagement`).
 *
 * Ce que la garde protège (décision du 25/10/2026, option A) :
 * - l'écran « Accès Banni » ne liste que des **noms de rôles** capables de réintégrer, jamais des
 *   personnes : pas d'annuaire de staff exposé à un exclu ;
 * - les permissions retenues sont **exactement** celles de `getUserContext` : `STAFF_MEMBER_MGMT`
 *   (ouvre `canManageMembers`) et `SYSTEM_GOD` (ouvre l'admin de guilde). Une permission voisine
 *   comme `STAFF_MEMBER_DELETE` ne suffit **pas** à lever une exclusion : elle ne doit donc pas
 *   apparaître dans la liste ;
 * - RBAC non configuré ⇒ aucune liste (l'écran retombe sur « contacte ton staff »).
 */
import { describe, expect, it } from "vitest";

import { PERMISSIONS, rolesGrantingMemberManagement } from "@/lib/permissions";

describe("rolesGrantingMemberManagement — qui peut lever une exclusion", () => {
    it("retient les rôles mappés à la gestion des membres ou à l'admin de guilde", () => {
        const rolesMapping = {
            "111": [PERMISSIONS.DASHBOARD_LOGIN],
            "222": [PERMISSIONS.STAFF_MEMBER_MGMT],
            "333": [PERMISSIONS.SYSTEM_GOD],
        };

        expect(rolesGrantingMemberManagement(rolesMapping)).toEqual(["222", "333"]);
    });

    it("n'invite pas un rôle qui ne peut que supprimer un profil", () => {
        const rolesMapping = { "444": [PERMISSIONS.STAFF_MEMBER_DELETE] };

        expect(rolesGrantingMemberManagement(rolesMapping)).toEqual([]);
    });

    it("ignore les entrées vides ou nulles", () => {
        const rolesMapping = { "555": null, "666": [], "777": [PERMISSIONS.STAFF_MEMBER_MGMT] };

        expect(rolesGrantingMemberManagement(rolesMapping)).toEqual(["777"]);
    });

    it("ne rend aucune liste quand le RBAC n'est pas configuré", () => {
        expect(rolesGrantingMemberManagement(null)).toEqual([]);
        expect(rolesGrantingMemberManagement(undefined)).toEqual([]);
        expect(rolesGrantingMemberManagement({})).toEqual([]);
    });
});
