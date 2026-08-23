"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { GOD_SCOPES } from "@/lib/god-scopes";
import { isSuperAdmin, requireGodAccess } from "./super-admin-actions";
import { createGodAuditLog } from "./audit-actions";
import { publishGodRevoked, publishGodAccessChanged } from "@/lib/socket-r4";

// ============================================================================
// CHANTIER A — Gestion des sub-gods (GodDelegate)
// Sécurité fail-closed : CHAQUE action vérifie requireGodAccess("users") ET
// est doublée par isSuperAdmin(). Chaque grant/revoke est audité.
// ============================================================================

// 🔄 Un délégué peut être créé "vierge" (sans scope) : les accès réels se gèrent
// via les grants de briques (PIM) dans le BrickGrantsManager (stepper 3 étapes).
const ScopesSchema = z.array(z.enum(GOD_SCOPES)).min(0);

const GrantDelegateSchema = z.object({
    userId: z.string().optional(),
    // 🔄 Bound & format (RULES.md) : ID Discord = 17-20 chiffres
    discordId: z.string().regex(/^\d{17,20}$/, "ID Discord invalide (17-20 chiffres)").optional(),
    scopes: ScopesSchema,
    expiresAt: z.coerce.date().optional().nullable(),
    guildId: z.string().optional().nullable(),
}).refine((d) => d.userId || d.discordId, {
    message: "Il faut fournir userId OU discordId",
    path: ["discordId"],
});

type DelegateReturn = {
    id: string;
    userId: string;
    userName: string | null;
    discordId: string | null;
    scopes: string[];
    grantedBy: string;
    grantedAt: Date;
    expiresAt: Date | null;
    revokedAt: Date | null;
    guildId: string | null;
};

/** Récupère un userId à partir d'un discordId (via le compte Discord lié). */
async function resolveUserIdByDiscordId(discordId: string): Promise<string | null> {
    const account = await db.account.findFirst({
        where: { provider: "discord", providerAccountId: discordId },
        select: { userId: true },
    });
    return account?.userId ?? null;
}

/** Récupère le discordId de l'acteur connecté (pour l'audit + grantedBy). */
async function getActorDiscordId(): Promise<string | null> {
    const session = await auth();
    if (!session?.user?.id) return null;
    const account = await db.account.findFirst({
        where: { userId: session.user.id, provider: "discord" },
        select: { providerAccountId: true },
    });
    return account?.providerAccountId ?? null;
}

/** Helper pour normaliser le retour d'un délégué. */
function mapDelegate(d: any): DelegateReturn {
    const discordId = (d.user?.accounts as Array<{ provider: string; providerAccountId: string }> | undefined)
        ?.find((a) => a.provider === "discord")?.providerAccountId ?? null;
    return {
        id: d.id,
        userId: d.userId,
        userName: d.user?.name ?? null,
        discordId,
        scopes: d.scopes,
        grantedBy: d.grantedBy,
        grantedAt: d.grantedAt,
        expiresAt: d.expiresAt,
        revokedAt: d.revokedAt,
        guildId: d.guildId,
    };
}

/**
 * Liste tous les délégués (actifs + expirés + révoqués).
 * Réservé : scope "users" (ou super-admin).
 */
export async function listDelegates(): Promise<{ success: boolean; data?: DelegateReturn[]; error?: string }> {
    try {
        await requireGodAccess("users");
        const isAdmin = await isSuperAdmin();
        if (!isAdmin) {
            throw new Error("Unauthorized: Super-admin access required");
        }

        const delegates = await db.godDelegate.findMany({
            orderBy: [{ revokedAt: "asc" }, { grantedAt: "desc" }],
        });

        // GodDelegate n'a pas de relation Prisma vers User → enrichir manuellement.
        const userIds = delegates.map(d => d.userId);
        const users = userIds.length > 0
            ? await db.user.findMany({
                where: { id: { in: userIds } },
                include: { accounts: { select: { provider: true, providerAccountId: true } } },
            })
            : [];
        const userMap = new Map(users.map(u => [u.id, u]));

        const enriched = delegates.map(d => mapDelegate({ ...d, user: userMap.get(d.userId) ?? null }));
        return { success: true, data: enriched };
    } catch (e: any) {
        logger.error("[listDelegates] Error:", { error: e });
        return { success: false, error: e.message || "Erreur inconnue" };
    }
}

/**
 * Octroie un délégué (grant). Audit systématique.
 * Réservé : scope "users" (ou super-admin).
 */
export async function grantDelegate(input: z.infer<typeof GrantDelegateSchema>): Promise<{ success: boolean; data?: DelegateReturn; error?: string }> {
    try {
        await requireGodAccess("users");
        const isAdmin = await isSuperAdmin();
        if (!isAdmin) {
            throw new Error("Unauthorized: Super-admin access required");
        }

        const parsed = GrantDelegateSchema.parse(input);
        const actorSession = await auth();
        if (!actorSession?.user?.id) throw new Error("Non authentifié");
        const actorDiscordId = await getActorDiscordId();

        // Résolution de la cible (userId prioritaire, sinon discordId)
        const targetUserId = parsed.userId
            ?? (parsed.discordId ? await resolveUserIdByDiscordId(parsed.discordId) : undefined);

        if (!targetUserId) {
            return { success: false, error: parsed.discordId ? "Aucun utilisateur trouvé pour ce Discord ID" : "Cible introuvable" };
        }

        // Vérifier que la cible existe
        const targetUser = await db.user.findUnique({
            where: { id: targetUserId },
            include: { accounts: { select: { provider: true, providerAccountId: true } } },
        });
        if (!targetUser) {
            return { success: false, error: "Utilisateur cible introuvable" };
        }

        // Empêcher de se retirer ses propres droits (drapeau rouge sécurité)
        if (targetUserId === actorSession.user.id) {
            return { success: false, error: "Impossible de s'accorder des scopes à soi-même" };
        }

        // Anti-doublon : un délégué ACTIF (non révoqué) existe déjà pour cette cible.
        const existingDelegate = await db.godDelegate.findFirst({
            where: { userId: targetUserId, revokedAt: null },
        });
        if (existingDelegate) {
            return { success: false, error: "Cet utilisateur est déjà un délégué actif. Modifiez son accès existant au lieu de le recréer." };
        }

        const delegate = await db.godDelegate.create({
            data: {
                userId: targetUserId,
                guildId: parsed.guildId ?? null,
                scopes: parsed.scopes,
                grantedBy: actorDiscordId || actorSession.user.id,
                expiresAt: parsed.expiresAt ?? null,
            },
        });

        await createGodAuditLog({
            action: "GOD_CONFIG_OVERRIDE",
            targetType: "SYSTEM_GOD",
            targetId: delegate.id,
            newValue: { operation: "GRANT_DELEGATE", userId: targetUserId, scopes: parsed.scopes, expiresAt: parsed.expiresAt },
            metadata: { performedBy: actorDiscordId || actorSession.user.id },
        });

        revalidatePath("/god/delegates");
        return { success: true, data: mapDelegate({ ...delegate, user: targetUser }) };
    } catch (e: any) {
        logger.error("[grantDelegate] Error:", { error: e });
        return { success: false, error: e.message || "Erreur inconnue" };
    }
}

/**
 * Révoque un délégué. Audit systématique. Idempotent (refuse double révocation).
 * Réservé : scope "users" (ou super-admin).
 */
export async function revokeDelegate(delegateId: string): Promise<{ success: boolean; error?: string }> {
    try {
        await requireGodAccess("users");
        const isAdmin = await isSuperAdmin();
        if (!isAdmin) {
            throw new Error("Unauthorized: Super-admin access required");
        }

        const actorSession = await auth();
        const actorDiscordId = await getActorDiscordId();

        const delegate = await db.godDelegate.findUnique({ where: { id: delegateId } });
        if (!delegate) {
            return { success: false, error: "Délégué introuvable" };
        }

        if (delegate.revokedAt) {
            return { success: false, error: "Ce délégué est déjà révoqué" };
        }

        // R4 : révocation immédiate — bump scopeVersion pour invalider les sessions en cours
        await db.godDelegate.update({
            where: { id: delegateId },
            data: { revokedAt: new Date(), scopeVersion: { increment: 1 } },
        });

        // R4/D4 : journal des accès God (révocation, best-effort ne bloque pas)
        await db.godAccessLog.create({
            data: {
                userId: delegate.userId,
                action: "REVOKE",
                targetId: delegateId,
                metadata: { operation: "REVOKE_DELEGATE", performedBy: actorDiscordId || actorSession?.user?.id || "unknown" },
            },
        }).catch((logErr: unknown) => {
            logger.warn("[revokeDelegate] GodAccessLog REVOKE failed", { error: logErr });
        });

        await createGodAuditLog({
            action: "GOD_CONFIG_OVERRIDE",
            targetType: "SYSTEM_GOD",
            targetId: delegateId,
            newValue: { operation: "REVOKE_DELEGATE", userId: delegate.userId },
            metadata: { performedBy: actorDiscordId || actorSession?.user?.id || "unknown" },
        });

        // R4 — Révocation LIVE : prévient le sous-god connecté (popup + redirect).
        // Fail-closed : si le publish échoue, le polling GodExpiryGuard reste la sécurité.
        await publishGodRevoked({
            userId: delegate.userId,
            reason: "DELEGATE_REVOKED",
            delegateId,
            timestamp: new Date().toISOString(),
        });

        revalidatePath("/god/delegates");
        return { success: true };
    } catch (e: any) {
        logger.error("[revokeDelegate] Error:", { error: e });
        return { success: false, error: e.message || "Erreur inconnue" };
    }
}

/**
 * Met à jour les scopes d'un délégué. Audit systématique.
 * Réservé : scope "users" (ou super-admin).
 */
export async function updateDelegateScopes(delegateId: string, scopes: string[]): Promise<{ success: boolean; error?: string }> {
    try {
        await requireGodAccess("users");
        const isAdmin = await isSuperAdmin();
        if (!isAdmin) {
            throw new Error("Unauthorized: Super-admin access required");
        }

        const parsed = ScopesSchema.safeParse(scopes);
        if (!parsed.success) {
            return { success: false, error: "Scopes invalides : au moins un scope reconnu requis" };
        }

        const actorSession = await auth();
        const actorDiscordId = await getActorDiscordId();

        const delegate = await db.godDelegate.findUnique({ where: { id: delegateId } });
        if (!delegate) {
            return { success: false, error: "Délégué introuvable" };
        }

        await db.godDelegate.update({
            where: { id: delegateId },
            data: { scopes: parsed.data },
        });

        await createGodAuditLog({
            action: "GOD_CONFIG_OVERRIDE",
            targetType: "SYSTEM_GOD",
            targetId: delegateId,
            oldValue: { operation: "UPDATE_DELEGATE_SCOPES", scopes: delegate.scopes },
            newValue: { operation: "UPDATE_DELEGATE_SCOPES", scopes: parsed.data },
            metadata: { performedBy: actorDiscordId || actorSession?.user?.id || "unknown" },
        });

        revalidatePath("/god/delegates");
        return { success: true };
    } catch (e: any) {
        logger.error("[updateDelegateScopes] Error:", { error: e });
        return { success: false, error: e.message || "Erreur inconnue" };
    }
}

// ============================================================================
// D3 — PIM granulaire par BRIQUE (accès JIT, durée, justification, audit)
// ============================================================================

const GrantBrickSchema = z.object({
    delegateId: z.string().min(1),
    brickId: z.string().min(1),
    guildId: z.string().optional().nullable(),
    // Durée en minutes (min 5, max 90 jours)
    durationMinutes: z.number().int().min(5).max(90 * 24 * 60),
    // Justification OPTIONNELLE (auditée si renseignée)
    reason: z.string().max(500).optional().default(""),
});

/**
 * Accorde un grant granulaire sur UNE brique précise à un délégué, avec durée
 * (JIT) + justification obligatoire. D3 : chaque grant est audité (AuditLog)
 * ET journalisé (GodAccessLog). Durée réglable en minutes (min 5, max 90j).
 */
export async function grantBrickAccess(input: z.infer<typeof GrantBrickSchema>): Promise<{ success: boolean; error?: string }> {
    try {
        await requireGodAccess("users");
        const isAdmin = await isSuperAdmin();
        if (!isAdmin) throw new Error("Unauthorized: Super-admin access required");

        const parsed = GrantBrickSchema.parse(input);
        const actorSession = await auth();
        const actorDiscordId = await getActorDiscordId();

        // Vérifier que le délégué existe
        const delegate = await db.godDelegate.findUnique({ where: { id: parsed.delegateId } });
        if (!delegate) return { success: false, error: "Délégué introuvable" };
        if (delegate.revokedAt) return { success: false, error: "Ce délégué est révoqué" };

        const expiresAt = new Date(Date.now() + parsed.durationMinutes * 60_000);

        const grant = await db.godAccessGrant.create({
            data: {
                delegateId: delegate.id,
                userId: delegate.userId,
                brickId: parsed.brickId,
                guildId: parsed.guildId ?? null,
                startAt: new Date(),
                expiresAt,
                grantedBy: actorDiscordId || actorSession?.user?.id || "unknown",
                reason: parsed.reason,
            },
        });

        // #109 — détail : libellé lisible de la brique + nom du délégué cible.
        const { getGodBrick } = await import("@/lib/god-bricks");
        const brickLabel = getGodBrick(parsed.brickId)?.label ?? parsed.brickId;
        let delegateName: string | null = null;
        try {
            const u = await db.user.findUnique({ where: { id: delegate.userId }, select: { name: true } });
            delegateName = u?.name ?? null;
        } catch { /* best-effort */ }

        // Audit + journal
        await createGodAuditLog({
            action: "GOD_CONFIG_OVERRIDE",
            targetType: "SYSTEM_GOD",
            targetId: grant.id,
            newValue: { operation: "GRANT_BRICK", delegateId: delegate.id, delegateName, brickId: parsed.brickId, brickLabel, guildId: parsed.guildId ?? null, expiresAt: expiresAt.toISOString(), durationMinutes: parsed.durationMinutes },
            metadata: { performedBy: actorDiscordId || actorSession?.user?.id || "unknown", brickLabel },
        });
        await db.godAccessLog.create({
            data: { userId: delegate.userId, action: "GRANT", targetId: grant.id, metadata: { brickId: parsed.brickId, expiresAt: expiresAt.toISOString(), reason: parsed.reason } },
        }).catch(() => {});

        // R4 — Accès accordé → le sous-god rafraîchit son UI en LIVE (nouvelle brique visible).
        await publishGodAccessChanged({
            userId: delegate.userId,
            delegateId: delegate.id,
            timestamp: new Date().toISOString(),
        });

        revalidatePath("/god/delegates");
        return { success: true };
    } catch (e: any) {
        logger.error("[grantBrickAccess] Error:", { error: e });
        return { success: false, error: e.message || "Erreur inconnue" };
    }
}

/**
 * Révoque immédiatement un grant brique. D3 : bump scopeVersion + audit + journal.
 */
export async function revokeBrickAccess(grantId: string): Promise<{ success: boolean; error?: string }> {
    try {
        await requireGodAccess("users");
        const isAdmin = await isSuperAdmin();
        if (!isAdmin) throw new Error("Unauthorized: Super-admin access required");

        const actorSession = await auth();
        const actorDiscordId = await getActorDiscordId();

        const grant = await db.godAccessGrant.findUnique({ where: { id: grantId } });
        if (!grant) return { success: false, error: "Grant introuvable" };
        if (grant.revokedAt) return { success: false, error: "Grant déjà révoqué" };

        await db.godAccessGrant.update({
            where: { id: grantId },
            data: { revokedAt: new Date() },
        });
        // Invalide immédiatement les sessions liées à ce délégué
        await db.godDelegate.update({
            where: { id: grant.delegateId },
            data: { scopeVersion: { increment: 1 } },
        });

        // #109 — détail : libellé lisible de la brique.
        const { getGodBrick } = await import("@/lib/god-bricks");
        const brickLabel = getGodBrick(grant.brickId)?.label ?? grant.brickId;

        await createGodAuditLog({
            action: "GOD_CONFIG_OVERRIDE",
            targetType: "SYSTEM_GOD",
            targetId: grantId,
            newValue: { operation: "REVOKE_BRICK", delegateId: grant.delegateId, brickId: grant.brickId, brickLabel },
            metadata: { performedBy: actorDiscordId || actorSession?.user?.id || "unknown", brickLabel },
        });
        await db.godAccessLog.create({
            data: { userId: grant.userId, action: "REVOKE", targetId: grantId, metadata: { brickId: grant.brickId } },
        }).catch(() => {});

        // R4 — Accès modifié : le sous-god rafraîchit son UI en LIVE (perd la brique, SANS logout).
        await publishGodAccessChanged({
            userId: grant.userId,
            delegateId: grant.delegateId,
            timestamp: new Date().toISOString(),
        });

        revalidatePath("/god/delegates");
        return { success: true };
    } catch (e: any) {
        logger.error("[revokeBrickAccess] Error:", { error: e });
        return { success: false, error: e.message || "Erreur inconnue" };
    }
}

/**
 * Liste les grants (actifs / expirés / révoqués) pour l'UI /god/delegates (D5).
 */
const SyncBrickSchema = z.object({
    delegateId: z.string().min(1),
    brickIds: z.array(z.string()).min(0),
    // Durée appliquée aux grants existants conservés (non recréés), en minutes.
    durationMinutes: z.number().int().min(5).max(90 * 24 * 60).optional(),
    reason: z.string().max(500).optional().default(""),
});

/**
 * 🔄 ÉDITION EN PLACE (P3-R) : Synchronise les grants de briques d'un délégué.
 * Applique un diff atomique :
 *  - crée les briques absentes,
 *  - révoque les briques retirées de `brickIds`,
 *  - (optionnel) prolonge la durée des grants existants conservés.
 * Obtient le résultat en UN seul appel (fini le "révoquer + recréer").
 */
export async function syncBrickAccessForDelegate(
    input: z.infer<typeof SyncBrickSchema>
): Promise<{ success: boolean; data?: { created: number; revoked: number; kept: number }; error?: string }> {
    try {
        await requireGodAccess("users");
        const isAdmin = await isSuperAdmin();
        if (!isAdmin) throw new Error("Unauthorized: Super-admin access required");

        const parsed = SyncBrickSchema.parse(input);
        const actorSession = await auth();
        const actorDiscordId = await getActorDiscordId();
        const actorName = actorDiscordId || actorSession?.user?.id || "unknown";

        // Vérifier le délégué
        const delegate = await db.godDelegate.findUnique({ where: { id: parsed.delegateId } });
        if (!delegate) return { success: false, error: "Délégué introuvable" };
        if (delegate.revokedAt) return { success: false, error: "Ce délégué est révoqué" };

        // 1. Grants actifs existants (non révoqués, non expirés)
        const now = new Date();
        const existing = await db.godAccessGrant.findMany({
            where: {
                delegateId: delegate.id,
                revokedAt: null,
                OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
            },
        });

        const desiredSet = new Set(parsed.brickIds);
        const existingByBrick = new Map(existing.map(g => [g.brickId, g]));

        // 2. Bricks à CRÉER
        const toCreate = parsed.brickIds.filter(id => !existingByBrick.has(id));

        // 3. Grants à RÉVOQUER (présents mais non désirés)
        const toRevoke = existing.filter(g => !desiredSet.has(g.brickId));

        let created = 0;
        let kept = 0;

        await db.$transaction(async (tx) => {
            // Révoquer les retirés
            for (const g of toRevoke) {
                await tx.godAccessGrant.update({ where: { id: g.id }, data: { revokedAt: new Date() } });
            }

            // Créer les nouveaux
            for (const brickId of toCreate) {
                const expiresAt = parsed.durationMinutes
                    ? new Date(Date.now() + parsed.durationMinutes * 60_000)
                    : null;
                await tx.godAccessGrant.create({
                    data: {
                        delegateId: delegate.id,
                        userId: delegate.userId,
                        brickId,
                        guildId: null,
                        startAt: new Date(),
                        expiresAt,
                        grantedBy: actorName,
                        reason: parsed.reason,
                    },
                });
                created++;
            }
        });

        // 4. Prolonger la durée des grants conservés (si demandé)
        if (parsed.durationMinutes) {
            const keptGrants = toCreate.length === 0 ? existing.filter(g => desiredSet.has(g.brickId)) : [];
            for (const g of keptGrants) {
                await db.godAccessGrant.update({
                    where: { id: g.id },
                    data: { expiresAt: new Date(Date.now() + parsed.durationMinutes * 60_000) },
                });
            }
        }
        kept = existing.filter(g => desiredSet.has(g.brickId)).length;

        // 5. Bump scopeVersion (invalidation live côté UI via le polling)
        if (toRevoke.length > 0 || toCreate.length > 0 || parsed.durationMinutes) {
            await db.godDelegate.update({
                where: { id: delegate.id },
                data: { scopeVersion: { increment: 1 } },
            });
        }

        // R4 — Accès modifié (briques ajoutées/retirées/prolongées) → le sous-god
        // rafraîchit son UI en LIVE (les onglets apparaissent/disparaissent SANS logout).
        if (toRevoke.length > 0 || toCreate.length > 0 || parsed.durationMinutes) {
            await publishGodAccessChanged({
                userId: delegate.userId,
                delegateId: delegate.id,
                timestamp: new Date().toISOString(),
            });
        }

        // 6. Audit + journal
        await createGodAuditLog({
            action: "GOD_CONFIG_OVERRIDE",
            targetType: "SYSTEM_GOD",
            targetId: delegate.id,
            newValue: {
                operation: "SYNC_BRICK_ACCESS",
                delegateId: delegate.id,
                brickIds: parsed.brickIds,
                created,
                revoked: toRevoke.length,
                kept,
                durationMinutes: parsed.durationMinutes ?? null,
            },
            metadata: { performedBy: actorName },
        });
        await db.godAccessLog.create({
            data: {
                userId: delegate.userId,
                action: "SYNC",
                targetId: delegate.id,
                metadata: { operation: "SYNC_BRICK_ACCESS", created, revoked: toRevoke.length, kept },
            },
        }).catch((logErr: unknown) => logger.warn("[syncBrickAccessForDelegate] GodAccessLog failed", { error: logErr }));

        revalidatePath("/god/delegates");
        return { success: true, data: { created, revoked: toRevoke.length, kept } };
    } catch (e: any) {
        logger.error("[syncBrickAccessForDelegate] Error:", { error: e });
        return { success: false, error: e.message || "Erreur inconnue" };
    }
}

export async function listBrickGrants(): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
        await requireGodAccess("users");
        const isAdmin = await isSuperAdmin();
        if (!isAdmin) throw new Error("Unauthorized: Super-admin access required");

        const grants = await db.godAccessGrant.findMany({
            orderBy: { createdAt: "desc" },
        });
        return { success: true, data: grants };
    } catch (e: any) {
        logger.error("[listBrickGrants] Error:", { error: e });
        return { success: false, error: e.message || "Erreur inconnue" };
    }
}
