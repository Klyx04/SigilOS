import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const user = process.env.POSTGRES_USER;
const pwd = process.env.POSTGRES_PASSWORD;
const database_name = process.env.POSTGRES_DB;

const connectionString = `postgresql://${encodeURIComponent(user || '')}:${encodeURIComponent(pwd || '')}@${process.env.NODE_ENV === 'production' ? 'db-prod' : 'localhost'}:5432/${encodeURIComponent(database_name || '')}`

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
