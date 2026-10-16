/**
 * 🎫 Tickets v2 — **qui mentionne-t-on à l'ouverture d'un ticket** (pur, sans I/O).
 *
 * Demande user : « une option permettant de ping tel rôle ou tel rôle quand un ticket
 * est créé ». Avant : le bot mentionnait **tous** les rôles staff de la catégorie, sans
 * aucun choix ; `TicketTeam.notifyRoleIds` existait en base mais **rien ne le lisait**.
 *
 * Deux niveaux, dans cet ordre :
 *   1. les rôles du **parcours** (`TicketJourney.notifyRoleIds`) : ce que le chef de
 *      guilde coche pour CE parcours (« Candidature » → `@Candidatures`) ;
 *   2. à défaut, ceux de l'**équipe** du parcours (`TicketTeam.notifyRoleIds`) : le
 *      défaut réutilisable.
 *
 * Règles non négociables : **jamais `@everyone`** (seuls des flocons valides passent),
 * jamais plus de 25 mentions (limite Discord d'un message), et **aucun ping par
 * défaut** : sans configuration on n'invente pas une notification.
 */

export const TICKET_NOTIFY_ROLES_MAX = 25;
export const TICKET_NOTIFY_MENTION_PREFIX = "🔔 Nouveau ticket —";

/** Identifiant Discord (flocon) : 17 à 20 chiffres — `@everyone` n'en est pas un. */
const SNOWFLAKE = /^\d{17,20}$/;

/** Nettoie une liste de rôles : flocons valides uniquement, sans doublon, bornée à 25. */
export function sanitizeTicketNotifyRoleIds(
    roleIds: Array<string | null | undefined> | null | undefined
): string[] {
    const seen = new Set<string>();
    for (const roleId of roleIds ?? []) {
        const value = typeof roleId === "string" ? roleId.trim() : "";
        if (!SNOWFLAKE.test(value)) continue;
        seen.add(value);
        if (seen.size >= TICKET_NOTIFY_ROLES_MAX) break;
    }
    return [...seen];
}

export type TicketNotifyRoleSource = "journey" | "team" | "none";

/** Rôles effectifs : le parcours décide, l'équipe parle à défaut. */
export function resolveTicketNotifyRoleIds(input: {
    journeyRoleIds?: string[] | null;
    teamRoleIds?: string[] | null;
}): { roleIds: string[]; source: TicketNotifyRoleSource } {
    const journey = sanitizeTicketNotifyRoleIds(input.journeyRoleIds);
    if (journey.length > 0) return { roleIds: journey, source: "journey" };

    const team = sanitizeTicketNotifyRoleIds(input.teamRoleIds);
    if (team.length > 0) return { roleIds: team, source: "team" };

    return { roleIds: [], source: "none" };
}

/**
 * Contenu Discord du message d'ouverture (`null` = ne rien envoyer du tout).
 * Les identifiants sont revalidés ici : le service ne fait jamais confiance à la ligne
 * écrite par l'écran d'administration.
 */
export function buildTicketNotifyContent(roleIds: Array<string | null | undefined> | null | undefined): string | null {
    const safe = sanitizeTicketNotifyRoleIds(roleIds);
    if (safe.length === 0) return null;
    return `${TICKET_NOTIFY_MENTION_PREFIX} ${safe.map((roleId) => `<@&${roleId}>`).join(" ")}`;
}

/** Libellé FR de la provenance (écran d'édition, journal, explication au staff). */
export const TICKET_NOTIFY_SOURCE_LABELS: Record<TicketNotifyRoleSource, string> = {
    journey: "Rôles du parcours",
    team: "Rôles de l'équipe (le parcours n'en définit pas)",
    none: "Personne n'est mentionné à l'ouverture",
};

/** Longueur maximale d'un message personnalisé (Discord plafonne un contenu à 2 000). */
export const TICKET_MESSAGE_MAX = 900;

/** Variables disponibles dans les messages personnalisés du motif. */
export type TicketMessageVars = {
    /** Pour l'équipe : `@Pseudo` (aucun ping) ou sa mention `<@id>`. */
    membre?: string | null;
    demandeur?: string | null;
    pseudo?: string | null;
    roles?: string | null;
    staff?: string | null;
    equipe?: string | null;
    motif?: string | null;
    numero?: number | string | null;
};

/**
 * Rend un message personnalisé : remplace `{membre}`, `{demandeur}`, `{roles}`, `{staff}`,
 * `{equipe}`, `{pseudo}`, `{motif}`, `{numero}` puis borne le résultat.
 * Rend `null` si le texte est vide.
 */
export function renderTicketMessage(
    template: string | null | undefined,
    vars: TicketMessageVars = {}
): string | null {
    const raw = String(template ?? "").trim();
    if (!raw) return null;
    const memberVal = vars.demandeur ?? vars.membre ?? "";
    const rolesVal = vars.roles ?? vars.staff ?? vars.equipe ?? "";
    const rendered = raw
        .replace(/\{demandeur\}/gi, memberVal ? String(memberVal) : "")
        .replace(/\{membre\}/gi, memberVal ? String(memberVal) : "")
        .replace(/\{roles\}/gi, rolesVal ? String(rolesVal) : "")
        .replace(/\{staff\}/gi, rolesVal ? String(rolesVal) : "")
        .replace(/\{equipe\}/gi, rolesVal ? String(rolesVal) : "")
        .replace(/\{pseudo\}/gi, vars.pseudo ? String(vars.pseudo) : "")
        .replace(/\{motif\}/gi, vars.motif ? String(vars.motif) : "")
        .replace(/\{numero\}/gi, vars.numero === null || vars.numero === undefined ? "" : String(vars.numero))
        .replace(/[ \t]{2,}/g, " ")
        .trim();
    return rendered ? rendered.slice(0, TICKET_MESSAGE_MAX) : null;
}

/**
 * Contenu **de l'équipe** : message personnalisé (avec insertion exacte de `{roles}` ou
 * mention à la fin par repli), sinon le libellé par défaut. `enabled: false` coupe tout.
 */
export function buildTicketNotifyContentWithTemplate(input: {
    roleIds?: Array<string | null | undefined> | null;
    template?: string | null;
    vars?: TicketMessageVars;
    enabled?: boolean;
}): string | null {
    if (input.enabled === false) return null;
    const safe = sanitizeTicketNotifyRoleIds(input.roleIds);
    if (safe.length === 0) return null;
    const mentions = safe.map((roleId) => `<@&${roleId}>`).join(" ");

    const hasExplicitRoleVar = input.template
        ? /\{(roles|staff|equipe)\}/i.test(input.template)
        : false;

    const mergedVars: TicketMessageVars = {
        roles: mentions,
        staff: mentions,
        equipe: mentions,
        ...(input.vars ?? {}),
    };

    const custom = renderTicketMessage(input.template, mergedVars);
    if (!custom) return buildTicketNotifyContent(input.roleIds);

    // Si le template a déjà placé {roles} ou {staff}, on ne duplique pas les mentions à la fin.
    if (hasExplicitRoleVar || custom.includes(mentions)) {
        return custom;
    }
    return `${custom} ${mentions}`;
}

/**
 * Contenu **du demandeur** : son message personnalisé (il y place `{membre}` ou `{demandeur}`), sinon sa
 * simple mention. La mention est **garantie** : un gabarit qui l'oublie ne prive jamais le
 * demandeur de sa notification (on l'ajoute devant).
 */
export function buildTicketCreatorContent(input: {
    creatorDiscordId?: string | null;
    template?: string | null;
    vars?: TicketMessageVars;
}): string | null {
    const creator = String(input.creatorDiscordId ?? "").trim();
    if (!SNOWFLAKE.test(creator)) return null;
    const mention = `<@${creator}>`;
    const custom = renderTicketMessage(input.template, {
        membre: mention,
        demandeur: mention,
        ...(input.vars ?? {}),
    });
    if (!custom) return mention;
    return custom.includes(mention) ? custom : `${mention} ${custom}`;
}

/**
 * 🆕 Message d'ouverture unifié (mentions de l'équipe et du créateur à leur place exacte).
 * Permet à l'administrateur de placer `{demandeur}` et `{roles}` exactement où il le souhaite
 * dans son message sans duplication ni ping forcé au mauvais endroit.
 */
export function buildTicketOpeningContent(input: {
    creatorDiscordId?: string | null;
    creatorName?: string | null;
    roleIds?: Array<string | null | undefined> | null;
    notifyEnabled?: boolean;
    notifyMessage?: string | null;
    creatorMessage?: string | null;
    motif?: string | null;
    numero?: number | string | null;
}): string | null {
    const creator = String(input.creatorDiscordId ?? "").trim();
    const creatorMention = SNOWFLAKE.test(creator) ? `<@${creator}>` : "";
    const safeRoleIds = sanitizeTicketNotifyRoleIds(input.roleIds);
    const rolesMention =
        input.notifyEnabled !== false && safeRoleIds.length > 0
            ? safeRoleIds.map((id) => `<@&${id}>`).join(" ")
            : "";

    const baseVars: TicketMessageVars = {
        membre: creatorMention || (input.creatorName ? `@${input.creatorName}` : ""),
        demandeur: creatorMention,
        pseudo: input.creatorName ?? "",
        roles: rolesMention,
        staff: rolesMention,
        equipe: rolesMention,
        motif: input.motif ?? null,
        numero: input.numero ?? null,
    };

    const notifyText = input.notifyMessage?.trim() || "";
    const creatorText = input.creatorMessage?.trim() || "";

    // Si le message d'équipe contient déjà à la fois le demandeur et les rôles
    // ou si creatorText est vide, on évalue notifyText directement.
    const notifyMentionsDemandeur = /\{(demandeur|membre)\}/i.test(notifyText);
    const notifyMentionsRoles = /\{(roles|staff|equipe)\}/i.test(notifyText);

    if (notifyMentionsDemandeur && notifyMentionsRoles) {
        return renderTicketMessage(notifyText, baseVars);
    }

    const rolesPart = buildTicketNotifyContentWithTemplate({
        roleIds: input.roleIds,
        template: input.notifyMessage,
        enabled: input.notifyEnabled,
        vars: {
            ...baseVars,
            membre: notifyMentionsDemandeur
                ? creatorMention
                : input.creatorName ? `@${input.creatorName}` : "",
        },
    });

    const creatorPart = buildTicketCreatorContent({
        creatorDiscordId: input.creatorDiscordId,
        template: input.creatorMessage,
        vars: baseVars,
    });

    // Si l'un des deux a déjà inclus la mention de l'autre, on évite la duplication
    if (creatorMention && rolesPart?.includes(creatorMention) && !creatorText) {
        return rolesPart;
    }

    return [creatorPart, rolesPart].filter(Boolean).join(" ");
}
