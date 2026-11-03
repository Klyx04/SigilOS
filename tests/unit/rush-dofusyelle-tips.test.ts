/**
 * Corrélation Dofusyelle — la règle de rattachement est verrouillée ici.
 *
 * Mesure du 03/11/2026 : 8/8 quêtes citées par les astuces Dofusyelle existent dans le dataset.
 * Les tests utilisent des fixtures (aucune donnée du site), mais reprennent les cas réels :
 * accents, ponctuation, suffixe de camp et guillemets typographiques.
 */

import { describe, it, expect } from "vitest";
import {
  aidLineFor,
  alignmentRefs,
  matchAidsByQuestName,
  normalizeQuestKey,
  quotedQuestTitles,
} from "@/lib/rush-dofusyelle-tips";

describe("normalizeQuestKey — le même nom, quelle que soit l'écriture", () => {
  it("neutralise accents, casse, ponctuation et suffixe de camp", () => {
    expect(normalizeQuestKey("Esprit, es-tu là ?")).toBe("esprit es tu la");
    expect(normalizeQuestKey("Un sombre pouvoir [brakmarien]")).toBe("un sombre pouvoir");
    expect(normalizeQuestKey("L'ascension de Qu'Tan")).toBe("l ascension de qu tan");
  });

  it("donne la même clé pour deux écritures du même nom", () => {
    expect(normalizeQuestKey("Si j'avais un marteau.")).toBe(normalizeQuestKey("Si j'avais un marteau"));
  });
});

describe("quotedQuestTitles — les quêtes citées par une astuce", () => {
  it("lit les guillemets droits et typographiques", () => {
    expect(quotedQuestTitles('Aide de 2 personnages quête ali 69 "Un sombre pouvoir"')).toEqual([
      "Un sombre pouvoir",
    ]);
    expect(quotedQuestTitles("Ali 75 “Si j'avais un marteau.” : aide de 3 perso")).toEqual([
      "Si j'avais un marteau.",
    ]);
  });

  it("ignore les fragments trop courts et les textes sans guillemets", () => {
    expect(quotedQuestTitles('Voir "ab" puis rien')).toEqual([]);
    expect(quotedQuestTitles("RESSOURCES NEKINEKO")).toEqual([]);
    expect(quotedQuestTitles(null)).toEqual([]);
  });
});

describe("matchAidsByQuestName — le rattachement par nom", () => {
  const DATA = {
    steps: [
      {
        n: 21,
        title: "Quêtes Alignement Bonta",
        aide: 'Aide de 2 personnages quête ali 69 "Un sombre pouvoir"',
      },
      {
        n: 24,
        title: "Quêtes Alignement Bonta",
        aide: 'Ali 75 "Si j\'avais un marteau." : aide de 3 perso pour dalle + combat\nAli 76 "Esprit es-tu la": aide de 3 perso pour ouvrir les coffres\nAli 79 "Pense-bête" : aide d\'un Pandawa',
      },
      { n: 37, title: "Dofus Tacheté", aide: "RESSOURCES NEKINEKO" },
    ],
  };

  it("rattache chaque quête connue, avec l'étape d'origine", () => {
    const matches = matchAidsByQuestName(DATA, ["Un sombre pouvoir", "Si j'avais un marteau", "Pense-bête"]);
    expect(matches).toHaveLength(3);
    expect(matches.map((m) => [m.questTitle, m.step])).toEqual([
      ["Un sombre pouvoir", 21],
      ["Si j'avais un marteau.", 24],
      ["Pense-bête", 24],
    ]);
  });

  it("ignore une astuce sans quête connue et ne rend rien sans astuce", () => {
    expect(matchAidsByQuestName(DATA, ["Quête inconnue"])).toEqual([]);
    expect(matchAidsByQuestName({ steps: [{ n: 1, aide: "" }] }, ["Un sombre pouvoir"])).toEqual([]);
  });

  it("ne garde que la ligne de l'astuce qui cite la quête", () => {
    const [esprit] = matchAidsByQuestName(DATA, ["Esprit es-tu la"]);
    expect(esprit.text).toBe('Ali 76 "Esprit es-tu la": aide de 3 perso pour ouvrir les coffres');
    expect(aidLineFor("Pense-bête", DATA.steps[1].aide)).toBe('Ali 79 "Pense-bête" : aide d\'un Pandawa');
  });
});

describe("alignmentRefs — les numéros cités par les notes de donjon", () => {
  it("extrait Ali et Ordre, quel que soit l'habillage", () => {
    expect(alignmentRefs("Tanukoui : Salle 4 ! Ali 55")).toEqual([{ camp: "ali", number: 55 }]);
    expect(alignmentRefs("Chene mou : Ordre 3 et Merydique")).toEqual([{ camp: "ordre", number: 3 }]);
    expect(alignmentRefs("2X Ali 12 et 65")).toEqual([{ camp: "ali", number: 12 }]);
  });

  it("ne rend rien sur une note sans numéro", () => {
    expect(alignmentRefs("Pré-requis ivoire")).toEqual([]);
    expect(alignmentRefs(null)).toEqual([]);
  });
});
