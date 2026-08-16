"use client";
import React, { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, X, ExternalLink, Copy, Check } from "lucide-react";

import { MapViewer } from "@/components/worldmap/map-viewer";

interface MapPositionModalProps {
  posX: number;
  posY: number;
  label?: string;
  guildId: string;
  onClose: () => void;
}

export default function MapPositionModal({ posX, posY, label, guildId, onClose }: MapPositionModalProps) {
  const [copied, setCopied] = React.useState(false);
  const [worldId, setWorldId] = React.useState<number>(label?.toLowerCase().includes("incarnam") ? 2 : 1);

  // Close on Escape
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  // Dynamically resolve precise worldId from server action
  useEffect(() => {
    import("@/server/actions/optimized-guide-actions").then((mod) => {
      mod.resolveMapWorldAction(posX, posY, label || "").then((res) => {
        if (res.success && res.worldId) {
          setWorldId(res.worldId);
        }
      });
    });
  }, [posX, posY, label]);

  const handleCopy = () => {
    const travelCmd = `/travel ${posX} ${posY}`;
    navigator.clipboard.writeText(travelCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenMap = () => {
    window.open(`/dashboard/${guildId}/worldmap?x=${posX}&y=${posY}&world=${worldId}`, "_blank");
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8"
        style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="w-full max-w-5xl bg-[#0a0d14] border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-black/40"
            style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.1) 0%, transparent 60%)" }}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-white font-black text-base">{label || `Aperçu de la position`}</p>
                <p className="text-cyan-400 font-mono text-xs mt-0.5">[{posX}, {posY}] (Monde {worldId})</p>
              </div>
            </div>
            <button onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Map preview via MapViewer */}
          <div className="relative w-full h-[60vh] min-h-[400px] border-b border-zinc-800/80">
            <MapViewer 
                key={`${posX}-${posY}-${worldId}`}
                initialTab="map" 
                initialX={posX}
                initialY={posY}
                initialZoom={6}
                initialWorldId={worldId}
                hideUI={true}
            />
            {/* Coordinate overlay badge */}
            <div className="absolute top-3 right-3 bg-black/80 border border-cyan-500/30 rounded-xl px-3 py-1.5 backdrop-blur-sm pointer-events-none z-10">
              <span className="text-cyan-400 font-mono font-black text-xs">[{posX}, {posY}]</span>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 flex gap-3">
            <button onClick={handleOpenMap}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/15 border border-cyan-500/20 text-cyan-400 font-black text-sm transition-all hover:border-cyan-500/40 group">
              <ExternalLink className="w-4 h-4 group- transition-transform" />
              Voir sur la carte SigilOS
            </button>
            <button onClick={handleCopy}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm transition-all group
                ${copied
                  ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                  : "bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300"
                }`}>
              {copied
                ? <><Check className="w-4 h-4" /> Copié !</>
                : <><Copy className="w-4 h-4 group- transition-transform" /> Copier /travel</>
              }
            </button>
          </div>

          <p className="px-4 pb-4 text-center text-caption text-zinc-700">
            Commande autopilote : <span className="font-mono text-zinc-500">/travel {posX} {posY}</span>
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
