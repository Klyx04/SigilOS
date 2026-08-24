"use client";

import { useState, useTransition, useEffect } from "react";
import Image from "next/image";
import {
    Plus,
    Sparkles,
    Send,
    Trash2,
    Edit3,
    AlertTriangle,
    CheckCircle2,
    Layers,
    ListFilter,
    Shield,
    MessageSquare,
    Palette,
    ExternalLink,
    Check,
    ChevronUp,
    ChevronDown,
    Wand2,
    Copy,
    Eye,
    Radio,
    FileCode,
    Sliders,
    Loader2,
    Package,
    ArrowLeft,
    Save,
    X,
    Info,
    RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
    createReactionRoleGroupAction,
    updateReactionRoleGroupAction,
    deleteReactionRoleGroupAction,
    deployReactionRoleGroupAction,
    checkRoleHierarchyAction,
    getAvailableIconPacksForGuildAction
} from "@/server/actions/reaction-role-actions";

export interface DiscordRoleItem {
    id: string;
    name: string;
    color: number;
    position: number;
    managed?: boolean;
}

export interface DiscordChannelItem {
    id: string;
    name: string;
    type: number;
}

interface ReactionRolesManagerProps {
    guildId: string;
    initialGroups: any[];
    discordRoles: DiscordRoleItem[];
    discordChannels: DiscordChannelItem[];
}

const TEMPLATES = [
    {
        name: "🔔 Pings & Notifications",
        description: "Permet aux membres de choisir leurs alertes d'activités.",
        mode: "NORMAL" as const,
        style: "BUTTONS" as const,
        embedTitle: "🔔 Choisissez vos Notifications",
        embedDescription: "Cliquez sur les boutons ci-dessous pour recevoir les alertes des activités de la guilde qui vous intéressent !",
        embedColor: "#3b82f6",
        options: [
            { roleName: "Songes Infinis", emoji: "🌙", label: "Songes Infinis", buttonStyle: "PRIMARY" as const },
            { roleName: "Sorties Donjons", emoji: "⚔️", label: "Sorties Donjons", buttonStyle: "SECONDARY" as const },
            { roleName: "Avis & Archimonstres", emoji: "🎯", label: "Avis & Archimonstres", buttonStyle: "SUCCESS" as const },
            { roleName: "Events Guilde", emoji: "🎉", label: "Events Guilde", buttonStyle: "DANGER" as const },
        ]
    },
    {
        name: "⚔️ Alignement de Cité",
        description: "Choix exclusif de faction (1 seul rôle possible à la fois).",
        mode: "UNIQUE" as const,
        style: "BUTTONS" as const,
        embedTitle: "⚔️ Allégeance de Cité",
        embedDescription: "Quelle cause servez-vous sur le Monde des Douze ? Choisissez votre cité (1 seul choix possible).",
        embedColor: "#f59e0b",
        options: [
            { roleName: "Bontarien", emoji: "🕊️", label: "Bonta (Les Anges)", buttonStyle: "PRIMARY" as const },
            { roleName: "Brâkmarien", emoji: "💀", label: "Brâkmar (Les Démons)", buttonStyle: "DANGER" as const },
            { roleName: "Neutre", emoji: "⚖️", label: "Neutre / Mercenaire", buttonStyle: "SECONDARY" as const },
        ]
    },
    {
        name: "📜 Règlement & Vérification",
        description: "Accès au serveur en acceptant les règles (bouton Verify).",
        mode: "VERIFY" as const,
        style: "BUTTONS" as const,
        embedTitle: "📜 Règlement du Serveur",
        embedDescription: "Bienvenue dans la guilde ! Veuillez lire attentivement les règles ci-dessus. Cliquez sur le bouton pour valider votre accès.",
        embedColor: "#10b981",
        options: [
            { roleName: "Membre", emoji: "✅", label: "J'ai lu et j'accepte le règlement", buttonStyle: "SUCCESS" as const },
        ]
    },
    {
        name: "🔨 Métiers Principaux",
        description: "Menu déroulant pour sélectionner les métiers pratiqués.",
        mode: "NORMAL" as const,
        style: "SELECT_MENU" as const,
        embedTitle: "🔨 Vos Spécialités d'Artisanat",
        embedDescription: "Indiquez les métiers que vous pratiquez pour aider les membres de la guilde dans leurs crafts.",
        embedColor: "#8b5cf6",
        options: [
            { roleName: "Forgemagie", emoji: "✨", label: "Forgemage", description: "Optimisation et runes" },
            { roleName: "Fabrication", emoji: "🛡️", label: "Artisan Fabricant", description: "Tailleur / Cordonnier / Bijoutier" },
            { roleName: "Armes", emoji: "⚔️", label: "Forgeur & Sculpteur", description: "Forges de corps-à-corps" },
            { roleName: "Alchimie / Pain", emoji: "🧪", label: "Consommables", description: "Alchimiste / Paysan / Boulanger" },
        ]
    }
];

export function ReactionRolesManager({
    guildId,
    initialGroups,
    discordRoles,
    discordChannels
}: ReactionRolesManagerProps) {
    const [groups, setGroups] = useState<any[]>(initialGroups);
    const [isEditing, setIsEditing] = useState(false);
    const [editingGroup, setEditingGroup] = useState<any | null>(null);
    const [isPending, startTransition] = useTransition();
    const [deployingId, setDeployingId] = useState<string | null>(null);

    // Studio Form state
    const [formName, setFormName] = useState("");
    const [formChannelId, setFormChannelId] = useState(discordChannels[0]?.id || "");
    const [formLogChannelId, setFormLogChannelId] = useState("");
    const [formMode, setFormMode] = useState<"NORMAL" | "UNIQUE" | "VERIFY" | "REVERSE">("NORMAL");
    const [formStyle, setFormStyle] = useState<"BUTTONS" | "SELECT_MENU" | "REACTIONS">("BUTTONS");
    const [formMaxRoles, setFormMaxRoles] = useState<number | null>(null);
    const [formEmbedTitle, setFormEmbedTitle] = useState("");
    const [formEmbedDescription, setFormEmbedDescription] = useState("");
    const [formEmbedColor, setFormEmbedColor] = useState("#10b981");
    const [formEmbedThumbnail, setFormEmbedThumbnail] = useState("");
    const [formEmbedImage, setFormEmbedImage] = useState("");
    const [formEmbedFooter, setFormEmbedFooter] = useState("");
    const [formOptions, setFormOptions] = useState<any[]>([]);

    // Icon Picker state
    const [availablePacks, setAvailablePacks] = useState<any[]>([]);
    const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
    const [targetOptionIndex, setTargetOptionIndex] = useState<number | null>(null);

    useEffect(() => {
        getAvailableIconPacksForGuildAction(guildId).then(res => {
            if (res.success && res.data) setAvailablePacks(res.data);
        });
    }, [guildId]);

    const openIconPicker = (idx: number) => {
        setTargetOptionIndex(idx);
        setIsIconPickerOpen(true);
    };

    const selectIconFromPack = (icon: { name: string; emoji?: string; url?: string }) => {
        if (targetOptionIndex === null) return;
        const currentOpt = formOptions[targetOptionIndex];
        updateOption(targetOptionIndex, {
            emoji: icon.emoji || icon.name,
            label: currentOpt?.label ? currentOpt.label : icon.name
        });
        setIsIconPickerOpen(false);
        setTargetOptionIndex(null);
    };

    const openCreate = () => {
        setEditingGroup(null);
        setFormName("Nouveau Panneau de Rôles");
        setFormChannelId(discordChannels[0]?.id || "");
        setFormLogChannelId("");
        setFormMode("NORMAL");
        setFormStyle("BUTTONS");
        setFormMaxRoles(null);
        setFormEmbedTitle("🎭 Choisissez vos Rôles");
        setFormEmbedDescription("Cliquez sur les options ci-dessous pour vous attribuer les rôles souhaités.");
        setFormEmbedColor("#10b981");
        setFormEmbedThumbnail("");
        setFormEmbedImage("");
        setFormEmbedFooter("SigilOS · Système de Rôles Automatique");
        setFormOptions([]);
        setIsEditing(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const openEdit = (group: any) => {
        setEditingGroup(group);
        setFormName(group.name);
        setFormChannelId(group.channelId);
        setFormLogChannelId(group.logChannelId || "");
        setFormMode(group.mode);
        setFormStyle(group.style);
        setFormMaxRoles(group.maxRoles || null);
        setFormEmbedTitle(group.embedTitle || "");
        setFormEmbedDescription(group.embedDescription || "");
        setFormEmbedColor(group.embedColor || "#10b981");
        setFormEmbedThumbnail(group.embedThumbnail || "");
        setFormEmbedImage(group.embedImage || "");
        setFormEmbedFooter(group.embedFooter || "");
        setFormOptions(group.options?.map((o: any) => ({ ...o })) || []);
        setIsEditing(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const applyTemplate = (template: typeof TEMPLATES[0]) => {
        setFormName(template.name);
        setFormMode(template.mode);
        setFormStyle(template.style);
        setFormEmbedTitle(template.embedTitle);
        setFormEmbedDescription(template.embedDescription);
        setFormEmbedColor(template.embedColor);

        // Map template options to matching Discord roles if found
        const mapped = template.options.map((tOpt, idx) => {
            const matchedRole = discordRoles.find(r => r.name.toLowerCase().includes(tOpt.roleName.toLowerCase()));
            return {
                roleId: matchedRole?.id || discordRoles[idx % discordRoles.length]?.id || "",
                roleName: matchedRole?.name || tOpt.roleName,
                roleColor: matchedRole ? `#${matchedRole.color.toString(16).padStart(6, "0")}` : "#10b981",
                emoji: tOpt.emoji,
                label: tOpt.label,
                description: (tOpt as any).description || null,
                buttonStyle: (tOpt as any).buttonStyle || "SECONDARY",
                position: idx,
                removeRoleId: null,
                removeRoleName: null,
                requiredRoleId: null,
                requiredRoleName: null,
                blacklistedRoleId: null,
                blacklistedRoleName: null,
            };
        });

        setFormOptions(mapped);
        toast.success(`Modèle « ${template.name} » appliqué !`);
    };

    const addOption = () => {
        const defaultRole = discordRoles[0];
        setFormOptions(prev => [
            ...prev,
            {
                roleId: defaultRole?.id || "",
                roleName: defaultRole?.name || "Nouveau Rôle",
                roleColor: defaultRole ? `#${defaultRole.color.toString(16).padStart(6, "0")}` : "#10b981",
                emoji: "⭐",
                label: defaultRole?.name || "Rôle",
                description: "",
                buttonStyle: "SECONDARY",
                position: prev.length,
                removeRoleId: null,
                removeRoleName: null,
                requiredRoleId: null,
                requiredRoleName: null,
                blacklistedRoleId: null,
                blacklistedRoleName: null,
            }
        ]);
    };

    const updateOption = (index: number, partial: any) => {
        setFormOptions(prev => prev.map((opt, i) => i === index ? { ...opt, ...partial } : opt));
    };

    const removeOption = (index: number) => {
        setFormOptions(prev => prev.filter((_, i) => i !== index));
    };

    const moveOption = (index: number, direction: "up" | "down") => {
        const target = direction === "up" ? index - 1 : index + 1;
        if (target < 0 || target >= formOptions.length) return;
        setFormOptions(prev => {
            const next = [...prev];
            const temp = next[index];
            next[index] = next[target];
            next[target] = temp;
            return next;
        });
    };

    const handleSave = async () => {
        if (!formName.trim()) {
            toast.error("Veuillez saisir un nom pour ce panneau.");
            return;
        }
        if (!formChannelId) {
            toast.error("Veuillez sélectionner un salon Discord cible.");
            return;
        }
        if (formOptions.length === 0) {
            toast.error("Veuillez ajouter au moins un rôle au panneau.");
            return;
        }

        const payload = {
            name: formName,
            channelId: formChannelId,
            logChannelId: formLogChannelId || null,
            mode: formMode,
            style: formStyle,
            maxRoles: formMaxRoles,
            embedTitle: formEmbedTitle || null,
            embedDescription: formEmbedDescription || null,
            embedColor: formEmbedColor || null,
            embedThumbnail: formEmbedThumbnail || null,
            embedImage: formEmbedImage || null,
            embedFooter: formEmbedFooter || null,
            showRoleCount: false,
            options: formOptions.map((o, idx) => ({
                roleId: o.roleId,
                roleName: o.roleName,
                roleColor: o.roleColor,
                emoji: o.emoji || null,
                label: o.label || null,
                description: o.description || null,
                buttonStyle: o.buttonStyle || "SECONDARY",
                position: idx,
                removeRoleId: o.removeRoleId || null,
                removeRoleName: o.removeRoleName || null,
                requiredRoleId: o.requiredRoleId || null,
                requiredRoleName: o.requiredRoleName || null,
                blacklistedRoleId: o.blacklistedRoleId || null,
                blacklistedRoleName: o.blacklistedRoleName || null,
            }))
        };

        startTransition(async () => {
            let res;
            if (editingGroup) {
                res = await updateReactionRoleGroupAction(guildId, editingGroup.id, payload);
            } else {
                res = await createReactionRoleGroupAction(guildId, payload);
            }

            if (res.success && res.data) {
                toast.success(editingGroup ? "Panneau mis à jour !" : "Panneau créé avec succès !");
                setIsEditing(false);
                if (editingGroup) {
                    setGroups(prev => prev.map(g => g.id === editingGroup.id ? res.data : g));
                } else {
                    setGroups(prev => [res.data, ...prev]);
                }
            } else {
                toast.error(res.error || "Erreur lors de l'enregistrement.");
            }
        });
    };

    const handleDeploy = async (groupId: string) => {
        setDeployingId(groupId);
        try {
            const res = await deployReactionRoleGroupAction(guildId, groupId);
            if (res.success) {
                toast.success("Panneau déployé sur Discord avec succès !");
                setGroups(prev => prev.map(g => g.id === groupId ? { ...g, messageId: res.data?.messageId } : g));
            } else {
                toast.error(res.error || "Échec du déploiement Discord.");
            }
        } catch (e: any) {
            toast.error(e?.message || "Erreur réseau");
        } finally {
            setDeployingId(null);
        }
    };

    const handleDelete = async (groupId: string) => {
        if (!confirm("Voulez-vous vraiment supprimer ce panneau de rôles ?")) return;
        startTransition(async () => {
            const res = await deleteReactionRoleGroupAction(guildId, groupId);
            if (res.success) {
                toast.success("Panneau supprimé !");
                setGroups(prev => prev.filter(g => g.id !== groupId));
            } else {
                toast.error(res.error || "Erreur de suppression");
            }
        });
    };

    // =========================================================================
    // VIEW 1: FULL-PAGE STUDIO EDITOR
    // =========================================================================
    if (isEditing) {
        return (
            <div className="space-y-6 animate-in fade-in duration-200">
                {/* Top Studio Bar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface/60 border border-border p-5 rounded-2xl">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsEditing(false)}
                            className="h-9 w-9 text-muted-foreground hover:text-foreground rounded-xl border border-border"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                        <div>
                            <h2 className="text-lg font-black text-foreground flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-warning" />
                                {editingGroup ? `Édition : ${formName}` : "Nouveau Studio Reaction Roles"}
                            </h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Créez un panneau interactif Discord avec boutons, menus déroulants, swap automatique et aperçu direct.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Button variant="ghost" onClick={() => setIsEditing(false)} disabled={isPending}>
                            Annuler
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isPending}
                            className="bg-warning hover:bg-warning/90 text-warning-foreground font-bold gap-2 px-5"
                        >
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {editingGroup ? "Enregistrer" : "Créer le Panneau"}
                        </Button>
                    </div>
                </div>

                {/* Quick Templates Strip */}
                <div className="p-4 bg-surface/40 border border-border rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-foreground flex items-center gap-2">
                            <Wand2 className="w-4 h-4 text-warning" />
                            Modèles Rapides Pré-configurés (1-Clic)
                        </Label>
                        <span className="text-caption text-muted-foreground">Applique une structure complète prête à l'emploi</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {TEMPLATES.map((tmpl, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => applyTemplate(tmpl)}
                                className="flex items-center gap-2 p-3 rounded-xl bg-surface hover:bg-elevated border border-border hover:border-warning/50 text-left transition-all group"
                            >
                                <span className="text-lg">{tmpl.name.split(" ")[0]}</span>
                                <div className="min-w-0">
                                    <p className="font-bold text-xs text-foreground group-hover:text-warning truncate">
                                        {tmpl.name.split(" ").slice(1).join(" ")}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground truncate">{tmpl.options.length} options</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Studio 2-Column Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left Column: Studio Configuration Tabs (7 cols) */}
                    <div className="lg:col-span-7 space-y-4">
                        <Tabs defaultValue="general" className="w-full">
                            <TabsList className="grid grid-cols-3 bg-surface/80 border border-border p-1 rounded-xl h-11">
                                <TabsTrigger value="general" className="text-xs font-bold gap-2 data-[state=active]:bg-elevated">
                                    <Sliders className="w-3.5 h-3.5" />
                                    Général
                                </TabsTrigger>
                                <TabsTrigger value="roles" className="text-xs font-bold gap-2 data-[state=active]:bg-elevated">
                                    <Shield className="w-3.5 h-3.5" />
                                    Rôles & Options ({formOptions.length})
                                </TabsTrigger>
                                <TabsTrigger value="embed" className="text-xs font-bold gap-2 data-[state=active]:bg-elevated">
                                    <Palette className="w-3.5 h-3.5" />
                                    Embed & Design
                                </TabsTrigger>
                            </TabsList>

                            {/* TAB 1: GENERAL */}
                            <TabsContent value="general" className="space-y-4 p-5 bg-surface/40 border border-border rounded-2xl mt-4 focus-visible:outline-none">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold">Nom du Panneau (interne)</Label>
                                    <Input
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        placeholder="Ex: Rôles d'Alertes Pings"
                                        className="h-10 text-xs bg-surface border-border"
                                    />
                                    <p className="text-caption text-muted-foreground">Visible uniquement par les administrateurs pour identifier ce panneau.</p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold">Salon Discord Cible</Label>
                                        <select
                                            value={formChannelId}
                                            onChange={(e) => setFormChannelId(e.target.value)}
                                            className="w-full h-10 px-3 text-xs rounded-xl bg-surface border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-warning"
                                        >
                                            {discordChannels.map(c => (
                                                <option key={c.id} value={c.id}>#{c.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold">Salon de Logs (optionnel)</Label>
                                        <select
                                            value={formLogChannelId}
                                            onChange={(e) => setFormLogChannelId(e.target.value)}
                                            className="w-full h-10 px-3 text-xs rounded-xl bg-surface border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-warning"
                                        >
                                            <option value="">Aucun log</option>
                                            {discordChannels.map(c => (
                                                <option key={c.id} value={c.id}>#{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold">Mode de Fonctionnement</Label>
                                        <select
                                            value={formMode}
                                            onChange={(e) => setFormMode(e.target.value as any)}
                                            className="w-full h-10 px-3 text-xs rounded-xl bg-surface border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-warning"
                                        >
                                            <option value="NORMAL">NORMAL (Toggle ajout / retrait)</option>
                                            <option value="UNIQUE">UNIQUE (1 seul rôle à la fois - Exclusif)</option>
                                            <option value="VERIFY">VERIFY (Ajoute uniquement - Règlement)</option>
                                            <option value="REVERSE">REVERSE (Retire uniquement)</option>
                                        </select>
                                        <p className="text-caption text-muted-foreground">
                                            {formMode === "NORMAL" && "Le membre clique pour recevoir le rôle, reclique pour le retirer."}
                                            {formMode === "UNIQUE" && "Choisir un rôle retire automatiquement les autres rôles du groupe sur le même clic."}
                                            {formMode === "VERIFY" && "Idéal pour le règlement : attribue l'accès sans possibilité de le retirer."}
                                            {formMode === "REVERSE" && "Utile pour des rôles temporaires ou exclusions volontaires."}
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold">Affichage Discord</Label>
                                        <select
                                            value={formStyle}
                                            onChange={(e) => setFormStyle(e.target.value as any)}
                                            className="w-full h-10 px-3 text-xs rounded-xl bg-surface border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-warning"
                                        >
                                            <option value="BUTTONS">Boutons cliquables</option>
                                            <option value="SELECT_MENU">Menu déroulant (Select Menu)</option>
                                        </select>
                                        <p className="text-caption text-muted-foreground">
                                            Boutons directs en 1 clic ou menu déroulant multi-choix avec descriptions.
                                        </p>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* TAB 2: ROLES & OPTIONS */}
                            <TabsContent value="roles" className="space-y-4 p-5 bg-surface/40 border border-border rounded-2xl mt-4 focus-visible:outline-none">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label className="text-xs font-bold text-foreground">Options & Rôles ({formOptions.length}/25)</Label>
                                        <p className="text-caption text-muted-foreground">Configurez chaque bouton avec son rôle cible, son swap éventuel et ses conditions.</p>
                                    </div>
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={addOption}
                                        disabled={formOptions.length >= 25}
                                        className="h-8 text-xs px-3 gap-1.5 bg-warning hover:bg-warning/90 text-warning-foreground font-bold"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Ajouter un Rôle
                                    </Button>
                                </div>

                                {formOptions.length === 0 ? (
                                    <div className="p-12 text-center border border-dashed border-border rounded-2xl bg-surface/20 text-muted-foreground text-xs space-y-2">
                                        <Shield className="w-8 h-8 mx-auto text-muted-foreground/40" />
                                        <p className="font-semibold text-foreground">Aucun rôle ajouté à ce panneau</p>
                                        <p className="text-caption">Cliquez sur « Ajouter un Rôle » ou appliquez un modèle ci-dessus.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {formOptions.map((opt, idx) => (
                                            <div
                                                key={idx}
                                                className="p-4 bg-surface/60 border border-border rounded-2xl space-y-3 hover:border-border transition-all"
                                            >
                                                {/* Header Row: Role selector + reordering buttons */}
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                                        <span className="text-caption font-bold text-muted-foreground px-2 py-1 bg-black/40 rounded-lg">
                                                            #{idx + 1}
                                                        </span>
                                                        <select
                                                            value={opt.roleId}
                                                            onChange={(e) => {
                                                                const pickedRole = discordRoles.find(r => r.id === e.target.value);
                                                                updateOption(idx, {
                                                                    roleId: e.target.value,
                                                                    roleName: pickedRole?.name || "Rôle",
                                                                    label: opt.label || pickedRole?.name,
                                                                    roleColor: pickedRole ? `#${pickedRole.color.toString(16).padStart(6, "0")}` : "#10b981",
                                                                });
                                                            }}
                                                            className="flex-1 h-9 px-3 text-xs font-semibold rounded-xl bg-surface border border-border text-foreground"
                                                        >
                                                            {discordRoles.map(r => (
                                                                <option key={r.id} value={r.id}>{r.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => moveOption(idx, "up")}
                                                            disabled={idx === 0}
                                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                        >
                                                            <ChevronUp className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => moveOption(idx, "down")}
                                                            disabled={idx === formOptions.length - 1}
                                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                        >
                                                            <ChevronDown className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removeOption(idx)}
                                                            className="h-8 w-8 text-muted-foreground hover:text-danger"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>

                                                {/* Option details row */}
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                    <div>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <Label className="text-caption font-bold text-muted-foreground">Emoji / Icône</Label>
                                                            <button
                                                                type="button"
                                                                onClick={() => openIconPicker(idx)}
                                                                className="text-[11px] font-bold text-warning hover:underline flex items-center gap-1"
                                                            >
                                                                <Package className="w-3 h-3" />
                                                                Packs GOD
                                                            </button>
                                                        </div>
                                                        <Input
                                                            value={opt.emoji || ""}
                                                            onChange={(e) => updateOption(idx, { emoji: e.target.value })}
                                                            placeholder="⭐ ou <:name:id>"
                                                            className="h-8 text-xs bg-surface border-border"
                                                        />
                                                    </div>

                                                    <div>
                                                        <Label className="text-caption font-bold text-muted-foreground mb-1 block">Texte du Bouton</Label>
                                                        <Input
                                                            value={opt.label || ""}
                                                            onChange={(e) => updateOption(idx, { label: e.target.value })}
                                                            placeholder="Texte personnalisé"
                                                            className="h-8 text-xs bg-surface border-border"
                                                        />
                                                    </div>

                                                    {formStyle === "BUTTONS" ? (
                                                        <div>
                                                            <Label className="text-caption font-bold text-muted-foreground mb-1 block">Style Bouton</Label>
                                                            <select
                                                                value={opt.buttonStyle || "SECONDARY"}
                                                                onChange={(e) => updateOption(idx, { buttonStyle: e.target.value })}
                                                                className="w-full h-8 px-2 text-xs rounded-xl bg-surface border border-border text-foreground"
                                                            >
                                                                <option value="PRIMARY">Blurple (Bleu)</option>
                                                                <option value="SECONDARY">Gris (Défaut)</option>
                                                                <option value="SUCCESS">Vert (Succès)</option>
                                                                <option value="DANGER">Rouge (Alerte)</option>
                                                            </select>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <Label className="text-caption font-bold text-muted-foreground mb-1 block">Description sous-menu</Label>
                                                            <Input
                                                                value={opt.description || ""}
                                                                onChange={(e) => updateOption(idx, { description: e.target.value })}
                                                                placeholder="Description courte"
                                                                className="h-8 text-xs bg-surface border-border"
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Advanced Power Options: Swap / Prerequisite / Blacklist */}
                                                <div className="pt-3 border-t border-border/50 grid grid-cols-1 sm:grid-cols-3 gap-3 text-caption">
                                                    <div>
                                                        <Label className="text-[11px] font-bold text-warning flex items-center gap-1 mb-1">
                                                            <span>🔄 Rôle à retirer (Swap)</span>
                                                        </Label>
                                                        <select
                                                            value={opt.removeRoleId || ""}
                                                            onChange={(e) => {
                                                                const picked = discordRoles.find(r => r.id === e.target.value);
                                                                updateOption(idx, {
                                                                    removeRoleId: e.target.value || null,
                                                                    removeRoleName: picked?.name || null,
                                                                });
                                                            }}
                                                            className="w-full h-8 px-2 text-xs rounded-xl bg-surface border border-border text-foreground"
                                                        >
                                                            <option value="">Aucun (Pas de retrait)</option>
                                                            {discordRoles.map(r => (
                                                                <option key={r.id} value={r.id}>- {r.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <Label className="text-[11px] font-bold text-info flex items-center gap-1 mb-1">
                                                            <span>🔒 Rôle prérequis</span>
                                                        </Label>
                                                        <select
                                                            value={opt.requiredRoleId || ""}
                                                            onChange={(e) => {
                                                                const picked = discordRoles.find(r => r.id === e.target.value);
                                                                updateOption(idx, {
                                                                    requiredRoleId: e.target.value || null,
                                                                    requiredRoleName: picked?.name || null,
                                                                });
                                                            }}
                                                            className="w-full h-8 px-2 text-xs rounded-xl bg-surface border border-border text-foreground"
                                                        >
                                                            <option value="">Aucun (Libre d'accès)</option>
                                                            {discordRoles.map(r => (
                                                                <option key={r.id} value={r.id}>Requis : {r.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <Label className="text-[11px] font-bold text-danger flex items-center gap-1 mb-1">
                                                            <span>🚫 Rôle interdit</span>
                                                        </Label>
                                                        <select
                                                            value={opt.blacklistedRoleId || ""}
                                                            onChange={(e) => {
                                                                const picked = discordRoles.find(r => r.id === e.target.value);
                                                                updateOption(idx, {
                                                                    blacklistedRoleId: e.target.value || null,
                                                                    blacklistedRoleName: picked?.name || null,
                                                                });
                                                            }}
                                                            className="w-full h-8 px-2 text-xs rounded-xl bg-surface border border-border text-foreground"
                                                        >
                                                            <option value="">Aucun (Pas de blacklist)</option>
                                                            {discordRoles.map(r => (
                                                                <option key={r.id} value={r.id}>Interdit si : {r.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>

                            {/* TAB 3: EMBED & DESIGN */}
                            <TabsContent value="embed" className="space-y-4 p-5 bg-surface/40 border border-border rounded-2xl mt-4 focus-visible:outline-none">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="sm:col-span-2 space-y-2">
                                        <Label className="text-xs font-bold">Titre de l'Embed Discord</Label>
                                        <Input
                                            value={formEmbedTitle}
                                            onChange={(e) => setFormEmbedTitle(e.target.value)}
                                            placeholder="Ex: 🔔 Choisissez vos Notifications"
                                            className="h-10 text-xs bg-surface border-border"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold">Couleur de Bordure</Label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="color"
                                                value={formEmbedColor}
                                                onChange={(e) => setFormEmbedColor(e.target.value)}
                                                className="w-10 h-10 p-1 rounded-xl bg-surface border border-border cursor-pointer"
                                            />
                                            <Input
                                                value={formEmbedColor}
                                                onChange={(e) => setFormEmbedColor(e.target.value)}
                                                className="h-10 text-xs bg-surface border-border font-mono"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-bold">Description / Message (Markdown supporté)</Label>
                                    <Textarea
                                        value={formEmbedDescription}
                                        onChange={(e) => setFormEmbedDescription(e.target.value)}
                                        placeholder="Cliquez sur les boutons ci-dessous pour recevoir les alertes..."
                                        className="h-28 text-xs bg-surface border-border resize-none"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold">Image Miniature / Thumbnail (URL)</Label>
                                        <Input
                                            value={formEmbedThumbnail}
                                            onChange={(e) => setFormEmbedThumbnail(e.target.value)}
                                            placeholder="https://.../logo.png"
                                            className="h-9 text-xs bg-surface border-border"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold">Grande Bannière / Image (URL)</Label>
                                        <Input
                                            value={formEmbedImage}
                                            onChange={(e) => setFormEmbedImage(e.target.value)}
                                            placeholder="https://.../banner.png"
                                            className="h-9 text-xs bg-surface border-border"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-bold">Texte de Pied de Page (Footer)</Label>
                                    <Input
                                        value={formEmbedFooter}
                                        onChange={(e) => setFormEmbedFooter(e.target.value)}
                                        placeholder="SigilOS · Système de Rôles Automatique"
                                        className="h-9 text-xs bg-surface border-border"
                                    />
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* Right Column: Sticky Live Discord Simulator (5 cols) */}
                    <div className="lg:col-span-5 sticky top-6 space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <Eye className="w-3.5 h-3.5 text-info" />
                                Rendu Discord en Direct
                            </h3>
                            <span className="text-[10px] text-muted-foreground bg-surface px-2 py-0.5 rounded-md border border-border">
                                Simulation fidèle
                            </span>
                        </div>

                        {/* Discord Client Mockup */}
                        <div className="bg-[#313338] text-[#dbdee1] p-4 rounded-2xl border border-border/80 shadow-2xl font-sans text-xs space-y-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-full bg-[#5865f2] flex items-center justify-center font-bold text-white text-xs shrink-0">
                                    BOT
                                </div>
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-white text-sm">SigilOS</span>
                                        <span className="bg-[#5865f2] text-white text-[10px] px-1 py-0.2 rounded font-semibold">BOT</span>
                                        <span className="text-[10px] text-[#949ba4]">Aujourd'hui à 12:00</span>
                                    </div>
                                </div>
                            </div>

                            {/* Embed Card */}
                            <div
                                className="border-l-4 rounded-r-md bg-[#2b2d31] p-3.5 space-y-2.5"
                                style={{ borderColor: formEmbedColor || "#10b981" }}
                            >
                                {formEmbedTitle && (
                                    <h4 className="font-bold text-white text-sm leading-snug">{formEmbedTitle}</h4>
                                )}

                                {formEmbedDescription && (
                                    <p className="text-xs whitespace-pre-line text-[#dbdee1] leading-relaxed">
                                        {formEmbedDescription}
                                    </p>
                                )}

                                {formEmbedImage && (
                                    <div className="rounded-lg overflow-hidden border border-black/20 my-2">
                                        <img src={formEmbedImage} alt="Banner" className="w-full h-auto object-cover max-h-48" />
                                    </div>
                                )}

                                {formEmbedFooter && (
                                    <p className="text-[10px] text-[#949ba4] pt-1 border-t border-white/5">{formEmbedFooter}</p>
                                )}
                            </div>

                            {/* Interactive Component Simulation */}
                            {formStyle === "SELECT_MENU" ? (
                                <div className="space-y-1.5 pt-1">
                                    <div className="bg-[#1e1f22] border border-[#3b3e45] rounded-lg p-2.5 flex items-center justify-between text-xs text-[#949ba4]">
                                        <span>Sélectionnez vos rôles ({formOptions.length} disponibles)...</span>
                                        <ChevronDown className="w-4 h-4" />
                                    </div>
                                    <div className="space-y-1 pl-2">
                                        {formOptions.slice(0, 4).map((opt, idx) => (
                                            <div key={idx} className="flex items-center gap-2 text-caption text-[#dbdee1]">
                                                {opt.emoji && <span>{opt.emoji}</span>}
                                                <span className="font-semibold text-white">{opt.label || opt.roleName}</span>
                                                {opt.description && <span className="text-[#949ba4]">({opt.description})</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {formOptions.length === 0 ? (
                                        <span className="text-caption text-[#949ba4] italic">Aucun bouton configuré...</span>
                                    ) : (
                                        formOptions.map((opt, idx) => {
                                            const bgMap: Record<string, string> = {
                                                PRIMARY: "bg-[#5865f2] hover:bg-[#4752c4] text-white",
                                                SECONDARY: "bg-[#4e5058] hover:bg-[#6d6f78] text-white",
                                                SUCCESS: "bg-[#248046] hover:bg-[#1a6334] text-white",
                                                DANGER: "bg-[#da373c] hover:bg-[#a1282c] text-white",
                                            };
                                            return (
                                                <div
                                                    key={idx}
                                                    className={cn(
                                                        "px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all select-none cursor-pointer",
                                                        bgMap[opt.buttonStyle] || bgMap.SECONDARY
                                                    )}
                                                >
                                                    {opt.emoji && <span>{opt.emoji}</span>}
                                                    <span>{opt.label || opt.roleName}</span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Icon Picker Dialog */}
                <Dialog open={isIconPickerOpen} onOpenChange={setIsIconPickerOpen}>
                    <DialogContent className="max-w-xl bg-background border-border max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Package className="w-5 h-5 text-warning" />
                                Choisir une Icône parmi les Packs GOD
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground">
                                Cliquez sur une icône pour l'insérer directement dans votre bouton.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                            {availablePacks.length === 0 ? (
                                <div className="p-8 text-center border border-dashed border-border rounded-xl text-muted-foreground text-xs">
                                    Aucun pack d'icônes disponible. Rendez-vous dans le panneau SuperAdmin GOD pour importer des packs.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {availablePacks.map((pack) => (
                                        <div key={pack.id} className="space-y-2 p-3 bg-surface/40 border border-border rounded-xl">
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                                                    <Sparkles className="w-3.5 h-3.5 text-warning" />
                                                    {pack.name}
                                                </h4>
                                                <span className="text-[10px] text-muted-foreground font-medium uppercase px-1.5 py-0.5 bg-surface rounded border border-border">
                                                    {pack.category}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                                {(pack.icons as any[])?.map((icon, i) => (
                                                    <button
                                                        key={i}
                                                        type="button"
                                                        onClick={() => selectIconFromPack(icon)}
                                                        className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-surface hover:bg-warning/10 hover:border-warning/50 border border-border transition-all text-center group"
                                                    >
                                                        {icon.url ? (
                                                            <div className="relative w-7 h-7 rounded overflow-hidden">
                                                                <Image src={icon.url} alt={icon.name} fill className="object-contain" />
                                                            </div>
                                                        ) : (
                                                            <span className="text-xl">{icon.emoji}</span>
                                                        )}
                                                        <span className="text-[10px] font-semibold text-muted-foreground group-hover:text-foreground truncate w-full">
                                                            {icon.name}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setIsIconPickerOpen(false)}>Fermer</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        );
    }

    // =========================================================================
    // VIEW 2: PANELS OVERVIEW LIST
    // =========================================================================
    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header / Actions Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface/50 border border-border p-5 rounded-2xl">
                <div>
                    <h2 className="text-lg font-black text-foreground flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-warning" />
                        Panneaux Reaction Roles ({groups.length})
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                        Configurez des messages interactifs avec boutons, menus déroulants et icônes pour vos membres Discord.
                    </p>
                </div>
                <Button onClick={openCreate} className="gap-2 bg-warning hover:bg-warning/90 text-warning-foreground font-bold shadow-md shadow-amber-950/20">
                    <Plus className="w-4 h-4" />
                    Créer un Panneau
                </Button>
            </div>

            {/* Groups Grid */}
            {groups.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-border rounded-2xl bg-surface/20 space-y-4">
                    <Layers className="w-12 h-12 mx-auto text-muted-foreground/40" />
                    <div className="space-y-1">
                        <h3 className="text-base font-bold text-foreground">Aucun panneau configuré</h3>
                        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                            Commencez par créer votre premier panneau de rôles ou choisissez l'un de nos modèles pré-conçus.
                        </p>
                    </div>
                    <Button onClick={openCreate} className="gap-2 bg-warning hover:bg-warning/90 text-warning-foreground font-bold">
                        <Plus className="w-4 h-4" />
                        Créer mon premier panneau
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {groups.map((group) => {
                        const channel = discordChannels.find(c => c.id === group.channelId);
                        const isDeployed = !!group.messageId;

                        return (
                            <div
                                key={group.id}
                                className="bg-surface/40 border border-border rounded-2xl p-5 space-y-4 flex flex-col justify-between hover:border-warning/40 transition-all"
                            >
                                <div className="space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-base text-foreground">{group.name}</h3>
                                                {isDeployed ? (
                                                    <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-caption font-bold">
                                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                                        Déployé
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-caption font-bold">
                                                        Brouillon
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-caption text-muted-foreground mt-0.5">
                                                Salon : <span className="text-foreground font-semibold">#{channel?.name || group.channelId}</span>
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => openEdit(group)}
                                                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-surface rounded-lg"
                                                title="Modifier"
                                            >
                                                <Edit3 className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(group.id)}
                                                className="h-8 w-8 text-muted-foreground hover:text-danger hover:bg-danger/10 rounded-lg"
                                                title="Supprimer"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Badges Info */}
                                    <div className="flex flex-wrap gap-2 text-xs">
                                        <Badge variant="secondary" className="bg-elevated border border-border text-foreground font-semibold">
                                            Mode : {group.mode}
                                        </Badge>
                                        <Badge variant="secondary" className="bg-elevated border border-border text-foreground font-semibold">
                                            Style : {group.style === "SELECT_MENU" ? "Menu Déroulant" : "Boutons"}
                                        </Badge>
                                        <Badge variant="secondary" className="bg-elevated border border-border text-foreground font-semibold">
                                            {group.options?.length || 0} rôle(s)
                                        </Badge>
                                    </div>

                                    {/* Roles Preview Pills */}
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {group.options?.slice(0, 8).map((opt: any) => (
                                            <div
                                                key={opt.id}
                                                className="flex items-center gap-1 text-caption px-2 py-0.5 rounded-md bg-black/30 border border-border text-foreground font-medium"
                                            >
                                                {opt.emoji && <span>{opt.emoji}</span>}
                                                <span>{opt.label || opt.roleName}</span>
                                            </div>
                                        ))}
                                        {(group.options?.length || 0) > 8 && (
                                            <span className="text-caption text-muted-foreground font-bold self-center">
                                                +{group.options.length - 8} autres
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-border flex items-center justify-between gap-3">
                                    <span className="text-caption text-muted-foreground font-medium truncate max-w-[200px]">
                                        {group.messageId ? `Message ID : ${group.messageId}` : "Non déployé sur Discord"}
                                    </span>
                                    <Button
                                        size="sm"
                                        onClick={() => handleDeploy(group.id)}
                                        disabled={deployingId === group.id}
                                        className={cn(
                                            "gap-1.5 font-bold text-xs h-8",
                                            isDeployed
                                                ? "bg-surface hover:bg-elevated text-foreground border border-border"
                                                : "bg-warning hover:bg-warning/90 text-warning-foreground"
                                        )}
                                    >
                                        {deployingId === group.id ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <Send className="w-3.5 h-3.5" />
                                        )}
                                        {isDeployed ? "Mettre à Jour Discord" : "Déployer sur Discord"}
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
