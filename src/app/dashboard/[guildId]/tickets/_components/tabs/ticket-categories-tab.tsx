"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
    Plus,
    Edit2,
    Trash2,
    Tags,
    FileText,
    Clock,
    Shield,
    Hash,
    HelpCircle,
    Check,
    ListPlus,
    X,
} from "lucide-react";
import {
    saveTicketCategoryAction,
    deleteTicketCategoryAction,
} from "@/server/actions/ticket-bot-actions";
import { TicketCategoryPicker, TicketRolesPicker } from "../ticket-discord-pickers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface FormFieldItem {
    label: string;
    placeholder?: string;
    type: "SHORT" | "PARAGRAPH";
    required: boolean;
}

interface TicketCategoriesTabProps {
    guildId: string;
    categories: any[];
    onRefresh: () => void;
}

export function TicketCategoriesTab({ guildId, categories, onRefresh }: TicketCategoriesTabProps) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<any | null>(null);
    const [isPending, startTransition] = useTransition();

    // Category form state
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [description, setDescription] = useState("");
    const [emoji, setEmoji] = useState("🎫");
    const [buttonStyle, setButtonStyle] = useState<"PRIMARY" | "SECONDARY" | "SUCCESS" | "DANGER">("PRIMARY");
    const [channelParentId, setChannelParentId] = useState("");
    const [staffRoleIds, setStaffRoleIds] = useState<string[]>([]);
    const [namingPattern, setNamingPattern] = useState("ticket-{num}");
    const [slaFirstResponseMin, setSlaFirstResponseMin] = useState<number | "">("");
    const [slaResolutionMin, setSlaResolutionMin] = useState<number | "">("");
    const [autoCloseHours, setAutoCloseHours] = useState<number | "">("");
    const [formFields, setFormFields] = useState<FormFieldItem[]>([]);

    const openCreateModal = () => {
        setEditingCategory(null);
        setName("");
        setSlug("");
        setDescription("");
        setEmoji("🎫");
        setButtonStyle("PRIMARY");
        setChannelParentId("");
        setStaffRoleIds([]);
        setNamingPattern("ticket-{num}");
        setSlaFirstResponseMin("");
        setSlaResolutionMin("");
        setAutoCloseHours("");
        setFormFields([]);
        setModalOpen(true);
    };

    const openEditModal = (cat: any) => {
        setEditingCategory(cat);
        setName(cat.name);
        setSlug(cat.slug);
        setDescription(cat.description || "");
        setEmoji(cat.emoji || "🎫");
        setButtonStyle(cat.buttonStyle || "PRIMARY");
        setChannelParentId(cat.channelParentId || "");
        setStaffRoleIds(cat.staffRoleIds || []);
        setNamingPattern(cat.namingPattern || "ticket-{num}");
        setSlaFirstResponseMin(cat.slaFirstResponseMin ?? "");
        setSlaResolutionMin(cat.slaResolutionMin ?? "");
        setAutoCloseHours(cat.autoCloseHours ?? "");
        setFormFields(Array.isArray(cat.formSchemaJson) ? cat.formSchemaJson : []);
        setModalOpen(true);
    };

    const addFormField = () => {
        if (formFields.length >= 5) {
            return toast.error("Discord limite les modals à 5 champs maximum.");
        }
        setFormFields((prev) => [
            ...prev,
            { label: `Question ${prev.length + 1}`, placeholder: "", type: "SHORT", required: true },
        ]);
    };

    const removeFormField = (idx: number) => {
        setFormFields((prev) => prev.filter((_, i) => i !== idx));
    };

    const updateFormField = (idx: number, updates: Partial<FormFieldItem>) => {
        setFormFields((prev) =>
            prev.map((field, i) => (i === idx ? { ...field, ...updates } : field))
        );
    };

    const handleSave = () => {
        if (!name.trim()) return toast.error("Nom de la catégorie requis");
        const cleanSlug = slug.trim() || name.toLowerCase().replace(/[^a-z0-9]/g, "-");

        startTransition(async () => {
            const res = await saveTicketCategoryAction(guildId, {
                id: editingCategory?.id,
                name: name.trim(),
                slug: cleanSlug,
                description: description.trim() || undefined,
                emoji: emoji.trim() || "🎫",
                buttonStyle,
                channelType: "CHANNEL_TEXT",
                channelParentId: channelParentId.trim() || undefined,
                staffRoleIds,
                namingPattern: namingPattern.trim() || "ticket-{num}",
                formSchemaJson: formFields,
                slaFirstResponseMin: slaFirstResponseMin === "" ? undefined : Number(slaFirstResponseMin),
                slaResolutionMin: slaResolutionMin === "" ? undefined : Number(slaResolutionMin),
                autoCloseHours: autoCloseHours === "" ? undefined : Number(autoCloseHours),
                order: editingCategory?.order ?? 0,
                isEnabled: true,
            });

            if (res.success) {
                toast.success("Catégorie enregistrée !");
                setModalOpen(false);
                onRefresh();
            } else {
                toast.error(res.error || "Erreur enregistrement");
            }
        });
    };

    const handleDelete = (catId: string) => {
        if (!confirm("Voulez-vous supprimer cette catégorie ?")) return;
        startTransition(async () => {
            const res = await deleteTicketCategoryAction(guildId, catId);
            if (res.success) {
                toast.success("Catégorie supprimée !");
                onRefresh();
            } else {
                toast.error(res.error || "Erreur suppression");
            }
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <Tags className="h-5 w-5 text-amber-400" /> Catégories & Formulaires d'Ouverture
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        Configurez les types de tickets, les rôles staff assignés et les questions préalables (Modals).
                    </p>
                </div>

                <Button onClick={openCreateModal} size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs">
                    <Plus className="h-4 w-4 mr-1" /> Créer une Catégorie
                </Button>
            </div>

            {/* Categories List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {categories.length === 0 ? (
                    <div className="col-span-full text-center py-12 border border-dashed border-border rounded-2xl bg-surface/30">
                        <Tags className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                        <h3 className="text-base font-semibold text-foreground mb-1">Aucune catégorie</h3>
                        <p className="text-xs text-muted-foreground mb-4">
                            Créez vos motifs de tickets (Support, Recrutement, Échange...).
                        </p>
                        <Button onClick={openCreateModal} size="sm" variant="outline" className="text-xs">
                            <Plus className="h-3.5 w-3.5 mr-1" /> Créer une Catégorie
                        </Button>
                    </div>
                ) : (
                    categories.map((cat) => {
                        const fieldsCount = Array.isArray(cat.formSchemaJson) ? cat.formSchemaJson.length : 0;
                        return (
                            <div
                                key={cat.id}
                                className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4 flex flex-col justify-between"
                            >
                                <div className="space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-2xl">{cat.emoji || "🎫"}</span>
                                            <div>
                                                <h3 className="font-bold text-base text-foreground">{cat.name}</h3>
                                                <div className="text-[11px] text-muted-foreground font-mono">
                                                    slug: {cat.slug}
                                                </div>
                                            </div>
                                        </div>

                                        <Badge variant="outline" className="text-[10px]">
                                            {cat.buttonStyle}
                                        </Badge>
                                    </div>

                                    {cat.description && (
                                        <p className="text-xs text-muted-foreground line-clamp-2">{cat.description}</p>
                                    )}

                                    <div className="p-3 rounded-xl bg-surface/50 border border-border/50 text-xs space-y-1.5 text-muted-foreground">
                                        <div className="flex items-center justify-between">
                                            <span>Format nom salon :</span>
                                            <code className="text-foreground font-semibold">{cat.namingPattern}</code>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span>Formulaire d'intake :</span>
                                            <span className="text-foreground font-semibold">
                                                {fieldsCount > 0 ? `${fieldsCount} question(s)` : "Désactivé (Direct)"}
                                            </span>
                                        </div>
                                        {cat.slaFirstResponseMin && (
                                            <div className="flex items-center justify-between">
                                                <span>Cible 1ère réponse :</span>
                                                <span className="text-amber-400 font-semibold">{cat.slaFirstResponseMin} min</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-border flex items-center justify-end gap-1">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => openEditModal(cat)}
                                        className="h-8 px-2 text-xs"
                                    >
                                        <Edit2 className="h-3.5 w-3.5 mr-1" /> Modifier
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDelete(cat.id)}
                                        className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                                    >
                                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Supprimer
                                    </Button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Create / Edit Category Dialog */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingCategory ? "Modifier la Catégorie" : "Nouvelle Catégorie de Ticket"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
                        {/* Left: General settings */}
                        <div className="space-y-4 text-xs">
                            <div className="grid grid-cols-4 gap-2">
                                <div className="col-span-1 space-y-1.5">
                                    <label className="font-semibold text-foreground">Emoji</label>
                                    <Input
                                        value={emoji}
                                        onChange={(e) => setEmoji(e.target.value)}
                                        className="text-xs h-8 text-center text-lg"
                                    />
                                </div>
                                <div className="col-span-3 space-y-1.5">
                                    <label className="font-semibold text-foreground">Nom du motif</label>
                                    <Input
                                        placeholder="ex: Problème Technique"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="text-xs h-8"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="font-semibold text-foreground">Identifiant unique (slug)</label>
                                <Input
                                    placeholder="ex: tech-support"
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value)}
                                    className="text-xs h-8 font-mono"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="font-semibold text-foreground">Description courte</label>
                                <Input
                                    placeholder="ex: Bugs, questions sur le build ou l'accès"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="text-xs h-8"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="font-semibold text-foreground">Style du bouton</label>
                                    <select
                                        value={buttonStyle}
                                        onChange={(e) => setButtonStyle(e.target.value as any)}
                                        className="w-full h-8 px-2 text-xs rounded-lg border border-border bg-background text-foreground"
                                    >
                                        <option value="PRIMARY">Bleu (Primary)</option>
                                        <option value="SECONDARY">Gris (Secondary)</option>
                                        <option value="SUCCESS">Vert (Success)</option>
                                        <option value="DANGER">Rouge (Danger)</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="font-semibold text-foreground">Format nom salon</label>
                                    <Input
                                        value={namingPattern}
                                        onChange={(e) => setNamingPattern(e.target.value)}
                                        className="text-xs h-8 font-mono"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="font-semibold text-foreground">Catégorie Discord parente</label>
                                <TicketCategoryPicker
                                    guildId={guildId}
                                    value={channelParentId}
                                    onChange={setChannelParentId}
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    Là où les salons de ticket de ce motif seront créés.
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="font-semibold text-foreground">Rôles Staff autorisés</label>
                                <TicketRolesPicker
                                    guildId={guildId}
                                    value={staffRoleIds}
                                    onChange={setStaffRoleIds}
                                    description="Ces rôles voient et traitent les tickets de ce motif."
                                />
                            </div>
                        </div>

                        {/* Right: Dynamic Intake Form Builder */}
                        <div className="space-y-4 text-xs border-l border-border pl-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="font-bold text-foreground flex items-center gap-1.5">
                                        <FileText className="h-4 w-4 text-amber-400" /> Formulaire d'Ouverture (Modal Discord)
                                    </h4>
                                    <p className="text-[11px] text-muted-foreground">
                                        Questions posées au membre avant l'ouverture du salon.
                                    </p>
                                </div>

                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={addFormField}
                                    disabled={formFields.length >= 5}
                                    className="h-7 text-xs px-2"
                                >
                                    <Plus className="h-3 w-3 mr-1" /> Ajouter ({formFields.length}/5)
                                </Button>
                            </div>

                            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                                {formFields.length === 0 ? (
                                    <div className="p-6 text-center border border-dashed border-border rounded-xl bg-surface/30 text-muted-foreground">
                                        <p className="text-xs">Aucune question configurée.</p>
                                        <p className="text-[11px]">Le ticket s'ouvrira immédiatement au clic sur le bouton.</p>
                                    </div>
                                ) : (
                                    formFields.map((field, idx) => (
                                        <div
                                            key={idx}
                                            className="p-3 rounded-xl bg-surface/60 border border-border/80 space-y-2 relative"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-amber-400 text-xs">Question #{idx + 1}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeFormField(idx)}
                                                    className="text-muted-foreground hover:text-destructive"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            </div>

                                            <Input
                                                placeholder="Intitulé de la question (ex: Votre pseudo en jeu)"
                                                value={field.label}
                                                onChange={(e) => updateFormField(idx, { label: e.target.value })}
                                                className="text-xs h-7"
                                            />

                                            <div className="grid grid-cols-2 gap-2">
                                                <select
                                                    value={field.type}
                                                    onChange={(e) => updateFormField(idx, { type: e.target.value as any })}
                                                    className="h-7 px-2 text-xs rounded border border-border bg-background"
                                                >
                                                    <option value="SHORT">Ligne courte (Short)</option>
                                                    <option value="PARAGRAPH">Paragraphe (Long)</option>
                                                </select>

                                                <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                                                    <input
                                                        type="checkbox"
                                                        checked={field.required}
                                                        onChange={(e) => updateFormField(idx, { required: e.target.checked })}
                                                        className="rounded border-border"
                                                    />
                                                    <span>Obligatoire</span>
                                                </label>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                            Annuler
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={isPending} className="bg-amber-600 hover:bg-amber-700 text-white">
                            Enregistrer la catégorie
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
