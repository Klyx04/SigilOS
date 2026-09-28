/**
 * 🧑‍🏫 **Humanisation des valeurs du Journal game-data** (A3, 28/09/2026).
 *
 * ⚠️ Dette mesurée : la modale affichait `[3 : {"effectId":90,"from":1,…}]` — des identifiants
 * bruts là où l'utilisateur attend « Vitalité (1 à 15) ». Ce module transforme une valeur
 * journalisée (celle de `summarizeValue`, `@/lib/game-data-changelog`) en **texte lisible**, en
 * réutilisant les **règles du reste du site** (jamais une cascade recopiée) :
 *   · libellé d'effet → `resolveStatLabel` (+ référentiel siphonné `GameEffect`/`GameCharacteristic`) ;
 *   · plages → `normalizeNativeRange` (« 10 à 0 » n'existe pas ici non plus) ;
 *   · `typeId` → nom du champ **frère** de la même fiche (`typeName` = « Coiffe »), donc le nom de
 *     l'entité jointe, sans requête supplémentaire.
 *
 * ⚠️ Module **PUR** (aucun accès base, aucune dépendance React) : le référentiel arrive **en
 * paramètre**, l'action serveur le fournit (`loadMarketReferential`). Sans référentiel (base pas
 * encore alimentée), on retombe sur la table codée de `effects.ts` puis sur l'identifiant —
 * **jamais** un « — » muet à la place d'une valeur réelle.
 */

import { normalizeNativeRange, resolveStatLabel } from "@/lib/market/effects";

/** Référentiel minimal nécessaire à l'humanisation (extrait de `loadMarketReferential()`). */
export interface GameDataChangeReferential {
    /** `characteristicId` → libellé FR (« Vitalité », « Dommages Feu »). */
    labels: Record<number, string>;
    /** `effectId` → libellé FR. */
    effectLabels: Record<number, string>;
}

/** Référentiel vide : l'humanisation dégrade **proprement** (table codée, puis id). */
export const EMPTY_GAME_DATA_CHANGE_REFERENTIAL: GameDataChangeReferential = { labels: {}, effectLabels: {} };

/** Profondeur maximale explorée dans une valeur journalisée (les valeurs sont plates par construction). */
const REFERENTIAL_WALK_DEPTH = 4;

/**
 * 🔎 **Référentiel borné aux identifiants réellement affichés** (A3).
 *
 * Le référentiel complet (`loadMarketReferential`) porte **tous** les effets et caractéristiques du jeu :
 * l'envoyer entier à chaque ouverture de la modale serait un gaspillage de bande passante alors que la
 * page ne contient qu'un sous-ensemble. On ne garde donc que les ids **présents dans les lignes
 * renvoyées** — même invariant que le `groupBy` borné par dataset : la charge suit ce qu'on affiche.
 *
 * ⚠️ Si une ligne n'est pas encore chargée (rétention > page), son id n'est pas résolu : c'est
 * sans conséquence, l'utilisateur charge la suite via « Afficher les N derniers », qui recalcule
 * le référentiel **avec** les nouvelles lignes.
 */
export function collectGameDataChangeReferential(
    rows: readonly { fields?: Record<string, { before: unknown; after: unknown }> | null }[],
    referential: GameDataChangeReferential,
): GameDataChangeReferential {
    const labels: Record<number, string> = {};
    const effectLabels: Record<number, string> = {};
    for (const row of rows) {
        for (const field of Object.values(row.fields ?? {})) {
            walkIds(field.before, referential, labels, effectLabels, 0);
            walkIds(field.after, referential, labels, effectLabels, 0);
        }
    }
    return { labels, effectLabels };
}

/** Parcours **borné** d'une valeur : ne résout que les ids, ne recopie rien. */
function walkIds(
    value: unknown,
    referential: GameDataChangeReferential,
    labels: Record<number, string>,
    effectLabels: Record<number, string>,
    depth: number,
): void {
    if (depth > REFERENTIAL_WALK_DEPTH || value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
        for (const item of value) walkIds(item, referential, labels, effectLabels, depth + 1);
        return;
    }
    const row = value as Record<string, unknown>;
    keepId(row.effectId ?? row.int_id, referential.effectLabels, effectLabels);
    keepId(row.characteristic, referential.labels, labels);
    for (const item of Object.values(row)) walkIds(item, referential, labels, effectLabels, depth + 1);
}

function keepId(
    raw: unknown,
    source: Record<number, string>,
    target: Record<number, string>,
): void {
    const id = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
    if (!Number.isFinite(id)) return;
    const label = source[id];
    if (label) target[id] = label;
}

/** Taille maximale d'un texte rendu (une valeur journalisée ≤ 240 car. + libellés d'effets). */
export const GAME_DATA_CHANGE_VALUE_TEXT_MAX = 300;

/** Contexte d'affichage : le champ, la fiche (pour les noms frères) et le référentiel. */
export interface GameDataChangeValueContext {
    /** Champ journalisé (« effects », « apCost »…) — sert à nommer ce qui est affiché. */
    key: string;
    /** Tous les champs du même changement (permet `typeId` → `typeName`). */
    fields?: Record<string, { before: unknown; after: unknown }> | null;
    /** Côté affiché : le nom frère correspondant (`before` → `typeName` d'avant). */
    side?: "before" | "after";
    referential?: GameDataChangeReferential;
}

/**
 * Rend une valeur journalisée en **texte lisible** (jamais de JSON brut, jamais `[object Object]`).
 */
export function formatChangeValue(value: unknown, ctx: GameDataChangeValueContext): string {
    const refs = ctx.referential ?? EMPTY_GAME_DATA_CHANGE_REFERENTIAL;
    return clampText(formatValue(value, ctx, refs), GAME_DATA_CHANGE_VALUE_TEXT_MAX);
}


function formatValue(value: unknown, ctx: GameDataChangeValueContext, refs: GameDataChangeReferential): string {
    if (value === null || value === undefined) return "—";
    if (typeof value === "boolean") return value ? "oui" : "non";
    if (typeof value === "number") return formatScalar(value, ctx);
    if (typeof value === "string") return value.trim() === "" ? "—" : value;
    if (Array.isArray(value)) {
        if (value.length === 0) return "(vide)";
        return value.map((item) => formatValue(item, ctx, refs)).join(" · ");
    }
    if (typeof value === "object") {
        const row = value as Record<string, unknown>;
        const effect = formatEffectRow(row, refs);
        if (effect) return effect;
        const entries = Object.entries(row);
        if (entries.length === 0) return "(vide)";
        return entries.map(([key, item]) => `${key} : ${formatValue(item, { ...ctx, key }, refs)}`).join(" · ");
    }
    return String(value);
}

/** Scalaire : un `…Id` numérique est accompagné du **nom** porté par son champ frère. */
function formatScalar(value: number, ctx: GameDataChangeValueContext): string {
    const name = siblingName(ctx);
    return name ? `${value} — ${name}` : String(value);
}

/**
 * Nom de la fiche désignée par un champ `xxxId` (le diff porte `xxxName` sur **le même côté** :
 * l'« avant » est nommé par le nom d'avant, jamais par celui d'après).
 */
function siblingName(ctx: GameDataChangeValueContext): string | null {
    if (!ctx.fields || !ctx.key.endsWith("Id") || ctx.key.length <= 2) return null;
    const sibling = ctx.fields[`${ctx.key.slice(0, -2)}Name`];
    if (!sibling) return null;
    const ordered: unknown[] =
        ctx.side === "before" ? [sibling.before, sibling.after] : [sibling.after, sibling.before];
    for (const candidate of ordered) {
        if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
    return null;
}

/**
 * Ligne d'**effet** (objet portant un `effectId`/`characteristic`) ⇒ « Vitalité (1 à 15) ».
 * `null` si l'objet n'est pas une ligne d'effet (l'appelant fait alors un rendu générique).
 */
function formatEffectRow(row: Record<string, unknown>, refs: GameDataChangeReferential): string | null {
    const effectId = toNumber(row.effectId ?? row.int_id);
    const characteristic = toNumber(row.characteristic);
    if (effectId === null && characteristic === null) return null;
    const referentialLabel =
        (effectId !== null ? refs.effectLabels[effectId] : undefined) ??
        (characteristic !== null ? refs.labels[characteristic] : undefined) ??
        null;
    const intName = typeof row.int_name === "string" && row.int_name.trim() ? row.int_name.trim() : null;
    const label =
        resolveStatLabel({ effectId, characteristic }, referentialLabel) ??
        intName ??
        (effectId !== null ? `Effet #${effectId}` : `Caractéristique #${characteristic}`);
    const range = formatEffectRange(row);
    return range ? `${label} (${range})` : label;
}

/**
 * Plage d'un effet journalisé — **mêmes règles que le marché** (`normalizeNativeRange`) : un second dé
 * absent (`diceSide = 0`) est une **valeur fixe**, donc « 10 » et jamais « 10 à 0 ».
 */
function formatEffectRange(row: Record<string, unknown>): string | null {
    const from = toNumber(row.from ?? row.diceNum);
    const to = toNumber(row.to ?? row.diceSide);
    if (from === null && to === null) return null;
    const range = normalizeNativeRange(from ?? 0, to ?? 0);
    return range.from === range.to ? String(range.from) : `${range.from} à ${range.to}`;
}

function toNumber(value: unknown): number | null {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function clampText(value: string, max: number): string {
    return value.length > max ? `${value.slice(0, max)}…` : value;
}
