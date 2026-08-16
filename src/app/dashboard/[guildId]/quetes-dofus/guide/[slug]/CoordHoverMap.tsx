"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MapPin, ExternalLink, Copy, Move } from "lucide-react";
import { MapViewer } from "@/components/worldmap/map-viewer";
import { DOFUS_WORLDS } from "@/lib/dofus-assets";
import { toast } from "sonner";

/**
 * CoordHoverMap — Aperçu carte au survol des coordonnées.
 *
 * Écoute en délégation les `.coord-chip` présents dans le conteneur (le <main> du guide),
 * donc couvre TOUTES les positions du module (vue lecture + étapes des sous-guides),
 * y compris le contenu injecté via dangerouslySetInnerHTML.
 *
 * Au survol (~200 ms) → popover flottant avec mini-carte (MapViewer) positionné près du chip,
 * boutons « Copier /travel » et « Carte ». Le clic sur le chip continue de copier /travel
 * (géré par le handler existant du client).
 */
interface CoordHoverMapProps {
  containerRef: React.RefObject<HTMLElement | null>;
  guildId: string;
}

interface HoverState {
  x: number;
  y: number;
  worldId: number;
  top: number;
  left: number;
}

const POPOVER_WIDTH = 288;
const POPOVER_HEIGHT = 360;

export default function CoordHoverMap({ containerRef, guildId }: CoordHoverMapProps) {
  const [hover, setHover] = useState<HoverState | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startTop: number; startLeft: number } | null>(null);

  const computePosition = useCallback((rect: DOMRect) => {
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceAbove > POPOVER_HEIGHT || spaceAbove > spaceBelow
      ? rect.top - POPOVER_HEIGHT - 8
      : rect.bottom + 8;
    const left = Math.max(
      8,
      Math.min(rect.left + rect.width / 2 - POPOVER_WIDTH / 2, window.innerWidth - POPOVER_WIDTH - 8)
    );
    return { top, left };
  }, []);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const handleMouseOver = (e: MouseEvent) => {
      const chip = (e.target as HTMLElement).closest?.(".coord-chip") as HTMLElement | null;
      if (!chip) return;
      const x = chip.getAttribute("data-x");
      const y = chip.getAttribute("data-y");
      if (!x || !y) return;

      const xNum = parseInt(x, 10);
      const yNum = parseInt(y, 10);
      const explicitWorld = chip.getAttribute("data-world");
      const rect = chip.getBoundingClientRect();
      const pos = computePosition(rect);

      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
      enterTimerRef.current = setTimeout(() => {
        setPosition(pos);
        setHover({
          x: xNum,
          y: yNum,
          worldId: explicitWorld ? parseInt(explicitWorld, 10) : 1,
          top: pos.top,
          left: pos.left,
        });

        // Résolution dynamique du monde si non précisé explicitement
        if (!explicitWorld) {
          import("@/server/actions/optimized-guide-actions").then((mod) => {
            mod.resolveMapWorldAction(xNum, yNum, root.textContent || "").then((res) => {
              if (res?.success && res.worldId) {
                setHover(prev =>
                  prev && prev.x === xNum && prev.y === yNum ? { ...prev, worldId: res.worldId } : prev
                );
              }
            });
          });
        }
      }, 200);
    };

    const handleMouseOut = (e: MouseEvent) => {
      const chip = (e.target as HTMLElement).closest?.(".coord-chip") as HTMLElement | null;
      if (!chip) return;
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
      leaveTimerRef.current = setTimeout(() => {
        setHover(null);
      }, 250);
    };

    root.addEventListener("mouseover", handleMouseOver);
    root.addEventListener("mouseout", handleMouseOut);
    return () => {
      root.removeEventListener("mouseover", handleMouseOver);
      root.removeEventListener("mouseout", handleMouseOut);
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, [containerRef, computePosition]);

  // Recalcule la position au scroll/résize quand ouvert (le conteneur scrollable bouge sous le curseur)
  useEffect(() => {
    if (!hover) return;
    const chipEl = document.querySelector<HTMLElement>(
      `.coord-chip[data-x="${hover.x}"][data-y="${hover.y}"]`
    );
    if (chipEl) {
      setPosition(computePosition(chipEl.getBoundingClientRect()));
    }
    const handler = () => {
      if (chipEl) setPosition(computePosition(chipEl.getBoundingClientRect()));
    };
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [hover, computePosition]);

  const handleCopy = useCallback(() => {
    if (!hover) return;
    navigator.clipboard.writeText(`/travel ${hover.x},${hover.y}`);
    toast.success(`📍 Position [${hover.x}, ${hover.y}] copiée !`, { duration: 1500, icon: "📋" });
  }, [hover]);

  const handleOpenMap = useCallback(() => {
    if (!hover) return;
    window.open(
      `/dashboard/${guildId}/worldmap?x=${hover.x}&y=${hover.y}&world=${hover.worldId}`,
      "_blank"
    );
  }, [hover, guildId]);

  // Drag de la popover
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startTop: position.top,
        startLeft: position.left,
      };
      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        setPosition({
          top: dragRef.current.startTop + (ev.clientY - dragRef.current.startY),
          left: dragRef.current.startLeft + (ev.clientX - dragRef.current.startX),
        });
      };
      const handleMouseUp = () => {
        dragRef.current = null;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [position]
  );

  const worldName = hover ? DOFUS_WORLDS.find((w) => w.id === hover.worldId)?.name || `Monde ${hover.worldId}` : "";

  return (
    <>
      {hover && typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              <motion.div
                key="coord-popover"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="fixed z-[var(--z-tooltip)] pointer-events-auto select-none"
                style={{ top: position.top, left: position.left, width: POPOVER_WIDTH }}
                onMouseEnter={() => {
                  if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
                }}
                onMouseLeave={() => {
                  leaveTimerRef.current = setTimeout(() => setHover(null), 300);
                }}
              >
                <div className="rounded-xl overflow-hidden border border-cyan-500/25 bg-zinc-950 shadow-2xl shadow-black/60">
                  {/* Header draggable */}
                  <div
                    className="flex items-center justify-between px-3 py-2 bg-zinc-900/80 border-b border-zinc-800/60 cursor-grab active:cursor-grabbing"
                    onMouseDown={handleDragStart}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span className="text-caption font-mono font-bold text-cyan-300">
                        [{hover.x}, {hover.y}]
                      </span>
                    </div>
                    <Move className="w-3 h-3 text-zinc-500 shrink-0" />
                  </div>

                  <div className="px-3 py-1 bg-zinc-900/40 border-b border-zinc-800/30 flex items-center gap-1.5">
                    <span className="text-caption text-zinc-600 font-black uppercase tracking-widest shrink-0">Monde</span>
                    <span className="text-caption text-zinc-300 font-medium truncate">{hover.worldId} — {worldName}</span>
                  </div>

                  <div className="relative w-full h-44 bg-black/60">
                    <MapViewer
                      key={`${hover.x}-${hover.y}-${hover.worldId}`}
                      initialTab="map"
                      initialX={hover.x}
                      initialY={hover.y}
                      initialZoom={-4}
                      initialWorldId={hover.worldId}
                      hideUI={true}
                      interactive={false}
                    />
                    <div className="absolute top-2 right-2 bg-black/80 border border-white/10 rounded-lg px-2 py-1 pointer-events-none">
                      <span className="text-caption font-mono font-bold text-cyan-300">
                        [{hover.x}, {hover.y}]
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 px-2.5 py-2 bg-zinc-900/80 border-t border-zinc-800/60">
                    <button onClick={(e) => { e.stopPropagation(); handleCopy(); }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25 text-cyan-300 text-caption font-black uppercase tracking-widest transition-all">
                      <Copy className="w-2.5 h-2.5" /> Copier /travel
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleOpenMap(); }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 text-zinc-300 text-caption font-black uppercase tracking-widest transition-all">
                      <ExternalLink className="w-2.5 h-2.5" /> Carte
                    </button>
                    <span className="ml-auto text-caption text-zinc-600 font-mono">/travel {hover.x},{hover.y}</span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>,
            document.body
          )
        : null}
    </>
  );
}

