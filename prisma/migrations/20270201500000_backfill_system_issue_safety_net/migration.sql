-- Filet de sécurité avant la suppression de `SystemIssue`.
--
-- Le script `scripts/migrate-system-issues-to-support-tickets.ts` reste la voie
-- auditée (dry-run, compteurs, échantillon). Cette migration copie elle-même
-- les lignes qui n'auraient pas encore été reprises, afin qu'un déploiement ne
-- puisse jamais perdre un signalement : la migration destructive suivante ne
-- s'exécute que si celle-ci a réussi.
--
-- Idempotente : `legacySystemIssueId` unique + `WHERE NOT EXISTS`, et no-op si
-- la table source n'existe pas (déjà nettoyée).

DO $$
BEGIN
    IF to_regclass('public."SystemIssue"') IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO "SupportTicket" (
        "id", "origin", "publicRef", "legacySystemIssueId", "category", "status",
        "subject", "description", "creatorDiscordId", "creatorDiscordName", "creatorUserId",
        "createdAt", "updatedAt", "closedAt", "closedBy", "closedReason",
        "discordGuildId", "targetGuildId", "targetGuildName",
        "feedbackType", "sourcePage", "targetSlug", "guildId", "userAgent",
        "memberGuildName", "priority", "trackerStatus", "forumLink"
    )
    SELECT
        'legacy-system-issue-' || si.id,
        CASE
            WHEN si."feedbackType" IS NULL OR btrim(si."feedbackType") = '' THEN 'INTERNAL'
            ELSE 'FEEDBACK'
        END::"TicketOrigin",
        'SIG-' || si.id,
        si.id,
        CASE WHEN si.type = 'BUG' THEN 'BUG_REPORT' ELSE 'FEATURE_REQUEST' END::"TicketCategory",
        CASE si.status
            WHEN 'A_FAIRE' THEN 'OPEN'
            WHEN 'A_INVESTIGUER' THEN 'IN_PROGRESS'
            WHEN 'EN_COURS' THEN 'IN_PROGRESS'
            ELSE 'CLOSED'
        END::"TicketStatus",
        left(
            coalesce(nullif(btrim(si."feedbackType"), ''), si.type::text) || ' ' || si.description,
            120
        ),
        si.description,
        CASE
            WHEN si."feedbackType" IS NULL OR btrim(si."feedbackType") = '' THEN 'SYSTEM'
            ELSE coalesce(a."providerAccountId", 'WEB')
        END,
        coalesce(
            nullif(btrim(si."memberName"), ''),
            CASE
                WHEN si."feedbackType" IS NULL OR btrim(si."feedbackType") = '' THEN 'Équipe SigilOS'
                ELSE 'Membre'
            END
        ),
        si."creatorId",
        si."createdAt",
        si."updatedAt",
        CASE WHEN si.status IN ('TERMINE', 'IGNORE') THEN si."updatedAt" ELSE NULL END,
        CASE WHEN si.status IN ('TERMINE', 'IGNORE') THEN 'SYSTEM' ELSE NULL END,
        CASE WHEN si.status IN ('TERMINE', 'IGNORE') THEN 'Migration SystemIssue' ELSE NULL END,
        g."discordGuildId",
        g."discordGuildId",
        coalesce(nullif(btrim(si."memberGuildName"), ''), g.name),
        si."feedbackType",
        si."sourcePage",
        si."targetSlug",
        si."guildId",
        si."userAgent",
        si."memberGuildName",
        si.priority,
        si.status,
        si."forumLink"
    FROM "SystemIssue" si
    LEFT JOIN "Account" a
        ON a."userId" = si."creatorId" AND a.provider = 'discord'
    LEFT JOIN "GuildConfig" g
        ON g.id = si."guildId"
    WHERE NOT EXISTS (
        SELECT 1 FROM "SupportTicket" st WHERE st."legacySystemIssueId" = si.id
    )
    ON CONFLICT ("legacySystemIssueId") DO NOTHING;
END
$$;
