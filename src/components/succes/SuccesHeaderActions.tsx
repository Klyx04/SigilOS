"use client";

import Link from "next/link";
import { BookOpen, CircleHelp, Database, ExternalLink, PictureInPicture2 } from "lucide-react";
import { useBossOverlay } from "@/hooks/use-boss-overlay";
import { useDocDrawer } from "@/components/doc/doc-drawer-context";
import { useTour } from "@/components/tour/tour-provider";
import { cn } from "@/lib/utils";

interface SuccesHeaderActionsProps {
  guildId: string;
}

export function SuccesHeaderActions({ guildId }: SuccesHeaderActionsProps) {
  const { openBossOverlay, isOpen: isPipOpen } = useBossOverlay(guildId);
  const { openDoc } = useDocDrawer();

  let tourContext: ReturnType<typeof useTour> | null = null;
  try {
    tourContext = useTour();
  } catch {
    // Safe fallback si hors TourProvider
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* 1. SOURCES COMMUNAUTAIRES */}
      <div className="inline-flex items-center h-8 px-2 rounded-xl border border-border bg-surface/60 backdrop-blur-xs gap-1">
        {/* DofusDB */}
        <Link
          href="https://dofusdb.fr"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-elevated text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          title="DofusDB — Encyclopédie, quêtes & succès"
        >
          <img
            src="/assets/icons/dofusdb.png"
            alt="DofusDB"
            className="w-3.5 h-3.5 rounded-xs object-contain shrink-0"
          />
          <span className="text-[11px]">DofusDB</span>
          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
        </Link>

        <div className="h-3.5 w-px bg-border/80 mx-0.5" />

        {/* Dofensive */}
        <Link
          href="https://dofensive.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-elevated text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          title="Dofensive — Fiches tactiques & sorts de boss"
        >
          <img
            src="/assets/icons/dofensive.ico"
            alt="Dofensive"
            className="w-3.5 h-3.5 rounded-xs object-contain shrink-0"
          />
          <span className="text-[11px]">Dofensive</span>
          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
        </Link>
      </div>

      {/* 2. BOUTON DOCUMENTATION */}
      <button
        type="button"
        onClick={() => openDoc("succes", "Succès & Donjons")}
        title="Ouvrir la documentation des succès"
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl border border-border bg-surface/60 hover:bg-elevated text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <BookOpen className="w-3.5 h-3.5 text-teal-400 shrink-0" />
        <span>Documentation</span>
      </button>

      {/* 3. BOUTON TUTORIEL */}
      {tourContext && (
        <button
          type="button"
          onClick={() => tourContext?.startTour("succes")}
          title="Lancer le tutoriel interactif du module succès"
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl border border-border bg-surface/60 hover:bg-elevated text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <CircleHelp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span>Tutoriel</span>
        </button>
      )}

      {/* 4. ⭐ BOUTON ENCYCLOPÉDIE OVERLAY */}
      <button
        type="button"
        onClick={() => openBossOverlay()}
        title="Ouvrir l'Encyclopédie Boss en fenêtre flottante (Overlay)"
        className={cn(
          "relative inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-bold transition-all duration-150",
          isPipOpen
            ? "border border-amber-400 bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/40"
            : "border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200"
        )}
      >
        <PictureInPicture2 className="w-3.5 h-3.5 text-amber-400" />
        <span>Encyclopédie Overlay</span>
        {isPipOpen && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
        )}
      </button>
    </div>
  );
}
