/**
 * Corrélation des notes — Tougli (contraintes + textes) et Dofusyelle (étape + donjon).
 *
 * Chaque source est rattachée par **ses propres données** : Tougli par le nom de quête,
 * Dofusyelle par l'étape qui liste la quête et par le donjon qu'elle porte. Aucune des deux ne
 * dépend de l'autre — c'est la demande explicite du 03/11/2026.
 */

import { describe, it, expect } from "vitest";
import {
  cleanDofusyelleBody,
  constraintLabel,
  correlateRushNotes,
  normalizeQuestKey,
} from "@/lib/rush-notes";

describe("normalizeQuestKey — la même clé pour les deux sources", () => {
  it("neutralise accents, casse, ponctuation et suffixe de camp", () => {
    expect(normalizeQuestKey("Esprit, es-tu là ?")).toBe("esprit es tu la");
    expect(normalizeQuestKey("Un sombre pouvoir [brakmarien]")).toBe("un sombre pouvoir");
  });
});

describe("constraintLabel — les contraintes Tougli se lisent en français", () => {
  it("traduit les types connus et retombe sur un libellé neutre", () => {
    expect(constraintLabel("needPlayer")).toBe("Joueurs");
    expect(constraintLabel("job")).toBe("Métier");
    expect(constraintLabel("hours")).toBe("Horaire");
    expect(constraintLabel("spell")).toBe("Sort");
    expect(constraintLabel("note")).toBe("Note");
    expect(constraintLabel("combat")).toBe("Contrainte");
  });
});

describe("cleanDofusyelleBody — les marqueurs [object Object] disparaissent", () => {
  it("retire les marqueurs et la ponctuation orpheline", () => {
    expect(cleanDofusyelleBody("Faire les quêtes d'Incarnam.,[object Object],[object Object]")).toBe(
      "Faire les quêtes d'Incarnam.",
    );
    expect(cleanDofusyelleBody("[object Object] puis rien")).toBe("puis rien");
    expect(cleanDofusyelleBody(null)).toBe("");
  });
});

describe("correlateRushNotes — le rattachement de chaque source", () => {
  const TARGETS = [
    { key: normalizeQuestKey("Un sombre pouvoir"), name: "Un sombre pouvoir", dungeonNames: ["Tanière du Meulou"] },
    { key: normalizeQuestKey("Esprit, es-tu là ?"), name: "Esprit, es-tu là ?", dungeonNames: [] },
  ];

  it("rattache une contrainte Tougli à sa quête, avec un libellé lisible", () => {
    const notes = correlateRushNotes({
      toughli: {
        questConstraints: [
          { questName: "Un sombre pouvoir [brakmarien]", constraints: [{ type: "needPlayer", text: "2 joueurs" }] },
        ],
      },
      targets: TARGETS,
    });
    expect(notes.get(normalizeQuestKey("Un sombre pouvoir"))).toEqual([
      { source: "tougli", kind: "constraint", text: "Joueurs : 2 joueurs", origin: "needPlayer" },
    ]);
  });

  it("rattache une contrainte Tougli par son id DofusDB quand le nom diffère", () => {
    // Les séquences importées depuis God (Brâkmarien) gardent leur libellé : seul `questDbIds` tranche.
    const notes = correlateRushNotes({
      toughli: {
        questConstraints: [
          {
            questId: 1989,
            questName: "Restauration rapide (libellé Tougli)",
            constraints: [{ type: "needPlayer", text: "3 joueurs" }],
          },
        ],
      },
      targets: [{ key: normalizeQuestKey("Restauration rapide"), name: "Restauration rapide", questIds: [1989] }],
    });
    expect(notes.get(normalizeQuestKey("Restauration rapide"))).toEqual([
      { source: "tougli", kind: "constraint", text: "Joueurs : 3 joueurs", origin: "needPlayer" },
    ]);
  });

  it("n'attache rien quand l'id de la contrainte ne correspond à aucune cible", () => {
    const notes = correlateRushNotes({
      toughli: {
        questConstraints: [{ questId: 4242, questName: "Quête inconnue", constraints: [{ type: "job", text: "x" }] }],
      },
      targets: [{ key: normalizeQuestKey("Restauration rapide"), name: "Restauration rapide", questIds: [1989] }],
    });
    expect(notes.size).toBe(0);
  });

  it("rattache un texte de guide Tougli à toutes les quêtes qu'il cite", () => {
    const notes = correlateRushNotes({
      toughli: {
        guideNotes: [
          { type: "take_quests", text: "Prenez ces deux quêtes", questNames: ["Un sombre pouvoir", "Esprit, es-tu là ?"] },
        ],
      },
      targets: TARGETS,
    });
    expect(notes.get(normalizeQuestKey("Esprit, es-tu là ?"))?.[0].text).toBe("Prenez ces deux quêtes");
    expect(notes.get(normalizeQuestKey("Un sombre pouvoir"))?.[0].kind).toBe("take_quests");
  });

  it("rattache le texte de l'étape Dofusyelle à ses quêtes, sans passer par Tougli", () => {
    const notes = correlateRushNotes({
      dofusyelle: {
        steps: [
          {
            n: 24,
            title: "Quêtes Alignement Bonta",
            body: "Faire la série.,[object Object]",
            aide: 'Ali 75 "Un sombre pouvoir" : aide de 3 perso',
            quetes: ["Un sombre pouvoir"],
          },
        ],
      },
      targets: TARGETS,
    });
    const list = notes.get(normalizeQuestKey("Un sombre pouvoir")) ?? [];
    expect(list.map((note) => note.kind)).toEqual(["step", "aide"]);
    expect(list[0].text).toBe("Faire la série.");
    expect(list[0].origin).toContain("étape 24");
  });

  it("ne rattache pas une aide d'étape aux quêtes qu'elle ne cite pas", () => {
    const notes = correlateRushNotes({
      dofusyelle: {
        steps: [
          {
            n: 12,
            aide: "Ali 57 = Need 4 perso Bucheron 150",
            quetes: ["Un sombre pouvoir", "Esprit, es-tu là ?"],
          },
        ],
      },
      targets: TARGETS,
    });
    expect(notes.get(normalizeQuestKey("Un sombre pouvoir"))).toBeUndefined();
    expect(notes.get(normalizeQuestKey("Esprit, es-tu là ?"))).toBeUndefined();
  });

  it("rattache une note de donjon aux quêtes qui exigent ce donjon", () => {
    const notes = correlateRushNotes({
      dofusyelle: { dungeonNotes: [{ name: "Tanière du Meulou", note: "Salle 4 ! Ali 55" }] },
      targets: TARGETS,
    });
    expect(notes.get(normalizeQuestKey("Un sombre pouvoir"))?.[0]).toEqual({
      source: "dofusyelle",
      kind: "dungeon",
      text: "Salle 4 ! Ali 55",
      origin: "donjon Tanière du Meulou",
    });
    expect(notes.get(normalizeQuestKey("Esprit, es-tu là ?"))).toBeUndefined();
  });

  it("dédoublonne une note identique et borne le nombre de notes par quête", () => {
    const duplicate = correlateRushNotes({
      toughli: {
        questConstraints: [
          { questName: "Un sombre pouvoir", constraints: [{ type: "job", text: "Alchimiste 100" }] },
          { questName: "Un sombre pouvoir", constraints: [{ type: "job", text: "Alchimiste 100" }] },
        ],
      },
      targets: TARGETS,
    });
    expect(duplicate.get(normalizeQuestKey("Un sombre pouvoir"))).toHaveLength(1);

    const bounded = correlateRushNotes({
      toughli: {
        questConstraints: [
          {
            questName: "Un sombre pouvoir",
            constraints: Array.from({ length: 10 }, (_, i) => ({ type: "note", text: `contrainte ${i}` })),
          },
        ],
      },
      targets: TARGETS,
      maxNotesPerTarget: 3,
    });
    expect(bounded.get(normalizeQuestKey("Un sombre pouvoir"))).toHaveLength(3);
  });

  it("ignore une note dont la quête n'existe pas chez nous", () => {
    const notes = correlateRushNotes({
      toughli: { questConstraints: [{ questName: "Quête inconnue", constraints: [{ type: "note", text: "x" }] }] },
      targets: TARGETS,
    });
    expect(notes.size).toBe(0);
  });
});
