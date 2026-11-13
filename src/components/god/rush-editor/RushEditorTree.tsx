"use client";

/**
 * Arbre persistant du studio (E1) : chapitres → blocs → quêtes, avec recherche et
 * filtres. Il ne bouge **jamais** : c'est lui qui dit où l'on est.
 *
 * Les quêtes d'un bloc ne sont rendues qu'une fois le bloc **sélectionné** — l'arbre
 * reste donc léger même sur un guide de ~500 quêtes (virtualisation au lot E5).
 */

import { useState } from "react";
import { ChevronDown, ChevronRight, Gem, Layers, Minus, SlidersHorizontal, Sparkles, Swords, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DOFUS_CLASSES } from "@/lib/dofus-assets";
import { RUSH_ORDER_CODES } from "@/lib/rush-order-codes";
import {
  isRushSeparator,
  selectionTargetsRushEditorBlock,
  type RushEditorBlockNode,
  type RushEditorFilters,
  type RushEditorSelection,
  type RushEditorTree,
} from "@/lib/rush-editor-selection";

const ALL = "all";

function BlockIcon({ block }: { block: RushEditorBlockNode }) {
  if (isRushSeparator({ type: block.type })) return <Minus className="h-3 w-3 shrink-0" aria-hidden />;
  if (block.isCombat) return <Swords className="h-3 w-3 shrink-0" aria-hidden />;
  if (block.type === "INFO") return <Sparkles className="h-3 w-3 shrink-0" aria-hidden />;
  if (block.type === "DOFUS" || block.type === "DOFUS_OBTAINED") return <Gem className="h-3 w-3 shrink-0" aria-hidden />;
  return <Layers className="h-3 w-3 shrink-0" aria-hidden />;
}

export function RushEditorTree({
  tree,
  selection,
  filters,
  filtersActive,
  onFiltersChange,
  onResetFilters,
  onSelectBlock,
  onSelectQuest,
}: {
  tree: RushEditorTree;
  selection: RushEditorSelection;
  filters: RushEditorFilters;
  filtersActive: boolean;
  onFiltersChange: (patch: Partial<RushEditorFilters>) => void;
  onResetFilters: () => void;
  onSelectBlock: (blockId: string) => void;
  onSelectQuest: (blockId: string, questId: string) => void;
}) {
  const [closedChapters, setClosedChapters] = useState<Set<number>>(new Set());

  const toggleChapter = (chapter: number) => {
    setClosedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapter)) next.delete(chapter);
      else next.add(chapter);
      return next;
    });
  };

  const orderCodes = RUSH_ORDER_CODES.filter((order) => !filters.camp || order.camp === filters.camp);

  return (
    <nav aria-label="Arbre du guide" className="flex flex-col gap-2 p-2">
      <div className="rounded-xl border border-border bg-surface p-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-caption font-medium uppercase tracking-wide text-muted-foreground">
            <SlidersHorizontal className="h-3 w-3" aria-hidden />
            Filtres
          </span>
          {filtersActive && (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-caption text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3 w-3" aria-hidden />
              Réinitialiser
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Select
            value={filters.camp ?? ALL}
            onValueChange={(value) => onFiltersChange({ camp: value === ALL ? null : value, orderCode: null })}
          >
            <SelectTrigger size="sm" aria-label="Filtrer par cité" className="w-full">
              <SelectValue placeholder="Toutes les cités" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toutes les cités</SelectItem>
              <SelectItem value="bontarien">Bontarien</SelectItem>
              <SelectItem value="brakmarien">Brâkmarien</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.orderCode ?? ALL}
            onValueChange={(value) => onFiltersChange({ orderCode: value === ALL ? null : value })}
          >
            <SelectTrigger size="sm" aria-label="Filtrer par Ordre" className="w-full">
              <SelectValue placeholder="Tous les Ordres" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les Ordres</SelectItem>
              {orderCodes.map((order) => (
                <SelectItem key={order.code} value={order.code}>
                  {order.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.classReq ?? ALL}
            onValueChange={(value) => onFiltersChange({ classReq: value === ALL ? null : value })}
          >
            <SelectTrigger size="sm" aria-label="Filtrer par classe" className="w-full">
              <SelectValue placeholder="Toutes les classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toutes les classes</SelectItem>
              {DOFUS_CLASSES.map((dofusClass) => (
                <SelectItem key={dofusClass.id} value={dofusClass.id}>
                  {dofusClass.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label className="flex cursor-pointer items-center gap-2 rounded-md px-0.5 py-1 text-caption text-muted-foreground">
            <Checkbox
              checked={filters.withoutTips}
              onCheckedChange={(checked) => onFiltersChange({ withoutTips: checked === true })}
              aria-label="Quêtes sans conseil"
            />
            Quêtes sans conseil
          </label>
        </div>
      </div>

      {tree.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
          Aucun bloc ne correspond à la recherche.
        </p>
      )}

      {tree.map((chapter) => {
        const closed = closedChapters.has(chapter.chapter);
        return (
          <div key={chapter.chapter} className="rounded-xl border border-border bg-surface">
            <button
              type="button"
              onClick={() => toggleChapter(chapter.chapter)}
              aria-expanded={!closed}
              className="flex w-full items-center gap-1.5 rounded-t-xl px-2 py-1.5 text-left transition-colors hover:bg-muted/60"
            >
              {closed
                ? <ChevronRight className="h-3 w-3 text-muted-foreground" aria-hidden />
                : <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden />}
              <span className="truncate text-caption font-semibold text-foreground">
                {chapter.chapter > 0 ? `CH.${chapter.chapter} · ` : ""}
                {chapter.label}
              </span>
              <span className="ml-auto shrink-0 text-caption text-muted-foreground">{chapter.questCount}</span>
            </button>

            {!closed && (
              <ul className="flex flex-col gap-0.5 px-1 pb-1">
                {chapter.blocks.map((block) => {
                  const selected = selectionTargetsRushEditorBlock(selection, block.id);
                  return (
                    <li key={block.id}>
                      <button
                        type="button"
                        onClick={() => onSelectBlock(block.id)}
                        aria-current={selected ? "true" : undefined}
                        aria-expanded={selected && block.quests.length > 0 ? true : undefined}
                        className={
                          selected
                            ? "flex w-full items-center gap-1.5 rounded-md border border-accent-soft-border bg-accent-soft px-1.5 py-1 text-left text-xs font-medium text-foreground"
                            : "flex w-full items-center gap-1.5 rounded-md border border-transparent px-1.5 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                        }
                      >
                        <BlockIcon block={block} />
                        <span className="truncate">{block.title}</span>
                        {block.quests.length > 0 && (
                          <span className="ml-auto shrink-0 text-caption text-muted-foreground">{block.quests.length}</span>
                        )}
                      </button>

                      {selected && block.quests.length > 0 && (
                        <ul aria-label={`Quêtes de ${block.title}`} className="mt-0.5 flex flex-col gap-0.5 pl-4">
                          {block.quests.map((quest) => {
                            const active = selection.kind === "quest" && selection.questId === quest.id;
                            return (
                              <li key={quest.id}>
                                <button
                                  type="button"
                                  onClick={() => onSelectQuest(block.id, quest.id)}
                                  aria-current={active ? "true" : undefined}
                                  className={
                                    active
                                      ? "w-full truncate rounded-md bg-muted px-1.5 py-1 text-left text-caption font-medium text-foreground"
                                      : "w-full truncate rounded-md px-1.5 py-1 text-left text-caption text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                                  }
                                  title={quest.name}
                                >
                                  {quest.name || "(sans nom)"}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
