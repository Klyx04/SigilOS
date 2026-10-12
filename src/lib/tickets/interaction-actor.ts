/**
 * 🎫 Tickets v2 — **acteur d'une interaction Discord** (pur, testable).
 *
 * Cause racine du bug CSAT (audit du 24/09/2026) : le sondage de satisfaction est
 * envoyé **en message privé**. Or, sur une interaction reçue en MP, Discord n'envoie
 * pas `member` (documentation : `member?` = « *Guild member data for the invoking
 * user* », `user?` = « *User object for the invoking user, **if invoked in a DM*** »).
 * Le handler lisait `member.user.id` sans repli ⇒ `TypeError` ⇒ **HTTP 500** au clic
 * sur une étoile, et aucun avis enregistré.
 *
 * Cette fonction est le **seul** point d'entrée pour identifier qui agit : elle
 * accepte les deux formes et dit d'où vient l'interaction. Elle ne devine rien :
 * sans identifiant exploitable, elle renvoie `null` (l'appelant refuse).
 */

export type InteractionActor = {
    discordUserId: string;
    /** Présent seulement pour une interaction de serveur. */
    discordGuildId: string | null;
    /** Source de l'interaction : `guild` (salon) ou `dm` (message privé). */
    source: "guild" | "dm";
    /** Rôles Discord de l'acteur dans la guilde (vide en MP). */
    roleIds: string[];
    /** `member.permissions` (bitfield Discord), absent en MP. */
    permissions: string | null;
    /** Administrateur Discord (`ADMINISTRATOR` = 1 << 3) — bypass explicite du RBAC. */
    isGuildAdmin: boolean;
    /** Nom d'affichage, pour les messages et le journal d'audit. */
    displayName: string;
    /** Avatar (hash Discord), pour un transcript ou un embed. */
    avatar: string | null;
};

/** Bit `ADMINISTRATOR` de Discord (1 << 3). */
export const DISCORD_ADMINISTRATOR_BIT = 8n;

type RawInteraction = {
    member?: {
        user?: { id?: string; username?: string; global_name?: string | null; avatar?: string | null };
        roles?: string[] | null;
        permissions?: string | null;
    } | null;
    user?: { id?: string; username?: string; global_name?: string | null; avatar?: string | null } | null;
    guild_id?: string | null;
};

function isGuildAdminFromPermissions(permissions: string | null | undefined): boolean {
    if (!permissions) return false;
    try {
        return (BigInt(permissions) & DISCORD_ADMINISTRATOR_BIT) === DISCORD_ADMINISTRATOR_BIT;
    } catch {
        // Bitfield illisible ⇒ on ne suppose **pas** un administrateur (fail-closed).
        return false;
    }
}

/**
 * Lit l'acteur d'une interaction, qu'elle vienne d'un salon ou d'un MP.
 * Renvoie `null` si aucun identifiant n'est exploitable.
 */
export function resolveInteractionActor(payload: RawInteraction | null | undefined): InteractionActor | null {
    if (!payload || typeof payload !== "object") return null;

    const member = payload.member ?? null;
    const user = member?.user ?? payload.user ?? null;
    const discordUserId = user?.id;
    if (!discordUserId || !/^\d{5,}$/.test(discordUserId)) return null;

    const discordGuildId = payload.guild_id ?? null;
    const displayName = user?.global_name || user?.username || "Membre";

    return {
        discordUserId,
        discordGuildId,
        source: discordGuildId ? "guild" : "dm",
        roleIds: Array.isArray(member?.roles) ? member!.roles!.filter(Boolean) : [],
        permissions: member?.permissions ?? null,
        isGuildAdmin: isGuildAdminFromPermissions(member?.permissions),
        displayName,
        avatar: user?.avatar ?? null,
    };
}

/** Le clic vient-il d'un salon du serveur ? (les actions de ticket l'exigent) */
export function isGuildInteraction(actor: InteractionActor | null): boolean {
    return Boolean(actor && actor.source === "guild" && actor.discordGuildId);
}
