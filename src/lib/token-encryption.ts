import { db } from "./prisma";
import { encrypt, isEncrypted } from "./encryption";
import { logger } from "./logger";

/**
 * SECURITY (F-05 / audit 2026)
 * ─────────────────────────────────────────────────────────────────────────────
 * The Prisma $extends hooks encrypt tokens on `account.create` and
 * `account.update`, but NOT on `account.updateMany`. The OAuth refresh path was
 * using updateMany, so Discord tokens were written in PLAINTEXT in the DB at
 * every sign-in.
 *
 * This module provides an EXPLICIT, testable service to update Discord OAuth
 * tokens with encryption, protecting against double-encryption:
 *   • For each token we only encrypt if it's not already encrypted (isEncrypted).
 *   • Failed reads/writes are logged and do NOT silently corrupt data.
 *
 * Use this from auth.ts (and anywhere else that refreshes OAuth tokens) instead
 * of a bare `prisma.account.updateMany({ data: { access_token, ... } })`.
 */

interface DiscordTokenUpdate {
    access_token?: string | null;
    refresh_token?: string | null;
    expires_at?: number | null;
    scope?: string | null;
}

/** Encrypt a single token unless it's already encrypted. */
function encryptIfNeeded(value: string | null | undefined): string | null | undefined {
    if (!value) return value;
    if (isEncrypted(value)) return value; // already encrypted — avoid double encryption
    return encrypt(value);
}

/**
 * Update the Discord OAuth tokens for a user, encrypting refresh_token,
 * access_token and id_token at rest. This is the ONLY sanctioned way to write
 * Discord tokens outside of the Prisma create/update hooks.
 *
 * @returns the Prisma updateMany result count, or 0 on failure.
 */
export async function updateEncryptedDiscordTokens(
    userId: string,
    update: DiscordTokenUpdate & { id_token?: string | null }
): Promise<number> {
    try {
        const data: Record<string, unknown> = {};

        if (update.access_token !== undefined) data.access_token = encryptIfNeeded(update.access_token);
        if (update.refresh_token !== undefined) data.refresh_token = encryptIfNeeded(update.refresh_token);
        if (update.id_token !== undefined) data.id_token = encryptIfNeeded(update.id_token);
        if (update.expires_at !== undefined) data.expires_at = update.expires_at;
        if (update.scope !== undefined) data.scope = update.scope;

        if (Object.keys(data).length === 0) return 0;

        const result = await db.account.updateMany({
            where: { userId, provider: "discord" },
            data,
        });

        return result.count;
    } catch (error) {
        logger.error("[TokenEncryption] Failed to update encrypted Discord tokens:", error as any);
        return 0;
    }
}