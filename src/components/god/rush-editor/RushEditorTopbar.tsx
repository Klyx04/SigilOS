"use client";

/**
 * Barre unique du studio (E1) : guide, état, recherche, onglets et actions.
 *
 * Avant : deux barres empilées (titre + badges, puis onglets) et **aucun accès rapide**.
 * Ici, tout tient sur une bande : on sait où on est, on cherche, on change d'onglet.
 * DA landing : tokens uniquement, un seul accent, rayons ≤ 12 px.
 */

import type { ReactNode } from "react";
import { AlignLeft, ClipboardList, Layers, Menu, Search, Settings, Zap } from "lucide-react";

export type RushEditorTab = "content" | "settings" | "launch" | "branches";

const TABS: Array<{ value: RushEditorTab; label: string; icon: ReactNode }> = [
  { value: "content", label: "Contenu", icon: <Layers className="h-3 w-3" /> },
  { value: "branches", label: "Branches", icon: <AlignLeft className="h-3 w-3" /> },
  { value: "launch", label: "Lancement", icon: <ClipboardList className="h-3 w-3" /> },
  { value: "settings", label: "Config", icon: <Settings className="h-3 w-3" /> },
];

export function RushEditorTopbar({
  guideName,
  isActive,
  isUnderConstruction,
  activeTab,
  onTabChange,
  query,
  onQueryChange,
  onOpenPalette,
  onOpenTree,
  visibleQuestCount,
  totalQuestCount,
  actions,
}: {
  guideName: string;
  isActive: boolean;
  isUnderConstruction: boolean;
  activeTab: RushEditorTab;
  onTabChange: (tab: RushEditorTab) => void;
  query: string;
  onQueryChange: (query: string) => void;
  onOpenPalette: () => void;
  onOpenTree: () => void;
  /** Quêtes visibles après recherche / filtres (badge de la barre). */
  visibleQuestCount: number;
  totalQuestCount: number;
  /** Boutons propres au studio (JSON, Importer). */
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4" data-rush-editor-topbar>
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="rounded-lg border border-accent-soft-border bg-accent-soft p-1.5" aria-hidden>
          <Zap className="h-4 w-4 text-accent" />
        </span>
        <div className="min-w-0">
          <p className="text-caption uppercase tracking-wide text-muted-foreground">Éditeur God</p>
          <h1 className="truncate text-sm font-semibold text-foreground">{guideName}</h1>
        </div>
      </div>

      <span
        className={
          isActive
            ? "rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-caption font-medium text-success"
            : "rounded-full border border-border bg-muted px-2 py-0.5 text-caption font-medium text-muted-foreground"
        }
      >
        {isActive ? "Actif" : "Inactif"}
      </span>
      {isUnderConstruction && (
        <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-caption font-medium text-warning">
          En construction
        </span>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onOpenTree}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-foreground transition-colors hover:border-border-strong lg:hidden"
          aria-label="Ouvrir l'arbre du guide"
        >
          <Menu className="h-3.5 w-3.5" aria-hidden />
          Arbre
        </button>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Rechercher (nom, qid, bloc, cité, Ordre, classe…)"
            aria-label="Rechercher une quête ou un bloc"
            className="h-9 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>

        <button
          type="button"
          onClick={onOpenPalette}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-foreground transition-colors hover:border-border-strong"
          aria-label="Ouvrir la palette de commandes"
          title="Palette de commandes (Ctrl+K)"
        >
          Aller à…
          <kbd className="rounded border border-border bg-muted px-1 text-caption text-muted-foreground">Ctrl K</kbd>
        </button>

        <span className="hidden items-center gap-1 text-caption text-muted-foreground sm:inline-flex" data-rush-editor-count>
          {visibleQuestCount === totalQuestCount
            ? `${totalQuestCount} quête${totalQuestCount > 1 ? "s" : ""}`
            : `${visibleQuestCount} / ${totalQuestCount} quêtes`}
        </span>

        {actions}
      </div>

      <nav className="flex w-full items-center gap-1 border-t border-border pt-1.5" aria-label="Onglets du studio">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => onTabChange(tab.value)}
            aria-current={activeTab === tab.value ? "page" : undefined}
            className={
              activeTab === tab.value
                ? "inline-flex items-center gap-1.5 rounded-lg border border-border-strong bg-muted px-2.5 py-1.5 text-caption font-medium text-foreground"
                : "inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-1.5 text-caption font-medium text-muted-foreground transition-colors hover:text-foreground"
            }
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
