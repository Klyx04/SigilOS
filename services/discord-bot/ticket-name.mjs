/**
 * 🏷️ Nom de salon de ticket — **miroir volontaire** de `src/lib/tickets/channel-name-format.ts`.
 *
 * Pourquoi un fichier séparé dans le paquet du bot : son image Docker ne copie **que**
 * `services/discord-bot/`, donc aucun import de `src/` n'est possible (`rootDir` + `paths`
 * ne résolvent pas dans l'image). C'est un `.mjs` pour que Node l'exécute tel quel en ESM.
 *
 * **La parité du slug est verrouillée par un test** (`tests/unit/ticket-rename-bot-parity.test.ts`) :
 * si la règle de l'application change, le test casse ici. Aucune dérive silencieuse.
 */

/**
 * Slug Discord d'un morceau de nom : minuscules, sans accents, `[a-z0-9-_]`,
 * espaces et symboles compactés en `-`. Même assainissement que l'ouverture.
 * @param {string} value
 * @returns {string}
 */
export function slugifyTicketName(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 100);
}

/**
 * Renomme « sur place » un salon de ticket quand le demandeur change de pseudo.
 *
 * On ne reconstruit **pas** le nom depuis le motif (le bot ne le connaît pas) : on
 * remplace le slug de l'ancien pseudo par celui du nouveau, dans le nom **actuel**.
 * Conséquences voulues :
 *  - un nom sans le pseudo (`ticket-0044`) n'est pas touché (retourne `null`) ;
 *  - un nom personnalisé par le staff conserve son préfixe/suffixe ;
 *  - aucun risque d'écraser un renommage manuel qui ne contient pas l'ancien pseudo.
 *
 * @param {string} currentName nom actuel du salon
 * @param {string} oldDisplayName ancien pseudo affiché (surnom serveur ou nom d'utilisateur)
 * @param {string} newDisplayName nouveau pseudo affiché
 * @returns {string | null} le nouveau nom, ou `null` s'il n'y a rien à faire
 */
export function renameTicketChannelName(currentName, oldDisplayName, newDisplayName) {
    const before = slugifyTicketName(oldDisplayName);
    const after = slugifyTicketName(newDisplayName);
    if (!before || !after || before === after) return null;

    const current = String(currentName ?? "");
    if (!current.includes(before)) return null;

    const next = current.replace(before, after).slice(0, 100).replace(/^-+|-+$/g, "");
    return next && next !== current ? next : null;
}
