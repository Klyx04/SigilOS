/**
 * Module « Boss d'anomalie » (Gardiens des anomalies temporelles) — module PUR
 * (aucun import serveur / prisma / auth), importable côté client comme côté serveur.
 *
 * Source de vérité du contenu : **siphon** (cron `sync-monster-stats`), jamais saisi à la main :
 *   - DofusDB `monsters?race=191` → la LISTE des gardiens (16 entités, dont Qilby 8131) ;
 *   - Dofensive `/monsters/{id}`  → carte de combat (`PreferredMaps`), race/famille, type ;
 *   - DofusDB `spells` + `spell-levels` → sorts de combat (AP/portée/LoS/zone) quand
 *     Dofensive n'expose pas le gardien (cas de Qilby, dernier-né absent du bestiaire Dofensive).
 *
 * Ce module ne dépend d'aucune API : il ne contient que les constantes et les
 * transformations pures (testables sans réseau ni base).
 */
import type { DofensiveSpellZone, DofensiveZoneShape } from "@/lib/dofensive-spells";

/** Race DofusDB des gardiens d'anomalie (« Gardiens des anomalies »). */
export const ANOMALY_RACE_ID = 191;

/** Libellés officiels (Dofensive) — affichés dans les fiches / le catalogue. */
export const ANOMALY_RACE_NAME = "Gardiens des anomalies";
export const ANOMALY_FAMILY_NAME = "Cr\u00e9atures des Anomalies Temporelles";

/**
 * Map de combat PAR DÉFAUT des gardiens d'anomalie.
 *
 * Utilisée quand aucune carte n'est siphonnée pour le gardien : DofusDB n'expose aucune
 * localisation pour cette race (`subareas: []`) et les gardiens les plus récents
 * (Qilby, id 8131) ne sont pas encore exposés par Dofensive (pas de `PreferredMaps`).
 * On retombe alors sur le hub des anomalies temporelles — jamais une carte vide.
 */
export const DEFAULT_ANOMALY_MAP = { id: 196089348, name: "Abysses du temps" } as const;

/** Libellé de repli quand ni la carte siphonnée ni la map par défaut ne sont exploitables. */
export const ANOMALY_MAP_FALLBACK_LABEL = "Anomalie temporelle";

/**
 * Nom d'entrée `Dungeon` d'un boss d'anomalie : la CARTE de combat (ex. « Tour minérale »,
 * « Caverne d'Aguabrial »), conformément au modèle des fiches boss (« donjon = emplacement,
 * bossName = entité »). Plusieurs gardiens peuvent partager la même carte.
 */
export function buildAnomalyDungeonName(mapName: string | null | undefined): string {
    const clean = String(mapName ?? "").trim();
    return clean || ANOMALY_MAP_FALLBACK_LABEL;
}

/** URL publique DofusDB d'un gardien (référence de source). */
export function anomalyDofusDbUrl(dofusdbId: number | null | undefined): string | null {
    const id = Number(dofusdbId);
    return Number.isFinite(id) && id > 0 ? `https://dofusdb.fr/fr/database/monster/${Math.floor(id)}` : null;
}

/** URL publique Dofensive d'un gardien (null si l'entité n'est pas exposée par Dofensive). */
export function anomalyDofensiveUrl(dofusdbId: number | null | undefined): string | null {
    const id = Number(dofusdbId);
    return Number.isFinite(id) && id > 0 ? `https://dofensive.com/fr/monster/${Math.floor(id)}` : null;
}

/**
 * Table de correspondance des formes de zone DofusDB → libellés Dofensive.
 *
 * DofusDB encode `zoneDescr.shape` avec le code ASCII du gabarit Ankama (`'P'` = 80, `'L'` = 76,
 * `'C'` = 67, `'X'` = 88…). Calibré en comparant les deux sources sur des sorts présents
 * des deux côtés (session du 15/09/2026) :
 *   - 12129 « Frappe Cristalline » : shape 88 / param1=4 → Dofensive « Croix » size 4 ;
 *   - 12346 « Épicentre »          : shape 88 / param1=1 → Dofensive « Croix » size 1 ;
 *   - 12237 « Coup de Marre d'eau » : shape 80          → Dofensive « Cellule ciblée » (Point) ;
 *   - 12038 « Charge Éclair »      : shape 76          → Dofensive « Ligne partant du lanceur ».
 * Les gabarits non identifiés (`'Q'`, `'O'`…) restent « Inconnue » : on n'invente rien.
 */
const ZONE_SHAPE_BY_CODE: Record<string, DofensiveZoneShape> = {
    P: "Point",
    L: "Ligne",
    C: "Cercle",
    X: "Croix",
    // Mesure du 22/09/2026 (`api.dofusdb.fr`, table gabarit → nom Dofensive) : `T` (84) = 7
    // « Ligne perpendiculaire » (Vague à Lame 12794, `param1: 1` ⇒ 3 cases) · `G` (71) = 11
    // « Carré » (Aquatruc 11437, `param1: 1`). Les autres codes restent « Inconnue ».
    T: "Perpend",
    G: "Rectangle",
};

/** Convertit un `zoneDescr` DofusDB en zone Dofensive (null si aucune zone exploitable). */
export function toAnomalyZone(zoneDescr: unknown): DofensiveSpellZone | null {
    if (!zoneDescr || typeof zoneDescr !== "object") return null;
    const z = zoneDescr as { shape?: unknown; param1?: unknown };
    const shapeCode = typeof z.shape === "number" && z.shape > 0 ? String.fromCharCode(z.shape) : "";
    const shape = ZONE_SHAPE_BY_CODE[shapeCode] ?? (shapeCode ? "Inconnue" : "Point");
    const size = Math.max(0, Number(z.param1) || 0);
    return { shape, size, range: 0 };
}

/**
 * Regroupe des gardiens d'anomalie par carte de combat → noms des co-gardiens de la même carte
 * (les « monstres de salle » de l'anomalie). Les gardiens sans carte connue sont regroupés
 * sous la map par défaut.
 */
export function groupAnomalyGuardiansByMap(
    guardians: { name: string; mapId?: number | null }[]
): Record<number, string[]> {
    const groups: Record<number, string[]> = {};
    for (const g of guardians) {
        const name = String(g?.name ?? "").trim();
        if (!name) continue;
        const rawMap = Number(g?.mapId);
        const mapId = Number.isFinite(rawMap) && rawMap > 0 ? Math.floor(rawMap) : DEFAULT_ANOMALY_MAP.id;
        if (!groups[mapId]) groups[mapId] = [];
        if (!groups[mapId].includes(name)) groups[mapId].push(name);
    }
    return groups;
}

/** Résout la carte de combat d'un gardien : carte siphonnée > map par défaut. */
export function resolveAnomalyMap(
    preferredMaps: { id?: unknown; name?: unknown }[] | null | undefined
): { id: number; name: string; isDefault: boolean } {
    const list = Array.isArray(preferredMaps) ? preferredMaps : [];
    for (const m of list) {
        const id = Number(m?.id);
        const name = String(m?.name ?? "").trim();
        if (Number.isFinite(id) && id > 0) {
            return { id: Math.floor(id), name: buildAnomalyDungeonName(name), isDefault: false };
        }
    }
    return { id: DEFAULT_ANOMALY_MAP.id, name: DEFAULT_ANOMALY_MAP.name, isDefault: true };
}

/** Un `Dungeon` est-il un boss d'anomalie ? (type guard léger, utilisable côté client). */
export function isAnomalyBossDungeon(dungeon: { isAnomalyBoss?: boolean | null } | null | undefined): boolean {
    return !!dungeon?.isAnomalyBoss;
}

/**
 * Ne garde que les gardiens qui SONT des boss (DofusDB `isBoss` / Dofensive `Type = 3`).
 *
 * Les autres membres de la race 191 sont des **créatures d'accompagnement** d'une anomalie
 * (ex. « Cristal Malakite », « Bourgeon de Dathura », niveau 20) : ils n'ont pas d'occurrence
 * propre et ne doivent donc pas créer de fiche « Boss Anomalie » (ils restent visibles comme
 * « monstres de salle » via la famille de la carte).
 */
export function pickAnomalyBossEntries<T extends { isBoss?: boolean | null }>(guardians: T[]): T[] {
    return (Array.isArray(guardians) ? guardians : []).filter((g) => !!g?.isBoss);
}

// ─── Monstres de l'anomalie (accompagnateurs : Briko / Bruto / Gromo) ─────────
//
// En combat d'anomalie, le gardien est accompagné de **3 monstres tirés au hasard** parmi
// une liste fixe (« Le combat contre Qilby … Qilby est toujours accompagné de 3 monstres
// définis aléatoirement à l'ouverture de l'anomalie parmi une liste de 15 monstres »).
//
// Rattachement SOURCÉ (mesuré le 15/09/2026, aucune déduction) : ces monstres et les gardiens
// partagent la **même famille Dofensive** — `Family.Id = 35` « Créatures des Anomalies
// Temporelles ». Ils n'ont **ni carte** (`PreferredMaps: []`) **ni sous-zone** DofusDB : le
// rattachement aux boss se fait donc par la FAMILLE, jamais par une carte.

/** Famille Dofensive des créatures d'anomalie temporelle (gardiens ET accompagnateurs). */
export const ANOMALY_COMPANION_FAMILY_ID = 35;

/**
 * Races DofusDB des accompagnateurs (sous-races « -morphes » de la famille 35) :
 *   192 = « Gromorphes »  → Gromo Envahissant / Écrasant / Endurant / Intercepteur / Protecteur (+ Intercepteur) ;
 *   194 = « Brutomorphes » → Bruto Acharné / Virulent / Pernicieux / Frénétique / Colérique ;
 *   195 = « Brikomorphes » → Briko Taquin / Stimulant / Altruiste / Galvanisant / Exaltant.
 * L'appartenance à la famille est **vérifiée pour chaque membre** via Dofensive
 * (`Family.Id === ANOMALY_COMPANION_FAMILY_ID`) : si une race gagnait un monstre hors famille,
 * il serait écarté automatiquement.
 */
export const ANOMALY_COMPANION_RACE_IDS = [192, 194, 195] as const;

/** Nombre d'accompagnateurs tirés au hasard à l'ouverture d'une anomalie (règle de jeu). */
export const ANOMALY_COMPANION_PICK = 3;

/** Référence minimale d'un monstre d'anomalie (gardien ou accompagnateur). */
export interface AnomalyMonsterRef {
    id: number;
    name: string;
    level?: number | null;
    isBoss?: boolean | null;
    raceId?: number | null;
    raceName?: string | null;
}

/** Un monstre est-il un **accompagnateur d'anomalie** ? (famille 35, hors gardiens race 191.) */
export function isAnomalyCompanion(m: {
    raceId?: number | null;
    familyId?: number | null;
    isBoss?: boolean | null;
} | null | undefined): boolean {
    if (m?.isBoss) return false;
    const raceId = Math.floor(Number(m?.raceId) || 0);
    if (raceId === ANOMALY_RACE_ID) return false;
    return Math.floor(Number(m?.familyId) || 0) === ANOMALY_COMPANION_FAMILY_ID;
}

/**
 * Déduplique et ordonne les accompagnateurs (par race DofusDB puis id) — l'ordre des sources
 * (`Gromorphes` → `Brutomorphes` → `Brikomorphes`), stable d'un siphon à l'autre.
 */
export function orderAnomalyCompanions<T extends { id: number; raceId?: number | null }>(
    monsters: T[] | null | undefined
): T[] {
    const seen = new Set<number>();
    const out: T[] = [];
    for (const m of Array.isArray(monsters) ? monsters : []) {
        const id = Math.floor(Number(m?.id) || 0);
        if (id <= 0 || seen.has(id)) continue;
        seen.add(id);
        out.push(m);
    }
    return out.sort(
        (a, b) =>
            Math.floor(Number(a?.raceId) || 0) - Math.floor(Number(b?.raceId) || 0) ||
            Math.floor(Number(a?.id) || 0) - Math.floor(Number(b?.id) || 0)
    );
}

/**
 * Pool de monstres d'un combat d'anomalie : **le gardien courant**, ses co-gardiens de la
 * carte, puis les **accompagnateurs** (3 tirés au hasard en jeu). Sert à la simulation
 * tactique (`SpellRangeGrid`) pour reproduire « 1 boss + 3 mobs ». Dédupliqué par id.
 */
export function buildAnomalyMonsterPool(
    family: AnomalyMonsterRef[] | null | undefined,
    companions: AnomalyMonsterRef[] | null | undefined,
    self?: AnomalyMonsterRef | null
): AnomalyMonsterRef[] {
    const seen = new Set<number>();
    const out: AnomalyMonsterRef[] = [];
    const push = (m: AnomalyMonsterRef | null | undefined) => {
        const id = Math.floor(Number(m?.id) || 0);
        const name = String(m?.name ?? "").trim();
        if (id <= 0 || !name || seen.has(id)) return;
        seen.add(id);
        out.push({ ...m, id, name });
    };
    push(self);
    for (const m of Array.isArray(family) ? family : []) push(m);
    for (const m of Array.isArray(companions) ? companions : []) push(m);
    return out;
}

/** Libellé produit des accompagnateurs : « 3 au hasard parmi 16 ». */
export function anomalyCompanionHint(count: number | null | undefined): string {
    const n = Math.floor(Number(count) || 0);
    if (n <= 0) return "accompagnateurs indisponibles";
    return `${ANOMALY_COMPANION_PICK} au hasard parmi ${n}`;
}


