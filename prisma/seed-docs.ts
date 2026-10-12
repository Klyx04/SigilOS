import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { OFFICIAL_DOCS } from '../src/lib/docs-catalog';

const cleanEnv = (val: string | undefined) => {
    if (!val) return '';
    return val.replace(/^['"]|['"]$/g, '').trim();
};

const getConnectionString = () => {
    if (process.env.DATABASE_URL) {
        return cleanEnv(process.env.DATABASE_URL);
    }
    const user = cleanEnv(process.env.POSTGRES_USER) || 'sigiluser';
    const pwd = cleanEnv(process.env.POSTGRES_PASSWORD);
    const db_name = cleanEnv(process.env.POSTGRES_DB) || 'sigilos';
    const host = process.env.DB_HOST || (process.env.NODE_ENV === 'production' ? 'db-beta' : 'localhost');
    const port = process.env.DB_PORT || '5432';
    const protocol = 'postgresql';
    return `${protocol}://${encodeURIComponent(user)}:${encodeURIComponent(pwd)}@${host}:${port}/${db_name}?schema=public`;
};

const connectionString = getConnectionString();
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export async function seedOfficialDocs(client?: PrismaClient) {
    const p = client || prisma;
    console.log(`🌱 Synchronisation de la documentation officielle (${OFFICIAL_DOCS.length} fiches)...`);

    const validSlugs = OFFICIAL_DOCS.map(d => d.slug);

    // Suppression sécurisée des slugs obsolètes
    const deleted = await p.docPage.deleteMany({
        where: {
            slug: { notIn: validSlugs }
        }
    });

    if (deleted.count > 0) {
        console.log(`🧹 ${deleted.count} ancienne(s) documentation(s) obsolète(s) supprimée(s).`);
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (const doc of OFFICIAL_DOCS) {
        const existing = await p.docPage.findUnique({ where: { slug: doc.slug } });
        if (existing) {
            await p.docPage.update({
                where: { slug: doc.slug },
                data: {
                    title: doc.title,
                    category: doc.category,
                    content: doc.content.trim(),
                    accessLevel: doc.accessLevel as any,
                    isPublished: true,
                }
            });
            updatedCount++;
        } else {
            await p.docPage.create({
                data: {
                    slug: doc.slug,
                    title: doc.title,
                    category: doc.category,
                    content: doc.content.trim(),
                    accessLevel: doc.accessLevel as any,
                    isPublished: true,
                }
            });
            createdCount++;
        }
    }

    console.log(`✅ Synchronisation terminée : ${createdCount} créées, ${updatedCount} mises à jour.`);
    return { createdCount, updatedCount, total: OFFICIAL_DOCS.length };
}

async function main() {
    try {
        await seedOfficialDocs();
    } catch (err) {
        console.error("❌ Erreur lors du seed des docs :", err);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

// Exécution directe en CLI
if (require.main === module || (process.argv && process.argv[1]?.includes('seed-docs'))) {
    main();
}
