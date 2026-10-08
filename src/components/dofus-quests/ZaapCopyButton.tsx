"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { buildTravelCommand, buildManualZaapTravelCommand, buildZaapTravelCommand } from "@/lib/travel-command";
import { copyToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

interface ZaapCopyButtonProps {
  x: number;
  y: number;
  /** Zaap **manuel** (saisie God) : prioritaire sur la résolution auto. */
  zaapX?: number | null;
  zaapY?: number | null;
  className?: string;
}

/**
 * Bouton zaap façon dofuspourlesnoobs (client 3.7) : copie
 * `/zaap x,y ; /travel x,y`.
 * - Si `zaapX/zaapY` sont fournis (saisie God manuelle), la commande est
 *   copiée telle quelle (c'est le God qui a jugé le détour intéressant).
 * - Sinon, résout le zaap le plus proche du **même monde** puis copie la
 *   combinée. Sans zaap dans ce monde : repli honnête sur `/travel x,y`.
 */
export function ZaapCopyButton({ x, y, zaapX, zaapY, className }: ZaapCopyButtonProps) {
  const [busy, setBusy] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const manual = buildManualZaapTravelCommand(zaapX, zaapY, x, y);
      if (manual) {
        const ok = await copyToClipboard(manual);
        if (!ok) {
          toast.error("Copie impossible", {
            description: `Sélectionne et copie manuellement : ${manual}`,
            duration: 3000,
          });
          return;
        }
        toast.success(`Copié : ${manual}`, {
          description: "Téléportation au zaap saisi en God, puis trajet jusqu'à la position.",
          duration: 3000,
        });
        return;
      }
      const mod = await import("@/server/actions/optimized-guide-actions");
      const res = await mod.resolveMapWorldAction(x, y);
      const combined = res.success
        ? buildZaapTravelCommand(res.nearestZaap, { x, y })
        : null;
      const cmd = combined ?? buildTravelCommand({ x, y });
      if (!cmd) {
        toast.error("Position inexploitable");
        return;
      }
      const ok = await copyToClipboard(cmd);
      if (!ok) {
        toast.error("Copie impossible", {
          description: `Sélectionne et copie manuellement : ${cmd}`,
          duration: 3000,
        });
        return;
      }
      toast.success(`Copié : ${cmd}`, {
        description: combined
          ? "Téléportation au zaap le plus proche, puis trajet jusqu'à la position."
          : "Aucun zaap dans ce monde — trajet direct.",
        duration: 3000,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-label={`Copier la téléportation zaap puis le trajet jusqu'à ${x},${y}`}
      title="Copier /zaap (le plus proche) + /travel (client 3.7)"
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg border border-info/25 bg-info/10 hover:bg-info/20 font-mono text-info font-bold transition-colors",
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/dofus/icons/zaap.png" alt="" className="h-3 w-3 object-contain" loading="lazy" />
      <span className="text-[10px] font-black uppercase tracking-wider">Zaap</span>
    </button>
  );
}
