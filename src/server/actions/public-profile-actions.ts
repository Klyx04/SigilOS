"use server";

/**
 * Espace visiteur (rang 57) — **actions serveur** du profil public (lot V1c).
 *
 * Règles du dépôt, appliquées à la lettre et vérifiées par
 * `tests/unit/public-profile-actions.test.ts` :
 *  · **garde dans l'action** (`getPublicAccount()` / `getPublicSession()`), jamais la seule
 *    présence d'une session ;
 *  · **Zod borné** (`src/lib/public-profile-input.ts`), messages lisibles ;
 *  · **rate limit** Redis sur chaque mutation ;
 *  · **écriture `where: { userId }`** — l'identifiant vient du serveur, jamais du client ;
 *  · **cible vérifiée** avant écriture (succès de donjon, métier connu) ;
 *  · aucun secret dans les logs (pas de clé Metamob, pas de snowflake, pas de pseudo).
 */

import { revalidatePath } from "next/cache";
import { z, type ZodError } from "zod";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/ratelimit";
import { getPublicAccount, getPublicSession } from "@/server/public-account";
import { getMetamobMe } from "@/lib/metamob-client";
import { ORDERS } from "@/lib/dofus-assets";
import { checkPseudoExistsOnLadder } from "@/server/ladder-pseudo";
import { fetchLadderSnapshot, type LadderSnapshot } from "@/server/ladder-snapshot";
import { isLadderManualFallbackEnabled } from "@/server/actions/profile-actions";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { SUCCES_DUNGEONS_TAKE, findSuccesLevelBracketStrict } from "@/lib/succes-level-brackets";
import {
    createPublicProfileSchema,
    deletePublicProfileSchema,
    isKnownJobId,
    publicAlignmentSchema,
    publicIdentitySchema,
    publicMetamobSchema,
    publicMulesSchema,
    publicPresentationSchema,
    publicPseudoSchema,
    publicServerIdSchema,
    publicProfessionsSchema,
    publicSettingsSchema,
    sanitizePreferredActivities,
} from "@/lib/public-profile-input";

type ActionResult = { success: true } | { success: false; error: string };

const SESSION_EXPIRED = "Ta session a expiré. Reconnecte-toi pour continuer.";
const RATE_LIMITED = "Trop de modifications d'affilée. Réessaie dans une minute.";

const PATHS = {
    general: "/espace-visiteur/general",
    mules: "/espace-visiteur/mules",
    presentation: "/espace-visiteur/presentation",
    succes: "/espace-visiteur/succes",
    metiers: "/espace-visiteur/metiers",
    reglages: "/espace-visiteur/reglages",
} as const;

/** Le guide public du Rush lit `alignment` / `alignmentOrder` : il se revalide avec le profil. */
const RUSH_GUIDE_PATH = "/guides/rush-sylvestre";

function firstIssue(error: ZodError): string {
    return error.issues[0]?.message ?? "Données invalides.";
}

/** Rate limit commun : rend le refus, ou `null` quand la mutation peut continuer. */
async function limit(
    scope: string,
    userId: string,
    max: number,
    windowMs = 60_000
): Promise<{ success: false; error: string } | null> {
    const result = await rateLimit(`visitor:${scope}:${userId}`, max, windowMs);
    return result.success ? null : { success: false, error: RATE_LIMITED };
}

function emptyToNull(value: string | null | undefined): string | null {
    const trimmed = (value ?? "").trim();
    return trimmed.length > 0 ? trimmed : null;
}

/**
 * Mapping **unique** d'un snapshot ladder vers les colonnes du profil public.
 *
 * Deux appelants (enregistrement de l'identité, bouton « Vérifier ») : une seule conversion,
 * sinon les deux chemins divergent au premier champ ajouté. `lastLadderUpdate` (nom du profil
 * interne) devient `lastLadderSync` (nom du profil public) — c'est le seul écart de nom.
 */
function ladderUpdateData(snapshot: LadderSnapshot) {
    return {
        ...(snapshot.dofusLevel !== undefined ? { dofusLevel: snapshot.dofusLevel } : {}),
        ...(snapshot.totalXp !== undefined ? { totalXp: snapshot.totalXp } : {}),
        ...(snapshot.successPoints !== undefined ? { successPoints: snapshot.successPoints } : {}),
        ...(snapshot.lastLadderUpdate ? { lastLadderSync: snapshot.lastLadderUpdate } : {}),
    };
}

/** Création du profil public — la seule action ouverte à une session **sans** profil. */
export async function createPublicProfile(raw: unknown): Promise<ActionResult> {
    const parsed = createPublicProfileSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    const visitor = await getPublicSession();
    if (!visitor) return { success: false, error: SESSION_EXPIRED };

    const limited = await limit("create", visitor.userId, 5);
    if (limited) return limited;

    const existing = await db.publicProfile.findUnique({
        where: { userId: visitor.userId },
        select: { id: true },
    });
    if (existing) return { success: false, error: "Ton profil existe déjà." };

    try {
        await db.publicProfile.create({
            data: {
                userId: visitor.userId,
                dofusServerId: parsed.data.dofusServerId,
                pseudoDofus: parsed.data.pseudoDofus,
            },
        });
        revalidatePath(PATHS.general);
        return { success: true };
    } catch (error) {
        if ((error as { code?: string }).code === "P2002") {
            return { success: false, error: "Ton profil existe déjà." };
        }
        logger.error("[Espace visiteur] Création de profil impossible", { error });
        return { success: false, error: "Impossible de créer ton profil pour l'instant." };
    }
}

/** Identité : serveur, pseudo, classe, nom de guilde déclaré (D-V7 : aucun logo). */
export async function updatePublicIdentity(raw: unknown): Promise<ActionResult> {
    const parsed = publicIdentitySchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    const account = await getPublicAccount();
    if (!account) return { success: false, error: SESSION_EXPIRED };

    const limited = await limit("identity", account.userId, 20);
    if (limited) return limited;

    /**
     * Snapshot ladder immédiat (V1e) : le visiteur qui enregistre son pseudo récupère son
     * niveau, son XP et ses points de succès — sans quoi l'annuaire affiche « — ».
     *
     * **Best effort**, timeout court (6 s) : un worker lent ou absent ne doit jamais empêcher
     * d'enregistrer son identité. On n'écrit **jamais** `classe` depuis le ladder : le profil
     * public stocke un **id** (`iop`, `feca`) et le ladder renvoie un **libellé** (« Iop ») —
     * l'écrire casserait le filtre par classe de l'annuaire.
     */
    const ladderData = parsed.data.pseudoDofus
        ? await fetchLadderSnapshot(parsed.data.pseudoDofus, parsed.data.dofusServerId, 6_000)
        : {};

    const data = {
        dofusServerId: parsed.data.dofusServerId,
        pseudoDofus: parsed.data.pseudoDofus,
        classe: parsed.data.classe,
        declaredGuildName: parsed.data.declaredGuildName,
        ...ladderUpdateData(ladderData),
    };

    try {
        await db.publicProfile.update({
            where: { userId: account.userId },
            data,
        });
        revalidatePath(PATHS.general);
        return { success: true };
    } catch (error) {
        logger.error("[Espace visiteur] Identité non enregistrée", { error });
        return { success: false, error: "Impossible d'enregistrer ton identité." };
    }
}

/**
 * Alignement déclaré (V2a-4, 07/11/2026) — **la** donnée qui manquait : `PublicProfile.alignment`
 * existait en base mais **aucune action ne l'écrivait**, donc la tuile « Alignement » du guide
 * public ne pouvait rien changer (mesure du 06/11, confirmée par la demande user : « on peut
 * toujours pas changer son ali comme la mécanique du guide interne ? »).
 *
 * Cité + Ordre, bornés par Zod ; l'Ordre doit appartenir à la cité choisie et un neutre n'en a
 * pas. La tranche (`alignmentLevel`) n'est **pas** demandée : elle reste déduite des quêtes
 * validées par le guide, comme sur l'interne.
 */
export async function updatePublicAlignment(raw: unknown): Promise<ActionResult> {
    const parsed = publicAlignmentSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    const account = await getPublicAccount();
    if (!account) return { success: false, error: SESSION_EXPIRED };

    const limited = await limit("alignment", account.userId, 20);
    if (limited) return limited;

    const { alignment, alignmentOrder } = parsed.data;
    const knownOrder =
        alignment !== "neutre" &&
        !!alignmentOrder &&
        ((ORDERS as unknown as Record<string, Array<{ id: string }>>)[alignment] ?? []).some(
            (order) => order.id === alignmentOrder
        );
    if (alignmentOrder !== null && !knownOrder) {
        return { success: false, error: "Cet Ordre n'appartient pas à la cité choisie." };
    }

    try {
        await db.publicProfile.update({
            where: { userId: account.userId },
            data: { alignment, alignmentOrder: alignment === "neutre" ? null : alignmentOrder },
        });
        revalidatePath(PATHS.general);
        // La tuile du guide public lit ce champ : la page doit se rafraîchir dans la foulée.
        revalidatePath(RUSH_GUIDE_PATH);
        return { success: true };
    } catch (error) {
        logger.error("[Espace visiteur] Alignement non enregistré", { error });
        return { success: false, error: "Impossible d'enregistrer ton alignement." };
    }
}

/**
 * Metamob : pseudo et clé. La clé n'est **jamais relue** ; la changer invalide la
 * vérification (`metamobVerified = false`), c'est le worker de V1e qui la rétablit.
 */
export async function updatePublicMetamob(raw: unknown): Promise<ActionResult> {
    const parsed = publicMetamobSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    const account = await getPublicAccount();
    if (!account) return { success: false, error: SESSION_EXPIRED };

    const limited = await limit("metamob", account.userId, 10);
    if (limited) return limited;

    const data: {
        metamobPseudo: string | null;
        metamobApiKey?: string | null;
        metamobVerified?: boolean;
    } = { metamobPseudo: emptyToNull(parsed.data.metamobPseudo) };

    if (parsed.data.apiKey !== undefined) {
        const key = parsed.data.apiKey.trim();
        data.metamobApiKey = key.length > 0 ? key : null;
        data.metamobVerified = false;
    }

    try {
        await db.publicProfile.update({ where: { userId: account.userId }, data });
        revalidatePath(PATHS.general);
        return { success: true };
    } catch (error) {
        logger.error("[Espace visiteur] Metamob non enregistré", { error });
        return { success: false, error: "Impossible d'enregistrer tes informations Metamob." };
    }
}

/**
 * Vérification du pseudo Dofus auprès du ladder Ankama (bouton « Vérifier »).
 *
 * **Fail-open** : un worker indisponible rend `found: null` — jamais un refus d'enregistrement.
 * Le toggle God « Fallback Pseudo Manuel » (`PlatformConfig.ladderManualFallback`) court-circuite
 * l'appel et rend `manual: true`. Même helper que le profil interne (`src/server/ladder-pseudo.ts`).
 */
export type PublicPseudoCheck =
    | { success: true; found: boolean | null; manual: boolean }
    | { success: false; error: string };

export async function verifyPublicPseudo(raw: unknown): Promise<PublicPseudoCheck> {
    const parsed = z
        .object({ pseudo: publicPseudoSchema, dofusServerId: publicServerIdSchema })
        .safeParse(raw);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    const visitor = await getPublicSession();
    if (!visitor) return { success: false, error: SESSION_EXPIRED };

    const limited = await limit("pseudo-check", visitor.userId, 10);
    if (limited) return limited;

    if (await isLadderManualFallbackEnabled()) {
        return { success: true, found: null, manual: true };
    }

    const found = await checkPseudoExistsOnLadder(parsed.data.pseudo, String(parsed.data.dofusServerId));

    /**
     * V1e — « Vérifier » **son propre** pseudo rafraîchit le classement. C'est le seul moyen
     * de remplir les profils créés avant V1e sans leur demander de ré-enregistrer leur identité.
     *
     * On n'écrit que si le pseudo vérifié est **celui du profil** et sur le **même serveur** :
     * vérifier un pseudo qu'on n'a pas encore enregistré ne doit rien modifier.
     */
    if (found === true) {
        const profile = await db.publicProfile.findUnique({
            where: { userId: visitor.userId },
            select: { pseudoDofus: true, dofusServerId: true },
        });
        const isOwnPseudo =
            !!profile?.pseudoDofus &&
            profile.pseudoDofus.toLowerCase() === parsed.data.pseudo.toLowerCase() &&
            profile.dofusServerId === parsed.data.dofusServerId;

        if (isOwnPseudo) {
            const snapshot = await fetchLadderSnapshot(parsed.data.pseudo, parsed.data.dofusServerId, 6_000);
            const data = ladderUpdateData(snapshot);
            if (Object.keys(data).length > 0) {
                await db.publicProfile.update({ where: { userId: visitor.userId }, data });
                revalidatePath(PATHS.general);
            }
        }
    }

    return { success: true, found, manual: false };
}

/**
 * Vérification **immédiate** de la clé Metamob (bouton « Vérifier »), sans attendre le worker.
 *
 * La clé est lue **déchiffrée** par le hook Prisma et ne quitte jamais le serveur : aucun log,
 * aucun retour au client. Le pseudo renvoyé par `/v1/me` fait foi.
 */
export async function verifyPublicMetamob(): Promise<
    { success: true; pseudo: string | null } | { success: false; error: string }
> {
    const account = await getPublicAccount();
    if (!account) return { success: false, error: SESSION_EXPIRED };

    const limited = await limit("metamob-check", account.userId, 5);
    if (limited) return limited;

    const row = await db.publicProfile.findUnique({
        where: { userId: account.userId },
        select: { metamobApiKey: true, metamobPseudo: true },
    });
    const key = row?.metamobApiKey?.trim();
    if (!key) return { success: false, error: "Enregistre d'abord ta clé d'API Metamob." };

    try {
        const me = await getMetamobMe(key);
        const pseudo = me.username.trim().length > 0 ? me.username.trim() : row?.metamobPseudo ?? null;
        await db.publicProfile.update({
            where: { userId: account.userId },
            data: { metamobVerified: true, metamobPseudo: pseudo },
        });
        revalidatePath(PATHS.general);
        return { success: true, pseudo };
    } catch (error) {
        logger.warn("[Espace visiteur] Vérification Metamob refusée", {
            err: error instanceof Error ? error.message : String(error),
        });
        return { success: false, error: "Metamob n'a pas reconnu cette clé." };
    }
}


/** Mules : liste bornée (`PUBLIC_MULES_MAX`), normalisée par le schéma. */
export async function updatePublicMules(raw: unknown): Promise<ActionResult> {
    const parsed = publicMulesSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    const account = await getPublicAccount();
    if (!account) return { success: false, error: SESSION_EXPIRED };

    const limited = await limit("mules", account.userId, 20);
    if (limited) return limited;

    try {
        const mules = parsed.data.map((mule) => ({
            pseudo: mule.pseudo,
            classe: mule.classe ?? null,
            level: mule.level ?? null,
        }));
        await db.publicProfile.update({
            where: { userId: account.userId },
            data: { altPseudos: mules },
        });
        revalidatePath(PATHS.mules);
        return { success: true };
    } catch (error) {
        logger.error("[Espace visiteur] Mules non enregistrées", { error });
        return { success: false, error: "Impossible d'enregistrer tes mules." };
    }
}

/** Présentation : introduction, objectifs, activités (liste blanche). */
export async function updatePublicPresentation(raw: unknown): Promise<ActionResult> {
    const parsed = publicPresentationSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    const account = await getPublicAccount();
    if (!account) return { success: false, error: SESSION_EXPIRED };

    const limited = await limit("presentation", account.userId, 20);
    if (limited) return limited;

    try {
        await db.publicProfile.update({
            where: { userId: account.userId },
            data: {
                introduction: emptyToNull(parsed.data.introduction),
                objectifs: emptyToNull(parsed.data.objectifs),
                preferredActivities: sanitizePreferredActivities(parsed.data.preferredActivities),
            },
        });
        revalidatePath(PATHS.presentation);
        return { success: true };
    } catch (error) {
        logger.error("[Espace visiteur] Présentation non enregistrée", { error });
        return { success: false, error: "Impossible d'enregistrer ta présentation." };
    }
}

/**
 * Métiers : remplacement complet de l'ensemble (10/min), slugs vérifiés contre
 * `DOFUS_JOBS`. `PublicProfession` est la **seule** source (le `Json metiers` n'est pas écrit).
 */
export async function updatePublicProfessions(raw: unknown): Promise<ActionResult> {
    const parsed = publicProfessionsSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    const account = await getPublicAccount();
    if (!account) return { success: false, error: SESSION_EXPIRED };

    const limited = await limit("professions", account.userId, 10);
    if (limited) return limited;

    if (parsed.data.some((entry) => !isKnownJobId(entry.id))) {
        return { success: false, error: "Un des métiers choisis n'existe pas." };
    }

    const publicProfileId = account.profile.id;
    try {
        await db.$transaction([
            db.publicProfession.deleteMany({ where: { publicProfileId } }),
            ...(parsed.data.length > 0
                ? [
                      db.publicProfession.createMany({
                          data: parsed.data.map((entry) => ({
                              publicProfileId,
                              metierId: entry.id,
                              level: entry.level,
                          })),
                      }),
                  ]
                : []),
        ]);
        revalidatePath(PATHS.metiers);
        return { success: true };
    } catch (error) {
        logger.error("[Espace visiteur] Métiers non enregistrés", { error });
        return { success: false, error: "Impossible d'enregistrer tes métiers." };
    }
}

/** Réglages : les deux consentements restent **indépendants** (D-V4 / D9). */
export async function updatePublicSettings(raw: unknown): Promise<ActionResult> {
    const parsed = publicSettingsSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    const account = await getPublicAccount();
    if (!account) return { success: false, error: SESSION_EXPIRED };

    const limited = await limit("settings", account.userId, 20);
    if (limited) return limited;

    try {
        await db.publicProfile.update({
            where: { userId: account.userId },
            data: {
                showOnDirectory: parsed.data.showOnDirectory,
                showPresence: parsed.data.showPresence,
            },
        });
        revalidatePath(PATHS.reglages);
        return { success: true };
    } catch (error) {
        logger.error("[Espace visiteur] Réglages non enregistrés", { error });
        return { success: false, error: "Impossible d'enregistrer tes réglages." };
    }
}

const toggleAchievementSchema = z.object({
    dungeonAchievementId: z.string().min(1).max(64),
});

/** Coche / décoche un succès de donjon. La cible est **relue en base** avant écriture. */
export async function togglePublicDungeonAchievement(raw: unknown): Promise<ActionResult> {
    const parsed = toggleAchievementSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    const account = await getPublicAccount();
    if (!account) return { success: false, error: SESSION_EXPIRED };

    const limited = await limit("achievement", account.userId, 60);
    if (limited) return limited;

    const publicProfileId = account.profile.id;
    try {
        const achievement = await db.dungeonAchievement.findUnique({
            where: { id: parsed.data.dungeonAchievementId },
            select: { id: true },
        });
        if (!achievement) return { success: false, error: "Ce succès de donjon n'existe pas." };

        const existing = await db.publicDungeonAchievement.findUnique({
            where: {
                publicProfileId_dungeonAchievementId: {
                    publicProfileId,
                    dungeonAchievementId: achievement.id,
                },
            },
            select: { id: true },
        });

        if (existing) {
            await db.publicDungeonAchievement.delete({ where: { id: existing.id } });
        } else {
            try {
                await db.publicDungeonAchievement.create({
                    data: { publicProfileId, dungeonAchievementId: achievement.id },
                });
            } catch (error) {
                // Course : deux clics rapprochés — la contrainte unique tranche, l'état reste « fait ».
                if ((error as { code?: string }).code !== "P2002") throw error;
            }
        }

        revalidatePath(PATHS.succes);
        return { success: true };
    } catch (error) {
        logger.error("[Espace visiteur] Succès non enregistré", { error });
        return { success: false, error: "Impossible d'enregistrer cette coche." };
    }
}

const bracketToggleSchema = z.object({
    /** Id d'une tranche de `SUCCES_LEVEL_BRACKETS` — jamais une plage envoyée par le client. */
    bracketId: z.string().min(1).max(16),
    action: z.enum(["validate", "unvalidate"]),
});

export type PublicAchievementsToggleResult =
    | { success: true; data: { count: number; achievementIds: string[] } }
    | { success: false; error: string };

/**
 * Validation / dévalidation **groupée** des succès d'une tranche de niveau (V1i).
 *
 * Même geste que `toggleLevelBracketAchievements` (interne) **sans `guildId`** : la seule
 * autorité est le profil public du compte connecté (`account.profile.id`).
 *
 * La tranche est **résolue strictement** côté serveur : le client n'envoie qu'un id de la
 * liste partagée, jamais une plage de niveaux. Un id forgé est **refusé** — le repli « tout »
 * de `findSuccesLevelBracket` est une commodité d'UI, l'utiliser ici validerait tout le jeu.
 *
 * Même borne (`SUCCES_DUNGEONS_TAKE`) et même tri que la page : on ne valide jamais plus de
 * donjons que l'écran n'en affiche.
 */
export async function togglePublicDungeonAchievementsBracket(
    raw: unknown
): Promise<PublicAchievementsToggleResult> {
    const parsed = bracketToggleSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    const account = await getPublicAccount();
    if (!account) return { success: false, error: SESSION_EXPIRED };

    const limited = await limit("achievement-bracket", account.userId, 5);
    if (limited) return limited;

    const bracket = findSuccesLevelBracketStrict(parsed.data.bracketId);
    if (!bracket) return { success: false, error: "Tranche de niveau inconnue." };

    const publicProfileId = account.profile.id;
    try {
        // 1. Cibles relues en base : le catalogue est l'autorité, pas le client.
        const dungeons = await db.dungeon.findMany({
            where: { level: { gte: bracket.min, lte: bracket.max } },
            select: { achievements: { select: { id: true } } },
            orderBy: [{ level: "asc" }, { name: "asc" }],
            take: SUCCES_DUNGEONS_TAKE,
        });
        const achievementIds = dungeons.flatMap((dungeon) =>
            dungeon.achievements.map((achievement) => achievement.id)
        );

        if (achievementIds.length === 0) {
            return { success: true, data: { count: 0, achievementIds: [] } };
        }

        if (parsed.data.action === "unvalidate") {
            await db.publicDungeonAchievement.deleteMany({
                where: { publicProfileId, dungeonAchievementId: { in: achievementIds } },
            });
            revalidatePath(PATHS.succes);
            return { success: true, data: { count: achievementIds.length, achievementIds } };
        }

        // 2. Écriture idempotente : la contrainte unique tranche, une coche existante reste acquise.
        await db.publicDungeonAchievement.createMany({
            data: achievementIds.map((achievementId) => ({ publicProfileId, dungeonAchievementId: achievementId })),
            skipDuplicates: true,
        });

        revalidatePath(PATHS.succes);
        return { success: true, data: { count: achievementIds.length, achievementIds } };
    } catch (error) {
        logger.error("[Espace visiteur] Tranche de succès non enregistrée", { error });
        return { success: false, error: "Impossible d'enregistrer cette tranche." };
    }
}

const dungeonGroupToggleSchema = z.object({
    dungeonId: z.string().min(1).max(64),
    action: z.enum(["validate", "unvalidate"]),
});

/**
 * Validation / dévalidation de **tous les succès d'un donjon** (V1i) — le geste
 * « Tout cocher / Tout décocher » de la fiche, parité avec l'interne
 * (`toggleDungeonAchievements`).
 *
 * Mêmes invariants que la tranche : garde du compte public, Zod borné, rate limit,
 * donjon relu en base (le client ne fournit aucun id de succès), écriture idempotente
 * sur le seul profil public du compte connecté.
 */
export async function togglePublicDungeonAchievementsGroup(raw: unknown): Promise<PublicAchievementsToggleResult> {
    const parsed = dungeonGroupToggleSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    const account = await getPublicAccount();
    if (!account) return { success: false, error: SESSION_EXPIRED };

    const limited = await limit("achievement-dungeon", account.userId, 20);
    if (limited) return limited;

    const publicProfileId = account.profile.id;
    try {
        const dungeon = await db.dungeon.findUnique({
            where: { id: parsed.data.dungeonId },
            select: { achievements: { select: { id: true } } },
        });
        if (!dungeon) return { success: false, error: "Ce donjon n'existe pas." };

        const achievementIds = dungeon.achievements.map((achievement) => achievement.id);
        if (achievementIds.length === 0) {
            return { success: true, data: { count: 0, achievementIds: [] } };
        }

        if (parsed.data.action === "unvalidate") {
            await db.publicDungeonAchievement.deleteMany({
                where: { publicProfileId, dungeonAchievementId: { in: achievementIds } },
            });
        } else {
            await db.publicDungeonAchievement.createMany({
                data: achievementIds.map((achievementId) => ({ publicProfileId, dungeonAchievementId: achievementId })),
                skipDuplicates: true,
            });
        }

        revalidatePath(PATHS.succes);
        return { success: true, data: { count: achievementIds.length, achievementIds } };
    } catch (error) {
        logger.error("[Espace visiteur] Succès du donjon non enregistrés", { error });
        return { success: false, error: "Impossible d'enregistrer ce donjon." };
    }
}

export type PublicProfileExport = {
    exportedAt: string;
    profile: {
        dofusServerId: number;
        pseudoDofus: string | null;
        classe: string | null;
        declaredGuildName: string | null;
        altPseudos: { pseudo: string; classe: string | null; level: number | null }[];
        introduction: string | null;
        objectifs: string | null;
        preferredActivities: string[];
        metamobPseudo: string | null;
        metamobVerified: boolean;
        showOnDirectory: boolean;
        showPresence: boolean;
    };
    professions: { id: string; level: number }[];
    dungeonAchievements: { dungeonAchievementId: string; completedAt: string }[];
};

type ExportResult =
    | { success: true; data: PublicProfileExport }
    | { success: false; error: string };

/**
 * Export RGPD : JSON lisible, **borné**, sans clé Metamob (elle n'est même pas sélectionnée).
 */
export async function exportPublicProfile(): Promise<ExportResult> {
    const account = await getPublicAccount();
    if (!account) return { success: false, error: SESSION_EXPIRED };

    const limited = await limit("export", account.userId, 3);
    if (limited) return { success: false, error: limited.error };

    const publicProfileId = account.profile.id;
    try {
        const [professions, achievements] = await Promise.all([
            db.publicProfession.findMany({
                where: { publicProfileId },
                select: { metierId: true, level: true },
                orderBy: { metierId: "asc" },
                take: 50,
            }),
            db.publicDungeonAchievement.findMany({
                where: { publicProfileId },
                select: { dungeonAchievementId: true, completedAt: true },
                orderBy: { completedAt: "desc" },
                take: 1000,
            }),
        ]);

        const profile = account.profile;
        return {
            success: true,
            data: {
                exportedAt: new Date().toISOString(),
                profile: {
                    dofusServerId: profile.dofusServerId,
                    pseudoDofus: profile.pseudoDofus,
                    classe: profile.classe,
                    declaredGuildName: profile.declaredGuildName,
                    altPseudos: profile.altPseudos.map((mule) => ({
                        pseudo: mule.pseudo,
                        classe: mule.classe,
                        level: mule.level,
                    })),
                    introduction: profile.introduction,
                    objectifs: profile.objectifs,
                    preferredActivities: profile.preferredActivities,
                    metamobPseudo: profile.metamobPseudo,
                    metamobVerified: profile.metamobVerified,
                    showOnDirectory: profile.showOnDirectory,
                    showPresence: profile.showPresence,
                },
                professions: professions.map((row) => ({ id: row.metierId, level: row.level })),
                dungeonAchievements: achievements.map((row) => ({
                    dungeonAchievementId: row.dungeonAchievementId,
                    completedAt: row.completedAt.toISOString(),
                })),
            },
        };
    } catch (error) {
        logger.error("[Espace visiteur] Export impossible", { error });
        return { success: false, error: "Impossible de générer ton export pour l'instant." };
    }
}

export type DeletePublicProfileResult =
    | { success: true; scope: "PUBLIC_ONLY" | "ACCOUNT" }
    | { success: false; error: string };

/**
 * **D-V10** — suppression depuis l'espace visiteur.
 *
 * Si le `User` porte aussi un `UserProfile` ACTIVE, on ne supprime que la **vie publique**
 * (jamais l'historique de guilde) et on le dit. Sinon, suppression **dure** du compte,
 * sans archivage (RGPD) : le client doit ensuite fermer la session.
 */
export async function deletePublicProfile(raw: unknown): Promise<DeletePublicProfileResult> {
    const parsed = deletePublicProfileSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    const account = await getPublicAccount();
    if (!account) return { success: false, error: SESSION_EXPIRED };

    // 2 suppressions par heure : une erreur de manipulation ne doit pas pouvoir boucler.
    const limited = await limit("delete", account.userId, 2, 60 * 60 * 1000);
    if (limited) return { success: false, error: limited.error };

    if (await isSuperAdmin()) {
        return {
            success: false,
            error: "Un compte d'exploitation ne peut pas être supprimé depuis cet espace.",
        };
    }

    try {
        const guildProfile = await db.userProfile.findFirst({
            where: { userId: account.userId, status: "ACTIVE" },
            select: { id: true },
        });

        if (guildProfile) {
            await db.publicProfile.deleteMany({ where: { userId: account.userId } });
            revalidatePath(PATHS.reglages);
            return { success: true, scope: "PUBLIC_ONLY" };
        }

        await db.user.delete({ where: { id: account.userId } });
        return { success: true, scope: "ACCOUNT" };
    } catch (error) {
        logger.error("[Espace visiteur] Suppression impossible", { error });
        return {
            success: false,
            error: "La suppression n'a pas abouti. Demande l'assistance du support.",
        };
    }
}





