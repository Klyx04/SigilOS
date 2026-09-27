"use client";

import { useCallback } from "react";
import { useRaidOverlayStore, type RaidSlug } from "@/store/raid-overlay-store";
import {
  isDocumentPipSupported,
  openPipWindow,
  openFallbackPopup,
  preparePipDocument,
} from "@/hooks/use-guide-pip";

const OVERLAY_WIDTH = 420;
const OVERLAY_HEIGHT = 720;

export function useRaidOverlay() {
  const win = useRaidOverlayStore((s) => s.win);
  const open = useRaidOverlayStore((s) => s.open);
  const close = useRaidOverlayStore((s) => s.close);
  const setRaid = useRaidOverlayStore((s) => s.setRaid);
  const setActiveStep = useRaidOverlayStore((s) => s.setActiveStep);
  const onWindowGone = useRaidOverlayStore((s) => s.onWindowGone);

  const isOpen = win !== null && !win.closed;

  const openRaidOverlay = useCallback(
    async (opts?: { raidSlug?: RaidSlug; stepIndex?: number }) => {
      const targetSlug = opts?.raidSlug ?? "gigalodon";

      // Si la fenêtre est déjà ouverte, on met juste à jour la cible
      if (win && !win.closed) {
        setRaid(targetSlug);
        if (opts?.stepIndex !== undefined) {
          setActiveStep(opts.stepIndex);
        }
        win.focus?.();
        return;
      }

      let newWin: Window | null = null;
      let pinned = false;

      // Document PiP si supporté (Chrome/Edge/Brave), sinon popup fallback
      if (isDocumentPipSupported()) {
        try {
          newWin = await openPipWindow({
            width: OVERLAY_WIDTH,
            height: OVERLAY_HEIGHT,
          });
          pinned = newWin !== null;
        } catch {
          newWin = null;
        }
      }

      if (!newWin) {
        newWin = openFallbackPopup({
          width: OVERLAY_WIDTH,
          height: OVERLAY_HEIGHT,
        });
        if (newWin) preparePipDocument(newWin);
      }

      if (!newWin) return;

      newWin.addEventListener("pagehide", onWindowGone);

      open(newWin, {
        raidSlug: targetSlug,
        activeStepIndex: opts?.stepIndex ?? 0,
        pinned,
      });
    },
    [win, open, setRaid, setActiveStep, onWindowGone]
  );

  return {
    openRaidOverlay,
    closeRaidOverlay: close,
    isOpen,
  };
}
