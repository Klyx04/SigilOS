/**
 * Module « Avis de recherche » (bounties) — module **PUR** (aucun import serveur / prisma /
 * auth), importable côté client comme côté serveur.
 *
 * Source de vérité du contenu : **siphon** (`src/lib/bounty-siphon.ts`, phase 4 du cron
 * `sync-monster-stats`), jamais saisi à la main :
 *   - DofusDB `monster-races/{32,90,127,147,156}` → la **LISTE** des avis (l'appartenance se
 *     lit par **RACE** : le drapeau `isBounty` est faux pour 14 des 96 — mesuré le 16/09/2026) ;
 *   - DofusDB `monsters?race=…` → grades, butin (`drops`), sous-zones, sorts, visuel ;
 *   - Dofensive `/monsters/{id}` → **preuve d'appartenance** (`Race.Name`), **zone de traque**
 *     (`Subareas[].IsFavorite`), critères de quête, sorts de combat.
 *
 * Mesures de référence (sondes `src/temp/_probe-bounties-gap.mjs` + `_probe-bounty-list.mjs`) :
 * 96 avis (38 + 21 + 15 + 19 + 3, 0 doublon) · niveaux **1 → 1600** · 81 sous-zones ·
 * 15 avis sans sous-zone · 5 sans sort · **maps sauvages non exposées par Dofensive**
 * (grille `Cells` = stub) ⇒ carte de simulation = **repli déclaré**, jamais une carte inventée.
 */
import { DEFAULT_ANOMALY_MAP } from "@/lib/anomaly-boss";

/** Races DofusDB « Avis de recherche » (ordre = source, stable d'un siphon à l'autre). */
export const BOUNTY_RACE_IDS = [32, 90, 127, 147, 156] as const;

/** Libellés officiels DofusDB des races d'avis (affichage fiche / catalogue / filtres). */
export const BOUNTY_RACE_NAMES: Record<number, string> = {
    32: "Avis de recherche",
    90: "Avis de recherche de Frigost",
    127: "Avis de recherche des Dimensions",
    147: "Avis de recherche alignés",
    156: "Avis de recherche de Sufokia",
};

/** Famille Dofensive des avis (« Créatures de quête ») — 2ᵉ preuve d'appartenance. */
export const BOUNTY_FAMILY_ID = 27;
export const BOUNTY_FAMILY_NAME = "Cr\u00e9atures de qu\u00eate";

/** Sous-chaîne discriminant un libellé de race « avis de recherche » (comparaison normalisée). */
const BOUNTY_LABEL = "avis de recherche";

/**
 * Carte de combat de la **simulation** d'un avis.
 *
 * Dofensive n'expose **aucune** carte pour un avis (`PreferredMaps: []`, `Dungeons: []`) et la
 * grille d'une map **sauvage** (sous-zone) renvoie un stub (`Name: null`, `Cells: {}`) — mesuré.
 * On emprunte donc la carte générique déjà siphonnée et **en base** (la même que les anomalies
 * temporelles), en l'annonçant comme telle côté UI (`BOUNTY_MAP_FALLBACK_LABEL`).
 */
export const BOUNTY_FALLBACK_MAP = { id: DEFAULT_ANOMALY_MAP.id, name: DEFAULT_ANOMALY_MAP.name } as const;

/** Libellé produit quand la simulation utilise la carte de repli (jamais présenté comme la vraie). */
export const BOUNTY_MAP_FALLBACK_LABEL = "Carte de chasse générique";

/** Origine de la carte de simulation d'un avis. */
export type BountyMapSource = "default" | "dofensive";

/** Une sous-zone DofusDB/Dofensive (`subareas` / `Subareas`). */
export interface BountySubarea {
    id: number;
    name: string;
    isFavorite?: boolean;
}

/** Suffixe d'URL publique (slug stable et unique, même pour les homonymes). */
export function bountySlug(name: string, dofusdbId: number | string | null | undefined): string {
    const base = String(name ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/['\u2019`]/g, " ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");
    const id = Math.floor(Number(dofusdbId) || 0);
    return id > 0 ? `${base || "avis"}-${id}` : base || "avis";
}

/** L'id de race appartient-il au périmètre « avis de recherche » ? */
export function isBountyRace(raceId: number | string | null | undefined): boolean {
    const id = Math.floor(Number(raceId) || 0);
    return id > 0 && (BOUNTY_RACE_IDS as readonly number[]).includes(id);
}

/** Le libellé de race est-il un « avis de recherche » ? (repli quand aucun id n'est fourni.) */
export function isBountyRaceName(raceName: string | null | undefined): boolean {
    return String(raceName ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .includes(BOUNTY_LABEL);
}

/** Libellé de race d'un avis (source si connue, sinon libellé générique). */
export function bountyRaceName(raceId: number | null | undefined, fallback?: string | null): string {
    const id = Math.floor(Number(raceId) || 0);
    return BOUNTY_RACE_NAMES[id] ?? (String(fallback ?? "").trim() || "Avis de recherche");
}

/**
 * Normalise une liste de sous-zones DofusDB (`subareas: number[]`, ids nus) ou Dofensive
 * (`Subareas: [{ Id, Name, IsFavorite }]`) en `BountySubarea[]` dédoublonnée.
 * Aucune invention : une entrée sans id exploitable est écartée.
 */
export function normalizeBountySubareas(raw: unknown): BountySubarea[] {
    const out: BountySubarea[] = [];
    const seen = new Set<number>();
    for (const item of Array.isArray(raw) ? raw : []) {
        // DofusDB renvoie des **ids nus** (883) ; Dofensive des objets `{ Id, Name, IsFavorite }`.
        const rawId = item !== null && typeof item === "object"
            ? ((item as any)?.id ?? (item as any)?.Id)
            : item;
        const id = Math.floor(Number(rawId) || 0);
        if (id <= 0 || seen.has(id)) continue;
        seen.add(id);
        out.push({
            id,
            name: String((item as any)?.name ?? (item as any)?.Name ?? "").trim(),
            isFavorite: !!((item as any)?.isFavorite ?? (item as any)?.IsFavorite),
        });
    }
    return out;
}

/**
 * **Zone de traque** d'un avis : sous-zone favorite si la source la marque, sinon la première,
 * sinon `null` (15 des 96 avis n'ont aucune sous-zone — mesuré : on ne fabrique pas de zone).
 */
export function pickBountySubarea(raw: unknown): BountySubarea | null {
    const subareas = normalizeBountySubareas(raw);
    if (subareas.length === 0) return null;
    return subareas.find((s) => s.isFavorite) ?? subareas[0];
}

/** Niveaux d'un avis depuis ses grades DofusDB (5 ou 7 grades selon l'avis). */
export function bountyLevelRange(grades: unknown): { min: number | null; max: number | null } {
    const levels = (Array.isArray(grades) ? grades : [])
        .map((g: any) => Math.floor(Number(g?.level) || 0))
        .filter((n) => n > 0);
    if (levels.length === 0) return { min: null, max: null };
    return { min: Math.min(...levels), max: Math.max(...levels) };
}

/** Niveau affiché d'un avis : le plus haut grade (règle des fiches boss/titans). */
export function bountyLevel(grades: unknown, fallback = 1): number {
    const { max } = bountyLevelRange(grades);
    return max ?? fallback;
}

/** Carte de simulation d'un avis : la carte siphonnée si elle existe, sinon le repli DÉCLARÉ. */
export function pickBountyBattleMap(mapId: number | null | undefined): { id: number; source: BountyMapSource } {
    const id = Math.floor(Number(mapId) || 0);
    return id > 0 ? { id, source: "dofensive" } : { id: BOUNTY_FALLBACK_MAP.id, source: "default" };
}

/** URL publique DofusDB d'un avis (référence de source, affichée dans God et la fiche). */
export function bountyDofusDbUrl(dofusdbId: number | null | undefined): string | null {
    const id = Math.floor(Number(dofusdbId) || 0);
    return id > 0 ? `https://dofusdb.fr/fr/database/monster/${id}` : null;
}

/** URL publique Dofensive d'un avis (le bestiaire expose les 96). */
export function bountyDofensiveUrl(dofusdbId: number | null | undefined): string | null {
    const id = Math.floor(Number(dofusdbId) || 0);
    return id > 0 ? `https://dofensive.com/fr/monster/${id}` : null;
}

/** Ids de sorts d'un avis côté DofusDB (dédupliqués, ordre source). */
export function bountyDofusDbSpellIds(monster: unknown): number[] {
    const seen = new Set<number>();
    for (const id of (Array.isArray((monster as any)?.spells) ? (monster as any).spells : [])) {
        const n = Math.floor(Number(id) || 0);
        if (n > 0) seen.add(n);
    }
    return [...seen];
}

/**
 * Ids de sorts de combat côté Dofensive : `Spells[]` **+** le sort d'ouverture du grade 1
 * (`Grades[0].StartingSpell`, absent de `Spells[]` — ex. Predagob 4834 : 8586 + 8589/8590/8591).
 */
export function bountyDofensiveSpellIds(monster: unknown): number[] {
    const seen = new Set<number>();
    const push = (id: unknown) => {
        const n = Math.floor(Number(id) || 0);
        if (n > 0) seen.add(n);
    };
    for (const s of (Array.isArray((monster as any)?.Spells) ? (monster as any).Spells : [])) push((s as any)?.Id);
    for (const g of (Array.isArray((monster as any)?.Grades) ? (monster as any).Grades : [])) push((g as any)?.StartingSpell?.Id);
    return [...seen];
}

/**
 * Objets de butin d'un avis (DofusDB `drops[].objectId`) — la « preuve de chasse » est l'objet
 * portant le nom de l'avis, délivré sous critères de quête (`Drops[0].Criteria`).
 */
export function bountyDropObjectIds(monster: unknown): number[] {
    const seen = new Set<number>();
    for (const d of (Array.isArray((monster as any)?.drops) ? (monster as any).drops : [])) {
        const id = Math.floor(Number((d as any)?.objectId) || 0);
        if (id > 0) seen.add(id);
    }
    return [...seen];
}

/**
 * Libellés des **critères de quête** d'un avis (texte RÉEL de Dofensive, jamais reformulé) :
 * aplati depuis `Drops[].Criteria` (conditions « On recherche … », « Posséder Touflage », …).
 */
export function bountyCriteriaLabels(monster: unknown): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const drop of (Array.isArray((monster as any)?.Drops) ? (monster as any).Drops : [])) {
        for (const group of (Array.isArray((drop as any)?.Criteria) ? (drop as any).Criteria : [])) {
            for (const cond of (Array.isArray(group) ? group : [group])) {
                const label = String((cond as any)?.Name ?? "").trim();
                if (!label || seen.has(label)) continue;
                seen.add(label);
                out.push(label);
            }
        }
    }
    return out;
}

/**
 * Un avis Dofensive est-il **prouvé** ? (`Race.Name` = « Avis de recherche » **ou**
 * `Family.Id` = 27 « Créatures de quête ».) Sans preuve, l'entrée n'est pas servie comme avis.
 */
export function isProvenBounty(monster: unknown): boolean {
    const raceName = (monster as any)?.Race?.Name ?? (monster as any)?.raceName ?? null;
    const familyId = Math.floor(Number((monster as any)?.Family?.Id ?? (monster as any)?.familyId) || 0);
    return isBountyRaceName(raceName) || familyId === BOUNTY_FAMILY_ID;
}
