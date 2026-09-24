/**
 * Moteur pur du diagnostic Discord — testable sans DB ni API Discord.
 * Importé par discord-guild-audit-actions.ts.
 */

// ─── Permissions Discord (bitfield) ───────────────────────────────────────────

export const AUDIT_PERM = {
    VIEW_CHANNEL:           1n << 10n,
    SEND_MESSAGES:          1n << 11n,
    MANAGE_MESSAGES:        1n << 13n,
    EMBED_LINKS:            1n << 14n,
    READ_MESSAGE_HISTORY:   1n << 16n,
    USE_EXTERNAL_EMOJIS:    1n << 18n,
    MANAGE_ROLES:           1n << 28n,
    MANAGE_CHANNELS:        1n << 4n,
    CREATE_PUBLIC_THREADS:  1n << 35n,
    ADMINISTRATOR:          1n << 3n,
} as const;

export const POST_EMBED_PERMS = AUDIT_PERM.VIEW_CHANNEL | AUDIT_PERM.SEND_MESSAGES | AUDIT_PERM.EMBED_LINKS;

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuditStatus = "operational" | "warning" | "blocked" | "unknown" | "not_applicable";

export type ChannelSuggestion = {
    channelType: "TEXT" | "ANNOUNCEMENT" | "FORUM";
    suggestedName: string;
    purpose: string;
    steps: string[];
};

export type AuditFinding = {
    capabilityId: string;
    status: AuditStatus;
    title: string;
    impact?: string;
    remedy?: string;
    technicalDetail?: string;
    settingsHref?: string;
    suggestion?: ChannelSuggestion;
};

export type DiscordChannelLike = {
    id: string;
    name: string | null;
    type: number;
    position?: number;
    permission_overwrites?: { id: string; type: number; allow: string; deny: string }[];
};

export type DiscordRoleLike = {
    id: string;
    name: string;
    position: number;
    permissions: string;
};

export type AuditEngineContext = {
    /** discordGuildId (aussi = id du rôle @everyone) */
    guildId: string;
    channels: DiscordChannelLike[];
    roles: DiscordRoleLike[];
    botUserId: string;
    botRoleIds: string[];
    botHighestPosition: number;
    botGlobalPerms: bigint;
};

// ─── Calcul des permissions effectives ────────────────────────────────────────

export function computeEffectivePermissions(
    ctx: AuditEngineContext,
    channel: DiscordChannelLike,
): bigint {
    let basePerm = 0n;
    for (const role of ctx.roles) {
        if (role.id === ctx.guildId || ctx.botRoleIds.includes(role.id)) {
            basePerm |= BigInt(role.permissions);
        }
    }
    if (basePerm & AUDIT_PERM.ADMINISTRATOR) return ~0n;

    const overwrites = channel.permission_overwrites ?? [];

    const everyoneOw = overwrites.find(o => o.id === ctx.guildId && o.type === 0);
    if (everyoneOw) {
        basePerm &= ~BigInt(everyoneOw.deny);
        basePerm |= BigInt(everyoneOw.allow);
    }

    let roleAllow = 0n, roleDeny = 0n;
    for (const ow of overwrites) {
        if (ow.type === 0 && ctx.botRoleIds.includes(ow.id)) {
            roleAllow |= BigInt(ow.allow);
            roleDeny |= BigInt(ow.deny);
        }
    }
    basePerm &= ~roleDeny;
    basePerm |= roleAllow;

    const memberOw = overwrites.find(o => o.id === ctx.botUserId && o.type === 1);
    if (memberOw) {
        basePerm &= ~BigInt(memberOw.deny);
        basePerm |= BigInt(memberOw.allow);
    }

    return basePerm;
}

// ─── Noms des permissions manquantes ─────────────────────────────────────────

export function missingPermNames(required: bigint, effective: bigint): string[] {
    const missing = required & ~effective;
    const names: string[] = [];
    for (const [name, bit] of Object.entries(AUDIT_PERM)) {
        if (missing & (bit as bigint)) names.push(name);
    }
    return names;
}

// ─── Check salon + permissions ────────────────────────────────────────────────

export function checkChannelPermsEngine(
    ctx: AuditEngineContext,
    channelId: string | null | undefined,
    capabilityId: string,
    opts: {
        label: string;
        impact: string;
        remedy: string;
        settingsHref?: string;
        requiredPerms?: bigint;
        suggestion?: ChannelSuggestion;
    },
): AuditFinding {
    if (!channelId) {
        return {
            capabilityId,
            status: "blocked",
            title: `${opts.label} — salon à configurer`,
            impact: opts.impact,
            remedy: opts.suggestion
                ? "Créez le salon sur Discord, puis configurez-le dans SigilOS."
                : `Configurez un salon dans les réglages : ${opts.remedy}`,
            settingsHref: opts.settingsHref,
            suggestion: opts.suggestion,
        };
    }

    const channel = ctx.channels.find(c => c.id === channelId);
    if (!channel) {
        return {
            capabilityId,
            status: "blocked",
            title: `${opts.label} — salon introuvable ou inaccessible`,
            impact: opts.impact,
            remedy: `Le salon configuré (ID ${channelId}) est introuvable ou le bot n'y a pas accès. ${opts.remedy}`,
            technicalDetail: `Canal ID ${channelId} absent de la liste des salons visibles par le bot.`,
            settingsHref: opts.settingsHref,
        };
    }

    const required = opts.requiredPerms ?? POST_EMBED_PERMS;
    const effective = computeEffectivePermissions(ctx, channel);
    const missing = missingPermNames(required, effective);

    if (missing.length > 0) {
        return {
            capabilityId,
            status: "blocked",
            title: `${opts.label} — permissions insuffisantes dans #${channel.name ?? channelId}`,
            impact: opts.impact,
            remedy: `Dans les paramètres Discord de #${channel.name ?? channelId}, autorisez le bot : ${missing.join(", ")}. ${opts.remedy}`,
            technicalDetail: `Permissions manquantes : ${missing.join(", ")} dans #${channel.name} (ID ${channelId}).`,
            settingsHref: opts.settingsHref,
        };
    }

    return {
        capabilityId,
        status: "operational",
        title: opts.label,
        technicalDetail: `#${channel.name ?? channelId} — accessible, permissions OK.`,
        settingsHref: opts.settingsHref,
    };
}

// ─── Check hiérarchie de rôle ────────────────────────────────────────────────

export function checkRoleHierarchyEngine(
    ctx: AuditEngineContext,
    roleId: string | null | undefined,
    capabilityId: string,
    label: string,
    impact: string,
    settingsHref?: string,
): AuditFinding | null {
    if (!roleId) return null;

    const role = ctx.roles.find(r => r.id === roleId);
    if (!role) {
        return {
            capabilityId,
            status: "warning",
            title: `${label} — rôle introuvable`,
            impact,
            remedy: `Le rôle configuré (ID ${roleId}) n'existe plus sur Discord. Vérifiez qu'il n'a pas été supprimé.`,
            settingsHref,
        };
    }

    if (ctx.botHighestPosition <= role.position) {
        return {
            capabilityId,
            status: "blocked",
            title: `${label} — rôle du bot trop bas dans la hiérarchie`,
            impact,
            remedy: `Dans les paramètres Discord du serveur (Rôles), placez le rôle du bot au-dessus du rôle « ${role.name} ». Le bot (position ${ctx.botHighestPosition}) doit être plus haut que la cible (position ${role.position}).`,
            technicalDetail: `Bot position ${ctx.botHighestPosition}, rôle cible « ${role.name} » position ${role.position}.`,
            settingsHref,
        };
    }

    return null;
}

// ─── Check permissions globales bot ──────────────────────────────────────────

export function checkBotGlobalPerms(ctx: AuditEngineContext): AuditFinding[] {
    const perms = ctx.botGlobalPerms;

    if (perms & AUDIT_PERM.ADMINISTRATOR) {
        return [{
            capabilityId: "bot-global-perms",
            status: "operational",
            title: "Permissions globales du bot",
            technicalDetail: "ADMINISTRATOR présent — toutes les opérations sont autorisées.",
        }];
    }

    const findings: AuditFinding[] = [];

    const requiredBase: { bit: bigint; name: string; impact: string }[] = [
        { bit: AUDIT_PERM.SEND_MESSAGES, name: "Envoyer des messages", impact: "Le bot ne pourra poster aucun message." },
        { bit: AUDIT_PERM.EMBED_LINKS, name: "Intégrer des liens", impact: "Les embeds ne s'afficheront pas." },
        { bit: AUDIT_PERM.READ_MESSAGE_HISTORY, name: "Voir les anciens messages", impact: "Le bot ne pourra pas modifier ni supprimer ses messages." },
        { bit: AUDIT_PERM.USE_EXTERNAL_EMOJIS, name: "Utiliser des emojis externes", impact: "Les emojis personnalisés ne s'afficheront pas." },
    ];

    const missingBase = requiredBase.filter(r => !(perms & r.bit));

    if (missingBase.length > 0) {
        findings.push({
            capabilityId: "bot-global-perms",
            status: "warning",
            title: `Permissions globales insuffisantes (${missingBase.length} manquante${missingBase.length > 1 ? "s" : ""})`,
            impact: missingBase.map(m => m.impact).join(" "),
            remedy: `Dans les paramètres Discord → Rôles → rôle du bot, activez : ${missingBase.map(m => m.name).join(", ")}.`,
            technicalDetail: `Permissions manquantes au niveau serveur : ${missingBase.map(m => m.name).join(", ")}.`,
        });
    } else {
        findings.push({
            capabilityId: "bot-global-perms",
            status: "operational",
            title: "Permissions globales du bot",
            technicalDetail: "SEND_MESSAGES, EMBED_LINKS, READ_MESSAGE_HISTORY, USE_EXTERNAL_EMOJIS — OK.",
        });
    }

    return findings;
}
