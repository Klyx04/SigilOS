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
import { invalidateCache } from "@/lib/cache";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/ratelimit";
import { getPublicAccount, getPublicSession } from "@/server/public-account";
import { getMetamobMe, verifyMetamobUser, MetamobApiError, getSelfQuestDetails, getQuestTemplateMonsters, bulkUpdateMonsters } from "@/lib/metamob-client";
import { readVisitorMetamob, resolveVisitorOcreSlug } from "@/server/public-metamob";
import { internalDofusDbImageUrl } from "@/lib/dofus-image-url";
import { publicTradesMatchesCacheKey, publicTradesQuestCacheKey } from "@/lib/public-trades";
import { redis } from "@/lib/redis";
import { classifyOcreType } from "@/lib/ocre-soul-stones";
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

/**
 * F13/F15 (08/11/2026) — même refus pour un profil et pour une mule. Il ne dit que ce qu'on
 * sait : le ladder a répondu qu'il ne connaît pas ce pseudo sur ce serveur.
 */
const PSEUDO_NOT_ON_LADDER =
    "Ce pseudo n'apparaît pas au classement de ce serveur. Vérifie l'orthographe, la casse et le serveur choisi.";

/**
 * F14 (08/11/2026) — Metamob a refusé la clé (ou n'a pas répondu) : rien n'est écrit, donc la
 * clé précédente reste en place. C'est exactement ce qui manquait : une clé invalide
 * « disparaissait sans retour ».
 */
const METAMOB_KEY_REFUSED =
    "Metamob n'a pas reconnu cette clé : elle n'a pas été enregistrée. Ta clé précédente, si tu en avais une, est conservée.";

/**
 * Même modèle que l'interne (`linkOcreAccount`, `src/server/actions/ocre-actions.ts` l. 297) :
 * le **pseudo** est prouvé par Metamob avant écriture, et c'est la **casse renvoyée par l'API**
 * qui est stockée. Un profil Metamob public suffit — la clé ne sert qu'au profil privé.
 */
const METAMOB_PSEUDO_NOT_FOUND =
    "Ce pseudo Metamob n'existe pas : vérifie l'orthographe sur metamob.fr.";
const METAMOB_PSEUDO_PRIVATE =
    "Ce profil Metamob est privé : ajoute ta clé d'API pour prouver qu'il est bien à toi.";
const METAMOB_UNAVAILABLE = "Metamob n'a pas répondu : réessaie dans un instant.";

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

    /**
     * F13 (08/11/2026) — la vérification du pseudo est **bloquante avant** la création : un
     * profil ouvert avec un pseudo absent du classement n'a ni niveau, ni succès, ni guilde,
     * et l'annuaire le porte comme un trou.
     *
     * Seul `false` bloque. `checkPseudoExistsOnLadder` rend `null` quand le worker ladder est
     * injoignable, et sa règle est explicitement **fail-open** (`src/server/ladder-pseudo.ts`) :
     * bloquer là-dessus fermerait la création pendant toute panne du ladder. Le toggle God
     * « Fallback Pseudo Manuel » court-circuite l'appel, comme pour `verifyPublicPseudo`.
     */
    if (!(await isLadderManualFallbackEnabled())) {
        const found = await checkPseudoExistsOnLadder(
            parsed.data.pseudoDofus,
            String(parsed.data.dofusServerId)
        );
        if (found === false) return { success: false, error: PSEUDO_NOT_ON_LADDER };
    }

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
     * F13 (08/11/2026, suite) — **l'édition** vérifie aussi, et c'était le trou : la création
     * bloquait, pas le formulaire « Identité ». Changer son pseudo pour un nom absent du
     * classement vidait silencieusement niveau, XP et points de succès (le snapshot ladder ne
     * trouve rien et n'écrit que ce qu'il trouve).
     *
     * On ne vérifie que si le **pseudo ou le serveur** change : enregistrer sa classe ou son
     * nom de guilde ne doit pas dépendre de la disponibilité du worker. Même règle qu'à la
     * création — seul `false` bloque, `null` reste fail-open, toggle God honoré.
     */
    const pseudoChanged =
        parsed.data.pseudoDofus.toLowerCase() !== (account.profile.pseudoDofus ?? "").toLowerCase();
    const serverChanged = parsed.data.dofusServerId !== account.profile.dofusServerId;
    if ((pseudoChanged || serverChanged) && !(await isLadderManualFallbackEnabled())) {
        const found = await checkPseudoExistsOnLadder(
            parsed.data.pseudoDofus,
            String(parsed.data.dofusServerId)
        );
        if (found === false) return { success: false, error: PSEUDO_NOT_ON_LADDER };
    }

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
 * Metamob : pseudo **et** clé sont prouvés avant écriture.
 *
 * · une nouvelle clé passe par `/v1/me` (fail-closed) et le pseudo qu'il renvoie fait foi ;
 * · un pseudo seul est prouvé par une lecture **publique** de Metamob — même mécanique que
 *   `linkOcreAccount` côté guilde —, la clé déjà stockée servant de repli pour un profil privé.
 *
 * La clé n'est **jamais relue** vers l'écran : seul `hasMetamobApiKey` sort du serveur.
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

        /**
         * F14 (08/11/2026) — `/v1/me` **avant** l'écriture.
         *
         * Avant, la clé était écrite telle quelle et la vérification retombait à `false` :
         * une clé invalide **remplaçait** une clé qui marchait, sans que rien ne le dise.
         * Maintenant la clé n'est écrite que si Metamob la reconnaît, et le pseudo qu'il
         * renvoie fait foi (même règle que `verifyPublicMetamob`).
         *
         * Fail-closed : Metamob injoignable ⇒ refus. Une clé non prouvée ne remplace pas une
         * clé qui fonctionnait.
         */
        if (key.length === 0) {
            data.metamobApiKey = null;
            data.metamobVerified = false;
        } else {
            const me = await getMetamobMe(key).catch((error: unknown) => {
                logger.warn("[Espace visiteur] Clé Metamob refusée à l'enregistrement", {
                    err: error instanceof Error ? error.message : String(error),
                });
                return null;
            });
            if (!me) return { success: false, error: METAMOB_KEY_REFUSED };

            data.metamobApiKey = key;
            data.metamobVerified = true;
            const pseudo = me.username.trim();
            if (pseudo.length > 0) data.metamobPseudo = pseudo;
        }
    } else {
        /**
         * Pas de nouvelle clé : `/v1/me` est donc hors de portée. On prouve le **pseudo** comme
         * l'interne — lecture publique sur Metamob, avec la clé déjà enregistrée en repli si le
         * profil est privé. Un pseudo non prouvé n'est plus enregistré : c'est le trou de la
         * capture du 08/11 (`Wylaen` → `Wylansqcsqcs` accepté sans aucun contrôle).
         */
        const wanted = emptyToNull(parsed.data.metamobPseudo);
        if (wanted) {
            const row = await db.publicProfile.findUnique({
                where: { userId: account.userId },
                select: { metamobApiKey: true },
            });
            const storedKey = row?.metamobApiKey?.trim() || undefined;
            try {
                const proven = await verifyMetamobUser(wanted, { guildApiKey: storedKey });
                if (!proven) return { success: false, error: METAMOB_UNAVAILABLE };
                // Casse de l'API, jamais celle tapée (même règle que `linkOcreAccount`).
                data.metamobPseudo = proven.pseudo;
                data.metamobVerified = true;
            } catch (error) {
                if (error instanceof MetamobApiError) {
                    if (error.code === "NOT_FOUND") {
                        return { success: false, error: METAMOB_PSEUDO_NOT_FOUND };
                    }
                    if (error.code === "UNAUTHORIZED") {
                        return { success: false, error: METAMOB_PSEUDO_PRIVATE };
                    }
                }
                logger.warn("[Espace visiteur] Pseudo Metamob non prouvé", {
                    err: error instanceof Error ? error.message : String(error),
                });
                return { success: false, error: METAMOB_UNAVAILABLE };
            }
        }
    }

    try {
        await db.publicProfile.update({ where: { userId: account.userId }, data });
        revalidatePath(PATHS.general);
        // La vue « Échanges » met en cache la quête et les matches **par lecteur** : une clé
        // ou un pseudo qui change doit repartir de zéro (l'ancien compte resterait sinon
        // visible jusqu'à 10 min). `invalidateCache` avale ses propres erreurs Redis.
        await Promise.all([
            invalidateCache(publicTradesMatchesCacheKey(account.userId)),
            invalidateCache(publicTradesQuestCacheKey(account.userId)),
        ]);
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

    /**
     * F15 (08/11/2026) — vérification **bloquante** des mules **nouvelles**.
     *
     * On ne revérifie pas celles déjà déclarées : le ladder ne sert ici qu'à empêcher
     * d'**ajouter** un pseudo qui n'existe pas. Même règle que F13 — seul `false` bloque,
     * `null` (worker injoignable) laisse passer, et le toggle God « Fallback Pseudo Manuel »
     * court-circuite l'appel.
     *
     * Le serveur est celui du profil, lu côté serveur : il n'est jamais fourni par le client.
     */
    if (!(await isLadderManualFallbackEnabled())) {
        const known = new Set(account.profile.altPseudos.map((mule) => mule.pseudo.toLowerCase()));
        const fresh = parsed.data.filter((mule) => !known.has(mule.pseudo.toLowerCase()));
        const serverId = String(account.profile.dofusServerId);
        const checks = await Promise.all(
            fresh.map((mule) => checkPseudoExistsOnLadder(mule.pseudo, serverId))
        );
        const rejected = fresh.find((_mule, index) => checks[index] === false);
        if (rejected) {
            return {
                success: false,
                error: `« ${rejected.pseudo} » n'apparaît pas au classement de ce serveur. Vérifie l'orthographe, la casse et le serveur choisi.`,
            };
        }
    }

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
                showRushProgress: parsed.data.showRushProgress,
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
        showRushProgress: boolean;
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
                    showRushProgress: profile.showRushProgress,
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

/* ───────────────────────────────────────────────────────────────────────────────
 * Quête Ocre du visiteur — LECTURE et PATCH temps réel (demande du 08/11/2026).
 *
 * « l'objectif de pouvoir lier son Metamob en mode public connecté, c'est surtout pour suivre
 * sa quête directement dans le rush ». Aucune action de `ocre-actions.ts` n'est réutilisable :
 * elle est scopée `guildId`, et le visiteur n'en a pas.
 *
 * Le chemin d'ÉCRITURE existe déjà dans le client (`bulkUpdateMonsters` →
 * `PATCH /v1/quests/{slug}/monsters`, patch scopé au `monster_id`) : on s'appuie dessus, on ne
 * recopie aucun `fetch`.
 * ─────────────────────────────────────────────────────────────────────────────── */

/**
 * Borne de lecture de la quête (400 monstres). **Constante privée** : un fichier `"use server"`
 * n'autorise que des exports de fonctions async — un `export const` casse le build Next
 * (« Only async functions are allowed to be exported in a "use server" file »).
 *
 * 400 et non 200 : la quête Ocre d'un personnage compte **337** cibles (mesure du 08/11) — la
 * borne précédente tronquait la liste alors que le guide interne, lui, l'affiche entière.
 */
const PUBLIC_OCRE_MONSTERS_MAX = 400;

export type PublicOcreMonster = {
    id: number;
    name: string;
    owned: number;
    quantity: number;
    levelMin: number;
    levelMax: number;
    step: number;
    /**
     * Nature de la cible, lue sur le **template Metamob** (même source que le guide interne).
     * Faute de type connu, on retombe sur « archimonstre » (l'immense majorité d'une quête Ocre).
     */
    type: "boss" | "archimonstre";
    /** Zone et sous-zone (`/v1/quests/{slug}/zones`), comme la ligne du guide interne. */
    zone?: string;
    subzone?: string;
    /**
     * Image **interne** (proxy) dérivée d'une URL DofusDB de la source — même règle que le guide
     * interne (`internalDofusDbImageUrl`). Absente quand la source n'en fournit pas d'exploitable :
     * le panneau retombe alors sur nos fichiers locaux, puis sur le picto.
     */
    imageUrl?: string;
};

export type PublicOcreProgress =
    | {
          success: true;
          questSlug: string;
          characterName: string | null;
          serverName: string | null;
          gameVersion: string | null;
          currentStep: number;
          stepCount: number | null;
          total: number;
          captured: number;
          progress: number;
          bosses: { gathered: number; total: number };
          archis: { gathered: number; total: number };
          monsters: PublicOcreMonster[];
      }
    | { success: false; error: string };

/** Champs lus sur une réponse Metamob — type **structurel** : l'API reste une source externe. */
type MetamobQuestMonsterLike = {
    id?: number | null;
    monster_id?: number | null;
    name?: { fr?: string | null } | string | null;
    owned?: number | null;
    amount?: number | null;
    quantity?: number | null;
    level_min?: number | null;
    level_max?: number | null;
    step?: number | null;
    /** Tantôt une chaîne, tantôt un objet localisé selon l'endpoint Metamob. */
    type?: string | { name?: { fr?: string | null } | null } | null;
    /** Id DofusDB et URL d'image amont : présents sur l'endpoint de quête (même réponse que l'interne). */
    dofusdbId?: number | null;
    imageUrl?: string | null;
    image?: string | null;
};

/** DTO borné : jamais la réponse brute de Metamob ne part vers le client. */
/** Libellé d'un `type` Metamob, qui arrive tantôt en chaîne, tantôt en objet localisé. */
function metamobTypeLabel(value: MetamobQuestMonsterLike["type"]): string {
    if (!value) return "";
    if (typeof value === "string") return value;
    return value.name?.fr ?? "";
}

/**
 * Zones des archimonstres — **même endpoint et même clé de cache** que le guide interne
 * (`ocre-actions.ts`), pour que les deux surfaces affichent la même ligne `zone · subzone`.
 *
 * Best-effort assumé : un échec laisse la ligne vide, il ne prive pas le visiteur de sa quête.
 */
async function loadPublicOcreZones(
    slug: string,
    apiKey: string
): Promise<Map<string, { zone?: string; subzone?: string }>> {
    const out = new Map<string, { zone?: string; subzone?: string }>();
    const cacheKey = `metamob:archi-zones:${slug}`;
    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached) as Record<string, { zone?: string; subzone?: string }>;
            for (const [name, value] of Object.entries(parsed)) out.set(name, value);
            return out;
        }

        const res = await fetch(
            `https://www.metamob.fr/api/v1/quests/${encodeURIComponent(slug)}/zones?monster_type_id=3`,
            {
                headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}` },
                signal: AbortSignal.timeout(8000),
            }
        );
        if (!res.ok) return out;

        const json = (await res.json()) as {
            data?: Array<{
                name?: { fr?: string };
                subzones?: Array<{ name?: { fr?: string }; monsters?: Array<{ name?: { fr?: string } }> }>;
            }>;
        };
        const store: Record<string, { zone?: string; subzone?: string }> = {};
        for (const zone of json.data ?? []) {
            for (const sub of zone.subzones ?? []) {
                for (const monster of sub.monsters ?? []) {
                    const label = monster.name?.fr?.toLowerCase().trim();
                    if (!label || store[label]) continue;
                    store[label] = { zone: zone.name?.fr, subzone: sub.name?.fr };
                    out.set(label, store[label]);
                }
            }
        }
        if (Object.keys(store).length > 0) {
            await redis.set(cacheKey, JSON.stringify(store), "EX", 7200).catch(() => {});
        }
    } catch {
        /* best-effort */
    }
    return out;
}

function toPublicOcreMonster(
    monster: MetamobQuestMonsterLike,
    meta?: ReadonlyMap<string, { type: "boss" | "archimonstre"; zone?: string; subzone?: string }>
): PublicOcreMonster | null {
    const id = Number(monster.monster_id ?? monster.id ?? 0);
    if (!Number.isFinite(id) || id <= 0) return null;
    const label = typeof monster.name === "string" ? monster.name : monster.name?.fr ?? "";
    const known = meta?.get(label.toLowerCase().trim());
    const isBoss = metamobTypeLabel(monster.type).toLowerCase().includes("gardien");
    // Même règle que le guide interne : une URL DofusDB passe par le proxy (espace apparence).
    // Une URL d'un autre hôte ne devient JAMAIS une image du DOM.
    const image = internalDofusDbImageUrl(monster.imageUrl ?? monster.image);
    return {
        id,
        name: label.slice(0, 120),
        owned: Number(monster.owned ?? 0),
        quantity: Number(monster.quantity ?? monster.amount ?? 1),
        levelMin: Number(monster.level_min ?? 0),
        levelMax: Number(monster.level_max ?? 0),
        step: Number(monster.step ?? 0),
        type: known?.type ?? (isBoss ? "boss" : "archimonstre"),
        ...(known?.zone ? { zone: known.zone } : {}),
        ...(known?.subzone ? { subzone: known.subzone } : {}),
        ...(image ? { imageUrl: image } : {}),
    };
}

/** Progression Ocre du visiteur — lecture seule, bornée, sans clé dans la réponse. */
export async function getPublicOcreProgress(): Promise<PublicOcreProgress> {
    const account = await getPublicAccount();
    if (!account) return { success: false, error: SESSION_EXPIRED };

    const limited = await limit("ocre-read", account.userId, 10);
    if (limited) return { success: false, error: limited.error };

    const { key, pseudo } = await readVisitorMetamob(account.userId);
    if (!key) return { success: false, error: "Enregistre ta clé d'API Metamob pour suivre ta quête." };
    const name = pseudo ?? account.profile.pseudoDofus;
    if (!name) return { success: false, error: "Renseigne ton pseudo Metamob." };

    try {
        const slug = await resolveVisitorOcreSlug(name, key);
        if (!slug) return { success: false, error: "Aucune quête trouvée sur ce compte Metamob." };

        const details = await getSelfQuestDetails(name, slug, key, { limit: PUBLIC_OCRE_MONSTERS_MAX });

        /**
         * **ISO avec le guide interne** : la nature des cibles vient du template Metamob et les
         * zones de `/v1/quests/{slug}/zones` — exactement les deux sources qu'utilise
         * `getMyOcreProgress` pour les membres. Best-effort intégral : sans elles, la liste reste
         * utilisable (une seule liste, pas d'onglets faux).
         */
        const meta = new Map<string, { type: "boss" | "archimonstre"; zone?: string; subzone?: string }>();
        const templateId = details.quest_template?.id;
        if (templateId) {
            try {
                const template = await getQuestTemplateMonsters(templateId, {
                    guildApiKey: key,
                    limit: PUBLIC_OCRE_MONSTERS_MAX,
                });
                for (const entry of template) {
                    const label = entry.name?.fr?.toLowerCase().trim();
                    if (!label) continue;
                    meta.set(label, { type: classifyOcreType(entry.type?.name?.fr) });
                }
            } catch (error) {
                logger.warn("[Espace visiteur] Template Ocre illisible", {
                    err: error instanceof Error ? error.message : String(error),
                });
            }
        }
        const zones = await loadPublicOcreZones(details.slug ?? slug, key);
        for (const [label, value] of zones) {
            meta.set(label, { type: meta.get(label)?.type ?? "archimonstre", ...value });
        }

        const monsters = (details.monsters as unknown as MetamobQuestMonsterLike[])
            .map((monster) => toPublicOcreMonster(monster, meta))
            .filter((monster): monster is PublicOcreMonster => monster !== null)
            .slice(0, PUBLIC_OCRE_MONSTERS_MAX);

        const total = details.pagination?.total ?? monsters.length;
        const captured = monsters.filter((monster) => monster.owned > 0).length;
        const bosses = monsters.filter((monster) => monster.type === "boss");
        const archis = monsters.filter((monster) => monster.type === "archimonstre");

        return {
            success: true,
            questSlug: details.slug ?? slug,
            characterName: details.character_name ?? null,
            serverName: details.server?.name ?? null,
            gameVersion: details.server?.game_version?.name ?? null,
            currentStep: details.current_step ?? 0,
            stepCount: details.quest_template?.step_count ?? null,
            total,
            captured,
            progress: total > 0 ? Math.round((captured / total) * 100) : 0,
            bosses: {
                gathered: bosses.filter((monster) => monster.owned > 0).length,
                total: bosses.length,
            },
            archis: {
                gathered: archis.filter((monster) => monster.owned > 0).length,
                total: archis.length,
            },
            monsters,
        };
    } catch (error) {
        logger.warn("[Espace visiteur] Progression Ocre illisible", {
            err: error instanceof Error ? error.message : String(error),
        });
        return {
            success: false,
            error:
                error instanceof MetamobApiError && error.code === "UNAUTHORIZED"
                    ? "Metamob refuse ta clé : vérifie-la dans ton espace visiteur."
                    : "Impossible de lire ta quête Metamob pour l'instant.",
        };
    }
}

const publicOcrePatchSchema = z.object({
    monsterId: z.number().int().positive(),
    quantity: z.number().int().min(0).max(30),
});

export type PublicOcrePatchResult =
    | { success: true; monster: PublicOcreMonster | null }
    | { success: false; error: string };

/**
 * **Patch temps réel** d'un monstre de la quête Ocre, puis **double cross-check**.
 *
 * L'écriture passe par `bulkUpdateMonsters` (patch scopé au `monster_id`, jamais un patch
 * global — c'est la leçon de #180). Et on ne croit pas notre propre optimisme : la quête est
 * **relue** juste après, et c'est la valeur renvoyée par Metamob qui est rendue au client.
 */
export async function patchPublicOcreMonster(raw: unknown): Promise<PublicOcrePatchResult> {
    const parsed = publicOcrePatchSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    const account = await getPublicAccount();
    if (!account) return { success: false, error: SESSION_EXPIRED };

    const limited = await limit("ocre-patch", account.userId, 60);
    if (limited) return { success: false, error: limited.error };

    const { key, pseudo } = await readVisitorMetamob(account.userId);
    if (!key) return { success: false, error: "Aucune clé Metamob enregistrée." };
    const name = pseudo ?? account.profile.pseudoDofus;
    if (!name) return { success: false, error: "Renseigne ton pseudo Metamob." };

    try {
        const slug = await resolveVisitorOcreSlug(name, key);
        if (!slug) return { success: false, error: "Quête Metamob introuvable." };

        await bulkUpdateMonsters(
            slug,
            [{ monster_id: parsed.data.monsterId, quantity: parsed.data.quantity }],
            { guildApiKey: key }
        );

        // Double cross-check : relecture, et c'est l'API qui fait foi.
        const details = await getSelfQuestDetails(name, slug, key, { limit: PUBLIC_OCRE_MONSTERS_MAX });
        const updated =
            (details.monsters as unknown as MetamobQuestMonsterLike[])
                .map((monster) => toPublicOcreMonster(monster))
                .find((monster) => monster?.id === parsed.data.monsterId) ?? null;

        revalidatePath(PATHS.general);
        return { success: true, monster: updated };
    } catch (error) {
        logger.warn("[Espace visiteur] Patch Ocre refusé", {
            err: error instanceof Error ? error.message : String(error),
        });
        return {
            success: false,
            error: "Metamob n'a pas accepté la modification. Réessaie dans un instant.",
        };
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





