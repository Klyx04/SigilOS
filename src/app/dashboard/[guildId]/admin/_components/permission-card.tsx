"use client";

import { MultiSelect, type Option } from "@/components/ui/multi-select";
import { type PermissionId, PERMISSION_DETAILS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";

type Props = {
    permissionId: PermissionId;
    allRoles: Option[];
    allUsers: Option[];
    selectedRoleIds: string[];
    selectedUserIds: string[];
    onRolesChange: (roles: string[]) => void;
    onUsersChange: (users: string[]) => void;
    onSave: () => void;
    moduleColor?: string;
    locked?: boolean;    // grise la carte tant que DASHBOARD_ACCESS n'est pas configuré
    hideUsers?: boolean; // cache la section "Membres Spécifiques"
};

export function PermissionCard({
    permissionId,
    allRoles,
    allUsers,
    selectedRoleIds,
    selectedUserIds,
    onRolesChange,
    onUsersChange,
    moduleColor,
    locked = false,
    hideUsers = false,
}: Props) {
    const details = PERMISSION_DETAILS[permissionId];
    const isConfigured = selectedRoleIds.length > 0 || selectedUserIds.length > 0;

    return (
        <div
            className={cn(
                "group relative flex flex-col gap-5 p-5 rounded-2xl border transition-colors duration-200",
                locked
                    ? "bg-zinc-900/40 border-white/5 opacity-50 cursor-not-allowed select-none"
                    : isConfigured
                        ? "bg-zinc-800/60 border-white/15"
                        : "bg-zinc-800/20 border-white/10 hover:bg-zinc-800/40"
            )}
            style={{
                borderColor: !locked && isConfigured ? `${moduleColor}50` : undefined
            }}
        >
            {/* Locked overlay */}
            {locked && (
                <div className="absolute inset-0 rounded-2xl z-20 flex flex-col items-center justify-center gap-2 pointer-events-auto cursor-not-allowed">
                    <Lock className="w-5 h-5 text-zinc-500" />
                    <p className="text-xs text-zinc-500 font-medium text-center px-4">
                        Configurez d&apos;abord<br />🚪 Accès Dashboard
                    </p>
                </div>
            )}

            <div className="flex items-start justify-between gap-3 relative z-10">
                <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                        <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{
                                backgroundColor: isConfigured && !locked ? moduleColor : '#52525b'
                            }}
                        />
                        <h3 className="text-sm font-semibold text-white tracking-tight leading-none">
                            {details.label}
                        </h3>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed max-w-[240px]">
                        {details.description}
                    </p>
                    
                    {/* Modules / paramètres débloqués (#66) */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-xs font-medium text-zinc-400">Débloque :</span>
                        {details.modules.map((mod, i) => (
                            <span 
                                key={i}
                                className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-xs text-zinc-300"
                            >
                                {mod}
                            </span>
                        ))}
                    </div>
                </div>

                {isConfigured && !locked && (
                    <div
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold border shrink-0"
                        style={{ color: 'white', borderColor: `${moduleColor}60`, backgroundColor: moduleColor }}
                    >
                        Active
                    </div>
                )}
            </div>

            <div className="grid gap-4 relative z-10">
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-white/60 uppercase tracking-wide ml-1 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                        Rôles Discord
                    </label>
                    <MultiSelect
                        options={allRoles}
                        selected={selectedRoleIds}
                        onChange={locked ? () => {} : onRolesChange}
                        placeholder="Public (Tous les membres)"
                        className="bg-black/50 border-white/10 hover:border-white/20 transition-colors text-white"
                    />
                </div>
                {!hideUsers && (
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-white/60 uppercase tracking-wide ml-1 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                            Membres Spécifiques
                        </label>
                        <MultiSelect
                            options={allUsers}
                            selected={selectedUserIds}
                            onChange={locked ? () => {} : onUsersChange}
                            placeholder="Aucun membre assigné"
                            className="bg-black/50 border-white/10 hover:border-white/20 transition-colors text-white"
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
