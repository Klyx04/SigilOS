/**
 * Espace visiteur (rang 57) — **gardes serveur** du compte public.
 *
 * Deux portes, pas une :
 *  · `requirePublicSession()` : session valide **+** compte non banni. C'est la porte de
 *    l'écran de **création** de profil (un visiteur connecté n'a pas encore de
 *    `PublicProfile`, et `dofusServerId` est obligatoire — il doit choisir son serveur).
 *  · `requirePublicAccount()` : la précédente **+** profil public existant. C'est la porte
 *    des six segments.
 *
 * Pourquoi re-vérifier le bannissement ici alors que `signIn` le fait déjà : les sessions
 * sont en **JWT** (8 h, `src/auth.ts`). Un compte banni pendant qu'il est connecté garde
 * son jeton jusqu'à expiration. Cette garde couvre la surface publique, et **fail-closed** :
 * dans le doute, on refuse.
 *
 * **D-V11** : `touchLastSeen` est appelé par la garde de session, donc par **toutes** les
 * pages (création comprise). Sans ça, un visiteur n'était jamais marqué « vu » (seul
 * `getUserContext` l'écrit) et serait purgé à l'échéance malgré des visites quotidiennes.
 *
 * **DTO étanche** : aucune fonction de ce module ne rend une ligne Prisma brute. Le
 * `select` est explicite et `metamobApiKey` n'en sort que sous forme de booléen
 * (`src/lib/public-profile-dto.ts`).
 *
 * Aucune donnée personnelle dans les logs (pas de snowflake, pas de pseudo).
 */

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { redirect } from "next/navigation";
import { touchLastSeen } from "@/server/last-seen";
import { AVAILABLE_ACTIVITIES } from "@/lib/presentation-constants";
import {
    toPublicProfileView,
    type PublicProfileRow,
    type PublicProfileView,
} from "@/lib/public-profile-dto";

/**
 * Liste **blanche** des colonnes lues. `metamobApiKey` y figure parce que le mapper en
 * dérive `hasMetamobApiKey` ; elle ne franchit jamais la frontière RSC.
 */
const PUBLIC_PROFILE_SELECT = {
    id: true,
    userId: true,
    dofusServerId: true,
    pseudoDofus: true,
    classe: true,
    declaredGuildName: true,
    altPseudos: true,
    introduction: true,
    objectifs: true,
    preferredActivities: true,
    metamobPseudo: true,
    metamobApiKey: true,
    metamobVerified: true,
    alignment: true,
    alignmentOrder: true,
    alignmentLevel: true,
    dofusLevel: true,
    totalXp: true,
    successPoints: true,
    lastLadderSync: true,
    showOnDirectory: true,
    showPresence: true,
    showRushProgress: true,
    createdAt: true,
    updatedAt: true,
} as const;

const ALLOWED_ACTIVITIES = AVAILABLE_ACTIVITIES.map((activity) => activity.id);

export type PublicSession = {
    /** `User.id` — jamais un `guildId` : l'espace visiteur est hors guilde par construction. */
    userId: string;
};

export type PublicAccount = {
    userId: string;
    profile: PublicProfileView;
};

/**
 * Vue publique d'un profil, ou `null` s'il n'existe pas encore.
 *
 * `PublicProfileRow` est vérifié par le typage : un champ ajouté à la vue sans être ajouté
 * au `select` casse la compilation.
 */
export async function loadPublicProfileView(userId: string): Promise<PublicProfileView | null> {
    const row: PublicProfileRow | null = await db.publicProfile.findUnique({
        where: { userId },
        select: PUBLIC_PROFILE_SELECT,
    });
    return row ? toPublicProfileView(row, ALLOWED_ACTIVITIES) : null;
}

/**
 * Session visiteur, ou `null` si l'accès est refusé (pas de session, compte banni).
 *
 * Les **actions serveur** utilisent cette fonction et rendent un refus explicite ; les
 * **pages** utilisent `requirePublicSession` (redirection).
 */
export async function getPublicSession(): Promise<PublicSession | null> {
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

    return { userId };
}

/**
 * Compte visiteur complet, ou `null` si l'accès est refusé (pas de session, compte banni,
 * ou pas encore de profil public). Utilisé par les **actions** (refus explicite) et les
 * pages qui savent accepter l'absence de profil (`general`).
 */
export async function getPublicAccount(): Promise<PublicAccount | null> {
    const visitor = await getPublicSession();
    if (!visitor) return null;

    const profile = await loadPublicProfileView(visitor.userId);
    return profile ? { userId: visitor.userId, profile } : null;
}

/**
 * Garde de **page** de l'écran de création : session valide et compte non banni, profil
 * facultatif. Marque l'activité (**D-V11**).
 */
export async function requirePublicSession(): Promise<PublicSession> {
    const visitor = await getPublicSession();
    if (!visitor) redirect("/");

    await touchLastSeen(visitor.userId);
    return visitor;
}

/**
 * Garde de **page** des six segments : redirige au lieu de rendre. Jamais de rendu partiel.
 *
 * Un visiteur connecté **sans** profil public est renvoyé sur `general`, qui porte l'écran
 * de création (serveur obligatoire). Aucune page publique n'est servie dans cet état.
 */
export async function requirePublicAccount(): Promise<PublicAccount> {
    const visitor = await requirePublicSession();

    const profile = await loadPublicProfileView(visitor.userId);
    if (!profile) redirect("/espace-visiteur/general");

    return { userId: visitor.userId, profile };
}
