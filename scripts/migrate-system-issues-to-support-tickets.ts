/**
 * Reprise des signalements `SystemIssue` vers `SupportTicket`.
 *
 * Dry-run par défaut :
 *
 *   npx -y tsx scripts/migrate-system-issues-to-support-tickets.ts
 *   npx -y tsx scripts/migrate-system-issues-to-support-tickets.ts --apply
 *
 * Garanties :
 *  - refuse de tourner si la migration additive n'est pas jouée ;
 *  - idempotent (`legacySystemIssueId` unique), ne supprime jamais la source ;
 *  - traite par lots, ne journalise aucune pseudo, aucun identifiant Discord ;
 *  - réserve les numéros de ticket au-dessus des anciens ids pour que
 *    `publicRef = SIG-<n>` ne puisse pas entrer en collision.
 */

import "dotenv/config";
import { db } from "../src/lib/prisma";
import {
    buildLegacyPublicRef,
    buildLegacySubject,
    isTrackerStatus,
    legacyIssueOrigin,
    legacyTypeToCategory,
    trackerStatusToTicketStatus,
    type TrackerStatusValue,
} from "../src/lib/feedback-ticket-mapping";

const APPLY = process.argv.includes("--apply");
const BATCH_SIZE = 200;

interface LegacyIssue {
    id: number;
    type: string;
    category: string;
    priority: string;
    description: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    forumLink: string | null;
    creatorId: string;
    feedbackType: string | null;
    sourcePage: string | null;
    targetSlug: string | null;
    guildId: string | null;
    userAgent: string | null;
    memberName: string | null;
    memberGuildName: string | null;
}

interface GuildInfo {
    discordGuildId: string;
    name: string;
}

const REQUIRED_COLUMNS = [
    "origin",
    "publicRef",
    "legacySystemIssueId",
    "creatorUserId",
    "feedbackType",
    "sourcePage",
    "targetSlug",
    "guildId",
    "userAgent",
    "memberGuildName",
    "priority",
    "trackerStatus",
    "forumLink",
] as const;

async function preflight(): Promise<void> {
    const columns = await db.$queryRaw<{ column_name: string }[]>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'SupportTicket'
    `;
    const present = new Set(columns.map((column) => column.column_name));
    const missing = REQUIRED_COLUMNS.filter((column) => !present.has(column));
    if (missing.length > 0) {
        throw new Error(`Schéma non migré : colonne(s) manquante(s) sur SupportTicket — ${missing.join(", ")}`);
    }

    const source = await db.$queryRaw<{ exists: boolean }[]>`
        SELECT to_regclass('public."SystemIssue"') IS NOT NULL AS exists
    `;
    if (!source[0]?.exists) {
        throw new Error("Table SystemIssue absente : reprise déjà terminée ou base inattendue.");
    }
}

async function reserveTicketNumbers(): Promise<void> {
    try {
        await db.$queryRaw`
            SELECT setval(
                pg_get_serial_sequence('"SupportTicket"', 'ticketNumber'),
                GREATEST(
                    (SELECT last_value FROM "SupportTicket_ticketNumber_seq"),
                    (SELECT COALESCE(MAX("ticketNumber"), 0) FROM "SupportTicket"),
                    (SELECT COALESCE(MAX(id), 0) FROM "SystemIssue")
                ) + 1,
                false
            )
        `;
    } catch (error) {
        throw new Error(`Impossible de réserver les numéros de ticket : ${(error as Error).message}`);
    }
}

function normalizedStatus(status: string): TrackerStatusValue {
    return isTrackerStatus(status) ? status : "A_FAIRE";
}

function ticketData(
    issue: LegacyIssue,
    discordId: string | null,
    guild: GuildInfo | null,
) {
    const origin = legacyIssueOrigin(issue);
    const trackerStatus = normalizedStatus(issue.status);
    const ticketStatus = trackerStatusToTicketStatus(trackerStatus);

    return {
        origin,
        publicRef: buildLegacyPublicRef(issue.id),
        legacySystemIssueId: issue.id,
        category: legacyTypeToCategory(issue.type),
        status: ticketStatus,
        subject: buildLegacySubject(issue),
        description: issue.description,
        creatorDiscordId: origin === "INTERNAL" ? "SYSTEM" : (discordId ?? "WEB"),
        creatorDiscordName:
            issue.memberName?.trim() || (origin === "INTERNAL" ? "Équipe SigilOS" : "Membre"),
        creatorUserId: issue.creatorId,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        closedAt: ticketStatus === "CLOSED" ? issue.updatedAt : null,
        closedBy: ticketStatus === "CLOSED" ? "SYSTEM" : null,
        closedReason: ticketStatus === "CLOSED" ? "Migration SystemIssue" : null,
        discordGuildId: guild?.discordGuildId ?? null,
        targetGuildId: guild?.discordGuildId ?? null,
        targetGuildName: issue.memberGuildName?.trim() || guild?.name || null,
        feedbackType: issue.feedbackType,
        sourcePage: issue.sourcePage,
        targetSlug: issue.targetSlug,
        guildId: issue.guildId,
        userAgent: issue.userAgent,
        memberGuildName: issue.memberGuildName,
        priority: issue.priority,
        trackerStatus,
        forumLink: issue.forumLink,
    };
}

async function main(): Promise<void> {
    console.log(`[Reprise signalements] Mode : ${APPLY ? "APPLY (écriture)" : "DRY-RUN (lecture seule)"}`);
    await preflight();

    const totalRows = await db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count FROM "SystemIssue"
    `;
    const total = Number(totalRows[0]?.count ?? 0);

    const originRows = await db.$queryRaw<{ origin: string; count: bigint }[]>`
        SELECT
            CASE
                WHEN "feedbackType" IS NULL OR btrim("feedbackType") = '' THEN 'INTERNAL'
                ELSE 'FEEDBACK'
            END AS origin,
            COUNT(*)::bigint AS count
        FROM "SystemIssue"
        GROUP BY 1
    `;
    const countByOrigin = Object.fromEntries(originRows.map((row) => [row.origin, Number(row.count)]));

    const alreadyRows = await db.supportTicket.findMany({
        where: { legacySystemIssueId: { not: null } },
        select: { legacySystemIssueId: true },
    });
    const alreadyMigrated = new Set(
        alreadyRows.map((row) => row.legacySystemIssueId).filter((id): id is number => typeof id === "number"),
    );

    console.log(
        `[Reprise] Source : ${total} (FEEDBACK ${countByOrigin.FEEDBACK ?? 0} · INTERNAL ${countByOrigin.INTERNAL ?? 0}) ` +
            `| déjà migrés : ${alreadyMigrated.size}`,
    );

    if (APPLY) {
        await reserveTicketNumbers();
        console.log("[Reprise] Numéros de ticket réservés au-dessus des anciens ids.");
    }

    const guildCache = new Map<string, GuildInfo | null>();
    const samples: string[] = [];
    let cursor = 0;
    let created = 0;
    let skipped = 0;
    let collisions = 0;

    while (true) {
        const issues = await db.$queryRaw<LegacyIssue[]>`
            SELECT
                id,
                type,
                category,
                priority,
                description,
                status,
                "createdAt",
                "updatedAt",
                "forumLink",
                "creatorId",
                "feedbackType",
                "sourcePage",
                "targetSlug",
                "guildId",
                "userAgent",
                "memberName",
                "memberGuildName"
            FROM "SystemIssue"
            WHERE id > ${cursor}
            ORDER BY id ASC
            LIMIT ${BATCH_SIZE}
        `;
        if (issues.length === 0) break;

        for (const issue of issues) {
            cursor = issue.id;

            if (alreadyMigrated.has(issue.id)) {
                skipped++;
                continue;
            }

            let guild: GuildInfo | null = null;
            if (issue.guildId) {
                if (guildCache.has(issue.guildId)) {
                    guild = guildCache.get(issue.guildId) ?? null;
                } else {
                    guild = await db.guildConfig.findUnique({
                        where: { id: issue.guildId },
                        select: { discordGuildId: true, name: true },
                    });
                    guildCache.set(issue.guildId, guild);
                }
            }

            const account = await db.account.findFirst({
                where: { userId: issue.creatorId, provider: "discord" },
                select: { providerAccountId: true },
            });

            const data = ticketData(issue, account?.providerAccountId ?? null, guild);
            if (samples.length < 10) {
                samples.push(
                    `${data.publicRef} | ${data.origin} | ${data.category} | ${data.status} | ${data.trackerStatus}`,
                );
            }

            if (!APPLY) {
                created++;
                continue;
            }

            try {
                await db.supportTicket.create({ data });
                created++;
            } catch (error) {
                if ((error as { code?: string }).code === "P2002") {
                    collisions++;
                    console.warn(`[Reprise] Collision de référence ignorée : ${data.publicRef}`);
                } else {
                    throw error;
                }
            }
        }

        console.log(`[Reprise] Lot traité jusqu'à l'id ${cursor}.`);
    }

    console.log(
        `[Reprise] ${APPLY ? "Créés" : "À créer"} : ${created} | ignorés (déjà migrés) : ${skipped} | collisions : ${collisions}`,
    );
    if (samples.length > 0) {
        console.log("[Reprise] Échantillon :");
        for (const sample of samples) console.log(`  · ${sample}`);
    }
    console.log(
        APPLY
            ? "[Reprise] Terminé — la table SystemIssue est intacte."
            : "[Reprise] DRY-RUN terminé — aucune écriture effectuée.",
    );

    if (collisions > 0) {
        console.error("[Reprise] Des collisions subsistent : traiter les références signalées avant de basculer le code.");
        process.exitCode = 2;
    }
}

main()
    .catch((error: unknown) => {
        console.error(`[Reprise] Échec : ${(error as Error).message}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await db.$disconnect();
    });
