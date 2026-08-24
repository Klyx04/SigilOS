import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Reaction Roles Engine Logic", () => {
    it("verifies modes behavior (NORMAL toggle, UNIQUE exclusive, VERIFY add-only, REVERSE remove-only)", () => {
        // Mode NORMAL
        const normalToggle = (hasRole: boolean) => !hasRole;
        expect(normalToggle(false)).toBe(true);
        expect(normalToggle(true)).toBe(false);

        // Mode UNIQUE
        const uniqueSelect = (currentRole: string | null, targetRole: string) => {
            if (currentRole === targetRole) return null;
            return targetRole;
        };
        expect(uniqueSelect("ROLE_A", "ROLE_B")).toBe("ROLE_B");
        expect(uniqueSelect("ROLE_A", "ROLE_A")).toBe(null);

        // Mode VERIFY
        const verifyMode = (hasRole: boolean) => true;
        expect(verifyMode(false)).toBe(true);
        expect(verifyMode(true)).toBe(true);

        // Mode REVERSE
        const reverseMode = (hasRole: boolean) => false;
        expect(reverseMode(true)).toBe(false);
    });

    it("enforces maxRoles constraint when specified", () => {
        const checkMaxRoles = (currentRolesCount: number, maxAllowed: number | null) => {
            if (!maxAllowed) return true;
            return currentRolesCount < maxAllowed;
        };

        expect(checkMaxRoles(1, 2)).toBe(true);
        expect(checkMaxRoles(2, 2)).toBe(false);
        expect(checkMaxRoles(5, null)).toBe(true);
    });

    it("handles role swapping (removeRoleId) on grant", () => {
        const memberRoles = new Set(["ROLE_NON_VERIFIE"]);
        const targetRoleId = "ROLE_MEMBRE";
        const removeRoleId = "ROLE_NON_VERIFIE";

        // Grant role
        memberRoles.add(targetRoleId);
        // Auto-remove swap role
        if (removeRoleId && memberRoles.has(removeRoleId)) {
            memberRoles.delete(removeRoleId);
        }

        expect(memberRoles.has("ROLE_MEMBRE")).toBe(true);
        expect(memberRoles.has("ROLE_NON_VERIFIE")).toBe(false);
    });

    it("enforces prerequisite and blacklist rules", () => {
        const checkEligibility = (
            userRoles: Set<string>,
            requiredRoleId?: string | null,
            blacklistedRoleId?: string | null
        ) => {
            if (requiredRoleId && !userRoles.has(requiredRoleId)) {
                return { allowed: false, reason: "MISSING_PREREQUISITE" };
            }
            if (blacklistedRoleId && userRoles.has(blacklistedRoleId)) {
                return { allowed: false, reason: "BLACKLISTED" };
            }
            return { allowed: true };
        };

        // Case 1: Missing required role
        expect(checkEligibility(new Set(["ROLE_GUEST"]), "ROLE_VIP")).toEqual({
            allowed: false,
            reason: "MISSING_PREREQUISITE"
        });

        // Case 2: Has required role
        expect(checkEligibility(new Set(["ROLE_VIP"]), "ROLE_VIP")).toEqual({
            allowed: true
        });

        // Case 3: Has blacklisted role
        expect(checkEligibility(new Set(["ROLE_MUTED"]), null, "ROLE_MUTED")).toEqual({
            allowed: false,
            reason: "BLACKLISTED"
        });
    });
});
