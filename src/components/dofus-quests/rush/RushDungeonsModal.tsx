"use client";

/**
 * **Donjons du guide** — wrapper GUILDE de la fenêtre « fait / à faire ».
 *
 * Le rendu vit dans `RushDungeonsModalShell` (partagé avec le guide public) et la
 * persistance dans `useRushDungeonStates` (Server Actions). Ce fichier ne fait que
 * les assembler, en **lazy** : une seule requête, à la première ouverture.
 *
 * ⚠️ La coche est **par occurrence** (quête × donjon) : « fait » ne vaut que pour la
 * quête affichée. Le verrou de validation est **serveur** (`setRushSequenceProgress`
 * pour une quête, `toggleMilestoneProgress` pour un bloc entier).
 */

import { useEffect } from "react";
import type { RushMilestone } from "@/types/rush-guide-types";
import { useRushDungeonStates } from "@/hooks/use-rush-dungeon-states";
import { RushDungeonsModalShell } from "./RushDungeonsModalShell";

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
  // Une seule requête, à la première ouverture : le hook est en mode `lazy`.
  const dungeons = useRushDungeonStates({ guildId, slug, altPseudo, lazy: true });
  const { ensureLoaded } = dungeons;
  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  return (
    <RushDungeonsModalShell
      milestones={milestones}
      states={dungeons.states}
      others={dungeons.others}
      busyKey={dungeons.busyKey}
      loading={dungeons.loading}
      onSet={dungeons.setState}
      onClose={onClose}
    />
  );
}
