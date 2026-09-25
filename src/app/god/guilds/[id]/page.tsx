import { redirect, notFound } from "next/navigation";
import { isSuperAdmin, canAccessBrick } from "@/server/actions/super-admin-actions";
import { getGuildMembersForGod } from "@/server/actions/god-lifecycle-actions";
import { MemberManagementTable } from "@/components/admin/member-management-table";
import { Shield, ChevronLeft, Users } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/prisma";
import { GodCard } from "@/app/god/ui";
import { logger } from "@/lib/logger";
import { GodGuildTabs } from "./god-guild-tabs";

interface GodGuildDetailsPageProps {
    params: Promise<{ id: string }>;
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
            welcomeBadgeName: true,
            rolesMapping: true,
            usersMapping: true,
        }
    });

    if (!guild) {
        return notFound();
    }

    const members = await getGuildMembersForGod(guildId);

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

    return (
        <div className="space-y-8 py-8">
            {/* Header */}
            <div className="flex flex-col gap-6">
                <Link
                    href="/god"
                    className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest group"
                >
                    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Retour au Panneau de Contrôle
                </Link>

                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                        <div className="relative group/icon">
                            <div className="absolute -inset-4 bg-violet-500/20 blur-2xl rounded-full opacity-0 group-hover/icon:opacity-100 transition-opacity" />
                            {guild.iconUrl && guild.iconUrl.length > 5 ? (
                                <div className="relative w-24 h-24 rounded-3xl overflow-hidden border-2 border-white/10 bg-zinc-900 shadow-2xl">
                                    <img
                                        src={`https://cdn.discordapp.com/icons/${guild.discordGuildId}/${guild.iconUrl}.png?size=256`}
                                        alt=""
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                                </div>
                            ) : (
                                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-4xl font-black text-white border-2 border-white/10 shadow-2xl relative z-10 uppercase">
                                    {guild.name[0]}
                                </div>
                            )}
                        </div>

                        <div className="space-y-1">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-caption font-black text-violet-400 uppercase tracking-widest">
                                <Shield className="w-3 h-3" />
                                Inspection God Mode
                            </div>
                            <h1 className="text-4xl font-black text-white tracking-tighter">
                                {guild.name}
                            </h1>
                            <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest">
                                {guild.discordGuildId}
                            </p>
                        </div>
                    </div>

                    <div className="px-6 py-4 bg-zinc-900/50 border border-white/5 rounded-2xl text-center min-w-[140px]">
                        <div className="text-2xl font-black text-white tracking-tighter">{members.members.length}</div>
                        <div className="text-caption font-black text-zinc-600 uppercase tracking-widest">Membres Totaux</div>
                    </div>
                </div>
            </div>

            {/* Roster Table - Reusing the Admin component for consistency */}
            <GodCard className="p-1 shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-sm font-black text-zinc-500 uppercase tracking-widest flex items-center gap-3">
                        <Users className="w-4 h-4 text-violet-500" />
                        Registre des Citoyens
                    </h3>
                </div>
                <div className="p-6">
                    <MemberManagementTable
                        initialMembers={members.members as any}
                        guildId={guild.discordGuildId}
                        welcomeBadgeName={guild.welcomeBadgeName}
                        isSuperAdmin={isAdmin}
                        ownerId={members.ownerId}
                    />
                </div>
            </GodCard>

            <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-6">
                <p className="text-xs text-amber-500/80 font-medium leading-relaxed">
                    <span className="font-black uppercase tracking-widest mr-2">Note :</span>
                    {isAdmin
                        ? "En tant que Super-Admin, vous pouvez modifier les statuts des membres directement. Toute action effectuée ici sera enregistrée dans le journal d'audit de la guilde avec votre identité."
                        : "Vous consultez ce roster en lecture seule (accès sous-god). Toute action destructrice est masquée."}
                </p>
            </div>

            {/* Super-gestion des modules (§9) + journaux + accès : ONGLETS (audit 24/09) */}
            <GodGuildTabs
                logsBadge={logsStats?.auditLogs ?? 0}
                modules={isAdmin ? (
                    <GodGuildModulesSection discordGuildId={guild.discordGuildId} />
                ) : (
                    <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-6">
                        <p className="text-xs text-amber-500/80 font-medium leading-relaxed">
                            <span className="font-black uppercase tracking-widest mr-2">Lecture seule :</span>
                            les verrous de modules sont réservés au staff plateforme. Un sous-god voit ici
                            l&apos;état des accès et des journaux, jamais les actions.
                        </p>
                    </div>
                )}
                logs={<GodGuildLogsSection
                    discordGuildId={guild.discordGuildId}
                    guildName={guild.name}
                    stats={logsStats}
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
    guildName,
    stats,
}: {
    discordGuildId: string;
    guildName: string;
    stats: { serviceLogs: number; auditLogs: number } | null;
}) {
    const { AuditLogsClient } = await import("@/app/dashboard/[guildId]/admin/logs/_components/audit-logs-client");
    const { getAuditLogs } = await import("@/server/actions/audit-actions");
    const { fetchGuildRoles } = await import("@/server/discord");
    const { getUserContext } = await import("@/server/actions/user-actions");

    // Garde de lecture : `getAuditLogs` exige `canViewAuditLogs` (God inclus). Un
    // sous-god sans rôle de guilde obtient un état vide explicite, jamais une erreur.
    const ctx = await getUserContext(discordGuildId).catch(() => null);
    if (!ctx?.canViewAuditLogs) {
        return (
            <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-6">
                <p className="text-xs text-amber-500/80 font-medium leading-relaxed">
                    <span className="font-black uppercase tracking-widest mr-2">Accès :</span>
                    ce compte n&apos;a pas la permission de lire le journal de cette guilde.
                </p>
            </div>
        );
    }

    const [logsResult, roles] = await Promise.all([
        getAuditLogs(discordGuildId, { limit: 20, page: 1 }),
        fetchGuildRoles(discordGuildId).catch(() => [] as Awaited<ReturnType<typeof fetchGuildRoles>>),
    ]);
    const logs = logsResult.success && logsResult.data ? logsResult.data.logs : [];
    const total = logsResult.success && logsResult.data ? logsResult.data.total : 0;

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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-zinc-900/20 border border-white/5 rounded-2xl p-4">
                    <p className="text-caption font-black text-zinc-500 uppercase tracking-widest">Audit (30 j)</p>
                    <p className="text-2xl font-black text-white mt-1 tabular-nums">{stats?.auditLogs ?? 0}</p>
                </div>
                <div className="bg-zinc-900/20 border border-white/5 rounded-2xl p-4">
                    <p className="text-caption font-black text-zinc-500 uppercase tracking-widest">Activité services (30 j)</p>
                    <p className="text-2xl font-black text-white mt-1 tabular-nums">{stats?.serviceLogs ?? 0}</p>
                </div>
                <div className="bg-zinc-900/20 border border-white/5 rounded-2xl p-4">
                    <p className="text-caption font-black text-zinc-500 uppercase tracking-widest">Guilde</p>
                    <p className="text-sm font-bold text-zinc-300 mt-2 truncate" title={guildName}>{guildName}</p>
                </div>
            </div>

            <AuditLogsClient
                guildId={discordGuildId}
                initialLogs={serializedLogs}
                initialTotal={total}
                roleNames={roleNames}
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
