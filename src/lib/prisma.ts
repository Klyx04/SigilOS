import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { encrypt, decrypt } from './encryption'

// Récupération et nettoyage strict
const getEnv = (key: string, fallback: string) => {
    const val = process.env[key];
    if (!val) return fallback;
    return val.replace(/^['"]|['"]$/g, '').trim();
};

const user = getEnv('POSTGRES_USER', 'sigiluser');
const pwd = getEnv('POSTGRES_PASSWORD', '');
const db_name = getEnv('POSTGRES_DB', 'sigilos');
const host = process.env.DB_HOST || (process.env.NODE_ENV === 'production' ? 'db-prod' : 'localhost');

// Priority to DATABASE_URL if available
const dbUrl = getEnv('DATABASE_URL', '');
const connectionString = dbUrl || `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pwd)}@${host}:5432/${db_name}?schema=public`;

if (!dbUrl && !pwd && process.env.NODE_ENV !== 'production') {
    console.warn("[Prisma] No DATABASE_URL or POSTGRES_PASSWORD found. Connection might fail.");
}

const pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
})

const adapter = new PrismaPg(pool)
const basePrisma = new PrismaClient({
    adapter,
    log: ["error", "warn"]
})

/**
 * SIGILOS EXTENDED PRISMA CLIENT
 * Handles transparent encryption/decryption of sensitive fields:
 * - Account (access_token, refresh_token)
 * - GuildConfig (metamobApiKey)
 */
export const prisma = basePrisma.$extends({
    query: {
        account: {
            async create({ args, query }) {
                if (args.data.access_token) args.data.access_token = encrypt(args.data.access_token);
                if (args.data.refresh_token) args.data.refresh_token = encrypt(args.data.refresh_token);
                if (args.data.id_token) args.data.id_token = encrypt(args.data.id_token);
                return query(args);
            },
            async update({ args, query }) {
                if (typeof args.data.access_token === 'string') args.data.access_token = encrypt(args.data.access_token);
                if (typeof args.data.refresh_token === 'string') args.data.refresh_token = encrypt(args.data.refresh_token);
                if (typeof args.data.id_token === 'string') args.data.id_token = encrypt(args.data.id_token);
                return query(args);
            },
            async upsert({ args, query }) {
                if (args.create.access_token) args.create.access_token = encrypt(args.create.access_token);
                if (args.create.refresh_token) args.create.refresh_token = encrypt(args.create.refresh_token);
                if (args.create.id_token) args.create.id_token = encrypt(args.create.id_token);
                if (typeof args.update.access_token === 'string') args.update.access_token = encrypt(args.update.access_token);
                if (typeof args.update.refresh_token === 'string') args.update.refresh_token = encrypt(args.update.refresh_token);
                if (typeof args.update.id_token === 'string') args.update.id_token = encrypt(args.update.id_token);
                return query(args);
            },
            async updateMany({ args, query }) {
                if (typeof args.data.access_token === 'string') args.data.access_token = encrypt(args.data.access_token);
                if (typeof args.data.refresh_token === 'string') args.data.refresh_token = encrypt(args.data.refresh_token);
                if (typeof args.data.id_token === 'string') args.data.id_token = encrypt(args.data.id_token);
                return query(args);
            }
        },
        guildConfig: {
            async create({ args, query }) {
                if (args.data.metamobApiKey) args.data.metamobApiKey = encrypt(args.data.metamobApiKey);
                return query(args);
            },
            async update({ args, query }) {
                if (typeof args.data.metamobApiKey === 'string') args.data.metamobApiKey = encrypt(args.data.metamobApiKey);
                return query(args);
            },
            async upsert({ args, query }) {
                if (args.create.metamobApiKey) args.create.metamobApiKey = encrypt(args.create.metamobApiKey);
                if (typeof args.update.metamobApiKey === 'string') args.update.metamobApiKey = encrypt(args.update.metamobApiKey);
                return query(args);
            },
            async updateMany({ args, query }) {
                if (typeof args.data.metamobApiKey === 'string') args.data.metamobApiKey = encrypt(args.data.metamobApiKey);
                return query(args);
            }
        }
    },
    result: {
        account: {
            access_token: {
                needs: { access_token: true },
                compute(account) { return account.access_token ? decrypt(account.access_token) : account.access_token; }
            },
            refresh_token: {
                needs: { refresh_token: true },
                compute(account) { return account.refresh_token ? decrypt(account.refresh_token) : account.refresh_token; }
            },
            id_token: {
                needs: { id_token: true },
                compute(account) { return account.id_token ? decrypt(account.id_token) : account.id_token; }
            }
        },
        guildConfig: {
            metamobApiKey: {
                needs: { metamobApiKey: true },
                compute(config) { return config.metamobApiKey ? decrypt(config.metamobApiKey) : config.metamobApiKey; }
            }
        }
    }
})

export { prisma as db };

const globalForPrisma = globalThis as unknown as { prisma: typeof prisma }
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
