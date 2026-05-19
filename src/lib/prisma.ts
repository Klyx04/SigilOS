// v3.0.9 - Force reload for maintenance mode v2
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { encrypt, decrypt } from './encryption'

// Récupération et nettoyage strict - v3.0.7 (OCR Module Integration)
const getEnv = (key: string, fallback: string) => {
    const val = process.env[key];
    if (!val) return fallback;
    return val.replace(/^['"]|['"]$/g, '').trim();
};

const user = getEnv('POSTGRES_USER', '');
const pwd = getEnv('POSTGRES_PASSWORD', '');
const db_name = getEnv('POSTGRES_DB', '');

// Smarter host detection
const isBeta = process.env.DOMAIN_NAME?.includes('beta') || process.env.NEXT_PUBLIC_APP_URL?.includes('beta');
const defaultHost = isBeta ? 'db-beta' : 'db-prod';
const host = process.env.DB_HOST || (process.env.NODE_ENV === 'production' ? defaultHost : 'localhost');

const dbUrl = getEnv('DATABASE_URL', '');
const port = process.env.DB_PORT || (process.env.NODE_ENV === 'production' ? '5432' : '5433');
const protocol = 'postgres' + 'ql://';
const safeFromComponents = `${protocol}${encodeURIComponent(user)}:${encodeURIComponent(pwd)}@${host}:${port}/${db_name}?schema=public`;
const connectionString = dbUrl || safeFromComponents;

const createPrismaClient = () => {
    const isDev = process.env.NODE_ENV !== 'production';
    
    const pool = new Pool({
        connectionString,
        max: isDev ? 8 : 30, // Reduced from 10 to prevent exhaustion in local HMR
        idleTimeoutMillis: 5000, // Reduced from 30s to release connections faster
        connectionTimeoutMillis: 5000, // Fail fast (5s) instead of hanging (15s)
        // Kill any query that takes longer than 10s in prod (30s in dev for debugging)
        // Prevents runaway queries from exhausting the connection pool
        statement_timeout: isDev ? 30_000 : 10_000,
        query_timeout: isDev ? 30_000 : 10_000,
        allowExitOnIdle: true,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
    })



    const adapter = new PrismaPg(pool as any)
    const basePrisma = new PrismaClient({
        adapter,
        log: isDev ? ["error"] : ["error", "warn"]
    })

    return basePrisma.$extends({
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
                }
            },
            userProfile: {
                async update({ args, query }) {
                    const data = args.data as any;
                    if (typeof data.metamobApiKey === 'string') data.metamobApiKey = encrypt(data.metamobApiKey);
                    return query(args);
                }
            }
        },
        result: {
            account: {
                access_token: {
                    needs: { access_token: true },
                    compute(account: any) {
                        if (!account.access_token) return account.access_token;
                        return decrypt(account.access_token);
                    }
                }
            },
            userProfile: {
                metamobApiKey: {
                    needs: { metamobApiKey: true },
                    compute(profile: any) {
                        if (!profile.metamobApiKey) return profile.metamobApiKey;
                        return decrypt(profile.metamobApiKey);
                    }
                }
            }
        }
    });
}

type PrismaClientExtended = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClientExtended | undefined }

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
export const prisma = db;
 
