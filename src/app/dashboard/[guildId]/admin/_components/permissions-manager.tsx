"use client";

import { useState, useTransition, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { updateRoleMapping } from "@/server/actions/admin-actions";
import { PERMISSIONS, PERMISSION_DETAILS, PERMISSION_MODULES, type PermissionId, type PermissionModule } from "@/lib/permissions";
import { PermissionCard } from "./permission-card";
import { cn } from "@/lib/utils";
import { Save, Filter, ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

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

const MODULE_ORDER: PermissionModule[] = ["admin", "missions", "songes", "calendar", "profile", "features", "tools", "info"];

export function PermissionsManager({ guildId, roles, currentMapping }: Props) {
    // Transform: DB (Role -> Perms)  ==>  UI (Perm -> Roles)
    const initialPermState: Record<PermissionId, string[]> = Object.values(PERMISSIONS).reduce((acc, perm) => {
        acc[perm] = [];
        return acc;
    }, {} as Record<PermissionId, string[]>);

    Object.entries(currentMapping).forEach(([roleId, perms]) => {
        perms.forEach(perm => {
            if (!initialPermState[perm]) initialPermState[perm] = [];
            initialPermState[perm].push(roleId);
        });
    });

    const [permState, setPermState] = useState(initialPermState);
    const [isPending, startTransition] = useTransition();
    const [activeModule, setActiveModule] = useState<PermissionModule | "all">("all");
    const [searchQuery, setSearchQuery] = useState("");
    // Track which module sections are collapsed (only relevant in "all" view)
    const [collapsed, setCollapsed] = useState<Record<PermissionModule, boolean>>({} as Record<PermissionModule, boolean>);

    const handlePermChange = (permId: PermissionId, newRoleIds: string[]) => {
        setPermState(prev => ({ ...prev, [permId]: newRoleIds }));
    };

    const handleSave = () => {
        startTransition(async () => {
            const dbMapping: Record<string, PermissionId[]> = {};
            Object.entries(permState).forEach(([permId, roleIds]) => {
                roleIds.forEach(roleId => {
                    if (!dbMapping[roleId]) dbMapping[roleId] = [];
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

    const toggleCollapse = (mod: PermissionModule) => {
        setCollapsed(prev => ({ ...prev, [mod]: !prev[mod] }));
    };

    const roleOptions = roles.map(r => ({ label: r.name, value: r.id, color: r.color }));

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

    return (
        <div className="space-y-4">
            {/* Sticky save bar */}
            <div className="flex justify-between items-center bg-zinc-900/80 backdrop-blur-sm px-4 py-3 rounded-xl border border-white/8 sticky top-4 z-10">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-white">Gestion des Droits</span>
                    <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        {totalConfigured}/{Object.values(PERMISSIONS).length} configurés
                    </span>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={isPending}
                    size="sm"
                    className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
                >
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    {isPending ? "Sauvegarde..." : "Sauvegarder"}
                </Button>
            </div>

            {/* Search bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                <Input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Rechercher une permission, une description ou un rôle assigné..."
                    className="pl-9 pr-9 bg-zinc-900/60 border-white/8 h-10 text-sm placeholder:text-zinc-600 focus-visible:ring-primary/40"
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
                {isSearchActive && (
                    <span className="absolute right-10 top-1/2 -translate-y-1/2 text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        {visiblePermissions.length} résultat{visiblePermissions.length !== 1 ? "s" : ""}
                    </span>
                )}
            </div>

            {/* Module filter chips */}
            <div className="bg-zinc-900/60 rounded-xl border border-white/5 px-4 py-3">
                <div className="flex items-center gap-2 mb-2.5">
                    <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Filtrer par module</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    <button
                        onClick={() => setActiveModule("all")}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
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
                                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
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
                                    "text-[10px] px-1 py-0 rounded",
                                    configured > 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-700 text-zinc-400"
                                )}>
                                    {configured}/{count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Permissions list */}
            {isSearchActive ? (
                // Search results — flat list, no module grouping
                <div className="rounded-xl border border-white/5 overflow-hidden">
                    {visiblePermissions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Search className="w-8 h-8 text-zinc-700 mb-3" />
                            <p className="text-sm font-bold text-zinc-500">Aucune permission trouvée</p>
                            <p className="text-xs text-zinc-600 mt-1">Essaie un autre mot-clé ou nom de rôle</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/[0.04] bg-zinc-950/30">
                            {visiblePermissions.map((permId) => {
                                const moduleColor = PERMISSION_MODULES[PERMISSION_DETAILS[permId].module].color;
                                return (
                                    <PermissionCard
                                        key={permId}
                                        permissionId={permId}
                                        allRoles={roleOptions}
                                        selectedRoleIds={permState[permId] || []}
                                        onRolesChange={(ids) => handlePermChange(permId, ids)}
                                        onSave={handleSave}
                                        moduleColor={moduleColor}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
            ) : activeModule === "all" ? (
                <div className="space-y-3">
                    {MODULE_ORDER.map(moduleKey => {
                        const module = PERMISSION_MODULES[moduleKey];
                        const modulePerms = permissionsByModule[moduleKey];
                        if (modulePerms.length === 0) return null;
                        const isCollapsed = collapsed[moduleKey];

                        return (
                            <div key={moduleKey} className="rounded-xl border border-white/5 overflow-hidden">
                                {/* Module header */}
                                <button
                                    onClick={() => toggleCollapse(moduleKey)}
                                    className="w-full flex items-center justify-between px-4 py-2.5 bg-zinc-900/60 hover:bg-zinc-900/80 transition-colors text-left"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-base">{module.icon}</span>
                                        <span className="text-sm font-bold" style={{ color: module.color }}>
                                            {module.label}
                                        </span>
                                        <span className="text-[10px] text-zinc-500">({modulePerms.length} droits)</span>
                                        {moduleStats[moduleKey] > 0 && (
                                            <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                                                {moduleStats[moduleKey]} configuré{moduleStats[moduleKey] > 1 ? "s" : ""}
                                            </span>
                                        )}
                                    </div>
                                    {isCollapsed
                                        ? <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
                                        : <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />}
                                </button>

                                {/* Permission rows */}
                                {!isCollapsed && (
                                    <div className="divide-y divide-white/[0.04] bg-zinc-950/30">
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
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                // Filtered by specific module
                <div className="rounded-xl border border-white/5 overflow-hidden">
                    <div className="divide-y divide-white/[0.04] bg-zinc-950/30">
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
                </div>
            )}
        </div>
    );
}
