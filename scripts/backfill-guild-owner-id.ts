#!/usr/bin/env tsx
/**
 * D7 — normalise `GuildConfig.ownerId` vers l'identifiant interne `User.id`.
 *
 * Contexte : la colonne porte soit un snowflake Discord (onboarding/bot), soit
 * un identifiant interne (transfert de propriété). La cible est **toujours**
 * l'identifiant interne ; le snowflake n'est qu'une valeur transitoire quand le
 * propriétaire n'a pas encore de compte lié (le self-heal de `getUserContext`
 * le remplace à sa première visite).
 *
 * Usage :
 *   npx -y tsx scripts/backfill-guild-owner-id.ts            # dry-run (défaut)
 *   npx -y tsx scripts/backfill-guild-owner-id.ts --execute  # écrit les UUID/CUID
 *
 * Aucune donnée personnelle dans les logs : uniquement des compteurs.
 * Idempotent : relancer après une exécution partielle ne réécrit rien.
 */

import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { classifyGuildOwnerId, planGuildOwnerBackfill } from "../src/lib/god-guild-owner";

async function main() {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is required to run the guild owner backfill.");
    }

    const execute = process.argv.includes("--execute");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = new PrismaClient({ adapter: new PrismaPg(pool as any) });

    try {
        const rows = await db.guildConfig.findMany({ select: { id: true, ownerId: true } });
        const snowflakes = [
            ...new Set(
                rows
                    .map((row) => row.ownerId?.trim())
                    .filter((value): value is string => !!value && classifyGuildOwnerId(value) === "DISCORD_SNOWFLAKE"),
            ),
        ];

        const accounts = snowflakes.length > 0
            ? await db.account.findMany({
                where: { provider: "discord", providerAccountId: { in: snowflakes } },
                select: { providerAccountId: true, userId: true },
            })
            : [];
        const ownerToUserId = new Map(accounts.map((account) => [account.providerAccountId, account.userId]));
        const plan = planGuildOwnerBackfill(rows, ownerToUserId);

        console.log("--------------------------------------------------");
        console.log(`🔁 Backfill GuildConfig.ownerId — ${new Date().toISOString()}`);
        console.log(
            `   ${plan.counts.total} guilde(s) : ${plan.counts.update} à normaliser, ` +
            `${plan.counts.unresolved} sans compte lié, ${plan.counts.keep} déjà interne(s)/nulle(s).`,
        );

        if (!execute) {
            console.log("🧪 DRY RUN — aucune écriture. Relancer avec --execute.");
            return;
        }

        let updated = 0;
        for (const entry of plan.entries) {
            if (entry.action !== "UPDATE" || !entry.to) continue;
            await db.guildConfig.update({ where: { id: entry.id }, data: { ownerId: entry.to } });
            updated++;
        }
        console.log(`✅ ${updated} ligne(s) normalisée(s) vers User.id.`);
    } finally {
        await db.$disconnect().catch(() => { });
        await pool.end().catch(() => { });
    }
}

main().catch((error: unknown) => {
    console.error("❌ Backfill ownerId échoué :", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
