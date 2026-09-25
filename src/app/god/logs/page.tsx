import { Suspense } from "react";
import { redirect } from "next/navigation";
import { MonitorSmartphone } from "lucide-react";
import { isSuperAdmin, getRecentAccessAttempts } from "@/server/actions/super-admin-actions";
import { getGlobalAuditLogs, getGodAccessLogs } from "@/server/actions/audit-actions";
import { listGodMarketAuditLogs, listGodMarketGuilds } from "@/server/actions/god-market-actions";
import { LogsTabs } from "./logs-tabs";
import { AUDIT_RETENTION_DAYS } from "@/lib/audit-retention-policy";
import { getGodAccessDailyStats, type GodAccessStats } from "@/server/god-access-stats";
import { GodBadge, GodLoadingSkeleton, GodSectionHeader } from "@/app/god/ui";
import type { GodLogRow } from "./log-viewer";

/**
 * `/god/logs` — **l'unique porte** des journaux (G11 · A9 · A10 · A11).
 *
 * L'ancien onglet `?tab=security` est **redirigé** ici depuis `/god` (des liens
 * existaient : menu God, favoris du staff) et l'entrée de nav a été supprimée :
 * deux écrans affichaient le même `AuditLog`.
 *
 * Lecture **super-admin** fail-closed. Les 90 j (plateforme) / 30 j (guilde) sont
 * la politique de rétention unique (`@/lib/audit-retention-policy`) — la purge vit
 * dans le cron `cleanup-logs`, jamais dans cette page.
 */
export default async function GodLogsPage() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) redirect("/");

    // Cinq journaux distincts, tous bornés (50 lignes) et tous lus **côté serveur** :
    // plateforme (actions God) · guilde (lecture seule) · accès refusés · Marché ·
    // accès délégués (`GodAccessLog`, écrit depuis l'origine et jamais lu — A10).
    const [
        platformRes,
        guildRes,
        attemptsRes,
        marketLogsRes,
        marketGuildsRes,
        delegatedRes,
        accessStats,
    ] = await Promise.all([
        getGlobalAuditLogs({ limit: 50, scope: "platform" }),
        getGlobalAuditLogs({ limit: 50, scope: "guild" }),
        getRecentAccessAttempts(50),
        listGodMarketAuditLogs({ limit: 50 }),
        listGodMarketGuilds(),
        getGodAccessLogs({ limit: 50 }),
        getGodAccessDailyStats(),
    ]);

    // 🧹 La purge n'est PLUS déclenchée ici : `/god/logs` n'est pas un cron.
    // (Avant l'audit du 24/09, chaque visite lançait `cleanupGlobalAuditLogs()` en
    // fire-and-forget — un `deleteMany` global sans lot, via une server action sans garde.)

    return (
        <div className="space-y-6 py-8">
            <div className="flex flex-col gap-4">
                <GodBadge variant="success">Journal &amp; accès</GodBadge>
                <GodSectionHeader
                    title="Journaux de la plateforme"
                    description="Une seule entrée : actions God, journaux des guildes (lecture seule), connexions refusées, audit du Marché et accès délégués. L'ancien onglet « Sécurité & Logs » pointe désormais ici."
                />
                <p className="max-w-3xl text-caption text-muted-foreground">
                    Rétention : <span className="text-foreground">{AUDIT_RETENTION_DAYS.GOD} jours</span> pour les actions
                    plateforme (God) et <span className="text-foreground">{AUDIT_RETENTION_DAYS.GUILD} jours</span> pour les
                    journaux de guilde — purge quotidienne par le cron <code>cleanup-logs</code>. Filtres, période et
                    pagination sont appliqués <span className="text-foreground">en base</span>, jamais en mémoire.
                </p>
            </div>

            <GodAccessStatsStrip stats={accessStats} />

            <Suspense fallback={<GodLoadingSkeleton rows={6} />}>
                <LogsTabs
                    platformLogs={(platformRes.data?.logs ?? []) as GodLogRow[]}
                    platformTotal={platformRes.data?.total ?? 0}
                    platformSecurityCount={platformRes.data?.securityCount ?? 0}
                    guildLogs={(guildRes.data?.logs ?? []) as GodLogRow[]}
                    guildTotal={guildRes.data?.total ?? 0}
                    guildSecurityCount={guildRes.data?.securityCount ?? 0}
                    guilds={marketGuildsRes.success ? marketGuildsRes.data : []}
                    attempts={attemptsRes.data?.attempts || []}
                    attemptsTotal={attemptsRes.data?.total || 0}
                    marketLogs={marketLogsRes.success ? marketLogsRes.data : []}
                    delegatedLogs={delegatedRes.data?.logs ?? []}
                    delegatedTotal={delegatedRes.data?.total ?? 0}
                />
            </Suspense>
        </div>
    );
}

/**
 * A9 — compteur **agrégé** des accès God : une barre par jour (UTC), la source
 * étant la **session** (`GodSessionLog`, 1 ligne par session ouverte), et non les
 * lignes `GOD_DASHBOARD_ACCESS` qui doublonnaient chaque visite (mesure du 25/09 :
 * 749 lignes, soit 72 % des 1 033 lignes d'`AuditLog`).
 *
 * La barre est un **ratio** (hauteur relative au jour le plus chargé) : aucun
 * chiffre n'est inventé, le `title` donne la valeur exacte et le libellé du jour.
 */
function GodAccessStatsStrip({ stats }: { stats: GodAccessStats }) {
    if (stats.days.length === 0) return null;
    const busiest = Math.max(...stats.days.map((day) => day.count), 1);

    return (
        <div className="rounded-3xl border border-border bg-surface/40 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-body-sm font-semibold text-foreground">
                    <MonitorSmartphone className="h-4 w-4 text-muted-foreground" />
                    Accès God — {stats.days.length} derniers jours
                </span>
                <span className="text-caption text-muted-foreground">
                    <span className="font-bold tabular-nums text-foreground">{stats.total}</span> session(s) ·{" "}
                    <span className="tabular-nums">{stats.active}</span> active(s) · plus aucune ligne de journal par visite
                </span>
            </div>

            <ul className="mt-3 flex items-end gap-1">
                {stats.days.map((day) => (
                    <li key={day.key} className="flex-1" title={`${day.label} : ${day.count} session(s)`}>
                        <div
                            className="w-full rounded-sm bg-info/40"
                            style={{ height: `${Math.round((day.count / busiest) * 36) + 2}px` }}
                        />
                    </li>
                ))}
            </ul>

            <p className="mt-2 text-caption text-muted-foreground">
                Source : sessions God (<code>GodSessionLog</code>) — le détail jour par jour remplace les lignes
                « GOD_DASHBOARD_ACCESS » qui doublonnaient chaque visite (historique conservé, purge à 90 j).
            </p>
        </div>
    );
}
