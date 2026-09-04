"use client";

import { create } from "zustand";

export interface BossOverlayPayload {
  guildId: string;
  monsterName?: string;
  dungeonName?: string;
}

interface BossOverlayState {
  /** Fenêtre (Document PiP ou popup de secours) qui héberge l'overlay Bestiaire/Boss. */
  win: Window | null;
  payload: BossOverlayPayload | null;
  /** Enregistre la fenêtre + les données pour lancer l'overlay. */
  open: (win: Window, payload: BossOverlayPayload) => void;
  /** Ferme la fenêtre et vide l'état (bouton « fermer » de l'overlay). */
  close: () => void;
  /** Met à jour la cible active directement depuis l'overlay ou la page. */
  setMonster: (monsterName: string, dungeonName?: string) => void;
  /** La fenêtre a disparu (fermée par l'utilisateur / pagehide) : on vide l'état. */
  onWindowGone: () => void;
}

export const useBossOverlayStore = create<BossOverlayState>()((set, get) => ({
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
  setMonster: (monsterName, dungeonName) => {
    const current = get().payload;
    if (current) {
      set({ payload: { ...current, monsterName, dungeonName } });
    }
  },
  onWindowGone: () => set({ win: null, payload: null }),
}));
