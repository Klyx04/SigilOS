import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

// Fonction de nettoyage ultra-robuste
const clean = (val: string | undefined) => {
    if (!val) return '';
    return val.replace(/^['"]|['"]$/g, '').trim();
};

const user = clean(process.env.POSTGRES_USER);
const pwd = clean(process.env.POSTGRES_PASSWORD);
const db_name = clean(process.env.POSTGRES_DB);

// LOG DE DEBUG CRITIQUE (S'affiche au démarrage)
console.log("-----------------------------------------");
console.log("[SigilOS-Init] Tentative de connexion DB...");
console.log(`[SigilOS-Init] Host: ${process.env.NODE_ENV === 'production' ? 'db-prod' : 'localhost'}`);
console.log(`[SigilOS-Init] DB: ${db_name}`);
console.log(`[SigilOS-Init] User: ${user}`);
console.log(`[SigilOS-Init] Password Length: ${pwd.length}`);
console.log("-----------------------------------------");

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

export const prisma = globalForPrisma.prisma || new PrismaClient({
    adapter,
    log: ["error", "warn"]
})
export const db = prisma;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
