/**
 * 🎫 Tickets — **matrice des permissions de salon** (pur : aucun I/O).
 *
 * Façon TicketTool (« Permissions » : 4 groupes × Ouvert/Fermé), à notre sauce :
 *   · 4 groupes : Équipe / Demandeur / Rôles invités / Tout le monde ;
 *   · 2 états : salon Ouvert / salon Fermé (appliqué à la clôture, retiré à la réouverture) ;
 *   · 8 permissions utiles au lieu de 21 (vulgarisé : Voir, Écrire, Historique,
 *     Fichiers, Liens, Réactions, Gérer, Inviter) ;
 *   · 2 valeurs Oui/Non (pas de 3ᵉ état « hérité » : le calcul est déterministe,
 *     `Non` = refus explicite) ;
 *   · stocké dans `TicketGuildConfig.settingsJson.channelPermissions` : **aucune
 *     migration**. « Tout le monde » reste toujours refusé (pédagogie : affiché
 *     mais non modifiable — un ticket n'est jamais public).
 *
 * ```json
 * { "channelPermissions": {
 *     "support": { "open": { "view": true, ... }, "closed": { ... } },
 *     "owner": { "open": {...}, "closed": {...} },
 *     "additional": { "open": {...}, "closed": {...} },
 *     "everyone": { "open": {...}, "closed": {...} } } }
 * ```
 */

export const TICKET_CHANNEL_GROUPS = ["support", "owner", "additional", "everyone"] as const;
export type TicketChannelGroup = (typeof TICKET_CHANNEL_GROUPS)[number];

export const TICKET_CHANNEL_STATES = ["open", "closed"] as const;
export type TicketChannelState = (typeof TICKET_CHANNEL_STATES)[number];

/** Libellés FR/EN vulgarisés des 4 groupes (même ligne, comme les boutons). */
export const TICKET_CHANNEL_GROUP_LABELS: Record<TicketChannelGroup, string> = {
    support: "Équipe / Staff",
    owner: "Demandeur / Opener",
    additional: "Rôles invités / Extra roles",
    everyone: "Tout le monde / Everyone",
};

export const TICKET_CHANNEL_STATE_LABELS: Record<TicketChannelState, string> = {
    open: "Ouvert / Opened",
    closed: "Fermé / Closed",
};

/** 8 permissions Discord utiles, avec leur bit. */
export const TICKET_CHANNEL_PERMS = [
    "view",
    "send",
    "history",
    "attach",
    "embed",
    "react",
    "manage",
    "invite",
] as const;
export type TicketChannelPerm = (typeof TICKET_CHANNEL_PERMS)[number];

/** Libellé FR vulgarisé + bit Discord de chaque permission. */
export const TICKET_CHANNEL_PERM_META: Record<TicketChannelPerm, { label: string; bit: bigint }> = {
    view: { label: "Voir le salon", bit: 1024n },
    send: { label: "Envoyer des messages", bit: 2048n },
    history: { label: "Lire l'historique", bit: 65536n },
    attach: { label: "Joindre des fichiers", bit: 32768n },
    embed: { label: "Intégrer des liens", bit: 16384n },
    react: { label: "Ajouter des réactions", bit: 64n },
    manage: { label: "Gérer le salon", bit: 16n },
    invite: { label: "Créer des invitations", bit: 1n },
};

export type TicketChannelPermSet = Record<TicketChannelPerm, boolean>;
export type TicketChannelMatrix = Record<TicketChannelGroup, Record<TicketChannelState, TicketChannelPermSet>>;

const ALL_OFF: TicketChannelPermSet = {
    view: false,
    send: false,
    history: false,
    attach: false,
    embed: false,
    react: false,
    manage: false,
    invite: false,
};

const STAFF_OPEN: TicketChannelPermSet = {
    view: true,
    send: true,
    history: true,
    attach: true,
    embed: true,
    react: true,
    manage: false,
    invite: false,
};

const OWNER_OPEN: TicketChannelPermSet = {
    view: true,
    send: true,
    history: true,
    attach: true,
    embed: true,
    react: true,
    manage: false,
    invite: false,
};

/** Fermé : le demandeur lit mais n'écrit plus (façon TicketTool « Closed »). */
const OWNER_CLOSED: TicketChannelPermSet = {
    view: true,
    send: false,
    history: true,
    attach: false,
    embed: false,
    react: false,
    manage: false,
    invite: false,
};

/** Invités = observateurs par défaut (voient, n'écrivent pas). */
const ADDITIONAL_OPEN: TicketChannelPermSet = {
    view: true,
    send: false,
    history: true,
    attach: false,
    embed: false,
    react: false,
    manage: false,
    invite: false,
};

function defaultMatrix(): TicketChannelMatrix {
    return {
        support: { open: { ...STAFF_OPEN }, closed: { ...STAFF_OPEN } },
        owner: { open: { ...OWNER_OPEN }, closed: { ...OWNER_CLOSED } },
        additional: { open: { ...ADDITIONAL_OPEN }, closed: { ...ADDITIONAL_OPEN } },
        everyone: { open: { ...ALL_OFF }, closed: { ...ALL_OFF } },
    };
}

/** Lit `settingsJson.channelPermissions` **sans jamais jeter** (invalide = défauts). */
export function readChannelPermissions(raw: unknown): TicketChannelMatrix {
    const fallback = defaultMatrix();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
    const root = (raw as Record<string, unknown>).channelPermissions;
    if (!root || typeof root !== "object" || Array.isArray(root)) return fallback;
    const input = root as Record<string, unknown>;

    for (const group of TICKET_CHANNEL_GROUPS) {
        // « Tout le monde » n'est jamais modifiable : un ticket reste privé.
        if (group === "everyone") continue;
        const groupRaw = input[group];
        if (!groupRaw || typeof groupRaw !== "object" || Array.isArray(groupRaw)) continue;
        const groupInput = groupRaw as Record<string, unknown>;
        for (const state of TICKET_CHANNEL_STATES) {
            const stateRaw = groupInput[state];
            if (!stateRaw || typeof stateRaw !== "object" || Array.isArray(stateRaw)) continue;
            const stateInput = stateRaw as Record<string, unknown>;
            for (const perm of TICKET_CHANNEL_PERMS) {
                if (typeof stateInput[perm] === "boolean") {
                    fallback[group][state][perm] = stateInput[perm] as boolean;
                }
            }
        }
    }
    return fallback;
}

/** Fusionne une matrice partielle dans `settingsJson` (ce que le dashboard enregistre). */
export function writeChannelPermissions(
    current: unknown,
    matrix: TicketChannelMatrix
): Record<string, unknown> {
    const base =
        current && typeof current === "object" && !Array.isArray(current)
            ? { ...(current as Record<string, unknown>) }
            : {};
    const clean: Record<string, Record<string, Record<string, boolean>>> = {};
    for (const group of TICKET_CHANNEL_GROUPS) {
        if (group === "everyone") continue;
        clean[group] = {};
        for (const state of TICKET_CHANNEL_STATES) {
            clean[group][state] = {};
            for (const perm of TICKET_CHANNEL_PERMS) {
                clean[group][state][perm] = matrix[group][state][perm] === true;
            }
        }
    }
    base.channelPermissions = clean;
    return base;
}

/** Jeu de permissions → bitmasks Discord (`allow` / `deny` explicites). */
export function permSetToBitmasks(set: TicketChannelPermSet): { allow: string; deny: string } {
    let allow = 0n;
    let deny = 0n;
    for (const perm of TICKET_CHANNEL_PERMS) {
        if (set[perm]) allow |= TICKET_CHANNEL_PERM_META[perm].bit;
        else deny |= TICKET_CHANNEL_PERM_META[perm].bit;
    }
    return { allow: String(allow), deny: String(deny) };
}

export type TicketOverwriteTarget =
    | { kind: "everyone"; id: string }
    | { kind: "member"; id: string }
    | { kind: "role"; id: string };

/**
 * Construit les `permission_overwrites` d'un salon de ticket pour un état donné.
 * Ordre : Tout le monde (refus) → Demandeur → Équipe → Invités.
 */
export function buildTicketOverwrites(input: {
    guildId: string;
    creatorDiscordId: string;
    staffRoleIds: string[];
    additionalRoleIds: string[];
    state: TicketChannelState;
    matrix: TicketChannelMatrix;
}): Array<{ id: string; type: 0 | 1; allow: string; deny: string }> {
    const overwrites: Array<{ id: string; type: 0 | 1; allow: string; deny: string }> = [];

    const everyoneMasks = permSetToBitmasks(input.matrix.everyone[input.state]);
    overwrites.push({ id: input.guildId, type: 0, allow: "0", deny: everyoneMasks.deny || "1024" });

    const ownerMasks = permSetToBitmasks(input.matrix.owner[input.state]);
    overwrites.push({ id: input.creatorDiscordId, type: 1, ...ownerMasks });

    const staffMasks = permSetToBitmasks(input.matrix.support[input.state]);
    for (const roleId of input.staffRoleIds) {
        if (roleId) overwrites.push({ id: roleId, type: 0, ...staffMasks });
    }

    const additionalMasks = permSetToBitmasks(input.matrix.additional[input.state]);
    for (const roleId of input.additionalRoleIds) {
        if (roleId && !input.staffRoleIds.includes(roleId)) {
            overwrites.push({ id: roleId, type: 0, ...additionalMasks });
        }
    }

    return overwrites;
}
