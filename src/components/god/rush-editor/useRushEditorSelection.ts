"use client";

/**
 * État du studio : sélection, filtres, arbre visible, palette `Ctrl+K`.
 *
 * Les **règles** vivent dans `src/lib/rush-editor-selection.ts` (testables sans DOM) ;
 * ce hook ne fait que tenir l'état et les mémoïsations. Il ne connaît ni les server
 * actions ni les formulaires : le studio reste seul responsable de l'écriture.
 */

import { useCallback, useMemo, useState } from "react";
import {
  EMPTY_RUSH_EDITOR_FILTERS,
  buildRushEditorCommands,
  buildRushEditorTree,
  countRushEditorQuests,
  filterRushEditorTree,
  hasActiveRushEditorFilters,
  type RushEditorFilters,
  type RushEditorMilestoneInput,
  type RushEditorSelection,
} from "@/lib/rush-editor-selection";

export function useRushEditorSelection(milestones: RushEditorMilestoneInput[]) {
  const [selection, setSelection] = useState<RushEditorSelection>({ kind: "none" });
  const [filters, setFilters] = useState<RushEditorFilters>(EMPTY_RUSH_EDITOR_FILTERS);
  // Tiroirs mobiles : l'arbre disparaît sous 1024 px, l'inspecteur sous 768 px.
  const [treeOpen, setTreeOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const tree = useMemo(() => buildRushEditorTree(milestones), [milestones]);
  const visibleTree = useMemo(() => filterRushEditorTree(tree, filters), [tree, filters]);
  const commands = useMemo(() => buildRushEditorCommands(tree), [tree]);

  const patchFilters = useCallback((patch: Partial<RushEditorFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters((prev) => ({ ...EMPTY_RUSH_EDITOR_FILTERS, query: prev.query }));
  }, []);

  return {
    selection,
    setSelection,
    filters,
    patchFilters,
    resetFilters,
    filtersActive: hasActiveRushEditorFilters(filters),
    tree,
    visibleTree,
    commands,
    totalQuestCount: countRushEditorQuests(tree),
    visibleQuestCount: countRushEditorQuests(visibleTree),
    treeOpen,
    setTreeOpen,
    inspectorOpen,
    setInspectorOpen,
  };
}
