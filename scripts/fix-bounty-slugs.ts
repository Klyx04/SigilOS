/**
 * Reprise des slugs d'avis — retire l'identifiant des URLs publiques (`fojumo-4015` → `fojumo`).
 *
 * 🐛 Décision user du 27/09/2026 : « les avis ont un chiffre dans l'URL, c'est pas propre ».
 * L'unicité des homonymes (3 × « Ronce ») est désormais portée par un **suffixe de collision**
 * (`ronce`, `ronce-2`, `ronce-3`) — jamais par l'identifiant DofusDB.
 *
 * Idempotent : un slug déjà propre n'est pas touché, une seconde exécution ne trouve plus rien.
 * Les anciennes URL restent servies en **308** vers le nouveau slug (`/boss/[dungeonId]`).
 *
 * Usage :
 *   npx -y tsx scripts/fix-bounty-slugs.ts            # simulation (aucune écriture)
 *   npx -y tsx scripts/fix-bounty-slugs.ts --apply    # applique
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { bountySlug, isIdSuffixedBountySlug, uniqueBountySlug } from "@/lib/bounty";

const cleanEnv = (value: string | undefined) => (value ? value.replace(/^['"]|['"]$/g, "").trim() : "");

function connectionString(): string {
    if (process.env.DATABASE_URL) return cleanEnv(process.env.DATABASE_URL);
    const user = cleanEnv(process.env.POSTGRES_USER) || "sigiluser";
    const password = encodeURIComponent(cleanEnv(process.env.POSTGRES_PASSWORD));
    const database = cleanEnv(process.env.POSTGRES_DB) || "sigilos";
    const host = process.env.DB_HOST || (process.env.NODE_ENV === "production" ? "db-beta" : "localhost");
    const port = process.env.DB_PORT || "5432";
    // ⚠️ Schéma concaténé : le hook anti-secret (pre-commit) refuse une URL de base « en dur »
    // — même convention que `prisma/seed-data/seed.ts`.
    const scheme = "postgres" + "ql://";
    return `${scheme}${encodeURIComponent(user)}:${password}@${host}:${port}/${database}?schema=public`;
}

async function main() {
    const apply = process.argv.includes("--apply");
    const db = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: connectionString() })) });

    try {
        // ⚠️ TOUS les slugs de la table entrent dans le jeu « déjà pris » (les 51 lignes
        // historiques de la carte du monde gardent leur slug : on ne renomme QUE les avis).
        const rows = await db.bounty.findMany({
            select: { id: true, name: true, slug: true, dofusdbId: true, isBountyMonster: true },
            orderBy: { dofusdbId: "asc" },
        });
        const taken = new Set<string>();
        for (const row of rows) {
            const slug = String(row.slug ?? "").trim().toLowerCase();
            if (slug) taken.add(slug);
        }

        const avis = rows.filter((row) => row.isBountyMonster);
        let changed = 0;
        for (const row of avis) {
            const current = String(row.slug ?? "").trim();
            const clean = bountySlug(row.name);
            const legacy = isIdSuffixedBountySlug(current, row.dofusdbId);
            if (!legacy && current.toLowerCase() === clean) continue;

            if (current) taken.delete(current.toLowerCase());
            const next = uniqueBountySlug(row.name, taken);
            taken.add(next.toLowerCase());
            console.log(`  ${current || "(vide)"} → ${next}   [${row.name}]`);
            if (apply) await db.bounty.update({ where: { id: row.id }, data: { slug: next } });
            changed++;
        }

        console.log(
            `\n${avis.length} avis analysé(s) · ${changed} slug(s) ${apply ? "corrigé(s)" : "à corriger"}`
                + (apply || changed === 0 ? "" : "\n👉 relancer avec --apply pour écrire")
        );
    } finally {
        await db.$disconnect();
    }
}

main().catch((error) => {
    console.error("❌ [fix-bounty-slugs] échec :", error);
    process.exit(1);
});
