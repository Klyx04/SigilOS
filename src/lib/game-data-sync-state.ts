/**
 * État des siphons game-data — **source de vérité UNIQUE** de la progression.
 *
 * 🎯 Problème corrigé (audit 22/09/2026) : la barre de progression du dashboard God
 * n'était branchée que sur 2 boutons sur 4 (`progressValue` local React) ⇒
 * « En cours… 0 % » alors que le siphon travaillait, et **aucun état lisible avant de
 * cliquer** (ni couverture, ni dernière exécution, ni dernière erreur).
 *
 * Stockage : Redis (une clé JSON par dataset, TTL 7 jours). **Aucune migration BDD.**
 * Fail-open : Redis indisponible ⇒ lecture vide / écriture ignorée, jamais d'exception
 * (un siphon ne doit JAMAIS casser parce que l'état est indisponible).
 */

export type GameDataDataset =
    | "CATALOGUE"        // public/game-data/dungeon-monsters.json
    | "BOUNTIES"         // avis de recherche (5 races)
    | "CLASS_SPELLS"     // grimoires des 19 classes
    | "ASSETS_WEBP"      // images (fiches, items, cartes)
    | "ITEMS"            // items DofusDB → GameItem
    | "REFERENTIALS"     // effets & caractéristiques
    | "ZONES"            // sous-zones DofusDB
    | "FAMILIES"         // familles de monstres
    | "QUESTS"           // quêtes DofusDB
    | "HARVEST"          // récoltables
    | "ANOMALY_BOSSES";  // boss d'anomalie

export const GAME_DATA_DATASETS: readonly GameDataDataset[] = [
    "CATALOGUE",
    "BOUNTIES",
    "CLASS_SPELLS",
    "ASSETS_WEBP",
    "ITEMS",
    "REFERENTIALS",
    "ZONES",
    "FAMILIES",
    "QUESTS",
    "HARVEST",
    "ANOMALY_BOSSES",
] as const;

/** Libellés affichés (le God lit ces noms dans le tableau d'état). */
export const GAME_DATA_DATASET_LABEL: Record<GameDataDataset, string> = {
    CATALOGUE: "Catalogue local (donjons & monstres)",
    BOUNTIES: "Avis de recherche",
    CLASS_SPELLS: "Grimoires de classes",
    ASSETS_WEBP: "Images WebP",
    ITEMS: "Items & ressources",
    REFERENTIALS: "Référentiels (effets, caractéristiques)",
    ZONES: "Zones & sous-zones",
    FAMILIES: "Familles de monstres",
    QUESTS: "Quêtes",
    HARVEST: "Récoltables",
    ANOMALY_BOSSES: "Boss d'anomalie",
};

export type GameDataRunStatus = "IDLE" | "RUNNING" | "OK" | "ERROR";

/**
 * Datasets exécutables **en arrière-plan** (file BullMQ + worker).
 * Règle : seuls ceux dont le CŒUR vit dans `src/lib` (appelable sans session Next).
 * ⚠️ Ce module est importé par des composants CLIENT : jamais d'import de `bullmq` ici.
 */
export const GAME_DATA_BACKGROUND_DATASETS = ["CATALOGUE", "ANOMALY_BOSSES", "ZONES", "FAMILIES", "BOUNTIES", "ITEMS", "REFERENTIALS", "QUESTS", "CLASS_SPELLS"] as const;
export type GameDataBackgroundDataset = (typeof GAME_DATA_BACKGROUND_DATASETS)[number];

export function isBackgroundDataset(dataset: GameDataDataset): dataset is GameDataBackgroundDataset {
    return (GAME_DATA_BACKGROUND_DATASETS as readonly string[]).includes(dataset);
}

/**
 * **Comment** chaque dataset se relance — **une seule source**, lue par le Tableau.
 *
 * Audit 23/09/2026 (demande user : « je comprends rien, pk on a des “Bouton direct
 * ci-dessous” ») : le Tableau affichait ce libellé pour 5 datasets, dont **Récoltables**
 * qui n'a **aucune** action réseau (son JSON est produit par un script local
 * `scripts/compile-harvest-and-zaaps.ts`) ⇒ le tableau mentait. Désormais chaque dataset
 * déclare son mode :
 *   · `BACKGROUND` — cœur en `src/lib` ⇒ file BullMQ + worker (**survit à l'onglet fermé**) ;
 *   · `INLINE`     — pas de cœur `src/lib` ⇒ **lancé dans l'onglet** (repli honnête) ;
 *   · `SCRIPT`     — aucune action en ligne : fichier produit par un **script local**.
 *
 * ⚠️ Le mode est **dérivé** des deux listes ci-dessus : aucune 3ᵉ liste à tenir à jour.
 * Invariant de test : les trois modes **partitionnent** `GAME_DATA_DATASETS` (11/11).
 */
export type GameDataLaunchKind = "BACKGROUND" | "INLINE" | "SCRIPT";

/** Datasets sans cœur `src/lib` : lancement **dans l'onglet** (jamais en file). */
export const GAME_DATA_INLINE_DATASETS: readonly GameDataDataset[] = [
    "ASSETS_WEBP",
];

/** Datasets sans action en ligne : le fichier vient d'un script local. */
export const GAME_DATA_SCRIPT_DATASETS: readonly GameDataDataset[] = ["HARVEST"];

export function isInlineDataset(dataset: GameDataDataset): boolean {
    return (GAME_DATA_INLINE_DATASETS as readonly string[]).includes(dataset);
}

export function isScriptDataset(dataset: GameDataDataset): boolean {
    return (GAME_DATA_SCRIPT_DATASETS as readonly string[]).includes(dataset);
}

export function gameDataLaunchKind(dataset: GameDataDataset): GameDataLaunchKind {
    if (isBackgroundDataset(dataset)) return "BACKGROUND";
    return isInlineDataset(dataset) ? "INLINE" : "SCRIPT";
}


/**
 * 🔭 **Registre de veille** — quels datasets savent demander à DofusDB « seulement ce qui a
 * bougé depuis X », et lesquels peuvent être relancés **automatiquement**.
 *
 * Mesures du 23/09/2026 (API DofusDB, faites à la main) :
 *   · `items?updatedAt[$gt]=<date>` : filtre **réel** (une date future renvoie 0) ⇒ sur
 *     30 jours glissants, **46 items** au lieu des 21 776 de la passe complète ;
 *   · `$sort` / `$order` / `$select` : **refusés** (HTTP 400) ⇒ pas de tri, pas de projection.
 *
 * Règle : un dataset n'est **auto-synchronisable** que si (a) son cœur sait filtrer par
 * date, et (b) sa passe est **additive** (ajout/mise à jour) — jamais de suppression venu
 * de la machine : un retrait reste une décision humaine (listes d'exclusion).
 * Invariant de test : `AUTO ⊆ WATCH ⊆ BACKGROUND`.
 */
export const GAME_DATA_WATCH_DATASETS: readonly GameDataDataset[] = ["ITEMS"];

/** Datasets que le cron de veille peut relancer **tout seul** (passe ciblée, additive). */
export const GAME_DATA_AUTO_SYNC_DATASETS: readonly GameDataDataset[] = ["ITEMS"];

export function isWatchedDataset(dataset: GameDataDataset): boolean {
    return (GAME_DATA_WATCH_DATASETS as readonly string[]).includes(dataset);
}

export function isAutoSyncDataset(dataset: GameDataDataset): boolean {
    return (GAME_DATA_AUTO_SYNC_DATASETS as readonly string[]).includes(dataset);
}

/**
 * 🔍 Datasets dont les siphons **écrivent réellement** dans le journal des changements
 * (`GameDataChangeLog`). Le bouton « Journal » existe sur **toutes** les lignes du Tableau :
 * sans ce registre, une ligne non branchée afficherait un vide **trompeur** (« lancez une
 * passe ») alors qu'aucune passe ne la remplira. Le branchement d'un dataset = ajouter ici.
 */
export const GAME_DATA_JOURNAL_DATASETS: readonly GameDataDataset[] = [
    "ITEMS",
    "QUESTS",
    "CLASS_SPELLS",
    "ANOMALY_BOSSES",
    "FAMILIES",
    "ZONES",
    "REFERENTIALS",
    "CATALOGUE",
    "ASSETS_WEBP",
    "BOUNTIES",
];

export function isJournalWiredDataset(dataset: GameDataDataset): boolean {
    return (GAME_DATA_JOURNAL_DATASETS as readonly string[]).includes(dataset);
}

export interface GameDataRunState {
    dataset: GameDataDataset;
    status: GameDataRunStatus;
    done: number;
    total: number | null;
    /** `null` quand le total est inconnu : on n'affiche PAS un faux 0 %. */
    percent: number | null;
    message: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    lastError: string | null;
    /**
     * Bilan chiffré de la dernière passe (le Tableau l'affiche tel quel). `null` pour les
     * datasets qui ne le fournissent pas — on n'invente jamais un chiffre.
     */
    counts: GameDataRunCounts | null;
}

/** « 3 nouveaux · 46 modifiés · 21 727 inchangés » — lu par le tableau d'état. */
export interface GameDataRunCounts {
    inserted: number;
    updated: number;
    unchanged: number;
}

/**
 * ⏱️ Âge (en minutes) à partir duquel un état `RUNNING` **sans job en file** est déclaré
 * **périmé**. Marge large à dessein : mieux vaut afficher « En cours » un peu trop longtemps
 * que d'effacer une passe légitime (la passe ITEMS complète dure 10-20 min).
 *
 * Incident mesuré le 24/09/2026 : « En cours · 0 — total inconnu · il y a 1 h » alors
 * qu'**aucun job ne tournait** (un `jobId` déjà présent avait fait ignorer la mise en file).
 */
export const GAME_DATA_STALE_RUN_MINUTES: Record<GameDataDataset, number> = {
    ITEMS: 45,
    CATALOGUE: 30,
    QUESTS: 20,
    BOUNTIES: 15,
    ANOMALY_BOSSES: 15,
    ZONES: 15,
    FAMILIES: 15,
    REFERENTIALS: 15,
    CLASS_SPELLS: 45,
    ASSETS_WEBP: 45,
    HARVEST: 15,
};

/** `true` si un état `RUNNING` est trop vieux pour être crédible (à confronter à la file). */
export function isStaleRun(state: Pick<GameDataRunState, "dataset" | "status" | "startedAt">, now = Date.now()): boolean {
    if (state.status !== "RUNNING" || !state.startedAt) return false;
    const started = Date.parse(state.startedAt);
    if (Number.isNaN(started)) return false;
    const limitMs = (GAME_DATA_STALE_RUN_MINUTES[state.dataset] ?? 15) * 60_000;
    return now - started > limitMs;
}

/** Message unique affiché quand une passe est déclarée morte (le God comprend quoi faire). */
export const STALE_RUN_MESSAGE = "Passe interrompue : aucun job en file — relancez le siphon.";

/** Pourcentage borné 0-100, `null` si le total est inconnu ou nul. */
export function computePercent(done: number, total: number | null | undefined): number | null {
    if (total === null || total === undefined || total <= 0) return null;
    const d = Number.isFinite(done) && done > 0 ? done : 0;
    return Math.max(0, Math.min(100, Math.round((d / total) * 100)));
}

/** État vierge d'un dataset (jamais exécuté). Pur → testable. */
export function emptyGameDataRunState(dataset: GameDataDataset): GameDataRunState {
    return {
        dataset,
        status: "IDLE",
        done: 0,
        total: null,
        percent: null,
        message: null,
        startedAt: null,
        finishedAt: null,
        lastError: null,
        counts: null,
    };
}
