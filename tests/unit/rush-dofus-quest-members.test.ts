import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { questStatusForMembers, type DofusQuestRef } from "@/lib/rush-dofus-progress";

/**
 * Fiche Dofus — le petit bouton « membres » par quête (retour du 25/11/2026).
 *
 * La règle ne liste que les personnes qui ont **validé** la quête ou qui **y sont**
 * (« Je suis ici ») ; une personne sans nom n'est jamais inventée à l'écran, et un
 * membre « à faire » ne remplit pas la liste.
 */

const QUEST: DofusQuestRef = {
    milestoneId: "bloc-1",
    category: "Route Sylvestre — partie 3",
    label: "Le dragon blanc",
    step: "RS-S3-Q1",
    steps: 1,
    sequenceId: "seq-dragon-blanc",
};

describe("fiche Dofus — membres par quête", () => {
    it("liste un membre qui a validé la quête et garde son nom", () => {
        const [status] = questStatusForMembers([QUEST], [
            {
                name: "Wylou",
                completedSteps: ["RS-S3-Q1-all"],
                currentStep: null,
            },
        ]);

        expect(status.done).toBe(true);
        expect(status.membersDone).toBe(1);
        expect(status.members).toEqual([
            { name: "Wylou", avatar: null, isViewer: false, done: true, current: false },
        ]);
    });

    it("liste un membre qui est « ici » sans avoir validé la quête", () => {
        const [status] = questStatusForMembers([QUEST], [
            {
                name: "Wylou",
                completedSteps: [],
                currentStep: "RS-S3-Q1-all",
            },
        ]);

        expect(status.done).toBe(false);
        expect(status.current).toBe(true);
        expect(status.membersHere).toBe(1);
        expect(status.members?.[0]).toMatchObject({ name: "Wylou", done: false, current: true });
    });

    it("ne liste pas un membre « à faire » et ne compte pas un nom absent", () => {
        const [status] = questStatusForMembers([QUEST], [
            { name: "Wylou", completedSteps: [], currentStep: null },
            { completedSteps: ["RS-S3-Q1-all"], currentStep: null },
        ]);

        expect(status.membersDone).toBe(1);
        expect(status.members).toEqual([]);
    });

    it("marque le lecteur et borne le nom affiché", () => {
        const longName = `  ${"x".repeat(120)}  `;
        const [status] = questStatusForMembers([QUEST], [
            {
                name: longName,
                completedSteps: ["RS-S3-Q1-all"],
                currentStep: null,
                isViewer: true,
            },
        ]);

        expect(status.members?.[0].name).toHaveLength(80);
        expect(status.members?.[0].name).not.toMatch(/\s/);
        expect(status.members?.[0].isViewer).toBe(true);
    });

    it("transporte l'id de séquence (cible du clic vers la timeline)", () => {
        const [status] = questStatusForMembers([QUEST], []);
        expect(status.sequenceId).toBe("seq-dragon-blanc");
    });
});

const MODAL = "src/components/dofus-quests/rush/RushDofusDetailModal.tsx";
const PANEL =
    "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/GuildStatusPanel.tsx";
const CLIENT =
    "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("branchement de la fiche Dofus", () => {
    it("la fiche rend le bouton membres et les quêtes cliquables", () => {
        const modal = read(MODAL);
        expect(modal).toContain("onOpenQuest");
        expect(modal).toContain("aria-expanded={isMembersOpen}");
        expect(modal).toContain("member.isViewer");
        expect(modal).toContain("listedMembers");
    });

    it("le panneau branche le clic sur la quête et le client transmet le scroll", () => {
        expect(read(PANEL)).toContain("onOpenQuest");
        expect(read(CLIENT)).toContain("onOpenQuest={scrollToSequence}");
    });

    it("le filtre Dofus actif est retirable depuis la barre d'actions", () => {
        const client = read(CLIENT);
        expect(client).toContain("Retirer le filtre");
        expect(client).toContain("onClick={() => setDofusFilter(null)}");
    });
});
