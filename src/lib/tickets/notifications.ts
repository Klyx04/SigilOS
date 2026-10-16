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
    /** Pour l'équipe : `@Pseudo` (aucun ping). Pour le demandeur : sa **mention**. */
    membre?: string | null;
    motif?: string | null;
    numero?: number | string | null;
};

/**
 * Rend un message personnalisé : remplace `{membre}`, `{motif}`, `{numero}` puis borne le
 * résultat. Rend `null` si le texte est vide — un gabarit vide ne produit **rien**, jamais
 * une chaîne de ponctuation orpheline.
 */
export function renderTicketMessage(
    template: string | null | undefined,
    vars: TicketMessageVars = {}
): string | null {
    const raw = String(template ?? "").trim();
    if (!raw) return null;
    const rendered = raw
        .replace(/\{membre\}/gi, vars.membre ? String(vars.membre) : "")
        .replace(/\{motif\}/gi, vars.motif ? String(vars.motif) : "")
        .replace(/\{numero\}/gi, vars.numero === null || vars.numero === undefined ? "" : String(vars.numero))
        .replace(/[ \t]{2,}/g, " ")
        .trim();
    return rendered ? rendered.slice(0, TICKET_MESSAGE_MAX) : null;
}

/**
 * Contenu **de l'équipe** : message personnalisé (puis la mention des rôles), sinon le
 * libellé par défaut. `enabled: false` coupe tout — c'est le choix explicite de l'admin.
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
    const custom = renderTicketMessage(input.template, input.vars);
    // Sans message personnalisé, on garde **le** libellé par défaut du module (source unique).
    return custom ? `${custom} ${mentions}` : buildTicketNotifyContent(input.roleIds);
}

/**
 * Contenu **du demandeur** : son message personnalisé (il y place `{membre}`), sinon sa
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
    const custom = renderTicketMessage(input.template, { membre: mention, ...(input.vars ?? {}) });
    if (!custom) return mention;
    return custom.includes(mention) ? custom : `${mention} ${custom}`;
}
