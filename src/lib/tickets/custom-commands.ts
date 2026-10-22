/**
 * 🎫 Tickets — **Commandes Slash Personnalisées** (pur : aucun I/O).
 *
 * Permet aux guildes de configurer jusqu'à 20 commandes slash Discord utilisables
 * exclusivement dans les salons tickets de la guilde.
 *
 * Fonctionnalités façon Dyno / DraftBot / Custom Command Bot :
 *   - Nom 1-32 minuscules, description 1-100
 *   - Réponse texte (Markdown) et/ou Embed riche stylisé
 *   - Actions : attribution/retrait de rôles à la cible, auto-clôture du ticket
 *   - Whitelist de rôles autorisés (staff ticket / rôles spécifiques / tous)
 *   - Option membre ciblé (USER) ou demandeur par défaut
 *   - Remplacement de variables complètes ({demandeur}, {cible}, {pseudo}, {motif}, {numero}, etc.)
 */

import { z } from "zod";

export const TICKET_CUSTOM_COMMANDS_MAX = 20;

export const TICKET_COMMAND_NAME_REGEX = /^[a-z0-9_-]{1,32}$/;

export interface TicketCustomCommandEmbed {
    title?: string;
    description?: string;
    color?: string; // hex string ex: "#5865F2" ou "#22c55e"
    imageUrl?: string;
    thumbnailUrl?: string;
    footer?: string;
}

export interface TicketCustomCommand {
    id: string;
    name: string;
    description: string;
    isEnabled: boolean;

    // Visibilité & Arguments
    ephemeral: boolean;
    allowTargetMember: boolean;

    // Contenu & Embed
    content: string;
    embedEnabled: boolean;
    embed?: TicketCustomCommandEmbed;

    // Actions
    addRoleIds?: string[];
    removeRoleIds?: string[];
    autoCloseTicket?: boolean;

    // Permissions
    permissionMode: "STAFF_ONLY" | "CUSTOM_ROLES" | "ALL";
    allowedRoleIds?: string[];

    createdAt: string;
    updatedAt: string;
}

export const TicketCustomCommandSaveSchema = z.object({
    id: z.string().optional(),
    name: z
        .string()
        .min(1, "Le nom est obligatoire")
        .max(32, "Le nom ne doit pas dépasser 32 caractères")
        .regex(/^[a-z0-9_-]+$/, "Le nom doit comporter uniquement des lettres minuscules, chiffres, tirets et underscores"),
    description: z
        .string()
        .min(1, "La description est obligatoire")
        .max(100, "La description ne doit pas dépasser 100 caractères"),
    isEnabled: z.boolean().default(true),
    ephemeral: z.boolean().default(false),
    allowTargetMember: z.boolean().default(true),
    content: z.string().max(2000, "Le contenu ne doit pas dépasser 2000 caractères").default(""),
    embedEnabled: z.boolean().default(false),
    embed: z
        .object({
            title: z.string().max(256).optional(),
            description: z.string().max(4096).optional(),
            color: z.string().max(16).optional(),
            imageUrl: z.string().max(512).optional(),
            thumbnailUrl: z.string().max(512).optional(),
            footer: z.string().max(2048).optional(),
        })
        .optional(),
    addRoleIds: z.array(z.string()).max(10).default([]),
    removeRoleIds: z.array(z.string()).max(10).default([]),
    autoCloseTicket: z.boolean().default(false),
    permissionMode: z.enum(["STAFF_ONLY", "CUSTOM_ROLES", "ALL"]).default("STAFF_ONLY"),
    allowedRoleIds: z.array(z.string()).default([]),
});

export type TicketCustomCommandSaveInput = z.infer<typeof TicketCustomCommandSaveSchema>;

export interface TicketCommandContext {
    demandeurId: string;
    demandeurPseudo?: string;
    demandeurTag?: string;
    demandeurAvatar?: string;
    targetId?: string;
    targetPseudo?: string;
    targetAvatar?: string;
    staffId: string;
    staffPseudo?: string;
    staffRoleIds?: string[];
    ticketNumero?: number | string;
    ticketMotif?: string;
    channelId: string;
    serverName?: string;
    formResponses?: Record<string, string>;
}

/**
 * Remplace l'ensemble des variables dynamiques dans un modèle de message ou d'embed.
 */
export function interpolateTicketCommandTokens(
    text: string | undefined | null,
    ctx: TicketCommandContext
): string {
    if (!text) return "";
    const targetId = ctx.targetId || ctx.demandeurId;
    const targetPseudo = ctx.targetPseudo || ctx.demandeurPseudo || "Membre";
    const numeroFormatted =
        typeof ctx.ticketNumero === "number"
            ? `#${String(ctx.ticketNumero).padStart(4, "0")}`
            : String(ctx.ticketNumero || "");

    const staffRoleMentions =
        ctx.staffRoleIds && ctx.staffRoleIds.length > 0
            ? ctx.staffRoleIds.map((id) => `<@&${id}>`).join(" ")
            : "@Staff";

    let res = text
        // Demandeur (créateur du ticket)
        .replace(/\{demandeur\}/gi, `<@${ctx.demandeurId}>`)
        .replace(/\{demandeur\.id\}/gi, ctx.demandeurId)
        .replace(/\{demandeur\.pseudo\}/gi, ctx.demandeurPseudo || "Demandeur")
        .replace(/\{demandeur\.avatar\}/gi, ctx.demandeurAvatar || "")
        // Cible / User (membre visé par l'option ou créateur par défaut)
        .replace(/\{cible\}/gi, `<@${targetId}>`)
        .replace(/\{user\}/gi, `<@${targetId}>`)
        .replace(/\{membre\}/gi, `<@${targetId}>`)
        .replace(/\{pseudo\}/gi, targetPseudo)
        .replace(/\{cible\.id\}/gi, targetId)
        .replace(/\{cible\.avatar\}/gi, ctx.targetAvatar || ctx.demandeurAvatar || "")
        // Modérateur exécutant (la personne du staff qui tape la commande)
        .replace(/\{staff\}/gi, `<@${ctx.staffId}>`)
        .replace(/\{moderateur\}/gi, `<@${ctx.staffId}>`)
        .replace(/\{modérateur\}/gi, `<@${ctx.staffId}>`)
        .replace(/\{auteur\}/gi, `<@${ctx.staffId}>`)
        .replace(/\{staff\.pseudo\}/gi, ctx.staffPseudo || "Staff")
        .replace(/\{moderateur\.pseudo\}/gi, ctx.staffPseudo || "Staff")
        // Équipe staff assignée au ticket (ping tous les rôles staff du ticket)
        .replace(/\{roles\}/gi, staffRoleMentions)
        .replace(/\{rôles\}/gi, staffRoleMentions)
        .replace(/\{equipe\}/gi, staffRoleMentions)
        .replace(/\{équipe\}/gi, staffRoleMentions)
        // Ticket
        .replace(/\{numero\}/gi, numeroFormatted)
        .replace(/\{ticket\.numero\}/gi, numeroFormatted)
        .replace(/\{motif\}/gi, ctx.ticketMotif || "Ticket")
        .replace(/\{salon\}/gi, `<#${ctx.channelId}>`)
        // Serveur
        .replace(/\{serveur\}/gi, ctx.serverName || "Serveur")
        .replace(/\{guilde\}/gi, ctx.serverName || "Guilde");

    // Réponses de formulaire
    if (ctx.formResponses) {
        for (const [key, val] of Object.entries(ctx.formResponses)) {
            res = res.replace(new RegExp(`\\{reponse:${key}\\}`, "gi"), val);
        }
    }

    return res;
}

/**
 * Lit la liste des commandes personnalisées de tickets depuis `TicketGuildConfig.settingsJson`.
 */
export function readTicketCustomCommands(settingsJson: unknown): TicketCustomCommand[] {
    if (!settingsJson || typeof settingsJson !== "object") return [];
    const record = settingsJson as Record<string, unknown>;
    const commands = record.customCommands;
    if (!Array.isArray(commands)) return [];
    return commands as TicketCustomCommand[];
}

/**
 * Injecte la liste des commandes personnalisées dans `settingsJson` sans modifier les autres champs.
 */
export function writeTicketCustomCommands(
    settingsJson: unknown,
    commands: TicketCustomCommand[]
): Record<string, unknown> {
    const base =
        settingsJson && typeof settingsJson === "object" && !Array.isArray(settingsJson)
            ? { ...(settingsJson as Record<string, unknown>) }
            : {};
    base.customCommands = commands.slice(0, TICKET_CUSTOM_COMMANDS_MAX);
    return base;
}

/**
 * Construit les options Discord pour une commande slash ticket.
 */
export function buildTicketSlashCommandOptions(command: TicketCustomCommand) {
    if (!command.allowTargetMember) return undefined;
    return [
        {
            name: "membre",
            description: "Membre ciblé par la commande (défaut : demandeur du ticket)",
            type: 6, // USER
            required: false,
        },
    ];
}
