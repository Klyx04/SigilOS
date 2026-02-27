"use client";

import { MultiSelect, type Option } from "@/components/ui/multi-select";
import { type PermissionId, PERMISSION_DETAILS } from "@/lib/permissions";
import { Check } from "lucide-react";

type Props = {
    permissionId: PermissionId;
    allRoles: Option[];
    selectedRoleIds: string[];
    onRolesChange: (roles: string[]) => void;
    onSave: () => void;
    moduleColor?: string;
};

export function PermissionCard({ permissionId, allRoles, selectedRoleIds, onRolesChange, moduleColor }: Props) {
    const details = PERMISSION_DETAILS[permissionId];
    const hasRoles = selectedRoleIds.length > 0;

    return (
        <div
            className={`group flex items-center gap-4 px-4 py-2.5 rounded-lg border transition-all ${hasRoles
                    ? "bg-emerald-500/[0.03] border-emerald-500/20"
                    : "border-transparent hover:border-white/8 hover:bg-white/[0.02]"
                }`}
        >
            {/* Status dot */}
            <div className="shrink-0 flex items-center justify-center w-4">
                {hasRoles ? (
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
            <div className="w-56 shrink-0">
                <p className="text-sm font-semibold text-white leading-tight">{details.label}</p>
                <p className="text-[11px] text-zinc-500 leading-tight mt-0.5 line-clamp-1">{details.description}</p>
            </div>

            {/* Role selector — fills remaining space */}
            <div className="flex-1 min-w-0">
                <MultiSelect
                    options={allRoles}
                    selected={selectedRoleIds}
                    onChange={onRolesChange}
                    placeholder="Aucun rôle"
                />
            </div>

            {/* Role count badge */}
            {hasRoles && (
                <span className="shrink-0 text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                    {selectedRoleIds.length}
                </span>
            )}
        </div>
    );
}
