/**
 * Affichage de l'essai — **une seule règle** pour la liste, la fiche et le bandeau.
 *
 * Demande du 29/10/2026 : « Essai 11 jours » ne dit pas quand ça finit. On affiche la
 * **date de fin jj/mm/aaaa**, on colore l'état (jaune en cours, bleu second essai, vert
 * validé, rouge échu) et le second essai est distingué du premier.
 */
import { describe, expect, it } from "vitest";

import { describeMemberTrial, formatTrialEndsAt } from "@/lib/member-registry";

const base = { validated: false, endsAt: null as string | null, remainingDays: null as number | null, decision: "non" as const };

describe("describeMemberTrial — lisible sans ouvrir la fiche", () => {
    it("essai validé → vert, sans échéance à suivre", () => {
        expect(describeMemberTrial({ ...base, validated: true })).toEqual({
            tone: "validated",
            label: "Essai validé",
            endsAtLabel: null,
        });
    });

    it("essai en cours → jaune avec la date de fin jj/mm/aaaa", () => {
        expect(
            describeMemberTrial({
                ...base,
                endsAt: "2026-11-09T00:00:00.000Z",
                remainingDays: 11,
            })
        ).toEqual({ tone: "running", label: "Essai · 11 j (fin 09/11/2026)", endsAtLabel: "09/11/2026" });
    });

    it("second essai (échéance au-delà de la durée par défaut) → état distinct", () => {
        const described = describeMemberTrial({
            ...base,
            endsAt: "2026-12-01T00:00:00.000Z",
            remainingDays: 33,
            decision: "prolonge",
        });
        expect(described?.tone).toBe("extended");
        expect(described?.label).toContain("Essai prolongé");
    });

    it("échéance dépassée sans validation → échu (rouge), avec la date", () => {
        const described = describeMemberTrial({
            ...base,
            endsAt: "2026-10-27T00:00:00.000Z",
            remainingDays: -3,
        });
        expect(described?.tone).toBe("expired");
        expect(described?.label).toBe("Essai échu · 3 j (fin 27/10/2026)");
    });

    it("le dernier jour affiche les heures, jamais « 0 j »", () => {
        expect(
            describeMemberTrial({
                ...base,
                endsAt: "2026-11-22T00:00:00.000Z",
                remainingDays: 0,
                remainingMinutes: 5 * 60,
            })
        ).toEqual({ tone: "running", label: "Essai · 5 h (fin 22/11/2026)", endsAtLabel: "22/11/2026" });

        expect(
            describeMemberTrial({
                ...base,
                endsAt: "2026-11-22T00:00:00.000Z",
                remainingDays: 0,
                remainingMinutes: 30,
            })?.label
        ).toBe("Essai · moins d'1 h (fin 22/11/2026)");
    });

    it("une prolongation du dernier jour affiche aussi les heures", () => {
        expect(
            describeMemberTrial({
                ...base,
                endsAt: "2026-11-22T00:00:00.000Z",
                remainingDays: 0,
                remainingMinutes: 2 * 60,
                decision: "prolonge",
            })?.label
        ).toBe("Essai prolongé · 2 h (fin 22/11/2026)");
    });

    it("un essai échu depuis quelques heures dit « il y a N h »", () => {
        expect(
            describeMemberTrial({
                ...base,
                endsAt: "2026-11-21T10:00:00.000Z",
                remainingDays: 0,
                remainingMinutes: -2 * 60,
            })?.label
        ).toBe("Essai échu · il y a 2 h (fin 21/11/2026)");
    });

    it("sans minutes (ancien payload), le libellé en jours reste inchangé", () => {
        expect(
            describeMemberTrial({
                ...base,
                endsAt: "2026-11-22T00:00:00.000Z",
                remainingDays: 0,
            })?.label
        ).toBe("Essai · 0 j (fin 22/11/2026)");
    });

    it("sans échéance → aucun état inventé", () => {
        expect(describeMemberTrial(base)).toEqual({
            tone: "undated",
            label: "Essai — sans échéance",
            endsAtLabel: null,
        });
    });

    it("ligne sans essai → aucune description", () => {
        expect(describeMemberTrial(null)).toBeNull();
    });

    it("date illisible → pas de date affichée", () => {
        expect(formatTrialEndsAt("pas-une-date")).toBeNull();
        expect(formatTrialEndsAt(null)).toBeNull();
    });
});
