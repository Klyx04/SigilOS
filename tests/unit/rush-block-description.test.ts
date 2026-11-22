import { describe, expect, it } from "vitest";
import { countQuestsInBlock, syncQuestCountInDescription } from "@/lib/rush-block-description";

describe("syncQuestCountInDescription — le nombre de quetes annonce est le vrai", () => {
  it("recale le nombre annonce", () => {
    expect(syncQuestCountInDescription("8 quetes a faire", 12)).toBe("12 quetes a faire");
    expect(syncQuestCountInDescription("8 quêtes", 12)).toBe("12 quêtes");
  });

  it("laisse une description juste ou sans nombre", () => {
    expect(syncQuestCountInDescription("12 quetes", 12)).toBe("12 quetes");
    expect(syncQuestCountInDescription("Bloc de Bonta", 12)).toBe("Bloc de Bonta");
  });

  it("ne fabrique rien sur une description vide", () => {
    expect(syncQuestCountInDescription(null, 12)).toBeNull();
    expect(syncQuestCountInDescription("   ", 12)).toBeNull();
  });

  it("compte les quetes d un bloc sans les encarts INFO", () => {
    expect(
      countQuestsInBlock([
        { activityTags: [] },
        { activityTags: [{ type: "info_sequence" }] },
        {},
      ])
    ).toBe(2);
  });
});