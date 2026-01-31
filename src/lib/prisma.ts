import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const cleanInput = (val: string | undefined) => {
    if (!val) return '';
    // Retire les guillemets simples ou doubles si présents au début et à la fin
    return val.replace(/^['"]|['"]$/g, '');
};

const user = cleanInput(process.env.POSTGRES_USER);
const pwd = cleanInput(process.env.POSTGRES_PASSWORD);
const database_name = cleanInput(process.env.POSTGRES_DB);

if (!pwd) {
    console.error("[Prisma] CRITICAL: POSTGRES_PASSWORD is empty or undefined!");
} else {
    console.log(`[Prisma] Connection debug: host=${process.env.NODE_ENV === 'production' ? 'db-prod' : 'localhost'}, database=${database_name}, user=${user}, pwd_len=${pwd.length}, original_starts_with_quote=${(process.env.POSTGRES_PASSWORD || '').startsWith("'")}`);
}

const connectionString = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pwd)}@${process.env.NODE_ENV === 'production' ? 'db-prod' : 'localhost'}:5432/${encodeURIComponent(database_name)}`

const pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000, // Augmenté pour la production
})

pool.on('error', (err) => {
    console.error('[Prisma/Postgres] Unexpected error on idle client', err)
})

const adapter = new PrismaPg(pool)

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

const logLevels: any[] = ["error", "warn"];

export const prisma = globalForPrisma.prisma || new PrismaClient({
    adapter,
    log: logLevels
})
export const db = prisma;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
