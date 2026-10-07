"use client";

import React, { useRef, useState } from "react";
import { Copy, Check, MapPin } from "lucide-react";
import { parseCoordinates } from "@/lib/rush-guide-utils";
import { buildZaapTravelCommand } from "@/lib/travel-command";
import { copyToClipboard } from "@/lib/clipboard";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RushCoordinateChipProps {
  coordText: string;
  className?: string;
  showIcon?: boolean;
  /**
   * Bouton zaap façon dofuspourlesnoobs (client 3.7) : une icône zaap à côté
   * de la position, qui copie `/zaap x,y ; /travel x,y` (zaap le plus proche
   * du **même monde**). Résolution lazy au survol — aucun appel tant que le
   * visiteur ne s'intéresse pas à la position — et bouton affiché seulement
   * si le détour zaap est possible (`sameWorld`, commande 3.7 oblige).
   */
  showZaap?: boolean;
  onOpenMap?: (x: number, y: number, worldId?: number) => void;
}

/** Zaap le plus proche (forme servie par `resolveMapWorldAction`). */
interface ChipZaap {
  name: string;
  x: number;
  y: number;
  sameWorld: boolean;
}

export function RushCoordinateChip({
  coordText,
  className,
  showIcon = false,
  showZaap = false,
  onOpenMap,
}: RushCoordinateChipProps) {
  const [copied, setCopied] = useState(false);
  const [copiedZaap, setCopiedZaap] = useState(false);
  const [zaap, setZaap] = useState<ChipZaap | null>(null);
  const [zaapState, setZaapState] = useState<"idle" | "loading" | "ready" | "none">("idle");
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parsed = parseCoordinates(coordText);

  if (!parsed) {
    return <span className={className}>{coordText}</span>;
  }

  const scheduleZaapResolve = () => {
    if (!showZaap || zaapState !== "idle") return;
    hoverTimerRef.current = setTimeout(() => {
      setZaapState("loading");
      import("@/server/actions/optimized-guide-actions").then((mod) => {
        mod.resolveMapWorldAction(parsed.x, parsed.y).then((res) => {
          if (res.success && res.nearestZaap?.sameWorld) {
            setZaap({
              name: res.nearestZaap.name,
              x: res.nearestZaap.x,
              y: res.nearestZaap.y,
              sameWorld: true,
            });
            setZaapState("ready");
          } else {
            // Monde sans zaap ou position non résolue : pas de bouton
            // (DPLN n'affiche son icône que quand le détour vaut le coup).
            setZaapState("none");
          }
        }).catch(() => setZaapState("none"));
      }).catch(() => setZaapState("none"));
    }, 400);
  };

  const cancelZaapResolve = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Fallback execCommand : en overlay (webview/PiP) `navigator.clipboard`
    // peut réussir l'appel mais échouer silencieusement → on vérifie le retour.
    const ok = await copyToClipboard(parsed.travelCommand);
    if (!ok) {
      toast.error("Copie impossible", {
        description: `Sélectionne et copie manuellement : ${parsed.travelCommand}`,
        duration: 3000,
      });
      return;
    }
    setCopied(true);
    toast.success(`Copié : ${parsed.travelCommand}`, {
      description: "Colle cette commande dans le chat Dofus pour te déplacer.",
      duration: 2500,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyZaap = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!zaap) return;
    const cmd = buildZaapTravelCommand(zaap, { x: parsed.x, y: parsed.y });
    if (!cmd) return;
    const ok = await copyToClipboard(cmd);
    if (!ok) {
      toast.error("Copie impossible", {
        description: `Sélectionne et copie manuellement : ${cmd}`,
        duration: 3000,
      });
      return;
    }
    setCopiedZaap(true);
    toast.success(`Copié : ${cmd}`, {
      description: `Téléportation au zaap ${zaap.name}, puis trajet jusqu'à la position.`,
      duration: 3000,
    });
    setTimeout(() => setCopiedZaap(false), 2000);
  };

  return (
    <span
      className="inline-flex items-center gap-1"
      onMouseEnter={scheduleZaapResolve}
      onMouseLeave={cancelZaapResolve}
    >
      <button
        type="button"
        onClick={handleCopy}
        title={`Cliquer pour copier ${parsed.travelCommand}`}
        aria-label={`Copier la commande ${parsed.travelCommand}`}
        className={cn(
          "inline-flex cursor-pointer select-none items-center gap-1.5 rounded-[3px] border border-border bg-surface px-1.5 py-0.5",
          "font-mono text-[11px] font-semibold tabular-nums text-muted-foreground transition-colors",
          "hover:border-border-strong hover:text-foreground",
          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
          className
        )}
      >
        {showIcon && <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />}
        <span>{parsed.raw}</span>
        {copied ? (
          <Check className="h-3 w-3 shrink-0 text-success" aria-hidden="true" />
        ) : (
          <Copy className="h-3 w-3 shrink-0 text-subtle-foreground" aria-hidden="true" />
        )}
      </button>
      {showZaap && zaapState === "ready" && zaap && (
        <button
          type="button"
          onClick={handleCopyZaap}
          title={`Copier la téléportation au zaap ${zaap.name} + le trajet (${`/zaap ${zaap.x},${zaap.y} ; /travel ${parsed.x},${parsed.y}`})`}
          aria-label={`Copier zaap ${zaap.name} puis trajet jusqu'à ${parsed.raw}`}
          className={cn(
            "inline-flex cursor-pointer select-none items-center gap-1 rounded-[3px] border border-info/30 bg-info/10 px-1.5 py-0.5",
            "transition-colors hover:bg-info/20",
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/dofus/icons/zaap.png" alt="" className="h-3.5 w-3.5 shrink-0 object-contain" loading="lazy" />
          {copiedZaap ? (
            <Check className="h-3 w-3 shrink-0 text-success" aria-hidden="true" />
          ) : (
            <Copy className="h-3 w-3 shrink-0 text-info" aria-hidden="true" />
          )}
        </button>
      )}
    </span>
  );
}
