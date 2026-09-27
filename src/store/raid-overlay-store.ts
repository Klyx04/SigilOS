"use client";

import { create } from "zustand";

export type RaidSlug = "gigalodon" | "jardin-eternel";

export interface RaidOverlayPayload {
  raidSlug: RaidSlug;
  activeStepIndex?: number;
  /** Vrai si ouvert en Document PiP (toujours-au-dessus), faux si popup fallback */
  pinned: boolean;
}

interface RaidOverlayState {
  win: Window | null;
  payload: RaidOverlayPayload | null;
  /** Note interactive des 4 formes pour l'énigme d'Exécrabe */
  execrabeShapes: string[];
  /** Mode compact activé ou non dans l'overlay */
  compact: boolean;
  open: (win: Window, payload: RaidOverlayPayload) => void;
  close: () => void;
  setRaid: (raidSlug: RaidSlug) => void;
  setActiveStep: (stepIndex: number) => void;
  setExecrabeShape: (index: number, shape: string) => void;
  clearExecrabeShapes: () => void;
  setCompact: (compact: boolean | ((prev: boolean) => boolean)) => void;
  onWindowGone: () => void;
}

export const useRaidOverlayStore = create<RaidOverlayState>()((set, get) => ({
  win: null,
  payload: null,
  execrabeShapes: ["", "", "", ""],
  compact: false,

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

  setRaid: (raidSlug) => {
    const current = get().payload;
    if (current) {
      set({ payload: { ...current, raidSlug, activeStepIndex: 0 } });
    }
  },

  setActiveStep: (stepIndex) => {
    const current = get().payload;
    if (current) {
      set({ payload: { ...current, activeStepIndex: stepIndex } });
    }
  },

  setExecrabeShape: (index, shape) => {
    const shapes = [...get().execrabeShapes];
    shapes[index] = shape;
    set({ execrabeShapes: shapes });
  },

  clearExecrabeShapes: () => {
    set({ execrabeShapes: ["", "", "", ""] });
  },

  setCompact: (compact) => {
    if (typeof compact === "function") {
      set({ compact: compact(get().compact) });
    } else {
      set({ compact });
    }
  },

  onWindowGone: () => set({ win: null, payload: null }),
}));
