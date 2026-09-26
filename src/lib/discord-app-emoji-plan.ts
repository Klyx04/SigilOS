/**
 * Plan de synchro des emojis d'application Discord — PUR et testable.
 *
 * Sépare la DÉCISION (quoi créer, quoi refuser) de l'ENTRÉE/SORTIE (réseau, fs) :
 * `scripts/sync-discord-app-emojis.ts` n'est plus qu'une couche fine autour de ce
 * module, donc les règles de Discord sont vérifiables sans réseau :
 *  · nom d'emoji ≤ 32 caractères ;
 *  · image ≤ 256 Kio (limite Discord, en dur dans la doc) — nos PNG de palier
 *    `missions/songes.png` (1,3 Mo) et `missions/anomalie.png` (693 Ko) la
 *    dépassent : ils doivent être REFUSÉS, jamais envoyer un lot en échec ;
 *  · un emoji déjà présent (même nom) n'est jamais renvoyé : la synchro est
 *    idempotente et ne consomme pas le quota pour rien.
 */
import { DISCORD_EMOJI_LIST, type DiscordEmojiEntry } from "@/lib/discord-emoji-catalog";

/** Limite Discord d'un fichier emoji (256 Kio) — la dépasser = 400 Bad Request. */
export const MAX_APP_EMOJI_BYTES = 256 * 1024;

/** Limite Discord d'un nom d'emoji. */
export const MAX_APP_EMOJI_NAME_LENGTH = 32;

export type AppEmojiRejection = { entry: DiscordEmojiEntry; reason: string };

export type AppEmojiPlan = {
    /** À créer maintenant (absent côté Discord, valide). */
    toCreate: DiscordEmojiEntry[];
    /** Déjà présents (rien à faire : idempotence). */
    alreadyThere: DiscordEmojiEntry[];
    /** Refusés AVANT tout appel réseau (le lot ne casse jamais pour autant). */
    rejected: AppEmojiRejection[];
};

/**
 * @param entries   Catalogue (défaut : le catalogue du projet).
 * @param existing  Noms déjà portés par l'application Discord.
 * @param fileSize  Taille d'un PNG local en octets (`null` si le fichier manque).
 */
export function planAppEmojiSync(
    existing: Iterable<string>,
    fileSize: (file: string) => number | null,
    entries: DiscordEmojiEntry[] = DISCORD_EMOJI_LIST
): AppEmojiPlan {
    const existingNames = new Set(existing);
    const plan: AppEmojiPlan = { toCreate: [], alreadyThere: [], rejected: [] };

    for (const entry of entries) {
        if (entry.name.length > MAX_APP_EMOJI_NAME_LENGTH) {
            plan.rejected.push({ entry, reason: `nom trop long (${entry.name.length} > ${MAX_APP_EMOJI_NAME_LENGTH})` });
            continue;
        }
        if (!/^[a-z0-9_]+$/.test(entry.name)) {
            plan.rejected.push({ entry, reason: "nom invalide (attendu : minuscules, chiffres, _)" });
            continue;
        }
        const size = fileSize(entry.file);
        if (size == null) {
            plan.rejected.push({ entry, reason: `fichier introuvable (${entry.file})` });
            continue;
        }
        if (size > MAX_APP_EMOJI_BYTES) {
            plan.rejected.push({
                entry,
                reason: `fichier trop lourd (${Math.round(size / 1024)} Ko > ${MAX_APP_EMOJI_BYTES / 1024} Ko) — réduire l'image`,
            });
            continue;
        }
        if (existingNames.has(entry.name)) {
            plan.alreadyThere.push(entry);
            continue;
        }
        plan.toCreate.push(entry);
    }

    return plan;
}

/** Markup d'un emoji custom prêt à être inséré dans un embed. */
export function appEmojiMarkup(name: string, id: string): string {
    return `<:${name}:${id}>`;
}
