/**
 * **Enrichissement du guide Rush déjà en base** — règle pure (itération 3b).
 *
 * L'import consolidé (`importRushGuide`) est **additif** et le reste : il crée les
 * blocs et les quêtes manquants, mais ne réécrit jamais une séquence existante.
 * Les conseils (2b) et les monstres des combats (2a) du seed ne peuvent donc pas
 * atteindre un guide déjà en base — mesure du 20/11/2026 sur la base locale :
 * **530 conseils vides / 536**, **742 tags de combat sans un seul monstre / 742**.
 *
 * Cette règle comble ce trou **sans jamais écraser un texte God** :
 *
 * | Champ | Condition d'écriture | Sinon |
 * |---|---|---|
 * | `tips` (conseil de quête) | vide en base **et** non vide dans le payload | le texte God gagne, toujours |
 * | `activityTags[].monsters` | tag de combat **sans** liste, rapproché par `type` + nom normalisé | un tag qui a déjà sa liste est laissé tel quel |
 *
 * Rien d'autre n'est touché : ni `note`, ni ressources, ni succès, ni donjons, ni
 * position. Aucun tag n'est ajouté ni supprimé — un tag de combat que le payload
 * ne sait pas résoudre reste **signalé**, jamais deviné (5 cas mesurés).
 *
 * Le rapprochement est celui de l'import : **(bloc, nom de séquence)** normalisés,
 * la première occurrence du payload gagnant. Une séquence absente du payload est
 * ignorée. La règle est **idempotente** : un second passage ne propose rien.
 */

import { importKey, type RushImportActivityTag, type RushImportPayload } from "@/lib/rush-import";
import {
    MAX_RUSH_COMBAT_MONSTERS,
    normalizeRushCombatMonsterName,
    type RushCombatMonster,
} from "@/lib/rush-combat-monsters";

/** Types de tag qui portent un groupe de monstres (le studio et le seed écrivent ceux-là). */
export const RUSH_CONTENT_COMBAT_TAG_TYPES = ["combat_solo", "combat_plusieurs"] as const;

/** Plafond d'un conseil de quête — même borne que le schéma d'import. */
export const RUSH_CONTENT_TIPS_MAX = 4000;

/** Tag d'activité tel qu'il vit en base (JSON Prisma), lu sans le typage du studio. */
export type RushContentTag = {
    type?: string;
    name?: string;
    monsters?: RushCombatMonster[];
    [key: string]: unknown;
};

/** Séquence existante, telle que la lit l'action God. */
export type RushContentSequence = {
    id: string;
    /** Titre du bloc porteur : le rapprochement est (bloc, nom), comme l'import. */
    blockTitle: string;
    name: string;
    tips?: string | null;
    activityTags?: unknown;
};

/** Une séquence à écrire : seuls les champs réellement modifiés sont non nuls. */
export type RushContentUpdate = {
    sequenceId: string;
    name: string;
    /** Conseil à poser — `null` quand le texte God est conservé ou déjà rempli. */
    tips: string | null;
    /** Tags complets patchés — `null` quand aucun monstre n'est ajouté. */
    activityTags: RushContentTag[] | null;
    tipsFilled: boolean;
    /** Nombre de tags de combat effectivement enrichis (0 pour un conseil seul). */
    tagsPatched: number;
    monstersAdded: number;
};

export type RushContentSyncPlan = {
    updates: RushContentUpdate[];
    /** Séquences du guide absentes du payload (aucun rapprochement possible). */
    unmatched: number;
    /** Conseils God différents du seed : jamais écrasés. */
    tipsProtected: number;
    /** Tags de combat qui portent déjà leur liste (idempotence). */
    tagsAlready: number;
    /** Tags de combat que le payload ne sait pas résoudre — signalés, pas devinés. */
    tagsWithoutSource: number;
};

/** Résumé transportable au client : jamais les 737 tags complets. */
export type RushContentSyncSummary = {
    sequences: number;
    updates: number;
    tips: number;
    tags: number;
    monsters: number;
    tipsProtected: number;
    tagsAlready: number;
    tagsWithoutSource: number;
    unmatched: number;
    sample: Array<{ name: string; tipsFilled: boolean; monstersAdded: number }>;
};

function asTags(value: unknown): RushContentTag[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
        (tag): tag is RushContentTag =>
            Boolean(tag) && typeof tag === "object" && !Array.isArray(tag)
    );
}

function isCombatTag(tag: RushContentTag): boolean {
    return (RUSH_CONTENT_COMBAT_TAG_TYPES as readonly string[]).includes(String(tag.type ?? ""));
}

function hasMonsters(tag: RushContentTag): boolean {
    return Array.isArray(tag.monsters) && tag.monsters.length > 0;
}

/** Clé de rapprochement d'un tag : type + libellé normalisé (même règle que le bestiaire). */
function tagKey(tag: { type?: string; name?: string }): string {
    return `${String(tag.type ?? "")}\u0000${normalizeRushCombatMonsterName(tag.name)}`;
}

/**
 * Bornes un groupe de monstres venu du payload : entrées valides seulement,
 * dédoublonnage sur le nom normalisé, ordre conservé, plafond du module.
 */
function boundMonsters(value: unknown): RushCombatMonster[] {
    if (!Array.isArray(value)) return [];
    const out: RushCombatMonster[] = [];
    const seen = new Set<string>();
    for (const entry of value) {
        if (!entry || typeof entry !== "object") continue;
        const raw = entry as Record<string, unknown>;
        const name = typeof raw.name === "string" ? raw.name.trim().slice(0, 200) : "";
        const key = normalizeRushCombatMonsterName(name);
        if (!name || !key || seen.has(key)) continue;
        seen.add(key);
        const monster: RushCombatMonster = { name };
        if (typeof raw.slug === "string" && raw.slug.trim()) monster.slug = raw.slug.trim().slice(0, 150);
        if (typeof raw.monsterId === "number" && Number.isInteger(raw.monsterId) && raw.monsterId > 0) {
            monster.monsterId = raw.monsterId;
        }
        if (typeof raw.gfxId === "number" && Number.isInteger(raw.gfxId) && raw.gfxId > 0) {
            monster.gfxId = raw.gfxId;
        }
        out.push(monster);
        if (out.length >= MAX_RUSH_COMBAT_MONSTERS) break;
    }
    return out;
}

/** Index `type\u0000nom` → monstres du payload (première occurrence gagnante, comme l'import). */
function indexPayloadMonsters(payload: RushImportPayload): Map<string, RushCombatMonster[]> {
    const index = new Map<string, RushCombatMonster[]>();
    for (const block of payload.blocks ?? []) {
        for (const sequence of block.sequences ?? []) {
            for (const tag of (sequence.activityTags ?? []) as RushImportActivityTag[]) {
                if (!(RUSH_CONTENT_COMBAT_TAG_TYPES as readonly string[]).includes(String(tag.type ?? ""))) {
                    continue;
                }
                const key = tagKey(tag);
                if (!key.split("\u0000")[1]) continue;
                if (index.has(key)) continue;
                const monsters = boundMonsters(tag.monsters);
                if (monsters.length) index.set(key, monsters);
            }
        }
    }
    return index;
}

/** Index `bloc\u0000nom` → séquence du payload (même clé que `planRushImport`). */
function indexPayloadSequences(
    payload: RushImportPayload
): Map<string, RushImportPayload["blocks"][number]["sequences"][number]> {
    const index = new Map<string, RushImportPayload["blocks"][number]["sequences"][number]>();
    for (const block of payload.blocks ?? []) {
        const blockKey = importKey(block.title);
        if (!blockKey) continue;
        for (const sequence of block.sequences ?? []) {
            const sequenceKey = importKey(sequence.subGuideName);
            if (!sequenceKey) continue;
            const key = `${blockKey}\u0000${sequenceKey}`;
            if (!index.has(key)) index.set(key, sequence);
        }
    }
    return index;
}

/**
 * Calcule ce que l'enrichissement écrirait. **Aucune écriture**, aucune mutation
 * des entrées : les tags modifiés sont recopiés (`{ ...tag, monsters }`), les
 * autres sont réutilisés tels quels.
 */
export function planRushContentSync(
    payload: RushImportPayload,
    current: readonly RushContentSequence[]
): RushContentSyncPlan {
    const sequences = indexPayloadSequences(payload);
    const monsters = indexPayloadMonsters(payload);

    const updates: RushContentUpdate[] = [];
    let unmatched = 0;
    let tipsProtected = 0;
    let tagsAlready = 0;
    let tagsWithoutSource = 0;

    for (const sequence of current) {
        const blockKey = importKey(sequence.blockTitle);
        const sequenceKey = importKey(sequence.name);
        const source =
            blockKey && sequenceKey ? sequences.get(`${blockKey}\u0000${sequenceKey}`) : undefined;
        if (!source) {
            unmatched += 1;
            continue;
        }

        const currentTips = typeof sequence.tips === "string" ? sequence.tips.trim() : "";
        const sourceTips =
            typeof source.tips === "string" ? source.tips.trim().slice(0, RUSH_CONTENT_TIPS_MAX) : "";
        let nextTips: string | null = null;
        if (sourceTips && !currentTips) {
            nextTips = sourceTips;
        } else if (sourceTips && currentTips && sourceTips !== currentTips) {
            // Un texte God gagne toujours : le seed ne réécrit jamais un conseil saisi.
            tipsProtected += 1;
        }

        const currentTags = asTags(sequence.activityTags);
        let nextTags: RushContentTag[] | null = null;
        let monstersAdded = 0;
        let tagsPatched = 0;
        if (currentTags.length) {
            const patched = currentTags.map((tag) => {
                if (!isCombatTag(tag)) return tag;
                if (hasMonsters(tag)) {
                    tagsAlready += 1;
                    return tag;
                }
                const resolved = monsters.get(tagKey(tag));
                if (!resolved) {
                    tagsWithoutSource += 1;
                    return tag;
                }
                monstersAdded += resolved.length;
                tagsPatched += 1;
                return { ...tag, monsters: resolved };
            });
            if (monstersAdded > 0) nextTags = patched;
        }

        if (nextTips === null && nextTags === null) continue;
        updates.push({
            sequenceId: sequence.id,
            name: sequence.name,
            tips: nextTips,
            activityTags: nextTags,
            tipsFilled: nextTips !== null,
            tagsPatched,
            monstersAdded,
        });
    }

    return { updates, unmatched, tipsProtected, tagsAlready, tagsWithoutSource };
}

/** Résumé léger du plan (le client n'a jamais besoin des tags complets). */
export function summarizeRushContentSyncPlan(
    plan: RushContentSyncPlan,
    sampleSize = 5
): RushContentSyncSummary {
    let tips = 0;
    let tags = 0;
    let monsters = 0;
    for (const update of plan.updates) {
        if (update.tipsFilled) tips += 1;
        tags += update.tagsPatched;
        monsters += update.monstersAdded;
    }
    return {
        sequences: plan.updates.length + plan.unmatched,
        updates: plan.updates.length,
        tips,
        tags,
        monsters,
        tipsProtected: plan.tipsProtected,
        tagsAlready: plan.tagsAlready,
        tagsWithoutSource: plan.tagsWithoutSource,
        unmatched: plan.unmatched,
        sample: plan.updates.slice(0, Math.max(1, sampleSize)).map((update) => ({
            name: update.name,
            tipsFilled: update.tipsFilled,
            monstersAdded: update.monstersAdded,
        })),
    };
}

/** Vrai si le plan n'écrirait rien (idempotence : un second passage est un no-op). */
export function isRushContentSyncNoop(plan: RushContentSyncPlan): boolean {
    return plan.updates.length === 0;
}
