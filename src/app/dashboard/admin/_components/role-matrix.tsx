"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useState, useTransition } from "react";
import { updateRoleMapping } from "@/server/actions/admin-actions";
import { PERMISSIONS, PERMISSION_LABELS, type PermissionId } from "@/lib/permissions";
import { toast } from "sonner";

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

export function RoleMatrix({ guildId, roles, currentMapping }: Props) {
    const [mapping, setMapping] = useState<Record<string, PermissionId[]>>(currentMapping);
    const [isPending, startTransition] = useTransition();

    const togglePermission = (roleId: string, permId: PermissionId) => {
        setMapping((prev) => {
            const rolePerms = prev[roleId] || [];
            const hasPerm = rolePerms.includes(permId);
            const newPerms = hasPerm
                ? rolePerms.filter((p) => p !== permId)
                : [...rolePerms, permId];

            return { ...prev, [roleId]: newPerms };
        });
    };

    const handleSave = () => {
        startTransition(async () => {
            const res = await updateRoleMapping(guildId, mapping);
            if (res.success) {
                toast.success("Permissions mises à jour");
            } else {
                toast.error(res.error || "Échec de sauvegarde");
            }
        });
    };

    const permissionIds = Object.values(PERMISSIONS);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Matrice des Rôles</h2>
                <Button onClick={handleSave} disabled={isPending}>
                    {isPending ? "Sauvegarde..." : "Sauvegarder"}
                </Button>
            </div>

            <div className="overflow-x-auto border rounded-lg bg-card text-card-foreground shadow-sm">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted text-muted-foreground border-b">
                        <tr>
                            <th className="p-3 font-medium whitespace-nowrap">Rôle</th>
                            {permissionIds.map((perm) => (
                                <th key={perm} className="p-3 font-medium min-w-[120px] text-center whitespace-nowrap">
                                    {PERMISSION_LABELS[perm]}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {roles.map((role) => (
                            <tr key={role.id} className="hover:bg-muted/50 transition-colors">
                                <td className="p-3 font-medium flex items-center gap-2 border-r bg-background/50 sticky left-0">
                                    {/* Discord Color Circle */}
                                    <span
                                        className="w-3 h-3 rounded-full shrink-0"
                                        style={{ backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5' }}
                                    />
                                    <span className="truncate max-w-[150px]" title={role.name}>{role.name}</span>
                                </td>
                                {permissionIds.map((perm) => {
                                    const isChecked = (mapping[role.id] || []).includes(perm);
                                    return (
                                        <td key={perm} className="p-3 text-center border-l border-muted/20">
                                            <div className="flex justify-center">
                                                <Checkbox
                                                    checked={isChecked}
                                                    onCheckedChange={() => togglePermission(role.id, perm)}
                                                />
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
