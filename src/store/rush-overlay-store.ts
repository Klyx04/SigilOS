"use client";

import { create } from "zustand";
import type { RushMilestone } from "@/types/rush-guide-types";
import type { GuideProgressRow } from "@/lib/guide-progress-helpers";

/**
 * Payload nécessaire pour rendre l'overlay Rush hors de la page guide.
 * On le fige à l'ouverture : l'overlay garde son contenu même si la page qui
 * l'a ouvert est démontée (navigation vers un autre module du dashboard).
 */
export interface RushOverlayPayload {
  guildId: string;
  guide: { id: string; name: string; slug: string; description?: string; imageUrl?: string };
  milestones: RushMilestone[];
  allProgress: GuideProgressRow[];
  altPseudo: string | null;
  /** Personnage courant (principal ou mule) pour l'affichage dans l'overlay. */
  character: { pseudo: string; classe: string | null; isMain: boolean };
  /**
   * Vrai si la fenêtre est une vraie Document PiP (toujours-au-dessus).
   * Faux si on est tombé sur la popup `about:blank` de secours (ex. Opera GX,
   * qui n'expose pas l'API) → l'overlay affiche un bandeau d'avertissement.
   */
  pinned: boolean;
}

interface RushOverlayState {
  /** Fenêtre (Document PiP ou popup de secours) qui héberge l'overlay. */
  win: Window | null;
  payload: RushOverlayPayload | null;
  /** Enregistre la fenêtre + les données pour lancer l'overlay. */
  open: (win: Window, payload: RushOverlayPayload) => void;
  /** Ferme la fenêtre et vide l'état (bouton « fermer » de l'overlay). */
  close: () => void;
  /** La fenêtre a disparu (fermée par l'utilisateur / pagehide) : on vide l'état. */
  onWindowGone: () => void;
}

// L'état vit au niveau module (hors composant) : il perdure tant que la page
// n'est pas rechargée, y compris quand on change de page/module du dashboard.
export const useRushOverlayStore = create<RushOverlayState>()((set, get) => ({
  win: null,
  payload: null,
  open: (win, payload) => set({ win, payload }),
  close: () => {
    const { win } = get();
    try {
      win?.close();
    } catch {
      // fenêtre déjà fermée
    }
    set({ win: null, payload: null });
  },
  onWindowGone: () => set({ win: null, payload: null }),
}));
