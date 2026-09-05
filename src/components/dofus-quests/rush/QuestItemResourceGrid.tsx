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
}: QuestItemResourceGridProps) {
  const [filterMode, setFilterMode] = useState<"remaining" | "all">("remaining");
  const [copiedName, setCopiedName] = useState<string | null>(null);

  const parsedItems = useMemo(() => {
    return items.map((it, idx) => ({
      key: (it as any).id || `${it.name}-${idx}`,
      id: (it as any).id,
      name: it.name || "Ressource",
      count: (it as any).count || (it as any).quantity || 1,
      level: it.level,
      imageUrl: (it as any).imageUrl,
      isDone: (it as any).id ? completedIds.has((it as any).id) : false,
    }));
  }, [items, completedIds]);

  const visibleItems = useMemo(() => {
    if (filterMode === "remaining") {
      return parsedItems.filter((it) => !it.isDone);
    }
    return parsedItems;
  }, [parsedItems, filterMode]);

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
    <div className="rounded-2xl border border-border bg-surface p-3.5 space-y-3 shadow-inner">
      {/* En-tête avec filtres Restantes / Toutes */}
      <div className="flex items-center justify-between gap-2 border-b border-border pb-2.5">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-warning" />
          <span className="text-xs font-black uppercase tracking-wider text-foreground">
            Ressources requises
          </span>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-warning/15 text-warning border border-warning/30">
            {remainingCount} restante{remainingCount > 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex items-center gap-1 bg-elevated p-0.5 rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setFilterMode("remaining")}
            className={cn(
              "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors",
              filterMode === "remaining"
                ? "bg-success text-success-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Restantes
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("all")}
            className={cn(
              "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors",
              filterMode === "all"
                ? "bg-success text-success-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Toutes ({parsedItems.length})
          </button>
        </div>
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
                "group flex items-center justify-between gap-2.5 p-2 rounded-xl border transition-all cursor-pointer select-none",
                item.isDone
                  ? "bg-surface/40 border-border opacity-50"
                  : "bg-elevated/50 hover:bg-elevated border-border hover:border-warning/40 shadow-sm"
              )}
              title="Cliquer pour copier le nom"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg bg-elevated border border-border flex items-center justify-center shrink-0 p-0.5 overflow-hidden shadow-inner">
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
                    "font-mono font-bold text-xs px-2 py-0.5 rounded-lg border",
                    item.isDone
                      ? "bg-surface border-border text-muted-foreground"
                      : "bg-warning/15 border-warning/30 text-warning"
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
