/**
 * 🎫 Tickets v2 — **ouvrir un ticket depuis un parcours** (serveur : base de données, aucune règle).
 *
 * Ce que ce module fait : résoudre un parcours **réellement ouvrable** (publié, activé,
 * formulaire **figé** et relisible), tenir le **brouillon** (`TicketDraft`) entre deux
 * interactions Discord, et avancer d'une étape dans le tunnel. Ce que ce module ne fait
 * **pas** : décider des règles. Elles vivent dans `src/lib/tickets/**` (tunnel, routage,
 * notifications, messages) et sont testées sans base.
 *
 * Sans ce branchement, `isPublished` n'était lu par personne : « Publier » un parcours
 * n'avait aucun effet observable, et le ping des rôles n'était jamais envoyé.
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
    answersFromModalSubmit,
    createEmptyTicketForm,
    parseTicketForm,
    type TicketFormDefinition,
} from "@/lib/tickets/form-schema";
import {
    applyTicketChoice,
    isTicketDraftExpired,
    nextTicketTunnelStep,
    parseTicketDraftStep,
    pruneTicketTunnelAnswers,
    ticketDraftExpiresAt,
    type TicketDraftAnswers,
    type TicketTunnelStep,
} from "@/lib/tickets/journey-tunnel";

/** Le parcours tel que le moteur d'ouverture en a besoin (aucun champ d'édition). */
export type TicketJourneyOpenJourney = {
    id: string;
    name: string;
    slug: string;
    emoji: string | null;
    closePolicy: string;
    openMode: string;
    channelParentId: string | null;
    namingPattern: string;
    staffRoleIds: string[];
    notifyRoleIds: string[];
    teamNotifyRoleIds: string[];
};

export type TicketJourneyOpenContext = {
    guildInternalId: string;
    journey: TicketJourneyOpenJourney;
    /** Formulaire **figé** : `formVersionId` est la version que le ticket référencera. */
    form: TicketFormDefinition;
    formVersionId: string | null;
};

/**
 * `NOT_FOUND` = aucun parcours de ce nom dans cette guilde (l'appelant peut alors retomber
 * sur une catégorie v1, c'est le comportement des panneaux déjà déployés).
 * `REFUSED` = le parcours **existe mais n'est pas ouvrable** : on refuse en le disant,
 * jamais on ne devine ni on ne retombe silencieusement sur autre chose.
 */
export type TicketJourneyFailure = { ok: false; code: "NOT_FOUND" | "REFUSED" | "INVALID"; reason: string };
export type TicketJourneyContextResult = { ok: true; context: TicketJourneyOpenContext } | TicketJourneyFailure;

/**
 * Charge un parcours prêt à être ouvert. Fail-closed : brouillon, désactivé, formulaire
 * non publié ou version de formulaire absente ⇒ **refus motivé**.
 */
export async function loadTicketJourneyOpenContext(input: {
    discordGuildId: string;
    journeyId: string;
}): Promise<TicketJourneyContextResult> {
    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId: input.discordGuildId },
        select: { id: true, ticketConfig: { select: { isEnabled: true } } },
    });
    if (!guildConfig) return { ok: false, code: "REFUSED", reason: "Ce serveur n'est pas configuré sur SigilOS." };
    if (!guildConfig.ticketConfig?.isEnabled) {
        return { ok: false, code: "REFUSED", reason: "Le module de support n'est pas activé sur ce serveur." };
    }

    const journey = await db.ticketJourney.findFirst({
        where: { id: input.journeyId, guildId: guildConfig.id },
        include: { team: { select: { notifyRoleIds: true } } },
    });
    if (!journey) return { ok: false, code: "NOT_FOUND", reason: "Ce motif n'existe plus." };
    if (!journey.isPublished) return { ok: false, code: "REFUSED", reason: "Ce motif n'est pas encore ouvert." };
    if (!journey.isEnabled) return { ok: false, code: "REFUSED", reason: "Ce motif est temporairement fermé." };

    let form: TicketFormDefinition = createEmptyTicketForm();
    let formVersionId: string | null = null;

    if (journey.formId) {
        if (!journey.formVersion) {
            return { ok: false, code: "REFUSED", reason: "Le questionnaire de ce motif n'est pas publié." };
        }
        const version = await db.ticketFormVersion.findFirst({
            where: { formId: journey.formId, version: journey.formVersion, guildId: guildConfig.id },
            select: { id: true, schemaJson: true },
        });
        if (!version) {
            return {
                ok: false,
                code: "REFUSED",
                reason: "La version du questionnaire est introuvable : republie le parcours.",
            };
        }
        const parsed = parseTicketForm(version.schemaJson);
        if (!parsed.ok) {
            logger.warn("[tickets] questionnaire figé illisible", { journeyId: journey.id });
            return { ok: false, code: "REFUSED", reason: "Le questionnaire de ce motif est invalide." };
        }
        form = parsed.form;
        formVersionId = version.id;
    }

    return {
        ok: true,
        context: {
            guildInternalId: guildConfig.id,
            journey: {
                id: journey.id,
                name: journey.name,
                slug: journey.slug,
                emoji: journey.emoji,
                closePolicy: journey.closePolicy,
                openMode: journey.openMode,
                channelParentId: journey.channelParentId,
                namingPattern: journey.namingPattern,
                staffRoleIds: journey.staffRoleIds,
                notifyRoleIds: journey.notifyRoleIds,
                teamNotifyRoleIds: journey.team?.notifyRoleIds ?? [],
            },
            form,
            formVersionId,
        },
    };
}

/** Le brouillon d'ouverture d'un membre pour un parcours (`null` = aucun, ou périmé). */
export async function readTicketDraft(input: {
    guildId: string;
    journeyId: string;
    discordUserId: string;
}): Promise<{ answers: TicketDraftAnswers; step: string } | null> {
    const draft = await db.ticketDraft.findUnique({
        where: {
            guildId_journeyId_discordUserId: {
                guildId: input.guildId,
                journeyId: input.journeyId,
                discordUserId: input.discordUserId,
            },
        },
        select: { answersJson: true, step: true, expiresAt: true },
    });
    if (!draft) return null;
    // Un brouillon périmé est **absent** : on ne rouvre pas un questionnaire abandonné.
    if (isTicketDraftExpired(draft.expiresAt)) return null;

    return {
        answers: (draft.answersJson ?? {}) as TicketDraftAnswers,
        step: draft.step,
    };
}

/** Enregistre l'avancement (réponses + étape) et **prolonge** la fenêtre de reprise. */
export async function writeTicketDraft(input: {
    guildId: string;
    journeyId: string;
    discordUserId: string;
    formVersionId?: string | null;
    answers: TicketDraftAnswers;
    step: string;
}): Promise<void> {
    const values = {
        answersJson: input.answers as never,
        step: input.step,
        formVersionId: input.formVersionId ?? null,
        expiresAt: ticketDraftExpiresAt(),
    };

    await db.ticketDraft.upsert({
        where: {
            guildId_journeyId_discordUserId: {
                guildId: input.guildId,
                journeyId: input.journeyId,
                discordUserId: input.discordUserId,
            },
        },
        create: {
            guildId: input.guildId,
            journeyId: input.journeyId,
            discordUserId: input.discordUserId,
            ...values,
        },
        update: values,
    });
}

/** Supprime le brouillon (création réussie, ou nettoyage explicite). */
export async function clearTicketDraft(input: {
    guildId: string;
    journeyId: string;
    discordUserId: string;
}): Promise<void> {
    await db.ticketDraft.deleteMany({
        where: {
            guildId: input.guildId,
            journeyId: input.journeyId,
            discordUserId: input.discordUserId,
        },
    });
}


export type TicketJourneyAdvanceInput = {
    discordGuildId: string;
    journeyId: string;
    discordUserId: string;
    /** Page demandée par le bouton « Continuer » (le tunnel repart de cette page). */
    page?: number;
    /** Réponses de la modale qui vient d'être soumise. */
    submitted?: Array<{ customId: string; value: string }>;
    /** Choix `tb_pick` : champ visé et valeurs reçues (revalidées par `applyTicketChoice`). */
    choice?: { fieldId: string; values: unknown };
    /** `true` = reprendre à la page mémorisée par le brouillon (clic sur le panneau). */
    resume?: boolean;
};

export type TicketJourneyAdvanceResult =
    | {
          ok: true;
          context: TicketJourneyOpenContext;
          step: TicketTunnelStep;
          /** Réponses **normalisées** (clés = `id` de champ) : ce que la création revalidera. */
          answers: Record<string, string[]>;
      }
    | TicketJourneyFailure;



/**
 * Avance d'**une** étape : charge le parcours, applique ce qui vient d'arriver (choix,
 * réponses de modale), persiste le brouillon, et rend la prochaine interaction à montrer.
 *
 * `step.kind === "open"` ⇒ l'appelant peut créer le ticket ; les réponses rendues sont
 * exactement celles que la création revalidera (`evaluateAnswers`).
 */
export async function advanceTicketJourney(
    input: TicketJourneyAdvanceInput
): Promise<TicketJourneyAdvanceResult> {
    const loaded = await loadTicketJourneyOpenContext({
        discordGuildId: input.discordGuildId,
        journeyId: input.journeyId,
    });
    if (!loaded.ok) return loaded;

    const { context } = loaded;
    const draft = await readTicketDraft({
        guildId: context.guildInternalId,
        journeyId: input.journeyId,
        discordUserId: input.discordUserId,
    });

    let answers = pruneTicketTunnelAnswers(context.form, draft?.answers ?? {});

    if (input.submitted) {
        const submitted = answersFromModalSubmit(context.form, input.submitted);
        if (submitted.rejected.length > 0) {
            // Jamais de réponse devinée : une clé inventée ⇒ refus, brouillon inchangé.
            logger.warn("[tickets] soumission de modale hors formulaire", {
                journeyId: input.journeyId,
                rejected: submitted.rejected.slice(0, 5),
            });
            return {
                ok: false,
                code: "INVALID",
                reason: "Certaines réponses ne correspondent pas à ce questionnaire.",
            };
        }
        answers = pruneTicketTunnelAnswers(context.form, { ...answers, ...submitted.answers });
    }

    if (input.choice) {
        const applied = applyTicketChoice({
            form: context.form,
            answers,
            fieldId: input.choice.fieldId,
            values: input.choice.values,
        });
        if (!applied.ok) return { ok: false, code: "INVALID", reason: applied.reason };
        answers = pruneTicketTunnelAnswers(context.form, applied.answers);
    }

    const storedStep = parseTicketDraftStep(draft?.step);
    let page = input.page;
    if (page === undefined && input.submitted) {
        // La page vient d'être soumise entièrement : on ne la repose pas, on ouvre la suivante.
        page = storedStep.page + 1;
    } else if (page === undefined && input.resume && storedStep.stage === "TEXTS") {
        // Reprise : le brouillon dit où le membre s'est arrêté.
        page = storedStep.page;
    }

    const step = nextTicketTunnelStep({
        form: context.form,
        journeyId: input.journeyId,
        answers,
        page,
    });

    await writeTicketDraft({
        guildId: context.guildInternalId,
        journeyId: input.journeyId,
        discordUserId: input.discordUserId,
        formVersionId: context.formVersionId,
        answers,
        step: step.step,
    });

    return { ok: true, context, step, answers };
}
