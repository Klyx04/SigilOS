/**
 * Résolution des emojis d'application Discord (pictos Dofus des embeds).
 *
 * Discord n'autorise une image dans un embed que dans 4 emplacements ; partout
 * ailleurs (noms/values de fields, boutons), un picto ne peut être qu'un **emoji
 * custom** — porté par une **application** (≤ 2 000 emojis, ≤ 256 Ko, sans permission
 * `USE_EXTERNAL_EMOJIS`). Les ids étant propres à chaque application (bêta ≠ prod),
 * on résout **par nom** à l'exécution : `emoji("dofus_success")`.
 *
 * Contrat (fail-soft, jamais bloquant) :
 *  · token absent, app id absent, API en erreur, emoji pas encore uploadé → on rend
 *    le **repli unicode** du catalogue (l'embed reste exactement comme aujourd'hui) ;
 *  · aucun id n'est jamais écrit dans le code ni en base ;
 *  · la liste est mise en cache **en mémoire** (1 appel API / process / 10 min) :
 *    une synchro d'emojis n'a pas besoin d'un aller-retour Redis par embed.
 */
import { logger } from "@/lib/logger";
import { fetchWithRetry } from "@/server/discord";
import { DISCORD_EMOJIS } from "@/lib/discord-emoji-catalog";

/** `(nom) => "<:nom:id>"` — ou le repli unicode du catalogue, ou `""`. */
export type EmojiResolver = (name: string) => string;

const CACHE_TTL_MS = 10 * 60 * 1000;

let cache: { at: number; map: Map<string, string> } | null = null;

/** Id de l'application Discord de l'environnement (même résolution que les slash commands). */
export function getDiscordApplicationId(): string | null {
    const raw = process.env.AUTH_DISCORD_ID || process.env.DISCORD_APPLICATION_ID || process.env.DISCORD_CLIENT_ID;
    const digits = (raw || "").replace(/[^\d]/g, "");
    return digits.length >= 17 ? digits : null;
}

/**
 * Résolveur « tout replié » : aucun emoji custom disponible → on rend les replis
 * unicode du catalogue (situation normale tant que la synchro n'a pas été jouée).
 */
export function fallbackEmojiResolver(): EmojiResolver {
    return (name) => DISCORD_EMOJIS[name]?.fallback ?? "";
}

async function fetchApplicationEmojiMap(): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const token = process.env.DISCORD_BOT_TOKEN;
    const appId = getDiscordApplicationId();
    if (!token || !appId) return map;

    try {
        const res = await fetchWithRetry(`/api/v10/applications/${appId}/emojis`, {
            headers: { Authorization: `Bot ${token}`, "Cache-Control": "no-store" },
        });
        if (!res.ok) {
            logger.warn(`[DiscordEmoji] listing échoué ${res.status}`);
            return map;
        }
        const body = (await res.json()) as { items?: { id?: string; name?: string | null }[] };
        for (const item of body.items ?? []) {
            // Nom nullable (même règle que partout : jamais de nom supposé non nul).
            if (item?.id && item.name) map.set(item.name, item.id);
        }
    } catch (error) {
        logger.warn("[DiscordEmoji] listing impossible", { error: String(error) });
    }
    return map;
}

/**
 * Résolveur à utiliser dans un constructeur d'embed : UN SEUL appel (await) puis
 * usage synchrone. `force` court-circuite le cache (diagnostic/God).
 */
export async function loadEmojiResolver(force = false): Promise<EmojiResolver> {
    const now = Date.now();
    if (!force && cache && now - cache.at < CACHE_TTL_MS) {
        const map = cache.map;
        return (name) => {
            const entry = DISCORD_EMOJIS[name];
            if (!entry) return "";
            const id = map.get(entry.name);
            return id ? `<:${entry.name}:${id}>` : entry.fallback;
        };
    }

    const map = await fetchApplicationEmojiMap();
    cache = { at: now, map };
    return (name) => {
        const entry = DISCORD_EMOJIS[name];
        if (!entry) return "";
        const id = map.get(entry.name);
        return id ? `<:${entry.name}:${id}>` : entry.fallback;
    };
}

/** Vide le cache en mémoire (après une synchro d'emojis, pour voir le résultat tout de suite). */
export function invalidateAppEmojiCache(): void {
    cache = null;
}
