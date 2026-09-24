"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
    Plus,
    Send,
    Edit2,
    Trash2,
    Layers,
    Sparkles,
    Check,
    AlertCircle,
    Layout,
    Palette,
    Hash,
    ExternalLink,
} from "lucide-react";
import { DiscordChannelPicker } from "@/components/shared/DiscordChannelPicker";
import {
    saveTicketPanelAction,
    deleteTicketPanelAction,
    deployTicketPanelAction,
} from "@/server/actions/ticket-bot-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface TicketPanelsTabProps {
    guildId: string;
    panels: any[];
    categories: any[];
    onRefresh: () => void;
}

export function TicketPanelsTab({ guildId, panels, categories, onRefresh }: TicketPanelsTabProps) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editingPanel, setEditingPanel] = useState<any | null>(null);
    const [isPending, startTransition] = useTransition();

    // Form state
    const [name, setName] = useState("");
    const [channelId, setChannelId] = useState("");
    const [embedTitle, setEmbedTitle] = useState("Centre de Support & Assistance");
    const [embedDescription, setEmbedDescription] = useState(
        "Cliquez sur l'un des boutons ci-dessous pour ouvrir un ticket auprès de notre équipe."
    );
    const [embedColor, setEmbedColor] = useState("#6366f1");
    const [embedThumbnail, setEmbedThumbnail] = useState("");
    const [embedImage, setEmbedImage] = useState("");
    const [embedFooter, setEmbedFooter] = useState("SigilOS Tickets");
    const [style, setStyle] = useState<"BUTTONS" | "SELECT_MENU">("BUTTONS");
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

    const openCreateModal = () => {
        setEditingPanel(null);
        setName("Panneau Principal");
        setChannelId("");
        setEmbedTitle("Centre de Support & Assistance");
        setEmbedDescription("Cliquez sur l'un des boutons ci-dessous pour ouvrir un ticket auprès de notre équipe.");
        setEmbedColor("#6366f1");
        setEmbedThumbnail("");
        setEmbedImage("");
        setEmbedFooter("SigilOS Tickets");
        setStyle("BUTTONS");
        setSelectedCategoryIds(categories.map((c) => c.id));
        setModalOpen(true);
    };

    const openEditModal = (panel: any) => {
        setEditingPanel(panel);
        setName(panel.name);
        setChannelId(panel.channelId);
        setEmbedTitle(panel.embedTitle);
        setEmbedDescription(panel.embedDescription);
        setEmbedColor(panel.embedColor || "#6366f1");
        setEmbedThumbnail(panel.embedThumbnail || "");
        setEmbedImage(panel.embedImage || "");
        setEmbedFooter(panel.embedFooter || "SigilOS Tickets");
        setStyle(panel.style || "BUTTONS");
        setSelectedCategoryIds(panel.categoryIds || []);
        setModalOpen(true);
    };

    const handleSave = () => {
        if (!name.trim()) return toast.error("Nom du panneau requis");
        if (!channelId.trim()) return toast.error("ID de salon Discord requis");
        if (selectedCategoryIds.length === 0) return toast.error("Sélectionnez au moins une catégorie");

        startTransition(async () => {
            const res = await saveTicketPanelAction(guildId, {
                id: editingPanel?.id,
                name: name.trim(),
                channelId: channelId.trim(),
                embedTitle: embedTitle.trim(),
                embedDescription: embedDescription.trim(),
                embedColor,
                embedThumbnail: embedThumbnail.trim() || undefined,
                embedImage: embedImage.trim() || undefined,
                embedFooter: embedFooter.trim() || undefined,
                style,
                categoryIds: selectedCategoryIds,
                isActive: true,
            });

            if (res.success) {
                toast.success("Panneau enregistré !");
                setModalOpen(false);
                onRefresh();
            } else {
                toast.error(res.error || "Erreur enregistrement");
            }
        });
    };

    const handleDelete = (panelId: string) => {
        if (!confirm("Voulez-vous supprimer ce panneau de tickets ?")) return;
        startTransition(async () => {
            const res = await deleteTicketPanelAction(guildId, panelId);
            if (res.success) {
                toast.success("Panneau supprimé !");
                onRefresh();
            } else {
                toast.error(res.error || "Erreur suppression");
            }
        });
    };

    const handleDeploy = (panelId: string) => {
        startTransition(async () => {
            const res = await deployTicketPanelAction(guildId, panelId);
            if (res.success) {
                toast.success("Panneau déployé sur Discord avec succès !");
                onRefresh();
            } else {
                toast.error(res.error || "Échec déploiement Discord");
            }
        });
    };

    const toggleCategory = (catId: string) => {
        setSelectedCategoryIds((prev) =>
            prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <Layers className="h-5 w-5 text-amber-400" /> Panneaux de Tickets Discord
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        Créez des panneaux interactifs (Multi-Panels) et déployez-les dans vos salons Discord.
                    </p>
                </div>

                <Button onClick={openCreateModal} size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs">
                    <Plus className="h-4 w-4 mr-1" /> Créer un Panneau
                </Button>
            </div>

            {/* Panels List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {panels.length === 0 ? (
                    <div className="col-span-full text-center py-12 border border-dashed border-border rounded-2xl bg-surface/30">
                        <Layers className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                        <h3 className="text-base font-semibold text-foreground mb-1">Aucun panneau configuré</h3>
                        <p className="text-xs text-muted-foreground mb-4">
                            Créez votre premier panneau pour permettre aux membres d'ouvrir des tickets sur Discord.
                        </p>
                        <Button onClick={openCreateModal} size="sm" variant="outline" className="text-xs">
                            <Plus className="h-3.5 w-3.5 mr-1" /> Créer un Panneau
                        </Button>
                    </div>
                ) : (
                    panels.map((panel) => (
                        <div
                            key={panel.id}
                            className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4 flex flex-col justify-between"
                        >
                            <div className="space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <h3 className="font-bold text-base text-foreground">{panel.name}</h3>
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                                            <Hash className="h-3 w-3" /> Salon : {panel.channelId}
                                        </div>
                                    </div>

                                    <Badge
                                        className="text-[10px]"
                                        style={{ backgroundColor: `${panel.embedColor}20`, color: panel.embedColor }}
                                    >
                                        {panel.style}
                                    </Badge>
                                </div>

                                <div className="p-3 rounded-xl bg-surface/50 border border-border/50 text-xs space-y-1">
                                    <div className="font-semibold text-foreground truncate">{panel.embedTitle}</div>
                                    <div className="text-muted-foreground line-clamp-2">{panel.embedDescription}</div>
                                </div>

                                <div className="text-xs text-muted-foreground">
                                    <span className="font-semibold text-foreground">
                                        {(panel.categoryIds || []).length}
                                    </span>{" "}
                                    catégorie(s) liée(s)
                                </div>
                            </div>

                            <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => openEditModal(panel)}
                                        className="h-8 px-2 text-xs"
                                    >
                                        <Edit2 className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDelete(panel.id)}
                                        className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>

                                <Button
                                    size="sm"
                                    onClick={() => handleDeploy(panel.id)}
                                    disabled={isPending}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8"
                                >
                                    <Send className="h-3.5 w-3.5 mr-1" /> Déployer sur Discord
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create / Edit Dialog with Live Simulator */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingPanel ? "Modifier le Panneau" : "Nouveau Panneau de Tickets"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
                        {/* Left: Form settings */}
                        <div className="space-y-4 text-xs">
                            <div className="space-y-1.5">
                                <label className="font-semibold text-foreground">Nom interne du panneau</label>
                                <Input
                                    placeholder="ex: Panneau Support Membres"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="text-xs h-8"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="font-semibold text-foreground">Salon Discord où publier le panneau</label>
                                <DiscordChannelPicker
                                    guildId={guildId}
                                    value={channelId}
                                    onChange={setChannelId}
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    Le bot doit pouvoir <strong>voir</strong> ce salon et y <strong>écrire</strong>.
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="font-semibold text-foreground">Titre de l'embed</label>
                                <Input
                                    value={embedTitle}
                                    onChange={(e) => setEmbedTitle(e.target.value)}
                                    className="text-xs h-8"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="font-semibold text-foreground">Description de l'embed</label>
                                <Textarea
                                    value={embedDescription}
                                    onChange={(e) => setEmbedDescription(e.target.value)}
                                    rows={3}
                                    className="text-xs"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="font-semibold text-foreground">Couleur de l'embed (Hex)</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={embedColor}
                                            onChange={(e) => setEmbedColor(e.target.value)}
                                            className="h-8 w-8 rounded border border-border cursor-pointer"
                                        />
                                        <Input
                                            value={embedColor}
                                            onChange={(e) => setEmbedColor(e.target.value)}
                                            className="text-xs h-8 font-mono uppercase"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="font-semibold text-foreground">Format des sélecteurs</label>
                                    <select
                                        value={style}
                                        onChange={(e) => setStyle(e.target.value as any)}
                                        className="w-full h-8 px-2 text-xs rounded-lg border border-border bg-background text-foreground"
                                    >
                                        <option value="BUTTONS">Boutons interactifs</option>
                                        <option value="SELECT_MENU">Menu déroulant (Select)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2 pt-2">
                                <label className="font-semibold text-foreground">
                                    Catégories affichées sur ce panneau :
                                </label>
                                <div className="space-y-1.5 max-h-36 overflow-y-auto border border-border rounded-lg p-2 bg-surface/30">
                                    {categories.map((c) => {
                                        const isChecked = selectedCategoryIds.includes(c.id);
                                        return (
                                            <div
                                                key={c.id}
                                                onClick={() => toggleCategory(c.id)}
                                                className={`flex items-center justify-between p-2 rounded-md cursor-pointer text-xs border ${
                                                    isChecked
                                                        ? "border-amber-500/50 bg-amber-500/10 text-foreground"
                                                        : "border-transparent text-muted-foreground hover:bg-surface/50"
                                                }`}
                                            >
                                                <span>
                                                    {c.emoji} {c.name}
                                                </span>
                                                {isChecked && <Check className="h-3.5 w-3.5 text-amber-400" />}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Right: Live Discord Embed Simulator */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Simulateur Live Discord
                            </label>

                            <div className="rounded-xl bg-[#2b2d31] p-4 text-[#dbdee1] font-sans border border-[#3f4147] shadow-inner space-y-3">
                                {/* Bot name header */}
                                <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-full bg-[#5865f2] flex items-center justify-center text-[10px] text-white font-bold">
                                        S
                                    </div>
                                    <span className="font-bold text-xs text-white">SigilOS Tickets</span>
                                    <span className="bg-[#5865f2] text-white text-[9px] font-bold px-1 rounded">BOT</span>
                                </div>

                                {/* Embed Card */}
                                <div
                                    className="rounded bg-[#1e1f22] p-3 text-xs border-l-4 space-y-2"
                                    style={{ borderLeftColor: embedColor }}
                                >
                                    <div className="font-bold text-sm text-white">{embedTitle || "Titre de l'embed"}</div>
                                    <div className="text-[#dbdee1] whitespace-pre-wrap">
                                        {embedDescription || "Description..."}
                                    </div>
                                    <div className="text-[10px] text-[#949ba4] pt-1 border-t border-[#3f4147]">
                                        {embedFooter}
                                    </div>
                                </div>

                                {/* Components Preview */}
                                {style === "SELECT_MENU" ? (
                                    <div className="rounded bg-[#1e1f22] border border-[#3f4147] p-2 text-xs text-[#949ba4] flex items-center justify-between">
                                        <span>Sélectionnez le motif de votre ticket...</span>
                                        <span>▼</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {selectedCategoryIds.map((cId) => {
                                            const cat = categories.find((c) => c.id === cId);
                                            if (!cat) return null;
                                            return (
                                                <button
                                                    key={cat.id}
                                                    type="button"
                                                    className="px-3 py-1.5 rounded bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                                                >
                                                    <span>{cat.emoji || "🎫"}</span>
                                                    <span>{cat.name}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                            Annuler
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={isPending} className="bg-amber-600 hover:bg-amber-700 text-white">
                            Enregistrer le panneau
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
