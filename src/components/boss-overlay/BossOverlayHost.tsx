"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useBossOverlayStore } from "@/store/boss-overlay-store";
import { BossOverlayClient } from "@/components/boss-overlay/BossOverlayClient";

/**
 * Héberge l'overlay Bestiaire & Boss dans la mini-fenêtre flottante (Document PiP ou popup fallback).
 * Monté au niveau du RootLayout pour être disponible partout (catalogue public, fiches boss, dashboard guilde).
 */
export function BossOverlayHost() {
  const win = useBossOverlayStore((s) => s.win);
  const payload = useBossOverlayStore((s) => s.payload);
  const close = useBossOverlayStore((s) => s.close);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !win || !payload || !win.document?.body) return null;

  return createPortal(
    <BossOverlayClient
      guildId={payload.guildId}
      initialMonsterName={payload.monsterName}
      initialDungeonName={payload.dungeonName}
      onClose={close}
    />,
    win.document.body
  );
}
