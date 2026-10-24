import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { hasMappedPermission } from "@/lib/discord/permission-mapping";

/**
 * Permission calculée **en mémoire** à partir des rôles de la payload et du mapping
 * en base — aucun appel à l'API Discord.
 *
 * Mesure du 24/10/2026 : l'ouverture de `/valider-recrue` appelait
 * `internalCheckPermission` (membre + serveur + rôles via l'API Discord) **avant** de
 * répondre → dépassement des 3 s et « SigilOS beta n'a pas répondu à temps ».
 */
const STAFF = "1344374815188058262";
const EMPEREUR = "1290719749730209945";
const PERMISSION = "staff:member_mgmt" as const;

describe("hasMappedPermission", () => {
    it("accorde la permission portée par un rôle du membre", () => {
        expect(
            hasMappedPermission({
                memberRoleIds: [STAFF],
                discordUserId: "42",
                rolesMapping: { [STAFF]: [PERMISSION] },
                usersMapping: {},
                permission: PERMISSION,
            })
        ).toBe(true);
    });

    it("accorde la permission portée par une entrée utilisateur", () => {
        expect(
            hasMappedPermission({
                memberRoleIds: [],
                discordUserId: "42",
                rolesMapping: {},
                usersMapping: { "42": [PERMISSION] },
                permission: PERMISSION,
            })
        ).toBe(true);
    });

    it("`system:config` ouvre toutes les permissions (même règle que getUserContext)", () => {
        expect(
            hasMappedPermission({
                memberRoleIds: [EMPEREUR],
                discordUserId: "42",
                rolesMapping: { [EMPEREUR]: ["system:config"] },
                usersMapping: {},
                permission: PERMISSION,
            })
        ).toBe(true);
    });

    it("fail-closed : rôle non mappé, mapping illisible ou vide ⇒ refus", () => {
        const base = { memberRoleIds: [STAFF], discordUserId: "42", permission: PERMISSION };
        expect(hasMappedPermission({ ...base, rolesMapping: {}, usersMapping: {} })).toBe(false);
        expect(hasMappedPermission({ ...base, rolesMapping: null, usersMapping: "oops" })).toBe(false);
        expect(hasMappedPermission({ ...base, rolesMapping: { [STAFF]: "pas-un-tableau" }, usersMapping: {} })).toBe(
            false
        );
        expect(
            hasMappedPermission({
                memberRoleIds: null,
                discordUserId: null,
                rolesMapping: { [STAFF]: [PERMISSION] },
                usersMapping: {},
                permission: PERMISSION,
            })
        ).toBe(false);
    });

    it("ignore une permission voisine (pas de faux positif)", () => {
        expect(
            hasMappedPermission({
                memberRoleIds: [STAFF],
                discordUserId: "42",
                rolesMapping: { [STAFF]: ["staff:tickets"] },
                usersMapping: {},
                permission: PERMISSION,
            })
        ).toBe(false);
    });
});

describe("/valider-recrue — ACK avant vérification (contrats de source)", () => {
    const route = readFileSync("src/app/api/discord/interactions/route.ts", "utf8");

    it("l'ouverture de la modale ne fait plus d'appel Discord de permission", () => {
        expect(route).toContain("hasMappedPermission");
        // On cible l'APPEL (le commentaire d'explication cite le nom sans parenthèse).
        expect(route).not.toMatch(/commandName === "valider-recrue"[\s\S]{0,1200}await internalCheckPermission\(/);
    });

    it("la soumission applique le gate local (admin ∪ rôle guilde ∪ mapping)", () => {
        expect(route).toContain("allowedByGuildRole");
        expect(route).toContain("mappedStaff");
        expect(route).toContain("isSubmitAdmin");
    });
});
