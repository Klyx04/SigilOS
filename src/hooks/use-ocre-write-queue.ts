"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyOcreQuantity,
  nextOcreQuantity,
  type OcreMonsterLite,
} from "@/lib/ocre-soul-stones";
import {
  createOcreWriteQueue,
  type OcreWriteQueue,
  type OcreWriteQueueError,
} from "@/lib/ocre-write-queue";

/**
 * Écriture EN DIRECT d'une cible de la Quête Ocre (valider / dévalider un archimonstre
 * ou un gardien) — **source unique** pour l'overlay et le module.
 *
 * Comportement (identique partout, donc homogène pour l'utilisateur) :
 *   • **optimiste** : le clic se voit tout de suite ;
 *   • **sérialisé** : une écriture à la fois, regroupée par monstre (file pure testée) ;
 *   • **borné** : le serveur limite à 60 écritures/min ; un refus renvoie `retryAfterMs`
 *     et la file se met **en pause** (jamais de réessai en boucle, aucun spam possible) ;
 *   • **honnête** : valeur confirmée par le serveur qui fait foi, retour arrière à la
 *     dernière valeur confirmée si l'écriture est refusée, message affiché DANS le panneau.
 */

export interface OcreWriteNotice {
  kind: "error" | "info";
  text: string;
}

export interface UseOcreWriteQueueOptions {
  /** Guilde de l'appelant. Absent côté **visiteur** (aucune guilde) : `send` est alors requis. */
  guildId?: string;
  /** Liste initiale (données serveur, shape overlay). */
  monsters: OcreMonsterLite[];
  /** Copies exigées par la quête (`parallelQuests`, ≥ 1). */
  requiredCopies?: number;
  /**
   * Écriture personnalisée. Par défaut : l'action de **guilde**
   * (`updateUserMonsterQuantityAction`). Le visiteur branche ici `patchPublicOcreMonster`.
   */
  send?: (monsterId: number, quantity: number) => Promise<number | undefined>;
}

export interface UseOcreWriteQueueResult {
  /** Liste locale optimiste : c'est ELLE qu'il faut afficher. */
  monsters: OcreMonsterLite[];
  /** Adopte une liste serveur fraîche et vide la file (après un rechargement). */
  adoptServerList: (next: OcreMonsterLite[]) => void;
  /** Un pas de ±1 : optimiste tout de suite, écriture en file ensuite. */
  changeQuantity: (target: Pick<OcreMonsterLite, "id" | "owned">, delta: 1 | -1) => void;
  /** Ids dont une écriture est en attente (spinner de ligne). */
  pendingIds: number[];
  /** Vrai pendant un envoi. */
  busy: boolean;
  /** Message à afficher dans le panneau (erreur Metamob, information de copie…). */
  notice: OcreWriteNotice | null;
  setNotice: (notice: OcreWriteNotice | null) => void;
}

export function useOcreWriteQueue({
  guildId,
  monsters: initialMonsters,
  requiredCopies = 1,
  send,
}: UseOcreWriteQueueOptions): UseOcreWriteQueueResult {
  const [monsters, setMonsters] = useState<OcreMonsterLite[]>(initialMonsters);
  const [pendingIds, setPendingIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<OcreWriteNotice | null>(null);

  const monstersRef = useRef<OcreMonsterLite[]>(monsters);
  const copiesRef = useRef(requiredCopies);
  const queueRef = useRef<OcreWriteQueue | null>(null);
  const sendRef = useRef<(monsterId: number, quantity: number) => Promise<number | undefined>>(
    async () => undefined
  );

  useEffect(() => { monstersRef.current = monsters; }, [monsters]);
  useEffect(() => { copiesRef.current = requiredCopies; }, [requiredCopies]);

  // ⚠️ La file est CRÉÉE DANS L'EFFET (et détruite avec lui) : c'est ce qui la rend
  // StrictMode-safe. En dev, Next (Strict Mode actif par défaut depuis 13.5.1) monte /
  // démonte / remonte les effets : un drapeau « vivant » posé au nettoyage resterait à
  // `false` pour toujours et **plus aucune écriture ne partirait** (bug constaté le 21/09).
  useEffect(() => {
    const queue = createOcreWriteQueue({
      send: (monsterId, quantity) => sendRef.current(monsterId, quantity),
      onBusy: setBusy,
      onSent: (monsterId, confirmed) => {
        setMonsters((prev) => applyOcreQuantity(prev, monsterId, confirmed, copiesRef.current));
        setPendingIds((prev) => prev.filter((id) => id !== monsterId));
        // Accusé de réception : sans lui l'écran restait muet (« on ne sait pas si ça marche »).
        setNotice({ kind: "info", text: "Enregistré sur Metamob ✓" });
      },
      onError: (monsterId, message, revertTo) => {
        if (typeof revertTo === "number") {
          setMonsters((prev) => applyOcreQuantity(prev, monsterId, revertTo, copiesRef.current));
        }
        setPendingIds((prev) => prev.filter((id) => id !== monsterId));
        setNotice({ kind: "error", text: message });
      },
    });
    queueRef.current = queue;
    return () => {
      queue.stop();
      queueRef.current = null;
    };
  }, []);

  // Envoi réel : `send` fourni (visiteur) ou action de guilde (membre).
  useEffect(() => {
    if (send) {
      sendRef.current = send;
      return;
    }
    if (!guildId) return;
    sendRef.current = async (monsterId, quantity) => {
      const { updateUserMonsterQuantityAction } = await import("@/server/actions/ocre-actions");
      const res = await updateUserMonsterQuantityAction({ guildId, monsterId, quantity });
      if (!res.success) {
        // Le serveur annonce la fenêtre à respecter : la file se mettra en pause.
        const error = new Error(res.error || "Échec de la mise à jour Metamob") as OcreWriteQueueError;
        if (typeof res.retryAfterMs === "number") error.pauseMs = res.retryAfterMs;
        throw error;
      }
      return res.data?.quantity;
    };
  }, [guildId, send]);

  const adoptServerList = useCallback((next: OcreMonsterLite[]) => {
    queueRef.current?.clear();
    setPendingIds([]);
    setNotice(null);
    setMonsters(next);
  }, []);

  const changeQuantity = useCallback((target: Pick<OcreMonsterLite, "id" | "owned">, delta: 1 | -1) => {
    const current = monstersRef.current.find((m) => m.id === target.id)?.owned ?? target.owned;
    const quantity = nextOcreQuantity(current, delta, copiesRef.current);
    if (quantity === current) return;
    setNotice(null);
    setMonsters((prev) => applyOcreQuantity(prev, target.id, quantity, copiesRef.current));
    setPendingIds((prev) => (prev.includes(target.id) ? prev : [...prev, target.id]));
    queueRef.current?.push(target.id, quantity, current);
  }, []);

  return { monsters, adoptServerList, changeQuantity, pendingIds, busy, notice, setNotice };
}
