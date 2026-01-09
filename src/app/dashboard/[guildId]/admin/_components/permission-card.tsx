"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { MultiSelect, type Option } from "@/components/ui/multi-select";
import { type PermissionId, PERMISSION_DETAILS } from "@/lib/permissions";

type Props = {
    permissionId: PermissionId;
    allRoles: Option[];
    selectedRoleIds: string[];
    onRolesChange: (roles: string[]) => void;
    onSave: () => void;
};

export function PermissionCard({ permissionId, allRoles, selectedRoleIds, onRolesChange, onSave }: Props) {
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
            <CardFooter className="pt-2">
                <Button variant="secondary" size="sm" className="w-full" onClick={onSave}>
                    <Save className="w-4 h-4 mr-2" />
                    Sauvegarder
                </Button>
            </CardFooter>
        </Card>
    );
}
