/**
 * Inventaire des **mules déclarées** (onglet Membres de l'admin).
 *
 * Ce que la garde protège : un compteur qui ne ment pas — pas de ligne vide, pas de
 * doublon compté deux fois, pas de classe ni de niveau inventés, et un propriétaire
 * toujours identifiable (profil dashboard ou ligne de registre hors dashboard).
 */

import { describe, expect, it } from "vitest";

import { collectDeclaredMules, muleLevelLabel, normalizeDeclaredMule } from "@/lib/member-mules";
import type { RosterRow } from "@/lib/member-roster";

const row = (patch: Partial<RosterRow> = {}): RosterRow => ({
    key: "p1",
    profileId: "p1",
    discordId: "111",
    userId: "u1",
    displayName: "Wylan",
    username: "wylan",
    avatar: null,
    status: "ACTIVE",
    dashboard: true,
    roles: [],
    joinedAt: null,
    seniorityDays: 10,
    pseudoDofus: "Wylan",
    discordNickname: null,
    ankamaId: null,
    trial: null,
    recruiter: null,
    mules: [],
    comments: [],
    vacationStart: null,
    vacationEnd: null,
    ...patch,
});

describe("normalisation d'une mule déclarée", () => {
    it("garde pseudo, classe et niveau exploitables", () => {
        expect(normalizeDeclaredMule({ pseudo: "  Wylanette ", classe: "cra", level: 199 })).toEqual({
            pseudo: "Wylanette",
            classe: "cra",
            level: 199,
        });
    });

    it("écarte une entrée sans pseudo (jamais une ligne vide dans le compteur)", () => {
        expect(normalizeDeclaredMule({ pseudo: "   " })).toBeNull();
        expect(normalizeDeclaredMule({ classe: "cra" })).toBeNull();
        expect(normalizeDeclaredMule("Wylanette")).toBeNull();
        expect(normalizeDeclaredMule(null)).toBeNull();
    });

    it("refuse un niveau hors bornes plutôt que d'afficher un chiffre faux", () => {
        expect(normalizeDeclaredMule({ pseudo: "A", level: 0 })?.level).toBeNull();
        expect(normalizeDeclaredMule({ pseudo: "A", level: 999 })?.level).toBeNull();
        expect(normalizeDeclaredMule({ pseudo: "A", level: 42.5 })?.level).toBeNull();
        expect(normalizeDeclaredMule({ pseudo: "A", level: Number.NaN })?.level).toBeNull();
        expect(normalizeDeclaredMule({ pseudo: "A", level: "60" })?.level).toBe(60);
    });
});

describe("inventaire des mules d'une guilde", () => {
    it("compte les mules, les membres concernés et celles sans classe", () => {
        const summary = collectDeclaredMules([
            row({ mules: [{ pseudo: "Alpha", classe: "cra" }, { pseudo: "Beta" }] }),
            row({ profileId: "p2", displayName: "Lyphi", mules: [{ pseudo: "Gamma", classe: "feca" }] }),
            row({ profileId: "p3", displayName: "SansMule" }),
        ]);

        expect(summary.total).toBe(3);
        expect(summary.membersWithMules).toBe(2);
        expect(summary.withoutClass).toBe(1);
        expect(summary.groups.map((group) => group.owner.name)).toEqual(["Lyphi", "Wylan"]);
    });

    it("ne compte pas deux fois le même pseudo déclaré par le même propriétaire", () => {
        const summary = collectDeclaredMules([
            row({ mules: [{ pseudo: "Alpha" }, { pseudo: " alpha " }] }),
        ]);

        expect(summary.total).toBe(1);
        expect(summary.groups[0].mules).toEqual([{ pseudo: "Alpha", classe: null, level: null }]);
    });

    it("garde deux mules homonymes appartenant à deux membres différents", () => {
        const summary = collectDeclaredMules([
            row({ mules: [{ pseudo: "Jumelle" }] }),
            row({ profileId: "p2", discordId: "222", displayName: "Lyphi", mules: [{ pseudo: "Jumelle" }] }),
        ]);

        expect(summary.total).toBe(2);
        expect(summary.membersWithMules).toBe(2);
    });

    it("trie les mules d'un même propriétaire par pseudo", () => {
        const summary = collectDeclaredMules([
            row({ mules: [{ pseudo: "Zeta" }, { pseudo: "alpha" }, { pseudo: "Beta" }] }),
        ]);

        expect(summary.groups[0].mules.map((mule) => mule.pseudo)).toEqual(["alpha", "Beta", "Zeta"]);
    });

    it("identifie un propriétaire hors dashboard par son identifiant Discord", () => {
        const summary = collectDeclaredMules([
            row({
                profileId: null,
                dashboard: false,
                status: null,
                discordId: "999",
                displayName: "HorsDashboard",
                mules: [{ pseudo: "Mule" }],
            }),
        ]);

        expect(summary.groups[0].owner).toEqual({
            profileId: null,
            discordId: "999",
            name: "HorsDashboard",
            avatar: null,
            status: null,
        });
    });

    it("tolère des données abîmées (mules absentes ou non tableau)", () => {
        const summary = collectDeclaredMules([
            row({ mules: null as unknown as RosterRow["mules"] }),
            row({ profileId: "p2", displayName: "Lyphi", mules: [{ pseudo: "" }] }),
        ]);

        expect(summary).toEqual({ total: 0, membersWithMules: 0, withoutClass: 0, groups: [] });
    });
});


describe("libellé de niveau (Oméga)", () => {
    it("affiche un niveau normal tel quel", () => {
        expect(muleLevelLabel(1)).toBe("Niv. 1");
        expect(muleLevelLabel(200)).toBe("Niv. 200");
    });

    it("nomme le niveau Oméga au-delà de 200 (275 = Oméga 75)", () => {
        expect(muleLevelLabel(275)).toBe("Ω 75 (niv. 275)");
        expect(muleLevelLabel(400)).toBe("Ω 200 (niv. 400)");
    });

    it("n'invente rien quand le niveau est absent", () => {
        expect(muleLevelLabel(null)).toBeNull();
    });

    it("accepte un niveau Oméga à la normalisation, refuse au-delà de 400", () => {
        expect(normalizeDeclaredMule({ pseudo: "A", level: 275 })?.level).toBe(275);
        expect(normalizeDeclaredMule({ pseudo: "A", level: 401 })?.level).toBeNull();
    });
});
