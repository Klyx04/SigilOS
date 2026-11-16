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
import { PERMISSION_DETAILS, type PermissionId } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { GOD_CARD_BASE } from "../../ui";

/** Résout un id de rôle Discord en nom lisible (nom connu > rôle de la guilde > id). */
type RoleLabeler = (roleId: string) => string;

/**
 * Libellé humain d'une permission (G5) : on ne montre **jamais** un slug brut.
 * Une permission inconnue est dite telle quelle, sans exposer son identifiant technique.
 */
function permissionLabel(id: string): { label: string; sensitive: boolean } {
    const detail = PERMISSION_DETAILS[id as PermissionId];
    return detail
        ? { label: detail.label, sensitive: !!detail.sensitive }
        : { label: "Permission non répertoriée", sensitive: false };
}

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
            <div className="rounded-xl border border-border bg-surface/10 p-5">
                <p className="text-xs leading-relaxed text-muted-foreground">
                    <span className="mr-2 font-semibold text-foreground">Lecture seule.</span>
                    Consulter les accès d&apos;une guilde ne les modifie jamais. Les mappings se règlent par la
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
        <div className={cn(GOD_CARD_BASE, "p-6 space-y-4")}>
            <h3 className="flex items-center gap-3 text-sm font-semibold text-foreground">
                <Crown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Propriétaire & accès de base
            </h3>
            <div className="space-y-3 text-sm">
                <Row label="Propriétaire Discord">
                    <span className="font-mono text-xs text-foreground">{ownerId ?? "inconnu"}</span>
                </Row>
                <Row label={`Rôle « ${DASHBOARD_ACCESS_ROLE_NAME} »`}>
                    <span className={hasAccessRole ? "text-xs text-success" : "text-xs text-warning"}>
                        {hasAccessRole ? "présent" : "absent — créé au déploiement"}
                    </span>
                </Row>
                <Row label="Mapping individuel (God)">
                    <span className={rbacUsersMappingEnabled ? "text-xs text-success" : "text-xs text-destructive"}>
                        {rbacUsersMappingEnabled ? "activé" : "désactivé (kill-switch)"}
                    </span>
                </Row>
                <Row label="Rôles Discord">
                    <span className="text-xs text-foreground">{discordRolesCount}</span>
                </Row>
            </div>
        </div>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{label}</span>
            {children}
        </div>
    );
}

function DashboardLoginRolesCard({ roles, roleLabel }: { roles: [string, string[]][]; roleLabel: RoleLabeler }) {
    return (
        <div className={cn(GOD_CARD_BASE, "p-6 space-y-4")}>
            <h3 className="flex items-center gap-3 text-sm font-semibold text-foreground">
                <KeyRound className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Rôles avec <code className="text-muted-foreground">{DASHBOARD_LOGIN}</code>
            </h3>
            {roles.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                    Aucun rôle explicite : le dashboard est fermé (droits non configurés → mise en route incomplète).
                </p>
            ) : (
                <ul className="space-y-2 text-sm">
                    {roles.map(([roleId, perms]) => (
                        <li key={roleId} className="flex items-center justify-between gap-4">
                            <span className="truncate text-foreground">{roleLabel(roleId)}</span>
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                {perms.length} permission{perms.length > 1 ? "s" : ""}
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
        <div className={cn(GOD_CARD_BASE, "p-6 space-y-4 lg:col-span-2")}>
            <h3 className="flex items-center gap-3 text-sm font-semibold text-foreground">
                <UserCog className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Dérivations individuelles ({entries.length})
            </h3>
            {entries.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                    Aucune dérivation : tous les droits passent par les rôles Discord.
                </p>
            ) : (
                <ul className="space-y-2 text-sm">
                    {entries.map(([discordId, perms]) => (
                        <li key={discordId} className="flex items-center justify-between gap-4">
                            <span className="truncate font-mono text-xs text-foreground">{discordId}</span>
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                {perms.length} permission{perms.length > 1 ? "s" : ""}
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
        <div className={cn(GOD_CARD_BASE, "p-6 space-y-4")}>
            <h3 className="flex items-center gap-3 text-sm font-semibold text-foreground">
                <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Tous les rôles mappés ({entries.length})
            </h3>
            {entries.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun rôle mappé.</p>
            ) : (
                <div className="space-y-4">
                    {entries.map(([roleId, perms]) => {
                        const details = (Array.isArray(perms) ? perms : []).map(permissionLabel);
                        const sensitiveCount = details.filter((d) => d.sensitive).length;
                        return (
                            <div key={roleId} className="space-y-2 border-b border-border pb-3 last:border-0 last:pb-0">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="flex items-center gap-2 text-sm text-foreground">
                                        <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                                        {roleLabel(roleId)}
                                    </span>
                                    <span className="text-xs text-muted-foreground tabular-nums">
                                        {details.length} permission{details.length > 1 ? "s" : ""}
                                        {sensitiveCount > 0 ? ` · ${sensitiveCount} sensible${sensitiveCount > 1 ? "s" : ""}` : ""}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {details.length === 0 ? (
                                        <span className="text-xs text-muted-foreground">—</span>
                                    ) : (
                                        details.map((detail, index) => (
                                            <span
                                                key={`${roleId}-${index}`}
                                                className={
                                                    detail.sensitive
                                                        ? "rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs text-warning"
                                                        : "rounded-full border border-border bg-surface/10 px-2 py-0.5 text-xs text-muted-foreground"
                                                }
                                            >
                                                {detail.label}
                                            </span>
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
