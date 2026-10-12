/**
 * 🎫 Tickets v2 — **décision d'accès** (pure, sans I/O).
 *
 * Une seule question : *cet acteur a-t-il le droit de faire cette action sur ce
 * ticket ?* La fonction ne lit rien (rôles, guilde et permissions sont résolus
 * **avant** par le service) et ne mute rien : elle est donc testable et utilisable
 * par le dashboard comme par les interactions Discord — le dashboard et les boutons
 * reposent ainsi sur la **même règle** (§1 des principes non négociables).
 *
 * Fail-closed : toute donnée manquante conduit à un refus motivé, jamais à un
 * accord par défaut. Un refus porte toujours une raison lisible (affichée telle
 * quelle au cliqueur).
 */

import type { TicketAccessLevel } from "./interaction-routing";

/** Contexte d'autorisation **résolu par la route** (jamais reçu d'un client). */
export type TicketAuthorizationContext = {
    discordUserId: string;
    discordUserName: string;
    /** Rôles Discord de l'acteur dans la guilde (vide en MP). */
    discordUserRoleIds: string[];
    /** Administrateur/propriétaire Discord : bypass explicite, jamais deviné. */
    discordUserIsAdmin: boolean;
    /** Résultat serveur de `staff:tickets` (fail-closed si la vérification échoue). */
    hasStaffPermission: boolean;
};

/** Réduit le contexte à ce qu'attend `decideTicketAccess`. */
export function actorFromAuthorizationContext(context: TicketAuthorizationContext): TicketActor {
    return {
        discordUserId: context.discordUserId,
        roleIds: context.discordUserRoleIds,
        isGuildOwnerOrAdmin: context.discordUserIsAdmin,
        hasStaffPermission: context.hasStaffPermission,
    };
}

export type TicketActor = {
    discordUserId: string;
    /** Rôles Discord de l'acteur dans **ce** serveur (liste vide si inconnus). */
    roleIds: string[];
    /** Propriétaire du serveur ou administrateur Discord (bypass explicite). */
    isGuildOwnerOrAdmin?: boolean;
    /** Résultat serveur de `staff:tickets` (fail-closed : absent = non autorisé). */
    hasStaffPermission?: boolean;
};

export type TicketAccessInput = {
    access: TicketAccessLevel;
    actor: TicketActor;
    /** Rôles staff cumulés : parcours + équipe + configuration de guilde. */
    staffRoleIds?: string[];
    /** Demandeur du ticket (null si le ticket n'existe pas encore). */
    creatorDiscordId?: string | null;
    /** Politique publiée du parcours (fermeture). */
    closePolicy?: "STAFF_ONLY" | "STAFF_OR_CREATOR" | null;
};

export type TicketAccessDecision =
    | { allowed: true; as: "staff" | "creator" | "public" }
    | { allowed: false; reason: string };

export const TICKET_ACCESS_REFUSAL = {
    UNKNOWN_ACTION: "Action inconnue.",
    NOT_STAFF: "🚫 Cette action est réservée à l'équipe de support du serveur.",
    NOT_CREATOR: "🚫 Seul le demandeur du ticket peut faire cela.",
    CLOSE_POLICY: "🔒 Ce parcours réserve la clôture à l'équipe de support.",
    NOT_IN_GUILD: "🚫 Ce ticket n'appartient pas à ce serveur.",
} as const;

/** L'acteur est-il staff d'après les rôles du parcours, la permission ou son rang Discord ? */
export function isTicketStaff(actor: TicketActor, staffRoleIds: string[] = []): boolean {
    if (actor.isGuildOwnerOrAdmin) return true;
    if (actor.hasStaffPermission) return true;
    if (staffRoleIds.length === 0) return false;
    return staffRoleIds.some((roleId) => Boolean(roleId) && actor.roleIds.includes(roleId));
}

/**
 * Décide l'accès. `staffRoleIds` vide + aucune permission + pas propriétaire ⇒ refus :
 * on ne devine jamais un droit à partir de l'absence de configuration.
 */
export function decideTicketAccess(input: TicketAccessInput): TicketAccessDecision {
    const { access, actor, staffRoleIds = [] } = input;
    const isCreator = Boolean(input.creatorDiscordId) && actor.discordUserId === input.creatorDiscordId;
    const staff = isTicketStaff(actor, staffRoleIds);

    switch (access) {
        case "public":
            return { allowed: true, as: "public" };
        case "staff":
            return staff ? { allowed: true, as: "staff" } : { allowed: false, reason: TICKET_ACCESS_REFUSAL.NOT_STAFF };
        case "creator":
            return staff || isCreator
                ? { allowed: true, as: isCreator ? "creator" : "staff" }
                : { allowed: false, reason: TICKET_ACCESS_REFUSAL.NOT_CREATOR };
        case "staff_or_creator": {
            if (staff) return { allowed: true, as: "staff" };
            if (!isCreator) return { allowed: false, reason: TICKET_ACCESS_REFUSAL.NOT_STAFF };
            // Politique publiée : la clôture peut être réservée au staff.
            const policy = input.closePolicy ?? "STAFF_ONLY";
            if (policy === "STAFF_ONLY") {
                return { allowed: false, reason: TICKET_ACCESS_REFUSAL.CLOSE_POLICY };
            }
            return { allowed: true, as: "creator" };
        }
        default:
            return { allowed: false, reason: TICKET_ACCESS_REFUSAL.UNKNOWN_ACTION };
    }
}

/** Fusionne les sources de rôles staff (config guilde + équipe + parcours), sans doublon. */
export function mergeStaffRoleIds(...sources: Array<string[] | null | undefined>): string[] {
    const merged = new Set<string>();
    for (const source of sources) {
        for (const roleId of source ?? []) {
            if (roleId) merged.add(roleId);
        }
    }
    return [...merged];
}

/** Libellé FR d'un niveau d'accès (aide contextuelle du dashboard). */
export const TICKET_ACCESS_LABELS: Record<TicketAccessLevel, string> = {
    public: "Tout membre du serveur",
    staff: "Équipe de support",
    creator: "Le demandeur uniquement",
    staff_or_creator: "Équipe de support, ou le demandeur selon la politique",
};
