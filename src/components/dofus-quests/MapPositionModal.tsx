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
          className="w-full max-w-5xl bg-[#0a0d14] border border-border rounded-3xl overflow-hidden shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-black/40"
            style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.1) 0%, transparent 60%)" }}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-info/10 border border-info/20 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-info" />
              </div>
              <div>
                <p className="text-foreground font-black text-base">{label || `Aperçu de la position`}</p>
                <p className="text-info font-mono text-xs mt-0.5">[{posX}, {posY}] (Monde {worldId})</p>
              </div>
            </div>
            <button onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface border border-border hover:bg-elevated hover:border-border text-muted-foreground hover:text-foreground transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Map preview via MapViewer */}
          <div className="relative w-full h-[60vh] min-h-[400px] border-b border-border/80">
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
            <div className="absolute top-3 right-3 bg-black/80 border border-info/30 rounded-xl px-3 py-1.5 backdrop-blur-sm pointer-events-none z-10">
              <span className="text-info font-mono font-black text-xs">[{posX}, {posY}]</span>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 flex gap-3">
            <button onClick={handleOpenMap}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-info/10 hover:bg-info/15 border border-info/20 text-info font-black text-sm transition-all hover:border-info/40 group">
              <ExternalLink className="w-4 h-4 group- transition-transform" />
              Voir sur la carte SigilOS
            </button>
            <button onClick={handleCopy}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm transition-all group
                ${copied
                  ? "bg-success/15 border border-success/30 text-success"
                  : "bg-elevated hover:bg-muted border border-border text-foreground"
                }`}>
              {copied
                ? <><Check className="w-4 h-4" /> Copié !</>
                : <><Copy className="w-4 h-4 group- transition-transform" /> Copier /travel</>
              }
            </button>
          </div>

          <p className="px-4 pb-4 text-center text-caption text-muted-foreground">
            Commande autopilote : <span className="font-mono text-muted-foreground">/travel {posX} {posY}</span>
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
