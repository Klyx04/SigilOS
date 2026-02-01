import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

// Récupération et nettoyage strict
const getEnv = (key: string, fallback: string) => {
    const val = process.env[key];
    if (!val) return fallback;
    // Retire les guillemets parasites et les espaces
    return val.replace(/^['"]|['"]$/g, '').trim();
};

const user = getEnv('POSTGRES_USER', 'sigiluser');
const pwd = getEnv('POSTGRES_PASSWORD', '');
const db_name = getEnv('POSTGRES_DB', 'sigilos');
const host = process.env.DB_HOST || (process.env.NODE_ENV === 'production' ? 'db-prod' : 'localhost');

// Log de démarrage sécurisé (ne montre pas le mot de passe mais sa validité)
console.log("-----------------------------------------");
console.log(`[SigilOS-DB] Tentative de connexion...`);
console.log(`[SigilOS-DB] Target: ${host}/${db_name} (User: ${user})`);
console.log(`[SigilOS-DB] Password: ${pwd ? `OK (${pwd.length} chars)` : 'MISSING'}`);
console.log("-----------------------------------------");

const connectionString = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pwd)}@${host}:5432/${db_name}?schema=public`

const pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
})

pool.on('error', (err) => {
    console.error('[Prisma/Postgres] ERROR:', err.message);
})

const adapter = new PrismaPg(pool)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient({
    adapter,
    log: ["error", "warn"]
})

export { prisma as db };

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
