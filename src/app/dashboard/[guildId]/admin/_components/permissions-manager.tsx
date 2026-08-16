"use client";

import { useState, useTransition, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { updateRBACMapping } from "@/server/actions/admin-actions";
import { PERMISSIONS, PERMISSION_DETAILS, PERMISSION_MODULES, MODULE_ORDER as PERM_MODULE_ORDER, type PermissionId, type PermissionModule } from "@/lib/permissions";
import { PermissionCard } from "./permission-card";
import { type Option } from "@/components/ui/multi-select";
import { cn } from "@/lib/utils";
import { Save, Filter, ChevronDown, ChevronRight, Search, X, Users, ShieldAlert, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getDisplayName } from "@/lib/display-name";

type Role = {
    id: string;
    name: string;
    color: number;
};

type Props = {
    guildId: string;
    roles: Role[];
    members: any[];
    currentMapping: Record<string, PermissionId[]>;
    currentUsersMapping: Record<string, PermissionId[]>;
    // Chantier #72 — kill-switch God « Membres Spécifiques » (PlatformConfig) :
    // quand la plateforme le désactive, les sélecteurs par membre sont masqués
    // (lecture seule) ; le serveur rejette de toute façon toute écriture.
    usersMappingEnabled: boolean;
};

const MODULE_ORDER = PERM_MODULE_ORDER;

export function PermissionsManager({ guildId, roles, members, currentMapping, currentUsersMapping, usersMappingEnabled }: Props) {
    // Transform: DB (Role -> Perms)  ==>  UI (Perm -> Roles)
    const initialPermState: Record<PermissionId, string[]> = Object.values(PERMISSIONS).reduce((acc, perm) => {
        acc[perm] = [];
        return acc;
    }, {} as Record<PermissionId, string[]>);

    Object.entries(currentMapping).forEach(([roleId, perms]) => {
        perms.forEach(perm => {
            // Only include permissions that still exist in the new system
            if (initialPermState[perm]) {
                initialPermState[perm].push(roleId);
            }
        });
    });

    // Transform: DB (User -> Perms) ==> UI (Perm -> Users)
    const initialUserState: Record<PermissionId, string[]> = Object.values(PERMISSIONS).reduce((acc, perm) => {
        acc[perm] = [];
        return acc;
    }, {} as Record<PermissionId, string[]>);

    Object.entries(currentUsersMapping).forEach(([discordUserId, perms]) => {
        perms.forEach(perm => {
            // Only include permissions that still exist in the new system
            if (initialUserState[perm]) {
                initialUserState[perm].push(discordUserId);
            }
        });
    });

    const [permState, setPermState] = useState(initialPermState);
    const [userState, setUserState] = useState(initialUserState);
    const [isPending, startTransition] = useTransition();
    const [activeModule, setActiveModule] = useState<PermissionModule | "all">("all");
    const [searchQuery, setSearchQuery] = useState("");
    // Track which module sections are collapsed (only relevant in "all" view)
    const [collapsed, setCollapsed] = useState<Record<PermissionModule, boolean>>({} as Record<PermissionModule, boolean>);

    // Roles that currently have DASHBOARD_ACCESS assigned
    const rolesWithDashboardAccess = new Set(permState[PERMISSIONS.DASHBOARD_LOGIN] || []);

    const handlePermChange = (permId: PermissionId, newRoleIds: string[]) => {
        setPermState(prev => {
            const next = { ...prev, [permId]: newRoleIds };
            // Auto-add DASHBOARD_ACCESS when any permission is granted to a role
            if (permId !== PERMISSIONS.DASHBOARD_LOGIN && newRoleIds.length > 0) {
                const currentAccess = new Set(prev[PERMISSIONS.DASHBOARD_LOGIN] || []);
                newRoleIds.forEach(roleId => currentAccess.add(roleId));
                next[PERMISSIONS.DASHBOARD_LOGIN] = Array.from(currentAccess);
            }
            return next;
        });
    };

    const handleUserChange = (permId: PermissionId, newUserIds: string[]) => {
        setUserState(prev => ({ ...prev, [permId]: newUserIds }));
    };

    const handleSave = () => {
        startTransition(async () => {
            // Reconstruct rolesMapping
            const rolesMapping: Record<string, PermissionId[]> = {};
            Object.entries(permState).forEach(([permId, roleIds]) => {
                roleIds.forEach(roleId => {
                    if (!rolesMapping[roleId]) rolesMapping[roleId] = [];
                    if (!rolesMapping[roleId].includes(permId as PermissionId)) {
                        rolesMapping[roleId].push(permId as PermissionId);
                    }
                });
            });

            // Reconstruct usersMapping
            const usersMapping: Record<string, PermissionId[]> = {};
            // Chantier #72 — kill-switch God « Membres Spécifiques » : quand la plateforme
            // désactive les permissions individuelles, on renvoie l'existant INCHANGÉ
            // (jamais un payload vide ou recalculé qui ferait « semblant » d'effacer
            // des grants ; le serveur rejette toute modification de toute façon).
            if (usersMappingEnabled) {
                Object.entries(userState).forEach(([permId, userIds]) => {
                    userIds.forEach(userId => {
                        const discordUserId = userId; // The ID passed should be the discord provider account ID
                        if (!usersMapping[discordUserId]) usersMapping[discordUserId] = [];
                        if (!usersMapping[discordUserId].includes(permId as PermissionId)) {
                            usersMapping[discordUserId].push(permId as PermissionId);
                        }
                    });
                });
            } else {
                Object.entries(currentUsersMapping).forEach(([discordUserId, perms]) => {
                    usersMapping[discordUserId] = [...perms];
                });
            }

            const res = await updateRBACMapping(guildId, rolesMapping, usersMapping);
            if (res.success) {
                toast.success("Permissions sauvegardées");
            } else {
                toast.error(res.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    const toggleCollapse = (mod: PermissionModule) => {
        setCollapsed(prev => ({ ...prev, [mod]: !prev[mod] }));
    };

    const roleOptions = roles.map(r => ({ label: r.name, value: r.id, color: r.color }));
    // La clé du usersMapping DOIT être le Discord ID (snowflake) : getUserContext
    // lit `individualMapping[discordUserId]`. Le fallback `|| m.userId` (UUID interne)
    // rendait la permission silencieusement inopérante. Un membre sans compte Discord
    // lié ne peut pas se connecter → il est exclu (aucune permission individuelle possible).
    const memberOptions: Option[] = members.flatMap(m => {
        const discordAccount = m.user.accounts?.find((a: any) => a.provider === "discord");
        if (!discordAccount?.providerAccountId) return [];
        return [{
            label: getDisplayName(m),
            value: discordAccount.providerAccountId,
            icon: m.user.image ?? undefined,
        }];
    });

    const permissionsByModule = useMemo(() => {
        const grouped = {} as Record<PermissionModule, PermissionId[]>;
        MODULE_ORDER.forEach(m => grouped[m] = []);
        Object.entries(PERMISSION_DETAILS).forEach(([permId, details]) => {
            grouped[details.module].push(permId as PermissionId);
        });
        return grouped;
    }, []);

    const visiblePermissions = useMemo(() => {
        const base = activeModule === "all"
            ? Object.keys(PERMISSION_DETAILS) as PermissionId[]
            : permissionsByModule[activeModule] || [];

        if (!searchQuery.trim()) return base;

        const q = searchQuery.toLowerCase().trim();
        return base.filter(permId => {
            const detail = PERMISSION_DETAILS[permId];
            // Match on permission label
            if (detail.label.toLowerCase().includes(q)) return true;
            // Match on description
            if (detail.description.toLowerCase().includes(q)) return true;
            // Match on permission ID (technical)
            if (permId.toLowerCase().includes(q)) return true;
            // Match on assigned role names
            const assignedRoleIds = permState[permId] || [];
            const assignedRoleNames = assignedRoleIds
                .map(id => roles.find(r => r.id === id)?.name || "")
                .join(" ");
            if (assignedRoleNames.toLowerCase().includes(q)) return true;
            return false;
        });
    }, [activeModule, permissionsByModule, searchQuery, permState, roles]);

    const isSearchActive = searchQuery.trim().length > 0;

    const moduleStats = useMemo(() => {
        const stats = {} as Record<PermissionModule, number>;
        MODULE_ORDER.forEach(m => stats[m] = 0);
        Object.entries(permState).forEach(([permId, roleIds]) => {
            const module = PERMISSION_DETAILS[permId as PermissionId]?.module;
            if (module && roleIds.length > 0) stats[module]++;
        });
        return stats;
    }, [permState]);

    const totalConfigured = useMemo(() => Object.values(permState).filter(r => r.length > 0).length, [permState]);

    // Roles that have any permission but are missing DASHBOARD_ACCESS (need migration)
    const rolesNeedingMigration = useMemo(() => {
        const allMappedRoles = new Set<string>();
        Object.entries(permState).forEach(([permId, roleIds]) => {
            if (permId !== PERMISSIONS.DASHBOARD_LOGIN && roleIds.length > 0) {
                roleIds.forEach(id => allMappedRoles.add(id));
            }
        });
        const withAccess = new Set(permState[PERMISSIONS.DASHBOARD_LOGIN] || []);
        return [...allMappedRoles].filter(rId => !withAccess.has(rId));
    }, [permState]);

    return (
        <div className="space-y-8 relative">
            {/* Background Ambient Glow */}
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-surface radial-gradient blur-[160px] rounded-full pointer-events-none" />

            {/* ⚠️ Warning Banner: roles missing DASHBOARD_ACCESS */}
            {rolesNeedingMigration.length > 0 && (
                <div className="flex items-start gap-4 bg-warning/10 border border-warning/30 rounded-2xl px-6 py-4">
                    <span className="text-2xl mt-0.5">⚠️</span>
                    <div>
                        <p className="text-warning font-black uppercase tracking-widest text-sm">
                            Accès non explicite détecté
                        </p>
                        <p className="text-warning/80 text-xs mt-1 leading-relaxed">
                            {rolesNeedingMigration.length > 0 && (
                                <>
                                    {rolesNeedingMigration.map(rId => roles.find(r => r.id === rId)?.name || rId).join(", ")} — 
                                    {" "}Ces rôles ont des permissions mais n'ont pas <strong>🚪 Accès Dashboard</strong> coché.
                                    Les nouvelles permissions cochées ci-dessus l'ont automatiquement ajouté.
                                    <strong> Pensez à sauvegarder.</strong>
                                </>
                            )}
                        </p>
                    </div>
                </div>
            )}

            {/* ⚠️ Chantier #72 — kill-switch God « Membres Spécifiques » désactivé */}
            {!usersMappingEnabled && (
                <div className="flex items-start gap-4 bg-danger/10 border border-danger/30 rounded-2xl px-6 py-4">
                    <span className="text-2xl mt-0.5">🚫</span>
                    <div>
                        <p className="text-danger font-black uppercase tracking-widest text-sm">
                            Permissions « Membres Spécifiques » désactivées par la plateforme
                        </p>
                        <p className="text-danger/80 text-xs mt-1 leading-relaxed">
                            L'option par membre est temporairement coupée (panel God). Les sélecteurs individuels
                            sont masqués et aucune modification ne sera enregistrée. Les permissions de <strong>rôles</strong>
                            restent entièrement configurables.
                        </p>
                    </div>
                </div>
            )}

            {/* Sticky Action Bar — Sigma 2026 Style */}
            <div className="flex flex-col sm:flex-row justify-between items-center bg-elevated/90 backdrop-blur-2xl px-6 py-5 rounded-[2rem] border border-border-strong sticky top-4 z-20 gap-4 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)]">
                <div className="flex items-center gap-5">
                    <div className="p-3 bg-primary/20 rounded-2xl border border-primary/40">
                        <ShieldAlert className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-base font-semibold text-foreground leading-none tracking-tight">Matrice des Droits</h2>
                        <div className="flex items-center gap-3 mt-2">
                            <div className="h-2 w-48 bg-surface rounded-full overflow-hidden border border-border">
                                <div 
                                    className="h-full bg-primary transition-all duration-200"
                                    style={{ 
                                        width: `${(totalConfigured / Object.values(PERMISSIONS).length) * 100}%`
                                    }}
                                />
                            </div>
                            <span className="text-xs font-semibold text-foreground tracking-wide">
                                {totalConfigured} / {Object.values(PERMISSIONS).length} activés
                            </span>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-72">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground" />
                        <Input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Rechercher une permission..."
                            className="pl-11 bg-muted/40 border-border h-12 rounded-xl text-sm focus-visible:ring-primary/40 w-full placeholder:text-muted-foreground text-foreground"
                        />
                    </div>
                    <Button
                        onClick={handleSave}
                        disabled={isPending}
                        className="bg-background hover:bg-primary text-foreground font-semibold rounded-xl h-12 px-8 transition-colors"
                    >
                        {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 mr-3" />}
                        {isPending ? "Synchronisation..." : "Sauvegarder"}
                    </Button>
                </div>
            </div>

            {/* Module Filter Island */}
            <div className="flex flex-wrap gap-2.5 p-2.5 bg-elevated/40 rounded-2xl border border-border overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveModule("all")}
                    className={cn(
                        "px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wide uppercase whitespace-nowrap border transition-colors",
                        activeModule === "all"
                            ? "bg-background text-foreground border-border"
                            : "bg-transparent text-muted-foreground border-transparent hover:text-foreground hover:bg-surface"
                    )}
                >
                    Tous les modules
                </button>
                {MODULE_ORDER.map(moduleKey => {
                    const module = PERMISSION_MODULES[moduleKey];
                    const isActive = activeModule === moduleKey;
                    return (
                        <button
                            key={moduleKey}
                            onClick={() => setActiveModule(moduleKey)}
                            className={cn(
                                "px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wide uppercase whitespace-nowrap flex items-center gap-2.5 border transition-colors",
                                isActive
                                    ? "text-foreground border-border-strong"
                                    : "text-muted-foreground border-transparent hover:text-foreground hover:bg-surface"
                            )}
                            style={{ 
                                backgroundColor: isActive ? `${module.color}40` : undefined,
                                borderColor: isActive ? `${module.color}80` : undefined
                            }}
                        >
                            <span className="text-sm">{module.icon}</span>
                            <span>{module.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Content Area */}
            {isSearchActive ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {visiblePermissions.length === 0 ? (
                        <div className="col-span-full py-32 text-center bg-elevated/20 rounded-[2rem] border border-dashed border-border-strong">
                            <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground font-extrabold uppercase tracking-widest text-sm">No assignments found for "{searchQuery}"</p>
                        </div>
                    ) : (
                        visiblePermissions.map(permId => (
                            <PermissionCard
                                key={permId}
                                permissionId={permId}
                                allRoles={roleOptions}
                                allUsers={memberOptions}
                                selectedRoleIds={permState[permId] || []}
                                selectedUserIds={userState[permId] || []}
                                onRolesChange={(ids) => handlePermChange(permId, ids)}
                                onUsersChange={(ids) => handleUserChange(permId, ids)}
                                onSave={handleSave}
                                moduleColor={PERMISSION_MODULES[PERMISSION_DETAILS[permId].module].color}
                                locked={permId !== PERMISSIONS.DASHBOARD_LOGIN && rolesWithDashboardAccess.size === 0}
                                hideUsers={permId === PERMISSIONS.DASHBOARD_LOGIN || !usersMappingEnabled}
                            />
                        ))
                    )}
                </div>
            ) : activeModule === "all" ? (
                <div className="space-y-20">
                    {MODULE_ORDER.map(moduleKey => {
                        const module = PERMISSION_MODULES[moduleKey];
                        const modulePerms = permissionsByModule[moduleKey];
                        if (modulePerms.length === 0) return null;
                        const configuredCount = moduleStats[moduleKey];

                        return (
                            <section key={moduleKey} className="space-y-8">
                                <div className="flex items-center justify-between px-4">
                                    <div className="flex items-center gap-4">
                                        <div 
                                            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                                            style={{ backgroundColor: `${module.color}20`, border: `1px solid ${module.color}40` }}
                                        >
                                            <span>{module.icon}</span>
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold tracking-tight" style={{ color: module.color }}>
                                                {module.label}
                                            </h2>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="px-2 py-0.5 bg-elevated text-foreground text-xs font-semibold rounded border border-border">
                                                    {modulePerms.length} permission{modulePerms.length > 1 ? "s" : ""}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="hidden md:flex flex-col items-end gap-2">
                                        <div className="text-xs font-semibold text-muted-foreground tracking-wide">Configurées</div>
                                        <div className="flex gap-2">
                                            {Array.from({ length: modulePerms.length }).map((_, i) => (
                                                <div 
                                                    key={i}
                                                    className="h-2 w-7 rounded-[2px] transition-colors duration-200 border border-border"
                                                    style={{ 
                                                        backgroundColor: i < configuredCount ? module.color : 'rgba(255,255,255,0.08)'
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {modulePerms.map(permId => (
                                        <PermissionCard
                                            key={permId}
                                            permissionId={permId}
                                            allRoles={roleOptions}
                                            allUsers={memberOptions}
                                            selectedRoleIds={permState[permId] || []}
                                            selectedUserIds={userState[permId] || []}
                                            onRolesChange={(ids) => handlePermChange(permId, ids)}
                                            onUsersChange={(ids) => handleUserChange(permId, ids)}
                                            onSave={handleSave}
                                            moduleColor={module.color}
                                            locked={permId !== PERMISSIONS.DASHBOARD_LOGIN && rolesWithDashboardAccess.size === 0}
                                            hideUsers={permId === PERMISSIONS.DASHBOARD_LOGIN || !usersMappingEnabled}
                                        />
                                    ))}
                                </div>
                                
                                {moduleKey !== MODULE_ORDER[MODULE_ORDER.length - 1] && (
                                    <div className="h-px w-full bg-surface" />
                                )}
                            </section>
                        );
                    })}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {visiblePermissions.map(permId => (
                        <PermissionCard
                            key={permId}
                            permissionId={permId}
                            allRoles={roleOptions}
                            allUsers={memberOptions}
                            selectedRoleIds={permState[permId] || []}
                            selectedUserIds={userState[permId] || []}
                            onRolesChange={(ids) => handlePermChange(permId, ids)}
                            onUsersChange={(ids) => handleUserChange(permId, ids)}
                            onSave={handleSave}
                            moduleColor={PERMISSION_MODULES[PERMISSION_DETAILS[permId].module].color}
                            locked={permId !== PERMISSIONS.DASHBOARD_LOGIN && rolesWithDashboardAccess.size === 0}
                            hideUsers={permId === PERMISSIONS.DASHBOARD_LOGIN || !usersMappingEnabled}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
