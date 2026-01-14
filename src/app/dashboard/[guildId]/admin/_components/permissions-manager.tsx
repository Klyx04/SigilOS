"use client";

import { useState, useTransition, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { updateRoleMapping } from "@/server/actions/admin-actions";
import { PERMISSIONS, PERMISSION_DETAILS, PERMISSION_MODULES, type PermissionId, type PermissionModule } from "@/lib/permissions";
import { PermissionCard } from "./permission-card";
import { cn } from "@/lib/utils";
import { Save, Filter } from "lucide-react";

type Role = {
    id: string;
    name: string;
    color: number;
};

type Props = {
    guildId: string;
    roles: Role[];
    currentMapping: Record<string, PermissionId[]>;
};

const MODULE_ORDER: PermissionModule[] = ["admin", "missions", "songes", "profile", "modules"];

export function PermissionsManager({ guildId, roles, currentMapping }: Props) {
    // Transform: DB (Role -> Perms)  ==>  UI (Perm -> Roles)
    const initialPermState: Record<PermissionId, string[]> = Object.values(PERMISSIONS).reduce((acc, perm) => {
        acc[perm] = [];
        return acc;
    }, {} as Record<PermissionId, string[]>);

    // Populate from mapping
    Object.entries(currentMapping).forEach(([roleId, perms]) => {
        perms.forEach(perm => {
            if (!initialPermState[perm]) initialPermState[perm] = [];
            initialPermState[perm].push(roleId);
        });
    });

    const [permState, setPermState] = useState(initialPermState);
    const [isPending, startTransition] = useTransition();
    const [activeModule, setActiveModule] = useState<PermissionModule | "all">("all");

    const handlePermChange = (permId: PermissionId, newRoleIds: string[]) => {
        setPermState(prev => ({
            ...prev,
            [permId]: newRoleIds
        }));
    };

    const handleSave = () => {
        startTransition(async () => {
            // Transform: UI (Perm -> Roles) ==> DB (Role -> Perms)
            const dbMapping: Record<string, PermissionId[]> = {};

            Object.entries(permState).forEach(([permId, roleIds]) => {
                roleIds.forEach(roleId => {
                    if (!dbMapping[roleId]) dbMapping[roleId] = [];
                    // Check if not already added
                    if (!dbMapping[roleId].includes(permId as PermissionId)) {
                        dbMapping[roleId].push(permId as PermissionId);
                    }
                });
            });

            const res = await updateRoleMapping(guildId, dbMapping);
            if (res.success) {
                toast.success("Permissions sauvegardées");
            } else {
                toast.error(res.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    const roleOptions = roles.map(r => ({ label: r.name, value: r.id, color: r.color }));

    // Group permissions by module
    const permissionsByModule = useMemo(() => {
        const grouped: Record<PermissionModule, PermissionId[]> = {
            admin: [],
            missions: [],
            profile: [],
            songes: [],
            modules: [],
        };

        Object.entries(PERMISSION_DETAILS).forEach(([permId, details]) => {
            grouped[details.module].push(permId as PermissionId);
        });

        return grouped;
    }, []);

    // Filtered permissions based on active module
    const visiblePermissions = useMemo(() => {
        if (activeModule === "all") {
            return Object.values(PERMISSIONS);
        }
        return permissionsByModule[activeModule] || [];
    }, [activeModule, permissionsByModule]);

    // Stats per module
    const moduleStats = useMemo(() => {
        const stats: Record<PermissionModule, number> = {
            admin: 0,
            missions: 0,
            profile: 0,
            songes: 0,
            modules: 0,
        };

        Object.entries(permState).forEach(([permId, roleIds]) => {
            const module = PERMISSION_DETAILS[permId as PermissionId]?.module;
            if (module && roleIds.length > 0) {
                stats[module]++;
            }
        });

        return stats;
    }, [permState]);

    return (
        <div className="space-y-6">
            {/* Sticky header with save button */}
            <div className="flex justify-between items-center bg-zinc-900/80 backdrop-blur-sm p-4 rounded-xl border border-white/10 sticky top-4 z-10">
                <div>
                    <h2 className="text-lg font-semibold text-white">Gestion des Droits</h2>
                    <p className="text-xs text-muted-foreground">Attribuez les permissions aux rôles Discord de votre guilde.</p>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={isPending}
                    className="min-w-[150px] bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
                >
                    <Save className="w-4 h-4 mr-2" />
                    {isPending ? "Sauvegarde..." : "Sauvegarder"}
                </Button>
            </div>

            {/* Module Filters */}
            <div className="bg-zinc-900/60 rounded-xl border border-white/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Filtrer par module</span>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setActiveModule("all")}
                        className={cn(
                            "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                            activeModule === "all"
                                ? "bg-white/10 text-white border border-white/20"
                                : "bg-zinc-800/50 text-muted-foreground hover:bg-zinc-800 hover:text-white border border-transparent"
                        )}
                    >
                        Tous ({Object.values(PERMISSIONS).length})
                    </button>
                    {MODULE_ORDER.map(moduleKey => {
                        const module = PERMISSION_MODULES[moduleKey];
                        const count = permissionsByModule[moduleKey].length;
                        const configured = moduleStats[moduleKey];

                        return (
                            <button
                                key={moduleKey}
                                onClick={() => setActiveModule(moduleKey)}
                                className={cn(
                                    "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                                    activeModule === moduleKey
                                        ? "text-white border"
                                        : "bg-zinc-800/50 text-muted-foreground hover:bg-zinc-800 hover:text-white border border-transparent"
                                )}
                                style={{
                                    backgroundColor: activeModule === moduleKey ? `${module.color}20` : undefined,
                                    borderColor: activeModule === moduleKey ? `${module.color}50` : undefined,
                                }}
                            >
                                <span>{module.icon}</span>
                                <span>{module.label}</span>
                                <span className={cn(
                                    "text-xs px-1.5 py-0.5 rounded",
                                    configured > 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-700"
                                )}>
                                    {configured}/{count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Permissions Grid grouped by module */}
            {activeModule === "all" ? (
                // Show grouped by module when "all" is selected
                <div className="space-y-8">
                    {MODULE_ORDER.map(moduleKey => {
                        const module = PERMISSION_MODULES[moduleKey];
                        const modulePerms = permissionsByModule[moduleKey];
                        if (modulePerms.length === 0) return null;

                        return (
                            <div key={moduleKey}>
                                <div
                                    className="flex items-center gap-2 mb-4 pb-2 border-b"
                                    style={{ borderColor: `${module.color}30` }}
                                >
                                    <span className="text-xl">{module.icon}</span>
                                    <h3
                                        className="text-lg font-semibold"
                                        style={{ color: module.color }}
                                    >
                                        {module.label}
                                    </h3>
                                    <span className="text-xs text-muted-foreground ml-2">
                                        ({modulePerms.length} droits)
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {modulePerms.map((permId) => (
                                        <PermissionCard
                                            key={permId}
                                            permissionId={permId}
                                            allRoles={roleOptions}
                                            selectedRoleIds={permState[permId] || []}
                                            onRolesChange={(ids) => handlePermChange(permId, ids)}
                                            onSave={handleSave}
                                            moduleColor={module.color}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                // Show flat list when filtering by specific module
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {visiblePermissions.map((permId) => (
                        <PermissionCard
                            key={permId}
                            permissionId={permId}
                            allRoles={roleOptions}
                            selectedRoleIds={permState[permId] || []}
                            onRolesChange={(ids) => handlePermChange(permId, ids)}
                            onSave={handleSave}
                            moduleColor={PERMISSION_MODULES[PERMISSION_DETAILS[permId].module].color}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
