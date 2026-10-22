"use client";

import { createPortal } from "react-dom";
import { useRushOverlayStore } from "@/store/rush-overlay-store";
import GuideOverlayClient from "@/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient";
import { OverlayToaster, OverlayToastProvider } from "@/components/rush/overlay-toast";

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

  if (!win || !payload) return null;

  return createPortal(
    // Le provider + le Toaster sont **dans** le portail : les notifications de l'overlay
    // s'affichent dans SA fenêtre. Sans ça, sonner rend dans le Toaster du document hôte
    // et le message apparaît hors du PiP (mesure du 22/10/2026).
    <OverlayToastProvider>
      <GuideOverlayClient
        guildId={payload.guildId}
        guide={payload.guide}
        milestones={payload.milestones}
        allProgress={payload.allProgress}
        altPseudo={payload.altPseudo}
        character={payload.character}
        pinned={payload.pinned}
        ocre={payload.ocre ?? null}
      />
      <OverlayToaster />
    </OverlayToastProvider>,
    win.document.body
  );
}
