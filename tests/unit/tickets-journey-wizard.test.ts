/**
 * 🎫 Tickets v2 — gardes de l'**assistant de parcours** (onglet « Parcours »).
 *
 * L'écran d'édition d'un parcours ne doit rien décider lui-même : ces tests verrouillent
 * les règles qui vivent dans `src/lib/tickets/journey-wizard.ts` — l'identifiant dérivé du
 * nom (jamais une collision silencieuse), ce qui bloque avant l'appel serveur, ce qui doit
 * être **dit** sans bloquer, la charge utile réellement envoyée à `saveTicketJourneyAction`,
 * et l'état affiché d'un parcours publié puis modifié.
 *
 * Le test le plus important : un slug déjà pris, un formulaire non publié ou un placeholder
 * inconnu doivent être **refusés/dits avant** l'appel serveur (l'utilisateur ne doit jamais
 * découvrir un refus sous forme de « Données invalides »), et `THREAD_PRIVATE` — que le
 * moteur n'exécute pas encore — ne doit **jamais** être écrit en base.
 */

import { describe, it, expect } from "vitest";
import {
    TICKET_NAMING_PLACEHOLDERS,
    buildTicketJourneyPayload,
    canLeaveTicketJourneyStep,
    createEmptyTicketJourneyDraft,
    describeTicketJourneyState,
    ensureUniqueTicketJourneySlug,
    evaluateTicketJourneyPublish,
    isTicketJourneySlugValid,
    previewTicketChannelName,
    slugifyTicketJourneySlug,
    ticketJourneyDraftFromRecord,
    validateTicketJourneyDraft,
    validateTicketNamingPattern,
    type TicketJourneyDraft,
    type TicketJourneyIssue,
} from "@/lib/tickets/journey-wizard";

const draft = (over: Partial<TicketJourneyDraft> = {}): TicketJourneyDraft => ({
    ...createEmptyTicketJourneyDraft(),
    name: "Candidature",
    slug: "candidature",
    ...over,
});

const errorsOf = (issues: TicketJourneyIssue[]) => issues.filter((issue) => issue.severity === "error");
const warningsOf = (issues: TicketJourneyIssue[]) => issues.filter((issue) => issue.severity === "warning");
const textOf = (issues: TicketJourneyIssue[]) => issues.map((issue) => issue.message).join(" | ");

describe("assistant de parcours — identifiant dérivé du nom", () => {
    it("retire accents, casse et ponctuation", () => {
        expect(slugifyTicketJourneySlug("Candidature Dofus")).toBe("candidature-dofus");
        expect(slugifyTicketJourneySlug("Rôles & Accès (2026)")).toBe("roles-acces-2026");
        expect(slugifyTicketJourneySlug("  Signaler   un  bug  ")).toBe("signaler-un-bug");
    });

    it("n'invente pas d'identifiant quand le nom n'en contient pas", () => {
        expect(slugifyTicketJourneySlug("🎫")).toBe("");
        expect(slugifyTicketJourneySlug("a")).toBe("");
        expect(slugifyTicketJourneySlug("")).toBe("");
    });

    it("borne à 60 caractères sans laisser de tiret final", () => {
        const slug = slugifyTicketJourneySlug("x".repeat(59) + " fin");
        expect(slug.length).toBeLessThanOrEqual(60);
        expect(slug.endsWith("-")).toBe(false);
        expect(isTicketJourneySlugValid(slug)).toBe(true);
    });

    it("valide exactement le contrat du serveur", () => {
        expect(isTicketJourneySlugValid("candidature")).toBe(true);
        expect(isTicketJourneySlugValid("ticket-2")).toBe(true);
        expect(isTicketJourneySlugValid("Candidature")).toBe(false);
        expect(isTicketJourneySlugValid("candidature_2")).toBe(false);
        expect(isTicketJourneySlugValid("a")).toBe(false);
        expect(isTicketJourneySlugValid("a".repeat(61))).toBe(false);
    });

    it("rend un identifiant libre plutôt que de collisionner", () => {
        expect(ensureUniqueTicketJourneySlug("Candidature", [])).toBe("candidature");
        expect(ensureUniqueTicketJourneySlug("Candidature", ["candidature"])).toBe("candidature-2");
        expect(ensureUniqueTicketJourneySlug("Candidature", ["candidature", "candidature-2"])).toBe("candidature-3");
        expect(ensureUniqueTicketJourneySlug("", [])).toBe("");
    });

    it("garde le suffixe dans la limite d'un identifiant déjà long", () => {
        const long = "z".repeat(60);
        const unique = ensureUniqueTicketJourneySlug(long, [long]);
        expect(unique).toBe("z".repeat(58) + "-2");
        expect(isTicketJourneySlugValid(unique)).toBe(true);
    });
});

describe("assistant de parcours — modèle de nom de salon", () => {
    it("accepte les placeholders que le moteur comprend", () => {
        expect(validateTicketNamingPattern("ticket-{num}")).toBeNull();
        expect(validateTicketNamingPattern("{journey}-{num}")).toBeNull();
        expect(validateTicketNamingPattern("support-{user}-{category}")).toBeNull();
    });

    it("refuse un placeholder inconnu en disant lesquels sont acceptés", () => {
        const issue = validateTicketNamingPattern("ticket-{numero}");
        expect(issue).not.toBeNull();
        expect(issue).toContain("{numero}");
        for (const placeholder of TICKET_NAMING_PLACEHOLDERS) expect(issue).toContain(placeholder);
    });

    it("refuse un modèle vide ou trop long", () => {
        expect(validateTicketNamingPattern("   ")).toContain("vide");
        expect(validateTicketNamingPattern("x".repeat(81))).toContain("trop long");
    });

    it("montre le nom de salon réel du 1ᵉʳ ticket", () => {
        expect(previewTicketChannelName("ticket-{num}", "Candidature")).toBe("ticket-0001");
        expect(previewTicketChannelName("ticket-{journey}", "Réclamation Urgente")).toBe(
            "ticket-reclamation-urgente"
        );
    });
});

describe("assistant de parcours — ce qui bloque et ce qui se dit", () => {
    it("un brouillon nommé passe : seuls des avertissements, chacun sur son étape", () => {
        const issues = validateTicketJourneyDraft(draft());
        expect(errorsOf(issues)).toHaveLength(0);

        const warnings = warningsOf(issues);
        expect(textOf(warnings)).toContain("Aucun rôle staff");
        expect(textOf(warnings)).toContain("Aucune catégorie");
        for (const issue of warnings) expect(["opening", "team"]).toContain(issue.step);
    });

    it("le nom et l'identifiant sont exigés (2 caractères minimum)", () => {
        const issues = validateTicketJourneyDraft(draft({ name: "A", slug: "" }));
        expect(textOf(errorsOf(issues))).toContain("nom du parcours est requis");
        expect(textOf(errorsOf(issues))).toContain("identifiant est requis");
        for (const issue of errorsOf(issues)) expect(issue.step).toBe("identity");
    });

    it("un identifiant déjà pris est refusé avant l'appel serveur", () => {
        const issues = validateTicketJourneyDraft(draft(), { takenSlugs: ["candidature"] });
        expect(textOf(errorsOf(issues))).toContain("déjà utilisé");
    });

    it("un identifiant hors contrat est refusé", () => {
        const issues = validateTicketJourneyDraft(draft({ slug: "Candidature!" }));
        expect(textOf(errorsOf(issues))).toContain("Identifiant invalide");
    });

    it("respecte les bornes du serveur (description, émoji, ordre)", () => {
        const issues = validateTicketJourneyDraft(
            draft({ description: "d".repeat(301), emoji: "🎫🎫🎫🎫🎫", order: 1000 })
        );
        const text = textOf(errorsOf(issues));
        expect(text).toContain("description est trop longue");
        expect(text).toContain("émoji est trop long");
        expect(text).toContain("entier entre 0 et 999");

        expect(textOf(validateTicketJourneyDraft(draft({ order: 12.5 })))).toContain("entier entre 0 et 999");
    });

    it("signale un fil privé : le moteur ne l'ouvre pas encore", () => {
        const issues = validateTicketJourneyDraft(draft({ channelType: "THREAD_PRIVATE" }));
        expect(errorsOf(issues)).toHaveLength(0);
        const warn = warningsOf(issues).find((issue) => issue.step === "opening");
        expect(warn?.message).toContain("fil privé");
    });

    it("signale l'approbation et n'enregistre jamais un mode sans exécutant", () => {
        const issues = validateTicketJourneyDraft(draft({ openMode: "APPROVAL" }));
        expect(errorsOf(issues)).toHaveLength(0);
        expect(textOf(warningsOf(issues))).toContain("approbation");
        expect(buildTicketJourneyPayload(draft({ openMode: "APPROVAL" })).openMode).toBe("INSTANT");
    });

    it("un placeholder inconnu bloque l'étape « Ouverture »", () => {
        const issues = validateTicketJourneyDraft(draft({ namingPattern: "ticket-{num}-{sujet}" }));
        const opening = errorsOf(issues).filter((issue) => issue.step === "opening");
        expect(opening).toHaveLength(1);
        expect(opening[0].message).toContain("{sujet}");
    });

    it("un modèle sans {num} avertit sans bloquer", () => {
        const issues = validateTicketJourneyDraft(draft({ namingPattern: "support-{journey}" }));
        expect(errorsOf(issues)).toHaveLength(0);
        expect(textOf(warningsOf(issues))).toContain("même nom de salon");
    });

    it("une équipe inconnue bloque, une équipe désactivée avertit", () => {
        const unknown = validateTicketJourneyDraft(draft({ teamId: "team-x" }), { teams: [] });
        expect(textOf(errorsOf(unknown))).toContain("Équipe introuvable");

        const disabled = validateTicketJourneyDraft(draft({ teamId: "team-x", staffRoleIds: ["role-1"] }), {
            teams: [{ id: "team-x", name: "Modération", isEnabled: false }],
        });
        expect(errorsOf(disabled)).toHaveLength(0);
        expect(textOf(warningsOf(disabled))).toContain("Modération");
        expect(textOf(warningsOf(disabled))).toContain("désactivée");
    });

    it("un formulaire non publié bloque l'étape « Questionnaire »", () => {
        const issues = validateTicketJourneyDraft(draft({ formId: "form-1" }), {
            forms: [{ id: "form-1", name: "Intake", publishedVersion: null }],
        });
        const form = errorsOf(issues).filter((issue) => issue.step === "form");
        expect(form).toHaveLength(1);
        expect(form[0].message).toContain("publie-le d'abord");

        const unknown = validateTicketJourneyDraft(draft({ formId: "form-2" }), {
            forms: [{ id: "form-1", name: "Intake", publishedVersion: 3 }],
        });
        expect(textOf(errorsOf(unknown))).toContain("Formulaire introuvable");
    });

    it("les avertissements ne bloquent pas la navigation, les erreurs si", () => {
        const blocked = validateTicketJourneyDraft(draft({ name: "" }));
        expect(canLeaveTicketJourneyStep(blocked, "identity")).toBe(false);
        expect(canLeaveTicketJourneyStep(blocked, "opening")).toBe(true);
        expect(canLeaveTicketJourneyStep(validateTicketJourneyDraft(draft()), "identity")).toBe(true);
    });
});

describe("assistant de parcours — charge utile envoyée au serveur", () => {
    it("respecte exactement les clés du contrat serveur (aucune clé en trop)", () => {
        expect(Object.keys(buildTicketJourneyPayload(draft())).sort()).toEqual([
            "buttonStyle",
            "channelParentId",
            "channelType",
            "closePolicy",
            "description",
            "emoji",
            "formId",
            "isEnabled",
            "name",
            "namingPattern",
            "openMode",
            "order",
            "slug",
            "staffRoleIds",
            "teamId",
        ]);
    });

    it("n'envoie pas d'identifiant à la création, l'envoie en édition", () => {
        expect(buildTicketJourneyPayload(draft())).not.toHaveProperty("id");
        expect(buildTicketJourneyPayload(draft({ id: "j-1" })).id).toBe("j-1");
    });

    it("retirer une équipe ou un questionnaire efface le rattachement (`null`, pas `undefined`)", () => {
        const payload = buildTicketJourneyPayload(draft({ teamId: "", formId: "", description: "  " }));
        expect(payload.teamId).toBeNull();
        expect(payload.formId).toBeNull();
        expect(payload.description).toBeNull();
        expect(payload.channelParentId).toBeNull();
    });

    it("applique les replis du serveur et rogne les espaces", () => {
        const payload = buildTicketJourneyPayload(
            draft({ name: "  Candidature  ", slug: " candidature ", emoji: "  ", namingPattern: "   " })
        );
        expect(payload.name).toBe("Candidature");
        expect(payload.slug).toBe("candidature");
        expect(payload.emoji).toBe("🎫");
        expect(payload.namingPattern).toBe("ticket-{num}");
    });

    it("force un salon texte : un fil privé n'est jamais enregistré (rien ne l'exécute encore)", () => {
        const payload = buildTicketJourneyPayload(draft({ channelType: "THREAD_PRIVATE" }));
        expect(payload.channelType).toBe("CHANNEL_TEXT");
    });

    it("n'envoie pas `formVersion` : c'est le serveur qui la fige à la publication", () => {
        expect(buildTicketJourneyPayload(draft({ formId: "form-1" }))).not.toHaveProperty("formVersion");
    });
});

describe("assistant de parcours — publication et état affiché", () => {
    it("ne publie pas un parcours qui n'est pas encore enregistré", () => {
        const decision = evaluateTicketJourneyPublish({ formId: null });
        expect(decision.ok).toBe(false);
        if (!decision.ok) expect(decision.reason).toContain("Enregistre le parcours");
    });

    it("refuse de publier un parcours rattaché à un formulaire non publié", () => {
        const decision = evaluateTicketJourneyPublish(
            { id: "j-1", formId: "form-1" },
            { forms: [{ id: "form-1", name: "Intake", publishedVersion: null }] }
        );
        expect(decision.ok).toBe(false);
        if (!decision.ok) expect(decision.reason).toContain("publie-le d'abord");
    });

    it("publie sans questionnaire, ou avec un questionnaire publié", () => {
        expect(evaluateTicketJourneyPublish({ id: "j-1", formId: "" }).ok).toBe(true);
        expect(
            evaluateTicketJourneyPublish(
                { id: "j-1", formId: "form-1" },
                { forms: [{ id: "form-1", name: "Intake", publishedVersion: 3 }] }
            ).ok
        ).toBe(true);
    });

    it("dit « Brouillon » tant que rien n'est publié", () => {
        expect(describeTicketJourneyState({ isPublished: false })).toEqual({
            label: "Brouillon — invisible sur Discord",
            tone: "draft",
        });
    });

    it("dit « Publié », puis signale les modifications non publiées", () => {
        const published = describeTicketJourneyState({
            isPublished: true,
            publishedVersion: 4,
            publishedAt: "2026-09-02T10:00:00.000Z",
            updatedAt: "2026-09-01T10:00:00.000Z",
        });
        expect(published.tone).toBe("published");
        expect(published.label).toBe("Publié (v4)");

        const stale = describeTicketJourneyState({
            isPublished: true,
            publishedVersion: 4,
            publishedAt: "2026-09-01T10:00:00.000Z",
            updatedAt: "2026-09-02T10:00:00.000Z",
        });
        expect(stale.tone).toBe("stale");
        expect(stale.label).toContain("modifications non publiées");
    });

    it("ne devine pas d'état sans date de publication", () => {
        expect(describeTicketJourneyState({ isPublished: true, publishedVersion: 2 }).tone).toBe("published");
        expect(
            describeTicketJourneyState({
                isPublished: true,
                publishedVersion: 2,
                publishedAt: "2026-09-01T10:00:00.000Z",
                updatedAt: "2026-09-01T10:00:00.000Z",
            }).tone
        ).toBe("published");
    });
});

describe("assistant de parcours — ouverture d'un parcours existant", () => {
    it("ne laisse aucun `null` dans le formulaire", () => {
        const loaded = ticketJourneyDraftFromRecord({
            id: "j-1",
            name: "Candidature",
            slug: "candidature",
            description: null,
            emoji: null,
            buttonStyle: "DANGER",
            channelType: "CHANNEL_TEXT",
            channelParentId: null,
            staffRoleIds: null,
            teamId: null,
            formId: null,
            namingPattern: "",
            openMode: "APPROVAL",
            closePolicy: "STAFF_OR_CREATOR",
            order: 3,
            isEnabled: false,
        });

        expect(loaded).toEqual({
            id: "j-1",
            name: "Candidature",
            slug: "candidature",
            description: "",
            emoji: "🎫",
            buttonStyle: "DANGER",
            channelType: "CHANNEL_TEXT",
            channelParentId: "",
            staffRoleIds: [],
            teamId: "",
            formId: "",
            namingPattern: "ticket-{num}",
            openMode: "APPROVAL",
            closePolicy: "STAFF_OR_CREATOR",
            order: 3,
            isEnabled: false,
        });
    });

    it("retombe sur des valeurs sûres si une colonne porte un ancien format", () => {
        const loaded = ticketJourneyDraftFromRecord({
            id: "j-2",
            name: "Ancien",
            slug: "ancien",
            buttonStyle: "WEIRD",
            channelType: "THREAD_PRIVATE",
            openMode: "PARFOIS",
            closePolicy: null,
            order: null,
            isEnabled: null,
        });

        expect(loaded.buttonStyle).toBe("PRIMARY");
        expect(loaded.openMode).toBe("INSTANT");
        expect(loaded.closePolicy).toBe("STAFF_ONLY");
        expect(loaded.order).toBe(0);
        expect(loaded.isEnabled).toBe(true);
        // Un fil privé est **conservé** pour que l'assistant puisse le signaler.
        expect(loaded.channelType).toBe("THREAD_PRIVATE");
        expect(validateTicketJourneyDraft(loaded)).toContainEqual({
            step: "opening",
            severity: "warning",
            message: expect.stringContaining("fil privé"),
        });
    });
});
