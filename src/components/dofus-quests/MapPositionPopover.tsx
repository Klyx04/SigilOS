"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, ExternalLink, Copy, Check } from "lucide-react";
import { MapViewer } from "@/components/worldmap/map-viewer";
import { DOFUS_WORLDS } from "@/lib/dofus-assets";
import { toast } from "sonner";

interface MapPositionPopoverProps {
  posX: number;
  posY: number;
  worldId?: number;
  guildId: string;
  /** Label context for auto-resolving world if not provided */
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
  const [copied, setCopied] = useState(false);
  const [resolved, setResolved] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve world dynamically if not provided
  useEffect(() => {
    if (resolved) return;
    import("@/server/actions/optimized-guide-actions").then((mod) => {
      mod.resolveMapWorldAction(posX, posY, contextLabel || "").then((res) => {
        if (res.success) {
          setWorldId(res.worldId);
        }
        setResolved(true);
      });
    });
  }, [posX, posY, contextLabel, resolved]);

  const handleMouseEnter = useCallback(() => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    enterTimerRef.current = setTimeout(() => setIsOpen(true), 200);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
    leaveTimerRef.current = setTimeout(() => setIsOpen(false), 300);
  }, []);

  const handleCopy = useCallback(() => {
    const cmd = `/travel ${posX},${posY}`;
    navigator.clipboard.writeText(cmd);
    toast.success(`📍 Position [${posX}, ${posY}] copiée !`, { duration: 1500, icon: "📋" });
  }, [posX, posY]);

  const handleOpenMap = useCallback(() => {
    window.open(`/dashboard/${guildId}/worldmap?x=${posX}&y=${posY}&world=${worldId}`, "_blank");
  }, [guildId, posX, posY, worldId]);

  useEffect(() => {
    return () => {
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, []);

  const worldName = DOFUS_WORLDS.find((w) => w.id === worldId)?.name || `Monde ${worldId}`;

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute z-[99999] bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 pointer-events-auto"
            onMouseEnter={() => {
              if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
            }}
            onMouseLeave={() => {
              leaveTimerRef.current = setTimeout(() => setIsOpen(false), 300);
            }}
          >
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-3 h-3 bg-zinc-900 border-r border-b border-zinc-700/50 rotate-45 -mt-[5px] rounded-br-sm z-0" />

            {/* Card */}
            <div className="relative rounded-xl overflow-hidden border border-zinc-700/60 bg-zinc-950 shadow-2xl shadow-black/60 z-10">
              {/* Header — coord + world selector */}
              <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/80 border-b border-zinc-800/60">
                <div className="flex items-center gap-1.5 min-w-0">
                  <MapPin className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span className="text-[10px] font-mono font-bold text-indigo-300">
                    [{posX}, {posY}]
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[7px] text-zinc-500 font-black uppercase tracking-widest mr-0.5">Monde</span>
                  <select
                    value={worldId}
                    onChange={(e) => setWorldId(parseInt(e.target.value, 10))}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-zinc-800 border border-zinc-700 rounded-md px-1.5 py-0.5 text-[9px] text-zinc-200 font-mono focus:outline-none focus:border-indigo-500/50 cursor-pointer max-w-[130px]"
                    title="Changer de monde"
                  >
                    {DOFUS_WORLDS.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.id} — {w.name.length > 25 ? w.name.slice(0, 25) + "..." : w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* World name info */}
              <div className="px-3 py-1 bg-zinc-900/40 border-b border-zinc-800/30">
                <p className="text-[8px] text-zinc-500 font-medium truncate">{worldName}</p>
              </div>

              {/* Mini MapViewer */}
              <div className="relative w-full h-44 bg-black/60">
                <MapViewer
                  key={`${posX}-${posY}-${worldId}`}
                  initialTab="map"
                  initialX={posX}
                  initialY={posY}
                  initialZoom={5}
                  initialWorldId={worldId}
                  hideUI={true}
                />
                {/* Coordinate overlay */}
                <div className="absolute top-2 right-2 bg-black/80 border border-white/10 rounded-lg px-2 py-1 pointer-events-none">
                  <span className="text-[9px] font-mono font-bold text-indigo-300">[{posX}, {posY}]</span>
                </div>
              </div>

              {/* Actions footer */}
              <div className="flex items-center gap-1.5 px-2.5 py-2 bg-zinc-900/80 border-t border-zinc-800/60">
                <button
                  onClick={(e) => { e.stopPropagation(); handleCopy(); }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 text-indigo-300 text-[8px] font-black uppercase tracking-widest transition-all"
                >
                  <Copy className="w-2.5 h-2.5" />
                  Copier /travel
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleOpenMap(); }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 text-zinc-300 text-[8px] font-black uppercase tracking-widest transition-all"
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                  Carte
                </button>
                <span className="ml-auto text-[7px] text-zinc-600 font-mono">/travel {posX},{posY}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}