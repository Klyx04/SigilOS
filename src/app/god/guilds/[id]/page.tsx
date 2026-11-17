import { redirect, notFound } from "next/navigation";
import { isSuperAdmin, canAccessBrick } from "@/server/actions/super-admin-actions";
import { getGuildMembersForGod } from "@/server/actions/god-lifecycle-actions";
import { MemberManagementTable } from "@/components/admin/member-management-table";
import { ChevronLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/prisma";
import { GodBadge, GodCard } from "@/app/god/ui";
import { getGodRoute } from "@/lib/god-route";
import { formatDofusLevel, toTotalDofusLevel } from "@/lib/dofus-level";
import { buildAnkamaLadderUrl, resolveGuildOwnerLookup } from "@/lib/god-guild-owner";
import { resolveOnboardingOrigin } from "@/lib/onboarding-gating";
import { godStatusTitle } from "@/lib/god-status-glossary";
import { GodGuildTabs } from "./god-guild-tabs";

interface GodGuildDetailsPageProps {
    params: Promise<{ id: string }>;
}

/** Chiffre mesuré de la fiche : un libellé, une valeur, aucun faux pourcentage. */
function GodGuildStat({ label, value }: { label: string; value: number }) {
    return (
        <div className="min-w-[110px] rounded-xl border border-border bg-surface/10 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</p>
        </div>
    );
}

export default async function GodGuildDetailsPage({ params }: GodGuildDetailsPageProps) {
    const isAdmin = await isSuperAdmin();
    // #108 — un sous-god avec la brique "guilds" accède à l'inspection (lecture seule :
    // le tableau est rendu avec isSuperAdmin=false pour masquer les actions destructives).
    const isGuildBrick = isAdmin ? true : await canAccessBrick("guilds");

    if (!isAdmin && !isGuildBrick) {
        redirect("/");
    }

    const { id: guildId } = await params;

    // Fetch individual guild config for the header
    const guild = await db.guildConfig.findUnique({
        where: { id: guildId },
        select: {
            name: true,
            discordGuildId: true,
            iconUrl: true,
            isActive: true,
            deletedAt: true,
            createdAt: true,
            dofusServerId: true,
            dofusServerName: true,
            ownerId: true,
            welcomeBadgeName: true,
            rolesMapping: true,
            usersMapping: true,
        }
    });

    if (!guild) {
        return notFound();
    }

    // Origine de la guilde : une phrase complète (G1), jamais un badge « Autonome » nu.
    const allowedGuild = await db.allowedGuild.findUnique({
        where: { discordGuildId: guild.discordGuildId },
        select: { addedBy: true, tier: true, notes: true },
    });
    const origin = resolveOnboardingOrigin(allowedGuild ?? null);
    // G1 — **une phrase complète, datée**, jamais un badge « Autonome » nu.
    const createdAtLabel = new Date(guild.createdAt).toLocaleDateString("fr-FR");
    const originPhrase =
        origin.tag === "AUTONOME"
            ? `Installée en autonomie le ${createdAtLabel} — aucune approbation humaine requise.`
            : origin.tag === "VIP"
                ? `Installée via un ticket de support le ${createdAtLabel} — accompagnement humain.`
                : `Pré-approuvée par le staff le ${createdAtLabel} — whitelist avant déploiement.`;
    const statusTitle = guild.deletedAt
        ? godStatusTitle("SUPPRIMEE")
        : !guild.isActive
            ? godStatusTitle("GELEE")
            : "Accès autorisé et dashboard ouvert.";

    // ── Propriétaire (debug2.md) : ownerId peut être un snowflake ou un UUID.
    const ownerLookup = resolveGuildOwnerLookup(guild.ownerId);
    const ownerSelect = {
        name: true,
        image: true,
        profiles: {
            where: { guildId },
            select: { pseudoDofus: true, classe: true, dofusLevel: true, achievementPoints: true, totalXp: true },
            take: 1,
        },
        publicProfile: {
            select: { pseudoDofus: true, classe: true, dofusLevel: true, successPoints: true, dofusServerId: true, totalXp: true },
        },
    } as const;
    const ownerUser = ownerLookup
        ? ownerLookup.by === "user"
            ? await db.user.findUnique({ where: { id: ownerLookup.value }, select: ownerSelect })
            : await db.user.findFirst({
                  where: { accounts: { some: { provider: "discord", providerAccountId: ownerLookup.value } } },
                  select: ownerSelect,
              })
        : null;
    const ownerProfile = ownerUser?.profiles[0] ?? null;
    const ownerPublic = ownerUser?.publicProfile ?? null;
    const ownerPseudo = ownerProfile?.pseudoDofus ?? ownerPublic?.pseudoDofus ?? null;
    const ownerServerId =
        Number.parseInt(guild.dofusServerId ?? "", 10) || ownerPublic?.dofusServerId || null;
    const owner = ownerUser
        ? {
              name: ownerUser.name,
              image: ownerUser.image,
              pseudo: ownerPseudo,
              classe: ownerProfile?.classe ?? ownerPublic?.classe ?? null,
              level: toTotalDofusLevel(
                  ownerProfile?.dofusLevel ?? ownerPublic?.dofusLevel ?? null,
                  ownerProfile?.totalXp ?? ownerPublic?.totalXp ?? null,
              ),
              successPoints: ownerProfile?.achievementPoints ?? ownerPublic?.successPoints ?? null,
              ladderUrl: buildAnkamaLadderUrl(ownerPseudo, ownerServerId),
          }
        : null;

    const members = await getGuildMembersForGod(guildId);

    // Refus **propre** de l'action (aucune donnée lue, fail-closed) : on affiche un écran de
    // refus honnête au lieu de laisser une exception faire tomber toute la fiche
    // (constat du 12/10/2026 : `throw` ⇒ « Application error » + Issue Sentry).
    if (!members.ok) {
        return (
            <div className="space-y-6 py-20">
                <div
                    role="alert"
                    className="mx-auto max-w-xl rounded-xl border border-warning/30 bg-warning/5 p-6 text-center"
                >
                    <p className="text-sm font-semibold text-warning">Roster masqué</p>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{members.error}</p>
                </div>
                <Link
                    href={`${getGodRoute()}?tab=guilds`}
                    className="mx-auto block w-fit text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                    Retour aux guildes
                </Link>
            </div>
        );
    }

    // Données des onglets Logs / Accès & RBAC (audit du 24/09 : aucune des deux
    // n'existait). Best-effort : une API Discord indisponible ne doit pas casser
    // la fiche — on affiche alors des listes vides explicites.
    const { fetchGuildRoles } = await import("@/server/discord");
    const { getGuildLogsStats } = await import("@/server/actions/storage-actions");
    const { getRbacUsersMappingEnabled } = await import("@/lib/platform-rbac");
    const { GodsGuildAccessPanel } = await import("./god-guild-access-panel");

    const [discordRoles, rbacUsersMappingEnabled] = await Promise.all([
        fetchGuildRoles(guild.discordGuildId).catch(() => [] as { id: string; name: string }[]),
        getRbacUsersMappingEnabled().catch(() => true),
    ]);

    const roleNames: Record<string, string> = {};
    for (const role of discordRoles) roleNames[role.id] = role.name;

    // `getGuildLogsStats` est réservé super-admin (fail-closed) : un sous-god n'a
    // pas de compteur, il garde les journaux.
    let logsStats: { serviceLogs: number; auditLogs: number } | null = null;
    if (isAdmin) {
        const statsRes = await getGuildLogsStats().catch(() => null);
        const row = statsRes?.success ? statsRes.data?.rows.find((r) => r.guildId === guildId) : undefined;
        logsStats = row ? { serviceLogs: row.serviceLogs, auditLogs: row.auditLogs } : null;
    }

    const godRoute = getGodRoute();
    const guildActive = guild.isActive && !guild.deletedAt;

    return (
        <div className="space-y-6 py-8">
            <Link
                href={`${godRoute}?tab=guilds`}
                className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Guildes
            </Link>

            <GodCard className="p-6">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                        {guild.iconUrl && guild.iconUrl.length > 5 ? (
                            <img
                                src={`https://cdn.discordapp.com/icons/${guild.discordGuildId}/${guild.iconUrl}.png?size=128`}
                                alt=""
                                className="h-16 w-16 shrink-0 rounded-xl border border-border bg-elevated object-cover"
                            />
                        ) : (
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-border bg-elevated text-xl font-semibold uppercase text-foreground">
                                {guild.name[0]}
                            </div>
                        )}

                        <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-2xl font-semibold tracking-tight text-foreground">{guild.name}</h1>
                                <GodBadge variant={guildActive ? "success" : "danger"} title={statusTitle}>
                                    {guild.deletedAt ? "Supprimée" : guild.isActive ? "Active" : "Gelée"}
                                </GodBadge>
                                {!isAdmin ? <GodBadge variant="info" title="Consultation autorisée en lecture seule (sous-God).">Lecture seule</GodBadge> : null}
                            </div>
                            <p className="font-mono text-xs text-muted-foreground">{guild.discordGuildId}</p>
                            <p className="text-xs text-muted-foreground">
                                {originPhrase}
                                {guild.dofusServerName ? ` Serveur ${guild.dofusServerName}.` : ""}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <GodGuildStat label="Membres" value={members.members.length} />
                        <GodGuildStat label="Audit 30 j" value={logsStats?.auditLogs ?? 0} />
                        <GodGuildStat label="Services 30 j" value={logsStats?.serviceLogs ?? 0} />
                    </div>
                </div>
            </GodCard>

            <GodGuildTabs
                overview={
                    <div className="space-y-4">
                        <GodCard className="p-5">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex min-w-0 items-center gap-3">
                                    {owner?.image ? (
                                        <img
                                            src={owner.image}
                                            alt=""
                                            className="h-10 w-10 rounded-full border border-border bg-elevated object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-elevated text-sm font-semibold text-muted-foreground">
                                            {guild.name[0]}
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-foreground">
                                            {owner?.name ?? "Propriétaire non résolu"}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {owner?.pseudo
                                                ? `${owner.pseudo} · ${owner.classe ?? "classe inconnue"} · ${owner.level !== null ? formatDofusLevel(owner.level) : "niveau non synchronisé"}`
                                                : "Aucun profil Dofus lié"}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                    {typeof owner?.successPoints === "number" ? (
                                        <span className="tabular-nums">{owner.successPoints} points de succès</span>
                                    ) : null}
                                    {owner?.ladderUrl ? (
                                        <a
                                            href={owner.ladderUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 font-medium text-foreground transition-colors hover:text-accent"
                                        >
                                            Profil ladder
                                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                        </a>
                                    ) : null}
                                </div>
                            </div>
                        </GodCard>

                        <GodCard className="overflow-hidden">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
                            <div>
                                <h2 className="text-sm font-semibold text-foreground">Registre des membres</h2>
                                <p className="text-xs text-muted-foreground">
                                    {isAdmin
                                        ? "Les actions sont journalisées avec ton identité."
                                        : "Consultation en lecture seule."}
                                </p>
                            </div>
                            <GodBadge variant="info">{members.members.length}</GodBadge>
                        </div>
                        <div className="p-4">
                            <MemberManagementTable
                                initialMembers={members.members as any}
                                guildId={guild.discordGuildId}
                                welcomeBadgeName={guild.welcomeBadgeName}
                                isSuperAdmin={isAdmin}
                                ownerId={members.ownerId}
                                showIds={false}
                                dofusServerId={Number.parseInt(guild.dofusServerId ?? "", 10) || null}
                            />
                        </div>
                        </GodCard>
                    </div>
                }
                logsBadge={logsStats?.auditLogs ?? 0}
                modules={isAdmin ? (
                    <GodGuildModulesSection discordGuildId={guild.discordGuildId} />
                ) : (
                    <div className="rounded-xl border border-border bg-surface/10 p-5">
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            <span className="mr-2 font-semibold text-foreground">Lecture seule.</span>
                            Les verrous de modules sont réservés au staff plateforme. Un sous-god voit ici
                            l&apos;état des accès et des journaux, jamais les actions.
                        </p>
                    </div>
                )}
                logs={<GodGuildLogsSection
                    discordGuildId={guild.discordGuildId}
                    guildConfigId={guildId}
                    guildName={guild.name}
                    stats={logsStats}
                    isGod={isAdmin}
                />}
                access={<GodsGuildAccessPanel
                    ownerId={members.ownerId ?? null}
                    rolesMapping={(guild.rolesMapping as Record<string, string[]>) ?? {}}
                    usersMapping={(guild.usersMapping as Record<string, string[]>) ?? {}}
                    discordRoles={discordRoles}
                    rbacUsersMappingEnabled={rbacUsersMappingEnabled}
                    roleNames={roleNames}
                />}
            />
        </div>
    );
}

/**
 * Onglet **Logs** d'une guilde côté God — réutilise le rendu **riche** de la guilde
 * (`AuditLogsClient` : `changeDetail`, `PermissionChangesDisplay`, pseudos,
 * filtres action/acteur/date, pagination) au lieu du `JSON.stringify` tronqué du
 * viewer God (audit du 24/09 : « richesse guilde vs pauvreté God »).
 */
async function GodGuildLogsSection({
    discordGuildId,
    guildConfigId,
    guildName,
    stats,
    isGod,
}: {
    discordGuildId: string;
    /** Id **interne** de la guilde (`GuildConfig.id`) — clé du mode God (A5). */
    guildConfigId: string;
    guildName: string;
    stats: { serviceLogs: number; auditLogs: number } | null;
    /** Super-admin : il lit **toujours** (A5), jamais via le RBAC de guilde. */
    isGod: boolean;
}) {
    const { AuditLogsClient } = await import("@/app/dashboard/[guildId]/admin/logs/_components/audit-logs-client");
    const { getAuditLogs, getGlobalAuditLogs } = await import("@/server/actions/audit-actions");
    const { fetchGuildRoles } = await import("@/server/discord");

    // 🛡️ A5 (verbatim 9) — « je suis le dev du produit, je vois tout ». Le God lit par
    // `isSuperAdmin()`, **jamais** par `getUserContext().canViewAuditLogs` : ce dernier
    // répond `false` pour un God qui n'est pas membre du serveur Discord — c'est la cause
    // racine du « ce compte n'a pas la permission de lire le journal de cette guilde »
    // (capture *Kamas NOT Found*) affiché sous un en-tête « INSPECTION GOD MODE ».
    const [result, roles] = await Promise.all([
        isGod
            ? getGlobalAuditLogs({ guildConfigId, scope: "guild", limit: 20, page: 1 })
            : getAuditLogs(discordGuildId, { limit: 20, page: 1 }),
        fetchGuildRoles(discordGuildId).catch(() => [] as Awaited<ReturnType<typeof fetchGuildRoles>>),
    ]);

    // 🔴 A5 — « erreur de chargement » et « accès refusé » ne portent **jamais** le même
    // texte : un God ne peut pas lire un refus de droits, un sous-god sans droit lit un
    // refus explicite, et un incident technique affiche sa cause.
    if (!result.success || !result.data) {
        const isRefusal = !isGod && result.error === "Accès non autorisé";

        return isRefusal ? (
            <div role="status" className="rounded-xl border border-warning/30 bg-warning/5 p-6">
                <p className="text-body-sm font-semibold text-warning">Accès refusé</p>
                <p className="mt-1 text-caption text-warning/80">
                    Ton accès de guilde ne couvre pas le journal de cette guilde (droit « consulter les journaux »
                    absent).
                </p>
            </div>
        ) : (
            <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-6">
                <p className="text-body-sm font-semibold text-danger">Erreur de chargement du journal</p>
                <p className="mt-1 text-caption text-danger/80">
                    La lecture a échoué ({result.error ?? "cause inconnue"}) — ce n&apos;est pas un refus de droits.
                    Réessaie, puis vérifie l&apos;état de la base.
                </p>
            </div>
        );
    }

    const logs = result.data.logs;
    const total = result.data.total;

    const roleNames: Record<string, string> = {};
    for (const role of roles) roleNames[role.id] = role.name;

    // Dates + BigInt (champs Json Prisma) sérialisés pour le composant client —
    // même conversion que la page guilde, l'API de pagination est la même.
    const stringify = (val: unknown) =>
        val ? JSON.parse(JSON.stringify(val, (_k, v) => (typeof v === "bigint" ? v.toString() : v))) : val;
    const serializedLogs = logs.map((log) => ({
        ...log,
        createdAt: (log.createdAt as Date).toISOString(),
        metadata: stringify(log.metadata),
        oldValue: stringify(log.oldValue),
        newValue: stringify(log.newValue),
    }));

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-surface/10 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Audit (30 j)</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{stats?.auditLogs ?? 0}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface/10 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Activité services (30 j)</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{stats?.serviceLogs ?? 0}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface/10 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Guilde</p>
                    <p className="mt-2 truncate text-sm font-medium text-foreground" title={guildName}>{guildName}</p>
                </div>
            </div>

            <AuditLogsClient
                guildId={discordGuildId}
                initialLogs={serializedLogs}
                initialTotal={total}
                roleNames={roleNames}
                godGuildConfigId={isGod ? guildConfigId : undefined}
            />
        </div>
    );
}

async function GodGuildModulesSection({ discordGuildId }: { discordGuildId: string }) {
    const { getGuildModules, getModuleGodLocks } = await import("@/server/actions/module-actions");
    const { GodGuildModulesClient } = await import("./god-guild-modules-client");
    const [modules, locks] = await Promise.all([
        getGuildModules(discordGuildId),
        getModuleGodLocks(discordGuildId),
    ]);
    return (
        <GodGuildModulesClient
            discordGuildId={discordGuildId}
            initialModules={modules}
            initialLocks={locks}
        />
    );
}
