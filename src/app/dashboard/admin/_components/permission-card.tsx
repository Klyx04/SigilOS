"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MultiSelect, type Option } from "@/components/ui/multi-select";
import { type PermissionId, PERMISSION_DETAILS } from "@/lib/permissions";

type Props = {
    permissionId: PermissionId;
    allRoles: Option[]; // Transformed for the select
    selectedRoleIds: string[];
    onRolesChange: (roles: string[]) => void;
};

export function PermissionCard({ permissionId, allRoles, selectedRoleIds, onRolesChange }: Props) {
    const details = PERMISSION_DETAILS[permissionId];

    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <CardTitle className="text-lg">{details.label}</CardTitle>
                <CardDescription>{details.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
                <div className="space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Rôles Autorisés
                    </label>
                    <MultiSelect
                        options={allRoles}
                        selected={selectedRoleIds}
                        onChange={onRolesChange}
                        placeholder="Choisir des rôles..."
                    />
                </div>
            </CardContent>
        </Card>
    );
}
