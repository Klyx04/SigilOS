"use client";

/**
 * **Donjons du guide** — coquille de modale, **présentation pure**.
 *
 * Elle porte l'unique rendu de la fenêtre (recherche + liste) utilisé par les
 * surfaces : overlay interne, dashboard membre et guide public. Aucune persistance,
 * aucun import serveur : l'état arrive par props (`states`) et chaque geste remonte
 * par `onSet`. C'est ce qui permet au public de brancher le `localStorage` sans
 * copier un seul pixel de cette fenêtre.
 *
 * La liste elle-même est `RushDungeonList` (état **par occurrence**).
 */

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import {
  applyDungeonStates,
  buildDungeonIndex,
  type RushDungeonState,
  type RushDungeonStateMap,
} from "@/lib/rush-dungeons";
import type { RushMilestone } from "@/types/rush-guide-types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RushDungeonList, type RushDungeonMemberState } from "./RushDungeonList";

export function RushDungeonsModalShell({
  milestones,
  states,
  others,
  busyKey,
  loading = false,
  note,
  onSet,
  onClose,
}: {
  /** Tous les blocs du guide : l'index est construit ici, à partir de la règle partagée. */
  milestones: RushMilestone[];
  /** États de CE joueur, clé = `sequenceId::dungeonKey`. */
  states: RushDungeonStateMap;
  /** États des autres membres (entraide) — vide côté public. */
  others: RushDungeonMemberState[];
  /** Occurrence en cours d'écriture (`sequenceId::dungeonKey`). */
  busyKey: string | null;
  loading?: boolean;
  /** Précision affichée sous le titre (ex. « enregistré dans ce navigateur »). */
  note?: string;
  onSet: (sequenceId: string, dungeonKey: string, state: RushDungeonState | null) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  const index = useMemo(() => buildDungeonIndex(milestones), [milestones]);

  const entries = useMemo(() => {
    const withState = applyDungeonStates(index, states);
    const q = query.trim().toLowerCase();
    return q ? withState.filter((entry) => entry.name.toLowerCase().includes(q)) : withState;
  }, [index, states, query]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[min(34rem,calc(100vw-2rem))] overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="text-sm">Donjons du guide</DialogTitle>
          {note ? <p className="mt-0.5 text-[10px] text-muted-foreground">{note}</p> : null}
        </DialogHeader>
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Chercher un donjon…"
            aria-label="Chercher un donjon"
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Effacer la recherche">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-4">
          {loading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Chargement…</p>
          ) : (
            <RushDungeonList entries={entries} others={others} busyKey={busyKey} onSet={onSet} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
