/**
 * Badge « plus haut rôle d'ancienneté » (`resolveSeniorityRoleBadge`) — **règle pure**.
 *
 * Ce que ce verrou protège :
 * 1. le palier affiché est le **plus haut atteint** (même règle que la synchronisation), pas le
 *    plus haut rôle porté : un rôle non posé doit se **voir** (`assigned: false`) ;
 * 2. aucun rang inventé : pas d'ancienneté, aucun palier atteint ou libellé inconnu ⇒ rien de faux ;
 * 3. l'ordre des paliers reçus n'a aucune importance ;
 * 4. `nextTierDays` donne le prochain seuil, `null` au dernier palier.
 */
import { describe, expect, it } from "vitest";
import { resolveSeniorityRoleBadge, type SeniorityTier } from "@/lib/seniority-roles";

const TIERS: SeniorityTier[] = [
    { days: 30, roleIds: ["role-recrue"] },
    { days: 180, roleIds: ["role-membre"] },
    { days: 365, roleIds: ["role-veteran"] },
];

const NAMES: Record<string, string> = {
    "role-recrue": "Recrue",
    "role-membre": "Membre confirmé",
    "role-veteran": "Vétéran",
};

const nameOf = (roleId: string) => NAMES[roleId] ?? null;

describe("resolveSeniorityRoleBadge", () => {
    it("aucun palier atteint ⇒ aucun badge", () => {
        expect(resolveSeniorityRoleBadge(TIERS, 10, ["role-recrue"], nameOf)).toBeNull();
    });

    it("ancienneté inconnue ⇒ aucun badge (jamais un rang supposé)", () => {
        expect(resolveSeniorityRoleBadge(TIERS, null, [], nameOf)).toBeNull();
        expect(resolveSeniorityRoleBadge(TIERS, undefined, [], nameOf)).toBeNull();
        expect(resolveSeniorityRoleBadge(TIERS, Number.NaN, [], nameOf)).toBeNull();
    });

    it("affiche le plus haut palier atteint, pas le plus haut rôle porté", () => {
        // 400 j ⇒ palier 365 même si le membre ne porte que le rôle « recrue ».
        const badge = resolveSeniorityRoleBadge(TIERS, 400, ["role-recrue"], nameOf);

        expect(badge).toMatchObject({
            days: 365,
            names: ["Vétéran"],
            assigned: false,
        });
    });

    it("rôle attribué quand le membre porte un des rôles du palier", () => {
        const badge = resolveSeniorityRoleBadge(TIERS, 200, ["role-membre"], nameOf);

        expect(badge).toMatchObject({ days: 180, names: ["Membre confirmé"], assigned: true });
    });

    it("donne le prochain seuil, et `null` au dernier palier", () => {
        expect(resolveSeniorityRoleBadge(TIERS, 40, [], nameOf)?.nextTierDays).toBe(180);
        expect(resolveSeniorityRoleBadge(TIERS, 500, [], nameOf)?.nextTierDays).toBeNull();
    });

    it("ignore un libellé inconnu au lieu de l'inventer", () => {
        const tiers: SeniorityTier[] = [{ days: 30, roleIds: ["role-inconnu", "role-recrue"] }];
        const badge = resolveSeniorityRoleBadge(tiers, 45, [], nameOf);

        expect(badge?.roleIds).toEqual(["role-inconnu", "role-recrue"]);
        expect(badge?.names).toEqual(["Recrue"]);
    });

    it("l'ordre reçu n'a pas d'importance", () => {
        const shuffled: SeniorityTier[] = [TIERS[2], TIERS[0], TIERS[1]];
        expect(resolveSeniorityRoleBadge(shuffled, 400, [], nameOf)?.days).toBe(365);
        expect(resolveSeniorityRoleBadge(shuffled, 40, [], nameOf)?.nextTierDays).toBe(180);
    });

    it("un palier sans rôle ne peut jamais être « attribué »", () => {
        const badge = resolveSeniorityRoleBadge([{ days: 30, roleIds: [] }], 90, ["role-recrue"], nameOf);
        expect(badge).toMatchObject({ names: [], assigned: false });
    });
});
