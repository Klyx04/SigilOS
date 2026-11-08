/**
 * Espace visiteur — **Progression Communautaire** (V2a-2).
 *
 * Ce que ce verrou protège, dans l ordre de gravité :
 * 1. **Consentement** (D-V21) : la requête porte `showRushProgress: true` et le serveur du
 *    lecteur ; sans l un ou l autre, la progression d autrui ne doit pas exister pour l écran.
 * 2. **Minimisation** : aucun `userId`, aucun `publicProfileId` ne sort de la requête, et le
 *    client du guide public n importe aucun code `@/server/`.
 * 3. **Robustesse** : les colonnes sont des `Json` — une ligne abîmée est ignorée, jamais une
 *    exception, et une coche qui n est pas `"done"` ne compte pas.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
    COMMUNITY_MAX_MILESTONES,
    memberCompletion,
    communityDofusStats,
    readCommunitySteps,
    sortCommunityMembers,
    toCommunityMember,
    type CommunityMember,
    type CommunityMilestoneLike,
    type CommunityRow,
} from "@/lib/rush-community-progress";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const SERVER = "src/server/rush-community.ts";
const ACTION = "src/app/guides/rush-sylvestre/_actions/public-community.ts";
const PANEL = "src/app/guides/rush-sylvestre/_components/PublicCommunityPanel.tsx";

function row(overrides: Partial<CommunityRow> = {}): CommunityRow {
    return {
        characterName: "Iopette",
        completedMilestones: ["ms-1", "ms-2"],
        completedSteps: {},
        currentStep: null,
        dungeonChecks: { "seq-1::d-1": "done", "seq-1::d-2": "todo" },
        updatedAt: new Date("2026-11-07T10:00:00Z"),
        pseudoDofus: "Compte",
        ...overrides,
    };
}

function member(name: string, done: number, updatedAt = "2026-11-07T10:00:00.000Z"): CommunityMember {
    return {
        name,
        completedMilestones: Array.from({ length: done }, (_, index) => `ms-${index}`),
        completedSteps: [],
        currentStep: null,
        dungeonDone: [],
        updatedAt,
    };
}

describe("Progression Communautaire — consentement et minimisation", () => {
    it("la requête impose le consentement et le serveur du lecteur", () => {
        const server = read(SERVER);
        expect(server).toContain("showRushProgress: true");
        expect(server).toContain("dofusServerId: serverId");
        expect(server).toContain("getPublicAccount()");
        expect(server).not.toContain("guildId");
    });

    it("aucun identifiant de compte n est sélectionné", () => {
        const server = read(SERVER);
        expect(server).not.toMatch(/userId:\s*true/);
        expect(server).not.toMatch(/publicProfileId:\s*true/);
    });

    it("le panneau passe par l action colocalisée, jamais par `@/server/`", () => {
        const panel = read(PANEL);
        expect(panel).not.toMatch(/from "@\/server\//);
        expect(panel).toContain("_actions/public-community");
        expect(read(ACTION)).toContain("loadPublicCommunity");
    });
});

describe("Progression Communautaire — lignes défensives", () => {
    it("un nom de personnage absent retombe sur le pseudo Dofus", () => {
        expect(toCommunityMember(row({ characterName: null }))?.name).toBe("Compte");
    });

    it("une ligne sans aucun nom est ignorée", () => {
        expect(toCommunityMember(row({ characterName: "  ", pseudoDofus: null }))).toBeNull();
    });

    it("des Json abîmés donnent des listes vides, jamais une exception", () => {
        const member = toCommunityMember(row({ completedMilestones: "pas un tableau", dungeonChecks: 42 }));
        expect(member?.completedMilestones).toEqual([]);
        expect(member?.dungeonDone).toEqual([]);
    });

    it("seules les coches « done » comptent", () => {
        expect(toCommunityMember(row())?.dungeonDone).toEqual(["seq-1::d-1"]);
    });

    it("la liste des blocs est bornée", () => {
        const many = Array.from({ length: COMMUNITY_MAX_MILESTONES + 50 }, (_, index) => `ms-${index}`);
        expect(toCommunityMember(row({ completedMilestones: many }))?.completedMilestones).toHaveLength(
            COMMUNITY_MAX_MILESTONES
        );
    });
});

describe("Progression Communautaire — affichage", () => {
    it("l avancement est borné à 100 % même si la base en dit plus", () => {
        expect(memberCompletion(member("A", 12), 10)).toBe(100);
    });

    it("un guide vide ne divise pas par zéro", () => {
        expect(memberCompletion(member("A", 3), 0)).toBe(0);
    });

    it("les plus avancés d abord, puis le nom", () => {
        const sorted = sortCommunityMembers([member("B", 1), member("A", 5), member("C", 1)], 10);
        expect(sorted.map((entry) => entry.name)).toEqual(["A", "B", "C"]);
    });

    it("le tri ne modifie pas le tableau reçu", () => {
        const input = [member("B", 1), member("A", 5)];
        sortCommunityMembers(input, 10);
        expect(input.map((entry) => entry.name)).toEqual(["B", "A"]);
    });
});

const MILESTONES: CommunityMilestoneLike[] = [
    {
        id: "ms-1",
        title: "Bloc 1",
        chapterLabel: "Départ",
        dofusId: "sylvestre",
        sequences: [{ subGuideRef: "q-1", subGuideName: "Quête 1", stepFrom: 1, stepTo: 2 }],
    },
    {
        id: "ms-2",
        title: "Bloc 2",
        chapterLabel: "Départ",
        dofusId: "sylvestre",
        sequences: [{ subGuideRef: "q-2", subGuideName: "Quête 2", stepFrom: null, stepTo: null }],
    },
    {
        id: "ms-3",
        title: "Bloc 3",
        chapterLabel: "Autre",
        dofusId: "pourpre",
        sequences: [{ subGuideRef: "q-3", subGuideName: "Quête 3", stepFrom: null, stepTo: null }],
    },
];

function memberWith(
    name: string,
    completedMilestones: string[],
    completedSteps: string[],
    currentStep: string | null = null
): CommunityMember {
    return { name, completedMilestones, completedSteps, currentStep, dungeonDone: [], updatedAt: "2026-11-08T10:00:00.000Z" };
}

describe("Progression Communautaire — par Dofus (D-V8)", () => {
    it("les étapes sont aplaties depuis le Json par bloc", () => {
        expect(readCommunitySteps({ "ms-1": ["q-1-1", "q-1-2"], "ms-2": "pas un tableau" })).toEqual([
            "q-1-1",
            "q-1-2",
        ]);
        expect(readCommunitySteps(null)).toEqual([]);
    });
    it("un bloc est couvert dès qu au moins un membre l a terminé", () => {
        const stats = communityDofusStats(
            [memberWith("A", ["ms-1"], []), memberWith("B", [], [])],
            MILESTONES
        );
        const sylvestre = stats.find((stat) => stat.id === "sylvestre");
        expect(sylvestre?.totalMilestones).toBe(2);
        expect(sylvestre?.completedMilestones).toBe(1);
        expect(sylvestre?.pct).toBe(50);
    });
    it("chaque membre est situé à la quête, comme l interne", () => {
        const stats = communityDofusStats(
            [memberWith("A", ["ms-1"], ["q-1-1", "q-1-2"], "q-2-1")],
            MILESTONES
        );
        const sylvestre = stats.find((stat) => stat.id === "sylvestre");
        const row = sylvestre?.members[0];
        expect(row?.done).toBe(1);
        expect(row?.total).toBe(2);
        expect(row?.current).toBe("Quête 2");
        expect(row?.currentIndex).toBe(2);
    });
    it("les Dofus les plus fournis d abord, les membres les plus avancés en tête", () => {
        const stats = communityDofusStats(
            [memberWith("A", [], []), memberWith("B", ["ms-3"], ["q-3-all"], null)],
            MILESTONES
        );
        expect(stats.map((stat) => stat.id)).toEqual(["sylvestre", "pourpre"]);
        expect(stats[1].members[0].name).toBe("B");
    });
    it("un guide sans Dofus ne produit aucune statistique", () => {
        expect(communityDofusStats([memberWith("A", ["ms-1"], [])], [])).toEqual([]);
    });
});
