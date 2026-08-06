"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { GOD_SCOPES } from "@/lib/god-scopes";
import { isSuperAdmin, requireGodAccess } from "./super-admin-actions";
import { createGodAuditLog } from "./audit-actions";

// ============================================================================
// CHANTIER A — Gestion des sub-gods (GodDelegate)
// Sécurité fail-closed : CHAQUE action vérifie requireGodAccess("users") ET
// est doublée par isSuperAdmin(). Chaque grant/revoke est audité.
// ============================================================================

const ScopesSchema = z.array(z.enum(GOD_SCOPES)).min(1, "Au moins un scope est requis");

const GrantDelegateSchema = z.object({
    userId: z.string().optional(),
    discordId: z.string().optional(),
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
    // Justification OBLIGATOIRE (sécurité : toute élévation doit être motivée)
    reason: z.string().min(3).max(500),
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

        // Audit + journal
        await createGodAuditLog({
            action: "GOD_CONFIG_OVERRIDE",
            targetType: "SYSTEM_GOD",
            targetId: grant.id,
            newValue: { operation: "GRANT_BRICK", delegateId: delegate.id, brickId: parsed.brickId, expiresAt: expiresAt.toISOString(), durationMinutes: parsed.durationMinutes },
            metadata: { performedBy: actorDiscordId || actorSession?.user?.id || "unknown" },
        });
        await db.godAccessLog.create({
            data: { userId: delegate.userId, action: "GRANT", targetId: grant.id, metadata: { brickId: parsed.brickId, expiresAt: expiresAt.toISOString(), reason: parsed.reason } },
        }).catch(() => {});

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

        await createGodAuditLog({
            action: "GOD_CONFIG_OVERRIDE",
            targetType: "SYSTEM_GOD",
            targetId: grantId,
            newValue: { operation: "REVOKE_BRICK", delegateId: grant.delegateId, brickId: grant.brickId },
            metadata: { performedBy: actorDiscordId || actorSession?.user?.id || "unknown" },
        });
        await db.godAccessLog.create({
            data: { userId: grant.userId, action: "REVOKE", targetId: grantId, metadata: { brickId: grant.brickId } },
        }).catch(() => {});

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
