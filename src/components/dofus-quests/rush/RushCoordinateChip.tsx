"use client";

import React, { useRef, useState } from "react";
import { Check } from "lucide-react";
import { parseCoordinates } from "@/lib/rush-guide-utils";
import { buildManualZaapTravelCommand, buildZaapTravelCommand } from "@/lib/travel-command";
import { copyToClipboard } from "@/lib/clipboard";
import { RushPositionMenu } from "./RushPositionMenu";
import { useOverlayToast } from "@/components/rush/overlay-toast";
import { cn } from "@/lib/utils";

/**
 * Picto de POSITION du jeu : l'icône du module « Carte du monde » de Dofus
 * (`/assets/dofus/modules/map.png`, la même image que `nav/map.png`).
 *
 * Mesuré coloré (62×62, RGB moyen 130/118/88, alpha 106) ⇒ lisible en thème sombre ET clair,
 * contrairement au picto `copy.png` de l'interface du jeu (44×44, RGB 225, alpha 83) qui
 * disparaîtrait sur une surface claire. Il remplace le carré `Copy` de Lucide (retour user
 * du 08/10/2026 : « fin des carrés de copie génériques »).
 */
function PositionPicto({ className }: { className?: string }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/assets/dofus/modules/map.png"
      alt=""
      aria-hidden="true"
      className={cn("h-3 w-3 shrink-0 object-contain", className)}
    />
  );
}

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
  /**
   * Zaap **manuel** saisi en God (`pos_tags.zaapX/zaapY`) : prioritaire sur
   * le zaap auto le plus proche — le bouton s'affiche aussitôt, sans
   * résolution au survol.
   */
  manualZaap?: { x: number; y: number } | null;
  onOpenMap?: (x: number, y: number, worldId?: number) => void;
  /** Deux etapes au clic (guide public) : ouvrir le menu au lieu de copier. */
  menuOnClick?: boolean;
  /** Icône seule (barre compacte de l'overlay) : la position reste en infobulle. */
  iconOnly?: boolean;
  /** PNJ donneur de la quete : affiche dans le menu (nom + portrait) et sur la carte. */
  npc?: { id?: number | null; name?: string | null; imageUrl?: string | null } | null;
  /** Carte HD imposee en God (`pos_tags.mapId`). */
  mapId?: number | null;
  /**
   * Monde du `pos_tags` (`worldId`) : le texte `[x,y]` ne le porte pas. Il prime
   * sur le monde éventuellement écrit dans le texte (`[x,y,world]`), et sert au
   * menu carte **et** au zaap le plus proche.
   */
  worldId?: number | null;
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
  manualZaap = null,
  onOpenMap,
  menuOnClick = false,
  iconOnly = false,
  npc = null,
  mapId = null,
  worldId = null,
}: RushCoordinateChipProps) {
  const toast = useOverlayToast();
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copiedZaap, setCopiedZaap] = useState(false);
  const [zaap, setZaap] = useState<ChipZaap | null>(null);
  const [zaapState, setZaapState] = useState<"idle" | "loading" | "ready" | "none">("idle");
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Document PORTEUR de la puce : dans la fenetre PiP, le `document` du module est celui
  // de l onglet principal (non focalise) et `execCommand` echoue. On cible le bon document.
  const rootRef = useRef<HTMLSpanElement>(null);
  const parsed = parseCoordinates(coordText);

  if (!parsed) {
    return <span className={className}>{coordText}</span>;
  }

  // Le monde vit à côté du texte (`pos_tags.worldId`) : `[x,y]` ne le porte pas.
  // L'appelant prime, sinon on garde le monde éventuellement écrit (`[x,y,world]`).
  const resolvedWorldId =
    typeof worldId === "number" && Number.isSafeInteger(worldId) && worldId > 0
      ? worldId
      : parsed.worldId;

  const hasManualZaap =
    !!manualZaap &&
    Number.isSafeInteger(manualZaap.x) &&
    Number.isSafeInteger(manualZaap.y);

  const scheduleZaapResolve = () => {
    if (!showZaap || hasManualZaap || zaapState !== "idle") return;
    hoverTimerRef.current = setTimeout(() => {
      setZaapState("loading");
      import("@/server/actions/optimized-guide-actions").then((mod) => {
        mod.resolveMapWorldAction(parsed.x, parsed.y, undefined, resolvedWorldId ?? null).then((res) => {
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
    if (menuOnClick) {
      setMenuOpen(true);
      return;
    }
    // Fallback execCommand : en overlay (webview/PiP) `navigator.clipboard`
    // peut réussir l'appel mais échouer silencieusement → on vérifie le retour.
    const ok = await copyToClipboard(parsed.travelCommand, rootRef.current?.ownerDocument);
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
    setTimeout(() => setCopied(false), 900);
  };

  const handleCopyZaap = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Zaap manuel God : copié tel quel (décision éditoriale).
    if (
      manualZaap &&
      Number.isSafeInteger(manualZaap.x) &&
      Number.isSafeInteger(manualZaap.y)
    ) {
      const cmd = buildManualZaapTravelCommand(manualZaap.x, manualZaap.y, parsed.x, parsed.y);
      if (!cmd) return;
      const ok = await copyToClipboard(cmd, rootRef.current?.ownerDocument);
      if (!ok) {
        toast.error("Copie impossible", {
          description: `Sélectionne et copie manuellement : ${cmd}`,
          duration: 3000,
        });
        return;
      }
      setCopiedZaap(true);
      toast.success(`Copié : ${cmd}`, {
        description: "Téléportation au zaap saisi en God, puis trajet jusqu'à la position.",
        duration: 3000,
      });
      setTimeout(() => setCopiedZaap(false), 2000);
      return;
    }
    if (!zaap) return;
    const cmd = buildZaapTravelCommand(zaap, { x: parsed.x, y: parsed.y });
    if (!cmd) return;
    const ok = await copyToClipboard(cmd, rootRef.current?.ownerDocument);
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

  if (iconOnly) {
    return (
      <>
        <span
          ref={rootRef}
          className="inline-flex"
          onMouseEnter={scheduleZaapResolve}
          onMouseLeave={cancelZaapResolve}
        >
          <button
            type="button"
            onClick={handleCopy}
            data-copied={copied ? "true" : undefined}
            title={`Position ${parsed.raw}`}
            aria-label={`Position ${parsed.raw} : copier ou voir la carte`}
            className={cn(
              "inline-flex h-6 w-6 items-center justify-center rounded-[3px] text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
              className
            )}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
            ) : (
              <PositionPicto className="h-3.5 w-3.5" />
            )}
          </button>
        </span>
        {menuOnClick && (
          <RushPositionMenu
            open={menuOpen}
            npc={npc}
            mapId={mapId}
            x={parsed.x}
            y={parsed.y}
            worldId={resolvedWorldId ?? null}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
    <span
      ref={rootRef}
      className="inline-flex items-center gap-1"
      onMouseEnter={scheduleZaapResolve}
      onMouseLeave={cancelZaapResolve}
    >
      <button
        type="button"
        onClick={handleCopy}
        data-copied={copied ? "true" : undefined}
        title={menuOnClick ? "Copier la position ou voir la carte" : `Cliquer pour copier ${parsed.travelCommand}`}
        aria-label={menuOnClick ? `Position ${parsed.raw} : copier ou voir la carte` : `Copier la commande ${parsed.travelCommand}`}
        className={cn(
          "da-coord",
          "inline-flex cursor-pointer select-none items-center gap-1.5 rounded-[3px] border border-border bg-surface px-1.5 py-0.5",
          "font-mono text-[11px] font-semibold tabular-nums text-muted-foreground transition-colors",
          "hover:border-border-strong hover:text-foreground",
          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
          className
        )}
      >
        {showIcon && <PositionPicto />}
        <span>{parsed.raw}</span>
        {/* Le picto est posé UNE seule fois : à gauche quand l'appelant demande l'icône
            (`showIcon`), sinon dans la fente de copie — jamais deux fois. */}
        {copied ? (
          <Check className="h-3 w-3 shrink-0 text-success" aria-hidden="true" />
        ) : !showIcon ? (
          <PositionPicto className="opacity-70" />
        ) : null}
      </button>
      {showZaap && (hasManualZaap || (zaapState === "ready" && zaap)) && (
        <button
          type="button"
          onClick={handleCopyZaap}
          title={
            hasManualZaap && manualZaap
              ? `Copier la téléportation au zaap saisi en God + le trajet (${`/zaap ${manualZaap.x},${manualZaap.y} ; /travel ${parsed.x},${parsed.y}`})`
              : `Copier la téléportation au zaap ${zaap!.name} + le trajet (${`/zaap ${zaap!.x},${zaap!.y} ; /travel ${parsed.x},${parsed.y}`})`
          }
          aria-label={
            hasManualZaap
              ? `Copier zaap manuel puis trajet jusqu'à ${parsed.raw}`
              : `Copier zaap ${zaap!.name} puis trajet jusqu'à ${parsed.raw}`
          }
          className={cn(
            "inline-flex cursor-pointer select-none items-center gap-1 rounded-[3px] border border-info/30 bg-info/10 px-1.5 py-0.5",
            "transition-colors hover:bg-info/20",
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/dofus/icons/zaap.png" alt="" className="h-3.5 w-3.5 shrink-0 object-contain" loading="lazy" />
          {copiedZaap && <Check className="h-3 w-3 shrink-0 text-success" aria-hidden="true" />}
        </button>
      )}
    </span>
    {menuOnClick && (
      <RushPositionMenu
        open={menuOpen}
        npc={npc}
        mapId={mapId}
        x={parsed.x}
        y={parsed.y}
        worldId={resolvedWorldId ?? null}
        onClose={() => setMenuOpen(false)}
      />
    )}
    </>
  );
}
