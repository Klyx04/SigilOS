import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  RUSH_SUCCESS_PLACEHOLDERS,
  normalizeSuccessName,
  successPlaceholderFor,
  successPlaceholderTag,
} from "@/lib/rush-success-placeholders";

/**
 * Les 3 succès hors trame du guide Rush ne sont pas des quêtes : ils portent un tag
 * `succes` (id officiel, nom, icône) pour que la pastille s'affiche. La table est
 * **mesurée** contre `public/game-data/achievements.json` — aucune valeur devinée.
 */
describe("succès hors trame du Rush", () => {
  const achievements = (
    JSON.parse(
      readFileSync(path.join(process.cwd(), "public", "game-data", "achievements.json"), "utf8")
    ) as { achievements: Array<{ id: number; name: string; iconId: number; questIds: number[] }> }
  ).achievements;

  it("les trois entrées correspondent exactement au référentiel officiel", () => {
    for (const placeholder of Object.values(RUSH_SUCCESS_PLACEHOLDERS)) {
      const official = achievements.find((row) => row.id === placeholder.id);
      expect(official, `succès ${placeholder.id}`).toBeDefined();
      expect(official?.name).toBe(placeholder.name);
      expect(official?.iconId).toBe(placeholder.iconId);
      expect(official?.questIds).toEqual([...placeholder.questIds]);
    }
  });

  it("« Quêtes de Silvosse » est corrélé au succès « L'arbre qui cache la forêt »", () => {
    expect(successPlaceholderFor("Quêtes de Silvosse")).toMatchObject({
      id: 7760,
      name: "L'arbre qui cache la forêt",
      iconId: 203,
    });
  });

  it("tolère casse, accents et ponctuation de la Trame", () => {
    expect(successPlaceholderFor("  DÉMONS ET MERVEILLES. ")).toMatchObject({ id: 5165 });
    expect(successPlaceholderFor("En attendant le printemps !")).toMatchObject({ id: 7761 });
  });

  it("normalise sans accents et sans ponctuation", () => {
    expect(normalizeSuccessName("Quêtes de Silvosse.")).toBe("quetes de silvosse");
    expect(normalizeSuccessName("Démons et merveilles")).toBe("demons et merveilles");
  });

  it("rend un tag `succes` lisible par getSequenceSuccesses", () => {
    expect(successPlaceholderTag("Quêtes de Silvosse")).toEqual({
      type: "succes",
      name: "L'arbre qui cache la forêt",
      id: "7760",
      iconId: 203,
    });
    expect(successPlaceholderTag("Démons et merveilles")).toEqual({
      type: "succes",
      name: "Démons et merveilles",
      id: "5165",
      iconId: 203,
    });
  });

  it("n'invente rien pour un libellé inconnu", () => {
    expect(successPlaceholderFor("Succès 1")).toBeNull();
    expect(successPlaceholderTag("Succès 1")).toBeNull();
  });
});
