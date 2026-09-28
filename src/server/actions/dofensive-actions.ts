'use server'

/**
 * ENVELOPPE — API Dofensive (surface appelée par l'UI et les crons).
 *
 * 🧭 Le CŒUR vit dans `src/lib/dofensive-api.ts` depuis le 28/09/2026 (A1) : le worker BullMQ
 * (`src/lib/anomaly-boss-siphon.ts`, `src/lib/bounty-siphon.ts`) importait ce module pour
 * `getDofensiveSpells`, ce qui embarquait `@/lib/security` → `isomorphic-dompurify` → **jsdom**
 * dans `dist/worker.js` : jsdom lit son `browser/default-stylesheet.css` **à l'évaluation du
 * module** ⇒ `ENOENT: /browser/default-stylesheet.css` (une erreur par item, en arrière-plan).
 * Ici : délégation pure — **aucun** changement de nom, de signature ni de chemin d'action (le
 * contrat des composants clients est intact).
 */

import type { DofensiveSpellCombat } from "@/lib/dofensive-spells";
import {
    getBossDofensiveSpells as coreGetBossDofensiveSpells,
    getDofensiveDungeonForBoss as coreGetDofensiveDungeonForBoss,
    getDofensiveMap as coreGetDofensiveMap,
    getDofensiveSpells as coreGetDofensiveSpells,
} from "@/lib/dofensive-api";
import type {
    DofensiveDungeonInfo,
    DofensiveMapData,
} from "@/lib/dofensive-api";

export type {
    DofensiveDungeonInfo,
    DofensiveMapData,
    DofensiveMapLite,
    DofensiveMonsterData,
} from "@/lib/dofensive-api";

type ActionResponse<T = void> = {
    success: boolean;
    error?: string;
    data?: T;
    /**
     * 🛰️ Lot 1 « stale-while-offline » : `true` ⇒ donnée servie depuis une ligne LOCALE
     * **périmée** (> TTL). Elle n'est jamais masquée ni bloquante : l'UI l'affiche **datée**.
     */
    stale?: boolean;
    /** Date de dernière synchronisation de la ligne servie (ISO) — `null` si inconnue. */
    syncedAt?: string | null;
};

export async function getDofensiveDungeonForBoss(
    bossName: string,
    dungeonName?: string,
    opts?: { dofensiveMonsterName?: string | null; dofensiveDungeonName?: string | null }
): Promise<ActionResponse<DofensiveDungeonInfo>> {
    return coreGetDofensiveDungeonForBoss(bossName, dungeonName, opts);
}

export async function getDofensiveMap(mapId: number | string): Promise<ActionResponse<DofensiveMapData>> {
    return coreGetDofensiveMap(mapId);
}

export async function getDofensiveSpells(
    monsterId: number,
    gradeLevel?: number,
    forceRefresh = false,
    locale: "fr" | "en" = "fr"
): Promise<ActionResponse<DofensiveSpellCombat[]>> {
    return coreGetDofensiveSpells(monsterId, gradeLevel, forceRefresh, locale);
}

export async function getBossDofensiveSpells(
    monsterName: string,
    dungeonName?: string,
    gradeLevel?: number,
    forceRefresh = false,
    opts?: { dofensiveMonsterName?: string | null; dofensiveDungeonName?: string | null },
    locale: "fr" | "en" = "fr"
): Promise<ActionResponse<DofensiveSpellCombat[]>> {
    return coreGetBossDofensiveSpells(monsterName, dungeonName, gradeLevel, forceRefresh, opts, locale);
}
