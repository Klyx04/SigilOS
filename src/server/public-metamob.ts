/**
 * Espace visiteur — **lecture Metamob partagée** (serveur uniquement).
 *
 * Deux besoins identiques vivaient dans `public-profile-actions.ts` et allaient être
 * recopiés dans la vue « Échanges » : lire la clé du visiteur (déchiffrée par le hook
 * Prisma) et reconnaître sa quête Ocre. Une seule source, donc un seul comportement.
 *
 * Invariants :
 *  · la clé rendue est **en clair** pour l'appelant serveur, jamais pour un composant ;
 *  · `readVisitorMetamob` ne sélectionne que la clé et le pseudo (aucun autre champ) ;
 *  · `pickVisitorOcreQuest` est pur et ne devine jamais : pas de quête ⇒ `null`.
 */

import { db } from "@/lib/prisma";
import { listSelfQuests, matchesOcreQuest, type UserQuest } from "@/lib/metamob-client";

/** La clé du visiteur : lue (déchiffrée par le hook Prisma), **jamais** renvoyée au client. */
export async function readVisitorMetamob(userId: string) {
    const row = await db.publicProfile.findUnique({
        where: { userId },
        select: { metamobApiKey: true, metamobPseudo: true },
    });
    return { key: row?.metamobApiKey?.trim() || null, pseudo: row?.metamobPseudo ?? null };
}

/**
 * La quête d'échange du compte. Le type (`quest_type.slug`) est la source la plus fiable
 * (doc API 11/11/2026) ; `matchesOcreQuest` garde les heuristiques historiques.
 */
export function pickVisitorOcreQuest(
    quests: ReadonlyArray<UserQuest>
): UserQuest | null {
    return quests.find((quest) => matchesOcreQuest(quest)) ?? null;
}

/**
 * Slug de la quête Ocre du compte — repli sur la première quête (comportement historique
 * de la progression Ocre). La vue « Échanges » utilise `pickVisitorOcreQuest` **sans** ce
 * repli : une quête sans rapport ne doit pas ouvrir un tableau d'échanges vide.
 */
export async function resolveVisitorOcreSlug(
    pseudo: string,
    key: string
): Promise<string | null> {
    const quests = await listSelfQuests(pseudo, key);
    return pickVisitorOcreQuest(quests)?.slug ?? quests[0]?.slug ?? null;
}
