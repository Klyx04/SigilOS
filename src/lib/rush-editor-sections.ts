/**
 * Inspecteur **quête** du studio Rush — les **3 groupes** de sections (E2b, 12/11/2026).
 *
 * Mesure du 12/11/2026 : le formulaire empilait **9** accordéons numérotés 1→9 (deux portaient
 * le numéro « 8 ») et la **route** — le champ le plus structurant du module — arrivait en 7ᵉ
 * position, après les ressources et les liens. Ici, l'ordre est **donné une fois** :
 * l'essentiel (identité, route, conseils), le contenu (destination, prérequis, ressources,
 * liens), puis l'avancé (alignement, options).
 *
 * Le formulaire monte les sections dans cet ordre ; le verrou `rush-sequence-inspector` compare
 * les positions **réelles** des marqueurs dans la source, pas la table ci-dessous : une section
 * déplacée sans mettre à jour la règle casse le test.
 */

export type RushEditorSectionId =
  | "identity"
  | "route"
  | "hints"
  | "location"
  | "prereqs"
  | "conditions"
  | "resources"
  | "links"
  | "activities"
  | "advanced";

export type RushEditorSectionGroupId = "essentiel" | "contenu" | "avance";

export type RushEditorSectionGroup = {
  id: RushEditorSectionGroupId;
  label: string;
  /** Ce que le groupe règle, en une ligne — affiché à côté du libellé. */
  hint: string;
  sections: ReadonlyArray<RushEditorSectionId>;
};

export const RUSH_EDITOR_SECTION_GROUPS: ReadonlyArray<RushEditorSectionGroup> = [
  {
    id: "essentiel",
    label: "Essentiel",
    hint: "Ce que le joueur lit en premier : nom, route, conseils",
    sections: ["identity", "route", "hints"],
  },
  {
    id: "contenu",
    label: "Contenu",
    hint: "Destination, prérequis, conditions, ressources et liens",
    sections: ["location", "prereqs", "conditions", "resources", "links"],
  },
  {
    id: "avance",
    label: "Avancé",
    hint: "Alignement fin, donjons et options",
    sections: ["activities", "advanced"],
  },
];

/** Groupe d'une section — `null` si l'id est inconnu (fail-closed : jamais rattaché d'office). */
export function sectionGroupOf(section: string): RushEditorSectionGroupId | null {
  for (const group of RUSH_EDITOR_SECTION_GROUPS) {
    if ((group.sections as ReadonlyArray<string>).includes(section)) return group.id;
  }
  return null;
}
