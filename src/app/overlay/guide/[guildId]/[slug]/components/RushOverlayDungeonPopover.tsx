"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DungeonInfo } from "./overlay-utils";
import { RushQuestDungeonsPanel } from "@/components/dofus-quests/rush/RushQuestDungeonsPanel";
import type {
  RushDungeonMemberState,
  RushDungeonState,
  RushDungeonStateMap,
} from "@/lib/rush-dungeons";
import type { RushSequence } from "@/types/rush-guide-types";

/**
 * RushOverlayDungeonPopover — la pastille donjon d'une quête ouvre, **AU CLIC**, le panneau
 * des donjons de CETTE quête : chaque donjon porte ses deux coches (`Fait` / `À faire`) et
 * chaque ligne reste un lien vers sa fiche. Le panneau **reste ouvert** jusqu'à la croix.
 *
 * 🎯 Correction user (21/10/2026) : « au clic sur l'icône donjon la mini modale reste dispo
 * ouverte (avec une croix de fermeture) avec une 2 coche à coté de chaque donjon : fait /
 * à faire, pas besoin d'une nouvelle icône en haut de l'overlay ». Le survol n'ouvre plus
 * rien (une fenêtre qui se referme au moindre mouvement ne permet pas de cocher).
 *
 * Deux choix techniques dictés par la fenêtre PiP (420 px, document séparé) :
 *   · **aucune animation** (pas de `framer-motion`) : une ouverture animée peut rester bloquée
 *     à `opacity: 0` dans un document PiP — l'information doit apparaître, point ;
 *   · **portail dans le document DU NŒUD** (`ownerDocument`, jamais la variable globale
 *     `document`) : dans un bundle JS, `document` reste celui de la page principale, même
 *     quand le nœud vit dans la fenêtre PiP. Le 21/09/2026 la popover se montait donc dans le
 *     `body` de la page principale — « l'aperçu sort complètement de l'overlay ». Même règle
 *     pour les mesures : `ownerDocument.defaultView`.
 */
export function RushOverlayDungeonPopover({
  seq,
  dungeons,
  guildId,
  states = {},
  busyKey = null,
  others = [],
  onSet,
  onEnsureLoaded,
  children,
}: {
  /** La quête de la ligne — porte l'identité de l'occurrence. */
  seq: RushSequence;
  /** Les donjons de la quête — extraits une seule fois par l'appelant (`getDungeons`). */
  dungeons: DungeonInfo[];
  /** Guilde de la surface : la carte donjon en déduit la bonne page (publique ou module). */
  guildId?: string;
  states?: RushDungeonStateMap;
  busyKey?: string | null;
  others?: RushDungeonMemberState[];
  onSet?: (sequenceId: string, dungeonKey: string, state: RushDungeonState | null) => void;
  /** Chargement paresseux des états (une requête, à la première ouverture). */
  onEnsureLoaded?: () => void;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  // Document (et fenêtre) du nœud : ceux de la PiP quand l'overlay y tourne.
  const portalDoc = triggerRef.current?.ownerDocument ?? null;
  const portalWin = portalDoc?.defaultView ?? null;

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const win = el.ownerDocument.defaultView ?? window;
    const rect = el.getBoundingClientRect();
    const width = 320;
    // En-tête + une ligne par donjon (vignette 36 px + marges).
    const height = 92 + dungeons.length * 56;
    const below = rect.bottom + 8;
    const top = below + height > win.innerHeight ? Math.max(8, rect.top - height - 8) : below;
    const left = Math.max(8, Math.min(rect.left, win.innerWidth - width - 8));
    setPosition({ top, left });
  }, [dungeons.length]);

  const open = useCallback(() => {
    onEnsureLoaded?.();
    setIsOpen(true);
    requestAnimationFrame(() => requestAnimationFrame(updatePosition));
  }, [onEnsureLoaded, updatePosition]);

  const toggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isOpen) {
        setIsOpen(false);
        return;
      }
      open();
    },
    [isOpen, open]
  );

  useEffect(() => {
    if (!isOpen) return;
    const handler = () => updatePosition();
    const win = portalWin ?? window;
    win.addEventListener("scroll", handler, true);
    win.addEventListener("resize", handler);
    return () => {
      win.removeEventListener("scroll", handler, true);
      win.removeEventListener("resize", handler);
    };
  }, [isOpen, updatePosition, portalWin]);

  // Aucun donjon à montrer : le badge se rend tel quel, sans panneau vide.
  if (dungeons.length === 0) return <>{children}</>;

  return (
    <span ref={triggerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-label="Donjons de cette quête (fait / à faire)"
        className="inline-flex"
      >
        {children}
      </button>

      {isOpen && portalDoc && createPortal(
        <div
          className="fixed z-[999999] pointer-events-auto"
          style={{ top: position.top, left: position.left, width: 320 }}
        >
          <div className="rounded-xl border border-border/60 bg-background p-1.5 shadow-2xl shadow-black/60">
            <RushQuestDungeonsPanel
              seq={seq}
              guildId={guildId}
              states={states}
              busyKey={busyKey}
              others={others}
              onSet={onSet}
              onClose={() => setIsOpen(false)}
            />
          </div>
        </div>,
        portalDoc.body
      )}
    </span>
  );
}
