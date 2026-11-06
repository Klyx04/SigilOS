/**
 * Garde d'**appartenance à une guilde** — une seule implémentation, appelée par les
 * actions serveur qui lisent des données cloisonnées.
 *
 * Pourquoi ce module (audit du 06/11/2026, chantier rang 57) : dix actions du module
 * `ladder` et de l'activité ne vérifiaient qu'une **session** (`auth()`), pas
 * l'appartenance. Tant que `signIn` refusait tout compte sans guilde, le trou restait
 * théorique ; ouvrir la plateforme aux **visiteurs** l'aurait rendu atteignable par
 * n'importe quel compte Discord, sur n'importe quel `guildId` passé en argument.
 *
 * La règle du dépôt est explicite : le RBAC se vérifie **dans l'action**, pas seulement
 * dans la page. `getUserContext` porte déjà les cas staff / God / guilde bloquée.
 *
 * Fail-closed : un `guildId` vide, une session absente, un non-membre ⇒ refus.
 */

import { getUserContext } from "@/server/actions/user-actions";

export type GuildAccessResult = { ok: true } | { ok: false; error: string };

/** Vrai si l'appelant est un membre authentifié de cette guilde (ou staff/God). */
export async function assertGuildMemberAccess(
    discordGuildId: string | null | undefined
): Promise<GuildAccessResult> {
    if (typeof discordGuildId !== "string" || discordGuildId.trim().length === 0) {
        return { ok: false, error: "Guilde invalide." };
    }

    const context = await getUserContext(discordGuildId);
    if (!context.isAuthenticated || !context.isMember) {
        return { ok: false, error: "Accès refusé." };
    }
    return { ok: true };
}
