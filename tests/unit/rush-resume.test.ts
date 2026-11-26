import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  buildRushResumeChoices,
  findRushResumeTarget,
  type RushResumeCandidate,
} from "@/lib/rush-resume";

const OVERLAY = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";
const DASH = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
const PUB = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";

const c = (
  seqId: string,
  milestoneId: string,
  extra: Partial<RushResumeCandidate> = {},
): RushResumeCandidate => ({
  seqId,
  milestoneId,
  isDone: false,
  isLocked: false,
  ...extra,
});

describe("buildRushResumeChoices — le sélecteur de repères", () => {
  const milestones = [
    {
      id: "bloc-a",
      title: "Chapitre A",
      sequences: [
        { id: "a1", name: "Quête A1", isInfo: false },
        { id: "a2", name: "Quête A2", isInfo: false },
        { id: "a-info", name: "Conseil", isInfo: true },
      ],
    },
    {
      id: "bloc-b",
      title: "Chapitre B",
      sequences: [{ id: "b1", name: "Quête B1", isInfo: false }],
    },
  ];

  it("rend les repères valides dans l'ordre du guide, avec leur bloc", () => {
    expect(
      buildRushResumeChoices({
        milestones,
        bookmarks: new Map([
          ["bloc-b", "b1"],
          ["bloc-a", "a2"],
        ]),
        isDone: () => false,
      }),
    ).toEqual([
      { seqId: "a2", milestoneId: "bloc-a", name: "Quête A2", blockTitle: "Chapitre A" },
      { seqId: "b1", milestoneId: "bloc-b", name: "Quête B1", blockTitle: "Chapitre B" },
    ]);
  });

  it("ignore un repère validé, un encart info et une quête disparue", () => {
    expect(
      buildRushResumeChoices({
        milestones,
        bookmarks: new Map([
          ["bloc-a", "a1"],
          ["bloc-a", "a-info"],
          ["bloc-a", "disparu"],
        ]),
        isDone: (msId, seqId) => msId === "bloc-a" && seqId === "a1",
      }),
    ).toEqual([]);
  });

  it("un seul repère reste un saut direct côté appelant", () => {
    expect(
      buildRushResumeChoices({
        milestones,
        bookmarks: new Map([["bloc-b", "b1"]]),
        isDone: () => false,
      }),
    ).toHaveLength(1);
  });
});

describe("findRushResumeTarget — « Reprendre » ne fait jamais un clic muet", () => {
  it("le repère « je suis ici » passe avant la prochaine quête du bloc", () => {
    expect(
      findRushResumeTarget({
        candidates: [c("b1", "bloc-b"), c("b2", "bloc-b")],
        bookmarks: [{ milestoneId: "bloc-b", seqId: "b2" }],
        preferredSeqId: "b1",
        currentMilestoneId: "bloc-b",
      }),
    ).toEqual({ kind: "bookmark", seqId: "b2", milestoneId: "bloc-b" });
  });

  it("ignore un repère validé ou orphelin", () => {
    expect(
      findRushResumeTarget({
        candidates: [c("b1", "bloc-b"), c("b2", "bloc-b", { isDone: true })],
        bookmarks: [
          { milestoneId: "bloc-b", seqId: "b2" },
          { milestoneId: "bloc-b", seqId: "disparu" },
        ],
        preferredSeqId: "b1",
        currentMilestoneId: "bloc-b",
      }),
    ).toEqual({ kind: "preferred", seqId: "b1", milestoneId: "bloc-b" });
  });

  it("sans repère : la prochaine quête disponible du bloc affiché", () => {
    expect(
      findRushResumeTarget({
        candidates: [c("a1", "bloc-a", { isDone: true }), c("a2", "bloc-a")],
        preferredSeqId: "a2",
        currentMilestoneId: "bloc-a",
      }),
    ).toEqual({ kind: "preferred", seqId: "a2", milestoneId: "bloc-a" });
  });

  it("bloc affiché sans quête disponible : passe au bloc suivant", () => {
    expect(
      findRushResumeTarget({
        candidates: [
          c("a1", "bloc-a", { isDone: true }),
          c("a2", "bloc-a", { isLocked: true }),
          c("b1", "bloc-b"),
        ],
        preferredSeqId: null,
        currentMilestoneId: "bloc-a",
      }),
    ).toEqual({ kind: "global", seqId: "b1", milestoneId: "bloc-b" });
  });

  it("dernier bloc sans disponible : revient au début plutôt que de ne rien faire", () => {
    expect(
      findRushResumeTarget({
        candidates: [
          c("a1", "bloc-a"),
          c("b1", "bloc-b", { isDone: true }),
        ],
        preferredSeqId: null,
        currentMilestoneId: "bloc-b",
      }),
    ).toEqual({ kind: "global", seqId: "a1", milestoneId: "bloc-a" });
  });

  it("tout est verrouillé : montre la première verrouillée au lieu d'un clic muet", () => {
    expect(
      findRushResumeTarget({
        candidates: [
          c("a1", "bloc-a", { isLocked: true }),
          c("a2", "bloc-a", { isLocked: true }),
        ],
        preferredSeqId: null,
        currentMilestoneId: "bloc-a",
      }),
    ).toEqual({ kind: "locked", seqId: "a1", milestoneId: "bloc-a" });
  });

  it("tout est terminé : rend `done` (l'appelant affiche le message)", () => {
    expect(
      findRushResumeTarget({
        candidates: [c("a1", "bloc-a", { isDone: true })],
        preferredSeqId: null,
        currentMilestoneId: "bloc-a",
      }),
    ).toEqual({ kind: "done" });
  });
});

describe("sélecteur de reprise — branché sur les trois surfaces", () => {
  const read = (path: string) => readFileSync(path, "utf8");

  it("overlay : le bouton Reprendre ouvre le sélecteur au-delà d'un repère", () => {
    const src = read(OVERLAY);
    expect(src).toContain("buildRushResumeChoices");
    expect(src).toContain("resumeBookmarkChoices.length > 1");
    expect(src).toContain("<RushOverlayResumeModal");
  });

  it("dashboard : le popup d'arrivée liste les repères et lande sur la quête", () => {
    const src = read(DASH);
    expect(src).toContain("buildRushResumeChoices");
    expect(src).toContain("resumeBookmarkChoices.length>1");
    expect(src).toContain("Reprendre où ?");
    // Le clic vise la QUÊTE (`scrollToSequence`), plus seulement le bloc.
    expect(src).toMatch(/scrollToSequence\(choice\.seqId\)/);
  });

  it("guide public : le popup d'arrivée propose le même choix", () => {
    const src = read(PUB);
    expect(src).toContain("buildRushResumeChoices");
    expect(src).toContain("resumeBookmarkChoices.length > 0");
    expect(src).toContain("Reprendre où ?");
    expect(src).toMatch(/scrollToStep\(choice\.seqId\)/);
  });
});
