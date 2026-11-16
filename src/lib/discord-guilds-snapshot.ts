/**
 * Snapshot des serveurs Discord d'un membre — **règle pure** du cache de connexion.
 *
 * Pourquoi : le callback `signIn` interroge déjà `GET /users/@me/guilds`. Le
 * portail `/dashboard` le rappelait dans la même seconde, ce qui déclenchait un
 * 429 et affichait un écran d'attente. Le snapshot (60 s, Redis) fait lire la
 * **même** réponse au portail.
 *
 * La donnée vient d'une **API externe** : elle est validée et bornée par Zod à
 * l'écriture comme à la lecture (règle §5.3). Une entrée corrompue ⇒ `null`, et
 * l'appelant refait l'appel Discord (jamais une conclusion par défaut).
 */

import { z } from "zod";

/** Un utilisateur Discord appartient à 200 serveurs au maximum (limite Discord). */
export const DISCORD_GUILD_SNAPSHOT_MAX = 200;

const discordGuildSnapshotEntrySchema = z.object({
    id: z.string().min(1).max(32),
    name: z.string().max(200).optional(),
    icon: z.string().max(300).nullable().optional(),
    owner: z.boolean().optional(),
    /** Bitfield des permissions, transmis par Discord sous forme de chaîne. */
    permissions: z.string().max(32).optional(),
});

const discordGuildSnapshotSchema = z
    .array(discordGuildSnapshotEntrySchema)
    .max(DISCORD_GUILD_SNAPSHOT_MAX);

export type DiscordGuildSnapshotEntry = z.infer<typeof discordGuildSnapshotEntrySchema>;

/** Sérialise une liste de serveurs pour le cache, ou `null` si elle n'est pas valide. */
export function serializeDiscordGuildSnapshot(guilds: readonly unknown[]): string | null {
    try {
        const parsed = discordGuildSnapshotSchema.safeParse(guilds);
        return parsed.success ? JSON.stringify(parsed.data) : null;
    } catch {
        return null;
    }
}

/** Lit un snapshot ; `null` = pas de cache exploitable (l'appelant interroge Discord). */
export function parseDiscordGuildSnapshot(raw: string | null): DiscordGuildSnapshotEntry[] | null {
    if (!raw) return null;
    try {
        const parsed = discordGuildSnapshotSchema.safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data : null;
    } catch {
        return null;
    }
}
