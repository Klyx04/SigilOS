"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MultiSelect, type Option } from "@/components/ui/multi-select";
import { type PermissionId, PERMISSION_DETAILS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
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
        <Card
            className={cn(
                "h-full flex flex-col transition-all duration-200",
                "bg-zinc-900/60 border-white/5 hover:border-white/10",
                hasRoles && "ring-1 ring-emerald-500/30"
            )}
            style={{
                borderLeftWidth: "3px",
                borderLeftColor: moduleColor || "#6b7280",
            }}
        >
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                    <CardTitle className="text-base font-medium text-white">
                        {details.label}
                    </CardTitle>
                    {hasRoles && (
                        <div
                            className="w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: `${moduleColor}30` }}
                        >
                            <Check className="w-3 h-3" style={{ color: moduleColor }} />
                        </div>
                    )}
                </div>
                <CardDescription className="text-xs text-muted-foreground/80">
                    {details.description}
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 mt-auto">
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Rôles autorisés
                    </label>
                    <MultiSelect
                        options={allRoles}
                        selected={selectedRoleIds}
                        onChange={onRolesChange}
                        placeholder="Aucun rôle sélectionné"
                    />
                    {hasRoles && (
                        <p className="text-xs text-muted-foreground/60 mt-1">
                            {selectedRoleIds.length} rôle{selectedRoleIds.length > 1 ? "s" : ""} configuré{selectedRoleIds.length > 1 ? "s" : ""}
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
