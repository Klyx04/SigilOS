"use client";

import { MultiSelect, type Option } from "@/components/ui/multi-select";
import { type PermissionId, PERMISSION_DETAILS } from "@/lib/permissions";
import { Check } from "lucide-react";

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
};

export function PermissionCard({
    permissionId,
    allRoles,
    allUsers,
    selectedRoleIds,
    selectedUserIds,
    onRolesChange,
    onUsersChange,
    moduleColor
}: Props) {
    const details = PERMISSION_DETAILS[permissionId];
    const hasAssignments = selectedRoleIds.length > 0 || selectedUserIds.length > 0;

    return (
        <div
            className={`group flex items-center gap-4 px-4 py-2.5 rounded-lg border transition-all ${hasAssignments
                ? "bg-emerald-500/[0.03] border-emerald-500/20"
                : "border-transparent hover:border-white/8 hover:bg-white/[0.02]"
                }`}
        >
            {/* Status dot */}
            <div className="shrink-0 flex items-center justify-center w-4">
                {hasAssignments ? (
                    <div
                        className="w-3 h-3 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${moduleColor}30` }}
                    >
                        <Check className="w-2 h-2" style={{ color: moduleColor }} />
                    </div>
                ) : (
                    <div className="w-2 h-2 rounded-full bg-zinc-700 group-hover:bg-zinc-600 transition-colors" />
                )}
            </div>

            {/* Label + description */}
            <div className="w-48 shrink-0">
                <p className="text-[13px] font-bold text-white leading-tight">{details.label}</p>
                <p className="text-[10px] text-zinc-500 leading-tight mt-0.5 line-clamp-1">{details.description}</p>
            </div>

            {/* Selectors */}
            <div className="flex-1 flex gap-3 min-w-0">
                <div className="flex-1 min-w-0">
                    <MultiSelect
                        options={allRoles}
                        selected={selectedRoleIds}
                        onChange={onRolesChange}
                        placeholder="Aucun rôle"
                    />
                </div>
                <div className="flex-1 min-w-0">
                    <MultiSelect
                        options={allUsers}
                        selected={selectedUserIds}
                        onChange={onUsersChange}
                        placeholder="Aucun membre"
                    />
                </div>
            </div>

            {/* Assignment count badge */}
            {hasAssignments && (
                <span className="shrink-0 text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                    {selectedRoleIds.length + selectedUserIds.length}
                </span>
            )}
        </div>
    );
}
