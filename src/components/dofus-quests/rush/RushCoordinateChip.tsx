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
  );
}
