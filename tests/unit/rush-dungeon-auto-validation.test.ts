import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { RushSequence } from "@/types/rush-guide-types";

import { shouldAutoValidateAfterDungeon } from "@/lib/rush-dungeons";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
const DASH = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
const OVERLAY = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";
const PUBLIC = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";

/**
 * Auto-validation d'une quête par ses donjons requis (26/11/2026).
 *
 * Décision : cocher le **dernier donjon requis** valide la quête ; un optionnel ne
 * déclenche rien ; plusieurs requis ⇒ seulement quand tous sont cochés ; fail-closed
 * si un donjon requis n'a pas d'identité.
 */

const sequence = (dungeons: Array<Record<string, unknown>>): RushSequence =>
    ({
        id: "s1",
        subGuideRef: "s1",
        subGuideName: "Quête test",
        order: 0,
        dungeons,
        activityTags: [],
    }) as unknown as RushSequence;

const done = (sequenceId: string, key: string) => ({ [`${sequenceId}::${key}`]: "done" as const });

describe("auto-validation quête / donjons requis", () => {
    it("un seul donjon requis coché ⇒ validation", () => {
        const seq = sequence([{ id: "d1", name: "Donjon 1" }]);
        expect(
            shouldAutoValidateAfterDungeon({
                sequence: seq,
                states: done("s1", "d1"),
                sequenceId: "s1",
                changedDungeonKey: "d1",
                changedState: "done",
            })
        ).toBe(true);
    });

    it("deux requis : le premier ne suffit pas, le second valide", () => {
        const seq = sequence([
            { id: "d1", name: "Donjon 1" },
            { id: "d2", name: "Donjon 2" },
        ]);
        expect(
            shouldAutoValidateAfterDungeon({
                sequence: seq,
                states: {},
                sequenceId: "s1",
                changedDungeonKey: "d1",
                changedState: "done",
            })
        ).toBe(false);
        expect(
            shouldAutoValidateAfterDungeon({
                sequence: seq,
                states: { ...done("s1", "d1"), ...done("s1", "d2") },
                sequenceId: "s1",
                changedDungeonKey: "d2",
                changedState: "done",
            })
        ).toBe(true);
    });

    it("un donjon optionnel ne déclenche rien", () => {
        const seq = sequence([{ id: "d1", name: "Donjon 1", isOptional: true }]);
        expect(
            shouldAutoValidateAfterDungeon({
                sequence: seq,
                states: done("s1", "d1"),
                sequenceId: "s1",
                changedDungeonKey: "d1",
                changedState: "done",
            })
        ).toBe(false);
    });

    it("un donjon requis non identifiable bloque l'auto-validation", () => {
        const seq = sequence([
            { id: "d1", name: "Donjon 1" },
            { name: undefined },
        ]);
        expect(
            shouldAutoValidateAfterDungeon({
                sequence: seq,
                states: done("s1", "d1"),
                sequenceId: "s1",
                changedDungeonKey: "d1",
                changedState: "done",
            })
        ).toBe(false);
    });

    it("décocher ou valider un donjon non requis ne déclenche rien", () => {
        const seq = sequence([{ id: "d1", name: "Donjon 1" }]);
        expect(
            shouldAutoValidateAfterDungeon({
                sequence: seq,
                states: {},
                sequenceId: "s1",
                changedDungeonKey: "d1",
                changedState: "todo",
            })
        ).toBe(false);
        expect(
            shouldAutoValidateAfterDungeon({
                sequence: seq,
                states: done("s1", "d1"),
                sequenceId: "s1",
                changedDungeonKey: "autre",
                changedState: "done",
            })
        ).toBe(false);
    });

    it("les 3 surfaces branchent la règle et passent les clés à jour", () => {
        const dash = read(DASH);
        expect(dash).toContain("shouldAutoValidateAfterDungeon");
        expect(dash).toContain("autoValidateQuestRef.current(owner,sequenceId,doneKeys)");
        expect(dash).toContain("doneKeysOverride??doneDungeonKeysForSequence");

        const overlay = read(OVERLAY);
        expect(overlay).toContain("shouldAutoValidateAfterDungeon");
        expect(overlay).toContain("autoValidateQuestRef.current(owner, sequenceId, doneKeys)");
        expect(overlay).toContain("getSeqGate(seqObj, doneKeysOverride)");

        const publicGuide = read(PUBLIC);
        expect(publicGuide).toContain("shouldAutoValidateAfterDungeon");
        expect(publicGuide).toContain("autoValidateQuestRef.current(owner.id, sequenceId, doneKeys)");
        expect(publicGuide).toContain("isSeqBlockedByDungeon(seqId, doneKeysOverride)");
    });
});
