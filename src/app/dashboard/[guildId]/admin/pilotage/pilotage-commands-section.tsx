import { SlashCommandsRbacPanel } from "@/components/admin/SlashCommandsRbacPanel";

/**
 * Onglet Commandes du Pilotage — gestion des commandes slash, natifs Discord
 * uniquement (la page /admin/commandes applique la même gate). Données
 * chargées ici pour isoler l'onglet (chaque onglet ne rend que son contenu).
 */
export async function PilotageCommandsSection({ guildId }: { guildId: string }) {
    const { db } = await import("@/lib/prisma");
    const { fetchGuildRoles, fetchGuildChannels } = await import("@/server/discord");

    const config = await db.guildConfig.findFirst({
        where: { OR: [{ id: guildId }, { discordGuildId: guildId }] },
        select: { id: true, discordGuildId: true },
    });
    if (!config) return null;

    const actualDiscordId = config.discordGuildId || (/^\d+$/.test(guildId) ? guildId : "");
    const [permissions, rawRoles, rawChannels] = await Promise.all([
        db.guildSlashCommandPermission.findMany({ where: { guildId: config.id } }),
        actualDiscordId ? fetchGuildRoles(actualDiscordId).catch(() => []) : [],
        actualDiscordId ? fetchGuildChannels(actualDiscordId).catch(() => []) : [],
    ]);

    const { SLASH_COMMANDS_CATALOG } = await import("@/lib/slash-commands-catalog");
    const permMap = new Map(permissions.map((p) => [p.commandName, p]));
    const slashPerms = SLASH_COMMANDS_CATALOG.map((cmd) => {
        const existing = permMap.get(cmd.name);
        return {
            command: cmd,
            isEnabled: existing ? existing.isEnabled : true,
            roleIds: existing ? existing.roleIds : [],
            channelIds: existing ? existing.channelIds : [],
            config: (existing?.config as { addRoleId: string | null; removeRoleId: string | null } | null) ?? null,
        };
    });

    return (
        <section className="space-y-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-foreground px-1">
                Commandes Slash Discord
            </h2>
            <SlashCommandsRbacPanel
                guildId={config.id}
                initialMatrix={slashPerms}
                discordRoles={(rawRoles as any[]).map((r: any) => ({ id: r.id, name: r.name, color: r.color }))}
                discordChannels={(rawChannels as any[])
                    .filter((c: any) => c.type === 0 || c.type === 5)
                    .map((c: any) => ({ id: c.id, name: c.name || "salon" }))}
            />
        </section>
    );
}
