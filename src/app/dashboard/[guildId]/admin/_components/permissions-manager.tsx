"use client";

import { useState, useTransition, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { updateRBACMapping } from "@/server/actions/admin-actions";
import { PERMISSIONS, PERMISSION_DETAILS, PERMISSION_MODULES, type PermissionId, type PermissionModule } from "@/lib/permissions";
import { PermissionCard } from "./permission-card";
import { cn } from "@/lib/utils";
import { Save, Filter, ChevronDown, ChevronRight, Search, X, Users, ShieldAlert, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

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
};

const MODULE_ORDER: PermissionModule[] = ["admin", "missions", "songes", "calendar", "profile", "features", "tools", "info", "chat"];

export function PermissionsManager({ guildId, roles, members, currentMapping, currentUsersMapping }: Props) {
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

    // Transform: DB (User -> Perms) ==> UI (Perm -> Users)
    const initialUserState: Record<PermissionId, string[]> = Object.values(PERMISSIONS).reduce((acc, perm) => {
        acc[perm] = [];
        return acc;
    }, {} as Record<PermissionId, string[]>);

    Object.entries(currentUsersMapping).forEach(([discordUserId, perms]) => {
        perms.forEach(perm => {
            if (!initialUserState[perm]) initialUserState[perm] = [];
            initialUserState[perm].push(discordUserId);
        });
    });

    const [permState, setPermState] = useState(initialPermState);
    const [userState, setUserState] = useState(initialUserState);
    const [isPending, startTransition] = useTransition();
    const [activeModule, setActiveModule] = useState<PermissionModule | "all">("all");
    const [searchQuery, setSearchQuery] = useState("");
    // Track which module sections are collapsed (only relevant in "all" view)
    const [collapsed, setCollapsed] = useState<Record<PermissionModule, boolean>>({} as Record<PermissionModule, boolean>);

    const handlePermChange = (permId: PermissionId, newRoleIds: string[]) => {
        setPermState(prev => ({ ...prev, [permId]: newRoleIds }));
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
            Object.entries(userState).forEach(([permId, userIds]) => {
                userIds.forEach(userId => {
                    const discordUserId = userId; // The ID passed should be the discord provider account ID
                    if (!usersMapping[discordUserId]) usersMapping[discordUserId] = [];
                    if (!usersMapping[discordUserId].includes(permId as PermissionId)) {
                        usersMapping[discordUserId].push(permId as PermissionId);
                    }
                });
            });

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
    const memberOptions = members.map(m => {
        // Find discord account ID
        const discordAccount = m.user.accounts.find((a: any) => a.provider === "discord");
        return {
            label: m.pseudoDofus || m.discordNickname || m.user.name || "Inconnu",
            value: discordAccount?.providerAccountId || m.userId,
            image: m.user.image
        };
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
    return (
        <div className="space-y-8 relative">
            {/* Background Ambient Glow */}
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/[0.02] radial-gradient blur-[160px] rounded-full pointer-events-none" />

            {/* Sticky Action Bar — Sigma 2026 Style */}
            <div className="flex flex-col sm:flex-row justify-between items-center bg-zinc-800/90 backdrop-blur-2xl px-6 py-5 rounded-[2rem] border border-white/20 sticky top-4 z-20 gap-4 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)]">
                <div className="flex items-center gap-5">
                    <div className="p-3 bg-primary/20 rounded-2xl border border-primary/40 shadow-[0_0_20px_rgba(var(--primary),0.3)]">
                        <ShieldAlert className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-white leading-none tracking-tight uppercase">Matrice des Droits</h2>
                        <div className="flex items-center gap-3 mt-2">
                            <div className="h-2 w-48 bg-white/10 rounded-full overflow-hidden border border-white/5">
                                <div 
                                    className="h-full bg-primary transition-all duration-700"
                                    style={{ 
                                        width: `${(totalConfigured / Object.values(PERMISSIONS).length) * 100}%`,
                                        boxShadow: `0 0 15px var(--primary)`
                                    }}
                                />
                            </div>
                            <span className="text-[10px] font-black text-white tracking-widest uppercase">
                                {totalConfigured} / {Object.values(PERMISSIONS).length} Activés
                            </span>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-72">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                        <Input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search nodes..."
                            className="pl-11 bg-black/40 border-white/10 h-12 rounded-2xl text-sm focus-visible:ring-primary/40 w-full placeholder:text-zinc-500 text-white"
                        />
                    </div>
                    <Button
                        onClick={handleSave}
                        disabled={isPending}
                        className="bg-white hover:bg-primary text-black font-black rounded-2xl h-12 px-8 transition-all hover:scale-[1.05] active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                    >
                        {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 mr-3" />}
                        {isPending ? "SYNCHRONIZING..." : "SAUVEGARDER"}
                    </Button>
                </div>
            </div>

            {/* Module Filter Island */}
            <div className="flex flex-wrap gap-2.5 p-2.5 bg-zinc-800/40 backdrop-blur-md rounded-2xl border border-white/10 overflow-x-auto no-scrollbar shadow-xl">
                <button
                    onClick={() => setActiveModule("all")}
                    className={cn(
                        "px-5 py-2.5 rounded-xl text-[11px] font-black tracking-widest uppercase transition-all whitespace-nowrap border",
                        activeModule === "all"
                            ? "bg-white text-black border-white shadow-[0_0_25px_rgba(255,255,255,0.25)]"
                            : "bg-transparent text-zinc-400 border-transparent hover:text-white hover:bg-white/10"
                    )}
                >
                    ALL MODULES
                </button>
                {MODULE_ORDER.map(moduleKey => {
                    const module = PERMISSION_MODULES[moduleKey];
                    const isActive = activeModule === moduleKey;
                    return (
                        <button
                            key={moduleKey}
                            onClick={() => setActiveModule(moduleKey)}
                            className={cn(
                                "px-5 py-2.5 rounded-xl text-[11px] font-black tracking-widest uppercase transition-all whitespace-nowrap flex items-center gap-2.5 border",
                                isActive
                                    ? "text-white shadow-lg border-white/20"
                                    : "text-zinc-400 border-transparent hover:text-white hover:bg-white/10"
                            )}
                            style={{ 
                                backgroundColor: isActive ? `${module.color}40` : undefined,
                                borderColor: isActive ? `${module.color}80` : undefined,
                                boxShadow: isActive ? `0 0 25px ${module.color}30` : undefined
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
                        <div className="col-span-full py-32 text-center bg-zinc-800/20 rounded-[2rem] border border-dashed border-white/20">
                            <Search className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                            <p className="text-zinc-400 font-extrabold uppercase tracking-widest text-sm">No assignments found for "{searchQuery}"</p>
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
                                            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-2xl relative overflow-hidden group"
                                            style={{ backgroundColor: `${module.color}20`, border: `1px solid ${module.color}40` }}
                                        >
                                            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform" />
                                            <span className="relative z-10">{module.icon}</span>
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-black tracking-tighter uppercase italic" style={{ color: module.color }}>
                                                {module.label}
                                            </h2>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="px-2 py-0.5 bg-zinc-800 text-zinc-300 text-[9px] font-black rounded uppercase tracking-tighter border border-white/10">
                                                    {modulePerms.length} NODES
                                                </span>
                                                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                                                    Protocol Matrix Ready
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="hidden md:flex flex-col items-end gap-2">
                                        <div className="text-[10px] font-black text-white tracking-[0.2em] uppercase opacity-40">Validation Status</div>
                                        <div className="flex gap-2">
                                            {Array.from({ length: modulePerms.length }).map((_, i) => (
                                                <div 
                                                    key={i}
                                                    className="h-2 w-7 rounded-[2px] transition-all duration-500 border border-white/5"
                                                    style={{ 
                                                        backgroundColor: i < configuredCount ? module.color : 'rgba(255,255,255,0.08)',
                                                        boxShadow: i < configuredCount ? `0 0 12px ${module.color}50` : 'none'
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
                                        />
                                    ))}
                                </div>
                                
                                {moduleKey !== MODULE_ORDER[MODULE_ORDER.length - 1] && (
                                    <div className="h-px w-full bg-gradient-to-r from-transparent via-white/5 to-transparent pt-12" />
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
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
