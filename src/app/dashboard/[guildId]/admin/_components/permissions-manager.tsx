"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { updateRoleMapping } from "@/server/actions/admin-actions";
import { PERMISSIONS, type PermissionId } from "@/lib/permissions";
import { PermissionCard } from "./permission-card";
import { Separator } from "@/components/ui/separator";

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

    const allPermissionIds = Object.values(PERMISSIONS);
    const roleOptions = roles.map(r => ({ label: r.name, value: r.id, color: r.color }));

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-card p-4 rounded-lg border shadow-sm sticky top-4 z-10">
                <div>
                    <h2 className="text-lg font-semibold">Configuration Globale</h2>
                    <p className="text-xs text-muted-foreground">Appliquez les changements pour mettre à jour la base de données.</p>
                </div>
                <Button onClick={handleSave} disabled={isPending} className="min-w-[150px]">
                    {isPending ? "Sauvegarde..." : "Sauvegarder Tout"}
                </Button>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {allPermissionIds.map((permId) => (
                    <PermissionCard
                        key={permId}
                        permissionId={permId}
                        allRoles={roleOptions}
                        selectedRoleIds={permState[permId] || []}
                        onRolesChange={(ids) => handlePermChange(permId, ids)}
                        onSave={handleSave}
                    />
                ))}
            </div>
        </div>
    );
}
