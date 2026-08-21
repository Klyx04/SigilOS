/**
 * Permissions Discord (API v10) — bit flags du bot SigilOS.
 *
 * #223 P2 — least privilege : le lien d'invitation du bot ne demande PLUS
 * `permissions=8` (Administrateur). Le bitmask ci-dessous est le sous-ensemble
 * minimal couvrant les besoins réels du bot :
 *
 *   - Envoyer des messages / embeds / threads (posts DJ, missions, notifications) ;
 *   - Lire l'historique + supprimer des messages (nettoyage des posts) ;
 *   - Gérer les threads (posts DJ/quêtes) ;
 *   - Gérer les rôles (gate règlement / accès membres) ;
 *   - Voir le journal d'audit + les bans (sync membres / audit) ;
 *   - Déplacer en vocal + messages vocaux (stats vocales / streams).
 *
 * ⚠️ Changer le lien ne touche PAS les guildes déjà onboardées (elles
 * conservent leurs permissions jusqu'à une ré-invitation volontaire).
 * ⚠️ Ne PAS utiliser d'opérateurs bit à bit JS (`<<`, `|`, `&`) sur ces
 * valeurs : ils tronquent à 32 bits (bits ≥ 31 perdus). Utiliser `2 ** n`
 * et l'addition (puissances de 2 distinctes = aucun chevauchement).
 */

export const DISCORD_PERMISSION = {
    /** BAN_MEMBERS — GET /guilds/{id}/bans (sync membres) */
    BAN_MEMBERS: 2 ** 2,
    /** VIEW_AUDIT_LOG — journal d'audit */
    VIEW_AUDIT_LOG: 2 ** 7,
    /** VIEW_CHANNEL — lire les salons */
    VIEW_CHANNEL: 2 ** 10,
    /** SEND_MESSAGES — poster des messages */
    SEND_MESSAGES: 2 ** 11,
    /** MANAGE_MESSAGES — supprimer / purger des messages */
    MANAGE_MESSAGES: 2 ** 13,
    /** EMBED_LINKS — embeds dans les messages */
    EMBED_LINKS: 2 ** 14,
    /** READ_MESSAGE_HISTORY — lire l'historique */
    READ_MESSAGE_HISTORY: 2 ** 16,
    /** MOVE_MEMBERS — déplacer en vocal (stats) */
    MOVE_MEMBERS: 2 ** 24,
    /** MANAGE_ROLES — gérer les rôles (gate règlement) */
    MANAGE_ROLES: 2 ** 28,
    /** SEND_VOICE_MESSAGES — messages vocaux */
    SEND_VOICE_MESSAGES: 2 ** 35,
    /** SEND_MESSAGES_IN_THREADS — poster dans les threads */
    SEND_MESSAGES_IN_THREADS: 2 ** 38,
    /** CREATE_PUBLIC_THREADS — créer des threads publics */
    CREATE_PUBLIC_THREADS: 2 ** 39,
    /** CREATE_PRIVATE_THREADS — créer des threads privés */
    CREATE_PRIVATE_THREADS: 2 ** 40,
    /** MANAGE_THREADS — gérer les threads */
    MANAGE_THREADS: 2 ** 42,
} as const;

/**
 * Bitmask minimal d'invitation du bot SigilOS (somme de puissances de 2,
 * jamais d'opérateur bit à bit — voir avertissement ci-dessus).
 * N'inclut JAMAIS ADMINISTRATOR (2 ** 3 = 8).
 */
export const DISCORD_BOT_INVITE_PERMISSIONS =
    DISCORD_PERMISSION.VIEW_CHANNEL +
    DISCORD_PERMISSION.SEND_MESSAGES +
    DISCORD_PERMISSION.EMBED_LINKS +
    DISCORD_PERMISSION.MANAGE_MESSAGES +
    DISCORD_PERMISSION.READ_MESSAGE_HISTORY +
    DISCORD_PERMISSION.CREATE_PUBLIC_THREADS +
    DISCORD_PERMISSION.CREATE_PRIVATE_THREADS +
    DISCORD_PERMISSION.SEND_MESSAGES_IN_THREADS +
    DISCORD_PERMISSION.MANAGE_THREADS +
    DISCORD_PERMISSION.MANAGE_ROLES +
    DISCORD_PERMISSION.VIEW_AUDIT_LOG +
    DISCORD_PERMISSION.BAN_MEMBERS +
    DISCORD_PERMISSION.MOVE_MEMBERS +
    DISCORD_PERMISSION.SEND_VOICE_MESSAGES;

/**
 * Construit l'URL OAuth2 d'invitation du bot avec le bitmask minimal.
 * @param clientId ID applicatif Discord (client_id) — obligatoire, fail-closed sinon.
 * @param opts guildId (pré-sélection d'une guilde) · redirectUri (retour onboarding) · scope
 */
export function buildDiscordBotInviteUrl(
    clientId: string,
    opts: { guildId?: string; redirectUri?: string; scope?: string } = {}
): string | null {
    if (!clientId) return null;

    const params = new URLSearchParams({
        client_id: clientId,
        permissions: String(DISCORD_BOT_INVITE_PERMISSIONS),
        scope: opts.scope ?? "bot applications.commands",
    });

    if (opts.guildId) params.set("guild_id", opts.guildId);
    if (opts.redirectUri) {
        params.set("redirect_uri", opts.redirectUri);
        params.set("response_type", "code");
    }

    return `https://discord.com/oauth2/authorize?${params.toString()}`;
}