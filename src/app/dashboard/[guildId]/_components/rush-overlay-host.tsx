"use client";

import { createPortal } from "react-dom";
import { useRushOverlayStore } from "@/store/rush-overlay-store";
import GuideOverlayClient from "@/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient";

/**
 * Héberge l'overlay Rush dans la fenêtre Document PiP (ou la popup de secours).
 *
 * Ce composant est monté dans le LAYOUT du dashboard `[guildId]` (et non dans la
 * page guide) : il survit donc aux navigations entre les modules. Tant que la
 * fenêtre PiP est ouverte, son contenu React (`createPortal`) reste rendu — plus
 * d'écran noir quand on quitte "rush-sylvestre" pour un autre module.
 */
export function RushOverlayHost() {
  const win = useRushOverlayStore((s) => s.win);
  const payload = useRushOverlayStore((s) => s.payload);
  const close = useRushOverlayStore((s) => s.close);

  if (!win || !payload) return null;

  return createPortal(
    <GuideOverlayClient
      guildId={payload.guildId}
      guide={payload.guide}
      milestones={payload.milestones}
      allProgress={payload.allProgress}
      altPseudo={payload.altPseudo}
      character={payload.character}
      pinned={payload.pinned}
      onClose={close}
    />,
    win.document.body
  );
}
