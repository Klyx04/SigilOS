"use client";

import React, { useState } from "react";
import { Copy, Check, MapPin } from "lucide-react";
import { toast } from "sonner";
import { parseCoordinates } from "@/lib/rush-guide-utils";
import { copyToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

interface RushCoordinateChipProps {
  coordText: string;
  className?: string;
  showIcon?: boolean;
  onOpenMap?: (x: number, y: number, worldId?: number) => void;
}

export function RushCoordinateChip({
  coordText,
  className,
  showIcon = false,
  onOpenMap,
}: RushCoordinateChipProps) {
  const [copied, setCopied] = useState(false);
  const parsed = parseCoordinates(coordText);

  if (!parsed) {
    return <span className={className}>{coordText}</span>;
  }

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

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Cliquer pour copier ${parsed.travelCommand}`}
      aria-label={`Copier la commande ${parsed.travelCommand}`}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-[11px] font-bold transition-all duration-150 cursor-pointer select-none",
        "bg-info/10 hover:bg-info/20 text-info border border-info/25 hover:border-info/50 shadow-sm",
        "focus-visible:outline-2 focus-visible:outline-info focus-visible:outline-offset-1",
        className
      )}
    >
      {showIcon && <MapPin className="w-3 h-3 text-info shrink-0" />}
      <span>{parsed.raw}</span>
      {copied ? (
        <Check className="w-3 h-3 text-success shrink-0 animate-in zoom-in-50 duration-150" />
      ) : (
        <Copy className="w-3 h-3 text-info/70 shrink-0" />
      )}
    </button>
  );
}
