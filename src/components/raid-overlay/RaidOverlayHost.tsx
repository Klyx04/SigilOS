"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRaidOverlayStore } from "@/store/raid-overlay-store";
import { RaidOverlayClient } from "@/components/raid-overlay/RaidOverlayClient";

/**
 * Héberge l'overlay de Raid dans la mini-fenêtre flottante (Document PiP ou popup fallback).
 * Monté au niveau du RootLayout pour être disponible sur toutes les pages (worldmap, guide, dashboard).
 */
export function RaidOverlayHost() {
  const win = useRaidOverlayStore((s) => s.win);
  const payload = useRaidOverlayStore((s) => s.payload);
  const close = useRaidOverlayStore((s) => s.close);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !win || !payload || !win.document?.body) return null;

  return createPortal(
    <RaidOverlayClient
      initialRaidSlug={payload.raidSlug}
      pinned={payload.pinned}
      onClose={close}
    />,
    win.document.body
  );
}
