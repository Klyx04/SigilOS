"use client";

import React, { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { useDaTheme } from "@/components/da/da-theme";
import { cn } from "@/lib/utils";
import type { DungeonInfo } from "./overlay-utils";
import { RushQuestDungeonsPanel } from "@/components/dofus-quests/rush/RushQuestDungeonsPanel";
import {
  doneDungeonKeysForSequence,
  sequenceDungeonProgress,
  type RushDungeonMemberState,
  type RushDungeonState,
  type RushDungeonStateMap,
} from "@/lib/rush-dungeons";
import type { RushSequence } from "@/types/rush-guide-types";

/**
 * RushOverlayDungeonPopover — la pastille donjon d'une quête ouvre, **AU CLIC**, une
 * petite **modale centrée** dans la fenêtre de l'overlay : chaque donjon porte ses deux
 * coches (`Fait` / `À faire`) et reste un lien vers sa fiche.
 *
 * Deux choix dictés par la PiP :
 *   · **portail dans le document DU NŒUD** (`ownerDocument`, jamais `document`) : dans
 *     un bundle JS, `document` reste la page principale ; la popover s'y montait donc
 *     « n'importe où » hors de la PiP (mesure du 21/09/2026) ;
 *   · **modale centrée** plutôt qu'ancrée au pixel : la largeur utile d'une PiP est
 *     faible, une popover ancrée sortait de la fenêtre. Le cadre pulse quand il reste
 *     un donjon requis.
 */
export function RushOverlayDungeonPopover({
  seq,
  dungeons,
  guildId,
  states = {},
  busyKey = null,
  others = [],
  onSet,
  onEnsureLoaded,
  open: openProp,
  onOpenChange,
  targetKey = null,
  capturedOcreNames,
  onOpenOcre,
  onOpenAchievements,
  children,
}: {
  /** La quête de la ligne — porte l'identité de l'occurrence. */
  seq: RushSequence;
  /** Les donjons de la quête — extraits une seule fois par l'appelant (`getDungeons`). */
  dungeons: DungeonInfo[];
  /** Guilde de la surface : la carte donjon en déduit la bonne page (publique ou module). */
  guildId?: string;
  states?: RushDungeonStateMap;
  busyKey?: string | null;
  others?: RushDungeonMemberState[];
  onSet?: (sequenceId: string, dungeonKey: string, state: RushDungeonState | null) => void;
  /** Chargement paresseux des états (une requête, à la première ouverture). */
  onEnsureLoaded?: () => void;
  /**
   * Ouverture **contrôlée** : les icônes des donjons manquants de la ligne de quête
   * ouvrent CETTE modale en ciblant leur donjon. Sans cette prop, l'état reste interne.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Donjon à mettre en avant à l'ouverture. */
  targetKey?: string | null;
  /** V-H — noms des monstres déjà capturés (Metamob) ; absent ⇒ état inconnu. */
  capturedOcreNames?: readonly string[];
  /** V-H — ouvre la fenêtre Ocre depuis un donjon ocre. */
  onOpenOcre?: () => void;
  /** Bloc I — ouvre les succès du donjon (requis + résolu uniquement). */
  onOpenAchievements?: (dungeonKey: string, dungeon: DungeonInfo) => void;
  children: React.ReactNode;
}) {
  const da = useDaTheme();
  const theme = da?.theme ?? "dark";
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = openProp ?? internalOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      if (openProp === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange]
  );
  const triggerRef = React.useRef<HTMLSpanElement>(null);
  // Document du nœud : celui de la PiP quand l'overlay y tourne.
  const portalDoc = triggerRef.current?.ownerDocument ?? null;
  const progress = sequenceDungeonProgress(
    seq,
    doneDungeonKeysForSequence(states, seq.id),
  );
  const missing = progress.missingBlocks > 0;

  const open = useCallback(() => {
    onEnsureLoaded?.();
    setOpen(true);
  }, [onEnsureLoaded, setOpen]);

  const toggle = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (isOpen) {
        setOpen(false);
        return;
      }
      open();
    },
    [isOpen, open, setOpen]
  );

  // Aucun donjon à montrer : le badge se rend tel quel, sans modale vide.
  if (dungeons.length === 0) return <>{children}</>;

  return (
    <span ref={triggerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-label="Donjons de cette quête (fait / à faire)"
        className="inline-flex"
      >
        {children}
      </button>

      {isOpen &&
        portalDoc &&
        createPortal(
          <div
            className={cn(
              "rush-carnet-theme fixed inset-0 z-[999999] flex items-center justify-center bg-black/60 p-3",
              theme === "light" && "light",
            )}
            data-theme={theme}
            onClick={() => setOpen(false)}
            role="presentation"
          >
            <div
              onClick={(event) => event.stopPropagation()}
              className={cn(
                "rush-carnet overlay-scroll max-h-[calc(100dvh-1.5rem)] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-[6px] bg-elevated p-1.5",
                missing && "border-danger/60 animate-pulse motion-reduce:animate-none",
              )}
            >
              <RushQuestDungeonsPanel
                seq={seq}
                guildId={guildId}
                states={states}
                busyKey={busyKey}
                others={others}
                highlightKey={targetKey}
                onSet={onSet}
                capturedOcreNames={capturedOcreNames}
                onOpenOcre={onOpenOcre}
                onOpenAchievements={onOpenAchievements}
                onClose={() => setOpen(false)}
                className="border-0 bg-transparent p-0"
              />
            </div>
          </div>,
          portalDoc.body,
        )}
    </span>
  );
}
