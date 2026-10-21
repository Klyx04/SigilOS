"use client";

/**
 * États MANUELS des donjons du Rush — **persistance guilde** (Server Actions).
 *
 * Deux modes, pour ne payer la requête que là où elle sert :
 *  · **eager** (dashboard) : chargé au montage, parce que la surface doit verrouiller
 *    une validation AVANT l'aller-retour serveur ;
 *  · **lazy** (overlay) : chargé à la première ouverture de la fenêtre « Donjons ».
 *
 * Le verrou reste **serveur** (`setRushSequenceProgress` / `toggleMilestoneProgress`) :
 * ce hook ne fait qu'anticiper le refus et refléter l'état, jamais l'autoriser.
 * La clé est **par occurrence** (`sequenceId::dungeonKey`).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getRushDungeonStates, setRushDungeonState } from "@/server/actions/optimized-guide-actions";
import { dungeonOccurrenceKey, type RushDungeonState } from "@/lib/rush-dungeons";
import type { RushDungeonMemberState } from "@/lib/rush-dungeons";

export type RushDungeonStatesHandle = {
  /** États de ce joueur, clé = `sequenceId::dungeonKey`. */
  states: Record<string, RushDungeonState>;
  /** États des autres membres de la guilde (entraide « à faire »). */
  others: RushDungeonMemberState[];
  loading: boolean;
  busyKey: string | null;
  setState: (
    sequenceId: string,
    dungeonKey: string,
    state: RushDungeonState | null
  ) => Promise<void>;
  /** Charge une fois (idempotent) — utile en mode `lazy`. */
  ensureLoaded: () => Promise<void>;
};

export function useRushDungeonStates({
  guildId,
  slug,
  altPseudo,
  lazy = false,
}: {
  guildId: string;
  slug: string;
  /** Personnage (mule) dont on lit les coches ; absent = personnage principal. */
  altPseudo?: string;
  lazy?: boolean;
}): RushDungeonStatesHandle {
  const [states, setStates] = useState<Record<string, RushDungeonState>>({});
  const [others, setOthers] = useState<RushDungeonMemberState[]>([]);
  const [loading, setLoading] = useState(!lazy);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Un changement de guide ou de personnage change l'emplacement : on recharge.
  const scope = `${guildId}::${slug}::${altPseudo ?? ""}`;
  const loadedScope = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (loadedScope.current === scope) return;
    loadedScope.current = scope;
    setLoading(true);
    try {
      const res = await getRushDungeonStates(guildId, slug, altPseudo);
      if (res.success) {
        setStates(res.mine);
        setOthers(res.others);
      } else {
        loadedScope.current = null; // une prochaine demande pourra réessayer
        toast.error(res.error || "États des donjons indisponibles");
      }
    } catch {
      loadedScope.current = null;
      toast.error("États des donjons indisponibles");
    } finally {
      setLoading(false);
    }
  }, [guildId, slug, altPseudo, scope]);

  useEffect(() => {
    setStates({});
    setOthers([]);
  }, [scope]);

  useEffect(() => {
    if (!lazy) void load();
  }, [lazy, load]);

  const ensureLoaded = useCallback(() => load(), [load]);

  const setState = useCallback(
    async (sequenceId: string, dungeonKey: string, state: RushDungeonState | null) => {
      const occurrenceKey = dungeonOccurrenceKey(sequenceId, dungeonKey);
      const previousValue = states[occurrenceKey];
      setBusyKey(occurrenceKey);
      setStates((current) => {
        const next = { ...current };
        if (state === null) delete next[occurrenceKey];
        else next[occurrenceKey] = state;
        return next;
      });

      try {
        const wire = state === "done" ? "DONE" : state === "todo" ? "TODO" : null;
        const res = await setRushDungeonState(guildId, slug, sequenceId, dungeonKey, wire, altPseudo);
        if (!res.success) {
          // Retour arrière CIBLÉ : on ne touche qu'à cette occurrence (les autres
          // écritures en cours ne sont pas écrasées par un rollback global).
          setStates((current) => {
            const next = { ...current };
            if (previousValue === undefined) delete next[occurrenceKey];
            else next[occurrenceKey] = previousValue;
            return next;
          });
          toast.error(res.error || "Échec de l'enregistrement");
        }
      } catch {
        setStates((current) => {
          const next = { ...current };
          if (previousValue === undefined) delete next[occurrenceKey];
          else next[occurrenceKey] = previousValue;
          return next;
        });
        toast.error("Échec réseau");
      } finally {
        setBusyKey(null);
      }
    },
    [states, guildId, slug, altPseudo]
  );

  return { states, others, loading, busyKey, setState, ensureLoaded };
}
