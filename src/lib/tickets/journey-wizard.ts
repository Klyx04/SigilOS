/**
 * 🎫 Tickets v2 — **assistant de parcours** : les règles pures de l'onglet « Parcours ».
 *
 * Pourquoi ce fichier : l'écran d'édition d'un parcours ne doit **rien décider** lui-même.
 * Un parcours mal formé produisait soit un refus serveur incompréhensible (« Données
 * invalides »), soit — pire — un réglage stocké que **rien** n'exécute. Ici vivent donc
 * les seules règles : ce qui bloque (erreur), ce qui doit être **dit** sans bloquer
 * (avertissement), le brouillon par défaut, l'identifiant dérivé du nom, et la charge
 * utile exacte acceptée par `saveTicketJourneyAction`.
 *
 * Ce module ne lit rien et ne mute rien : il est testable sans base ni Discord, et
 * l'écran comme le serveur peuvent s'y appuyer (une seule source de vérité).
 *
 * Honnêteté (§ « aucun réglage affiché sans exécutant ») : les **fils privés**
 * (`THREAD_PRIVATE`) ne sont pas encore ouverts par le moteur — l'assistant ne les
 * propose pas, le dit s'il en rencontre un, et écrit un salon texte.
 */

import { formatTicketChannelName } from "./embeds";

export const TICKET_JOURNEY_NAME_MAX = 80;
export const TICKET_JOURNEY_SLUG_MAX = 60;
export const TICKET_JOURNEY_SLUG_MIN = 2;
export const TICKET_JOURNEY_DESCRIPTION_MAX = 300;
export const TICKET_JOURNEY_EMOJI_MAX = 8;
export const TICKET_JOURNEY_STAFF_ROLES_MAX = 25;
export const TICKET_JOURNEY_NAMING_PATTERN_MAX = 80;
export const TICKET_JOURNEY_ORDER_MAX = 999;

/** Styles de bouton Discord réellement acceptés par l'action serveur. */
export const TICKET_JOURNEY_BUTTON_STYLES = ["PRIMARY", "SECONDARY", "SUCCESS", "DANGER"] as const;
export type TicketJourneyButtonStyle = (typeof TICKET_JOURNEY_BUTTON_STYLES)[number];

export const TICKET_JOURNEY_BUTTON_STYLE_LABELS: Record<TicketJourneyButtonStyle, string> = {
    PRIMARY: "Bleu — bouton principal",
    SECONDARY: "Gris — bouton secondaire",
    SUCCESS: "Vert — valider",
    DANGER: "Rouge — signaler",
};

export const TICKET_OPEN_MODES = ["INSTANT", "APPROVAL"] as const;
export type TicketOpenMode = (typeof TICKET_OPEN_MODES)[number];

export const TICKET_OPEN_MODE_LABELS: Record<TicketOpenMode, string> = {
    INSTANT: "Le salon s'ouvre tout de suite",
    APPROVAL: "Le staff valide d'abord la demande",
};

export const TICKET_CLOSE_POLICIES = ["STAFF_ONLY", "STAFF_OR_CREATOR"] as const;
export type TicketClosePolicy = (typeof TICKET_CLOSE_POLICIES)[number];

export const TICKET_CLOSE_POLICY_LABELS: Record<TicketClosePolicy, string> = {
    STAFF_ONLY: "Le staff ferme",
    STAFF_OR_CREATOR: "Le staff, ou le demandeur",
};

/** Types de salon **implémentés** par le moteur aujourd'hui (les fils privés : chantier à part). */
export const TICKET_JOURNEY_CHANNEL_TYPES = ["CHANNEL_TEXT"] as const;
export type TicketJourneyChannelType = "CHANNEL_TEXT" | "THREAD_PRIVATE";

export const TICKET_CHANNEL_TYPE_LABELS: Record<TicketJourneyChannelType, string> = {
    CHANNEL_TEXT: "Salon texte",
    THREAD_PRIVATE: "Fil privé",
};

/** Placeholders compris par le moteur (`formatTicketChannelName`, `src/lib/tickets/embeds.ts`). */
export const TICKET_NAMING_PLACEHOLDERS = ["{num}", "{user}", "{journey}", "{category}"] as const;

/** Étapes de l'assistant, dans l'ordre. Un écran = une question. */
export const TICKET_JOURNEY_WIZARD_STEPS = [
    {
        id: "identity",
        label: "Identité",
        description: "Le nom que verront les membres, et le bouton qui ouvre ce parcours.",
    },
    {
        id: "opening",
        label: "Ouverture",
        description: "Où le salon est créé, comment il se nomme, et qui peut fermer.",
    },
    {
        id: "team",
        label: "Équipe",
        description: "Les rôles Discord qui voient et traitent ces tickets.",
    },
    {
        id: "form",
        label: "Questionnaire",
        description: "Les questions posées avant l'ouverture — facultatif.",
    },
    {
        id: "review",
        label: "Résumé",
        description: "Vérifie, enregistre, puis publie pour activer le parcours côté Discord.",
    },
] as const;

export type TicketJourneyWizardStepId = (typeof TICKET_JOURNEY_WIZARD_STEPS)[number]["id"];

export const TICKET_JOURNEY_STEP_IDS: TicketJourneyWizardStepId[] = TICKET_JOURNEY_WIZARD_STEPS.map(
    (step) => step.id
);

/** Brouillon édité par l'assistant (l'`id` est absent tant que le parcours n'est pas enregistré). */
export type TicketJourneyDraft = {
    id?: string;
    name: string;
    slug: string;
    description: string;
    emoji: string;
    buttonStyle: TicketJourneyButtonStyle;
    channelType: TicketJourneyChannelType;
    channelParentId: string;
    staffRoleIds: string[];
    teamId: string;
    formId: string;
    namingPattern: string;
    openMode: TicketOpenMode;
    closePolicy: TicketClosePolicy;
    order: number;
    isEnabled: boolean;
};

/** Ce que l'assistant sait des formulaires et des équipes de la guilde (jamais deviné). */
export type TicketFormOption = { id: string; name: string; publishedVersion: number | null };
export type TicketTeamOption = { id: string; name: string; isEnabled: boolean };

export type TicketJourneyValidationContext = {
    /** Identifiants déjà pris par d'**autres** parcours de la guilde (unicité du slug). */
    takenSlugs?: string[];
    forms?: TicketFormOption[];
    teams?: TicketTeamOption[];
};

export type TicketJourneyIssue = {
    step: TicketJourneyWizardStepId;
    severity: "error" | "warning";
    message: string;
};

const TICKET_JOURNEY_SLUG_PATTERN = new RegExp(
    `^[a-z0-9-]{${TICKET_JOURNEY_SLUG_MIN},${TICKET_JOURNEY_SLUG_MAX}}$`
);

/** Parcours tel que le lit la base (colonnes nullables, valeurs d'un format antérieur incluses). */
export type TicketJourneyRecordLike = {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    emoji?: string | null;
    buttonStyle?: string | null;
    channelType?: string | null;
    channelParentId?: string | null;
    staffRoleIds?: string[] | null;
    teamId?: string | null;
    formId?: string | null;
    namingPattern?: string | null;
    openMode?: string | null;
    closePolicy?: string | null;
    order?: number | null;
    isEnabled?: boolean | null;
};

function coerceJourneyButtonStyle(value: string | null | undefined): TicketJourneyButtonStyle {
    return (TICKET_JOURNEY_BUTTON_STYLES as readonly string[]).includes(value ?? "")
        ? (value as TicketJourneyButtonStyle)
        : "PRIMARY";
}

function coerceChannelType(value: string | null | undefined): TicketJourneyChannelType {
    return value === "THREAD_PRIVATE" ? "THREAD_PRIVATE" : "CHANNEL_TEXT";
}

function coerceOpenMode(value: string | null | undefined): TicketOpenMode {
    return (TICKET_OPEN_MODES as readonly string[]).includes(value ?? "")
        ? (value as TicketOpenMode)
        : "INSTANT";
}

function coerceClosePolicy(value: string | null | undefined): TicketClosePolicy {
    return (TICKET_CLOSE_POLICIES as readonly string[]).includes(value ?? "")
        ? (value as TicketClosePolicy)
        : "STAFF_ONLY";
}

function toTime(value: Date | string | null | undefined): number | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    const time = date.getTime();
    return Number.isFinite(time) ? time : null;
}

/** Brouillon vierge : tout est déjà valide (les champs facultatifs restent facultatifs). */
export function createEmptyTicketJourneyDraft(order = 0): TicketJourneyDraft {
    return {
        name: "",
        slug: "",
        description: "",
        emoji: "🎫",
        buttonStyle: "PRIMARY",
        channelType: "CHANNEL_TEXT",
        channelParentId: "",
        staffRoleIds: [],
        teamId: "",
        formId: "",
        namingPattern: "ticket-{num}",
        openMode: "INSTANT",
        closePolicy: "STAFF_ONLY",
        order,
        isEnabled: true,
    };
}

/** Charge un parcours existant dans l'assistant (aucun champ ne devient `null` côté formulaire). */
export function ticketJourneyDraftFromRecord(record: TicketJourneyRecordLike): TicketJourneyDraft {
    return {
        id: record.id,
        name: record.name ?? "",
        slug: record.slug ?? "",
        description: record.description ?? "",
        emoji: record.emoji ?? "🎫",
        buttonStyle: coerceJourneyButtonStyle(record.buttonStyle),
        channelType: coerceChannelType(record.channelType),
        channelParentId: record.channelParentId ?? "",
        staffRoleIds: record.staffRoleIds ?? [],
        teamId: record.teamId ?? "",
        formId: record.formId ?? "",
        namingPattern: record.namingPattern || "ticket-{num}",
        openMode: coerceOpenMode(record.openMode),
        closePolicy: coerceClosePolicy(record.closePolicy),
        order: Number.isInteger(record.order) ? (record.order as number) : 0,
        isEnabled: record.isEnabled ?? true,
    };
}

/** « Candidature Dofus » → `candidature-dofus` (accents retirés, casse baissée, ponctuation → tirets). */
export function slugifyTicketJourneySlug(input: string): string {
    const slug = (input ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-{2,}/g, "-")
        .slice(0, TICKET_JOURNEY_SLUG_MAX)
        .replace(/^-+|-+$/g, "");
    return slug.length >= TICKET_JOURNEY_SLUG_MIN ? slug : "";
}

export function isTicketJourneySlugValid(slug: string): boolean {
    return TICKET_JOURNEY_SLUG_PATTERN.test(slug);
}

/** Rend un identifiant **libre** (`-2`, `-3`…) : deux parcours ne se marchent jamais dessus. */
export function ensureUniqueTicketJourneySlug(base: string, takenSlugs: string[] = []): string {
    const used = new Set(takenSlugs.filter(Boolean));
    const start = slugifyTicketJourneySlug(base);
    if (!start) return "";
    if (!used.has(start)) return start;

    for (let suffix = 2; suffix <= 99; suffix += 1) {
        const tail = `-${suffix}`;
        const head = start.slice(0, TICKET_JOURNEY_SLUG_MAX - tail.length).replace(/-+$/, "");
        const candidate = `${head}${tail}`;
        if (candidate.length >= TICKET_JOURNEY_SLUG_MIN && !used.has(candidate)) return candidate;
    }
    return "";
}

/** Modèle de nom de salon : renvoie le **motif du refus**, ou `null` s'il est exploitable. */
export function validateTicketNamingPattern(pattern: string): string | null {
    const value = (pattern ?? "").trim();
    if (!value) return "Le modèle de nom de salon ne peut pas être vide.";
    if (value.length > TICKET_JOURNEY_NAMING_PATTERN_MAX) {
        return `Le modèle de nom est trop long (${TICKET_JOURNEY_NAMING_PATTERN_MAX} caractères maximum).`;
    }

    const unknown = [...value.matchAll(/\{([^}]*)\}/g)]
        .map((match) => `{${match[1]}}`)
        .filter((token) => !(TICKET_NAMING_PLACEHOLDERS as readonly string[]).includes(token));

    if (unknown.length > 0) {
        const accepted = TICKET_NAMING_PLACEHOLDERS.join(", ");
        return `Placeholder inconnu : ${[...new Set(unknown)].join(", ")}. Acceptés : ${accepted}.`;
    }
    return null;
}

/** Nom de salon réellement créé pour le 1ᵉʳ ticket (ce que le membre verra). */
export function previewTicketChannelName(pattern: string, journeyName: string, userName = "membre"): string {
    return formatTicketChannelName(pattern, { number: 1, user: userName, journey: journeyName });
}

/**
 * Toutes les remarques sur un brouillon, **classées par étape**.
 *
 * `error` = le serveur refusera (on le dit avant l'appel) ; `warning` = ça passera, mais
 * l'écran doit le dire (un réglage que rien n'applique, un parcours que personne ne verra).
 */
export function validateTicketJourneyDraft(
    draft: TicketJourneyDraft,
    context: TicketJourneyValidationContext = {}
): TicketJourneyIssue[] {
    const issues: TicketJourneyIssue[] = [];
    const add = (step: TicketJourneyWizardStepId, severity: "error" | "warning", message: string) =>
        issues.push({ step, severity, message });

    // ── Identité ────────────────────────────────────────────────────────────
    const name = draft.name.trim();
    if (name.length < 2) add("identity", "error", "Le nom du parcours est requis (2 caractères minimum).");
    else if (name.length > TICKET_JOURNEY_NAME_MAX) {
        add("identity", "error", `Le nom est trop long (${TICKET_JOURNEY_NAME_MAX} caractères maximum).`);
    }

    const slug = draft.slug.trim();
    if (!slug) add("identity", "error", "L'identifiant est requis — il se déduit du nom.");
    else if (!isTicketJourneySlugValid(slug)) {
        add(
            "identity",
            "error",
            `Identifiant invalide : lettres minuscules, chiffres et tirets, ${TICKET_JOURNEY_SLUG_MIN} à ${TICKET_JOURNEY_SLUG_MAX} caractères.`
        );
    } else if ((context.takenSlugs ?? []).includes(slug)) {
        add("identity", "error", "Cet identifiant est déjà utilisé par un autre parcours.");
    }

    if (draft.description.trim().length > TICKET_JOURNEY_DESCRIPTION_MAX) {
        add(
            "identity",
            "error",
            `La description est trop longue (${TICKET_JOURNEY_DESCRIPTION_MAX} caractères maximum).`
        );
    }
    if (draft.emoji.length > TICKET_JOURNEY_EMOJI_MAX) {
        add("identity", "error", "L'émoji est trop long (un seul émoji).");
    }
    if (!Number.isInteger(draft.order) || draft.order < 0 || draft.order > TICKET_JOURNEY_ORDER_MAX) {
        add("identity", "error", `L'ordre doit être un entier entre 0 et ${TICKET_JOURNEY_ORDER_MAX}.`);
    }

    // ── Ouverture ───────────────────────────────────────────────────────────
    if (draft.channelType === "THREAD_PRIVATE") {
        add(
            "opening",
            "warning",
            "Les tickets en fil privé ne sont pas encore pris en charge : ce parcours ouvrira un salon texte."
        );
    }
    const patternIssue = validateTicketNamingPattern(draft.namingPattern);
    if (patternIssue) add("opening", "error", patternIssue);
    else if (!draft.namingPattern.includes("{num}")) {
        add("opening", "warning", "Sans {num}, deux tickets peuvent porter le même nom de salon.");
    }
    if (draft.openMode === "APPROVAL") {
        add(
            "opening",
            "warning",
            "L'ouverture après approbation n'est pas encore prise en charge : le salon s'ouvrira directement."
        );
    }
    if (!draft.channelParentId) {
        add("opening", "warning", "Aucune catégorie choisie : les salons seront créés à la racine du serveur.");
    }

    // ── Équipe ──────────────────────────────────────────────────────────────
    if (draft.staffRoleIds.length > TICKET_JOURNEY_STAFF_ROLES_MAX) {
        add("team", "error", `${TICKET_JOURNEY_STAFF_ROLES_MAX} rôles staff au maximum.`);
    }
    if (draft.teamId) {
        const team = (context.teams ?? []).find((candidate) => candidate.id === draft.teamId);
        if (!team) add("team", "error", "Équipe introuvable dans cette guilde.");
        else if (!team.isEnabled) {
            add("team", "warning", `L'équipe « ${team.name} » est désactivée : ses rôles ne seront pas utilisés.`);
        }
    }
    if (draft.staffRoleIds.length === 0 && !draft.teamId) {
        add(
            "team",
            "warning",
            "Aucun rôle staff sur ce parcours : seuls les administrateurs Discord et les membres ayant la permission « Support & Tickets Discord » verront ces tickets."
        );
    }

    // ── Questionnaire ───────────────────────────────────────────────────────
    if (draft.formId) {
        const form = (context.forms ?? []).find((candidate) => candidate.id === draft.formId);
        if (!form) add("form", "error", "Formulaire introuvable dans cette guilde.");
        else if (!form.publishedVersion) add("form", "error", "Ce formulaire n'est pas publié : publie-le d'abord.");
    }

    return issues;
}

/** Les remarques qui **empêchent** d'avancer (toutes étapes, ou une seule si `step` est fourni). */
export function blockingTicketJourneyIssues(
    issues: TicketJourneyIssue[],
    step?: TicketJourneyWizardStepId
): TicketJourneyIssue[] {
    return issues.filter((issue) => issue.severity === "error" && (!step || issue.step === step));
}

/** Peut-on quitter une étape ? (les avertissements ne bloquent pas : ils informent). */
export function canLeaveTicketJourneyStep(issues: TicketJourneyIssue[], step: TicketJourneyWizardStepId): boolean {
    return blockingTicketJourneyIssues(issues, step).length === 0;
}

/**
 * Charge utile **exactement** au format attendu par `saveTicketJourneyAction`
 * (`TicketJourneySchema`). Les champs vidés deviennent `null` (jamais `undefined`) :
 * retirer une équipe ou un formulaire doit **effacer** le rattachement.
 */
export function buildTicketJourneyPayload(draft: TicketJourneyDraft): Record<string, unknown> {
    const name = draft.name.trim();
    const description = draft.description.trim();
    return {
        ...(draft.id ? { id: draft.id } : {}),
        name,
        slug: draft.slug.trim(),
        description: description ? description : null,
        emoji: draft.emoji.trim() || "🎫",
        buttonStyle: draft.buttonStyle,
        // Les fils privés ne sont pas encore ouverts par le moteur : on n'enregistre pas un
        // réglage que rien n'applique (l'étape « Ouverture » l'a déjà dit).
        channelType: "CHANNEL_TEXT",
        channelParentId: draft.channelParentId || null,
        staffRoleIds: draft.staffRoleIds,
        teamId: draft.teamId || null,
        formId: draft.formId || null,
        namingPattern: draft.namingPattern.trim() || "ticket-{num}",
        // Rien n'exécute encore l'approbation (aucun handler `approve`/`refuse`) : on
        // n'enregistre pas un parcours qui attendrait une validation inexistante.
        openMode: "INSTANT",
        closePolicy: draft.closePolicy,
        order: draft.order,
        isEnabled: draft.isEnabled,
    };
}

/** Peut-on publier ? (le serveur refuse un formulaire non publié — on le dit avant l'appel.) */
export function evaluateTicketJourneyPublish(
    journey: { id?: string | null; formId?: string | null },
    context: { forms?: TicketFormOption[] } = {}
): { ok: true } | { ok: false; reason: string } {
    if (!journey.id) return { ok: false, reason: "Enregistre le parcours avant de le publier." };

    if (journey.formId) {
        const form = (context.forms ?? []).find((candidate) => candidate.id === journey.formId);
        if (form && !form.publishedVersion) {
            return { ok: false, reason: "Ce formulaire n'est pas publié : publie-le d'abord." };
        }
    }
    return { ok: true };
}

export type TicketJourneyStateTone = "draft" | "stale" | "published";

/**
 * État affiché d'un parcours. Un parcours **modifié après sa publication** le dit :
 * sinon un chef de guilde croit de bonne foi que son changement est déjà en ligne.
 */
export function describeTicketJourneyState(journey: {
    isPublished?: boolean | null;
    publishedVersion?: number | null;
    publishedAt?: Date | string | null;
    updatedAt?: Date | string | null;
}): { label: string; tone: TicketJourneyStateTone } {
    if (!journey.isPublished) return { label: "Brouillon — invisible sur Discord", tone: "draft" };

    const version = journey.publishedVersion ?? 0;
    const publishedAt = toTime(journey.publishedAt);
    const updatedAt = toTime(journey.updatedAt);
    if (publishedAt !== null && updatedAt !== null && updatedAt > publishedAt) {
        return { label: `Publié (v${version}) — modifications non publiées`, tone: "stale" };
    }
    return { label: `Publié (v${version})`, tone: "published" };
}
