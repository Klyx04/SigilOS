"use client";

/**
 * En-tête d'un des **3 groupes** de l'inspecteur quête (E2b).
 *
 * Les libellés viennent de la règle pure `@/lib/rush-editor-sections` : un seul endroit à
 * corriger, et le verrou peut comparer l'ordre déclaré à l'ordre monté.
 */

import {
  RUSH_EDITOR_SECTION_GROUPS,
  type RushEditorSectionGroupId,
} from "@/lib/rush-editor-sections";

export function SectionGroupHeader({ group }: { group: RushEditorSectionGroupId }) {
  const meta = RUSH_EDITOR_SECTION_GROUPS.find((g) => g.id === group);
  if (!meta) return null;

  return (
    <div className="flex items-center gap-2 pt-1" data-rush-section-group={meta.id}>
      <span className="shrink-0 rounded-md border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {meta.label}
      </span>
      <span className="truncate text-caption text-muted-foreground">{meta.hint}</span>
      <span className="h-px flex-1 bg-border" aria-hidden />
    </div>
  );
}
