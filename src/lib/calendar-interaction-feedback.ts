/**
 * Retour éphémère des boutons « S'inscrire » / « Se désinscrire » d'un événement
 * du calendrier (`calendar:join:{eventId}` / `calendar:leave:{eventId}`).
 *
 * Constat beta du 18/09/2026 (events raid) : un clic **réussi** renvoyait un
 * **ACK muet** Discord (`type: 6`) — le joueur ne voyait ni « bien inscrit » ni
 * le nouveau compteur — tandis que les refus (`Déjà inscrit`, « Patiente… »)
 * s'enchaînaient sans logique lisible. Les textes vivaient en dur dans la route,
 * sans test.
 *
 * Ce module ne fait **aucune I/O** : il traduit l'issue réelle de l'inscription
 * (calculée par `src/server/calendar-service.ts`) en message éphémère, et la
 * route le renvoie en `type: 4` (`flags: 64`). Règle tenue : **jamais muet**
 * (cf. `docs/agents/discord-module.md`).
 */

/** État du rafraîchissement de l'embed Discord après une action d'inscription. */
export type CalendarEmbedSyncStatus =
    /** PATCH Discord accepté : l'embed affiche le nouveau compteur. */
    | "synced"
    /** Aucun embed à rafraîchir (événement jamais publié, bot sans token…). */
    | "skipped"
    /** Discord a refusé le PATCH (404/403/400…) — le dashboard fait foi. */
    | "failed"
    /** Budget d'attente dépassé : le PATCH se termine en tâche de fond. */
    | "deferred";

export type CalendarInteractionAction = "join" | "leave";

/** Issue d'un clic, partagée par l'embed Discord **et** le dashboard. */
export interface CalendarRegistrationOutcome {
    success: boolean;
    error?: string;
    /** Déjà inscrit (clic doublon / embed périmé) : une information, pas un refus. */
    alreadyRegistered?: boolean;
    /** Aucune inscription à annuler (embed périmé). */
    notRegistered?: boolean;
    isReserve?: boolean;
    reserveMessage?: string;
    /** Places occupées (REGISTERED + CONFIRMED) : le chiffre affiché par l'embed. */
    registeredCount?: number;
    /** Personnes en file d'attente. */
    reserveCount?: number;
    maxParticipants?: number | null;
    /** Cette désinscription a promu le 1er de la file d'attente. */
    promoted?: boolean;
    /** Classe Dofus retenue pour cette inscription (modale / menu classe). */
    classe?: string;
    /** Renseigné **uniquement** quand un embed existait réellement à rafraîchir. */
    embedStatus?: CalendarEmbedSyncStatus;
}

/** Rappel affiché quand l'embed n'a pas suivi : le dashboard reste la source de vérité. */
export const CALENDAR_EMBED_WARNING =
    "\n⚠️ L'embed Discord n'a pas pu être rafraîchi — le dashboard fait foi.";

/** `x/y places` (ou `x inscrit(s)` si l'événement n'a pas de quota). */
function placesLabel(outcome: CalendarRegistrationOutcome): string {
    if (typeof outcome.registeredCount !== "number") return "";
    const max = outcome.maxParticipants;
    return max ? ` — ${outcome.registeredCount}/${max} places` : ` — ${outcome.registeredCount} inscrit(s)`;
}

/**
 * Un embed existait mais n'a pas suivi : on le dit au cliqueur au lieu de laisser
 * un compteur faux à l'écran (c'est ce silence qui a produit le constat beta).
 * `deferred` n'avertit pas : le PATCH est simplement en cours.
 */
function embedWarning(outcome: CalendarRegistrationOutcome): string {
    return outcome.embedStatus === "failed" || outcome.embedStatus === "skipped"
        ? CALENDAR_EMBED_WARNING
        : "";
}

/**
 * Rappel de la classe retenue (vide si l'inscription est « Sans classe ») :
 * confirme au joueur ce qui figure dans l'embed (constat beta du 19/09/2026 où
 * « S'inscrire » enregistrait un pseudo sans classe, sans rien dire).
 */
function classNote(outcome: CalendarRegistrationOutcome): string {
    return outcome.classe ? `\n🧩 Classe : **${outcome.classe}**` : "";
}

/**
 * Message éphémère renvoyé au cliqueur (`type: 4`, `flags: 64`).
 * Toujours non vide : la route ne répond **jamais** en silence à un bouton.
 */
export function buildCalendarInteractionFeedback(
    action: CalendarInteractionAction,
    outcome: CalendarRegistrationOutcome
): string {
    const places = placesLabel(outcome);
    const warning = embedWarning(outcome);

    if (!outcome.success) {
        if (action === "join" && outcome.alreadyRegistered) {
            return outcome.isReserve
                ? `ℹ️ Tu es **déjà en file d'attente**${places}.`
                : `ℹ️ Tu es **déjà inscrit**${places}.`;
        }
        if (action === "leave" && outcome.notRegistered) {
            return "ℹ️ Tu n'es pas inscrit à cet événement — rien à annuler.";
        }
        return `❌ ${outcome.error || "Erreur inconnue"}`;
    }

    if (action === "join") {
        if (outcome.isReserve) {
            const note = outcome.reserveMessage ?? "Une place se libère → tu es promu automatiquement.";
            return `⏳ **File d'attente**${places}. ${note}${warning}${classNote(outcome)}`;
        }
        return `✅ **Bien inscrit !**${places}.${warning}${classNote(outcome)}`;
    }


    const promotion = outcome.promoted ? "\n⬆️ Le 1er de la file d'attente a été promu." : "";
    return `👋 **Désinscrit**${places}.${promotion}${warning}`;
}
