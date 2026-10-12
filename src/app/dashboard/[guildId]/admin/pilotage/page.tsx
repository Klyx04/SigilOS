import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { logAdminAccessDenied } from "@/server/actions/audit-actions";
import { getGuildModules, getGuildModuleConfig } from "@/server/actions/module-actions";
import type { GuildModulesState, ModuleKey } from "@/lib/module-types";
import type { ModuleLockState } from "@/lib/module-lock";
import { getPermissionsHiddenByModules } from "@/lib/permissions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { ModuleHelpActions } from "@/components/doc/module-help-actions";
import { GovernanceWidget } from "@/components/admin/governance-widget";
import { PilotageCommandsSection } from "./pilotage-commands-section";
import { PilotageDiscordDiagnostic } from "./pilotage-discord-diagnostic";
import { ModulesClient } from "../modules/_components/modules-client";
import { PermissionsManager } from "../_components/permissions-manager";
import { CheckCircle2, XCircle, Rocket, LayoutDashboard, Puzzle, Shield, Terminal, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
    params: Promise<{ guildId: string }>;
    searchParams?: Promise<{ tab?: string }>;
};

/**
 * Pilotage — LA page dédiée owner/admin Discord natif (pas de délégués).
 * Regroupe ce qui pilote la guilde : état du déploiement, toggles des modules,
 * matrice RBAC complète. Les délégués `system:rbac` gardent UNIQUEMENT
 * `/admin/permissions` (succession) ; tout le reste du pilotage est ici.
 */
export default async function PilotagePage({ params, searchParams }: Props) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;
    const tab = (await searchParams)?.tab;
    const activeTab: "etat" | "modules" | "acces" | "commandes" | "diagnostic" =
        tab === "modules" || tab === "acces" || tab === "commandes" || tab === "diagnostic" ? tab : "etat";

    const user = await getUserContext(guildId);
    if (!user.isDiscordAdmin) {
        await logAdminAccessDenied(guildId, "/admin/pilotage");
        return <AccessDenied />;
    }

    const { db } = await import("@/lib/prisma");
    const { verifyGuildAccessibility } = await import("@/server/discord");
    const { isRbacConfigured } = await import("@/lib/onboarding-gating");
    const { getGettingStartedProgress } = await import("@/server/actions/onboarding-actions");

    const [config, botPresent, modules, moduleConfig, progress] = await Promise.all([
        db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: {
                id: true, name: true, dofusServerId: true,
                rolesMapping: true, usersMapping: true,
            },
        }).catch(() => null),
        verifyGuildAccessibility(guildId).catch(() => false),
        getGuildModules(guildId).catch(() => null),
        getGuildModuleConfig(guildId).catch(() => null),
        getGettingStartedProgress(guildId).catch(() => null),
    ]);

    if (!config) {
        return (
            <div className="space-y-6 pb-12">
                <UnifiedModuleHeader
                    title="Pilotage"
                    description="Console réservée aux administrateurs Discord natifs."
                    backHref={`/dashboard/${guildId}/admin`}
                />
                <div className="p-6 rounded-2xl border border-warning/30 bg-warning/10">
                    <p className="text-sm font-bold text-warning">
                        Guilde non déployée — terminez d&apos;abord le déploiement depuis le portail.
                    </p>
                    <Link
                        href="/dashboard"
                        className="inline-flex mt-3 px-4 py-2 rounded-xl bg-warning text-warning-foreground text-xs font-black uppercase tracking-wider"
                    >
                        Retour au portail
                    </Link>
                </div>
            </div>
        );
    }

    const rolesMapping = (config.rolesMapping || {}) as Record<string, string[]>;
    const usersMapping = (config.usersMapping || {}) as Record<string, string[]>;
    const rbacOk = isRbacConfigured(rolesMapping, guildId);
    const modulesState = (modules || {}) as unknown as Record<string, boolean | undefined>;
    const hiddenPermissions = getPermissionsHiddenByModules(modulesState);

    const checks = [
        { label: "Bot présent sur le serveur", ok: botPresent },
        { label: "Serveur de jeu configuré", ok: !!config.dofusServerId },
        { label: "Rôle d'accès dashboard mappé", ok: rbacOk },
    ];

    // Données matrice (même source que /admin/permissions — pas de divergence).
    const { fetchGuildRoles } = await import("@/server/discord");
    const { getGuildMembers } = await import("@/server/actions/user-actions");
    const { getRbacUsersMappingEnabled } = await import("@/lib/platform-rbac");
    const [roles, membersData, rbacUsersMappingEnabled] = await Promise.all([
        fetchGuildRoles(guildId).catch(() => [] as any[]),
        getGuildMembers(guildId).catch(() => ({ members: [] as any[] })),
        getRbacUsersMappingEnabled().catch(() => true),
    ]);

    return (
        <div className="space-y-10 pb-12">
            <div data-tour="admin-pilotage-header">
                <UnifiedModuleHeader
                    title="Pilotage"
                    description={`Console propriétaire de ${config.name} — natifs Discord uniquement.`}
                    backHref={`/dashboard/${guildId}/admin`}
                    actions={<ModuleHelpActions docSlug="admin-pilotage" docTitle="Pilotage" tourPhase="adminPilotage" />}
                />
            </div>

            {/* ── Onglets locaux : chaque onglet ne rend QUE son contenu ── */}
            {(() => {
                const tabs = [
                    { id: "etat" as const, label: "État & Gouvernance", icon: LayoutDashboard, href: `/dashboard/${guildId}/admin/pilotage?tab=etat` },
                    { id: "modules" as const, label: "Modules", icon: Puzzle, href: `/dashboard/${guildId}/admin/pilotage?tab=modules` },
                    { id: "acces" as const, label: "Accès & Rôles", icon: Shield, href: `/dashboard/${guildId}/admin/pilotage?tab=acces` },
                    { id: "commandes" as const, label: "Commandes", icon: Terminal, href: `/dashboard/${guildId}/admin/pilotage?tab=commandes` },
                    { id: "diagnostic" as const, label: "Diagnostic Discord", icon: Activity, href: `/dashboard/${guildId}/admin/pilotage?tab=diagnostic` },
                ];
                return (
                    <nav aria-label="Pilotage" className="flex items-center gap-1.5 flex-wrap">
                        {tabs.map((t) => (
                            <Link
                                key={t.id}
                                href={t.href}
                                aria-current={activeTab === t.id ? "page" : undefined}
                                className={cn(
                                    "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-colors",
                                    activeTab === t.id
                                        ? "bg-success/15 border-success/40 text-success"
                                        : "bg-surface border-border text-muted-foreground hover:text-foreground hover:border-border-strong"
                                )}
                            >
                                <t.icon className="w-3.5 h-3.5" />
                                {t.label}
                            </Link>
                        ))}
                    </nav>
                );
            })()}

            {activeTab === "etat" && (
            <>
            {/* 1. État du déploiement */}
            <section className="rounded-2xl border border-border bg-surface p-6 space-y-4">
                <h2 className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                    <Rocket className="w-4 h-4 text-success" />
                    État du déploiement
                </h2>
                <ul className="grid sm:grid-cols-3 gap-3">
                    {checks.map((c) => (
                        <li
                            key={c.label}
                            className="flex items-center gap-2.5 p-3.5 rounded-xl border border-border bg-black/20 text-sm font-bold"
                        >
                            {c.ok ? (
                                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                            ) : (
                                <XCircle className="w-4 h-4 text-danger shrink-0" />
                            )}
                            <span className={c.ok ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
                        </li>
                    ))}
                </ul>
                {progress && !progress.isFinished && (
                    <p className="text-xs text-muted-foreground">
                        Configuration : {progress.totalPoints}/{progress.maxPoints} pts —{" "}
                        <Link href={`/dashboard/${guildId}/admin/getting-started`} className="text-success font-bold hover:underline">
                            Reprendre
                        </Link>
                    </p>
                )}
            </section>

            {/* 2. Gouvernance */}
            <GovernanceWidget guildId={guildId} />
            </>
            )}

            {activeTab === "modules" && (
            <>
            {/* 3. Modules */}
            <section className="space-y-4">
                <h2 className="text-sm font-black uppercase tracking-widest text-foreground px-1">
                    Modules de la guilde
                </h2>
                <ModulesClient
                    guildId={guildId}
                    initialModules={(moduleConfig?.toggles ?? modules) as GuildModulesState}
                    moduleStates={(moduleConfig?.states ?? {}) as Record<ModuleKey, ModuleLockState>}
                />
            </section>
            </>
            )}

            {activeTab === "acces" && (
            <>
            {/* 4. Matrice RBAC complète */}
            <section className="space-y-4">
                <h2 className="text-sm font-black uppercase tracking-widest text-foreground px-1">
                    Rôles & Permissions
                </h2>
                <PermissionsManager
                    guildId={guildId}
                    roles={roles}
                    members={(membersData as any).members || []}
                    currentMapping={rolesMapping as any}
                    currentUsersMapping={usersMapping as any}
                    usersMappingEnabled={rbacUsersMappingEnabled}
                    hiddenPermissions={hiddenPermissions as any}
                    moduleStates={modules as unknown as Record<string, boolean>}
                />
            </section>
            </>
            )}

            {activeTab === "commandes" && (
                <PilotageCommandsSection guildId={guildId} />
            )}

            {activeTab === "diagnostic" && (
                <PilotageDiscordDiagnostic guildId={guildId} />
            )}
        </div>
    );
}
