// Bus d'événements léger (module-level) pour la présence temps réel du Dashboard.
// Le hook `useDashboardPresence` (WS) publie ; `GuildActivityStream` (popups) consomme.
// Permet de séparer la source (socket) du rendu (UI) sans passer par un provider.

import type { DashboardPresenceEvent } from "@/hooks/use-dashboard-presence";

type Listener = (e: DashboardPresenceEvent) => void;

const listeners = new Set<Listener>();

export function subscribeDashboardPresence(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function emitDashboardPresence(e: DashboardPresenceEvent): void {
  for (const fn of listeners) {
    try {
      fn(e);
    } catch {
      // un listener ne doit jamais casser les autres
    }
  }
}
