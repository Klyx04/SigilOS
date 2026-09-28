/**
 * 🧭 **Erreurs des siphons game-data — regroupées par cause** (chantier A3).
 *
 * ⚠️ Dette mesurée le 28/09/2026 : le Tableau d'état et le worker publiaient
 * `errors.slice(0, 3).join(" · ")`. Sur une passe BOUNTIES qui produit **96 erreurs**
 * (mesure : 92 avis sans butin + 4 fiches en échec), l'utilisateur voyait **trois lignes
 * brutes** et **aucun chiffre par cause** — impossible de distinguer « DofusDB est tombé »
 * de « DofusDB ne référence pas ce butin », qui demandent deux actions opposées.
 *
 * Ici : chaque message est classé dans un **registre fermé** de causes (motif stable, testable),
 * puis compté ⇒ « 96 erreur(s) : aucun butin référencé (92×) · fiche en échec (4×) ».
 *
 * ⚠️ Module **PUR** (aucun import) : il sert côté serveur (worker BullMQ, cœur de siphon) **et**
 * côté client (lanceur « dans cet onglet », panneau d'état) ⇒ jamais de dépendance Prisma/Node.
 * Une cause **inconnue** n'est jamais perdue : elle est regroupée par message identique
 * et échantillonnée — on ne masque aucune erreur.
 */

/** Une cause regroupée : libellé stable + nombre d'occurrences + un exemple borné. */
export interface GameDataErrorGroup {
    key: string;
    label: string;
    count: number;
    /** Premier message rencontré, tronqué (l'exemple, jamais tout le lot). */
    sample: string;
}

/** Longueur maximale d'un exemple conservé dans un résumé (`lastError`, ligne de journal). */
export const GAME_DATA_ERROR_SAMPLE_CHARS = 120;
/** Nombre de causes citées dans le résumé d'une ligne (`lastError`). */
export const GAME_DATA_ERROR_SUMMARY_CAUSES = 3;
/** Nombre de causes détaillées dans le journal live du lanceur. */
export const GAME_DATA_ERROR_DETAIL_CAUSES = 6;
/** Nombre maximal de messages acceptés d'un appelant (entrée client/worker : bornée, jamais crue). */
export const GAME_DATA_ERROR_REPORTED_MAX = 200;
/** Nombre maximal de causes conservées dans l'état publié (une passe ne peint pas 60 causes). */
export const GAME_DATA_ERROR_GROUPS_MAX = 12;

/**
 * **Registre fermé** des causes connues — l'ordre compte : les motifs spécifiques d'abord,
 * le fourre-tout (`^Avis `) **en dernier**. Ajouter une cause = ajouter une ligne ici
 * (et la laisser se prouver par un test : `tests/game-data-error-causes.test.ts`).
 */
export const GAME_DATA_ERROR_CAUSES: readonly { key: string; label: string; test: RegExp }[] = [
    { key: "race-indisponible", label: "race DofusDB indisponible", test: /^DofusDB monsters\?race=\d+ indisponible/ },
    { key: "race-plafond", label: "race au plafond de 50 avis (tronquée)", test: /sature le plafond de 50/ },
    { key: "dofensive-indisponible", label: "Dofensive indisponible (avis non prouvé)", test: /Dofensive indisponible/ },
    { key: "fiche-homonyme", label: "fiche résolue vers un homonyme (ignorée)", test: /fiche résolue vers l'id \d+ \(homonyme\)/ },
    { key: "grades-absents", label: "grades introuvables (fiche sans stats)", test: /grades introuvables/ },
    { key: "butin-absent", label: "aucun butin référencé par DofusDB", test: /aucun butin référencé/ },
    { key: "butin-illisible", label: "butin illisible (onglet masqué)", test: /butin illisible/ },
    { key: "butin-non-relu", label: "butin non relu (repli en échec)", test: /butin non relu/ },
    // Fourre-tout des erreurs **par fiche** (« Avis X : … ») — après tous les motifs spécifiques.
    { key: "avis-echec", label: "fiche en échec (erreur remontée par l'API)", test: /^Avis / },
];

/** Tronque en gardant une trace de la coupe (jamais de message coupé en silence). */
export function truncateGameDataError(message: string, max = GAME_DATA_ERROR_SAMPLE_CHARS): string {
    const flat = message.replace(/\s+/g, " ").trim();
    return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

/** Classe **un** message dans une cause connue (sinon : cause `autre:<message>` portée par le message). */
export function classifyGameDataError(message: string): { key: string; label: string } {
    const flat = message.replace(/\s+/g, " ").trim();
    for (const cause of GAME_DATA_ERROR_CAUSES) {
        if (cause.test.test(flat)) return { key: cause.key, label: cause.label };
    }
    // Cause inconnue : le message (tronqué) devient **libellé ET clé** ⇒ deux messages identiques
    // se regroupent (une cause = un chiffre réel) et deux messages **différents** restent deux
    // causes distinctes. Une clé unique « autre » les aurait fondus sous le premier message
    // rencontré : le compteur aurait alors décrit un lot qu'il ne nommait pas. Aucun message n'est
    // perdu, aucun n'est masqué derrière un « autre » muet.
    const label = truncateGameDataError(flat) || "(message vide)";
    return { key: `autre:${label}`, label };
}

/**
 * Regroupe par cause, **trié par fréquence décroissante** (la cause dominante d'abord) puis par
 * libellé : deux passes identiques produisent le même résumé (comparaison possible d'une passe à
 * l'autre).
 */
export function groupGameDataErrors(messages: readonly string[]): GameDataErrorGroup[] {
    const groups = new Map<string, GameDataErrorGroup>();
    for (const message of messages) {
        const { key, label } = classifyGameDataError(message);
        const current = groups.get(key);
        if (current) {
            current.count += 1;
            continue;
        }
        groups.set(key, { key, label, count: 1, sample: truncateGameDataError(message) });
    }
    return [...groups.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fr"));
}

/**
 * Résumé **borné** d'un lot d'erreurs (une ligne de `lastError` / un `ctx.log`), ex.
 * « 96 erreur(s) : aucun butin référencé (92×) · fiche en échec (4×) ». `undefined` si aucune erreur
 * (l'appelant n'écrit alors **rien** : pas de « 0 erreur » trompeur).
 */
export function summarizeGameDataErrors(messages: readonly string[]): string | undefined {
    if (messages.length === 0) return undefined;
    const groups = groupGameDataErrors(messages);
    const head = groups
        .slice(0, GAME_DATA_ERROR_SUMMARY_CAUSES)
        .map((group) => `${group.label} (${group.count}×)`)
        .join(" · ");
    const rest = groups.length - GAME_DATA_ERROR_SUMMARY_CAUSES;
    return `${messages.length} erreur(s) : ${head}${rest > 0 ? ` · +${rest} autre(s) cause(s)` : ""}`;
}

/**
 * Détail **multi-lignes** pour le journal live du lanceur : une ligne d'en-tête chiffrée puis une
 * ligne par cause (max `opts.max`), chacune avec son exemple. Vide si aucune erreur.
 */
export function formatGameDataErrorLines(
    messages: readonly string[],
    opts: { max?: number } = {},
): string[] {
    if (messages.length === 0) return [];
    const max = Math.max(1, opts.max ?? GAME_DATA_ERROR_DETAIL_CAUSES);
    const groups = groupGameDataErrors(messages);
    const lines = [`❌ ${messages.length} erreur(s) — regroupées par cause :`];
    for (const group of groups.slice(0, max)) {
        lines.push(`   ❌ ${group.label} : ${group.count}× (ex. « ${group.sample} »)`);
    }
    const rest = groups.length - max;
    if (rest > 0) lines.push(`   ❌ … ${rest} autre(s) cause(s) — voir les compteurs par dataset.`);
    return lines;
}

/**
 * 🛡️ Borne les messages **venant d'un appelant** (worker, action serveur) : types inconnus et
 * messages vides ignorés, chaque message tronqué, liste plafonnée (`GAME_DATA_ERROR_REPORTED_MAX`).
 * Aucune exception : une entrée illisible ne doit jamais empêcher d'enregistrer la fin d'une passe.
 */
export function sanitizeGameDataErrorMessages(
    value: unknown,
    opts: { max?: number } = {},
): string[] {
    if (!Array.isArray(value)) return [];
    const max = Math.max(1, opts.max ?? GAME_DATA_ERROR_REPORTED_MAX);
    const out: string[] = [];
    for (const item of value) {
        if (out.length >= max) break;
        const message = typeof item === "string" ? truncateGameDataError(item) : "";
        if (message) out.push(message);
    }
    return out;
}

/** Plafonne une liste de causes (état publié : le client ne peint jamais un mur de causes). */
export function capGameDataErrorGroups(
    groups: readonly GameDataErrorGroup[],
    max = GAME_DATA_ERROR_GROUPS_MAX,
): GameDataErrorGroup[] {
    return groups.slice(0, Math.max(1, max)).map((group) => ({ ...group }));
}

/**
 * Relit des causes **sérialisées** (Redis, JSON, payload d'action) en validant chaque champ :
 * une entrée douteuse est ignorée, jamais devinée. `null` si rien d'exploitable ⇒ l'écran affiche
 * la ligne `lastError` plutôt qu'un compteur faux.
 */
export function normalizeGameDataErrorGroups(value: unknown): GameDataErrorGroup[] | null {
    if (!Array.isArray(value)) return null;
    const out: GameDataErrorGroup[] = [];
    for (const item of value) {
        if (!item || typeof item !== "object") continue;
        const raw = item as Partial<GameDataErrorGroup>;
        const count = Number(raw.count);
        if (typeof raw.key !== "string" || !raw.key) continue;
        if (typeof raw.label !== "string" || !raw.label) continue;
        if (!Number.isFinite(count) || count <= 0) continue;
        out.push({
            key: raw.key,
            label: raw.label,
            count: Math.trunc(count),
            sample: typeof raw.sample === "string" ? truncateGameDataError(raw.sample) : "",
        });
    }
    return out.length > 0 ? capGameDataErrorGroups(out) : null;
}
