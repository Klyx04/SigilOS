"use client";

import { useCallback } from "react";
import { useBossOverlayStore } from "@/store/boss-overlay-store";
import {
  isDocumentPipSupported,
  openPipWindow,
  openFallbackPopup,
  preparePipDocument,
} from "@/hooks/use-guide-pip";

/** Taille par défaut de la fenêtre overlay Bestiaire/Boss. */
const OVERLAY_WIDTH = 380;
const OVERLAY_HEIGHT = 680;

/**
 * Hook utilitaire pour ouvrir / fermer l'overlay PiP Bestiaire & Boss.
 *
 * Usage :
 * ```tsx
 * const { openBossOverlay, isOpen } = useBossOverlay(guildId);
 * <button onClick={() => openBossOverlay({ monsterName: "Wo Wabbit" })}>Guide</button>
 * ```
 */
export function useBossOverlay(guildId: string) {
  const win = useBossOverlayStore((s) => s.win);
  const open = useBossOverlayStore((s) => s.open);
  const close = useBossOverlayStore((s) => s.close);
  const setMonster = useBossOverlayStore((s) => s.setMonster);
  const onWindowGone = useBossOverlayStore((s) => s.onWindowGone);

  const isOpen = win !== null && !win.closed;

  const openBossOverlay = useCallback(
    async (opts?: { monsterName?: string; dungeonName?: string }) => {
      // Si la fenêtre est déjà ouverte, on met juste à jour la cible
      if (win && !win.closed) {
        if (opts?.monsterName) setMonster(opts.monsterName, opts.dungeonName);
        win.focus?.();
        return;
      }

      let newWin: Window | null = null;

      if (isDocumentPipSupported()) {
        newWin = await openPipWindow({
          width: OVERLAY_WIDTH,
          height: OVERLAY_HEIGHT,
        });
      } else {
        newWin = openFallbackPopup({
          width: OVERLAY_WIDTH,
          height: OVERLAY_HEIGHT,
        });
        if (newWin) preparePipDocument(newWin);
      }

      if (!newWin) return;

      // Écouter la fermeture de la fenêtre
      newWin.addEventListener("pagehide", onWindowGone);
      try {
        newWin.addEventListener("beforeunload", onWindowGone);
      } catch {
        // beforeunload non supporté dans certains contextes PiP
      }

      open(newWin, {
        guildId,
        monsterName: opts?.monsterName,
        dungeonName: opts?.dungeonName,
      });
    },
    [win, open, setMonster, onWindowGone, guildId]
  );

  const closeBossOverlay = useCallback(() => {
    close();
  }, [close]);

  return { openBossOverlay, closeBossOverlay, isOpen };
}
