/**
 * Sondages — **publication Discord** : une seule fabrique d'embed pour tout le
 * module (création manuelle, republication, et publication automatique d'un
 * créneau programmé).
 *
 * Pourquoi ce fichier n'a **pas** `"use server"` : dans un fichier de server
 * actions, **tout export devient une server action appelable depuis le
 * client**. `publishPollToDiscord` n'a pas de contrôle d'accès propre (il est
 * appelé après les gardes de l'appelant) : l'exposer au client serait une
 * faille. Comme `src/server/account-retention-core.ts`, ce core reste donc
 * interne — importable par les actions et par le cron, jamais par l'UI.
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getAppBaseUrl } from "@/lib/utils";
import { sendChannelMessage } from "@/server/discord";
import { SCHEDULED_POLL_TAG } from "@/lib/polls/scheduling";
import { POLL_EMBED_DESCRIPTION_MAX_LENGTH } from "@/lib/polls/limits";

/**
 * Clé Redis où le worker d'outbox **ré-ancre le VRAI ID** du message posté quand
 * `DISCORD_OUTBOX_ENABLED=true` (bêta) : `sendChannelMessage` renvoie alors
 * `outbox:<jobId>`, un identifiant de **file d'attente**, pas un snowflake.
 *
 * 🐛 Constat mesuré ailleurs dans le dépôt (Marché, 18/09/2026) et valable ici :
 * stocker `outbox:<jobId>` dans `discordMessageId` fait échouer **toutes** les
 * éditions (`PATCH …/messages/outbox:…` → 404). Conséquence visible par le
 * joueur : l'embed publié sur Discord **reste figé**, les pourcentages de votes
 * ajoutés après coup ne s'affichent jamais. D'où : on pose la clé à l'envoi, on
 * la résout à chaque édition, et on **persiste** le vrai ID dès qu'il est connu.
 */
export function pollMessageKey(pollId: string): string {
    return `poll:msg:${pollId}`;
}

/** Résout l'ID réel d'un message de sondage (snowflake direct ou outbox → Redis). */
async function resolvePollMessageId(stored: string | null | undefined, pollId: string): Promise<string | null> {
    if (!stored) return null;
    const { isDiscordSnowflake, isOutboxMessageId } = await import("@/lib/discord-ids");
    if (isDiscordSnowflake(stored)) return stored;
    if (!isOutboxMessageId(stored)) return null;
    try {
        const { redis } = await import("@/lib/redis");
        const resolved = await redis.get(pollMessageKey(pollId));
        return isDiscordSnowflake(resolved) ? resolved : null;
    } catch {
        // Redis indisponible ⇒ on préfère ne pas éditer plutôt qu'éditer dans le vide.
        return null;
    }
}

/**
 * Description « propre » pour un embed Discord : retours à la ligne **préservés**
 * (chaque ligne devient une ligne de citation), balises HTML retirées, texte
 * borné — le reste vit dans SigilOS, jamais tronqué en pleine phrase sans le dire.
 */
function embedDescriptionBlock(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const cleaned = String(raw)
        .replace(/<[^>]*>/g, " ")
        .replace(/\r\n?/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    if (!cleaned) return null;

    const truncated = cleaned.length > POLL_EMBED_DESCRIPTION_MAX_LENGTH;
    const body = truncated
        ? cleaned.slice(0, POLL_EMBED_DESCRIPTION_MAX_LENGTH).trimEnd() + "…"
        : cleaned;

    const quoted = body
        .split("\n")
        .map((line) => (line.trim().length > 0 ? `> ${line}` : ">"))
        .join("\n");

    return truncated ? `${quoted}\n> *…suite sur SigilOS*` : quoted;
}

export type PollCategory = "SUGGESTION" | "AMELIORATION" | "EVENT" | "MISSION" | "AUTRE";

/** Palette/emoji par catégorie (couleur numérique = couleur d'embed Discord). */
export const POLL_CATEGORY_CONFIG: Record<PollCategory, { label: string; color: number; emoji: string }> = {
    SUGGESTION: {
        label: "💡 Suggestion",
        color: 0x06b6d4,
        emoji: "💡",
    },
    AMELIORATION: {
        label: "🔧 Amélioration",
        color: 0x10b981,
        emoji: "🔧",
    },
    EVENT: {
        label: "🎉 Événement",
        color: 0xf59e0b,
        emoji: "🎉",
    },
    MISSION: {
        label: "🎯 Mission",
        color: 0xef4444,
        emoji: "🎯",
    },
    AUTRE: {
        label: "📋 Autres",
        color: 0x8b5cf6,
        emoji: "📋",
    },
};

/** Emojis numérotés des options (préfixe quand l'option n'a pas d'emoji). */
export const POLL_NUMBER_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

/**
 * Generates a visual progress bar for Discord embeds.
 */
export function getProgressBar(percentage: number, length = 12): string {
    const filledLength = Math.max(0, Math.min(length, Math.round((percentage / 100) * length)));
    const emptyLength = length - filledLength;
    // Using standard Discord emojis for better compatibility
    const filled = "🟩".repeat(filledLength);
    const empty = "⬜".repeat(emptyLength);
    return filled + empty;
}

/**
 * Publie (ou met à jour) l'embed interactif d'un sondage dans un salon Discord.
 * Idempotent côté salon : un embed déjà publié est **modifié**, jamais dupliqué.
 *
 * `isUpdate` court-circuite la validation du salon (l'embed existe déjà, donc le
 * salon est connu) — c'est le seul cas où la validation est sautée.
 */
/**
 * Ce qu'a fait une publication : l'appelant peut le **dire** à l'utilisateur
 * (un embed dont l'ID de message n'est pas résolu n'a **pas** été modifié, et un
 * rattrapage doit le compter, pas le taire).
 */
export type PollPublishOutcome = "sent" | "updated" | "skipped" | "unresolved" | "failed";

export async function publishPollToDiscord(
    discordGuildId: string,
    pollId: string,
    channelId: string,
    mentionEveryone: boolean,
    mentionRoleId?: string,
    isUpdate = false
): Promise<PollPublishOutcome> {
    try {
        const { updateChannelMessage, validateChannelBelongsToGuild } = await import("@/server/discord");

        // Security: validate channel belongs to guild (only on initial publish)
        if (!isUpdate) {
            const isValid = await validateChannelBelongsToGuild(channelId, discordGuildId);
            if (!isValid) {
                logger.error("[Polls] Channel does not belong to guild", { channelId, discordGuildId });
                return "failed";
            }
        }

        const poll = await db.poll.findUnique({
            where: { id: pollId },
            include: {
                options: {
                    include: {
                        _count: { select: { votes: true } },
                        votes: {
                            select: {
                                voter: { select: { pseudoDofus: true, discordNickname: true } },
                            },
                            take: 5, // récupère les 5 premiers pour le preview embed
                        },
                    },
                    orderBy: { order: "asc" }
                },
                creator: { include: { user: { select: { image: true } } } }
            },
        });
        if (!poll) return "skipped";

        const catConfig = POLL_CATEGORY_CONFIG[poll.category as PollCategory];
        const appUrl = getAppBaseUrl();
        const voteUrl = `${appUrl}/dashboard/${discordGuildId}/sondages/${pollId}`;

        // Calculate total votes
        const totalVotes = poll.options.reduce((acc, opt) => acc + (opt._count.votes || 0), 0);

        // Build options list with progress bars
        // Each option gets a numbered label (e.g. 1️⃣) matching the button below
        const optionsList = poll.options
            .map((o: any, i: number) => {
                const votes = o._count.votes || 0;
                const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                const bar = getProgressBar(pct, 10);
                const prefix = o.emoji ? o.emoji : (POLL_NUMBER_EMOJIS[i] || `${i + 1}.`);

                // Affiche les noms des votants pour les sondages non-anonymes
                let votersLine = "";
                if (!poll.isAnonymous && o.votes && o.votes.length > 0) {
                    const names = (o.votes as any[]).slice(0, 3).map((v: any) =>
                        v.voter.pseudoDofus || v.voter.discordNickname || "Membre"
                    );
                    const remaining = votes - (o.votes as any[]).length;
                    const suffix = remaining > 0 ? ` +${remaining} autres` : "";
                    votersLine = `\n👥 *${names.join(", ")}${suffix}*`;
                }

                return `${prefix} **${o.label}**\n${bar} \`${pct}%\` (${votes} vote${votes !== 1 ? 's' : ''})${votersLine}`;
            })
            .join("\n\n");

        const descriptionParts = [];

        // Tag « Sondage programmé » : le lecteur Discord doit savoir que ce
        // sondage a été publié automatiquement, pas à la main.
        if ((poll as { isScheduled?: boolean }).isScheduled) {
            descriptionParts.push(`> 🗳️ **${SCHEDULED_POLL_TAG}** — publié automatiquement`);
        }

        if (poll.description) {
            const block = embedDescriptionBlock(poll.description);
            if (block) descriptionParts.push(block);
        }

        if (poll.externalUrl) {
            descriptionParts.push(`🔗 **Source externe :** [Ouvrir le lien ↗](${poll.externalUrl})`);
        }

        descriptionParts.push(`\n**📊 Choix :**\n${optionsList}`);

        const metadata = [];
        if (poll.expiresAt) {
            metadata.push(`⏰ **Expire** — <t:${Math.floor(poll.expiresAt.getTime() / 1000)}:R>`);
        }
        metadata.push(poll.allowMultipleVotes ? "✅ **Votes multiples** — Autorisés" : "👆 **Vote unique** — Un seul choix");

        if (poll.isAnonymous) {
            metadata.push("🕵️ **Anonymat** — Activé");
        }

        if ((poll as { isScheduled?: boolean }).isScheduled) {
            metadata.push(`🗳️ **${SCHEDULED_POLL_TAG}**`);
        }

        descriptionParts.push(`\n---\n${metadata.join(" · ")}`);
        descriptionParts.push(`\n*👉 Clique sur le bouton correspondant à ton choix pour voter !*`);
        descriptionParts.push(`*Seuls les membres de la guilde peuvent voter via [SigilOS](${voteUrl})*`);

        const description = descriptionParts.join("\n");

        // Build mention content (only on first publish)
        let mentionContent: string | undefined;
        if (!isUpdate) {
            if (mentionEveryone) {
                mentionContent = "Bonjour @everyone !";
            } else if (mentionRoleId) {
                if (mentionRoleId === "here") {
                    mentionContent = "Bonjour @here !";
                } else {
                    // Multi-rôles stockés CSV (pattern DJ/songes)
                    const roleMentions = mentionRoleId.split(",").map(id => `<@&${id.trim()}>`).join(" ");
                    mentionContent = `Bonjour ${roleMentions} !`;
                }
            }
        }

        // === BUTTONS ===
        // Discord allows max 5 ActionRows with max 5 buttons each.
        // Strategy: group vote buttons 2 per row → max 5 rows for 10 options.
        // Reserve the last row for the Link button.
        const discordComponents: any[] = [];

        // Build vote buttons — always 2 per ActionRow for visual clarity
        const optionButtons = poll.options.map((o: any, i: number) => {
            // Truncate label for Discord button (max 80 chars)
            const rawLabel = `${o.emoji ? '' : (POLL_NUMBER_EMOJIS[i] ? '' : `${i + 1}. `)}${o.label}`;
            const truncated = rawLabel.length > 75 ? rawLabel.substring(0, 72) + "..." : rawLabel;
            return {
                type: 2, // Button
                style: 1, // Primary (blurple)
                label: truncated,
                emoji: o.emoji ? { name: o.emoji } : (POLL_NUMBER_EMOJIS[i] ? { name: POLL_NUMBER_EMOJIS[i] } : undefined),
                custom_id: `poll:vote:${o.id}`,
            };
        });

        // Chunk into rows of 2 buttons each
        const buttonRows: any[] = [];
        for (let i = 0; i < optionButtons.length; i += 2) {
            buttonRows.push({
                type: 1, // ActionRow
                components: optionButtons.slice(i, i + 2)
            });
        }

        // We have max 4 button rows for options + 1 row for link button = 5 total
        // If we overflow (> 4 vote rows), compress last row with link button together
        const linkButton = {
            type: 2,
            style: 5, // Link
            label: "🌐 Résultats & Détails",
            url: voteUrl,
        };

        if (buttonRows.length < 5) {
            // Room for a dedicated link row
            buttonRows.forEach(row => discordComponents.push(row));
            discordComponents.push({ type: 1, components: [linkButton] });
        } else {
            // Overflow: append link button to the last row (it will have ≤2+1=3 buttons — within Discord's limit of 5)
            buttonRows.forEach(row => discordComponents.push(row));
            discordComponents[discordComponents.length - 1].components.push(linkButton);
        }

        const embedOptions = {
            embedTitle: `📊 ${poll.title.toUpperCase()}`,
            embedColor: catConfig.color,
            embedFooter: `SigilOS • ${catConfig.label}`,
            embedAuthor: {
                name: `Sondage lancé par ${poll.creatorName}`,
                iconUrl: (poll.creator as any)?.user?.image || undefined
            },
            // embedUrl intentionnellement absent : évite que le titre de l'embed
            // soit cliquable (confusion avec le lien externe du sondage).
            // La navigation vers le dashboard se fait via le bouton "Résultats & Détails".
            mentionContent,
            components: discordComponents,
        };

        if (isUpdate && poll.discordMessageId && poll.discordChannelId) {
            // Résolution outbox → snowflake réel (sinon PATCH 404 et **embed figé** :
            // les pourcentages de votes ajoutés après coup ne s'afficheraient jamais).
            const realMessageId = await resolvePollMessageId(poll.discordMessageId, pollId);
            if (!realMessageId) {
                logger.warn("[Polls] Embed non rafraîchi : ID de message non résolu (écriture en file pas encore passée)", {
                    pollId,
                    discordMessageId: poll.discordMessageId,
                });
                return "unresolved";
            }
            await updateChannelMessage(poll.discordChannelId, realMessageId, description, embedOptions);
            if (realMessageId !== poll.discordMessageId) {
                // On ancre l'ID définitif : les éditions suivantes sont directes.
                await (db as any).poll.update({
                    where: { id: pollId },
                    data: { discordMessageId: realMessageId },
                }).catch(() => null);
            }
            return "updated";
        } else {
            const messageId = await sendChannelMessage(channelId, description, {
                ...embedOptions,
                // Le worker ré-ancre le vrai snowflake à cette clé quand l'outbox
                // est active : sans elle, l'ID stocké reste `outbox:<jobId>`.
                storeMessageIdKey: pollMessageKey(pollId),
            });
            if (messageId) {
                await (db as any).poll.update({
                    where: { id: pollId },
                    data: { discordMessageId: messageId, discordChannelId: channelId },
                });
            }
            return "sent";
        }
    } catch (error) {
        logger.error("[Polls] publishToDiscord error", { error, pollId, channelId });
        return "failed";
    }
}

export interface PollResultOptions {
    /** Titre du bloc de décision (« Décision Finale » d'un admin, fin d'occurrence…). */
    decisionTitle: string;
    /** Corps du bloc : ce qui est décidé, ou pourquoi le vote se termine. */
    decision: string;
    /** Pied d'embed : **qui** a clôturé (administrateur, clôture automatique…). */
    footer: string;
}

/**
 * Publie le **résultat** d'un vote dans le salon : un **message neuf** (jamais un
 * remplacement d'embed — le résultat doit rester lisible même si l'embed
 * interactif a été supprimé), barres figées, pourcentages, décision.
 *
 * Une seule fabrique pour les **deux** clôtures : manuelle (décision d'un admin,
 * via `closePoll`) et automatique (fin d'une occurrence de série récurrente,
 * avant que la suivante n'apparaisse). Deux textes, un seul rendu.
 */
export async function publishPollResultToDiscord(
    discordGuildId: string,
    pollId: string,
    options: PollResultOptions,
): Promise<boolean> {
    try {
        const poll = await db.poll.findUnique({
            where: { id: pollId },
            include: { options: { include: { _count: { select: { votes: true } } } } },
        });
        if (!poll || !poll.discordChannelId) return false;

        const catConfig = POLL_CATEGORY_CONFIG[poll.category as PollCategory];
        const appUrl = getAppBaseUrl();
        const voteUrl = `${appUrl}/dashboard/${discordGuildId}/sondages/${pollId}`;

        const totalVotes = poll.options.reduce((acc, option) => acc + (option._count.votes || 0), 0);
        const resultsList = poll.options
            .map((option) => {
                const votes = option._count.votes || 0;
                const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                const votesLabel = `(${votes} vote${votes !== 1 ? "s" : ""})`;
                return `**${option.emoji || "🔹"} ${option.label}**\n${getProgressBar(pct, 10)} \`${pct}%\` ${votesLabel}`;
            })
            .join("\n\n");

        const description = [
            "## 📊 Résultats du vote",
            "",
            resultsList,
            "",
            "---",
            "",
            `### 📝 ${options.decisionTitle} :`,
            options.decision,
            "",
            `*📌 Retrouvez le détail sur [SigilOS](${voteUrl})*`,
        ].join("\n");

        await sendChannelMessage(poll.discordChannelId, description, {
            embedTitle: `🏁 SONDAGE TERMINÉ : ${poll.title.toUpperCase()}`,
            embedColor: catConfig.color,
            embedFooter: options.footer,
            embedUrl: voteUrl,
        });
        return true;
    } catch (error) {
        logger.error("[Polls] publishPollResultToDiscord error", { error, pollId });
        return false;
    }
}
