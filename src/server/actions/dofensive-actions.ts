'use server'

/**
 * Couche serveur — API Dofensive (dofensive.com/api/dofus2/bestiary).
 *
 * Dofensive expose (publiquement, JSON sans clé) exactement ce qu'il faut pour la
 * simulation de fiche boss façon « DoMaGE » :
 *   - /dungeons/preview  → donjons + leurs maps (nommées) + leurs monstres (lien boss→maps)
 *   - /maps/{id}         → map réelle : grille `cells` (0=sol marchable,
 *                          1=case impossible/trou, 2=case obstacle 3D), cases de
 *                          départ `allyCells` / `enemyCells` (cellIds Dofus)
 *   - /monsters/{id}     → monstre : PreferredMaps, Dungeons, Spells
 *
 * Proxy + cache mémoire 24 h (donnée de jeu statique) — même pattern que
 * monsterStatsCache dans game-data-actions.ts. Fail-closed : toute erreur réseau
 * renvoie { success: false } et le client garde son fallback local.
 */

import type {
    DofensiveSpellCombat,
    DofensiveSpellEffect,
    DofensiveSpellZone,
    DofensiveZoneShape,
} from "@/lib/dofensive-spells";
import { dofensiveFetch, norm, toSafeId } from "@/lib/dofensive-fetch";
import { damageRangeOfEffect, pickMonsterDamageStats, pushDistanceOfEffect, scaleDamageInEffectGroups } from "@/lib/dofus-monster-damage";
import { pickMonsterGrade, pickSpellLevelForMonster } from "@/lib/dofensive-spells";
import { deriveDofensiveMonsterName, pickDofensiveMonsterId } from "@/lib/dofensive-boss";
import {
    getLocalDofensiveDungeonAny,
    getLocalDofensiveMapAny,
    getLocalDofensiveSpellsAny,
    // Résolution « par nom » (siphon anomalies/double boss) : aucune variante `…Any` —
    // comportement fraîcheur conservé (la donnée est réécrite au siphon).
    getLocalDofensiveSpellsByName,
    getLocalMonsterStatAny,
    persistDofensiveMap,
    persistStoredCombatSpells,
} from "@/lib/dofensive-sync";

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

/**
 * Réponse d'une lecture locale : **propage la fraîcheur** au lieu de la perdre
 * (une péremption ne doit jamais devenir une absence — cause racine du 15/09/2026).
 */
function localStaleResponse<T>(hit: { data: T; lastSyncedAt: Date | null; stale: boolean }): ActionResponse<T> {
    return {
        success: true,
        data: hit.data,
        stale: hit.stale,
        syncedAt: hit.lastSyncedAt ? hit.lastSyncedAt.toISOString() : null,
    };
}

// ─── Types exposés (camelCase normalisé) ────────────────────────────────────

/** Mots-significatifs d'un nom (minuscules, sans accents, ≥4 lettres, hors stop-words). */
function significantTokens(s: string): Set<string> {
    const STOP = new Set([
        "de", "du", "des", "la", "le", "les", "l", "d", "en", "au", "aux",
        "un", "une", "et", "a", "a", "sur", "dans", "pour", "avec", "sans",
    ]);
    const tokens = norm(s)
        .split(/[\s'’]+/)
        .filter((t) => t.length >= 4 && !STOP.has(t));
    return new Set(tokens);
}

export interface DofensiveMapLite {
    id: number;
    name: string;
    /** true si c'est une map de combat du boss (PreferredMaps du monstre). */
    isBoss?: boolean;
}

export interface DofensiveDungeonInfo {
    dungeonId: number;
    dungeonName: string;
    maps: DofensiveMapLite[];
    monsters: { id: number; name: string }[];
    bossMonsterId: number | null;
}

export interface DofensiveMapData {
    id: number;
    name: string;
    subarea: { id: number; name: string } | null;
    dungeon: { id: number; name: string } | null;
    isBossMap: boolean;
    coordinates: { x: number; y: number } | null;
    /** Grille 2D : cells[row][col] — 0 = sol (marchable), 1 = case impossible/trou, 2 = case obstacle (3D). */
    cells: number[][];
    /** cellIds Dofus des cases de départ alliés (convention : col = id / rows, row = id % rows). */
    allyCells: number[];
    /** cellIds Dofus des cases de départ ennemis / boss. */
    enemyCells: number[];
}

export interface DofensiveMonsterData {
    id: number;
    name: string;
    preferredMaps: DofensiveMapLite[];
    dungeons: { id: number; name: string }[];
    spells: { id: number; name: string }[];
}

// ─── Actions ────────────────────────────────────────────────────────────────

/**
 * Trouve le donjon Dofensive dont la liste de monstres contient `bossName`
 * (matching normalisé : minuscules, sans accents). Retourne les maps du donjon
 * (les « salles ») + les monstres de la famille + l'id du boss.
 *
 * Ambiguïté multi-donjons (ex. « Servitude » présent dans 2 donjons) :
 *  - si `dungeonName` est fourni, on le matche d'abord (nom de donjon normalisé) ;
 *  - sinon on préfère le donjon où le boss est en tête de liste `Monsters`.
 */
export async function getDofensiveDungeonForBoss(
    bossName: string,
    dungeonName?: string,
    opts?: { dofensiveMonsterName?: string | null; dofensiveDungeonName?: string | null }
): Promise<ActionResponse<DofensiveDungeonInfo>> {
    if (!bossName || !bossName.trim()) return { success: false, error: "Nom de boss manquant" };

    // 🛰️ Lot 1 « stale-while-offline » : la LECTURE LOCALE passe AVANT tout appel réseau.
    // Une ligne **périmée** est servie (datée) — seul « aucune ligne » autorise le live.
    try {
        const local = await getLocalDofensiveDungeonAny(bossName, dungeonName);
        if (local) return localStaleResponse(local);
    } catch {
        // Aucune ligne locale exploitable → résolution live ci-dessous
    }

    // Chantier double boss : résolution explicite par champs configurés — tentée UNIQUEMENT
    // sans donnée locale (sinon on ne paierait un appel réseau pour rien).
    const explicitMonsterName = opts?.dofensiveMonsterName ?? deriveDofensiveMonsterName(bossName) ?? undefined;
    if (explicitMonsterName || opts?.dofensiveDungeonName) {
        try {
            const direct = await resolveDofensiveDungeonDirect(explicitMonsterName ?? bossName, opts?.dofensiveDungeonName ?? dungeonName);
            if (direct) return { success: true, data: direct };
        } catch {
            // Fallback vers la résolution heuristique ci-dessous
        }
    }

    const dungeons = await dofensiveFetch<any[]>(
        "/dungeons/preview?lang=fr",
        "dofensive-dungeons-preview"
    );
    if (!Array.isArray(dungeons)) return { success: false, error: "Dofensive indisponible" };

    const key = norm(bossName);
    let hits = dungeons.filter((d) =>
        Array.isArray(d?.Monsters) && d.Monsters.some((m: any) => norm(String(m?.Name ?? "")) === key)
    );

    // 2. Si non trouvé par bossName, chercher par nom de donjon
    if (hits.length === 0 && dungeonName && dungeonName.trim()) {
        const dk = norm(dungeonName);
        hits = dungeons.filter((d) => {
            const dn = norm(String(d?.Name ?? ""));
            return dn === dk || dn.includes(dk) || dk.includes(dn);
        });
    }

    // 3. Si toujours non trouvé, recherche floue sur bossName dans Monsters ou Name
    if (hits.length === 0) {
        hits = dungeons.filter((d) => {
            const dn = norm(String(d?.Name ?? ""));
            const hasMob = Array.isArray(d?.Monsters) && d.Monsters.some((m: any) => {
                const mn = norm(String(m?.Name ?? ""));
                return mn.includes(key) || key.includes(mn);
            });
            return hasMob || dn.includes(key) || key.includes(dn);
        });
    }

    // 4. Fallback DURABLE : correspondance par mots-significatifs (token overlap).
    //    Gère les écarts de nommage DofusDB ↔ Dofensive sans rien casser :
    //    « Temple de l'Eliocalypse » ↔ « Tempête de l'Eliocalypse » (token « Eliocalypse »),
    //    accents/typographie, etc. Uniquement si les étapes exactes précédentes ont échoué.
    if (hits.length === 0 && dungeonName && dungeonName.trim()) {
        const qTokens = significantTokens(dungeonName);
        if (qTokens.size > 0) {
            const scored = dungeons
                .map((d) => {
                    const dTokens = significantTokens(String(d?.Name ?? ""));
                    let score = 0;
                    dTokens.forEach((t) => { if (qTokens.has(t)) score++; });
                    return { d, score };
                })
                .filter((x) => x.score > 0)
                .sort((a, b) => b.score - a.score);
            if (scored.length > 0) hits = scored.map((x) => x.d);
        }
    }

    let hit: any | undefined;
    if (dungeonName && dungeonName.trim()) {
        const dk = norm(dungeonName);
        hit = hits.find((d) => {
            const dn = norm(String(d?.Name ?? ""));
            return dn === dk || dn.includes(dk) || dk.includes(dn);
        });
    }
    if (!hit && hits.length > 1) {
        // Préfère le donjon où le boss est en tête de liste (probable boss principal).
        const ranked = hits
            .map((d) => ({ d, idx: d.Monsters.findIndex((m: any) => norm(String(m?.Name ?? "")) === key) }))
            .filter((r) => r.idx === 0);
        if (ranked.length > 0) hit = ranked[0].d;
    }
    if (!hit) hit = hits[0];
    if (!hit) return { success: false, error: `Aucun donjon Dofensive pour « ${bossName} »` };

    const boss = Array.isArray(hit.Monsters)
        ? (hit.Monsters.find((m: any) => norm(String(m?.Name ?? "")) === key) || hit.Monsters[0])
        : null;

    const dungeonMaps: DofensiveMapLite[] = Array.isArray(hit.Maps)
        ? hit.Maps.map((m: any) => ({ id: m.Id as number, name: String(m.Name ?? "") }))
        : [];

    // Marque les maps de combat du boss (PreferredMaps du monstre) pour les
    // mettre en avant dans le sélecteur de map.
    let bossMapIds: number[] = [];
    const bossId = toSafeId(boss?.Id);
    if (bossId) {
        const monRaw = await dofensiveFetch<any>(`/monsters/${bossId}?lang=fr`, `dofensive-monster-${bossId}`);
        const mon = Array.isArray(monRaw) ? monRaw[0] : monRaw;
        if (mon && Array.isArray(mon.PreferredMaps)) {
            bossMapIds = mon.PreferredMaps.map((m: any) => Number(m.Id));
        }
    }

    return {
        success: true,
        data: {
            dungeonId: hit.Id as number,
            dungeonName: String(hit.Name ?? bossName),
            maps: dungeonMaps.map((m) => ({ ...m, isBoss: bossMapIds.includes(m.id) })),
            monsters: Array.isArray(hit.Monsters)
                ? hit.Monsters.map((m: any) => ({ id: m.Id as number, name: String(m.Name ?? "") }))
                : [],
            bossMonsterId: bossId,
        },
    };
}

/**
 * Résolution Dofensive DIRECTE pour un donjon « double boss » : on connaît le nom EXACT du monstre
 * (`dofensiveMonsterName`) et du donjon Dofensive (`dofensiveDungeonName`). On retrouve le donjon par son
 * nom, le monstre par son nom dans sa liste, et on marque les maps de combat du monstre (`isBoss`).
 * Retourne `null` si l'un des deux est introuvable (le caller retombe alors sur l'heuristique).
 */
async function resolveDofensiveDungeonDirect(
    monsterName: string,
    dungeonName?: string | null
): Promise<DofensiveDungeonInfo | null> {
    const mKey = norm(monsterName);
    const dKey = dungeonName ? norm(dungeonName) : "";

    const dungeons = await dofensiveFetch<any[]>("/dungeons/preview?lang=fr", "dofensive-dungeons-preview");
    if (!Array.isArray(dungeons)) return null;

    // 1. Candidats : ceux dont le nom matche le nom de donjon fourni, sinon ceux qui contiennent le monstre.
    let candidates = dungeons.filter((d) => {
        const dn = norm(String(d?.Name ?? ""));
        return dKey && (dn === dKey || dn.includes(dKey) || dKey.includes(dn));
    });
    if (candidates.length === 0) {
        candidates = dungeons.filter((d) =>
            Array.isArray(d?.Monsters) && d.Monsters.some((m: any) => norm(String(m?.Name ?? "")) === mKey)
        );
    }
    if (candidates.length === 0) return null;

    // Ambiguïté double boss : plusieurs donjons contiennent le même monstre (ex. « Klime » présent
    // dans « Salons privés de Klime » ET « Donjon du Comte Harebourg »). On préfère le donjon dont la
    // liste de monstres est la plus fournie (la « famille » = le donjon multi-boss), sans casser le cas
    // où un `dungeonName` explicite a déjà trié les candidats en tête.
    const sorted = [...candidates].sort((a, b) => (b?.Monsters?.length ?? 0) - (a?.Monsters?.length ?? 0));
    const hit = sorted[0];
    const boss = Array.isArray(hit.Monsters)
        ? (hit.Monsters.find((m: any) => norm(String(m?.Name ?? "")) === mKey) || hit.Monsters[0])
        : null;

    const dungeonMaps: DofensiveMapLite[] = Array.isArray(hit.Maps)
        ? hit.Maps.map((m: any) => ({ id: m.Id as number, name: String(m.Name ?? "") }))
        : [];

    let bossMapIds: number[] = [];
    const bossId = toSafeId(boss?.Id);
    if (bossId) {
        const monRaw = await dofensiveFetch<any>(`/monsters/${bossId}?lang=fr`, `dofensive-monster-${bossId}`);
        const mon = Array.isArray(monRaw) ? monRaw[0] : monRaw;
        if (mon && Array.isArray(mon.PreferredMaps)) {
            bossMapIds = mon.PreferredMaps.map((m: any) => Number(m.Id));
        }
    }

    return {
        dungeonId: hit.Id as number,
        dungeonName: String(hit.Name ?? monsterName),
        maps: dungeonMaps.map((m) => ({ ...m, isBoss: bossMapIds.includes(m.id) })),
        monsters: Array.isArray(hit.Monsters)
            ? hit.Monsters.map((m: any) => ({ id: m.Id as number, name: String(m.Name ?? "") }))
            : [],
        bossMonsterId: bossId,
    };
}

/** Charge une map réelle Dofensive (grille d'obstacles + cases de départ) — local-first. */
export async function getDofensiveMap(mapId: number | string): Promise<ActionResponse<DofensiveMapData>> {
    const id = toSafeId(mapId);
    if (!id) return { success: false, error: "ID de map invalide" };

    // 1. Essai local-first 🛰️ Lot 1 : une ligne **périmée** est servie (datée) — seul
    //    « aucune ligne » bascule sur le réseau.
    try {
        const local = await getLocalDofensiveMapAny(id);
        if (local) return localStaleResponse(local);
    } catch {
        // Fallback live ci-dessous
    }

    // 2. Fetch live Dofensive
    const raw = await dofensiveFetch<any>(`/maps/${id}?lang=fr`, `dofensive-map-${id}`);
    const item = Array.isArray(raw) ? raw[0] : raw;
    if (!item) return { success: false, error: "Map introuvable chez Dofensive" };

    const cells: number[][] = Array.isArray(item.Cells)
        ? item.Cells.map((row: any) => (Array.isArray(row) ? row.map((v: any) => Number(v) || 0) : []))
        : [];

    const data: DofensiveMapData = {
        id: item.Id as number,
        name: String(item.Name ?? ""),
        subarea: item.Subarea ? { id: item.Subarea.Id as number, name: String(item.Subarea.Name ?? "") } : null,
        dungeon: item.Dungeon ? { id: item.Dungeon.Id as number, name: String(item.Dungeon.Name ?? "") } : null,
        isBossMap: !!item.IsBossMap,
        coordinates: item.Coordinates ? { x: item.Coordinates.X as number, y: item.Coordinates.Y as number } : null,
        cells,
        allyCells: Array.isArray(item.AllyCells) ? item.AllyCells.map((v: any) => Number(v)) : [],
        enemyCells: Array.isArray(item.EnemyCells) ? item.EnemyCells.map((v: any) => Number(v)) : [],
    };

    // Auto-persistance locale en arrière-plan (self-healing)
    persistDofensiveMap(data).catch(() => {});

    return { success: true, data };
}

/** Charge un monstre Dofensive (maps préférées + donjons + sorts). */
export async function getDofensiveMonster(monsterId: number): Promise<ActionResponse<DofensiveMonsterData>> {
    const id = toSafeId(monsterId);
    if (!id) return { success: false, error: "ID de monstre invalide" };

    const raw = await dofensiveFetch<any>(`/monsters/${id}?lang=fr`, `dofensive-monster-${id}`);
    const item = Array.isArray(raw) ? raw[0] : raw;
    if (!item) return { success: false, error: "Monstre introuvable chez Dofensive" };

    return {
        success: true,
        data: {
            id: item.Id as number,
            name: String(item.Name ?? ""),
            preferredMaps: Array.isArray(item.PreferredMaps)
                ? item.PreferredMaps.map((m: any) => ({ id: m.Id as number, name: String(m.Name ?? "") }))
                : [],
            dungeons: Array.isArray(item.Dungeons)
                ? item.Dungeons.map((d: any) => ({ id: d.Id as number, name: String(d.Name ?? "") }))
                : [],
            spells: Array.isArray(item.Spells)
                ? item.Spells.map((s: any) => ({ id: s.Id as number, name: String(s.Name ?? "") }))
                : [],
        },
    };
}

// ─── Sorts Dofensive (données de combat riches) ─────────────────────────────
// Dofensive expose /spells/{id} avec les données de combat PAR GRADE (ActionPoints,
// MinRange/Range, CastInLine/CastInDiagonal/CastLineOfSight, MaxCastPerTurn,
// MinCastInterval, StateCriteria, zone AoE des effets). Source de vérité pour la
// simulation (bien plus fiable que les spell-levels DofusDB incomplets).
// Types partagés (client-safe) : src/lib/dofensive-spells.ts.

/** Normalise la zone AoE d'un effet Dofensive (shape déduite du nom FR + taille/portée). */
function normalizeZone(zone: any): DofensiveSpellZone | null {
    if (!zone || typeof zone !== "object") return null;
    const size = Math.max(0, Number(zone.Size) || 0);
    const range = Math.max(0, Number(zone.Range) || 0);
    const lower = String(zone.Name ?? "").toLowerCase();
    let shape: DofensiveZoneShape = "Inconnue";
    if (lower.includes("cercle")) shape = "Cercle";
    else if (lower.includes("ligne")) shape = "Ligne";
    else if (lower.includes("croix")) shape = "Croix";
    else if (lower.includes("cône") || lower.includes("cone")) shape = "Cône";
    else if (lower.includes("perpend")) shape = "Perpend";
    else if (lower.includes("rect")) shape = "Rectangle";
    else if (lower.includes("cellule") || lower.includes("proximité") || lower.includes("point")) shape = "Point";
    if (shape === "Inconnue" && size <= 0) shape = "Point";
    return { shape, size, range };
}

/**
 * Résout un template d'effet Dofensive (langage de format FR Ankama/Dofensive) :
 *   - `#N`              → valeur du paramètre N (ex. "#1 dommages Eau" + [101] → "101 dommages Eau")
 *   - `{s|#N}`/`{s|||#N}` → pluriel : "s" si |valeur| ≠ 1 (ex. "case{s|#1}" → "cases"/"case")
 *   - `{A|~B}`          → A si non vide, sinon B sans le préfixe `~` (ex. "{ à #2|~2}" → " à 110"/"")
 *   - `{A|0}`           → A si non vide, sinon rien (ex. "{La cible |0}" → "La cible ")
 * Ex. "#1{ à #2|~2} dommages Eau" + [101, 110] → "101 à 110 dommages Eau".
 */
function resolveTemplate(name: any, params: any[] | undefined): string {
    let s = String(name ?? "");
    // Pluriels — à résoudre AVANT les conditionnels génériques.
    s = s.replace(/\{s\|(#\d+)\}/g, (_m, ref: string) => (pluralizeParams(params, ref) ? "s" : ""));
    s = s.replace(/\{s\|\|\|(#\d+)\}/g, (_m, ref: string) => (pluralizeParams(params, ref) ? "s" : ""));
    // Conditionnels `{A|~B}` / `{A|0}` → A si non vide.
    s = s.replace(/\{([^}|]*)\|([^}]*)\}/g, (_m, a: string, b: string) => (a.trim() ? a : b.replace(/^~/, "")));
    // Paramètres `#N`.
    s = s.replace(/#(\d+)/g, (_m, n: string) => {
        const p = Array.isArray(params) ? params[Number(n) - 1] : undefined;
        return p && p.Name !== undefined && p.Name !== null ? String(p.Name) : "";
    });
    return s.replace(/\s+/g, " ").trim();
}

/** Pluriel Dofus : true si la valeur du paramètre référé (`#N`) n'est pas ±1. */
function pluralizeParams(params: any[] | undefined, ref: string): boolean {
    const n = Number(ref.slice(1));
    const v = Array.isArray(params) ? Number(params[n - 1]?.Name) : Number.NaN;
    return Number.isFinite(v) && Math.abs(v) !== 1;
}

/** Formate la durée d'un effet : -1 → « infini », N → « pour N tour(s) », 0 → null. */
function formatEffectDuration(duration: any): string | null {
    const d = Number(duration);
    if (!Number.isFinite(d) || d === 0) return null;
    if (d < 0) return "infini";
    return `pour ${d} tour${d > 1 ? "s" : ""}`;
}

/** Déclencheurs d'un effet Dofensive (Special/Caster/Target triggers). */
function renderEffectTriggers(effect: any): string[] {
    const out: string[] = [];
    const push = (arr: any, prefix: string | null) => {
        if (!Array.isArray(arr)) return;
        for (const t of arr) {
            const text = t ? resolveTemplate(t.Name, Array.isArray(t.Parameters) ? t.Parameters : undefined) : "";
            if (!text) continue;
            // En milieu de phrase (après le préfixe), on passe la 1re lettre en minuscule
            // (« La cible reçoit ... » → « la cible reçoit ... »).
            if (prefix) out.push(`${prefix}${text.charAt(0).toLowerCase()}${text.slice(1)}`);
            else out.push(text);
        }
    };
    push(effect.SpecialTriggers, null); // ex. « Effet déclenché immédiatement »
    push(effect.CasterTriggers, "L'effet est déclenché lorsque "); // ex. « le lanceur ... »
    push(effect.TargetTriggers, "L'effet est déclenché lorsque "); // ex. « la cible ... »
    return out;
}

/** Masques d'affectation d'un effet (inclusion/exclusion, ex. « Affecte le lanceur ... »). */
function renderEffectMasks(effect: any): string[] {
    const out: string[] = [];
    const push = (arr: any) => {
        if (!Array.isArray(arr)) return;
        for (const m of arr) {
            const text = m ? resolveTemplate(m.Name, Array.isArray(m.Parameters) ? m.Parameters : undefined) : "";
            if (text) out.push(text);
        }
    };
    push(effect.InclusionMasks);
    push(effect.ExclusionMasks);
    return out;
}

/** Collecte les effets structurés de tous les GroupEffects (toutes les cibles du sort).
 * Le **jet numérique** (`damage`) et la **distance de poussée** (`pushDistance`) sont extraits
 * ici, sur les effets DÉJÀ calculés : c'est la donnée de la prévisu de dégâts sur la grille
 * (aucun parsing de texte côté client). */
function collectEffectDetails(groups: any): DofensiveSpellEffect[] {
    const out: DofensiveSpellEffect[] = [];
    for (const group of Array.isArray(groups) ? groups : []) {
        for (const e of Array.isArray(group?.Effects) ? group.Effects : []) {
            const label = resolveTemplate(e?.Name, Array.isArray(e?.Parameters) ? e.Parameters : undefined);
            if (!label) continue;
            out.push({
                label,
                duration: formatEffectDuration(e?.Duration),
                triggers: renderEffectTriggers(e),
                masks: renderEffectMasks(e),
                damage: damageRangeOfEffect(e),
                pushDistance: pushDistanceOfEffect(e),
            });
        }
    }
    return out;
}

/**
 * Rattaché le **jet critique** au jet normal de MÊME élément (`GroupCriticalEffects` Dofensive).
 *
 * 🔒 Règle : les effets critiques sont appariés **dans l'ordre** aux effets normaux de leur
 * élément (le premier critique de l'élément va au premier normal, etc.). Un doublon (deux lignes
 * du même élément) reçoit donc SON jet critique, pas la somme ; une ligne sans équivalent critique
 * reste sans `critMin`/`critMax` ⇒ la prévisu n'affichera aucun coup critique pour cet élément
 * (jamais une fourchette inventée à partir du jet normal, ni une somme partielle).
 */
function attachCriticalDamage(
    details: DofensiveSpellEffect[],
    criticals: DofensiveSpellEffect[]
): DofensiveSpellEffect[] {
    const queues = new Map<string, { min: number; max: number }[]>();
    for (const crit of criticals) {
        const dmg = crit.damage;
        if (!dmg) continue;
        const element = String(dmg.element ?? "").toLowerCase();
        if (!element) continue;
        const queue = queues.get(element) ?? [];
        queue.push({ min: dmg.min, max: dmg.max });
        queues.set(element, queue);
    }
    if (queues.size === 0) return details;

    const used = new Map<string, number>();
    return details.map((d) => {
        const dmg = d.damage;
        if (!dmg) return d;
        const element = String(dmg.element ?? "").toLowerCase();
        const queue = queues.get(element);
        if (!queue) return d;
        const idx = used.get(element) ?? 0;
        const crit = queue[idx];
        if (!crit) return d;
        used.set(element, idx + 1);
        return { ...d, damage: { ...dmg, critMin: crit.min, critMax: crit.max } };
    });
}

/** Aplatit les effets en lignes « label (durée) » + lignes de déclencheurs. */
function flattenEffectLines(details: DofensiveSpellEffect[]): string[] {
    const lines: string[] = [];
    for (const d of details) {
        lines.push(d.duration ? `${d.label} (${d.duration})` : d.label);
        for (const tr of d.triggers) lines.push(tr);
    }
    return lines;
}

/**
 * Charge les sorts de combat d'un monstre Dofensive (AP, portée, LdV, ligne/diagonale,
 * cooldown, max cast, zone AoE). Grade = dernier niveau (le plus haut), cohérent avec
 * la fiche boss. Anti-SSRF : l'ID est validé avant toute construction d'URL.
 */
export async function getDofensiveSpells(
    monsterId: number,
    gradeLevel?: number,
    forceRefresh = false,
    locale: "fr" | "en" = "fr"
): Promise<ActionResponse<DofensiveSpellCombat[]>> {
    const id = toSafeId(monsterId);
    if (!id) return { success: false, error: "ID de monstre invalide" };

    // Local-first 🛰️ Lot 1 : les sorts de combat fusionnés du grade MAX sont en base
    // (`MonsterStat.stats.spells`) → zéro appel Dofensive, même si la ligne est **périmée**
    // (elle est alors servie datée via `stale`/`syncedAt`). Un changement de grade explicite
    // (gradeLevel) garde le fetch live (données par grade) ; `forceRefresh` (crons de sync)
    // re-fetch TOUJOURS la source.
    if (gradeLevel === undefined && !forceRefresh && locale === "fr") {
        try {
            const local = await getLocalDofensiveSpellsAny(id);
            // 🧯 Une forme de payload ANTÉRIEURE (siphon d'avant le lot 3a : aucun jet numérique,
            // mesuré 0/256 lignes) n'est **pas** servie : sans cela l'option « Dégâts estimés »
            // restait désactivée partout (« Aucun dégât ») et rien ne le signalait. On retombe sur
            // la source, qui recalcule les jets ET répare la ligne locale (`persistStoredCombatSpells`).
            // La règle `stale-while-offline` reste entière : si la source ne répond pas, la ligne
            // obsolète est servie telle quelle (jamais une absence).
            if (local && !local.payloadOutdated) return localStaleResponse(local);
        } catch {
            // Fallback live ci-dessous
        }
    }

    const monRaw = await dofensiveFetch<any>(`/monsters/${id}?lang=${locale}`, `dofensive-monster-${id}-${locale}`);
    const mon = Array.isArray(monRaw) ? monRaw[0] : monRaw;

    // 🎯 Calcul de dégâts (parité Dofensive « Activer le calcul de dégâts ») : les jets du
    // payload sont BRUTS ; l'API n'applique pas les caractéristiques du monstre. On les
    // calcule ici (`floor(jet × (1 + stat/100))`, Neutre non boosté) avec le grade du sort
    // affiché — sinon la fiche annonce « 74 à 86 » là où le combat inflige « 666 à 774 ».
    const damageStats = pickMonsterDamageStats(mon?.Grades, gradeLevel);
    // Grade de monstre RÉELLEMENT joué : il porte la carte `SpellGrades` (niveau de sort par grade)
    // — indispensable pour ne pas servir un niveau de sort que le monstre ne lance jamais.
    const activeGrade = pickMonsterGrade(mon?.Grades, gradeLevel);

    // Ordre affiché par Dofensive : sort de démarrage (StartingSpell du Grade) EN PREMIER,
    // puis la liste Spells. Ex. Fuji Givrefoux : Instinct maternel (2676) + ses 3 sorts.
    const spellIds: number[] = [];
    const pushId = (v: any) => {
        const n = toSafeId(v);
        if (n && !spellIds.includes(n)) spellIds.push(n);
    };
    if (Array.isArray(mon?.Grades)) {
        for (const g of mon.Grades) pushId(g?.StartingSpell?.Id);
    }
    if (Array.isArray(mon?.Spells)) {
        for (const s of mon.Spells) pushId(s?.Id);
    }
    if (spellIds.length === 0) return { success: false, error: "Aucun sort Dofensive" };

    const results: (DofensiveSpellCombat | null)[] = await Promise.all(
        spellIds.map(async (sid): Promise<DofensiveSpellCombat | null> => {
            const raw = await dofensiveFetch<any>(`/spells/${sid}?lang=${locale}`, `dofensive-spell-${sid}-${locale}`);
            const spell = Array.isArray(raw) ? raw[0] : raw;
            if (!spell) return null;
            const levels: any[] = Array.isArray(spell.Levels) ? spell.Levels : [];
            // 🔍 Niveau de sort = celui du GRADE DE MONSTRE (`Grades[].SpellGrades`), jamais « le
            // dernier niveau du sort » : mesuré le 22/09/2026 sur « Ancrépulsion » (15144), dont le
            // dernier niveau ne porte QUE « Repousse de 3 cases (sans dommages) » alors que le niveau
            // joué porte « 61 à 70 dommages Terre » ⇒ la fiche annonçait un sort sans dégâts.
            const level = pickSpellLevelForMonster(levels, sid, activeGrade);
            if (!level) return null;
            const firstEffect = level.GroupEffects?.[0]?.Effects?.[0];
            // Effets détaillés (tous les groupes de cibles) : durées, déclencheurs, masques.
            // Les jets passent AVANT par le calcul de dégâts (dégâts réels du grade), puis les
            // jets CRITIQUES du sort sont rattachés à leur ligne normale (même élément).
            const criticalDetails = collectEffectDetails(scaleDamageInEffectGroups(level.GroupCriticalEffects, damageStats));
            const effectDetails = attachCriticalDamage(
                collectEffectDetails(scaleDamageInEffectGroups(level.GroupEffects, damageStats)),
                criticalDetails
            );
            const effects = flattenEffectLines(effectDetails).slice(0, 30);
            // Effets critiques (GroupCriticalEffects) — section séparée (mêmes dégâts calculés).
            const criticalEffects = flattenEffectLines(criticalDetails).slice(0, 20);
            return {
                id: Number(spell.Id ?? sid),
                name: String(spell.Name ?? ""),
                // Icône officielle Dofensive (CDN, image/webp) — distincte par sort.
                imageUrl: `https://cdn.static.dofensive.com/dofensive/spells/${sid}`,
                apCost: Number(level.ActionPoints) || 0,
                minRange: Number(level.MinRange) || 0,
                range: Number(level.Range) || 0,
                castTestLos: level.CastLineOfSight ?? true,
                castInLine: level.CastInLine ?? false,
                castInDiagonal: level.CastInDiagonal ?? false,
                criticalChance: Number(level.CriticalProbability) || 0,
                // 0 = pas de restriction (ne PAS forcer à 1 : afficherait un mauvais « 1×/tour »).
                maxCastPerTurn: Number(level.MaxCastPerTurn) || 0,
                maxCastPerTarget: Number(level.MaxCastPerTarget) || 0,
                minCastInterval: Number(level.MinCastInterval) || 0,
                description: String(spell.Description ?? "") || undefined,
                grade: Number(level.Grade) || undefined,
                effects,
                effectDetails,
                criticalEffects: criticalEffects.length > 0 ? criticalEffects : undefined,
                hasCriticalEffects: criticalDetails.length > 0,
                zone: normalizeZone(firstEffect?.Zone),
            };
        })
    );

    const spells = results.filter((s): s is DofensiveSpellCombat => s !== null);
    if (spells.length === 0) return { success: false, error: "Sorts Dofensive vides" };
    // 🔧 Auto-réparation bornée du payload stocké : on vient de re-fetcher la source (forme
    // obsolète), on réécrit donc la ligne locale pour que les lectures suivantes restent locales
    // (sinon 1 + N appels réseau à chaque ouverture de fiche). Uniquement le payload CANONIQUE
    // (aucun grade explicite) : une lecture par grade ne doit pas écraser la forme « grade de
    // monstre » écrite par le siphon. Fail-soft : `false` ⇒ on rend simplement la donnée live.
    if (gradeLevel === undefined && locale === "fr") {
        await persistStoredCombatSpells(id, spells);
    }
    return { success: true, data: spells };
}

/**
 * Résout l'ID Dofensive d'un monstre (via son donjon, cache 24 h) puis charge ses
 * sorts de combat. Utilitaire pour la fiche boss quand on ne connaît que le nom.
 */
export async function getBossDofensiveSpells(
    monsterName: string,
    dungeonName?: string,
    gradeLevel?: number,
    forceRefresh = false,
    opts?: { dofensiveMonsterName?: string | null; dofensiveDungeonName?: string | null },
    locale: "fr" | "en" = "fr"
): Promise<ActionResponse<DofensiveSpellCombat[]>> {
    const dungeon = await getDofensiveDungeonForBoss(monsterName, dungeonName, opts);
    if (!dungeon.success || !dungeon.data) {
        // 🌀 Gardiens d'ANOMALIE (et tout monstre hors donjon Dofensive) : leurs sorts de combat
        // sont stockés par le siphon dans `MonsterStat.stats.spells` → lecture LOCALE par nom,
        // zéro appel réseau. Sans ce repli, la fiche d'un gardien (ex. Qilby, absent de
        // Dofensive) n'aurait aucun sort exploitable par la simulation isométrique.
        const storedName = opts?.dofensiveMonsterName ?? monsterName;
        const local = await getLocalDofensiveSpellsByName(storedName);
        if (local && local.length > 0) {
            // 🔧 Même règle que la lecture par ID : une **forme obsolète** (siphon antérieur au lot 3a,
            // donc sans jet numérique) est réparée depuis la source — `getDofensiveSpells` par l'ID
            // de la ligne locale (`getLocalMonsterStatAny`) réécrit ensuite le payload. Si la source
            // ne répond pas (ou ignore ce monstre), la ligne locale reste la réponse : jamais d'absence.
            const stored = await getLocalMonsterStatAny(storedName);
            const storedId = toSafeId(stored?.data?.id);
            if (stored?.payloadOutdated && storedId) {
                const healed = await getDofensiveSpells(storedId, gradeLevel, forceRefresh, locale);
                if (healed.success && healed.data) return healed;
            }
            return { success: true, data: local };
        }
        return { success: false, error: "Monstre Dofensive introuvable" };
    }

    // 🐞 FIX « les monstres de salle affichaient les sorts du boss » : on résout l'ID du
    // monstre DEMANDÉ dans la famille du donjon (`monsters`), au lieu de prendre
    // systématiquement `bossMonsterId` — sinon « Tambourreau » héritait des sorts de
    // « Servitude » (onglets du dashboard, overlay et simulation).
    // Le repli sur le boss reste garanti quand le nom demandé n'est pas dans la famille
    // (nommage DofusDB ≠ Dofensive) ⇒ aucune régression sur l'entité principale.
    const monsterId = pickDofensiveMonsterId(
        dungeon.data.monsters,
        opts?.dofensiveMonsterName ?? monsterName,
        dungeon.data.bossMonsterId
    );
    if (!monsterId) return { success: false, error: "Monstre Dofensive introuvable" };
    return getDofensiveSpells(monsterId, gradeLevel, forceRefresh, locale);
}

