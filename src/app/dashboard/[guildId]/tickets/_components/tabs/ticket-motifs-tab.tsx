"use client";

/**
 * 🎫 Tickets — **onglet « Motifs »** (unique) : un motif = un bouton sur un
 * panneau Discord (« Candidature », « Support »), avec son salon, son équipe,
 * ses règles de fermeture et son questionnaire (20 questions au plus).
 *
 * Remplace « Parcours » (assistant 5 étapes, brouillon/publié) et « Catégories
 * & Modals » (5 questions texte) : enregistrer = publié, sans étape cachée.
 * Les anciens motifs v1 se migrent en un clic (« Tout passer en Motifs »),
 * les tickets déjà ouverts ne sont jamais touchés.
 */

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
    Tags,
    Plus,
    Edit2,
    Trash2,
    Power,
    X,
    ListPlus,
    ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TicketCategoryPicker, TicketRolesPicker } from "../ticket-discord-pickers";
import {
    saveTicketMotifAction,
    deleteTicketJourneyAction,
    setTicketMotifEnabledAction,
    migrateCategoriesToMotifsAction,
} from "@/server/actions/ticket-bot-actions";
import { TICKET_ICON_PRESETS, normalizeTicketIcon } from "@/lib/tickets/ticket-icons";
import { ticketLabel } from "@/lib/tickets/ticket-texts";
import {
    MOTIF_ON_NO_LABELS,
    MOTIF_QUESTION_KINDS,
    MOTIF_QUESTION_KIND_LABELS,
    definitionToMotifQuestions,
    motifQuestionsToDefinition,
    newMotifQuestion,
    type MotifQuestion,
    type MotifQuestionKind,
} from "@/lib/tickets/motif-fields";
import { TICKET_FORM_MAX_FIELDS, TICKET_ON_NO_POLICIES, readTicketForm, type TicketOnNoPolicy } from "@/lib/tickets/form-schema";
import {
    TICKET_JOURNEY_NAME_MAX,
    ensureUniqueTicketJourneySlug,
    previewTicketChannelName,
    slugifyTicketJourneySlug,
} from "@/lib/tickets/journey-wizard";
import {
    readTicketPermissionSettings,
    type TicketCategoryClosePolicy,
} from "@/lib/tickets/category-permissions";

interface TicketMotifsTabProps {
    guildId: string;
    journeys: any[];
    forms: any[];
    /** Anciennes catégories v1 non migrées (bannière + bouton de migration). */
    legacyCategories: any[];
    permissionSettings?: unknown;
    onRefresh: () => void;
}

/** Couleurs Discord des 4 styles de bouton (aperçu uniquement). */
const MOTIF_BUTTON_PREVIEW_COLORS: Record<"PRIMARY" | "SECONDARY" | "SUCCESS" | "DANGER", string> = {
    PRIMARY: "#5865f2",
    SECONDARY: "#4e5058",
    SUCCESS: "#57f287",
    DANGER: "#ed4245",
};

export function TicketMotifsTab({
    guildId,
    journeys,
    forms,
    legacyCategories,
    permissionSettings,
    onRefresh,
}: TicketMotifsTabProps) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [slugTouched, setSlugTouched] = useState(false);
    const [description, setDescription] = useState("");
    const [emoji, setEmoji] = useState("🎫");
    const [buttonStyle, setButtonStyle] = useState<"PRIMARY" | "SECONDARY" | "SUCCESS" | "DANGER">("PRIMARY");
    const [channelParentId, setChannelParentId] = useState("");
    const [staffRoleIds, setStaffRoleIds] = useState<string[]>([]);
    const [notifyRoleIds, setNotifyRoleIds] = useState<string[]>([]);
    const [additionalRoleIds, setAdditionalRoleIds] = useState<string[]>([]);
    const [namingPattern, setNamingPattern] = useState("ticket-{num}");
    const [closePolicy, setClosePolicy] = useState<TicketCategoryClosePolicy>("STAFF_OR_CREATOR");
    const [requireConfirm, setRequireConfirm] = useState(true);
    const [isEnabled, setIsEnabled] = useState(true);
    const [questions, setQuestions] = useState<MotifQuestion[]>([]);

    const takenSlugs = useMemo(
        () => journeys.filter((journey) => journey.id !== editingId).map((journey) => String(journey.slug)),
        [journeys, editingId]
    );

    const questionCountLabel = (journey: any): string => {
        if (!journey.formId) return "Ouverture directe";
        const form = forms.find((candidate) => candidate.id === journey.formId);
        if (!form) return "Questionnaire introuvable";
        const count = readTicketForm(form.draftSchemaJson).fields.length;
        return count > 0 ? `${count} question(s)` : "Ouverture directe";
    };

    const resetForm = () => {
        setEditingId(null);
        setName("");
        setSlug("");
        setSlugTouched(false);
        setDescription("");
        setEmoji("🎫");
        setButtonStyle("PRIMARY");
        setChannelParentId("");
        setStaffRoleIds([]);
        setNotifyRoleIds([]);
        setAdditionalRoleIds([]);
        setNamingPattern("ticket-{num}");
        setClosePolicy("STAFF_OR_CREATOR");
        setRequireConfirm(true);
        setIsEnabled(true);
        setQuestions([]);
    };

    const openCreateModal = () => {
        resetForm();
        setModalOpen(true);
    };

    const openEditModal = (journey: any) => {
        setEditingId(journey.id);
        setName(journey.name);
        setSlug(journey.slug);
        setSlugTouched(true);
        setDescription(journey.description || "");
        setEmoji(normalizeTicketIcon(journey.emoji));
        setButtonStyle(journey.buttonStyle || "PRIMARY");
        setChannelParentId(journey.channelParentId || "");
        setStaffRoleIds(journey.staffRoleIds || []);
        setNotifyRoleIds(journey.notifyRoleIds || []);
        setNamingPattern(journey.namingPattern || "ticket-{num}");
        setClosePolicy(journey.closePolicy || "STAFF_OR_CREATOR");
        setIsEnabled(journey.isEnabled !== false);
        const settings = readTicketPermissionSettings(permissionSettings);
        const override = settings.categories[journey.id];
        setRequireConfirm(override?.requireConfirm ?? settings.requireCloseConfirm);
        setAdditionalRoleIds(override?.additionalRoleIds ?? []);
        const form = forms.find((candidate) => candidate.id === journey.formId);
        setQuestions(form ? definitionToMotifQuestions(readTicketForm(form.draftSchemaJson)) : []);
        setModalOpen(true);
    };

    const patchQuestion = (key: string, updates: Partial<MotifQuestion>) => {
        setQuestions((previous) => previous.map((item) => (item.key === key ? { ...item, ...updates } : item)));
    };

    const addQuestion = (kind: MotifQuestionKind) => {
        if (questions.length >= TICKET_FORM_MAX_FIELDS) {
            return toast.error(`Maximum ${TICKET_FORM_MAX_FIELDS} questions (Discord les pose 5 par 5).`);
        }
        setQuestions((previous) => [...previous, newMotifQuestion(kind, previous.length)]);
    };

    const removeQuestion = (key: string) => {
        setQuestions((previous) => previous.filter((item) => item.key !== key));
    };

    const handleSave = () => {
        if (!name.trim()) return toast.error("Nom du motif requis");
        const cleanSlug = slugTouched
            ? slug.trim()
            : ensureUniqueTicketJourneySlug(slugifyTicketJourneySlug(name), takenSlugs);
        if (!cleanSlug) return toast.error("Identifiant invalide");

        const built = motifQuestionsToDefinition(questions);
        if (!built.ok) {
            toast.error(built.errors[0] || "Questionnaire invalide");
            return;
        }

        startTransition(async () => {
            const res = await saveTicketMotifAction(guildId, {
                journeyId: editingId ?? undefined,
                name: name.trim(),
                slug: cleanSlug,
                description: description.trim() || undefined,
                emoji: normalizeTicketIcon(emoji.trim() || "🎫"),
                buttonStyle,
                channelParentId: channelParentId.trim() || undefined,
                staffRoleIds,
                notifyRoleIds,
                namingPattern: namingPattern.trim() || "ticket-{num}",
                closePolicy,
                requireConfirm,
                additionalRoleIds,
                isEnabled,
                order: 0,
                questions: built.form.fields,
            });

            if (!res.success) {
                toast.error(res.error || "Erreur enregistrement");
                return;
            }
            toast.success("Motif enregistré et visible sur Discord !");
            setModalOpen(false);
            onRefresh();
        });
    };

    const handleToggleEnabled = (journey: any) => {
        startTransition(async () => {
            const res = await setTicketMotifEnabledAction(guildId, journey.id, !journey.isEnabled);
            if (!res.success) {
                toast.error(res.error || "Erreur mise à jour");
                return;
            }
            toast.success(journey.isEnabled ? "Motif désactivé." : "Motif activé.");
            onRefresh();
        });
    };

    const handleDelete = (journey: any) => {
        if (!confirm(`Supprimer le motif « ${journey.name} » ? Les tickets déjà ouverts ne sont pas touchés.`)) {
            return;
        }
        startTransition(async () => {
            const res = await deleteTicketJourneyAction(guildId, journey.id);
            if (!res.success) {
                toast.error(res.error || "Erreur suppression");
                return;
            }
            toast.success("Motif supprimé.");
            onRefresh();
        });
    };

    const handleMigrate = () => {
        if (
            !confirm(
                `${legacyCategories.length} ancien(s) motif(s) à convertir. Les tickets déjà ouverts ne sont pas touchés. Continuer ?`
            )
        ) {
            return;
        }
        startTransition(async () => {
            const res = await migrateCategoriesToMotifsAction(guildId);
            if (!res.success) {
                toast.error(res.error || "Erreur migration");
                return;
            }
            const data = res.data as { migrated?: number; skipped?: number } | undefined;
            toast.success(`${data?.migrated ?? 0} motif(s) converti(s)${data?.skipped ? `, ${data.skipped} déjà migré(s)` : ""}.`);
            onRefresh();
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <Tags className="h-5 w-5 text-amber-400" /> Motifs & Formulaires
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        Un motif = un bouton sur un panneau Discord (« Candidature », « Support »).
                        Enregistrer = visible immédiatement, questionnaire compris.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {legacyCategories.length > 0 && (
                        <Button onClick={handleMigrate} disabled={isPending} size="sm" variant="outline" className="text-xs">
                            <ArrowRight className="h-4 w-4 mr-1" /> Tout passer en Motifs ({legacyCategories.length})
                        </Button>
                    )}
                    <Button onClick={openCreateModal} size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs">
                        <Plus className="h-4 w-4 mr-1" /> Nouveau motif
                    </Button>
                </div>
            </div>

            {legacyCategories.length > 0 && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
                    {legacyCategories.length} ancien(s) motif(s) (avant la refonte) ne sont pas encore convertis :
                    leurs boutons continuent de fonctionner, mais seul le bouton « Tout passer en Motifs »
                    leur donne le questionnaire 20 questions et les nouvelles règles de fermeture.
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {journeys.length === 0 ? (
                    <div className="col-span-full text-center py-12 border border-dashed border-border rounded-2xl bg-surface/30">
                        <Tags className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                        <h3 className="text-base font-semibold text-foreground mb-1">Aucun motif</h3>
                        <p className="text-xs text-muted-foreground mb-4">
                            Crée ton premier motif : il apparaîtra sur tes panneaux Discord.
                        </p>
                        <Button onClick={openCreateModal} size="sm" variant="outline" className="text-xs">
                            <Plus className="h-3.5 w-3.5 mr-1" /> Nouveau motif
                        </Button>
                    </div>
                ) : (
                    journeys.map((journey) => (
                        <div
                            key={journey.id}
                            className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4 flex flex-col justify-between"
                        >
                            <div className="space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-2xl">{journey.emoji || "🎫"}</span>
                                        <div>
                                            <h3 className="font-bold text-base text-foreground">{journey.name}</h3>
                                            <div className="text-[11px] text-muted-foreground font-mono">{journey.slug}</div>
                                        </div>
                                    </div>

                                    <Badge variant="outline" className="text-[10px]">
                                        {journey.isEnabled ? "Visible" : "Désactivé"}
                                    </Badge>
                                </div>

                                {journey.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-2">{journey.description}</p>
                                )}

                                <div className="p-3 rounded-xl bg-surface/50 border border-border/50 text-xs space-y-1.5 text-muted-foreground">
                                    <div className="flex items-center justify-between">
                                        <span>Questionnaire :</span>
                                        <span className="text-foreground font-semibold">{questionCountLabel(journey)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span>Tickets ouverts :</span>
                                        <span className="text-foreground font-semibold">{journey._count?.tickets ?? 0}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span>Fermeture :</span>
                                        <span className="text-foreground font-semibold">
                                            {journey.closePolicy === "STAFF_ONLY" ? "Équipe uniquement" : "Équipe + demandeur"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1">
                                    <Button size="sm" variant="ghost" onClick={() => openEditModal(journey)} className="h-8 px-2 text-xs" title="Modifier">
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

                                <span className="text-[11px] text-muted-foreground font-mono">{journey.namingPattern}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Modifier le motif" : "Nouveau motif"}</DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 py-2 text-xs">
                    <div className="space-y-6 min-w-0">
                        {/* Identité */}
                        <div className="space-y-3">
                            <div className="grid grid-cols-4 gap-2">
                                <div className="col-span-1 space-y-1.5">
                                    <label className="font-semibold text-foreground">Icône</label>
                                    <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} className="text-xs h-8 text-center text-lg" />
                                </div>
                                <div className="col-span-3 space-y-1.5">
                                    <label className="font-semibold text-foreground">Nom vu par les membres</label>
                                    <Input
                                        placeholder="ex: Candidature"
                                        value={name}
                                        maxLength={TICKET_JOURNEY_NAME_MAX}
                                        onChange={(e) => {
                                            const next = e.target.value;
                                            setName(next);
                                            if (!slugTouched) {
                                                setSlug(ensureUniqueTicketJourneySlug(slugifyTicketJourneySlug(next), takenSlugs));
                                            }
                                        }}
                                        className="text-xs h-8"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                                {TICKET_ICON_PRESETS.map((preset) => (
                                    <button
                                        key={preset}
                                        type="button"
                                        onClick={() => setEmoji(preset)}
                                        title={`Icône ${preset}`}
                                        className={`h-8 w-8 rounded-lg border text-base transition-colors ${
                                            emoji === preset
                                                ? "border-amber-500/60 bg-amber-500/15"
                                                : "border-border bg-surface/50 hover:bg-surface"
                                        }`}
                                    >
                                        {preset}
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="font-semibold text-foreground">Couleur du bouton</label>
                                    <select
                                        value={buttonStyle}
                                        onChange={(e) => setButtonStyle(e.target.value as any)}
                                        className="w-full h-8 px-2 text-xs rounded-lg border border-border bg-background text-foreground"
                                    >
                                        <option value="PRIMARY">Bleu</option>
                                        <option value="SECONDARY">Gris</option>
                                        <option value="SUCCESS">Vert</option>
                                        <option value="DANGER">Rouge</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="font-semibold text-foreground">Dossier Discord des tickets</label>
                                    <p className="text-[11px] text-muted-foreground">
                                        Là où les salons de ce motif sont créés.
                                    </p>
                                </div>
                            </div>
                            <TicketCategoryPicker guildId={guildId} value={channelParentId} onChange={setChannelParentId} />

                            <div className="space-y-1.5">
                                <label className="font-semibold text-foreground">Message d'accueil du salon</label>
                                <Input
                                    placeholder="ex : Présente ta candidature, on te répond vite."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="text-xs h-8"
                                />
                            </div>

                            <details className="rounded-xl border border-border bg-surface/40 px-3 py-2">
                                <summary className="cursor-pointer text-xs font-semibold text-foreground">
                                    Réglages avancés (nom des salons)
                                </summary>
                                <div className="space-y-1.5 pt-2">
                                    <Input value={namingPattern} onChange={(e) => setNamingPattern(e.target.value)} className="text-xs h-8 font-mono" />
                                    <p className="text-[11px] text-muted-foreground">
                                        {"{num}"} = numéro du ticket, {"{user}"} = pseudo du membre, {"{journey}"} = nom du motif.
                                        {" "}Exemple : <span className="font-mono text-foreground">{previewTicketChannelName(namingPattern, name || "motif")}</span>
                                    </p>
                                </div>
                            </details>
                        </div>

                        {/* Équipe */}
                        <div className="space-y-3 pt-4 border-t border-border/50">
                            <div className="space-y-1.5">
                                <label className="font-semibold text-foreground">Rôles staff de ce motif</label>
                                <TicketRolesPicker
                                    guildId={guildId}
                                    value={staffRoleIds}
                                    onChange={setStaffRoleIds}
                                    description="Ces rôles voient et traitent les tickets de ce motif."
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="font-semibold text-foreground">Rôles mentionnés à l'ouverture</label>
                                <TicketRolesPicker
                                    guildId={guildId}
                                    value={notifyRoleIds}
                                    onChange={setNotifyRoleIds}
                                    description="Notifiés à chaque ouverture. Jamais @everyone."
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="font-semibold text-foreground">Rôles invités (observateurs)</label>
                                <TicketRolesPicker
                                    guildId={guildId}
                                    value={additionalRoleIds}
                                    onChange={setAdditionalRoleIds}
                                    description="Voient le salon sans le traiter (droits réglés dans Configuration)."
                                />
                            </div>
                        </div>

                        {/* Fermeture */}
                        <div className="space-y-3 pt-4 border-t border-border/50">
                            <div className="space-y-1.5">
                                <label className="font-semibold text-foreground">Qui peut fermer ?</label>
                                <select
                                    value={closePolicy}
                                    onChange={(e) => setClosePolicy(e.target.value as TicketCategoryClosePolicy)}
                                    className="w-full h-8 px-2 text-xs rounded-lg border border-border bg-background text-foreground"
                                >
                                    <option value="STAFF_OR_CREATOR">L'équipe et le demandeur (conseillé)</option>
                                    <option value="STAFF_ONLY">L'équipe uniquement</option>
                                </select>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground">
                                <input
                                    type="checkbox"
                                    checked={requireConfirm}
                                    onChange={(e) => setRequireConfirm(e.target.checked)}
                                    className="rounded border-border"
                                />
                                <span>Demander confirmation avant de fermer (« Oui, fermer / Annuler »)</span>
                            </label>
                        </div>

                        {/* Questionnaire */}
                        <div className="space-y-3 pt-4 border-t border-border/50">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="font-bold text-foreground">Questionnaire d'ouverture</h4>
                                    <p className="text-[11px] text-muted-foreground">
                                        Les Oui/Non et les choix se répondent avant la modale, les textes 5 par 5.
                                        Vide = ouverture directe.
                                    </p>
                                </div>
                                <div className="flex items-center gap-1">
                                    {MOTIF_QUESTION_KINDS.map((kind) => (
                                        <Button
                                            key={kind}
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => addQuestion(kind)}
                                            disabled={questions.length >= TICKET_FORM_MAX_FIELDS}
                                            className="h-7 text-[11px] px-2"
                                            title={MOTIF_QUESTION_KIND_LABELS[kind]}
                                        >
                                            <ListPlus className="h-3 w-3 mr-1" /> {MOTIF_QUESTION_KIND_LABELS[kind]}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                            <p className="text-[11px] text-muted-foreground">{questions.length}/{TICKET_FORM_MAX_FIELDS} questions</p>

                            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                                {questions.length === 0 ? (
                                    <div className="p-6 text-center border border-dashed border-border rounded-xl bg-surface/30 text-muted-foreground">
                                        <p className="text-xs">Aucune question : le ticket s'ouvrira directement.</p>
                                    </div>
                                ) : (
                                    questions.map((question, index) => (
                                        <div key={question.key} className="p-3 rounded-xl bg-surface/60 border border-border/80 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-amber-400 text-xs">
                                                    Question #{index + 1} — {MOTIF_QUESTION_KIND_LABELS[question.kind]}
                                                </span>
                                                <button type="button" onClick={() => removeQuestion(question.key)} className="text-muted-foreground hover:text-destructive">
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <Input
                                                    placeholder="Intitulé (ex: Ton pseudo en jeu)"
                                                    value={question.label}
                                                    onChange={(e) => patchQuestion(question.key, { label: e.target.value })}
                                                    className="text-xs h-7"
                                                />
                                                <select
                                                    value={question.kind}
                                                    onChange={(e) => {
                                                        const kind = e.target.value as MotifQuestionKind;
                                                        patchQuestion(question.key, {
                                                            kind,
                                                            maxLength: kind === "text_long" ? 4000 : 256,
                                                            options:
                                                                kind === "select" && question.options.length === 0
                                                                    ? [
                                                                          { value: "choix-1", label: "Choix 1" },
                                                                          { value: "choix-2", label: "Choix 2" },
                                                                      ]
                                                                    : question.options,
                                                        });
                                                    }}
                                                    className="h-7 px-2 text-xs rounded border border-border bg-background"
                                                >
                                                    {MOTIF_QUESTION_KINDS.map((kind) => (
                                                        <option key={kind} value={kind}>
                                                            {MOTIF_QUESTION_KIND_LABELS[kind]}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <Input
                                                placeholder="Aide affichée sous la question (optionnel)"
                                                value={question.help}
                                                onChange={(e) => patchQuestion(question.key, { help: e.target.value })}
                                                className="text-xs h-7"
                                            />

                                            {(question.kind === "text_short" || question.kind === "text_long") && (
                                                <div className="grid grid-cols-3 gap-2">
                                                    <Input
                                                        placeholder="Exemple de réponse"
                                                        value={question.placeholder}
                                                        onChange={(e) => patchQuestion(question.key, { placeholder: e.target.value })}
                                                        className="text-xs h-7"
                                                    />
                                                    <Input
                                                        type="number"
                                                        title="Longueur minimale"
                                                        placeholder="Min"
                                                        value={question.minLength}
                                                        onChange={(e) => patchQuestion(question.key, { minLength: Number(e.target.value) })}
                                                        className="text-xs h-7"
                                                    />
                                                    <Input
                                                        type="number"
                                                        title="Longueur maximale"
                                                        placeholder="Max"
                                                        value={question.maxLength}
                                                        onChange={(e) => patchQuestion(question.key, { maxLength: Number(e.target.value) })}
                                                        className="text-xs h-7"
                                                    />
                                                </div>
                                            )}

                                            {question.kind === "yes_no" && (
                                                <div className="space-y-2">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <Input
                                                            placeholder="Libellé Oui"
                                                            value={question.yesLabel}
                                                            onChange={(e) => patchQuestion(question.key, { yesLabel: e.target.value })}
                                                            className="text-xs h-7"
                                                        />
                                                        <Input
                                                            placeholder="Libellé Non"
                                                            value={question.noLabel}
                                                            onChange={(e) => patchQuestion(question.key, { noLabel: e.target.value })}
                                                            className="text-xs h-7"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <select
                                                            value={question.onNo}
                                                            onChange={(e) => patchQuestion(question.key, { onNo: e.target.value as TicketOnNoPolicy })}
                                                            className="h-7 px-2 text-xs rounded border border-border bg-background"
                                                            title="Si la réponse est Non"
                                                        >
                                                            {TICKET_ON_NO_POLICIES.map((policy) => (
                                                                <option key={policy} value={policy}>
                                                                    Si Non : {MOTIF_ON_NO_LABELS[policy]}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <Input
                                                            placeholder="Message si Non (optionnel)"
                                                            value={question.onNoMessage}
                                                            onChange={(e) => patchQuestion(question.key, { onNoMessage: e.target.value })}
                                                            className="text-xs h-7"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {question.kind === "select" && (
                                                <div className="space-y-1.5">
                                                    {question.options.map((option, optionIndex) => (
                                                        <div key={optionIndex} className="flex items-center gap-2">
                                                            <Input
                                                                placeholder={`Option ${optionIndex + 1}`}
                                                                value={option.label}
                                                                onChange={(e) => {
                                                                    const options = question.options.map((current, currentIndex) =>
                                                                        currentIndex === optionIndex
                                                                            ? { ...current, label: e.target.value }
                                                                            : current
                                                                    );
                                                                    patchQuestion(question.key, { options });
                                                                }}
                                                                className="text-xs h-7"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    patchQuestion(question.key, {
                                                                        options: question.options.filter((_, currentIndex) => currentIndex !== optionIndex),
                                                                    })
                                                                }
                                                                className="text-muted-foreground hover:text-destructive shrink-0"
                                                            >
                                                                <X className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {question.options.length < 25 && (
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() =>
                                                                patchQuestion(question.key, {
                                                                    options: [
                                                                        ...question.options,
                                                                        { value: `choix-${question.options.length + 1}`, label: `Choix ${question.options.length + 1}` },
                                                                    ],
                                                                })
                                                            }
                                                            className="h-7 text-[11px]"
                                                        >
                                                            <Plus className="h-3 w-3 mr-1" /> Ajouter une option
                                                        </Button>
                                                    )}
                                                </div>
                                            )}

                                            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground">
                                                <input
                                                    type="checkbox"
                                                    checked={question.required}
                                                    onChange={(e) => patchQuestion(question.key, { required: e.target.checked })}
                                                    className="rounded border-border"
                                                />
                                                <span>Obligatoire</span>
                                            </label>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Prévisualisation live (bouton du panneau + salon d'accueil) */}
                    <div className="space-y-3 lg:sticky lg:top-0 self-start">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Aperçu Discord en direct
                        </label>

                        <div className="rounded-xl bg-[#2b2d31] p-4 text-[#dbdee1] font-sans border border-[#3f4147] shadow-inner space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-[#5865f2] flex items-center justify-center text-[10px] text-white font-bold">
                                    S
                                </div>
                                <span className="font-bold text-xs text-white">SigilOS Tickets</span>
                                <span className="bg-[#5865f2] text-white text-[9px] font-bold px-1 rounded">BOT</span>
                            </div>

                            <div className="text-[11px] text-[#949ba4]">Bouton sur le panneau :</div>
                            <div className="flex flex-wrap gap-2">
                                <span
                                    className="px-3 py-1.5 rounded text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                                    style={{ backgroundColor: MOTIF_BUTTON_PREVIEW_COLORS[buttonStyle] }}
                                >
                                    <span>{normalizeTicketIcon(emoji.trim() || "🎫")}</span>
                                    <span>{name.trim() || "Nom du motif"}</span>
                                </span>
                            </div>

                            <div
                                className="rounded bg-[#1e1f22] p-3 text-xs border-l-4 space-y-2"
                                style={{ borderLeftColor: MOTIF_BUTTON_PREVIEW_COLORS[buttonStyle] }}
                            >
                                <div className="font-bold text-sm text-white">
                                    {normalizeTicketIcon(emoji.trim() || "🎫")} Ticket #0042 — {name.trim() || "Nom du motif"}
                                </div>
                                <div className="text-[#dbdee1] whitespace-pre-wrap">
                                    {description.trim() || "Bienvenue ! Un membre de l'équipe prendra en charge ta demande."}
                                </div>
                                {questions.length > 0 && (
                                    <div className="space-y-1.5 pt-1">
                                        {questions.slice(0, 3).map((question, index) => (
                                            <div key={question.key} className="rounded bg-[#2b2d31] px-2 py-1.5">
                                                <div className="text-[10px] font-semibold text-[#949ba4]">
                                                    📋 {question.label.trim() || `Question ${index + 1}`}
                                                </div>
                                                <div className="text-[#dbdee1]">
                                                    {question.kind === "yes_no"
                                                        ? `${question.yesLabel.trim() || "Oui"} / ${question.noLabel.trim() || "Non"}`
                                                        : question.kind === "select"
                                                          ? question.options.slice(0, 3).map((option) => option.label.trim() || "Option").join(" · ") || "Choix…"
                                                          : "Réponse libre…"}
                                                </div>
                                            </div>
                                        ))}
                                        {questions.length > 3 && (
                                            <div className="text-[10px] text-[#949ba4]">+ {questions.length - 3} autre(s) question(s)…</div>
                                        )}
                                    </div>
                                )}
                                <div className="text-[10px] text-[#949ba4] pt-1 border-t border-[#3f4147]">
                                    SigilOS Ticket System
                                </div>
                            </div>

                            <div className="text-[11px] text-[#949ba4]">Boutons dans le salon (staff) :</div>
                            <div className="flex flex-wrap gap-1.5">
                                {[ticketLabel("claim"), ticketLabel("add"), ticketLabel("note"), ticketLabel("rename")].map((label) => (
                                    <span key={label} className="px-2 py-1 rounded bg-[#4e5058] text-white text-[10px] font-semibold">
                                        {label}
                                    </span>
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {[ticketLabel("close"), ticketLabel("transcript"), ticketLabel("delete")].map((label, index) => (
                                    <span
                                        key={label}
                                        className={`px-2 py-1 rounded text-white text-[10px] font-semibold ${index === 1 ? "bg-[#4e5058]" : "bg-[#ed4245]"}`}
                                    >
                                        {label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                            Annuler
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={isPending} className="bg-amber-600 hover:bg-amber-700 text-white">
                            Enregistrer et publier
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
