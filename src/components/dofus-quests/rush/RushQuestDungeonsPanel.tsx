"use client";

/**
 * **Donjons de la quête** — panneau ouvert depuis la pastille `Donjon ×N`.
 *
 * 🎯 Demande user (21/10/2026) : « au clic sur l'icône donjon, la mini modale reste
 * ouverte (avec une croix de fermeture) avec une 2ᵉ coche à côté de chaque donjon :
 * fait / à faire » — **dans la quête**, jamais un onglet global dans la barre.
 *
 * Ce composant ne porte que le cadre (titre + compteur + croix) : la liste et les deux
 * coches viennent de `RushOverlayDungeonCard`, partagée avec la fiche détail de l'overlay.
 * Il est consommé par les **trois** surfaces (overlay interne et public, dashboard, guide
 * public) : même rendu, même règle, seule la persistance change.
 *
 * Clé **par occurrence** : l'état lu/écrit vaut pour `seq.id` × `dungeonKey` uniquement.
 */

import { useMemo } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDungeons } from "@/app/overlay/guide/[guildId]/[slug]/components/overlay-utils";
import { RushOverlayDungeonCard } from "@/app/overlay/guide/[guildId]/[slug]/components/RushOverlayDungeonCard";
import {
  doneDungeonKeysForSequence,
  sequenceDungeonProgress,
  type RushDungeonMemberState,
  type RushDungeonState,
  type RushDungeonStateMap,
} from "@/lib/rush-dungeons";
import type { RushSequence } from "@/types/rush-guide-types";

export function RushQuestDungeonsPanel({
  seq,
  guildId,
  states,
  busyKey = null,
  others = [],
  onSet,
  onClose,
  footer,
  className,
  highlightKey = null,
}: {
  /** La quête concernée — la coche ne vaut QUE pour elle. */
  seq: RushSequence;
  /** Guilde de la surface (détermine la fiche du donjon) ; `public` côté guide public. */
  guildId?: string;
  states: RushDungeonStateMap;
  busyKey?: string | null;
  others?: RushDungeonMemberState[];
  /** Sans ce callback, le panneau reste en lecture seule. */
  onSet?: (sequenceId: string, dungeonKey: string, state: RushDungeonState | null) => void;
  onClose: () => void;
  /** Action de surface (ex. « chercher un groupe ») — jamais une duplication de règle. */
  footer?: React.ReactNode;
  className?: string;
  /** Donjon à mettre en avant à l'ouverture (clic sur son icône dans la ligne de quête). */
  highlightKey?: string | null;
}) {
  const dungeons = useMemo(() => getDungeons(seq), [seq]);
  const progress = useMemo(
    () => sequenceDungeonProgress(seq, doneDungeonKeysForSequence(states, seq.id)),
    [seq, states]
  );

  return (
    <div
      role="group"
      aria-label="Donjons de cette quête"
      className={cn(
        "rounded-[4px] border border-border bg-surface p-2.5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-muted-foreground">
            Donjons de la quête · {progress.done}/{progress.total} fait{progress.done > 1 ? "s" : ""}
            {progress.missingRequired.length > 0 ? (
              <span className="text-warning">
                {` · ${progress.missingRequired.length} requis restant${progress.missingRequired.length > 1 ? "s" : ""}`}
              </span>
            ) : null}
          </p>
          {/* La progression en une barre : c'est la donnée qui « donne envie » de finir,
              pas une décoration. Ambre tant qu'il manque un requis, vert ensuite. */}
          <div
            className="mt-1 h-1 w-full overflow-hidden rounded-[2px] bg-elevated"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={Math.max(progress.total, 1)}
            aria-valuenow={progress.done}
            aria-label="Donjons faits dans cette quête"
          >
            <div
              className={cn(
                "h-full transition-all",
                progress.missingRequired.length > 0 ? "bg-warning" : "bg-emerald-500"
              )}
              style={{
                width: `${progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer les donjons de cette quête"
          title="Fermer"
          className="shrink-0 rounded-[3px] p-0.5 text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <RushOverlayDungeonCard
        dungeons={dungeons}
        guildId={guildId}
        hideHeader
        className="mt-1.5 border-0 bg-transparent p-0"
        sequenceId={seq.id}
        states={states}
        busyKey={busyKey}
        others={others}
        highlightKey={highlightKey}
        onSet={onSet ? (dungeonKey, state) => onSet(seq.id, dungeonKey, state) : undefined}
      />

      {footer ? <div className="mt-1.5 border-t border-border pt-1.5">{footer}</div> : null}
    </div>
  );
}
