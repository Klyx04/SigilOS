/**
 * Première verticale du rail de veille : les **fiches monstres** (DofusDB `/monsters`, 5 135 entités).
 *
 * 🎯 Pourquoi commencer ici (demande user du 27/09/2026 : « il manque pleins de data réel des sorts
 * résistance stats etc sur les boss avis monstres ano » + « ça fait des mois qu'on n'arrive pas à un
 * truc stable pour le long terme ») : les fiches étaient siphonnées par une **passe complète**
 * (tous les boss × 6-8 requêtes) ⇒ trous invisibles, passes de 30 min, 429, couverture 258/5 135.
 * Ici : une passe **bornée** reprend au filigrane `id`, persiste ce qu'elle voit, avance le
 * filigrane — une interruption n'est qu'un tour interrompu, jamais un trou définitif.
 *
 * ⚠️ **Aucun import serveur/Next** : les effets (HTTP, persistance) sont **injectés**
 * (`fetchPage`, `persistFiche`) ⇒ testable sans réseau ni base, utilisable par le cron ET le worker.
 * Mesures du 27/09/2026 (voir `@/lib/dofusdb-veille`) : `id[$gt]` + `$sort=id` fonctionnent,
 * `$skip` est fiable sur `/monsters`, et **aucune fiche n'a bougé depuis le 23/06/2026** ⇒ la
 * veille en régime établi ne coûte rien ; le coût réel est le **backfill** (5 135 fiches).
 */
import {
    buildVeilleQuery,
    closeVeillePass,
    type VeillePassResult,
    type VeilleSpec,
    type VeilleState,
} from "@/lib/dofusdb-veille";

/** Contrat du dataset « fiches monstres » : filigrane par `id`, lots bornés, tri stable. */
export const MONSTER_FICHES_SPEC: VeilleSpec = {
    id: "MONSTER_FICHES",
    endpoint: "/monsters",
    cursor: "id",
    limit: 120,
};

/** Une entité vue dans une page `/monsters` (seul le minimum est lu : clé + nom + fraîcheur). */
export interface MonsterRow {
    id: number;
    name: string;
    updatedAt?: string | null;
}

/** Résultat d'une passe (compteurs — jamais de « succès » sans chiffre). */
export interface MonsterFichesPassResult extends VeillePassResult {
    /** Fiches réellement persistées. */
    persisted: number;
    /** Erreurs unitaires (une fiche en échec n'arrête jamais la passe). */
    errors: string[];
    /** `total` annoncé par la source pour la requête (au-delà du filigrane). */
    total: number | null;
}

/**
 * Une passe bornée de fiches monstres :
 *  1. construit la requête depuis le filigrane (refus si le filigrane est invalide : aucun appel) ;
 *  2. récupère **un** lot (`limit`) via `fetchPage` (injecté : limiteur, user-agent, timeout) ;
 *  3. persiste chaque fiche via `persistFiche` (injecté) — fail-soft unitaire ;
 *  4. avance le filigrane (**jamais de recul**) et chiffre le restant.
 */
export async function runMonsterFichesPass(opts: {
    state: VeilleState;
    limit?: number;
    fetchPage: (endpoint: string, query: string) => Promise<{ rows: MonsterRow[]; total: number | null }>;
    persistFiche: (monster: { id: number; name: string }) => Promise<boolean>;
}): Promise<MonsterFichesPassResult> {
    const previous = opts.state?.cursor ?? null;
    const spec: VeilleSpec = {
        ...MONSTER_FICHES_SPEC,
        limit: Math.max(1, Math.floor(Number(opts.limit) || MONSTER_FICHES_SPEC.limit)),
    };

    const query = buildVeilleQuery(spec, { cursor: previous });
    if (!query) {
        return {
            processed: 0,
            persisted: 0,
            errors: ["Filigrane invalide — passe annulée avant tout appel réseau"],
            cursor: previous,
            remaining: opts.state?.remaining ?? null,
            done: false,
            total: null,
        };
    }

    let page: { rows: MonsterRow[]; total: number | null };
    try {
        page = await opts.fetchPage(spec.endpoint, query);
    } catch (error) {
        // Panne source : on ne touche PAS au filigrane (aucune avance sur une réponse absente).
        return {
            processed: 0,
            persisted: 0,
            errors: [String(error)],
            cursor: previous,
            remaining: opts.state?.remaining ?? null,
            done: false,
            total: null,
        };
    }

    const rows = Array.isArray(page?.rows) ? page.rows : [];
    const errors: string[] = [];
    let persisted = 0;
    for (const row of rows) {
        const id = Math.floor(Number(row?.id) || 0);
        const name = String(row?.name ?? "").trim();
        if (id <= 0 || !name) {
            errors.push("Fiche ignorée (id ou nom manquant)");
            continue;
        }
        try {
            if (await opts.persistFiche({ id, name })) persisted++;
        } catch (error) {
            errors.push(`${name} (#${id}): ${String(error)}`);
        }
    }

    const closed = closeVeillePass(spec, previous, rows.map((r) => r?.id), page?.total ?? null);
    return { ...closed, persisted, errors, total: page?.total ?? null };
}
