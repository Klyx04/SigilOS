"use client";

/**
 * 🎫 Tickets — **onglet « Types de demande »** (unique) : un type = un bouton sur un
 * panneau Discord (« Candidature », « Support »), avec son salon, son message
 * d'ouverture, son équipe, ses règles de fermeture et son questionnaire
 * (20 questions au plus).
 *
 * Enregistrer = publié, sans étape cachée. Les anciennes catégories v1 sont
 * migrées **automatiquement** à l'ouverture de l'onglet (aucun bouton, aucune
 * bannière) : leurs tickets déjà ouverts ne sont jamais touchés.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
    Tags,
    Plus,
    Edit2,
    Trash2,
    Power,
    X,
    ListPlus,
    ArrowUp,
    ArrowDown,
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
    readTicketMotifButtons,
    ticketButtonLayoutForMotif,
    type TicketCategoryClosePolicy,
    type TicketMotifButtonOverrides,
} from "@/lib/tickets/category-permissions";
import {
    TICKET_BUTTON_ADMIN_LABELS,
    TICKET_BUTTON_KEYS,
    readTicketButtonSettings,
    type TicketButtonKey,
} from "@/lib/tickets/button-config";
import {
    buildTicketCreatorContent,
    buildTicketNotifyContentWithTemplate,
} from "@/lib/tickets/notifications";

interface TicketMotifsTabProps {
    guildId: string;
    journeys: any[];
    forms: any[];
    /** Anciennes catégories v1 : migrées automatiquement (silencieuses à l'écran). */
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
    // 🆕 Ouverture (RBAC) + notification personnalisée (16/10/2026).
    const [allowedRoleIds, setAllowedRoleIds] = useState<string[]>([]);
    const [notifyEnabled, setNotifyEnabled] = useState(true);
    const [notifyMessage, setNotifyMessage] = useState("");
    const [creatorMessage, setCreatorMessage] = useState("");
    const [additionalRoleIds, setAdditionalRoleIds] = useState<string[]>([]);
    const [namingPattern, setNamingPattern] = useState("ticket-{num}");
    const [closePolicy, setClosePolicy] = useState<TicketCategoryClosePolicy>("STAFF_OR_CREATOR");
    const [requireConfirm, setRequireConfirm] = useState(true);
    const [welcomeMessage, setWelcomeMessage] = useState("");
    const [isEnabled, setIsEnabled] = useState(true);
    const [questions, setQuestions] = useState<MotifQuestion[]>([]);
    // 🆕 Boutons surchargés pour CE motif (retiré / renommé — héritage du global sinon).
    const [motifButtons, setMotifButtons] = useState<
        Partial<Record<TicketButtonKey, { disabled: boolean; label: string }>>
    >({});

    /**
     * 🧹 Migration auto des anciennes catégories v1 (one-shot R2) : un seul
     * passage par montage, idempotent côté serveur, toast honnête. Plus aucun
     * bouton ni bannière « à convertir » : ça migre, puis ça disparaît.
     */
    const autoMigratedRef = useRef(false);
    useEffect(() => {
        if (autoMigratedRef.current || legacyCategories.length === 0) return;
        autoMigratedRef.current = true;
        startTransition(async () => {
            const res = await migrateCategoriesToMotifsAction(guildId);
            if (!res.success) {
                toast.error(res.error || "Migration automatique impossible");
                return;
            }
            const data = res.data as { migrated?: number; skipped?: number } | undefined;
            if ((data?.migrated ?? 0) > 0) {
                toast.success(
                    `${data?.migrated} ancienne(s) catégorie(s) convertie(s) — pense à redéployer tes panneaux.`
                );
                onRefresh();
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [legacyCategories.length]);

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
        setAllowedRoleIds([]);
        setNotifyEnabled(true);
        setNotifyMessage("");
        setCreatorMessage("");
        setAdditionalRoleIds([]);
        setNamingPattern("ticket-{num}");
        setClosePolicy("STAFF_OR_CREATOR");
        setRequireConfirm(true);
        setWelcomeMessage("");
        setIsEnabled(true);
        setQuestions([]);
        setMotifButtons({});
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
        setAllowedRoleIds(override?.allowedRoleIds ?? []);
        setNotifyEnabled(override?.notifyEnabled !== false);
        setNotifyMessage(override?.notifyMessage ?? "");
        setCreatorMessage(override?.creatorMessage ?? "");
        setWelcomeMessage(override?.welcomeMessage || journey.welcomeMessage || "");
        const motifButtonOverrides = readTicketMotifButtons(override?.buttons);
        const motifButtonState: Partial<Record<TicketButtonKey, { disabled: boolean; label: string }>> = {};
        for (const key of TICKET_BUTTON_KEYS) {
            const entry = motifButtonOverrides[key];
            if (entry) motifButtonState[key] = { disabled: entry.disabled === true, label: entry.label ?? "" };
        }
        setMotifButtons(motifButtonState);
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

    /**
     * 🆕 **Réordonne une question** (16/10/2026) : l'ordre affiché ici est **exactement**
     * celui posé au membre (`buildTicketFormSteps` — les textes forment des pages de 5, les
     * questions à choix se répondent à leur place).
     */
    const moveQuestion = (index: number, direction: -1 | 1) => {
        setQuestions((previous) => {
            const target = index + direction;
            if (target < 0 || target >= previous.length) return previous;
            const next = [...previous];
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
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
                welcomeMessage: welcomeMessage.trim() || undefined,
                emoji: normalizeTicketIcon(emoji.trim() || "🎫"),
                buttonStyle,
                channelParentId: channelParentId.trim() || undefined,
                staffRoleIds,
                notifyRoleIds,
                allowedRoleIds,
                notifyEnabled,
                notifyMessage: notifyMessage.trim() || undefined,
                creatorMessage: creatorMessage.trim() || undefined,
                motifButtons: Object.fromEntries(
                    TICKET_BUTTON_KEYS.flatMap((key) => {
                        const entry = motifButtons[key];
                        const label = entry?.label.trim() ?? "";
                        if (!entry?.disabled && !label) return [];
                        return [[key, { disabled: entry?.disabled === true, ...(label ? { label } : {}) }]];
                    })
                ),
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
            toast.success("Type de demande enregistré et synchronisé avec Discord !");
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
            toast.success(journey.isEnabled ? "Type de demande désactivé." : "Type de demande activé.");
            onRefresh();
        });
    };

    const handleDelete = (journey: any) => {
        const hasTickets = (journey.openTickets ?? journey._count?.tickets ?? 0) > 0;
        const confirmMsg = hasTickets
            ? `Ce type de demande a des tickets associés. Voulez-vous détacher ces tickets (l'historique et les archives seront préservés) et supprimer ce type de demande ?`
            : `Supprimer le type de demande « ${journey.name} » ? Les tickets déjà ouverts ne sont pas touchés.`;
        if (!confirm(confirmMsg)) {
            return;
        }
        startTransition(async () => {
            const res = await deleteTicketJourneyAction(guildId, journey.id, hasTickets);
            if (!res.success) {
                toast.error(res.error || "Erreur suppression");
                return;
            }
            toast.success("Type de demande supprimé.");
            onRefresh();
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <Tags className="h-5 w-5 text-emerald-400" /> Types de Demande & Formulaires
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        Un type de demande = un bouton sur un panneau Discord (« Candidature », « Support »).
                        Enregistrer = visible immédiatement sur Discord, avec son message d'ouverture,
                        son questionnaire et son salon dédié.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button onClick={openCreateModal} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                        <Plus className="h-4 w-4 mr-1" /> Nouveau type de demande
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {journeys.length === 0 ? (
                    <div className="col-span-full text-center py-12 border border-dashed border-border rounded-2xl bg-surface/30">
                        <Tags className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                        <h3 className="text-base font-semibold text-foreground mb-1">Aucun type de demande</h3>
                        <p className="text-xs text-muted-foreground mb-4">
                            Créez votre premier type de demande : il sera associable à vos panneaux Discord.
                        </p>
                        <Button onClick={openCreateModal} size="sm" variant="outline" className="text-xs">
                            <Plus className="h-3.5 w-3.5 mr-1" /> Nouveau type de demande
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

                                    <Badge
                                        variant="outline"
                                        className={`text-[10px] ${
                                            journey.isEnabled
                                                ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                                                : "text-muted-foreground"
                                        }`}
                                    >
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
                                        <span>Salon / Catégorie :</span>
                                        <span className="text-foreground font-semibold font-mono text-[11px]">
                                            {journey.channelParentId ? `#${journey.channelParentId}` : "Par défaut"}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span>Tickets ouverts :</span>
                                        <span className="text-foreground font-semibold">
                                            {journey.openTickets ?? journey._count?.tickets ?? 0}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span>Fermeture :</span>
                                        <span className="text-foreground font-semibold">
                                            {journey.closePolicy === "STAFF_ONLY" ? "Staff uniquement" : "Staff + demandeur"}
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
                        <DialogTitle>{editingId ? "Modifier le type de demande" : "Nouveau type de demande"}</DialogTitle>
                    </DialogHeader>
                    <p className="text-xs text-muted-foreground">
                        Suis les étapes : <strong>1</strong> bouton sur le panneau, <strong>2</strong> message
                        d'ouverture (façon TicketTool), <strong>3</strong> équipe et accès, <strong>4</strong> fermeture
                        et boutons du salon, <strong>5</strong> questionnaire. Enregistrer = visible sur Discord.
                    </p>

                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 py-2 text-xs">
                    <div className="space-y-6 min-w-0">
                        {/* 1 · Bouton sur le panneau */}
                        <div className="space-y-3">
                            <h4 className="font-bold text-foreground">1 · Bouton sur le panneau</h4>
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
                                                ? "border-emerald-500/60 bg-emerald-500/15"
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
                                    <label className="font-semibold text-foreground">Dossier / Catégorie Discord</label>
                                    <p className="text-[11px] text-muted-foreground">
                                        Catégorie où seront créés les salons de ce type.
                                    </p>
                                </div>
                            </div>
                            <TicketCategoryPicker guildId={guildId} value={channelParentId} onChange={setChannelParentId} />

                            <div className="space-y-1.5">
                                <label className="font-semibold text-foreground">Résumé affiché sur les listes</label>
                                <Input
                                    placeholder="ex : Présente ta candidature pour rejoindre la guilde."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="text-xs h-8"
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    Visible uniquement dans le dashboard — <strong>ne part jamais sur Discord</strong>.
                                    Le texte du salon se règle à l'étape 2.
                                </p>
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

                        {/* 2 · Message d'ouverture (façon TicketTool : texte + mentions) */}
                        <div className="space-y-3 pt-4 border-t border-border/50">
                            <div>
                                <h4 className="font-bold text-foreground">2 · Message d'ouverture du salon</h4>
                                <p className="text-[11px] text-muted-foreground">
                                    C'est <strong>tout</strong> ce que le membre et l'équipe reçoivent à l'ouverture :
                                    le texte d'accueil (embed), le ping de l'équipe et le message au demandeur.
                                    Variables : <span className="font-mono">{"{membre}"}</span>{" "}
                                    <span className="font-mono">{"{motif}"}</span>{" "}
                                    <span className="font-mono">{"{numero}"}</span> — aperçu à droite, en direct.
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="font-semibold text-foreground">Texte d'accueil dans le salon</label>
                                    <span className="text-[10px] text-muted-foreground">Markdown Discord supporté</span>
                                </div>
                                <Textarea
                                    placeholder="ex : Bienvenue ! Merci de nous transmettre tes disponibilités et ton avancée de jeu..."
                                    value={welcomeMessage}
                                    onChange={(e) => setWelcomeMessage(e.target.value)}
                                    className="text-xs min-h-[75px]"
                                />
                            </div>

                            <div className="space-y-3 rounded-xl border border-border/70 bg-surface/40 p-3">
                                <label className="flex items-center justify-between gap-2 cursor-pointer">
                                    <span className="font-semibold text-foreground">Prévenir l&apos;équipe à l&apos;ouverture</span>
                                    <input
                                        type="checkbox"
                                        checked={notifyEnabled}
                                        onChange={(event) => setNotifyEnabled(event.target.checked)}
                                        className="rounded border-border"
                                    />
                                </label>

                                {notifyEnabled ? (
                                    <>
                                        <div className="space-y-1.5">
                                            <label className="font-semibold text-foreground">Rôles à mentionner</label>
                                            <TicketRolesPicker
                                                guildId={guildId}
                                                value={notifyRoleIds}
                                                onChange={setNotifyRoleIds}
                                                title="Rôles mentionnés"
                                                triggerPlaceholder="Sélectionner les rôles à prévenir..."
                                                emptyTitle="Aucun rôle à prévenir"
                                                description="Ces rôles sont mentionnés à chaque ouverture — jamais @everyone."
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="font-semibold text-foreground">Message envoyé avec le ping</label>
                                            <Input
                                                value={notifyMessage}
                                                onChange={(event) => setNotifyMessage(event.target.value)}
                                                maxLength={900}
                                                placeholder="ex : Nouvelle demande de {membre} ({motif} #{numero}) — à traiter !"
                                                className="text-xs h-8"
                                            />
                                            <p className="text-[11px] text-muted-foreground">
                                                Variables : {"{membre}"} (pseudo), {"{motif}"}, {"{numero}"}. Vide = message par défaut.
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-[11px] text-muted-foreground">
                                        Personne n&apos;est mentionné à l&apos;ouverture (le demandeur, lui, est toujours pingé).
                                    </p>
                                )}

                                <div className="space-y-1.5">
                                    <label className="font-semibold text-foreground">Message envoyé au demandeur</label>
                                    <Input
                                        value={creatorMessage}
                                        onChange={(event) => setCreatorMessage(event.target.value)}
                                        maxLength={900}
                                        placeholder="ex : {membre} merci ! Un membre du staff te répond très vite."
                                        className="text-xs h-8"
                                    />
                                    <p className="text-[11px] text-muted-foreground">
                                        {"{membre}"} = sa mention (elle est ajoutée automatiquement si tu l&apos;oublies).
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 3 · Équipe & accès */}
                        <div className="space-y-3 pt-4 border-t border-border/50">
                            <h4 className="font-bold text-foreground">3 · Équipe et accès</h4>
                            <div className="space-y-1.5">
                                <label className="font-semibold text-foreground">Équipe qui traite ce motif</label>
                                <TicketRolesPicker
                                    guildId={guildId}
                                    value={staffRoleIds}
                                    onChange={setStaffRoleIds}
                                    description="Ces rôles voient le salon et traitent les tickets de ce motif."
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="font-semibold text-foreground">
                                    Qui peut ouvrir ce type de demande ? (liste blanche)
                                </label>
                                <TicketRolesPicker
                                    guildId={guildId}
                                    value={allowedRoleIds}
                                    onChange={setAllowedRoleIds}
                                    title="Rôles autorisés à ouvrir"
                                    triggerPlaceholder="Sélectionner les rôles autorisés à ouvrir..."
                                    emptyTitle="Tout le monde peut ouvrir"
                                    description="Vide = tout le monde (hors rôles bloqués). Sinon, seuls ces rôles — un administrateur Discord passe toujours."
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

                        {/* 4 · Fermeture + boutons de CE salon */}
                        <div className="space-y-3 pt-4 border-t border-border/50">
                            <h4 className="font-bold text-foreground">4 · Fermeture et boutons du salon</h4>
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

                            <div className="space-y-2 rounded-xl border border-border/70 bg-surface/40 p-3">
                                <div className="font-semibold text-foreground">
                                    Boutons affichés dans le salon de ce motif
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                    Héritent du réglage global (<strong>Configuration → Boutons du salon</strong> :
                                    nom, icône, droit). Ici tu peux seulement <strong>retirer</strong> un bouton de
                                    ce salon ou le <strong>renommer</strong> pour ce salon.
                                </p>
                                {TICKET_BUTTON_KEYS.map((key) => {
                                    const entry = motifButtons[key] ?? { disabled: false, label: "" };
                                    return (
                                        <div key={key} className="flex items-center gap-2">
                                            <label className="flex items-center gap-1.5 cursor-pointer min-w-32">
                                                <input
                                                    type="checkbox"
                                                    checked={!entry.disabled}
                                                    onChange={() =>
                                                        setMotifButtons((previous) => ({
                                                            ...previous,
                                                            [key]: { disabled: !entry.disabled, label: entry.label },
                                                        }))
                                                    }
                                                    className="rounded border-border"
                                                />
                                                <span className="text-xs text-foreground">{TICKET_BUTTON_ADMIN_LABELS[key]}</span>
                                            </label>
                                            <Input
                                                value={entry.label}
                                                maxLength={80}
                                                disabled={entry.disabled}
                                                placeholder="Nom pour ce salon (vide = nom global)"
                                                onChange={(event) =>
                                                    setMotifButtons((previous) => ({
                                                        ...previous,
                                                        [key]: { disabled: entry.disabled, label: event.target.value },
                                                    }))
                                                }
                                                className="text-xs h-8 flex-1"
                                                aria-label={`Nom du bouton ${TICKET_BUTTON_ADMIN_LABELS[key]} pour ce motif`}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 5 · Questionnaire */}
                        <div className="space-y-3 pt-4 border-t border-border/50">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="font-bold text-foreground">5 · Questionnaire d'ouverture</h4>
                                    <p className="text-[11px] text-muted-foreground">
                                        L&apos;ordre ci-dessous est <strong>exactement</strong> celui posé au membre :
                                        les questions texte sont groupées par 5 (une modale), les questions à choix se
                                        répondent <strong>à leur place</strong>. Vide = ouverture directe.
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
                                                <span className="font-bold text-emerald-400 text-xs">
                                                    Question #{index + 1} — {MOTIF_QUESTION_KIND_LABELS[question.kind]}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => moveQuestion(index, -1)}
                                                        disabled={index === 0}
                                                        title="Monter la question"
                                                        aria-label={`Monter la question ${index + 1}`}
                                                        className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground"
                                                    >
                                                        <ArrowUp className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => moveQuestion(index, 1)}
                                                        disabled={index === questions.length - 1}
                                                        title="Descendre la question"
                                                        aria-label={`Descendre la question ${index + 1}`}
                                                        className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground"
                                                    >
                                                        <ArrowDown className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button type="button" onClick={() => removeQuestion(question.key)} className="text-muted-foreground hover:text-destructive">
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
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

                    {/* Prévisualisation live (message d'ouverture + salon d'accueil) */}
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

                            {(() => {
                                const vars = { membre: "@Toi", motif: name.trim() || "motif", numero: 42 };
                                const creator = buildTicketCreatorContent({
                                    creatorDiscordId: "123456789012345678",
                                    template: creatorMessage,
                                    vars,
                                });
                                const roles = buildTicketNotifyContentWithTemplate({
                                    roleIds: notifyRoleIds,
                                    template: notifyMessage,
                                    enabled: notifyEnabled,
                                    vars: { ...vars, membre: "@Toi" },
                                });
                                const line = [creator, roles].filter(Boolean).join(" ");
                                if (!line) return null;
                                return (
                                    <>
                                        <div className="text-[11px] text-[#949ba4]">Message envoyé en haut du salon :</div>
                                        <div className="text-xs text-white break-words">{line}</div>
                                    </>
                                );
                            })()}

                            <div
                                className="rounded bg-[#1e1f22] p-3 text-xs border-l-4 space-y-2"
                                style={{ borderLeftColor: MOTIF_BUTTON_PREVIEW_COLORS[buttonStyle] }}
                            >
                                <div className="font-bold text-sm text-white">
                                    {normalizeTicketIcon(emoji.trim() || "🎫")} Ticket #0042 — {name.trim() || "Nom du motif"}
                                </div>
                                <div className="text-[#dbdee1] whitespace-pre-wrap">
                                    {welcomeMessage.trim() || "Bienvenue ! Un membre de l'équipe prendra en charge ta demande sous peu."}
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

                             <div className="text-[11px] text-[#949ba4]">Boutons dans le salon de ce motif :</div>
                             {(() => {
                                 const overrides: TicketMotifButtonOverrides = {};
                                 for (const key of TICKET_BUTTON_KEYS) {
                                     const entry = motifButtons[key];
                                     if (entry?.disabled) overrides[key] = { disabled: true };
                                     else if (entry?.label.trim()) overrides[key] = { label: entry.label.trim() };
                                 }
                                 const global = readTicketButtonSettings(permissionSettings);
                                 const render = (status: "OPEN" | "CLOSED") =>
                                     ticketButtonLayoutForMotif(status, overrides, global, "fr").map((button) => (
                                         <span
                                             key={button.key}
                                             className={`px-2 py-1 rounded text-white text-[10px] font-semibold ${
                                                 button.key === "claim" || button.key === "reopen"
                                                     ? "bg-[#57f287]"
                                                     : button.key === "transcript"
                                                       ? "bg-[#4e5058]"
                                                       : "bg-[#ed4245]"
                                             }`}
                                         >
                                             {button.label}
                                         </span>
                                     ));
                                 return (
                                     <div className="space-y-1.5">
                                         <div className="flex flex-wrap gap-1.5">{render("OPEN")}</div>
                                         <div className="text-[10px] text-[#949ba4]">Après fermeture :</div>
                                         <div className="flex flex-wrap gap-1.5">{render("CLOSED")}</div>
                                     </div>
                                 );
                             })()}
                          </div>
                     </div>
                     </div>

                     <DialogFooter>
                         <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                             Annuler
                         </Button>
                         <Button size="sm" onClick={handleSave} disabled={isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                             Enregistrer et publier
                         </Button>
                     </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
