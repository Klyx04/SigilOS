/**
 * 🔐 **Permission par mapping local** (pur, sans I/O).
 *
 * Pourquoi cette règle existe (mesure du 24/10/2026) : pour **ouvrir** la modale de
 * `/valider-recrue`, la route appelait `internalCheckPermission`, qui fait **trois
 * appels à l'API Discord** (membre, serveur, rôles) **avant** de répondre. Sous
 * rate-limit, l'interaction dépassait les 3 s → « SigilOS beta n'a pas répondu à
 * temps », systématiquement.
 *
 * Or Discord **fournit déjà** les rôles et le flag admin dans la payload : le mapping
 * de rôles vit en base (`GuildConfig.rolesMapping` / `usersMapping`). Cette règle
 * calcule la permission **en mémoire** — zéro appel réseau, donc un ACK immédiat.
 *
 * Fail-closed : entrée illisible ⇒ pas de permission.
 */

import type { PermissionId } from "@/lib/permissions";

type PermissionMap = Record<string, readonly string[]>;

function readPermissionMap(raw: unknown): PermissionMap {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const clean: PermissionMap = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        if (!Array.isArray(value)) continue;
        const ids = value.filter((entry): entry is string => typeof entry === "string");
        if (ids.length > 0) clean[key] = ids;
    }
    return clean;
}

/** Permission `SYSTEM_CONFIG` ouvre tout le reste (même règle que `getUserContext`). */
const SYSTEM_CONFIG_PERMISSION = "system:config";

export function hasMappedPermission(input: {
    memberRoleIds: readonly string[] | null | undefined;
    discordUserId: string | null | undefined;
    rolesMapping: unknown;
    usersMapping: unknown;
    permission: PermissionId;
}): boolean {
    const roleIds = Array.isArray(input.memberRoleIds) ? input.memberRoleIds : [];
    const rolesMapping = readPermissionMap(input.rolesMapping);
    const usersMapping = readPermissionMap(input.usersMapping);
    const userId = typeof input.discordUserId === "string" ? input.discordUserId : "";

    const granted = new Set<string>();
    for (const roleId of roleIds) {
        for (const permission of rolesMapping[roleId] ?? []) granted.add(permission);
    }
    if (userId) {
        for (const permission of usersMapping[userId] ?? []) granted.add(permission);
    }

    return granted.has(SYSTEM_CONFIG_PERMISSION) || granted.has(input.permission);
}
