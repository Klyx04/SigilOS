import { logger } from "@/lib/logger";
import { db } from "@/lib/prisma";
import { fetchChannel, listGuildMembers, renameChannel } from "@/server/discord";
import { formatTicketChannelName, ticketNameUsesCreator } from "@/lib/tickets/channel-name-format";

/**
 * 🏷️ **Renommage des salons de tickets** quand le demandeur change de pseudo Discord.
 *
 * Demande user du 25/10/2026 : « si on rename Discord quelqu'un qui a ouvert un ticket,
 * et que la balise de l'utilisateur a été setup par un staff dans le module ticket, le nom
 * du salon généré doit changer tout seul ».
 *
 * Choix d'architecture (mesuré) : le **bot gateway** est un paquet compilé à part dont
 * l'image Docker **ne copie pas `src/`** — il ne peut donc pas importer la règle de
 * nommage. Le rattrapage se fait **côté application**, dans le cron `sync-members`
 * (toutes les 30 min), qui itère déjà les guildes : une seule règle
 * (`formatTicketChannelName`), un seul endroit qui écrit.
 *
 * Garanties :
 *  - on ne touche qu'aux tickets **ouverts** (un salon fermé s'appelle `ticket-clos`) ;
 *  - on ne renomme **que** si le motif contient `{user}` (un `ticket-{num}` reste stable) ;
 *  - on ne renomme **que** si le nom mémorisé du demandeur est périmé → un renommage
 *    manuel par le staff n'est pas écrasé à chaque passage.
 */
export async function syncTicketChannelNamesForGuild(
    discordGuildId: string
): Promise<{ checked: number; renamed: number; updated: number }> {
    const result = { checked: 0, renamed: 0, updated: 0 };

    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId },
        select: { id: true },
    });
    if (!guild) return result;

    const tickets = await db.ticketRecord.findMany({
        where: {
            guildId: guild.id,
            status: "OPEN",
            discordChannelId: { not: null },
        },
        select: {
            id: true,
            ticketNumber: true,
            discordChannelId: true,
            creatorDiscordId: true,
            creatorDiscordName: true,
            category: { select: { name: true } },
            journey: { select: { name: true, namingPattern: true } },
        },
    });
    if (tickets.length === 0) return result;

    // Noms Discord **frais** (le bot met aussi `discordNickname` à jour, mais une panne
    // d'intent ne doit pas figer le rattrapage : on lit la source).
    const members = await listGuildMembers(discordGuildId, 1000).catch(() => []);
    const nameByDiscordId = new Map<string, string>();
    for (const member of members) {
        const id = String(member?.user?.id ?? "");
        if (!id) continue;
        nameByDiscordId.set(id, String(member.nick || member.user.global_name || member.user.username || id));
    }

    for (const ticket of tickets) {
        result.checked += 1;

        const freshName = nameByDiscordId.get(ticket.creatorDiscordId);
        if (!freshName) continue;
        // Pseudo inchangé ⇒ on ne fait rien (préserve un renommage manuel du staff).
        if (freshName === ticket.creatorDiscordName) continue;

        await db.ticketRecord
            .update({ where: { id: ticket.id }, data: { creatorDiscordName: freshName } })
            .catch(() => null);
        result.updated += 1;

        const pattern = ticket.journey?.namingPattern || "ticket-{num}";
        if (!ticket.discordChannelId || !ticketNameUsesCreator(pattern)) continue;

        const nextName = formatTicketChannelName(pattern, {
            number: ticket.ticketNumber,
            user: freshName,
            journey: ticket.journey?.name || ticket.category?.name || "Support",
        });

        try {
            const channel = await fetchChannel(ticket.discordChannelId);
            if (!channel || channel.name === nextName) continue;

            if (await renameChannel(ticket.discordChannelId, nextName, "SigilOS · pseudo Discord du demandeur mis à jour")) {
                result.renamed += 1;
            }
        } catch (error) {
            logger.warn("[ticket-channel-names] renommage impossible", { err: String(error) });
        }
    }

    return result;
}
