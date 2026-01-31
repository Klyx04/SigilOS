import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const connectionString = process.env.DATABASE_URL ||
    `postgresql://${process.env.POSTGRES_USER}:${encodeURIComponent(process.env.POSTGRES_PASSWORD || '')}@${process.env.NODE_ENV === 'production' ? 'db-prod' : 'localhost'}:5432/${process.env.POSTGRES_DB}`

const pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
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
