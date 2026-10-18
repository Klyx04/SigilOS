"use client";

import { useState } from "react";
import { History, LayoutList } from "lucide-react";
import { cn } from "@/lib/utils";
import { CronStatusPanel } from "./cron-status-panel";
import { TaskJournalPanel } from "./task-journal-panel";

/**
 * `?tab=cron-status` — **deux vues, un seul écran** (décision C2) :
 * « Vue d'ensemble » (statut courant, logs disque) et « Journal » (10 dernières
 * exécutions par tâche, lues dans Redis). Aucune page neuve, aucun second état.
 */
export function CronStatusTabs() {
  const [view, setView] = useState<"overview" | "journal">("overview");

  const tabs = [
    { id: "overview" as const, label: "Vue d'ensemble", icon: LayoutList },
    { id: "journal" as const, label: "Journal", icon: History },
  ];

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Tâches CRON" className="inline-flex gap-1 p-1 rounded-xl bg-surface border border-border">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = view === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              onClick={() => setView(tab.id)}
              className={cn(
                "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border",
                active
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              <Icon className="w-3.5 h-3.5" /> {tab.label}
            </button>
          );
        })}
      </div>

      {view === "overview" ? <CronStatusPanel /> : <TaskJournalPanel />}
    </div>
  );
}
