import Link from "next/link";
import { Crown, ShieldAlert, Users, ArrowRight } from "lucide-react";
import { db } from "@/lib/prisma";
import { fetchGuild, fetchGuildRoles, listGuildMembers } from "@/server/discord";
import { PERMISSIONS } from "@/lib/permissions";

/**
 * P1 — Gouvernance & continuité (console owner, natifs Discord uniquement).
 * Affiche qui peut administrer la guilde : owner SigilOS vs owner Discord
 * (alerte divergence), admins natifs live, délégués god/rbac. Le transfert
 * existe déjà (table membres) — on y renvoie au lieu de dupliquer.
 */
export async function GovernanceWidget({ guildId }: { guildId: string }) {
    const config = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: {
            id: true, name: true, ownerId: true,
            rolesMapping: true, usersMapping: true,
        },
    }).catch(() => null);
    if (!config) return null;

    const [discordGuild, roles] = await Promise.all([
        fetchGuild(guildId).catch(() => null),
        fetchGuildRoles(guildId, { excludeManaged: false }).catch(() => [] as any[]),
    ]);

    const roleNameOf = (id: string) => roles.find((r: any) => r.id === id)?.name || id.slice(0, 6);
    const adminRoleIds = roles.filter((r: any) => { try { return (BigInt(r.permissions || 0) & 0x8n) === 0x8n; } catch { return false; } }).map((r: any) => r.id);

    // Owner SigilOS → pseudo d'affichage
    let sigilosOwnerLabel: string | null = null;
    let sigilosOwnerActive = false;
    if (config.ownerId) {
        const ownerProfile = await db.userProfile.findFirst({
            where: {
                guildId: config.id,
                OR: [{ userId: config.ownerId }, { user: { accounts: { some: { providerAccountId: config.ownerId } } } }],
            },
            select: { status: true, pseudoDofus: true, discordNickname: true },
        }).catch(() => null);
        if (ownerProfile) {
            sigilosOwnerActive = ownerProfile.status === "ACTIVE";
            sigilosOwnerLabel = ownerProfile.pseudoDofus || ownerProfile.discordNickname || "Propriétaire";
        }
    }
    const discordOwnerId: string | null = (discordGuild as any)?.owner_id || null;
    const mismatch = !!discordOwnerId && !!config.ownerId && sigilosOwnerActive && !await isSamePerson(config.ownerId, discordOwnerId);

    // Admins natifs live (owner Discord + membres avec rôle 0x8), cap affichage.
    let nativeAdmins: string[] = [];
    try {
        const members = await listGuildMembers(guildId, 1000).catch(() => [] as any[]);
        const list: any[] = Array.isArray(members) ? members : (members as any)?.members || [];
        nativeAdmins = list
            .filter((m: any) => m?.user?.id === discordOwnerId || (m?.roles || []).some((r: string) => adminRoleIds.includes(r)))
            .map((m: any) => m?.nick || m?.user?.global_name || m?.user?.username || m?.user?.id)
            .filter(Boolean)
            .slice(0, 12);
    } catch { /* affichage dégradé */ }

    // Délégués : rôles/membres portant system:god ou system:rbac
    const mapping = (config.rolesMapping || {}) as Record<string, string[]>;
    const delegatedRoles = Object.entries(mapping)
        .filter(([, perms]) => Array.isArray(perms) && (perms.includes(PERMISSIONS.SYSTEM_GOD) || perms.includes(PERMISSIONS.SYSTEM_RBAC)))
        .map(([roleId]) => roleNameOf(roleId));
    const usersMapping = (config.usersMapping || {}) as Record<string, string[]>;
    const delegatedUsers = Object.entries(usersMapping)
        .filter(([, perms]) => Array.isArray(perms) && (perms.includes(PERMISSIONS.SYSTEM_GOD) || perms.includes(PERMISSIONS.SYSTEM_RBAC)))
        .map(([uid]) => uid);

    return (
        <div className="rounded-2xl border border-border bg-surface p-6 space-y-4">
            <div className="flex items-center gap-3">
                <Crown className="w-5 h-5 text-warning" />
                <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Gouvernance & continuité</h3>
            </div>

            {mismatch && (
                <div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/10 px-3.5 py-3">
                    <ShieldAlert className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    <p className="text-xs text-warning/90 font-medium leading-relaxed">
                        Le propriétaire Discord et le propriétaire SigilOS ne correspondent plus.
                        Pensez à transférer la propriété (table Membres) pour garder une continuité.
                    </p>
                </div>
            )}

            <dl className="grid sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-black/20 border border-border p-3">
                    <dt className="text-muted-foreground uppercase tracking-wider font-bold">Propriétaire SigilOS</dt>
                    <dd className="text-foreground font-bold mt-1">
                        {sigilosOwnerLabel || "Non défini"}
                        {config.ownerId && (
                            <span className={sigilosOwnerActive ? "text-success" : "text-danger"}> · {sigilosOwnerActive ? "actif" : "inactif"}</span>
                        )}
                    </dd>
                </div>
                <div className="rounded-xl bg-black/20 border border-border p-3">
                    <dt className="text-muted-foreground uppercase tracking-wider font-bold">Admins natifs Discord</dt>
                    <dd className="mt-2">
                        {nativeAdmins.length > 0 ? (
                            <ul className="flex flex-wrap gap-1.5">
                                {nativeAdmins.map((name) => (
                                    <li
                                        key={name}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 border border-success/25 text-success text-xs font-bold"
                                    >
                                        <Users className="w-3 h-3" />
                                        {name}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <span className="text-muted-foreground text-xs font-bold">aucun détecté</span>
                        )}
                    </dd>
                </div>
            </dl>

            <p className="text-xs text-muted-foreground leading-relaxed">
                Secours délégués : {delegatedRoles.length > 0 ? `rôles ${delegatedRoles.join(", ")}` : "aucun rôle"} ·{" "}
                {delegatedUsers.length > 0 ? `${delegatedUsers.length} membre(s) individuel(s)` : "aucun membre individuel"}.
                Sans admin natif ni délégué, seule une récupération God est possible.
            </p>

            <Link
                href={`/dashboard/${guildId}/admin/members`}
                className="inline-flex items-center gap-2 text-xs font-bold text-success hover:underline"
            >
                Gérer les membres & transferts <ArrowRight className="w-3.5 h-3.5" />
            </Link>
        </div>
    );
}

async function isSamePerson(storedOwnerId: string, discordOwnerId: string): Promise<boolean> {
    if (storedOwnerId === discordOwnerId) return true;
    try {
        const account = await db.account.findFirst({
            where: { provider: "discord", providerAccountId: discordOwnerId },
            select: { userId: true },
        });
        return !!account && account.userId === storedOwnerId;
    } catch {
        return false;
    }
}
