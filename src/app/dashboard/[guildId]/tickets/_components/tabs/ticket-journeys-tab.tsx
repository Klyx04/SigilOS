"use client";

/**
 * 🎫 Tickets v2 — **onglet « Parcours »** et son assistant 5 étapes.
 *
 * L'écran ne décide **rien** : toutes les règles (nom, identifiant, erreurs vs
 * avertissements, charge utile acceptée par le serveur, état publié/brouillon) vivent dans
 * `src/lib/tickets/journey-wizard.ts` et sont testées sans base. Ici on affiche, on
 * navigue entre les étapes, et on appelle les actions serveur.
 *
 * Deux principes d'honnêteté visibles dans l'interface :
 *   · un réglage que **rien** n'exécute n'est pas proposé (fils privés, approbation) ;
 *   · un parcours **brouillon** est dit « invisible sur Discord » ; une modification après
 *     publication est dite « modifications non publiées ».
 */

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
    Route,
    Plus,
    Edit2,
    Trash2,
    Send,
    Check,
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    Power,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { TicketCategoryPicker, TicketRolesPicker } from "../ticket-discord-pickers";
import {
    deleteTicketJourneyAction,
    publishTicketJourneyAction,
    saveTicketJourneyAction,
} from "@/server/actions/ticket-bot-actions";
import {
    TICKET_CHANNEL_TYPE_LABELS,
    TICKET_CLOSE_POLICIES,
    TICKET_CLOSE_POLICY_LABELS,
    TICKET_JOURNEY_BUTTON_STYLES,
    TICKET_JOURNEY_BUTTON_STYLE_LABELS,
    TICKET_JOURNEY_DESCRIPTION_MAX,
    TICKET_JOURNEY_NAME_MAX,
    TICKET_JOURNEY_SLUG_MAX,
    TICKET_JOURNEY_WIZARD_STEPS,
    TICKET_NAMING_PLACEHOLDERS,
    TICKET_OPEN_MODES,
    TICKET_OPEN_MODE_LABELS,
    blockingTicketJourneyIssues,
    buildTicketJourneyPayload,
    canLeaveTicketJourneyStep,
    createEmptyTicketJourneyDraft,
    describeTicketJourneyState,
    ensureUniqueTicketJourneySlug,
    evaluateTicketJourneyPublish,
    previewTicketChannelName,
    slugifyTicketJourneySlug,
    ticketJourneyDraftFromRecord,
    validateTicketJourneyDraft,
    type TicketJourneyDraft,
} from "@/lib/tickets/journey-wizard";
import {
    TICKET_NOTIFY_ROLES_MAX,
    TICKET_NOTIFY_SOURCE_LABELS,
    resolveTicketNotifyRoleIds,
} from "@/lib/tickets/notifications";

interface TicketJourneysTabProps {
    guildId: string;
    journeys: any[];
    forms: any[];
    teams: any[];
    onRefresh: () => void;
}

const TONE_CLASSES: Record<string, string> = {
    draft: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    stale: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    published: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

export function TicketJourneysTab({ guildId, journeys, forms, teams, onRefresh }: TicketJourneysTabProps) {
    const [wizardOpen, setWizardOpen] = useState(false);
    const [draft, setDraft] = useState<TicketJourneyDraft>(createEmptyTicketJourneyDraft());
    const [stepIndex, setStepIndex] = useState(0);
    const [slugTouched, setSlugTouched] = useState(false);
    const [isPending, startTransition] = useTransition();

    const step = TICKET_JOURNEY_WIZARD_STEPS[stepIndex];

    /** Identifiants déjà pris par les **autres** parcours (l'unicité est une règle serveur). */
    const takenSlugs = useMemo(
        () => journeys.filter((journey) => journey.id !== draft.id).map((journey) => String(journey.slug)),
        [journeys, draft.id]
    );

    const issues = useMemo(
        () => validateTicketJourneyDraft(draft, { takenSlugs, forms, teams }),
        [draft, takenSlugs, forms, teams]
    );
    const stepIssues = issues.filter((issue) => issue.step === step.id);
    const advancedIssues = blockingTicketJourneyIssues(issues);
    const canAdvance = canLeaveTicketJourneyStep(issues, step.id);

    const selectedTeam = teams.find((team) => team.id === draft.teamId);
    const notify = resolveTicketNotifyRoleIds({
        journeyRoleIds: draft.notifyRoleIds,
        teamRoleIds: selectedTeam?.notifyRoleIds ?? [],
    });

    const patch = (values: Partial<TicketJourneyDraft>) => setDraft((previous) => ({ ...previous, ...values }));

    const openCreate = () => {
        setDraft(createEmptyTicketJourneyDraft(journeys.length));
        setSlugTouched(false);
        setStepIndex(0);
        setWizardOpen(true);
    };

    const openEdit = (journey: any) => {
        setDraft(ticketJourneyDraftFromRecord(journey));
        setSlugTouched(true);
        setStepIndex(0);
        setWizardOpen(true);
    };

    const handleSave = (options: { publish?: boolean } = {}) => {
        const blocking = blockingTicketJourneyIssues(issues);
        if (blocking.length > 0) return toast.error(blocking[0].message);

        const payload = buildTicketJourneyPayload(draft);

        startTransition(async () => {
            const res = await saveTicketJourneyAction(guildId, payload);
            if (!res.success) {
                toast.error(res.error || "Erreur enregistrement du parcours");
                return;
            }

            const savedId = (res.data?.id as string | undefined) ?? draft.id;

            if (options.publish) {
                const verdict = evaluateTicketJourneyPublish({ id: savedId, formId: draft.formId }, { forms });
                if (!verdict.ok) {
                    toast.error(verdict.reason);
                    return;
                }

                const publishRes = await publishTicketJourneyAction(guildId, savedId as string);
                if (!publishRes.success) {
                    toast.error(publishRes.error || "Erreur publication du parcours");
                    return;
                }
            }

            toast.success(options.publish ? "Parcours enregistré et publié !" : "Parcours enregistré !");
            setWizardOpen(false);
            onRefresh();
        });
    };

    const handlePublish = (journey: any) => {
        const verdict = evaluateTicketJourneyPublish(journey, { forms });
        if (!verdict.ok) {
            toast.error(verdict.reason);
            return;
        }

        startTransition(async () => {
            const res = await publishTicketJourneyAction(guildId, journey.id);
            if (!res.success) {
                toast.error(res.error || "Erreur publication");
                return;
            }
            toast.success("Parcours publié : il apparaît maintenant sur les panneaux Discord.");
            onRefresh();
        });
    };

    const handleToggleEnabled = (journey: any) => {
        const payload = buildTicketJourneyPayload({
            ...ticketJourneyDraftFromRecord(journey),
            isEnabled: !journey.isEnabled,
        });

        startTransition(async () => {
            const res = await saveTicketJourneyAction(guildId, payload);
            if (!res.success) {
                toast.error(res.error || "Erreur mise à jour");
                return;
            }
            toast.success(journey.isEnabled ? "Parcours désactivé." : "Parcours activé.");
            onRefresh();
        });
    };

    const handleDelete = (journey: any) => {
        if (!confirm(`Supprimer le parcours « ${journey.name} » ? Les tickets déjà ouverts ne sont pas touchés.`)) {
            return;
        }
        startTransition(async () => {
            const res = await deleteTicketJourneyAction(guildId, journey.id);
            if (!res.success) {
                toast.error(res.error || "Erreur suppression");
                return;
            }
            toast.success("Parcours supprimé.");
            onRefresh();
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <Route className="h-5 w-5 text-amber-400" /> Parcours d'ouverture
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        Un parcours = un motif (« Candidature », « Contacter le staff »). Tant qu'il n'est pas{" "}
                        <strong>publié</strong>, il n'apparaît sur aucun panneau Discord.
                    </p>
                </div>

                <Button onClick={openCreate} size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs">
                    <Plus className="h-4 w-4 mr-1" /> Nouveau parcours
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {journeys.length === 0 ? (
                    <div className="col-span-full text-center py-12 border border-dashed border-border rounded-2xl bg-surface/30">
                        <Route className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                        <h3 className="text-base font-semibold text-foreground mb-1">Aucun parcours</h3>
                        <p className="text-xs text-muted-foreground mb-4">
                            Crée un parcours, publie-le, puis expose-le sur un panneau Discord.
                        </p>
                        <Button onClick={openCreate} size="sm" variant="outline" className="text-xs">
                            <Plus className="h-3.5 w-3.5 mr-1" /> Nouveau parcours
                        </Button>
                    </div>
                ) : (
                    journeys.map((journey) => {
                        const state = describeTicketJourneyState(journey);
                        const team = teams.find((candidate) => candidate.id === journey.teamId);
                        const form = forms.find((candidate) => candidate.id === journey.formId);
                        return (
                            <div
                                key={journey.id}
                                className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4 flex flex-col justify-between"
                            >
                                <div className="space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-start gap-2">
                                            <span className="text-xl">{journey.emoji || "🎫"}</span>
                                            <div>
                                                <h3 className="font-bold text-base text-foreground">{journey.name}</h3>
                                                <div className="text-[11px] text-muted-foreground font-mono">
                                                    {journey.slug}
                                                </div>
                                            </div>
                                        </div>
                                        <Badge className={`text-[10px] border ${TONE_CLASSES[state.tone]}`}>
                                            {state.label}
                                        </Badge>
                                    </div>

                                    {journey.description && (
                                        <p className="text-xs text-muted-foreground line-clamp-2">{journey.description}</p>
                                    )}

                                    <div className="text-[11px] text-muted-foreground space-y-1">
                                        <div>
                                            Questionnaire :{" "}
                                            <span className="text-foreground font-semibold">
                                                {form ? form.name : "aucun (ouverture directe)"}
                                            </span>
                                        </div>
                                        <div>
                                            Équipe :{" "}
                                            <span className="text-foreground font-semibold">
                                                {team ? team.name : "aucune"}
                                            </span>
                                        </div>
                                        <div>
                                            Tickets ouverts :{" "}
                                            <span className="text-foreground font-semibold">
                                                {journey._count?.tickets ?? 0}
                                            </span>
                                        </div>
                                    </div>

                                    {!journey.isEnabled && (
                                        <div className="text-[11px] text-amber-300 flex items-center gap-1">
                                            <AlertTriangle className="h-3.5 w-3.5" /> Désactivé : le bouton refuse
                                            l'ouverture.
                                        </div>
                                    )}
                                </div>

                                <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => openEdit(journey)}
                                            className="h-8 px-2 text-xs"
                                            title="Modifier"
                                        >
                                            <Edit2 className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleToggleEnabled(journey)}
                                            disabled={isPending}
                                            className="h-8 px-2 text-xs"
                                            title={journey.isEnabled ? "Désactiver" : "Activer"}
                                        >
                                            <Power className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleDelete(journey)}
                                            disabled={isPending}
                                            className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                                            title="Supprimer"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>

                                    <Button
                                        size="sm"
                                        onClick={() => handlePublish(journey)}
                                        disabled={isPending}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                                    >
                                        <Send className="h-3.5 w-3.5 mr-1" /> Publier
                                    </Button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
                <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {draft.id ? `Modifier « ${draft.name || "parcours"} »` : "Nouveau parcours d'ouverture"}
                        </DialogTitle>
                    </DialogHeader>

                    {/* Étapes : une question par écran (l'ordre vit dans journey-wizard.ts). */}
                    <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-border/50">
                        {TICKET_JOURNEY_WIZARD_STEPS.map((wizardStep, index) => {
                            const stepErrors = blockingTicketJourneyIssues(issues, wizardStep.id).length;
                            const isCurrent = index === stepIndex;
                            return (
                                <button
                                    key={wizardStep.id}
                                    type="button"
                                    onClick={() => setStepIndex(index)}
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                                        isCurrent
                                            ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                            : "text-muted-foreground border-transparent hover:bg-surface/60"
                                    }`}
                                >
                                    <span>{index + 1}. {wizardStep.label}</span>
                                    {stepErrors > 0 && <AlertTriangle className="h-3 w-3 text-destructive" />}
                                </button>
                            );
                        })}
                    </div>

                    <p className="text-[11px] text-muted-foreground">{step.description}</p>

                    <div className="space-y-4 py-1 text-xs">
                        {step.id === "identity" && (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-[1fr_80px] gap-3">
                                    <div className="space-y-1.5">
                                        <label className="font-semibold text-foreground">
                                            Nom vu par les membres
                                        </label>
                                        <Input
                                            value={draft.name}
                                            maxLength={TICKET_JOURNEY_NAME_MAX}
                                            placeholder="ex: Candidature"
                                            onChange={(event) => {
                                                const name = event.target.value;
                                                patch({
                                                    name,
                                                    // L'identifiant se déduit du nom, **sans collision silencieuse**.
                                                    slug: slugTouched
                                                        ? draft.slug
                                                        : ensureUniqueTicketJourneySlug(
                                                              slugifyTicketJourneySlug(name),
                                                              takenSlugs
                                                          ),
                                                });
                                            }}
                                            className="text-xs h-8"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="font-semibold text-foreground">Émoji</label>
                                        <Input
                                            value={draft.emoji}
                                            maxLength={8}
                                            onChange={(event) => patch({ emoji: event.target.value })}
                                            className="text-xs h-8 text-center"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="font-semibold text-foreground">
                                        Identifiant technique (utilisé par les boutons Discord)
                                    </label>
                                    <Input
                                        value={draft.slug}
                                        maxLength={TICKET_JOURNEY_SLUG_MAX}
                                        onChange={(event) => {
                                            setSlugTouched(true);
                                            patch({ slug: slugifyTicketJourneySlug(event.target.value) });
                                        }}
                                        className="text-xs h-8 font-mono"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="font-semibold text-foreground">Description interne</label>
                                    <Textarea
                                        value={draft.description}
                                        maxLength={TICKET_JOURNEY_DESCRIPTION_MAX}
                                        rows={2}
                                        placeholder="À quoi sert ce parcours, pour l'équipe."
                                        onChange={(event) => patch({ description: event.target.value })}
                                        className="text-xs"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="font-semibold text-foreground">Ordre d'affichage</label>
                                        <Input
                                            type="number"
                                            min={0}
                                            value={draft.order}
                                            onChange={(event) =>
                                                patch({ order: Number.parseInt(event.target.value || "0", 10) || 0 })
                                            }
                                            className="text-xs h-8"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="font-semibold text-foreground">Style du bouton</label>
                                        <select
                                            value={draft.buttonStyle}
                                            onChange={(event) =>
                                                patch({
                                                    buttonStyle: event.target
                                                        .value as TicketJourneyDraft["buttonStyle"],
                                                })
                                            }
                                            className="w-full h-8 px-2 text-xs rounded-lg border border-border bg-background text-foreground"
                                        >
                                            {TICKET_JOURNEY_BUTTON_STYLES.map((style) => (
                                                <option key={style} value={style}>
                                                    {TICKET_JOURNEY_BUTTON_STYLE_LABELS[style]}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </>
                        )}
                        {step.id === "opening" && (
                            <>
                                <div className="space-y-1.5">
                                    <label className="font-semibold text-foreground">
                                        Catégorie Discord où créer les salons
                                    </label>
                                    <TicketCategoryPicker
                                        guildId={guildId}
                                        value={draft.channelParentId}
                                        onChange={(channelId) => patch({ channelParentId: channelId })}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="font-semibold text-foreground">Nom des salons créés</label>
                                    <Input
                                        value={draft.namingPattern}
                                        onChange={(event) => patch({ namingPattern: event.target.value })}
                                        className="text-xs h-8 font-mono"
                                    />
                                    <div className="text-[11px] text-muted-foreground space-y-1">
                                        <div>
                                            Placeholders :{" "}
                                            {TICKET_NAMING_PLACEHOLDERS.map((placeholder) => (
                                                <code key={placeholder} className="mx-0.5 px-1 rounded bg-surface">
                                                    {placeholder}
                                                </code>
                                            ))}
                                        </div>
                                        <div>
                                            Aperçu du premier salon :{" "}
                                            <span className="font-mono text-foreground">
                                                {previewTicketChannelName(
                                                    draft.namingPattern,
                                                    draft.name || "candidature"
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="font-semibold text-foreground">Qui peut fermer un ticket ?</label>
                                    <select
                                        value={draft.closePolicy}
                                        onChange={(event) =>
                                            patch({
                                                closePolicy: event.target.value as TicketJourneyDraft["closePolicy"],
                                            })
                                        }
                                        className="w-full h-8 px-2 text-xs rounded-lg border border-border bg-background text-foreground"
                                    >
                                        {TICKET_CLOSE_POLICIES.map((policy) => (
                                            <option key={policy} value={policy}>
                                                {TICKET_CLOSE_POLICY_LABELS[policy]}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Réglages volontairement **non proposés** : rien ne les exécute encore. */}
                                <div className="rounded-xl border border-border bg-surface/40 p-3 space-y-1 text-[11px] text-muted-foreground">
                                    <div>
                                        Type de salon : <strong>{TICKET_CHANNEL_TYPE_LABELS.CHANNEL_TEXT}</strong> — les
                                        fils privés ne sont pas encore ouverts par le moteur (le réglage n'est donc pas
                                        enregistré).
                                    </div>
                                    <div>
                                        Ouverture : <strong>{TICKET_OPEN_MODE_LABELS.INSTANT}</strong> — la file
                                        d'approbation n'existe pas encore (aucun bouton « Accepter »).
                                    </div>
                                </div>
                            </>
                        )}
                        {step.id === "team" && (
                            <>
                                <div className="space-y-1.5">
                                    <label className="font-semibold text-foreground">Équipe (rôles réutilisables)</label>
                                    <select
                                        value={draft.teamId}
                                        onChange={(event) => patch({ teamId: event.target.value })}
                                        className="w-full h-8 px-2 text-xs rounded-lg border border-border bg-background text-foreground"
                                    >
                                        <option value="">Aucune équipe</option>
                                        {teams.map((team) => (
                                            <option key={team.id} value={team.id}>
                                                {team.name}
                                                {team.isEnabled ? "" : " (désactivée)"}
                                            </option>
                                        ))}
                                    </select>
                                    {teams.length === 0 && (
                                        <p className="text-[11px] text-muted-foreground">
                                            Aucune équipe enregistrée : le chantier « Équipe » (T3) n'est pas encore
                                            livré. Les rôles ci-dessous suffisent.
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <label className="font-semibold text-foreground">
                                        Rôles staff de ce parcours
                                    </label>
                                    <TicketRolesPicker
                                        guildId={guildId}
                                        value={draft.staffRoleIds}
                                        onChange={(roleIds) => patch({ staffRoleIds: roleIds })}
                                        description="Ces rôles voient et traitent les tickets de ce parcours."
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="font-semibold text-foreground">
                                        Rôles mentionnés à l'ouverture ({TICKET_NOTIFY_ROLES_MAX} maximum)
                                    </label>
                                    <TicketRolesPicker
                                        guildId={guildId}
                                        value={draft.notifyRoleIds}
                                        onChange={(roleIds) => patch({ notifyRoleIds: roleIds })}
                                        description="Ces rôles reçoivent une notification à chaque ouverture de ce parcours."
                                    />
                                    <p className="text-[11px] text-muted-foreground">
                                        {TICKET_NOTIFY_SOURCE_LABELS[notify.source]}
                                        {notify.source === "team" && (
                                            <>
                                                {" "}
                                                (
                                                <span className="font-mono">
                                                    {notify.roleIds.length} rôle(s)
                                                </span>
                                                )
                                            </>
                                        )}
                                        {" · "}jamais <code>@everyone</code>.
                                    </p>
                                </div>
                            </>
                        )}
                        {step.id === "form" && (
                            <>
                                <div className="space-y-1.5">
                                    <label className="font-semibold text-foreground">Questionnaire d'ouverture</label>
                                    <select
                                        value={draft.formId}
                                        onChange={(event) => patch({ formId: event.target.value })}
                                        className="w-full h-8 px-2 text-xs rounded-lg border border-border bg-background text-foreground"
                                    >
                                        <option value="">Aucun questionnaire (ouverture directe)</option>
                                        {forms.map((form) => (
                                            <option key={form.id} value={form.id}>
                                                {form.name}
                                                {form.publishedVersion
                                                    ? ` — publié (v${form.publishedVersion})`
                                                    : " — non publié"}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[11px] text-muted-foreground">
                                        Seul un formulaire <strong>publié</strong> peut être rattaché : les réponses
                                        sont alors relues avec la version figée du jour de l'ouverture.
                                    </p>
                                    {forms.length === 0 && (
                                        <p className="text-[11px] text-muted-foreground">
                                            Aucun formulaire pour l'instant : son constructeur (20 questions) est le
                                            chantier suivant (« Formulaires », T2). Sans questionnaire, le bouton ouvre
                                            le ticket directement.
                                        </p>
                                    )}
                                </div>

                                <div className="rounded-xl border border-border bg-surface/40 p-3 text-[11px] text-muted-foreground">
                                    Les questions à choix (Oui/Non, listes) se répondent <strong>avant</strong> la modale,
                                    et les questions texte sont posées <strong>5 par 5</strong> : c'est la limite Discord
                                    d'une modale, d'où le bouton « Continuer » du tunnel.
                                </div>
                            </>
                        )}
                        {step.id === "review" && (
                            <div className="rounded-xl border border-border bg-surface/40 p-3 space-y-1.5">
                                <div className="font-semibold text-foreground">
                                    {draft.emoji} {draft.name || "(nom manquant)"}{" "}
                                    <span className="font-mono text-[11px] text-muted-foreground">{draft.slug}</span>
                                </div>
                                <div className="text-[11px] text-muted-foreground space-y-0.5">
                                    <div>
                                        Salon créé :{" "}
                                        <span className="font-mono text-foreground">
                                            {previewTicketChannelName(draft.namingPattern, draft.name || "ticket")}
                                        </span>{" "}
                                        {draft.channelParentId
                                            ? "dans la catégorie choisie"
                                            : "à la racine du serveur"}
                                    </div>
                                    <div>Fermeture : {TICKET_CLOSE_POLICY_LABELS[draft.closePolicy]}</div>
                                    <div>
                                        Questionnaire :{" "}
                                        {draft.formId
                                            ? forms.find((form) => form.id === draft.formId)?.name || "introuvable"
                                            : "aucun (ouverture directe)"}
                                    </div>
                                    <div>
                                        Équipe :{" "}
                                        {draft.teamId
                                            ? teams.find((team) => team.id === draft.teamId)?.name || "introuvable"
                                            : "aucune"}
                                    </div>
                                    <div>{TICKET_NOTIFY_SOURCE_LABELS[notify.source]}</div>
                                    <div>
                                        État :{" "}
                                        {draft.id
                                            ? "publication à mettre à jour après enregistrement"
                                            : "sera créé en brouillon (invisible sur Discord)"}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    {/* Remarques de l'étape : erreurs (bloquantes) et avertissements (informatifs). */}
                    {stepIssues.length > 0 && (
                        <div className="space-y-1.5">
                            {stepIssues.map((issue, index) => (
                                <div
                                    key={`${issue.step}-${index}`}
                                    className={`flex items-start gap-2 rounded-lg border p-2 text-[11px] ${
                                        issue.severity === "error"
                                            ? "border-destructive/40 bg-destructive/10 text-destructive"
                                            : "border-amber-500/30 bg-amber-500/10 text-amber-200"
                                    }`}
                                >
                                    {issue.severity === "error" ? (
                                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                    ) : (
                                        <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                    )}
                                    <span>{issue.message}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <DialogFooter className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={stepIndex === 0}
                                onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
                                className="text-xs"
                            >
                                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Précédent
                            </Button>
                            {stepIndex < TICKET_JOURNEY_WIZARD_STEPS.length - 1 && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={!canAdvance}
                                    onClick={() =>
                                        setStepIndex((index) =>
                                            Math.min(TICKET_JOURNEY_WIZARD_STEPS.length - 1, index + 1)
                                        )
                                    }
                                    className="text-xs"
                                >
                                    Suivant <ChevronRight className="h-3.5 w-3.5 ml-1" />
                                </Button>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setWizardOpen(false)} className="text-xs">
                                Annuler
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={isPending || advancedIssues.length > 0}
                                onClick={() => handleSave({})}
                                className="text-xs"
                            >
                                Enregistrer le brouillon
                            </Button>
                            <Button
                                size="sm"
                                disabled={isPending || advancedIssues.length > 0}
                                onClick={() => handleSave({ publish: true })}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                            >
                                Enregistrer et publier
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}











