"use client";

import React, { useState, useMemo } from "react";
import { Package, ChevronDown, ChevronUp, CheckCheck, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/clipboard";
import { ResourceImage } from "@/components/dofus-quests/ResourceImage";
import type { RushActivityTag } from "@/types/rush-guide-types";

const EMPTY_SET = new Set<string>();

interface QuestItemResourceGridProps {
  items: RushActivityTag[];
  completedIds?: Set<string>;
  onToggleItem?: (id: string) => void;
  /** Variante sobre pour les grilles par quête : titre seul, sans compteur ni filtre */
  showHeaderMeta?: boolean;
}

/**
 * Grille « Ressources requises » — icône officielle, nom, niveau, quantité,
 * filtre Restantes/Toutes, clic = copier le nom.
 * Partagée landing + modale détail (thème par tokens, dark & light).
 */
export function QuestItemResourceGrid({
  items,
  completedIds = EMPTY_SET,
  onToggleItem,
  showHeaderMeta = true,
}: QuestItemResourceGridProps) {
  const [filterMode, setFilterMode] = useState<"remaining" | "all">("remaining");
  const [copiedName, setCopiedName] = useState<string | null>(null);

  const parsedItems = useMemo(() => {
    return items.map((it, idx) => {
      const key = (it as any).id || it.name || `item-${idx}`;
      return {
        key: (it as any).id || `${it.name}-${idx}`,
        id: (it as any).id,
        name: it.name || "Ressource",
        count: (it as any).count || (it as any).quantity || 1,
        level: it.level,
        imageUrl: (it as any).imageUrl,
        isDone: key ? completedIds.has(key) : false,
      };
    });
  }, [items, completedIds]);

  const visibleItems = useMemo(() => {
    if (!showHeaderMeta) return parsedItems;
    if (filterMode === "remaining") {
      return parsedItems.filter((it) => !it.isDone);
    }
    return parsedItems;
  }, [parsedItems, filterMode, showHeaderMeta]);

  const remainingCount = parsedItems.filter((it) => !it.isDone).length;

  const handleCopy = (name: string) => {
    copyToClipboard(name).then((ok) => {
      if (ok) {
        setCopiedName(name);
        toast.success(`Copié : ${name}`, { duration: 1500 });
        setTimeout(() => setCopiedName(null), 1800);
      }
    });
  };

  if (items.length === 0) return null;

  return (
    <div className="space-y-3 rounded-[4px] border border-border bg-surface p-3">
      {/* En-tête avec filtres Restantes / Toutes */}
      <div className="flex items-center justify-between gap-2 border-b border-border pb-2.5">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-warning" aria-hidden="true" />
          <span className="text-xs font-semibold text-foreground">
            Ressources requises
          </span>
          {showHeaderMeta && (
            <span className="reg-tag border-warning/40 text-warning">
              {remainingCount} restante{remainingCount > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {showHeaderMeta && (
          <div className="flex items-center gap-1 rounded-[4px] border border-border bg-elevated p-0.5">
          <button
            type="button"
            onClick={() => setFilterMode("remaining")}
            className={cn(
              "px-2.5 py-1 rounded-[3px] text-[11px] font-semibold transition-colors",
              filterMode === "remaining"
                ? "bg-success/15 text-success"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Restantes
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("all")}
            className={cn(
              "px-2.5 py-1 rounded-[3px] text-[11px] font-semibold transition-colors",
              filterMode === "all"
                ? "bg-success/15 text-success"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Toutes ({parsedItems.length})
          </button>
          </div>
        )}
      </div>

      {/* Grille compacte des items avec icône Dofus officielle */}
      {visibleItems.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3 text-center italic">
          Toutes les ressources de cette étape sont réunies !
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
          {visibleItems.map((item) => (
            <div
              key={item.key}
              onClick={() => (item.id && onToggleItem ? onToggleItem(item.id) : handleCopy(item.name))}
              className={cn(
                "group flex cursor-pointer select-none items-center justify-between gap-2.5 rounded-[4px] border p-2 transition-colors",
                item.isDone
                  ? "border-border bg-surface opacity-60"
                  : "border-border bg-elevated hover:border-warning/40"
              )}
              title="Cliquer pour copier le nom"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[4px] border border-border bg-background p-0.5">
                  <ResourceImage
                    id={item.id}
                    imageUrl={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "text-xs font-semibold block truncate group-hover:text-warning transition-colors",
                      item.isDone ? "line-through text-muted-foreground" : "text-foreground"
                    )}
                  >
                    {item.name}
                  </span>
                  {item.level && (
                    <span className="text-[10px] text-muted-foreground font-mono">Niv. {item.level}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={cn(
                    "reg-mono text-xs font-semibold",
                    item.isDone ? "text-muted-foreground" : "text-warning"
                  )}
                >
                  ×{item.count}
                </span>

                {copiedName === item.name ? (
                  <CheckCheck className="w-3.5 h-3.5 text-success shrink-0" />
                ) : (
                  <Copy className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
