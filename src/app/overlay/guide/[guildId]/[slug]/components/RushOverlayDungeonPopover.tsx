"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DungeonInfo } from "./overlay-utils";
import { RushOverlayDungeonCard } from "./RushOverlayDungeonCard";

/**
 * RushOverlayDungeonPopover — le badge donjon d'une quête ouvre, AU SURVOL (ou au clic), la
 * liste des donjons requis : vignette officielle du boss, nom du donjon, badge Ocre, chaque
 * ligne cliquable vers sa page.
 *
 * 🎯 Demande user (21/09/2026) : « les dj dans les quêtes : le survol doit afficher le(s) dj
 * … cliquable vers sa page (si overlay du guide public, page publique du dj ; si overlay du
 * guide interne, page dj du module fiche boss) », puis « si ya un seul dj dans une quête tu
 * affiches x1 ou x2 ».
 *
 * Deux choix techniques dictés par la fenêtre PiP (420 px, document séparé) :
 *   · **aucune animation** (pas de `framer-motion`) : une ouverture animée peut rester bloquée
 *     à `opacity: 0` dans un document PiP — l'information doit apparaître, point ;
 *   · **portail dans le document DU NŒUD** (`ownerDocument`, jamais la variable globale
 *     `document`) : dans un bundle JS, `document` reste celui de la page principale, même
 *     quand le nœud vit dans la fenêtre PiP. Le 21/09/2026 la popover se montait donc dans le
 *     `body` de la page principale — « l'aperçu sort complètement de l'overlay, il est
 *     n'importe où sur l'écran ». Même règle pour les mesures : `ownerDocument.defaultView`.
 */
export function RushOverlayDungeonPopover({
  dungeons,
  guildId,
  children,
}: {
  /** Les donjons de la quête — extraits une seule fois par l'appelant (`getDungeons`). */
  dungeons: DungeonInfo[];
  /** Guilde de la surface : la carte donjon en déduit la bonne page (publique ou module). */
  guildId?: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Document (et fenêtre) du nœud : ceux de la PiP quand l'overlay y tourne.
  const portalDoc = triggerRef.current?.ownerDocument ?? null;
  const portalWin = portalDoc?.defaultView ?? null;

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const win = el.ownerDocument.defaultView ?? window;
    const rect = el.getBoundingClientRect();
    const width = 300;
    // Hauteur estimée : une ligne ≈ 52 px + l'en-tête. On borne dans la fenêtre.
    const height = 64 + dungeons.length * 52;
    const below = rect.bottom + 8;
    const top = below + height > win.innerHeight ? Math.max(8, rect.top - height - 8) : below;
    const left = Math.max(8, Math.min(rect.left, win.innerWidth - width - 8));
    setPosition({ top, left });
  }, [dungeons.length]);

  const open = useCallback(() => {
    setIsOpen(true);
    requestAnimationFrame(() => requestAnimationFrame(updatePosition));
  }, [updatePosition]);

  const handleMouseEnter = useCallback(() => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    enterTimerRef.current = setTimeout(open, 120);
  }, [open]);

  const handleMouseLeave = useCallback(() => {
    if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
    leaveTimerRef.current = setTimeout(() => setIsOpen(false), 260);
  }, []);

  // Le clic (souris pressée, ou doigt sur écran tactile) force l'ouverture : le survol seul
  // n'est pas une certitude (voir la doc du composant).
  const toggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isOpen) {
        setIsOpen(false);
        return;
      }
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
      open();
    },
    [isOpen, open]
  );

  useEffect(() => {
    return () => {
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, []);

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

  // Aucun donjon à montrer : le badge se rend tel quel, sans popover vide.
  if (dungeons.length === 0) return <>{children}</>;

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={toggle}
    >
      {children}

      {isOpen && portalDoc && createPortal(
        <div
          className="fixed z-[999999] pointer-events-auto select-none"
          style={{ top: position.top, left: position.left, width: 300 }}
          onMouseEnter={() => { if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current); }}
          onMouseLeave={() => { leaveTimerRef.current = setTimeout(() => setIsOpen(false), 260); }}
        >
          <div className="rounded-xl border border-border/60 bg-background p-1.5 shadow-2xl shadow-black/60">
            <RushOverlayDungeonCard dungeons={dungeons} guildId={guildId} />
          </div>
        </div>,
        portalDoc.body
      )}
    </span>
  );
}
