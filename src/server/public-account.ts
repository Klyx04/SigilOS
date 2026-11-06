/**
 * Espace visiteur (rang 57) — **garde serveur** du compte public.
 *
 * Une seule porte pour toutes les pages et actions de l'espace visiteur :
 * session valide **+** compte non banni **+** profil public existant.
 *
 * Pourquoi re-vérifier le bannissement ici alors que `signIn` le fait déjà : les sessions
 * sont en **JWT** (8 h, `src/auth.ts`). Un compte banni pendant qu'il est connecté garde
 * son jeton jusqu'à expiration. Le dashboard a le même besoin ; cette garde le couvre pour
 * la surface publique, et **fail-closed** : dans le doute, on refuse.
 *
 * Aucune donnée personnelle dans les logs (pas de snowflake, pas de pseudo).
 */

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { redirect } from "next/navigation";
import type { PublicProfile } from "@prisma/client";

export type PublicAccount = {
    /** `User.id` — jamais un `guildId` : l'espace visiteur est hors guilde par construction. */
    userId: string;
    profile: PublicProfile;
};

/**
 * Compte visiteur, ou `null` si l'accès est refusé (pas de session, compte banni, ou pas
 * encore de profil public).
 *
 * Les **actions serveur** utilisent cette fonction et rendent un refus explicite ; les
 * **pages** utilisent `requirePublicAccount` (redirection).
 */
export async function getPublicAccount(): Promise<PublicAccount | null> {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return null;

    const discordId = (session.user as { discordId?: string } | undefined)?.discordId;
    if (discordId) {
        const ban = await db.platformBan.findFirst({
            where: { discordId, entityType: "USER" },
            select: { id: true },
        });
        if (ban) {
            logger.warn("[Espace visiteur] Accès refusé : compte banni.");
            return null;
        }
    }

    const profile = await db.publicProfile.findUnique({ where: { userId } });
    return profile ? { userId, profile } : null;
}

/**
 * Garde de **page** : redirige au lieu de rendre. Jamais de rendu partiel.
 *
 * Un visiteur connecté **sans** profil public est renvoyé à l'accueil : l'écran
 * d'installation fait partie du lot V1c, il n'existe pas encore. Aucune page publique ne
 * doit être servie dans cet état.
 */
export async function requirePublicAccount(): Promise<PublicAccount> {
    const account = await getPublicAccount();
    if (!account) redirect("/");
    return account;
}
