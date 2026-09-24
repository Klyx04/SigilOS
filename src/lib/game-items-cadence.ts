/**
 * Cadence du siphon d'items DofusDB — **source unique**, importable **côté client**.
 * ⚠️ Pourquoi ce fichier existe (incident mesuré le 23/09/2026) : le lanceur « dans
 * l'onglet » (`src/components/admin/game-data-inline-runners.ts`) a besoin de la cadence,
 * mais il ne peut PAS importer le cœur `src/lib/game-items-siphon.ts` : celui-ci importe
 * `@/lib/dofus-asset-siphon` (`sharp`, `fs`) ⇒ Turbopack suivait la chaîne dans le bundle
 * navigateur et le build cassait (`Module not found` sur `./src/lib/dofus-asset-siphon.ts`).
 * Les valeurs vivent donc ici, **sans aucune dépendance**, et le cœur les réexporte : une
 * seule source, deux étages.
 */

import { DOFUSDB_PAGE_MAX } from "@/lib/dofusdb-pagination";

/** Taille du lot = **plafond réel** de l'API (`DOFUSDB_PAGE_MAX` = 50, mesuré le 24/09/2026). */
export const GAME_ITEMS_BATCH_SIZE = DOFUSDB_PAGE_MAX;

/**
 * Pause entre deux lots = **cadence du limiteur partagé** (`dofusDbFetch` : fenêtre Redis
 * 30 req/min/hôte ⇒ ~2,1 s). À 350 ms la fenêtre était saturée en ~10 s ⇒ 429 en boucle,
 * retries 2/4/8/16 s, abandon (« le siphon ne marche jamais »).
 */
export const GAME_ITEMS_BATCH_PAUSE_MS = 2_100;

/**
 * Plafond d'une passe **incrémentale** (« veille ciblée ») : 5 000 items = 50 lots ≈ 2 min.
 * Mesure du 23/09/2026 : 30 jours glissants = **46 items** ⇒ le plafond n'est jamais atteint
 * en régime normal, il ne sert qu'à borner un rattrapage massif. S'il est atteint, la passe
 * **ne fait pas avancer le filigrane** et reprend au même `skip` (aucune perte).
 */
export const GAME_ITEMS_INCREMENTAL_MAX_ITEMS = 5_000;