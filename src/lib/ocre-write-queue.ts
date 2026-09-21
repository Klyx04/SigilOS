/**
 * File d'écriture Metamob de la Quête Ocre — **sérialisée, testable, sans React**.
 *
 * 🎯 Pourquoi cette file : valider une cible depuis l'overlay envoie un `PATCH` par
 * monstre à Metamob (qui répond **429** au burst). On regroupe donc les clics :
 *   • **une écriture à la fois** (jamais deux requêtes en parallèle) ;
 *   • **regroupement par monstre** : seule la dernière quantité voulue compte ;
 *   • **respiration** entre deux écritures ;
 *   • **retour arrière** : la quantité confirmée AVANT la première écriture en attente
 *     est mémorisée, et restituée telle quelle si le serveur refuse.
 *
 * ⚠️ Piège mesuré (Next dev + React StrictMode) : un drapeau `alive` posé dans le
 * nettoyage d'un `useEffect` de montage est remis à `false` par le **double montage**
 * (effet → nettoyage → effet) et n'est jamais réarmé — la file ne partait plus du tout
 * (« le bouton + ne fait rien »). La file est donc **créée dans l'effet** et détruite
 * avec lui (`stop()`), ce qui la rend StrictMode-safe : le 2ᵉ montage en a une neuve.
 */

export interface OcreWriteQueue {
  /** Demande une quantité (remplace toute demande en attente pour ce monstre). */
  push: (monsterId: number, quantity: number, previousOwned: number) => void;
  /** Vide la file sans rien envoyer (ex. après un rechargement serveur). */
  clear: () => void;
  /** Arrête la file : plus aucun envoi (démontage). */
  stop: () => void;
  /** Nombre de demandes en attente. */
  pendingCount: () => number;
  /**
   * Millisecondes restantes si la file est en pause (rate limit serveur / 429 Metamob),
   * 0 sinon. Sert à dire honnêtement « reprise dans X s » à l'utilisateur.
   */
  pausedFor: () => number;
}

/**
 * Écriture refusée par une limite : le champ `pauseMs` suspend la file pour ce délai
 * (le serveur renvoie `retryAfterMs` ; Metamob répond 429 → 30 s). Sans lui, la file
 * avance simplement vers l'écriture suivante.
 */
export interface OcreWriteQueueError extends Error {
  pauseMs?: number;
}

export interface OcreWriteQueueOptions {
  /** Envoie une écriture et renvoie la quantité confirmée (throw si refus). */
  send: (monsterId: number, quantity: number) => Promise<number | undefined | void>;
  /** Délai de regroupement après le dernier clic (ms). */
  debounceMs?: number;
  /** Respiration entre deux écritures (ms). */
  gapMs?: number;
  /** Vrai pendant un envoi (spinner discret). */
  onBusy?: (busy: boolean) => void;
  /** Écriture acceptée : `confirmed` = quantité retournée par le serveur. */
  onSent?: (monsterId: number, confirmed: number) => void;
  /** Écriture refusée : `revertTo` = quantité d'avant (à restituer), si connue. */
  onError?: (monsterId: number, message: string, revertTo: number | undefined) => void;
}

/** Délais par défaut : assez lents pour ne jamais marteler Metamob. */
export const OCRE_WRITE_DEBOUNCE_MS = 650;
export const OCRE_WRITE_GAP_MS = 300;

export function createOcreWriteQueue({
  send,
  debounceMs = OCRE_WRITE_DEBOUNCE_MS,
  gapMs = OCRE_WRITE_GAP_MS,
  onBusy,
  onSent,
  onError,
}: OcreWriteQueueOptions): OcreWriteQueue {
  /** Quantité voulue par monstre (la plus récente gagne). */
  const desired = new Map<number, number>();
  /** Quantité confirmée avant la première écriture en attente (retour arrière). */
  const before = new Map<number, number>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let stopped = false;
  /** Fin de la pause imposée par une limite (rate limit serveur / 429 Metamob). */
  let pausedUntil = 0;

  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const schedule = (delay: number) => {
    cancel();
    if (stopped) return;
    timer = setTimeout(() => { void run(); }, Math.max(0, delay));
  };

  const run = async () => {
    if (stopped || inFlight) return;
    // En pause (limite atteinte) : on ne relance pas avant la fin de la fenêtre.
    const wait = pausedUntil - Date.now();
    if (wait > 0) {
      schedule(wait);
      return;
    }
    const next = desired.entries().next();
    if (next.done) return;
    const [monsterId, quantity] = next.value;
    desired.delete(monsterId);
    inFlight = true;
    onBusy?.(true);
    const revertTo = before.get(monsterId);

    try {
      const confirmed = await send(monsterId, quantity);
      const value = typeof confirmed === "number" ? confirmed : quantity;
      // Un nouveau pas est déjà en attente ? Le retour arrière visera la valeur confirmée.
      if (desired.has(monsterId)) before.set(monsterId, value);
      else before.delete(monsterId);
      onSent?.(monsterId, value);
    } catch (e) {
      desired.delete(monsterId);
      before.delete(monsterId);
      // Une limite touchée ? On met la file en pause le temps annoncé par le serveur.
      const pauseMs = Number((e as OcreWriteQueueError)?.pauseMs ?? 0);
      if (Number.isFinite(pauseMs) && pauseMs > 0) pausedUntil = Date.now() + pauseMs;
      onError?.(
        monsterId,
        e instanceof Error && e.message ? e.message : "Metamob a refusé la modification.",
        revertTo
      );
    } finally {
      inFlight = false;
      onBusy?.(false);
      if (!stopped && desired.size > 0) {
        const remaining = pausedUntil - Date.now();
        schedule(remaining > 0 ? remaining : gapMs);
      }
    }
  };

  return {
    push: (monsterId, quantity, previousOwned) => {
      if (stopped) return;
      if (!before.has(monsterId)) before.set(monsterId, previousOwned);
      desired.set(monsterId, quantity);
      schedule(debounceMs);
    },
    clear: () => {
      desired.clear();
      before.clear();
      cancel();
    },
    stop: () => {
      stopped = true;
      // Plus rien ne partira : on vide la file (un décompte « en attente » serait un mensonge).
      desired.clear();
      before.clear();
      cancel();
    },
    pendingCount: () => desired.size,
    pausedFor: () => Math.max(0, pausedUntil - Date.now()),
  };
}
