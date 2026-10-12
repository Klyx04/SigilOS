"use client";

import { useEffect, useRef } from "react";
import {
  guideSyncChannel,
  encodeGuideSnapshot,
  applyGuideSnapshot,
  type GuideProgressSnapshot,
} from "@/lib/guide-sync";

type GuideProgressState = {
  completedIds: Set<string>;
  completedStepsByMs: Map<string, Set<string>>;
  bookmarksByMs: Map<string, string>;
};

type GuideProgressSetters = {
  setCompletedIds: (s: Set<string>) => void;
  setCompletedStepsByMs: (m: Map<string, Set<string>>) => void;
  setBookmarksByMs: (m: Map<string, string>) => void;
};

/**
 * Synchronise la progression « ce qui est coché » entre les fenêtres même-origine
 * du MÊME utilisateur (dashboard ↔ overlay Rush Sylvestre) via BroadcastChannel.
 *
 * - Public son propre état dès qu'il change suite à une ACTION LOCALE (pas de
 *   boucle : on ne re-publie pas un état qu'on vient d'appliquer à distance).
 * - Écoute les instantanés des autres fenêtres et les applique localement.
 *
 * Fail-soft : si BroadcastChannel est indisponible (non supporté / fermé), on
 * ne fait rien — les fenêtres gardent leurs props serveur en fallback.
 */
export function useGuideProgressSync(
  guildId: string,
  guideSlug: string,
  state: GuideProgressState,
  setters: GuideProgressSetters
) {
  const applyingRemoteRef = useRef<boolean>(false);

  // Publish local state (action utilisateur) → les autres fenêtres s'y alignent.
  useEffect(() => {
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false;
      return;
    }
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
    try {
      const ch = new BroadcastChannel(guideSyncChannel(guildId, guideSlug));
      ch.postMessage(
        encodeGuideSnapshot(state.completedIds, state.completedStepsByMs, state.bookmarksByMs)
      );
      ch.close();
    } catch {
      /* fail-soft */
    }
    // deps volontairement sur les trois structures de progression
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.completedIds, state.completedStepsByMs, state.bookmarksByMs, guildId, guideSlug]);

  // Listen to other windows (dashboard / overlay) and apply their snapshot.
  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
    let ch: BroadcastChannel | null = null;
    try {
      ch = new BroadcastChannel(guideSyncChannel(guildId, guideSlug));
    } catch {
      return;
    }
    const onMessage = (event: MessageEvent<GuideProgressSnapshot>) => {
      const data = event.data;
      if (!data || !Array.isArray(data.completedIds)) return;
      applyingRemoteRef.current = true;
      const next = applyGuideSnapshot(data);
      setters.setCompletedIds(next.completedIds);
      setters.setCompletedStepsByMs(next.completedStepsByMs);
      setters.setBookmarksByMs(next.bookmarksByMs);
    };
    ch.onmessage = onMessage;
    return () => {
      ch?.close();
    };
    // setters sont stables (useState) — on ne les ré-écoute pas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId, guideSlug]);
}
