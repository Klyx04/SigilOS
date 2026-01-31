import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

// Fonction de nettoyage ultra-robuste
const clean = (val: string | undefined) => {
    if (!val) return '';
    // Retire les guillemets (si Docker les laisse) et les espaces/retours à la ligne invisibles
    return val.replace(/^['"]|['"]$/g, '').trim();
};

const user = clean(process.env.POSTGRES_USER);
const pwd = clean(process.env.POSTGRES_PASSWORD);
const db_name = clean(process.env.POSTGRES_DB);

// On construit l'URL EXACTEMENT comme dans prisma.config.js
const connectionString = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pwd)}@${process.env.NODE_ENV === 'production' ? 'db-prod' : 'localhost'}:5432/${db_name}?schema=public`

const pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
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
