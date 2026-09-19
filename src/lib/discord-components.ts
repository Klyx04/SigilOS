/**
 * Lecture des **composants** d'un message Discord (boutons, menus) — module
 * **pur** (aucune I/O).
 *
 * Sert au **repérage** d'un message : quand l'ID stocké d'un embed est perdu
 * (constat bêta du 19/09/2026 — `GuildEvent.discordMessageId = outbox:<jobId>`,
 * un ID de file jamais converti en ID Discord), le seul moyen de retrouver
 * l'embed est de relire le salon et de reconnaître ses `custom_id`
 * (`calendar:join:<eventId>` / `calendar:class:<eventId>`).
 *
 * La structure reçue vient de l'API Discord (donc de l'extérieur) : tout est
 * borné et vérifié, aucune valeur n'est supposée présente.
 */

/** Bornes défensives (RULES §4) : une rangée Discord = 5 composants, on tolère large. */
const MAX_ROWS = 10;
const MAX_COMPONENTS_PER_ROW = 25;

/**
 * Liste les `custom_id` portés par des composants Discord (`components` d'un
 * message, d'une réponse d'interaction…). Ignore silencieusement tout ce qui
 * n'est pas conforme (rangée sans `components`, `custom_id` non textuel…).
 */
export function componentCustomIds(components: unknown): string[] {
    if (!Array.isArray(components)) return [];

    const ids: string[] = [];
    for (const row of components.slice(0, MAX_ROWS)) {
        const inner = (row as { components?: unknown } | null)?.components;
        if (!Array.isArray(inner)) continue;
        for (const component of inner.slice(0, MAX_COMPONENTS_PER_ROW)) {
            const id = (component as { custom_id?: unknown } | null)?.custom_id;
            if (typeof id === "string" && id) ids.push(id);
        }
    }
    return ids;
}

/** `true` si les composants portent exactement ce `custom_id`. */
export function messageHasCustomId(components: unknown, customId: string): boolean {
    return componentCustomIds(components).includes(customId);
}
