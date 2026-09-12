"use client";

import React, { useEffect, useState } from "react";
import { Compass } from "lucide-react";
import { MapViewer } from "@/components/worldmap/map-viewer";

interface WorldmapPublicOverlayClientProps {
  initialX?: number;
  initialY?: number;
  initialZoom?: number;
  initialWorldId?: number;
}

export function WorldmapPublicOverlayClient({
  initialX,
  initialY,
  initialZoom,
  initialWorldId,
}: WorldmapPublicOverlayClientProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-screen h-screen bg-[#080a10] flex items-center justify-center text-white/50 text-xs uppercase tracking-widest font-bold">
        Chargement de l&apos;overlay...
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col bg-[#080a10] text-foreground font-sans select-none overflow-hidden isolate">
      {/* Header Overlay Compact */}
      <header className="h-10 shrink-0 px-3 bg-[#0d111c] border-b border-white/10 flex items-center justify-between z-30 select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-5 h-5 rounded-md bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
            <Compass size={12} className="text-emerald-400" />
          </div>
          <span className="text-xs font-black uppercase tracking-wider text-emerald-200 truncate">
            Carte du Monde — Overlay
          </span>
          {initialX !== undefined && initialY !== undefined && (
            <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono font-bold text-amber-300">
              [{initialX}, {initialY}]
            </span>
          )}
        </div>
      </header>

      {/* Carte interactive plein écran autonome — mode public */}
      <main className="flex-1 relative w-full h-full min-h-0 overflow-hidden">
        <MapViewer
          initialTab="map"
          initialX={initialX}
          initialY={initialY}
          initialZoom={initialZoom}
          initialWorldId={initialWorldId}
          startFullscreen={false}
          hideUI={false}
          isOverlay={true}
          isPublic={true}
        />
      </main>
    </div>
  );
}
