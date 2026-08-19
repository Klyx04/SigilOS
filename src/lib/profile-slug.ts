/**
 * 🔗 Slug lisible pour les URLs `/dashboard/<guildId>/members/<slug>` (chantier #126).
 *
 * Priorité : `pseudoDofus` → `discordNickname` → `id` (cuid, backward-compat).
 * La route `members/[slug]` résout elle-même pseudoDofus / discordNickname / user.name
 * / id (insensible à la casse) — donc un slug construit ici est toujours résolu, et les
 * anciennes URLs en cuid continuent de marcher.
 */
export function buildProfileSlug(profile: {
    pseudoDofus?: string | null;
    discordNickname?: string | null;
    id: string;
}): string {
    return (profile.pseudoDofus || profile.discordNickname || profile.id).trim();
}

/** Construit le href complet d'un profil membre avec le slug lisible (encodé). */
export function buildProfileHref(
    guildId: string,
    profile: { pseudoDofus?: string | null; discordNickname?: string | null; id: string }
): string {
    return `/dashboard/${guildId}/members/${encodeURIComponent(buildProfileSlug(profile))}`;
}
