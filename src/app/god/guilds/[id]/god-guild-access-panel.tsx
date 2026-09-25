/**
 * Panneau **Accès & RBAC** d'une guilde (lecture seule) — `/god/guilds/[id]`.
 *
 * Audit croisé du 24/09/2026 : la fiche ne montrait **nulle part** qui accède au
 * dashboard de cette guilde. Il fallait ouvrir `/dashboard/[guildId]/admin/permissions`
 * (donc être membre de la guilde) pour voir `rolesMapping` / `usersMapping`, et rien
 * n'exposait l'état du rôle « Accès Dashboard » ni le propriétaire.
 *
 * Ici : **lecture seule**, aucune action — le God garde ses actions dans l'onglet
 * Modules et la console God, donc un sous-god peut consulter sans rien pouvoir.
 */

import { ShieldCheck, KeyRound, UserCog, Crown, Users } from "lucide-react";
import { DASHBOARD_ACCESS_ROLE_NAME, DASHBOARD_LOGIN } from "@/lib/onboarding-gating";

/** Résout un id de rôle Discord en nom lisible (nom connu > rôle de la guilde > id). */
type RoleLabeler = (roleId: string) => string;

export function GodsGuildAccessPanel({
    ownerId,
    rolesMapping,
    usersMapping,
    discordRoles,
    rbacUsersMappingEnabled,
    roleNames,
}: {
    /** Id Discord du propriétaire du serveur. */
    ownerId: string | null;
    /** Rôle Discord → permissions SigilOS (`GuildConfig.rolesMapping`). */
    rolesMapping: Record<string, string[]>;
    /** Id Discord → permissions en direct (`GuildConfig.usersMapping`). */
    usersMapping: Record<string, string[]>;
    /** Rôles Discord de la guilde (id, nom). */
    discordRoles: { id: string; name: string }[];
    /** Kill-switch God « mapping individuel » (`PlatformConfig`). */
    rbacUsersMappingEnabled: boolean;
    /** Noms de rôles déjà connus (mappings orphelins). */
    roleNames: Record<string, string>;
}) {
    const dashboardLoginRoles = Object.entries(rolesMapping).filter(([, perms]) =>
        Array.isArray(perms) && perms.includes(DASHBOARD_LOGIN),
    );
    const accessRole = discordRoles.find((r) => r.name === DASHBOARD_ACCESS_ROLE_NAME) ?? null;
    const individualEntries = Object.entries(usersMapping);
    const roleLabel: RoleLabeler = (roleId) =>
        roleNames[roleId] || discordRoles.find((r) => r.id === roleId)?.name || roleId;

    return (
        <div className="space-y-6">
            <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-6">
                <p className="text-xs text-amber-500/80 font-medium leading-relaxed">
                    <span className="font-black uppercase tracking-widest mr-2">Lecture seule :</span>
                    consulter les accès d&apos;une guilde ne les modifie jamais. Les mappings se règlent par la
                    guilde (<code>/dashboard/[guildId]/admin/permissions</code>) ou par une action God explicite.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AccessBaseCard
                    ownerId={ownerId}
                    hasAccessRole={!!accessRole}
                    rbacUsersMappingEnabled={rbacUsersMappingEnabled}
                    discordRolesCount={discordRoles.length}
                />
                <DashboardLoginRolesCard roles={dashboardLoginRoles} roleLabel={roleLabel} />
                <IndividualOverridesCard entries={individualEntries} />
            </div>

            <MappedRolesCard rolesMapping={rolesMapping} roleLabel={roleLabel} />
        </div>
    );
}


function AccessBaseCard({
    ownerId,
    hasAccessRole,
    rbacUsersMappingEnabled,
    discordRolesCount,
}: {
    ownerId: string | null;
    hasAccessRole: boolean;
    rbacUsersMappingEnabled: boolean;
    discordRolesCount: number;
}) {
    return (
        <div className="bg-zinc-900/20 border border-white/5 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-black text-zinc-500 uppercase tracking-widest flex items-center gap-3">
                <Crown className="w-4 h-4 text-violet-500" />
                Propriétaire & accès de base
            </h3>
            <div className="space-y-3 text-sm">
                <Row label="Propriétaire Discord">
                    <span className="font-mono text-xs text-zinc-300">{ownerId ?? "inconnu"}</span>
                </Row>
                <Row label={`Rôle « ${DASHBOARD_ACCESS_ROLE_NAME} »`}>
                    <span className={hasAccessRole ? "text-xs text-emerald-400" : "text-xs text-amber-400"}>
                        {hasAccessRole ? "présent" : "absent — créé au déploiement"}
                    </span>
                </Row>
                <Row label="Mapping individuel (God)">
                    <span className={rbacUsersMappingEnabled ? "text-xs text-emerald-400" : "text-xs text-rose-400"}>
                        {rbacUsersMappingEnabled ? "activé" : "désactivé (kill-switch)"}
                    </span>
                </Row>
                <Row label="Rôles Discord">
                    <span className="text-xs text-zinc-300">{discordRolesCount}</span>
                </Row>
            </div>
        </div>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-500">{label}</span>
            {children}
        </div>
    );
}

function DashboardLoginRolesCard({ roles, roleLabel }: { roles: [string, string[]][]; roleLabel: RoleLabeler }) {
    return (
        <div className="bg-zinc-900/20 border border-white/5 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-black text-zinc-500 uppercase tracking-widest flex items-center gap-3">
                <KeyRound className="w-4 h-4 text-violet-500" />
                Rôles avec <code className="text-zinc-400">{DASHBOARD_LOGIN}</code>
            </h3>
            {roles.length === 0 ? (
                <p className="text-xs text-zinc-500 italic">
                    Aucun rôle explicite : le dashboard est fermé (RBAC non configuré → onboarding incomplet).
                </p>
            ) : (
                <ul className="space-y-2 text-sm">
                    {roles.map(([roleId, perms]) => (
                        <li key={roleId} className="flex items-center justify-between gap-4">
                            <span className="text-zinc-300 truncate">{roleLabel(roleId)}</span>
                            <span className="text-caption text-zinc-500 tabular-nums shrink-0">
                                {perms.length} permission(s)
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}


function IndividualOverridesCard({ entries }: { entries: [string, string[]][] }) {
    return (
        <div className="bg-zinc-900/20 border border-white/5 rounded-3xl p-6 space-y-4 lg:col-span-2">
            <h3 className="text-sm font-black text-zinc-500 uppercase tracking-widest flex items-center gap-3">
                <UserCog className="w-4 h-4 text-violet-500" />
                Dérivations individuelles ({entries.length})
            </h3>
            {entries.length === 0 ? (
                <p className="text-xs text-zinc-500 italic">
                    Aucune dérivation : tous les droits passent par les rôles Discord.
                </p>
            ) : (
                <ul className="space-y-2 text-sm">
                    {entries.map(([discordId, perms]) => (
                        <li key={discordId} className="flex items-center justify-between gap-4">
                            <span className="font-mono text-xs text-zinc-300 truncate">{discordId}</span>
                            <span className="text-caption text-zinc-500 tabular-nums shrink-0">
                                {perms.length} permission(s)
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function MappedRolesCard({
    rolesMapping,
    roleLabel,
}: {
    rolesMapping: Record<string, string[]>;
    roleLabel: RoleLabeler;
}) {
    const entries = Object.entries(rolesMapping);
    return (
        <div className="bg-zinc-900/20 border border-white/5 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-black text-zinc-500 uppercase tracking-widest flex items-center gap-3">
                <Users className="w-4 h-4 text-violet-500" />
                Tous les rôles mappés ({entries.length})
            </h3>
            {entries.length === 0 ? (
                <p className="text-xs text-zinc-500 italic">Aucun rôle mappé.</p>
            ) : (
                <div className="space-y-3">
                    {entries.map(([roleId, perms]) => (
                        <div key={roleId} className="flex flex-col gap-1 border-b border-white/5 pb-2 last:border-0">
                            <span className="text-sm text-zinc-300 flex items-center gap-2">
                                <ShieldCheck className="w-3.5 h-3.5 text-zinc-600" />
                                {roleLabel(roleId)}
                            </span>
                            <span className="text-caption font-mono text-zinc-500 break-all">
                                {Array.isArray(perms) && perms.length > 0 ? perms.join(", ") : "—"}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
