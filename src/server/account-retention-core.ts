import { logger } from "@/lib/logger";
import { db } from "@/lib/prisma";
import { getSuperAdminIds } from "./actions/super-admin-actions";
import { createGodAuditLog } from "./actions/audit-actions";
import { closeMemberPublishedContent } from "./actions/lifecycle-actions";
import { isDeletedMemberUser, reattributeGuildEvents } from "./deleted-member";

type CoreResult = {
    deleted: number;
    scanned: number;
    skipped: number;
};

/**
 * ♻️ #168 — Cœur de la rétention/purge des comptes orphelins (RGPD).
 *
 * ⚠️ SÉCURITÉ : ce module est VOLONTAIREMENT sans directive "use server" et SANS contrôle
 * d'auth : il n'est donc JAMAIS exposé comme endpoint de server action Next.js.
 * Seuls l'appellent des points déjà authentifiés :
 * - `purgeOrphanAccounts` (server action) après `isSuperAdmin()`,
 * - la route cron `/api/cron/account-retention` après `verifyCronSecret()`.
 *
 * Règles (fail-safe) : rétention 90j par défaut, purge seulement si TOUS les profils sont
 * en fin de grâce (`scheduledDeletion` passée), protections super-admin + **compte technique
 * « Ancien membre »** ; tâches de 50 max/exécution.
 *
 * ⚠️ **Ce que « 90 j » veut dire (mesure du 01/11/2026)** : c'est un **âge minimum du compte**
 * (`User.createdAt`), pas une mesure d'inactivité — les sessions sont en **JWT** (`src/auth.ts`),
 * donc aucune date de dernière connexion n'existe en base. Conséquence assumée : un compte ancien
 * qui perd sa **dernière** guilde devient éligible dès que la grâce de ses profils expire (J+30),
 * même s'il s'est connecté la veille ; un compte récent est protégé, même abandonné. Le seul
 * avertissement visible est l'écran « Serveur Supprimé » (compte à rebours). Mesurer l'activité
 * réelle demanderait un champ (migration) — décision non prise à ce jour.
 *
 * Les **événements de guilde survivent** au compte (décision user du 30/10/2026, option C) :
 * ils sont annulés s'ils étaient ouverts, rattachés au compte technique puis signés
 * « Ancien membre » — la guilde garde son historique, l'identité disparaît.
 */
export async function purgeOrphanAccountsCore(opts?: {
    retentionDays?: number;
    max?: number;
    source?: "CRON" | "GOD";
}): Promise<CoreResult> {
    const retentionDays = Math.min(3650, Math.max(30, opts?.retentionDays || 90));
    const max = Math.min(500, Math.max(1, opts?.max || 50));
    const source = opts?.source || "GOD";

    const now = new Date();
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const superAdminIds = await getSuperAdminIds();

    // Comptes sans profil ACTIVE (ex-membres archivés/bannis, ou fantômes sans profil).
    const candidates = await db.user.findMany({
        where: {
            createdAt: { lt: cutoff },
            profiles: { none: { status: "ACTIVE" } },
        },
        include: {
            accounts: { select: { provider: true, providerAccountId: true } },
            profiles: {
                select: {
                    id: true,
                    status: true,
                    scheduledDeletion: true,
                    archiveReason: true,
                    guild: { select: { discordGuildId: true } },
                },
            },
        },
        orderBy: { createdAt: "asc" },
        take: max,
    });

    let deleted = 0;
    let skipped = 0;
    const scanned = candidates.length;

    for (const user of candidates) {
        // 1. Protection super-admin.
        const discordId = user.accounts.find(a => a.provider === "discord")?.providerAccountId;
        if (discordId && superAdminIds.includes(discordId)) { skipped++; continue; }

        // 2. Le compte technique « Ancien membre » n'est **jamais** purgé : la cascade
        //    emporterait tous les événements anonymisés qu'il porte.
        if (isDeletedMemberUser(user.id)) { skipped++; continue; }

        // 3. Purge différée utilisateur en cours (deletionRequested/scheduledDeletion future).
        if (user.scheduledDeletion && user.scheduledDeletion > now) { skipped++; continue; }

        // 4. Profils non-ACTIFS : purge seulement si TOUS les profils sont en fin de grace.
        //    Un profil avec scheduledDeletion nulle (banni, archivage manuel) n'est jamais purgé.
        const profiles = user.profiles;
        if (profiles.length > 0) {
            const allGraceElapsed = profiles.every(p =>
                p.scheduledDeletion !== null && p.scheduledDeletion < now
            );
            if (!allGraceElapsed) { skipped++; continue; }
        }

        try {
            // 4bis. Fermer le contenu encore publié (embeds Discord compris) — idempotent,
            // best-effort : la passe de synchro a normalement déjà fait le travail, mais une
            // purge peut précéder une synchro (bot retiré, guilde injoignable).
            for (const profile of user.profiles) {
                await closeMemberPublishedContent(
                    profile.guild.discordGuildId,
                    profile.id,
                    user.id,
                    "ORPHAN_RETENTION"
                ).catch(() => null);
            }

            // 4ter. Les **événements** ne partent pas avec le compte : ils sont annulés s'ils
            // étaient ouverts, débarrassés du nom du capitaine, puis rattachés au compte
            // technique « Ancien membre » (option C du 30/10/2026).
            await reattributeGuildEvents(user.id);

            await db.user.delete({ where: { id: user.id } });
            deleted++;
        } catch (e) {
            logger.warn(`[AccountRetention] Échec purge user ${user.id}:`, e);
            skipped++;
        }
    }

    // 📝 Audit (non bloquant — le cron n'a pas de session).
    try {
        await createGodAuditLog({
            action: "GOD_USER_PLATFORM_BAN",
            targetType: "SYSTEM_GOD",
            metadata: {
                operation: "ORPHAN_ACCOUNT_RETENTION",
                retentionDays,
                scanned,
                deleted,
                skipped,
                source,
            },
        });
    } catch {
        // Non bloquant
    }

    logger.info(`[AccountRetention] source=${source} scanned=${scanned} deleted=${deleted} skipped=${skipped} (${retentionDays}j)`);
    return { deleted, scanned, skipped };
}
