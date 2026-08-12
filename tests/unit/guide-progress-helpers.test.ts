import { describe, it, expect } from "vitest";
import { buildMilestoneStepKeys, buildGuildProgressRows, buildUniqueGuildMembers, buildPresenceMap } from "../../src/lib/guide-progress-helpers";

describe("buildMilestoneStepKeys", () => {
  it("expands step ranges and preserves all-step fallback", () => {
    const sequences = [
      {
        subGuideRef: "A",
        stepFrom: 2,
        stepTo: 4,
      },
      {
        subGuideRef: "B",
        stepFrom: null,
        stepTo: null,
      },
    ] as any;

    expect(buildMilestoneStepKeys(sequences)).toEqual([
      "A-2",
      "A-3",
      "A-4",
      "B-all",
    ]);
  });
});

describe("buildGuildProgressRows", () => {
  it("mappe le select chirurgical vers la shape client (shape inchangée)", () => {
    const rows = [
      {
        profileId: "p1",
        milestoneId: "m1",
        isCompleted: true,
        completedSteps: ["GP1-1", "GP1-2"],
        currentStep: "GP1-2",
        profile: { pseudoDofus: "Klyx", user: { name: "KlyxOS", image: "https://x/avatar.png" } },
      },
      {
        profileId: "p2",
        milestoneId: "m1",
        isCompleted: false,
        completedSteps: [],
        currentStep: null,
        profile: { pseudoDofus: null, user: { name: "Bob", image: null } },
      },
      {
        profileId: "p3",
        milestoneId: "m2",
        isCompleted: false,
        completedSteps: null,
        currentStep: "GP2-5",
        profile: null,
      },
    ] as any;

    const result = buildGuildProgressRows(rows);

    expect(result).toEqual([
      {
        profileId: "p1",
        milestoneId: "m1",
        isCompleted: true,
        completedSteps: ["GP1-1", "GP1-2"],
        currentStep: "GP1-2",
        userName: "Klyx",
        userAvatar: "https://x/avatar.png",
        profileSlug: "Klyx",
      },
      {
        profileId: "p2",
        milestoneId: "m1",
        isCompleted: false,
        completedSteps: [],
        currentStep: null,
        userName: "Bob",
        profileSlug: "p2",
      },
      {
        profileId: "p3",
        milestoneId: "m2",
        isCompleted: false,
        completedSteps: [],
        currentStep: "GP2-5",
        userName: "Voyageur",
        profileSlug: "p3",
      },
    ]);
  });
});

describe("buildUniqueGuildMembers", () => {
  it("agrège les lignes par profileId et calcule currentMilestoneId", () => {
    const milestones = [
      { id: "m1", order: 1 },
      { id: "m2", order: 2 },
      { id: "m3", order: 3 },
    ];
    const rows = [
      { profileId: "a", milestoneId: "m1", isCompleted: false, completedSteps: ["GP1-1"], currentStep: null, userName: "Alice", profileSlug: "alice" },
      { profileId: "a", milestoneId: "m2", isCompleted: false, completedSteps: [], currentStep: "GP2-3", userName: "Alice", profileSlug: "alice" },
      { profileId: "b", milestoneId: "m1", isCompleted: true, completedSteps: [], currentStep: null, userName: "Bob", profileSlug: "bob" },
      { profileId: "c", milestoneId: "m3", isCompleted: false, completedSteps: [], currentStep: null, userName: "Carol", profileSlug: "carol" },
    ];

    const result = buildUniqueGuildMembers(rows as any, milestones);

    expect(result).toHaveLength(3);
    const a = result.find(m => m.profileId === "a")!;
    expect(a.currentMilestoneId).toBe("m2");
    expect(a.completedSteps).toEqual(["GP1-1"]);
    expect(a.bookmarkedSteps).toEqual([{ milestoneId: "m2", stepKey: "GP2-3" }]);

    const b = result.find(m => m.profileId === "b")!;
    expect(b.currentMilestoneId).toBe("m2");
    expect(b.completedMilestoneIds).toEqual(["m1"]);

    const c = result.find(m => m.profileId === "c")!;
    expect(c.currentMilestoneId).toBeNull();
  });

  it("guide entièrement complété → currentMilestoneId null", () => {
    const milestones = [
      { id: "m1", order: 1 },
      { id: "m2", order: 2 },
    ];
    const rows = [
      { profileId: "a", milestoneId: "m1", isCompleted: true, completedSteps: [], currentStep: null, userName: "Alice", profileSlug: "alice" },
      { profileId: "a", milestoneId: "m2", isCompleted: true, completedSteps: [], currentStep: null, userName: "Alice", profileSlug: "alice" },
    ];

    const result = buildUniqueGuildMembers(rows as any, milestones);
    const a = result.find(m => m.profileId === "a")!;
    expect(a.currentMilestoneId).toBeNull();
  });
});

describe("buildPresenceMap", () => {
  it("groupe par currentMilestoneId, déduplique et ignore les membres sans position", () => {
    const members = [
      { profileId: "a", userName: "Alice", currentMilestoneId: "m1" },
      { profileId: "a", userName: "Alice", currentMilestoneId: "m1" },
      { profileId: "b", userName: "Bob", currentMilestoneId: "m2" },
      { profileId: "c", userName: "Carol", currentMilestoneId: null },
    ] as any;

    const result = buildPresenceMap(members);

    expect(Object.keys(result)).toEqual(["m1", "m2"]);
    expect(result.m1).toHaveLength(1);
    expect(result.m2).toHaveLength(1);
  });
});
