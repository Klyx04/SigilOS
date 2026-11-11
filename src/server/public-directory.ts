/**
 * Espace visiteur (rang 57) — **annuaire des visiteurs** (V2e), couche serveur.
 *
 * Trois invariants, et ils suffisent à tenir le cloisonnement :
 *  · **porte unique** : `resolveDirectoryViewer()` — session valide, compte non banni (via
 *    `getPublicSession()`), profil public existant. Sans profil, pas de serveur, donc pas
 *    d'annuaire : c'est ce qui empêche un membre de guilde de lire des visiteurs (D-V3) ;
 *  · **serveur imposé** : `viewer.serverId` vient du profil, jamais de l'URL ni d'un champ
 *    de formulaire — forger l'URL ne change que le filtre classe/métier ;
 *  · **consentement** : `showOnDirectory: true` est dans *chaque* `where`, liste comme fiche.
 *
 * Aucun `guildId` dans ce fichier : l'annuaire ne lit aucune donnée de guilde.
 */

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { getPublicSession } from "@/server/public-account";
import {
    PUBLIC_DIRECTORY_PAGE_SIZE,
    buildVisitorDirectoryWhere,
    isPublicProfileId,
    toVisitorDirectoryEntry,
    toVisitorProfile,
    type VisitorDirectoryEntry,
    type VisitorDirectoryFilters,
    type VisitorProfile,
} from "@/lib/public-directory";

export type DirectoryViewer = {
    /** `User.id` — jamais un `guildId`. */
    userId: string;
    /** `PublicProfile.id` — sert à savoir **qui** lit (aucune écriture ici). */
    profileId: string;
    /** Serveur du lecteur, résolu côté serveur : le seul périmètre lisible. */
    serverId: number;
    /** Résumé **du lecteur** pour le bandeau du hub — sa propre fiche, rien de plus. */
    pseudo: string | null;
    classe: string | null;
    level: number | null;
    successPoints: number | null;
    achievements: number;
    jobs: number;
    /** Le lecteur apparaît-il lui-même dans l'annuaire ? (lien « voir mon profil public ») */
    showOnDirectory: boolean;
};

/**
 * Les trois états de la porte. Le rendu a besoin de les distinguer pour dire *pourquoi*
 * l'annuaire est fermé (se connecter ≠ créer un profil) — un simple `null` obligerait la
 * page à refaire une requête pour deviner.
 */
export type DirectoryAccess =
    | { status: "anonymous" }
    | { status: "no-profile"; userId: string }
    | { status: "viewer"; viewer: DirectoryViewer };

/**
 * Garde de l'annuaire. `getPublicSession()` couvre session **et** bannissement (JWT de 8 h :
 * un compte banni garde son jeton jusqu'à expiration, donc on revérifie ici).
 */
export async function resolveDirectoryViewer(): Promise<DirectoryAccess> {
    const session = await getPublicSession();
    if (!session) return { status: "anonymous" };

    const profile = await db.publicProfile.findUnique({
        where: { userId: session.userId },
        select: {
            id: true,
            dofusServerId: true,
            pseudoDofus: true,
            classe: true,
            dofusLevel: true,
            successPoints: true,
            showOnDirectory: true,
            _count: {
                select: {
                    achievements: true,
                    // Les métiers à 0 ne sont pas des déclarations valides (niveau obligatoire) :
                    // le compteur du bandeau doit dire la même chose que l'annuaire.
                    professions: { where: { level: { gte: 1 } } },
                },
            },
        },
    });
    if (!profile) return { status: "no-profile", userId: session.userId };

    return {
        status: "viewer",
        viewer: {
            userId: session.userId,
            profileId: profile.id,
            serverId: profile.dofusServerId,
            pseudo: profile.pseudoDofus,
            classe: profile.classe,
            level: profile.dofusLevel,
            successPoints: profile.successPoints,
            achievements: profile._count.achievements,
            jobs: profile._count.professions,
            showOnDirectory: profile.showOnDirectory,
        },
    };
}

/**
 * Ordre des métiers : le plus haut niveau d'abord, puis l'identifiant (déterministe).
 * Typé explicitement — un `as const` rendrait le tableau `readonly`, que Prisma refuse.
 */
const PROFILE_JOBS_ORDER: Prisma.PublicProfessionOrderByWithRelationInput[] = [
    { level: "desc" },
    { metierId: "asc" },
];

/**
 * Liste blanche de la **liste**. Volontairement sans `metamobApiKey`, sans `altPseudos`
 * (mules) et sans `userId` : un champ absent du `select` ne peut pas fuir.
 * `introduction` / `objectifs` ne sont pas lus ici (24 profils × 800 caractères inutiles).
 *
 * Deux règles sur les métiers :
 *  · on ne lit **jamais** un métier à 0 — le niveau est obligatoire dans le profil, un 0
 *    est une donnée d'avant la règle, pas une déclaration ;
 *  · quand un métier est filtré, on ne lit **que** celui-là : l'écran affiche « le métier
 *    filtré et son niveau », pas les quatre autres (retour user du 11/11/2026).
 */
const LIST_SELECT_BASE = {
    id: true,
    pseudoDofus: true,
    classe: true,
    dofusServerId: true,
    declaredGuildName: true,
    dofusLevel: true,
    successPoints: true,
    updatedAt: true,
    _count: { select: { achievements: true } },
} satisfies Prisma.PublicProfileSelect;

function listSelect(jobFilter?: string): Prisma.PublicProfileSelect {
    return {
        ...LIST_SELECT_BASE,
        professions: jobFilter
            ? {
                  where: { metierId: jobFilter, level: { gte: 1 } },
                  select: { metierId: true, level: true },
                  take: 1,
              }
            : {
                  where: { level: { gte: 1 } },
                  select: { metierId: true, level: true },
                  orderBy: PROFILE_JOBS_ORDER,
                  take: 6,
              },
    };
}

/** Liste blanche de la **fiche** : la même, plus la présentation et tous les métiers. */
const PROFILE_SELECT = {
    ...LIST_SELECT_BASE,
    introduction: true,
    objectifs: true,
    professions: {
        where: { level: { gte: 1 } },
        select: { metierId: true, level: true },
        orderBy: PROFILE_JOBS_ORDER,
        take: 50,
    },
} satisfies Prisma.PublicProfileSelect;

/**
 * Une page d'annuaire, du plus récent au plus ancien (`id` décroissant = ordre stable et
 * unique, donc curseur fiable). `take + 1` sert **uniquement** à savoir s'il existe une page
 * suivante : la ligne supplémentaire n'est jamais rendue.
 */
export async function listPublicVisitors(
    viewer: DirectoryViewer,
    filters: VisitorDirectoryFilters
): Promise<{ items: VisitorDirectoryEntry[]; nextCursor: string | null }> {
    const rows = await db.publicProfile.findMany({
        where: buildVisitorDirectoryWhere(viewer.serverId, filters),
        select: listSelect(filters.metier),
        orderBy: { id: "desc" },
        take: PUBLIC_DIRECTORY_PAGE_SIZE + 1,
        ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > PUBLIC_DIRECTORY_PAGE_SIZE;
    const page = hasMore ? rows.slice(0, PUBLIC_DIRECTORY_PAGE_SIZE) : rows;
    const items = page.map(toVisitorDirectoryEntry);

    return {
        items,
        nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
    };
}

/**
 * Fiche d'un visiteur du **même serveur**, consentante. `findFirst` (et non `findUnique`) :
 * les conditions de visibilité font partie de la requête, pas d'un `if` après coup — un
 * profil non consentant est **introuvable**, jamais « trouvé puis masqué ».
 */
function safeDecode(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

/**
 * Fiche d'un visiteur du serveur. La clé peut être un **pseudo** (URL lisible) ou un
 * cuid (anciens liens). Un pseudo porté par deux profils du même serveur rend les deux
 * candidats : la page propose un choix, jamais un 404 silencieux.
 */
export async function getPublicVisitor(
    viewer: DirectoryViewer,
    profileKey: string
): Promise<VisitorProfile | VisitorProfile[] | null> {
    const key = safeDecode(profileKey).trim();
    if (!key) return null;

    if (isPublicProfileId(key)) {
        const row = await db.publicProfile.findFirst({
            where: {
                id: key,
                showOnDirectory: true,
                dofusServerId: viewer.serverId,
            },
            select: PROFILE_SELECT,
        });
        if (row) return toVisitorProfile(row);
    }

    const rows = await db.publicProfile.findMany({
        where: {
            showOnDirectory: true,
            dofusServerId: viewer.serverId,
            pseudoDofus: { equals: key, mode: "insensitive" },
        },
        select: PROFILE_SELECT,
        take: 2,
    });
    if (rows.length === 0) return null;
    if (rows.length === 1) return toVisitorProfile(rows[0]);
    return rows.map(toVisitorProfile);
}

/** Compteur affiché à l'écran (le seul agrégat autorisé — D-V8 interdit les stats agrégées). */
export async function countPublicVisitors(
    viewer: DirectoryViewer,
    filters: VisitorDirectoryFilters
): Promise<number> {
    return db.publicProfile.count({
        where: buildVisitorDirectoryWhere(viewer.serverId, filters),
    });
}
