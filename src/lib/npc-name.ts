/**
 * PNJ **donneur** d'une quête (nom) — règles **PURES**, sans aucun appel réseau.
 *
 * 📏 Mesure du 16/10/2026 : DofusDB `/npcs/{id}` expose `name.fr` + `look` mais **aucune image**
 * (`/img/npcs/813.png` → 404, alors que `/img/monsters/813.png` → 200 : la collection `npcs`
 * n'existe pas) ; DofusDude n'a **pas** d'endpoint PNJ (404). En revanche le dépôt porte déjà
 * **6 494 PNJ** siphonnés du client Dofus (`prisma/seed-data/npcs/npcs-client.json` : `{ id, name,
 * look, gender }`) ⇒ le **nom** se résout **localement**, sans réseau ni re-siphon.
 *
 * D'où vient l'id : le résumé canonique d'une quête (`GameQuest.contentJson`, écrit par le siphon)
 * garde les textes d'objectif **FR verbatim**, et DofusDB y écrit `« Aller voir {npc,813} »`.
 * Le premier objectif qui en porte un est le donneur — on le lit **dans la donnée déjà en base**,
 * donc aucun changement de schéma, aucun siphon, aucune requête supplémentaire.
 *
 * ⚠️ Le **portrait** n'existe nulle part (ni DofusDB, ni DofusDude, et `public/game-data/npcs/`
 * est vide) : on n'affiche donc que le **nom**, jamais une image inventée.
 */

export interface NpcNameEntry {
    id: number;
    name: string;
}

/** Première occurrence `{npc,<id>}` d'un texte d'objectif (le format écrit par DofusDB). */
const NPC_TOKEN = /\{npc,(\d+)\}/;

/**
 * Id du PNJ donneur, lu dans le **résumé stocké** d'une quête.
 *
 * Parcours **structurel** d'abord (`steps[].objectives[].text`, déjà trié par id par le digest) :
 * c'est l'ordre canonique, donc « le premier objectif » est stable. Repli sur le JSON brut pour
 * les formes anciennes, jamais sur une donnée devinée.
 */
export function npcIdFromQuestContent(content: unknown): number | null {
    if (!content || typeof content !== "object") return null;
    const steps = (content as { steps?: unknown }).steps;
    if (Array.isArray(steps)) {
        for (const step of steps as { objectives?: unknown }[]) {
            const objectives = step?.objectives;
            if (!Array.isArray(objectives)) continue;
            for (const objective of objectives as { text?: unknown }[]) {
                const text = typeof objective?.text === "string" ? objective.text : "";
                const match = NPC_TOKEN.exec(text);
                if (match) return toNpcId(match[1]);
            }
        }
    }
    const fallback = NPC_TOKEN.exec(JSON.stringify(content));
    return fallback ? toNpcId(fallback[1]) : null;
}

function toNpcId(raw: string | undefined): number | null {
    const id = Number(raw);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Nom d'un PNJ dans la table locale — `null` si l'id est inexploitable ou absent (jamais inventé). */
export function npcNameById(entries: NpcNameEntry[] | null | undefined, id: number | null): string | null {
    if (!id || !Array.isArray(entries)) return null;
    for (const entry of entries) {
        if (Number(entry?.id) !== id) continue;
        const name = typeof entry?.name === "string" ? entry.name.trim() : "";
        return name || null;
    }
    return null;
}

/** Référence PNJ d'une quête (id + nom) — `null` dès qu'un maillon manque. */
export function resolveQuestNpc(
    content: unknown,
    entries: NpcNameEntry[] | null | undefined
): { id: number; name: string } | null {
    const id = npcIdFromQuestContent(content);
    const name = npcNameById(entries, id);
    return id && name ? { id, name } : null;
}
