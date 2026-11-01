/**
 * Limite de guildes par utilisateur — **règles pures** (aucune I/O, aucun Prisma).
 *
 * 📌 Décisions du 31/10/2026 (`docs/plans/PLAN-LIMITE-GUILDES.md`) : **2 guildes** maximum,
 * God exempté, seuil lisible dans `PlatformConfig.maxGuildsPerUser` et **borné 1..10**.
 *
 * 🐛 Pourquoi la borne basse est **1** et pas 0 : un `0` refuserait **toute** création de profil,
 * y compris la première — la plateforme se verrouillerait elle-même. Toute valeur hors bornes
 * retombe donc sur le **défaut 2**, jamais sur 0.
 *
 * ⚠️ Le compteur **compte des guildes, pas des lignes** : un owner qui a aussi un profil dans sa
 * propre guilde ne doit compter qu'**une** fois (union dédoublonnée, §3 du plan).
 */

/** Valeur retenue quand `PlatformConfig.maxGuildsPerUser` est absent ou hors bornes. */
export const GUILD_LIMIT_DEFAULT = 2;
export const GUILD_LIMIT_MIN = 1;
export const GUILD_LIMIT_MAX = 10;

/**
 * Ramène la valeur brute de la configuration à une limite exploitable.
 *
 * Accepte un nombre ou une chaîne numérique (une valeur d'environnement mal typée ne doit pas
 * ouvrir la porte) ; **tout le reste** — `null`, `undefined`, `"abc"`, `NaN`, un décimal, `0`,
 * `-1`, `11` — retombe sur {@link GUILD_LIMIT_DEFAULT}.
 */
export function resolveGuildLimit(raw: unknown): number {
    if (typeof raw !== "number" && typeof raw !== "string") return GUILD_LIMIT_DEFAULT;

    const value = Number(raw);
    if (!Number.isFinite(value) || !Number.isInteger(value)) return GUILD_LIMIT_DEFAULT;
    if (value < GUILD_LIMIT_MIN || value > GUILD_LIMIT_MAX) return GUILD_LIMIT_DEFAULT;

    return value;
}

/**
 * Compte les guildes d'un utilisateur : **union dédoublonnée** des identifiants internes.
 *
 * L'appelant ne fournit que les sources qui **comptent** :
 * - `profileGuildIds` : les `UserProfile.guildId` en statut **`ACTIVE`** (`ARCHIVED`, `BANNED`
 *   et les profils `GUILD_DELETED` sont exclus **à la lecture**, pas ici) ;
 * - `ownedGuildIds` : les `GuildConfig.id` où `ownerId` est le snowflake Discord du user.
 *
 * Les entrées vides (`null`, `undefined`, `""`) sont ignorées : une guilde inconnue ne doit ni
 * gonfler le compteur ni le casser.
 */
export function countGuildsForUser(input: {
    profileGuildIds: readonly (string | null | undefined)[];
    ownedGuildIds: readonly (string | null | undefined)[];
}): number {
    const guilds = new Set<string>();

    for (const guildId of [...input.profileGuildIds, ...input.ownedGuildIds]) {
        if (typeof guildId === "string" && guildId.length > 0) guilds.add(guildId);
    }

    return guilds.size;
}

/** Le seuil est-il atteint (au sens « une guilde de plus serait refusée ») ? */
export function isAtGuildLimit(count: number, limit: number): boolean {
    return count >= limit;
}
