/**
 * Identité d'une quête du guide — **règle pure** partagée par l'éditeur God
 * (édition d'une séquence existante **et** création).
 *
 * Pourquoi cette règle : le nom d'une quête se tapait à la main, alors que le
 * catalogue `GameQuest` (siphon game-data) porte déjà les 1 976 quêtes. On
 * choisit donc une quête dans le catalogue, et l'identité se remplit :
 *
 * - le **nom** est celui du catalogue (l'action serveur écrit `subGuideRef` **et**
 *   `subGuideName` depuis ce champ) ;
 * - le lien **DPLN** reste la **première** source, jamais écrasée : elle n'est pas
 *   dans `GameQuest`, donc elle reste saisie à la main (ou par le siphon Tougli) ;
 * - le lien **DofusDB** devient le lien **direct** de la quête (`/quest/<id>`),
 *   et **remplace** seulement un lien que l'application avait généré elle-même
 *   (recherche par nom, ou direct précédent). Un lien saisi à la main est
 *   conservé : l'admin peut viser un autre écran que la fiche de quête.
 */

/** Base des fiches de quête DofusDB (forme directe utilisée par le guide). */
export const DOFUSDB_QUEST_BASE = "https://dofusdb.fr/fr/database/quest";

export type RushQuestPick = {
    /** Nom officiel de la quête (catalogue `GameQuest`). */
    name: string;
    /** Id DofusDB de la quête — la valeur que porte `questDbIds`. */
    dofusDbId: number | null;
};

export type RushQuestIdentity = {
    name: string;
    dofusdbUrl: string;
};

/** Lien direct d'une fiche de quête, ou `null` si l'id n'est pas exploitable. */
export function dofusDbQuestUrl(dofusDbId: number | null | undefined): string | null {
    if (typeof dofusDbId !== "number" || !Number.isInteger(dofusDbId) || dofusDbId <= 0) return null;
    return `${DOFUSDB_QUEST_BASE}/${dofusDbId}`;
}

/**
 * Ce lien DofusDB a-t-il été **produit par l'application** (donc remplaçable) ?
 * Deux formes : la recherche par nom (`?name=`) et le lien direct (`/<id>`).
 */
export function isGeneratedDofusDbQuestUrl(url: string | null | undefined): boolean {
    const value = (url ?? "").trim();
    if (!value) return false;
    if (value.startsWith(`${DOFUSDB_QUEST_BASE}?name=`)) return true;
    return /^https:\/\/dofusdb\.fr\/fr\/database\/quest\/\d+$/.test(value);
}

/**
 * Identité à écrire après un choix dans le catalogue.
 *
 * | Cas | Nom | Lien DofusDB |
 * |---|---|---|
 * | quête choisie, champ vide | nom du catalogue | lien direct |
 * | quête choisie, lien généré | nom du catalogue | lien direct (remplacé) |
 * | quête choisie, lien **saisi à la main** | nom du catalogue | conservé tel quel |
 * | quête choisie sans id DofusDB | nom du catalogue | conservé tel quel |
 * | nom du catalogue vide | nom actuel | inchangé |
 */
export function applyQuestIdentity(
    pick: RushQuestPick,
    current: { name: string; dofusdbUrl: string | null | undefined }
): RushQuestIdentity {
    const pickedName = (pick.name ?? "").trim();
    const name = pickedName || current.name;

    const currentUrl = (current.dofusdbUrl ?? "").trim();
    const direct = dofusDbQuestUrl(pick.dofusDbId);
    const canReplace = !currentUrl || isGeneratedDofusDbQuestUrl(currentUrl);
    const dofusdbUrl = direct && canReplace ? direct : currentUrl;

    return { name, dofusdbUrl };
}

/** Nombre maximal d'ids de quête portés par une séquence. */
export const MAX_QUEST_DB_IDS = 10;

/**
 * Borne les `questDbIds` reçus (client **ou** import) : entiers **> 0**,
 * dédoublonnés, **10 au plus**. Une valeur illisible est **écartée**, jamais
 * convertie en 0 ni en `NaN` — la colonne ne doit contenir que des ids DofusDB
 * réels, sinon la liaison `GameQuest` est morte.
 */
export function boundQuestDbIds(ids: unknown): number[] {
    if (!Array.isArray(ids)) return [];
    const out: number[] = [];
    for (const raw of ids) {
        const value =
            typeof raw === "number"
                ? raw
                : typeof raw === "string" && /^\d+$/.test(raw.trim())
                    ? Number(raw.trim())
                    : Number.NaN;
        if (!Number.isInteger(value) || value <= 0) continue;
        if (out.includes(value)) continue;
        out.push(value);
        if (out.length >= MAX_QUEST_DB_IDS) break;
    }
    return out;
}
