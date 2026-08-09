#!/usr/bin/env tsx
/**
 * 🔐 Re-encrypt Discord OAuth tokens at rest (SECURITY F-05 migration).
 *
 * CONTEXT : avant le fix F-05 (commit 339db4e1), certains comptes Discord ont
 * leur `access_token` / `refresh_token` / `id_token` stockés EN CLAIR en BDD.
 * Ce script les chiffre avec AES-256-GCM (même format que src/lib/encryption :
 * `iv:authTag:ciphertext`), puis les écrit en SQL brut.
 *
 * Il est volontairement LÉGER (aucune dépendance Prisma) pour tourner dans une
 * image standalone Next.js : seule la lib `pg` est requise (tracée par le build,
 * utilisée par src/lib/prisma.ts). AES-256-GCM est réimplémenté inline.
 *
 * Usage (dans le conteneur app, qui a ENCRYPTION_KEY + DATABASE_URL) :
 *   npx tsx scripts/re-encrypt-oauth-tokens.ts            # Dry-run (défaut)
 *   npx tsx scripts/re-encrypt-oauth-tokens.ts --execute  # Chiffre réellement
 *
 * Exécution (VPS) :
 *   sudo docker cp scripts/re-encrypt-oauth-tokens.ts sigilos-prod:/app/scripts/
 *   sudo docker exec sigilos-prod npx tsx scripts/re-encrypt-oauth-tokens.ts
 *   sudo docker exec sigilos-prod npx tsx scripts/re-encrypt-oauth-tokens.ts --execute
 */

import { Pool, PoolConfig } from "pg";
import { createCipheriv, randomBytes, scryptSync } from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// AES-256-GCM helpers (identique à src/lib/encryption.ts, inline pour autonomie)
// ─────────────────────────────────────────────────────────────────────────────
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getEncryptionKey(): Buffer {
    const keyStr = process.env.ENCRYPTION_KEY;
    if (!keyStr) {
        throw new Error("CRITICAL: ENCRYPTION_KEY is missing — set a 64-hex-char value in the environment.");
    }
    if (keyStr.length === 64) return Buffer.from(keyStr, "hex");
    return scryptSync(keyStr, "sigilos-salt", KEY_LENGTH);
}

function encrypt(text: string): string {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");
    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

function isEncrypted(value: string): boolean {
    if (!value) return false;
    const parts = value.split(":");
    return parts.length === 3 && parts[0].length === IV_LENGTH * 2 && parts[1].length === AUTH_TAG_LENGTH * 2;
}

interface RawAccount {
    id: string;
    userId: string;
    provider: string;
    access_token: string | null;
    refresh_token: string | null;
    id_token: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Connexion via pg (SQL brut, aucune dépendance Prisma)
// ─────────────────────────────────────────────────────────────────────────────
const getEnv = (key: string, fallback: string) => {
    const val = process.env[key];
    if (!val) return fallback;
    return val.replace(/^['"]|['"]$/g, "").trim();
};

// Config OBJET (robuste face aux caractères spéciaux) — évite pg-connection-string.
function buildPoolConfig(): PoolConfig {
    const user = getEnv("POSTGRES_USER", "");
    const pwd = getEnv("POSTGRES_PASSWORD", "");
    const dbName = getEnv("POSTGRES_DB", "");
    const isBeta =
        process.env.DOMAIN_NAME?.includes("beta") || process.env.NEXT_PUBLIC_APP_URL?.includes("beta");
    const defaultHost = isBeta ? "db-beta" : "db-prod";
    const host = getEnv("DB_HOST", process.env.NODE_ENV === "production" ? defaultHost : "localhost");
    const port = Number(getEnv("DB_PORT", process.env.NODE_ENV === "production" ? "5432" : "5433"));

    if (user && pwd && dbName) {
        return { host, port, user, password: pwd, database: dbName, max: 5 };
    }

    // Fallback : on n'a pas les composants → on passe par DATABASE_URL brute.
    return { connectionString: getEnv("DATABASE_URL", ""), max: 5 };
}

async function main() {
    const isDryRun = !process.argv.includes("--execute");
    const pool = new Pool(buildPoolConfig());

    console.log("--------------------------------------------------");
    console.log(`🔐 Re-encrypt OAuth tokens - ${new Date().toISOString()}`);
    if (isDryRun) console.log("🧪 DRY RUN MODE - No data will be modified.");
    else console.log("⚡ EXECUTE MODE - tokens will be re-encrypted.");
    console.log("--------------------------------------------------");

    const toFix: { account: RawAccount; fields: string[] }[] = [];

    try {
        const client = await pool.connect();
        try {
            const { rows: accounts } = await client.query<RawAccount>(
                `SELECT id, "userId", provider, access_token, refresh_token, id_token
                 FROM "Account"
                 WHERE provider = 'discord'
                   AND (access_token IS NOT NULL OR refresh_token IS NOT NULL OR id_token IS NOT NULL)`
            );

            console.log(`[Scan] ${accounts.length} compte(s) Discord avec token(s).`);

            for (const acc of accounts) {
                const fields: string[] = [];
                if (acc.access_token && !isEncrypted(acc.access_token)) fields.push("access_token");
                if (acc.refresh_token && !isEncrypted(acc.refresh_token)) fields.push("refresh_token");
                if (acc.id_token && !isEncrypted(acc.id_token)) fields.push("id_token");
                if (fields.length > 0) toFix.push({ account: acc, fields });
            }

            console.log(`[Detect] ${toFix.length} compte(s) avec token(s) EN CLAIR à chiffrer.`);

            if (toFix.length === 0) {
                console.log("✅ Aucun token en clair — chantier F-05 fermé pour cet environnement.");
                return;
            }

            for (const { account, fields } of toFix) {
                const label = `${account.userId} (${fields.join(", ")})`;
                if (isDryRun) {
                    console.log(`  [DRY] Rechiffrerait ${label}`);
                    continue;
                }

                // Chiffre chaque token présent, puis écrit la valeur chiffrée telle quelle.
                const encAccess = account.access_token ? encrypt(account.access_token) : null;
                const encRefresh = account.refresh_token ? encrypt(account.refresh_token) : null;
                const encId = account.id_token ? encrypt(account.id_token) : null;

                const result = await client.query(
                    `UPDATE "Account"
                     SET access_token = $1, refresh_token = $2, id_token = $3
                     WHERE id = $4`,
                    [encAccess, encRefresh, encId, account.id]
                );
                console.log(`  [ENC] ${label} → updated=${result.rowCount ?? 0}`);
            }
        } finally {
            client.release();
        }

        console.log("--------------------------------------------------");
        console.log(
            isDryRun
                ? `✨ Dry run terminé (${toFix.length} compte(s) à chiffrer). Relance avec --execute pour appliquer.`
                : `✨ Ré-encryptage terminé (${toFix.length} compte(s) traité(s)).`
        );
    } catch (error) {
        console.error("❌ Re-encrypt failed with error:", error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
