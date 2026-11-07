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
    sortCommunityMembers,
    toCommunityMember,
    type CommunityMember,
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