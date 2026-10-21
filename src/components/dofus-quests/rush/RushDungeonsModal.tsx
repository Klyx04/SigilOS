"use client";

/**
 * **Donjons du guide** — modale « tous les donjons et leurs endroits ».
 *
 * Un donjon est une entité globale : il apparaît dans plusieurs quêtes. On peut le
 * marquer **fait** ou **à faire** (deux états, pas un booléen) ; cocher « fait »
 * débloque toutes les quêtes qui l'exigent, et « à faire » sert à l'entraide :
 * les autres membres de la guilde voient qui compte le faire.
 *
 * Aucune règle ici : l'index vient de `buildDungeonIndex` (pur, testé) et le verrou
 * de validation est appliqué **côté serveur** (`setRushSequenceProgress`).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { toast } from "sonner";
import { getRushDungeonStates, setRushDungeonState } from "@/server/actions/optimized-guide-actions";
import {
  applyDungeonStates,
  buildDungeonIndex,
  dungeonOccurrenceKey,
  type RushDungeonState,
} from "@/lib/rush-dungeons";
import type { RushMilestone } from "@/types/rush-guide-types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RushDungeonList, type RushDungeonMemberState } from "./RushDungeonList";

/**
 * Modale chargée à l'ouverture (une seule requête), puis **optimiste** : chaque clic
 * écrit l'état et revient en arrière en cas d'échec.
 */
export function RushDungeonsModal({
  guildId,
  slug,
  milestones,
  altPseudo,
  onClose,
}: {
  guildId: string;
  slug: string;
  milestones: RushMilestone[];
  altPseudo?: string;
  onClose: () => void;
}) {
  const index = useMemo(() => buildDungeonIndex(milestones), [milestones]);
  const [mine, setMine] = useState<Record<string, RushDungeonState>>({});
  const [others, setOthers] = useState<RushDungeonMemberState[]>([]);
  const [query, setQuery] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await getRushDungeonStates(guildId, slug, altPseudo);
        if (!alive) return;
        if (res.success) {
          setMine(res.mine);
          setOthers(res.others);
        } else {
          toast.error(res.error || "États indisponibles");
        }
      } catch {
        if (alive) toast.error("États indisponibles");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [guildId, slug, altPseudo]);

  const setState = useCallback(
    async (sequenceId: string, dungeonKey: string, state: RushDungeonState | null) => {
      const occurrenceKey = dungeonOccurrenceKey(sequenceId, dungeonKey);
      const previous = mine;
      setBusyKey(occurrenceKey);
      setMine((current) => {
        const next = { ...current };
        if (state === null) delete next[occurrenceKey];
        else next[occurrenceKey] = state;
        return next;
      });
      try {
        const wire = state === "done" ? "DONE" : state === "todo" ? "TODO" : null;
        const res = await setRushDungeonState(guildId, slug, sequenceId, dungeonKey, wire, altPseudo);
        if (!res.success) {
          setMine(previous);
          toast.error(res.error || "Échec de l'enregistrement");
        }
      } catch {
        setMine(previous);
        toast.error("Échec réseau");
      } finally {
        setBusyKey(null);
      }
    },
    [guildId, slug, altPseudo, mine]
  );

  const entries = useMemo(() => {
    const withState = applyDungeonStates(index, mine);
    const q = query.trim().toLowerCase();
    return q ? withState.filter((entry) => entry.name.toLowerCase().includes(q)) : withState;
  }, [index, mine, query]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[min(34rem,calc(100vw-2rem))] overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="text-sm">Donjons du guide</DialogTitle>
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
            <RushDungeonList entries={entries} others={others} busyKey={busyKey} onSet={setState} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
