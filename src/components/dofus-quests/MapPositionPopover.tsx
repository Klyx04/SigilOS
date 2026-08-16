"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, ExternalLink, Copy, Move } from "lucide-react";
import { MapViewer } from "@/components/worldmap/map-viewer";
import { DOFUS_WORLDS } from "@/lib/dofus-assets";
import { toast } from "sonner";

interface MapPositionPopoverProps {
  posX: number;
  posY: number;
  worldId?: number;
  guildId: string;
  contextLabel?: string;
  children: React.ReactNode;
}

export default function MapPositionPopover({
  posX,
  posY,
  worldId: initialWorldId,
  guildId,
  contextLabel,
  children,
}: MapPositionPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [worldId, setWorldId] = useState<number>(initialWorldId ?? 1);
  const [resolved, setResolved] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startTop: number; startLeft: number } | null>(null);
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (resolved) return;
    import("@/server/actions/optimized-guide-actions").then((mod) => {
      mod.resolveMapWorldAction(posX, posY, contextLabel || "").then((res) => {
        if (res.success) setWorldId(res.worldId);
        setResolved(true);
      });
    });
  }, [posX, posY, contextLabel, resolved]);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 288;
    const popoverHeight = 380;
    let top: number, left: number;

    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;

    if (spaceAbove > popoverHeight || spaceAbove > spaceBelow) {
      top = rect.top - popoverHeight - 8;
    } else {
      top = rect.bottom + 8;
    }

    left = Math.max(8, Math.min(rect.left + rect.width / 2 - popoverWidth / 2, window.innerWidth - popoverWidth - 8));
    setPosition({ top, left });
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    enterTimerRef.current = setTimeout(() => {
      setIsOpen(true);
      requestAnimationFrame(() => requestAnimationFrame(updatePosition));
    }, 200);
  }, [updatePosition]);

  const handleMouseLeave = useCallback(() => {
    if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
    leaveTimerRef.current = setTimeout(() => setIsOpen(false), 300);
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(`/travel ${posX},${posY}`);
    toast.success(`📍 Position [${posX}, ${posY}] copiée !`, { duration: 1500, icon: "📋" });
  }, [posX, posY]);

  const handleOpenMap = useCallback(() => {
    window.open(`/dashboard/${guildId}/worldmap?x=${posX}&y=${posY}&world=${worldId}`, "_blank");
  }, [guildId, posX, posY, worldId]);

  // Drag handling
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startTop: position.top,
      startLeft: position.left,
    };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setPosition({
        top: dragRef.current.startTop + dy,
        left: dragRef.current.startLeft + dx,
      });
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [position]);

  useEffect(() => {
    return () => {
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handler = () => updatePosition();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [isOpen, updatePosition]);

  const worldName = DOFUS_WORLDS.find((w) => w.id === worldId)?.name || `Monde ${worldId}`;

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      {isOpen && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          <motion.div
            key="popover"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed z-[999999] pointer-events-auto select-none"
            style={{ top: position.top, left: position.left, width: 288 }}
            onMouseEnter={() => { if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current); }}
            onMouseLeave={() => { leaveTimerRef.current = setTimeout(() => setIsOpen(false), 300); }}
          >
            <div className="rounded-xl overflow-hidden border border-border/60 bg-background shadow-2xl shadow-black/60">
              {/* Draggable header */}
              <div
                className="flex items-center justify-between px-3 py-2 bg-surface/80 border-b border-border/60 cursor-grab active:cursor-grabbing"
                onMouseDown={handleDragStart}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <MapPin className="w-3 h-3 text-info shrink-0" />
                  <span className="text-caption font-mono font-bold text-info">[{posX}, {posY}]</span>
                </div>
                <Move className="w-3 h-3 text-muted-foreground shrink-0" />
              </div>

              <div className="px-3 py-1 bg-surface/40 border-b border-border/30 flex items-center gap-1.5">
                <span className="text-caption text-muted-foreground font-black uppercase tracking-widest shrink-0">Monde</span>
                <span className="text-caption text-foreground font-medium truncate">{worldId} — {worldName}</span>
              </div>

              <div className="relative w-full h-44 bg-black/60">
                <MapViewer
                  key={`${posX}-${posY}-${worldId}`}
                  initialTab="map"
                  initialX={posX}
                  initialY={posY}
                  initialZoom={-4}
                  initialWorldId={worldId}
                  hideUI={true}
                  interactive={false}
                />
                <div className="absolute top-2 right-2 bg-black/80 border border-border rounded-lg px-2 py-1 pointer-events-none">
                  <span className="text-caption font-mono font-bold text-info">[{posX}, {posY}]</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-2 bg-surface/80 border-t border-border/60">
                <button onClick={(e) => { e.stopPropagation(); handleCopy(); }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-info/10 hover:bg-info/20 border border-info/25 text-info text-caption font-black uppercase tracking-widest transition-all"
                >
                  <Copy className="w-2.5 h-2.5" /> Copier /travel
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleOpenMap(); }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-elevated hover:bg-muted border border-border/60 text-foreground text-caption font-black uppercase tracking-widest transition-all"
                >
                  <ExternalLink className="w-2.5 h-2.5" /> Carte
                </button>
                <span className="ml-auto text-caption text-muted-foreground font-mono">/travel {posX},{posY}</span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </span>
  );
}