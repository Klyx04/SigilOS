/**
 * SYNC entre fenêtres du même navigateur (dashboard ↔ overlay Rush Sylvestre).
 *
 * Le module dashboard (`RushTimelineClient`) et l'overlay
 * (`GuideOverlayClient`) sont deux fenêtres même-origine ouvertes par
 * `window.open`. Elles partagent la même progression utilisateur sans aucun
 * serveur supplémentaire : on échange un instantané de progression via
 * `BroadcastChannel` (API navigateur, zéro logiciel à installer, zéro latence).
 *
 * Ne fournit PAS de synchro multi-utilisateurs (c'est le rôle de
 * `use-guide-presence` + WebSocket/Redis) : ici on synchronise uniquement
 * l'état « ce qui est coché » du MEME utilisateur entre ses deux fenêtres.
 */

export type GuideProgressSnapshot = {
  completedIds: string[];
  completedStepsByMs: Record<string, string[]>;
  bookmarksByMs: Record<string, string>;
};

/** Canal BroadcastChannel, scopé par guilde + slug. */
export function guideSyncChannel(guildId: string, guideSlug: string): string {
  return `sigil-guide-sync:${guildId}:${guideSlug}`;
}

/**
 * Convertit les structures progress (Set/Map) en instantané sérialisable pour
 * `BroadcastChannel` (postMessage clone en profondeur, pas de Set/Map directs).
 */
export function encodeGuideSnapshot(
  completedIds: Set<string>,
  completedStepsByMs: Map<string, Set<string>>,
  bookmarksByMs: Map<string, string>
): GuideProgressSnapshot {
  return {
    completedIds: Array.from(completedIds),
    completedStepsByMs: Object.fromEntries(
      Array.from(completedStepsByMs.entries()).map(([msId, stepKeys]) => [msId, Array.from(stepKeys)])
    ),
    bookmarksByMs: Object.fromEntries(Array.from(bookmarksByMs.entries())),
  };
}

/**
 * Applique un instantané reçu dans l'état local (Set/Map reconstruits).
 */
export function applyGuideSnapshot(snapshot: GuideProgressSnapshot): {
  completedIds: Set<string>;
  completedStepsByMs: Map<string, Set<string>>;
  bookmarksByMs: Map<string, string>;
} {
  return {
    completedIds: new Set(snapshot.completedIds),
    completedStepsByMs: new Map(
      Object.entries(snapshot.completedStepsByMs || {}).map(([msId, stepKeys]) => [msId, new Set(stepKeys)])
    ),
    bookmarksByMs: new Map(Object.entries(snapshot.bookmarksByMs || {})),
  };
}
