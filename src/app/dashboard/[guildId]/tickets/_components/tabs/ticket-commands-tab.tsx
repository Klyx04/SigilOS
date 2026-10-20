"use client";

import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import {
    Terminal,
    Plus,
    Edit2,
    Trash2,
    Search,
    Shield,
    Eye,
    EyeOff,
    CheckCircle2,
    UserPlus,
    UserMinus,
    Lock,
    Sparkles,
    Image as ImageIcon,
    Sliders,
    MessageSquare,
    ExternalLink,
    HelpCircle,
    ChevronRight,
    ChevronLeft,
    BookOpen,
    Info,
    Lightbulb,
    AtSign,
    Hash,
    Layers,
    Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TicketRolesPicker } from "../ticket-discord-pickers";
import {
    TICKET_CUSTOM_COMMANDS_MAX,
    type TicketCustomCommand,
    interpolateTicketCommandTokens,
} from "@/lib/tickets/custom-commands";
import {
    saveTicketCustomCommandAction,
    deleteTicketCustomCommandAction,
    toggleTicketCustomCommandAction,
} from "@/server/actions/ticket-command-actions";

interface TicketCommandsTabProps {
    guildId: string;
    initialCommands: TicketCustomCommand[];
    onRefresh: () => void;
}

// =============================================================================
// DICTIONNAIRE PÉDAGOGIQUE DES VARIABLES
// =============================================================================

interface VariableDoc {
    token: string;
    label: string;
    category: "Membres" | "Ticket" | "Serveur";
    summary: string;
    detail: string;
    previewOutput: string;
    isMention?: boolean;
    isChannel?: boolean;
}

const DETAILED_VARIABLES: VariableDoc[] = [
    {
        token: "{demandeur}",
        label: "Demandeur",
        category: "Membres",
        summary: "Ping du créateur du ticket (@Joueur)",
        detail: "Mentionne directement le membre qui a ouvert le ticket avec une notification sonore et visuelle. Idéal pour lui demander une réponse.",
        previewOutput: "@Aventurier",
        isMention: true,
    },
    {
        token: "{cible}",
        label: "Cible",
        category: "Membres",
        summary: "Ping du membre ciblé par l'option ou le demandeur",
        detail: "Si vous tapez `/{nom} membre:@Pierre`, mentionne Pierre. Si vous n'avez pas précisé de membre, cible automatiquement l'auteur du ticket !",
        previewOutput: "@Aventurier",
        isMention: true,
    },
    {
        token: "{pseudo}",
        label: "Pseudo",
        category: "Membres",
        summary: "Nom brut sans arobase (texte lisible)",
        detail: "Le nom d'affichage du joueur sans @ ni notification sonore. Indispensable pour les titres d'embeds où les mentions ne fonctionnent pas.",
        previewOutput: "Aventurier",
    },
    {
        token: "{staff}",
        label: "Staff",
        category: "Membres",
        summary: "Ping du modérateur qui exécute la commande",
        detail: "Mentionne le membre du staff qui vient de taper la commande slash. Permet au joueur de savoir qui a validé son ticket.",
        previewOutput: "@Modérateur",
        isMention: true,
    },
    {
        token: "{motif}",
        label: "Motif",
        category: "Ticket",
        summary: "Nom du motif du ticket (ex: Recrutement)",
        detail: "Le titre de la catégorie ou du parcours sélectionné à l'ouverture du ticket (ex: Recrutement, Demande d'aide, Plainte).",
        previewOutput: "Recrutement",
    },
    {
        token: "{numero}",
        label: "Numéro",
        category: "Ticket",
        summary: "Numéro formaté du ticket (#0042)",
        detail: "Le numéro d'ordre unique du ticket, très utile pour les références d'archives et le suivi d'équipe.",
        previewOutput: "#0042",
    },
    {
        token: "{salon}",
        label: "Salon",
        category: "Ticket",
        summary: "Lien cliquable vers le salon Discord",
        detail: "Génère un lien Discord cliquable (#ticket-0042). Les membres peuvent cliquer dessus pour naviguer directement dans le salon.",
        previewOutput: "#ticket-0042",
        isChannel: true,
    },
    {
        token: "{serveur}",
        label: "Serveur",
        category: "Serveur",
        summary: "Nom de votre serveur / guilde",
        detail: "Le nom officiel de votre guilde configuré dans SigilOS.",
        previewOutput: "SigilOS Guilde",
    },
];

// =============================================================================
// MODÈLES PRÊTS À L'EMPLOI (PRESETS)
// =============================================================================

interface CommandPreset {
    id: string;
    label: string;
    badge: string;
    icon: string;
    description: string;
    command: {
        name: string;
        description: string;
        allowTargetMember: boolean;
        ephemeral: boolean;
        content: string;
        embedEnabled: boolean;
        embedTitle: string;
        embedDescription: string;
        embedColor: string;
        embedFooter: string;
        autoCloseTicket: boolean;
        permissionMode: "STAFF_ONLY" | "CUSTOM_ROLES" | "ALL";
    };
}

const COMMAND_PRESETS: CommandPreset[] = [
    {
        id: "bienvenue",
        label: "Validation Recrue",
        badge: "Recrutement",
        icon: "🎉",
        description: "Donne le rôle de membre, retire candidat et souhaite la bienvenue avec un bel encadré vert.",
        command: {
            name: "bienvenue",
            description: "Valide la candidature, attribue les rôles et souhaite la bienvenue",
            allowTargetMember: true,
            ephemeral: false,
            content: "🎉 Bienvenue dans nos rangs {cible} ! Ta candidature sur **{serveur}** a été acceptée avec succès par {staff}.\n\nPrends un instant pour consulter les salons importants et poser tes questions !",
            embedEnabled: true,
            embedTitle: "✨ Nouveau membre : {pseudo}",
            embedDescription: "Le joueur {cible} a été officiellement intégré à la guilde !\n\n• **Dossier :** #{numero} ({motif})\n• **Validé par :** {staff}\n• **Salon :** {salon}",
            embedColor: "#22C55E",
            embedFooter: "{serveur} • Recrutement validé",
            autoCloseTicket: false,
            permissionMode: "STAFF_ONLY",
        },
    },
    {
        id: "promotion",
        label: "Promotion / Rang",
        badge: "Évolution",
        icon: "🎖️",
        description: "Félicite le membre pour son nouveau grade avec un encadré doré officiel.",
        command: {
            name: "gardien",
            description: "Passe le joueur au rang supérieur et félicite son engagement",
            allowTargetMember: true,
            ephemeral: false,
            content: "🛡️ Félicitations {cible} pour ton engagement constant au sein de **{serveur}** !",
            embedEnabled: true,
            embedTitle: "🎖️ Promotion au rang supérieur",
            embedDescription: "Félicitations à {cible} qui passe au grade supérieur sur le serveur !\n\nAttribué par {staff}.",
            embedColor: "#F59E0B",
            embedFooter: "{serveur} • Gestion des rangs",
            autoCloseTicket: false,
            permissionMode: "STAFF_ONLY",
        },
    },
    {
        id: "resoudre",
        label: "Résolution & Clôture",
        badge: "Support",
        icon: "✅",
        description: "Remercie le demandeur et déclenche la clôture automatique propre du ticket.",
        command: {
            name: "resoudre",
            description: "Indique que la demande est résolue et clôture le ticket",
            allowTargetMember: false,
            ephemeral: false,
            content: "✅ Merci {demandeur} ! Ton ticket #{numero} concernant **{motif}** a été entièrement traité par {staff}.\n\nLe salon va maintenant être archivé et fermé automatiquement. Bon jeu sur Dofus !",
            embedEnabled: false,
            embedTitle: "",
            embedDescription: "",
            embedColor: "#5865F2",
            embedFooter: "",
            autoCloseTicket: true,
            permissionMode: "STAFF_ONLY",
        },
    },
    {
        id: "relance",
        label: "Relance Inactivité",
        badge: "Suivi",
        icon: "⏰",
        description: "Rappelle poliment le joueur resté inactif sans fermer son salon.",
        command: {
            name: "relance",
            description: "Relance poliment le créateur du ticket resté inactif",
            allowTargetMember: false,
            ephemeral: false,
            content: "👋 Bonjour {demandeur},\n\nNous sommes en attente de ton retour concernant ton ticket #{numero} ({motif}).\n\nEs-tu toujours disponible ? N'hésite pas à répondre directement ici !",
            embedEnabled: false,
            embedTitle: "",
            embedDescription: "",
            embedColor: "#5865F2",
            embedFooter: "",
            autoCloseTicket: false,
            permissionMode: "STAFF_ONLY",
        },
    },
];

const EMBED_PRESET_COLORS = [
    { label: "Blurple", value: "#5865F2" },
    { label: "Émeraude", value: "#22C55E" },
    { label: "Rouge", value: "#ED4245" },
    { label: "Or", value: "#F59E0B" },
    { label: "Violet", value: "#A855F7" },
    { label: "Sombre", value: "#2B2D31" },
];

const TAB_STEPS = ["general", "message", "actions", "permissions"] as const;
type TabStep = typeof TAB_STEPS[number];

// =============================================================================
// RENDU RÉALISTE DISCORD (MENTIONS, CANAUX & MARKDOWN)
// =============================================================================

function DiscordTextRenderer({ text }: { text: string }) {
    if (!text) return null;

    const lines = text.split("\n");

    return (
        <div className="space-y-1">
            {lines.map((line, lineIdx) => {
                let isQuote = false;
                let isH1 = false;
                let isH2 = false;
                let lineContent = line;

                if (lineContent.startsWith("> ")) {
                    isQuote = true;
                    lineContent = lineContent.slice(2);
                } else if (lineContent.startsWith("# ")) {
                    isH1 = true;
                    lineContent = lineContent.slice(2);
                } else if (lineContent.startsWith("## ")) {
                    isH2 = true;
                    lineContent = lineContent.slice(3);
                }

                // Découpage des jetons : mentions <@id>, canaux <#id>, gras **...**, italique *...*, code `...`
                const parts = lineContent.split(/(<@[0-9]+>|<#[0-9]+>|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);

                const renderedLine = parts.map((part, partIdx) => {
                    if (!part) return null;

                    // Lien de salon Discord <#id>
                    if (part.startsWith("<#") && part.endsWith(">")) {
                        return (
                            <span
                                key={partIdx}
                                className="inline-flex items-center gap-0.5 bg-[#3c4270]/60 hover:bg-[#3c4270]/80 text-[#c9cdfb] font-semibold px-1.5 py-0.2 rounded text-[11px] align-baseline transition-colors select-none"
                            >
                                <Hash className="h-3 w-3 inline text-[#c9cdfb]" />
                                ticket-0042
                            </span>
                        );
                    }

                    // Mention Discord <@id>
                    if (part.startsWith("<@") && part.endsWith(">")) {
                        const isStaff = part.includes("987654321");
                        const label = isStaff ? "@Modérateur" : "@Aventurier";
                        return (
                            <span
                                key={partIdx}
                                className="inline-flex items-center gap-0.5 bg-[#5865F2]/25 hover:bg-[#5865F2]/40 text-[#c9cdfb] font-medium px-1.5 py-0.2 rounded text-[11px] align-baseline transition-colors select-none"
                            >
                                {label}
                            </span>
                        );
                    }

                    // Gras **texte**
                    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
                        return <strong key={partIdx} className="font-bold text-white">{part.slice(2, -2)}</strong>;
                    }

                    // Italique *texte*
                    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
                        return <em key={partIdx} className="italic text-[#dbdee1]">{part.slice(1, -1)}</em>;
                    }

                    // Code en ligne `code`
                    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
                        return (
                            <code key={partIdx} className="bg-[#2b2d31] text-[#e0e1e5] px-1 py-0.5 rounded font-mono text-[11px]">
                                {part.slice(1, -1)}
                            </code>
                        );
                    }

                    return <span key={partIdx}>{part}</span>;
                });

                if (isQuote) {
                    return (
                        <div key={lineIdx} className="border-l-4 border-[#4e5058] pl-2 text-[#949ba4] italic my-0.5">
                            {renderedLine}
                        </div>
                    );
                }
                if (isH1) {
                    return (
                        <div key={lineIdx} className="text-sm font-bold text-white mt-1 mb-0.5">
                            {renderedLine}
                        </div>
                    );
                }
                if (isH2) {
                    return (
                        <div key={lineIdx} className="text-xs font-bold text-white mt-1 mb-0.5">
                            {renderedLine}
                        </div>
                    );
                }

                return (
                    <div key={lineIdx} className="min-h-[1.15rem]">
                        {renderedLine}
                    </div>
                );
            })}
        </div>
    );
}

// =============================================================================
// COMPOSANT PRINCIPAL
// =============================================================================

export function TicketCommandsTab({ guildId, initialCommands, onRefresh }: TicketCommandsTabProps) {
    const [commands, setCommands] = useState<TicketCustomCommand[]>(initialCommands);
    const [search, setSearch] = useState("");
    const [isPending, startTransition] = useTransition();

    // État du modal d'édition / création
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [activeModalTab, setActiveModalTab] = useState<TabStep>("general");

    // Guides interactifs dépliables
    const [showVariablesGuide, setShowVariablesGuide] = useState(false);
    const [showMarkdownGuide, setShowMarkdownGuide] = useState(false);

    // Formulaire
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [ephemeral, setEphemeral] = useState(false);
    const [allowTargetMember, setAllowTargetMember] = useState(true);
    const [content, setContent] = useState("");
    const [embedEnabled, setEmbedEnabled] = useState(false);
    const [embedTitle, setEmbedTitle] = useState("");
    const [embedDescription, setEmbedDescription] = useState("");
    const [embedColor, setEmbedColor] = useState("#5865F2");
    const [embedImageUrl, setEmbedImageUrl] = useState("");
    const [embedThumbnailUrl, setEmbedThumbnailUrl] = useState("");
    const [embedFooter, setEmbedFooter] = useState("");
    const [addRoleIds, setAddRoleIds] = useState<string[]>([]);
    const [removeRoleIds, setRemoveRoleIds] = useState<string[]>([]);
    const [autoCloseTicket, setAutoCloseTicket] = useState(false);
    const [permissionMode, setPermissionMode] = useState<"STAFF_ONLY" | "CUSTOM_ROLES" | "ALL">("STAFF_ONLY");
    const [allowedRoleIds, setAllowedRoleIds] = useState<string[]>([]);

    // Focus tracking pour l'insertion de variables
    const [lastActiveInput, setLastActiveInput] = useState<"content" | "embedDesc" | "embedTitle">("content");

    const filteredCommands = useMemo(() => {
        if (!search.trim()) return commands;
        const q = search.toLowerCase().trim();
        return commands.filter(
            (c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
        );
    }, [commands, search]);

    const resetForm = () => {
        setEditingId(null);
        setName("");
        setDescription("");
        setEphemeral(false);
        setAllowTargetMember(true);
        setContent("");
        setEmbedEnabled(false);
        setEmbedTitle("");
        setEmbedDescription("");
        setEmbedColor("#5865F2");
        setEmbedImageUrl("");
        setEmbedThumbnailUrl("");
        setEmbedFooter("");
        setAddRoleIds([]);
        setRemoveRoleIds([]);
        setAutoCloseTicket(false);
        setPermissionMode("STAFF_ONLY");
        setAllowedRoleIds([]);
        setActiveModalTab("general");
        setShowVariablesGuide(false);
        setShowMarkdownGuide(false);
    };

    const openCreateModal = () => {
        if (commands.length >= TICKET_CUSTOM_COMMANDS_MAX) {
            toast.error(`Quota maximal atteint (${TICKET_CUSTOM_COMMANDS_MAX} commandes maximum).`);
            return;
        }
        resetForm();
        setModalOpen(true);
    };

    const openEditModal = (cmd: TicketCustomCommand) => {
        setEditingId(cmd.id);
        setName(cmd.name);
        setDescription(cmd.description);
        setEphemeral(cmd.ephemeral);
        setAllowTargetMember(cmd.allowTargetMember);
        setContent(cmd.content || "");
        setEmbedEnabled(cmd.embedEnabled || false);
        setEmbedTitle(cmd.embed?.title || "");
        setEmbedDescription(cmd.embed?.description || "");
        setEmbedColor(cmd.embed?.color || "#5865F2");
        setEmbedImageUrl(cmd.embed?.imageUrl || "");
        setEmbedThumbnailUrl(cmd.embed?.thumbnailUrl || "");
        setEmbedFooter(cmd.embed?.footer || "");
        setAddRoleIds(cmd.addRoleIds || []);
        setRemoveRoleIds(cmd.removeRoleIds || []);
        setAutoCloseTicket(cmd.autoCloseTicket || false);
        setPermissionMode(cmd.permissionMode || "STAFF_ONLY");
        setAllowedRoleIds(cmd.allowedRoleIds || []);
        setActiveModalTab("general");
        setShowVariablesGuide(false);
        setShowMarkdownGuide(false);
        setModalOpen(true);
    };

    const applyPreset = (preset: CommandPreset) => {
        setName(preset.command.name);
        setDescription(preset.command.description);
        setAllowTargetMember(preset.command.allowTargetMember);
        setEphemeral(preset.command.ephemeral);
        setContent(preset.command.content);
        setEmbedEnabled(preset.command.embedEnabled);
        setEmbedTitle(preset.command.embedTitle);
        setEmbedDescription(preset.command.embedDescription);
        setEmbedColor(preset.command.embedColor);
        setEmbedFooter(preset.command.embedFooter);
        setAutoCloseTicket(preset.command.autoCloseTicket);
        setPermissionMode(preset.command.permissionMode);
        toast.success(`Modèle "${preset.label}" appliqué ! Vous pouvez ajuster les champs.`);
    };

    const insertVariable = (token: string) => {
        if (lastActiveInput === "content") {
            setContent((prev) => prev + token);
        } else if (lastActiveInput === "embedDesc") {
            setEmbedDescription((prev) => prev + token);
        } else if (lastActiveInput === "embedTitle") {
            setEmbedTitle((prev) => prev + token);
        }
        toast.info(`Variable ${token} insérée.`);
    };

    const handleSave = () => {
        const cleanName = name.toLowerCase().replace(/[^a-z0-9_-]/g, "").trim();
        if (!cleanName) {
            toast.error("Veuillez saisir un nom de commande valide (ex: gardien, bienvenue).");
            setActiveModalTab("general");
            return;
        }
        if (!description.trim()) {
            toast.error("Veuillez saisir une description pour la commande.");
            setActiveModalTab("general");
            return;
        }
        if (!content.trim() && !embedEnabled) {
            toast.error("Veuillez saisir au moins un message texte ou activer un Embed.");
            setActiveModalTab("message");
            return;
        }

        startTransition(async () => {
            const payload = {
                id: editingId || undefined,
                name: cleanName,
                description: description.trim(),
                isEnabled: true,
                ephemeral,
                allowTargetMember,
                content,
                embedEnabled,
                embed: embedEnabled
                    ? {
                          title: embedTitle.trim() || undefined,
                          description: embedDescription.trim() || undefined,
                          color: embedColor,
                          imageUrl: embedImageUrl.trim() || undefined,
                          thumbnailUrl: embedThumbnailUrl.trim() || undefined,
                          footer: embedFooter.trim() || undefined,
                      }
                    : undefined,
                addRoleIds,
                removeRoleIds,
                autoCloseTicket,
                permissionMode,
                allowedRoleIds,
            };

            const res = await saveTicketCustomCommandAction(guildId, payload);
            if (res.success && res.data) {
                toast.success(
                    editingId
                        ? `Commande /${cleanName} modifiée et synchronisée avec Discord !`
                        : `Commande /${cleanName} créée et synchronisée avec Discord !`
                );
                setCommands((prev) => {
                    const idx = prev.findIndex((c) => c.id === res.data!.id);
                    if (idx >= 0) {
                        const copy = [...prev];
                        copy[idx] = res.data!;
                        return copy;
                    }
                    return [...prev, res.data!];
                });
                setModalOpen(false);
                onRefresh();
            } else {
                toast.error(res.error || "Erreur lors de l'enregistrement");
            }
        });
    };

    const handleDelete = (id: string, cmdName: string) => {
        if (!confirm(`Supprimer définitivement la commande /${cmdName} de votre serveur Discord ?`)) return;

        startTransition(async () => {
            const res = await deleteTicketCustomCommandAction(guildId, id);
            if (res.success) {
                toast.success(`Commande /${cmdName} supprimée de Discord.`);
                setCommands((prev) => prev.filter((c) => c.id !== id));
                onRefresh();
            } else {
                toast.error(res.error || "Erreur suppression commande");
            }
        });
    };

    const handleToggle = (cmd: TicketCustomCommand) => {
        const nextState = !cmd.isEnabled;
        startTransition(async () => {
            const res = await toggleTicketCustomCommandAction(guildId, cmd.id, nextState);
            if (res.success) {
                setCommands((prev) =>
                    prev.map((c) => (c.id === cmd.id ? { ...c, isEnabled: nextState } : c))
                );
                toast.success(nextState ? `Commande /${cmd.name} activée.` : `Commande /${cmd.name} désactivée.`);
                onRefresh();
            } else {
                toast.error(res.error || "Erreur mise à jour");
            }
        });
    };

    // Contexte d'aperçu réaliste
    const previewContext = {
        demandeurId: "123456789012345678",
        demandeurPseudo: "Aventurier",
        targetId: "123456789012345678",
        targetPseudo: "Aventurier",
        staffId: "987654321098765432",
        staffPseudo: "Modérateur",
        ticketNumero: 42,
        ticketMotif: "Recrutement",
        channelId: "555666777888999",
        serverName: "Guilde SigilOS",
    };

    const renderedPreviewContent = interpolateTicketCommandTokens(content, previewContext);
    const renderedEmbedTitle = interpolateTicketCommandTokens(embedTitle, previewContext);
    const renderedEmbedDesc = interpolateTicketCommandTokens(embedDescription, previewContext);
    const renderedEmbedFooter = interpolateTicketCommandTokens(embedFooter, previewContext);

    return (
        <div className="space-y-6">
            {/* En-tête & Barre d'actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-border bg-card">
                <div>
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <Terminal className="h-5 w-5 text-emerald-400" />
                        Commandes Slash Personnalisées
                        <Badge variant="outline" className="text-xs font-mono border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                            {commands.length} / {TICKET_CUSTOM_COMMANDS_MAX}
                        </Badge>
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Créez jusqu&apos;à 20 commandes slash Discord rapides, utilisables exclusivement dans les salons de tickets de votre guilde.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        onClick={openCreateModal}
                        disabled={commands.length >= TICKET_CUSTOM_COMMANDS_MAX}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5 shadow-xs"
                    >
                        <Plus className="h-4 w-4" />
                        Nouvelle commande slash
                    </Button>
                </div>
            </div>

            {/* Bannière d'aide rapide */}
            <div className="p-3.5 rounded-xl border border-border/80 bg-surface/30 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                    <Lightbulb className="h-4 w-4" />
                </div>
                <div className="space-y-0.5 text-xs">
                    <div className="font-semibold text-foreground">Comment fonctionnent ces commandes sur Discord ?</div>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                        Chaque commande créée ici est automatiquement synchronisée avec l&apos;API Discord. Lorsqu&apos;un membre du staff tape <code className="bg-surface px-1 py-0.5 rounded font-mono text-emerald-400">/</code> dans un salon de ticket, Discord lui propose la commande avec autocomplétion intelligente, gestion des rôles et message personnalisé.
                    </p>
                </div>
            </div>

            {/* Barre de recherche */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                    placeholder="Rechercher une commande (/bienvenue, /gardien...)"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 text-xs h-9"
                />
            </div>

            {/* Grille des commandes */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCommands.length === 0 ? (
                    <div className="col-span-full p-12 text-center rounded-2xl border border-dashed border-border bg-card/40 space-y-3">
                        <Terminal className="h-10 w-10 text-muted-foreground mx-auto opacity-40" />
                        <div className="space-y-1">
                            <h3 className="font-semibold text-foreground text-sm">
                                {search ? "Aucune commande correspondante" : "Aucune commande slash personnalisée"}
                            </h3>
                            <p className="text-xs text-muted-foreground max-w-md mx-auto">
                                {search
                                    ? "Modifiez votre recherche ou effacez le filtre."
                                    : "Gagnez du temps dans la gestion de vos tickets en créant votre première commande slash (/bienvenue, /gardien, /resoudre...)."}
                            </p>
                        </div>
                        {!search && (
                            <Button size="sm" onClick={openCreateModal} className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5">
                                <Plus className="h-3.5 w-3.5" /> Créer une commande
                            </Button>
                        )}
                    </div>
                ) : (
                    filteredCommands.map((cmd) => (
                        <div
                            key={cmd.id}
                            className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                                cmd.isEnabled ? "bg-card border-border hover:border-emerald-500/40" : "bg-card/40 border-border/50 opacity-70"
                            }`}
                        >
                            <div className="space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <div className="flex items-center gap-1.5 font-mono font-bold text-sm text-foreground">
                                            <span className="text-emerald-400">/</span>
                                            {cmd.name}
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{cmd.description}</p>
                                    </div>

                                    {/* Switch on/off rapide */}
                                    <button
                                        type="button"
                                        onClick={() => handleToggle(cmd)}
                                        disabled={isPending}
                                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                            cmd.isEnabled ? "bg-emerald-500" : "bg-muted"
                                        }`}
                                        title={cmd.isEnabled ? "Désactiver" : "Activer"}
                                    >
                                        <span
                                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                                cmd.isEnabled ? "translate-x-4" : "translate-x-0"
                                            }`}
                                        />
                                    </button>
                                </div>

                                {/* Badges informatifs */}
                                <div className="flex flex-wrap gap-1 text-[10px]">
                                    {cmd.allowTargetMember && (
                                        <Badge variant="outline" className="bg-surface/80 border-border text-muted-foreground">
                                            [membre]
                                        </Badge>
                                    )}
                                    {cmd.ephemeral && (
                                        <Badge variant="outline" className="bg-surface/80 border-border text-muted-foreground">
                                            Discret (éphémère)
                                        </Badge>
                                    )}
                                    {cmd.embedEnabled && (
                                        <Badge variant="outline" className="bg-purple-500/10 border-purple-500/30 text-purple-400">
                                            Embed
                                        </Badge>
                                    )}
                                    {cmd.addRoleIds && cmd.addRoleIds.length > 0 && (
                                        <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                                            <UserPlus className="h-2.5 w-2.5" /> +{cmd.addRoleIds.length} rôle(s)
                                        </Badge>
                                    )}
                                    {cmd.removeRoleIds && cmd.removeRoleIds.length > 0 && (
                                        <Badge variant="outline" className="bg-red-500/10 border-red-500/30 text-red-400 flex items-center gap-1">
                                            <UserMinus className="h-2.5 w-2.5" /> -{cmd.removeRoleIds.length} rôle(s)
                                        </Badge>
                                    )}
                                    {cmd.autoCloseTicket && (
                                        <Badge variant="outline" className="bg-amber-500/10 border-amber-500/30 text-amber-400 flex items-center gap-1">
                                            <Lock className="h-2.5 w-2.5" /> Clôture auto
                                        </Badge>
                                    )}
                                </div>

                                {/* Extrait du message */}
                                <div className="p-2.5 rounded-xl bg-surface/40 border border-border/40 text-[11px] text-muted-foreground line-clamp-2 font-mono">
                                    {cmd.content || (cmd.embed?.description ? `[Embed] ${cmd.embed.description}` : "Aucun texte")}
                                </div>
                            </div>

                            {/* Actions bas de carte */}
                            <div className="pt-3 mt-3 border-t border-border flex items-center justify-between gap-2">
                                <div className="text-[10px] text-muted-foreground">
                                    {cmd.permissionMode === "STAFF_ONLY" ? "Staff du ticket" : cmd.permissionMode === "ALL" ? "Tous" : "Rôles autorisés"}
                                </div>

                                <div className="flex items-center gap-1">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => openEditModal(cmd)}
                                        className="h-7 px-2 text-xs"
                                        title="Modifier"
                                    >
                                        <Edit2 className="h-3 w-3 mr-1" /> Modifier
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDelete(cmd.id, cmd.name)}
                                        className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                        title="Supprimer"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal d'édition / création */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Terminal className="h-5 w-5 text-emerald-400" />
                            {editingId ? `Modifier la commande /${name}` : "Nouvelle commande slash"}
                        </DialogTitle>
                    </DialogHeader>

                    {/* Section Modèles prêts à l'emploi (si nouvelle commande) */}
                    {!editingId && (
                        <div className="p-3.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                                    Gagnez du temps : partez d&apos;un modèle prêt à l&apos;emploi
                                </div>
                                <span className="text-[10px] text-muted-foreground">cliquez pour pré-remplir</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {COMMAND_PRESETS.map((preset) => (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => applyPreset(preset)}
                                        className="p-2.5 rounded-xl border border-border bg-card/60 hover:bg-surface hover:border-emerald-500/40 text-left transition-all group flex flex-col justify-between"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between text-xs font-bold text-foreground mb-1">
                                                <span>{preset.icon} {preset.label}</span>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                                                {preset.description}
                                            </p>
                                        </div>
                                        <div className="mt-2 text-[9px] font-mono text-emerald-400">
                                            /{preset.command.name}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Navigation par onglets numérotés */}
                    <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-2">
                        <button
                            type="button"
                            onClick={() => setActiveModalTab("general")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                                activeModalTab === "general"
                                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                    : "text-muted-foreground hover:text-foreground hover:bg-surface/60"
                            }`}
                        >
                            <span className="h-4 w-4 rounded-full bg-surface flex items-center justify-center text-[10px]">1</span>
                            Déclencheur & Visibilité
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveModalTab("message")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                                activeModalTab === "message"
                                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                    : "text-muted-foreground hover:text-foreground hover:bg-surface/60"
                            }`}
                        >
                            <span className="h-4 w-4 rounded-full bg-surface flex items-center justify-center text-[10px]">2</span>
                            Message & Embed
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveModalTab("actions")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                                activeModalTab === "actions"
                                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                    : "text-muted-foreground hover:text-foreground hover:bg-surface/60"
                            }`}
                        >
                            <span className="h-4 w-4 rounded-full bg-surface flex items-center justify-center text-[10px]">3</span>
                            Actions sur les rôles & Clôture
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveModalTab("permissions")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                                activeModalTab === "permissions"
                                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                    : "text-muted-foreground hover:text-foreground hover:bg-surface/60"
                            }`}
                        >
                            <span className="h-4 w-4 rounded-full bg-surface flex items-center justify-center text-[10px]">4</span>
                            Qui peut l&apos;utiliser ?
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 py-2 text-xs">
                        {/* Volet formulaire avec documentation contextualisée */}
                        <div className="space-y-4">
                            {/* ========================================================= */}
                            {/* ÉTAPE 1 : DÉCLENCHEUR & VISIBILITÉ */}
                            {/* ========================================================= */}
                            {activeModalTab === "general" && (
                                <div className="space-y-4">
                                    {/* Guide vulgarisé Étape 1 */}
                                    <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-start gap-2.5">
                                        <Lightbulb className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                                        <div className="space-y-0.5">
                                            <div className="font-semibold text-foreground text-xs">Étape 1 : Définir le nom et les options de la commande</div>
                                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                                Le <strong>nom</strong> est le mot-clé que le staff tapera sur Discord précédé de <code className="bg-surface px-1 py-0.5 rounded font-mono text-emerald-400">/</code> (ex: <code className="bg-surface px-1 py-0.5 rounded font-mono text-foreground">/bienvenue</code>). La <strong>description</strong> aide à comprendre son utilité dans le menu Discord.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="font-semibold text-foreground flex items-center justify-between">
                                            <span>Nom de la commande Discord</span>
                                            <span className="text-[10px] text-muted-foreground font-mono">1 à 32 lettres minuscules</span>
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold font-mono">/</span>
                                            <Input
                                                placeholder="gardien, bienvenue, candidat, resoudre..."
                                                value={name}
                                                onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                                                maxLength={32}
                                                className="pl-7 font-mono text-xs"
                                            />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">
                                            💡 <em>Astuce :</em> Les espaces, majuscules et accents sont interdits par Discord. Utilisez des tirets (ex: <code className="font-mono text-foreground">valider-candidat</code>).
                                        </p>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="font-semibold text-foreground flex items-center justify-between">
                                            <span>Description affichée dans le menu Discord</span>
                                            <span className="text-[10px] text-muted-foreground">1-100 caractères</span>
                                        </label>
                                        <Input
                                            placeholder="ex : Souhaite la bienvenue et donne le rôle Membre"
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            maxLength={100}
                                            className="text-xs"
                                        />
                                        <p className="text-[10px] text-muted-foreground">
                                            Cette description apparaît directement sous la commande lorsque vous tapez <code className="font-mono text-foreground">/</code> dans Discord.
                                        </p>
                                    </div>

                                    {/* Options avancées d'interaction */}
                                    <div className="p-3.5 rounded-xl border border-border bg-surface/40 space-y-3">
                                        <label className="flex items-start gap-2.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={allowTargetMember}
                                                onChange={(e) => setAllowTargetMember(e.target.checked)}
                                                className="mt-0.5 rounded border-border"
                                            />
                                            <div>
                                                <div className="font-semibold text-foreground">Ajouter l&apos;option membre cible (Recommandé)</div>
                                                <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                                                    Permet de taper <code className="bg-surface px-1 py-0.5 rounded font-mono text-foreground">/{name || "commande"} membre:@pseudo</code> pour cibler un joueur précis.
                                                </div>
                                                <div className="mt-1 p-2 rounded-lg bg-surface/80 border border-border/60 text-[10px] text-emerald-400">
                                                    ✨ <strong>Autocomplétion intelligente :</strong> Si vous omettez l&apos;option dans Discord, le robot ciblera automatiquement le créateur du ticket ! Vous n&apos;avez donc pas besoin de retaper son pseudo.
                                                </div>
                                            </div>
                                        </label>

                                        <label className="flex items-start gap-2.5 cursor-pointer border-t border-border/50 pt-3">
                                            <input
                                                type="checkbox"
                                                checked={ephemeral}
                                                onChange={(e) => setEphemeral(e.target.checked)}
                                                className="mt-0.5 rounded border-border"
                                            />
                                            <div>
                                                <div className="font-semibold text-foreground">Réponse discrète (Éphémère — seul vous voyez la réponse)</div>
                                                <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                                                    Si coché, le message Discord ne sera visible que par la personne qui a lancé la commande. Idéal pour des commandes internes de vérification ou de modération.
                                                </div>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* ========================================================= */}
                            {/* ÉTAPE 2 : MESSAGE & EMBED */}
                            {/* ========================================================= */}
                            {activeModalTab === "message" && (
                                <div className="space-y-4">
                                    {/* Guide vulgarisé Étape 2 */}
                                    <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-start gap-2.5">
                                        <MessageSquare className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                                        <div className="space-y-0.5">
                                            <div className="font-semibold text-foreground text-xs">Étape 2 : Rédiger le message et insérer des variables</div>
                                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                                Composez le texte envoyé par le bot. Vous pouvez utiliser du texte simple (avec mentions) et/ou un encadré visuel (Embed). Cliquez sur les balises ci-dessous pour insérer dynamiquement le pseudo du joueur, le staff ou le numéro du ticket !
                                            </p>
                                        </div>
                                    </div>

                                    {/* Palette d'insertion rapide des variables */}
                                    <div className="space-y-2 p-3 rounded-xl border border-border bg-surface/40">
                                        <div className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                                            <span className="flex items-center gap-1.5">
                                                <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                                                Insérer une variable au curseur :
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setShowVariablesGuide(!showVariablesGuide)}
                                                className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                                            >
                                                <BookOpen className="h-3 w-3" />
                                                {showVariablesGuide ? "Masquer le lexique" : "Qu'est-ce que ces balises font ?"}
                                            </button>
                                        </div>

                                        <div className="flex flex-wrap gap-1.5">
                                            {DETAILED_VARIABLES.map((v) => (
                                                <button
                                                    key={v.token}
                                                    type="button"
                                                    onClick={() => insertVariable(v.token)}
                                                    className="px-2 py-1 rounded-lg bg-card hover:bg-surface border border-border text-[11px] font-mono text-emerald-400 hover:text-emerald-300 transition-colors shadow-xs flex items-center gap-1 group"
                                                    title={`${v.summary} • Cliquez pour insérer`}
                                                >
                                                    <span className="font-bold">+{v.label}</span>
                                                    <span className="text-[9px] text-muted-foreground opacity-75 group-hover:opacity-100 font-sans">
                                                        ({v.previewOutput})
                                                    </span>
                                                </button>
                                            ))}
                                        </div>

                                        {/* Lexique complet interactif & vulgarisé */}
                                        {showVariablesGuide && (
                                            <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
                                                <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                                    <BookOpen className="h-3.5 w-3.5 text-emerald-400" />
                                                    Dictionnaire des balises dynamiques :
                                                </div>
                                                <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
                                                    {DETAILED_VARIABLES.map((v) => (
                                                        <div
                                                            key={v.token}
                                                            className="p-2.5 rounded-lg border border-border/80 bg-card/60 flex items-start justify-between gap-3 text-[11px]"
                                                        >
                                                            <div className="space-y-0.5">
                                                                <div className="flex items-center gap-2">
                                                                    <code className="px-1 py-0.5 rounded bg-surface font-mono font-bold text-emerald-400">
                                                                        {v.token}
                                                                    </code>
                                                                    <span className="font-semibold text-foreground">{v.label}</span>
                                                                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                                                                        {v.category}
                                                                    </Badge>
                                                                </div>
                                                                <p className="text-muted-foreground text-[10.5px] leading-relaxed">
                                                                    {v.detail}
                                                                </p>
                                                                <div className="text-[10px] text-foreground font-mono">
                                                                    Rendu simulé : <span className="text-emerald-400 font-semibold">{v.previewOutput}</span>
                                                                </div>
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => insertVariable(v.token)}
                                                                className="h-6 px-2 text-[10px] shrink-0 font-semibold text-emerald-400 hover:text-emerald-300"
                                                            >
                                                                Insérer
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Message texte Markdown */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <label className="font-semibold text-foreground">
                                                Message texte envoyé dans le ticket
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => setShowMarkdownGuide(!showMarkdownGuide)}
                                                className="text-[10px] text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1"
                                            >
                                                <HelpCircle className="h-3 w-3" />
                                                {showMarkdownGuide ? "Masquer l'aide Markdown" : "Aide mise en page Markdown"}
                                            </button>
                                        </div>

                                        {showMarkdownGuide && (
                                            <div className="p-2.5 rounded-xl border border-border bg-surface/50 text-[10.5px] space-y-1 text-muted-foreground">
                                                <div className="font-semibold text-foreground">Formatage Discord supporté :</div>
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    <div><code className="text-emerald-400">**texte en gras**</code> → <strong>texte en gras</strong></div>
                                                    <div><code className="text-emerald-400">*texte en italique*</code> → <em>texte en italique</em></div>
                                                    <div><code className="text-emerald-400">&gt; citation</code> → bloc citation</div>
                                                    <div><code className="text-emerald-400"># Grand titre</code> → Titre d&apos;en-tête</div>
                                                </div>
                                            </div>
                                        )}

                                        <Textarea
                                            placeholder="# Bienvenue {cible} !&#10;Félicitations pour ton avancée au sein de {serveur}..."
                                            value={content}
                                            onChange={(e) => setContent(e.target.value)}
                                            onFocus={() => setLastActiveInput("content")}
                                            rows={5}
                                            className="text-xs font-mono resize-y"
                                        />
                                    </div>

                                    {/* Intégration enrichie (Embed Discord) */}
                                    <div className="space-y-3 pt-2 border-t border-border/60">
                                        <label className="flex items-center justify-between cursor-pointer p-2.5 rounded-xl border border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 transition-colors">
                                            <div className="font-semibold text-foreground flex items-center gap-2">
                                                <Sparkles className="h-4 w-4 text-purple-400" />
                                                <div>
                                                    <div>Ajouter un encadré visuel (Embed Discord)</div>
                                                    <div className="text-[10.5px] font-normal text-muted-foreground">
                                                        Permet d&apos;afficher un encadré coloré professionnel avec titre, description, logo et pied de page.
                                                    </div>
                                                </div>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={embedEnabled}
                                                onChange={(e) => setEmbedEnabled(e.target.checked)}
                                                className="rounded border-border h-4 w-4"
                                            />
                                        </label>

                                        {embedEnabled && (
                                            <div className="space-y-3 p-3.5 rounded-xl border border-purple-500/20 bg-purple-500/5">
                                                <div className="space-y-1">
                                                    <label className="font-semibold text-foreground text-[11px] flex items-center justify-between">
                                                        <span>Titre de l&apos;encadré</span>
                                                        <span className="text-[10px] text-muted-foreground">ex: Félicitations {"{pseudo}"} !</span>
                                                    </label>
                                                    <Input
                                                        placeholder="ex : Félicitations {pseudo} !"
                                                        value={embedTitle}
                                                        onChange={(e) => setEmbedTitle(e.target.value)}
                                                        onFocus={() => setLastActiveInput("embedTitle")}
                                                        className="text-xs h-8"
                                                    />
                                                </div>

                                                <div className="space-y-1">
                                                    <label className="font-semibold text-foreground text-[11px]">Description de l&apos;encadré</label>
                                                    <Textarea
                                                        placeholder="Texte mis en valeur dans l'encadré Discord..."
                                                        value={embedDescription}
                                                        onChange={(e) => setEmbedDescription(e.target.value)}
                                                        onFocus={() => setLastActiveInput("embedDesc")}
                                                        rows={3}
                                                        className="text-xs resize-y"
                                                    />
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="space-y-1">
                                                        <label className="font-semibold text-foreground text-[11px]">Couleur de la bordure</label>
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="color"
                                                                value={embedColor}
                                                                onChange={(e) => setEmbedColor(e.target.value)}
                                                                className="h-8 w-10 rounded border border-border cursor-pointer bg-transparent"
                                                            />
                                                            <div className="flex items-center gap-1">
                                                                {EMBED_PRESET_COLORS.map((c) => (
                                                                    <button
                                                                        key={c.value}
                                                                        type="button"
                                                                        onClick={() => setEmbedColor(c.value)}
                                                                        className="h-5 w-5 rounded-full border border-border"
                                                                        style={{ backgroundColor: c.value }}
                                                                        title={c.label}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1">
                                                        <label className="font-semibold text-foreground text-[11px]">Pied de page (Footer)</label>
                                                        <Input
                                                            placeholder="ex : {serveur} • Support"
                                                            value={embedFooter}
                                                            onChange={(e) => setEmbedFooter(e.target.value)}
                                                            className="text-xs h-8"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="space-y-1">
                                                        <label className="font-semibold text-foreground text-[11px]">Image principale (URL)</label>
                                                        <Input
                                                            placeholder="https://...image.png"
                                                            value={embedImageUrl}
                                                            onChange={(e) => setEmbedImageUrl(e.target.value)}
                                                            className="text-xs h-8"
                                                        />
                                                    </div>

                                                    <div className="space-y-1">
                                                        <label className="font-semibold text-foreground text-[11px]">Vignette / Miniature (URL)</label>
                                                        <Input
                                                            placeholder="https://...avatar.png"
                                                            value={embedThumbnailUrl}
                                                            onChange={(e) => setEmbedThumbnailUrl(e.target.value)}
                                                            className="text-xs h-8"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ========================================================= */}
                            {/* ÉTAPE 3 : ACTIONS SUR LES RÔLES & CLÔTURE */}
                            {/* ========================================================= */}
                            {activeModalTab === "actions" && (
                                <div className="space-y-4">
                                    {/* Guide vulgarisé Étape 3 */}
                                    <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-start gap-2.5">
                                        <Sliders className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                                        <div className="space-y-0.5">
                                            <div className="font-semibold text-foreground text-xs">Étape 3 : Automatiser les actions Discord</div>
                                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                                Dès que la commande est validée sur Discord, le robot peut attribuer ou retirer automatiquement des rôles au joueur ciblé, et même clore et archiver le ticket !
                                            </p>
                                        </div>
                                    </div>

                                    <div className="p-3.5 rounded-xl border border-border bg-surface/40 space-y-3">
                                        <div className="space-y-1.5">
                                            <label className="font-semibold text-foreground flex items-center gap-1.5">
                                                <UserPlus className="h-4 w-4 text-emerald-400" />
                                                Rôles à attribuer automatiquement au membre ciblé
                                            </label>
                                            <p className="text-[11px] text-muted-foreground">
                                                Ces rôles seront immédiatement donnés au joueur ciblé (ex: ajouter le rôle <strong>Membre</strong> lors d&apos;une validation de candidature).
                                            </p>
                                            <TicketRolesPicker
                                                guildId={guildId}
                                                value={addRoleIds}
                                                onChange={setAddRoleIds}
                                                description="Sélectionnez les rôles Discord à ajouter."
                                                title="Sélectionner les rôles à ajouter"
                                                emptyTitle="Aucun rôle à ajouter"
                                            />
                                        </div>

                                        <div className="space-y-1.5 border-t border-border/50 pt-3">
                                            <label className="font-semibold text-foreground flex items-center gap-1.5">
                                                <UserMinus className="h-4 w-4 text-red-400" />
                                                Rôles à retirer automatiquement au membre ciblé
                                            </label>
                                            <p className="text-[11px] text-muted-foreground">
                                                Ces rôles seront retirés du membre (ex: retirer le rôle <strong>Candidat</strong> une fois le joueur devenu Membre).
                                            </p>
                                            <TicketRolesPicker
                                                guildId={guildId}
                                                value={removeRoleIds}
                                                onChange={setRemoveRoleIds}
                                                description="Sélectionnez les rôles Discord à retirer."
                                                title="Sélectionner les rôles à retirer"
                                                emptyTitle="Aucun rôle à retirer"
                                            />
                                        </div>

                                        <div className="border-t border-border/50 pt-3">
                                            <label className="flex items-start gap-2.5 cursor-pointer p-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={autoCloseTicket}
                                                    onChange={(e) => setAutoCloseTicket(e.target.checked)}
                                                    className="mt-0.5 rounded border-border"
                                                />
                                                <div>
                                                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                                                        <Lock className="h-4 w-4 text-amber-400" />
                                                        Clôturer automatiquement le ticket après l&apos;exécution
                                                    </div>
                                                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                                                        Si activé, dès que la commande est lancée, le robot envoie le message puis déclenche la fermeture du ticket avec génération de l&apos;archive et transcription selon vos paramètres de guilde.
                                                    </div>
                                                    <div className="mt-1 text-[10px] text-amber-400 font-semibold">
                                                        🔒 Idéal pour les commandes de résolution finale comme /resoudre ou /refuser.
                                                    </div>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ========================================================= */}
                            {/* ÉTAPE 4 : QUI PEUT L'UTILISER ? */}
                            {/* ========================================================= */}
                            {activeModalTab === "permissions" && (
                                <div className="space-y-4">
                                    {/* Guide vulgarisé Étape 4 */}
                                    <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-start gap-2.5">
                                        <Shield className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                                        <div className="space-y-0.5">
                                            <div className="font-semibold text-foreground text-xs">Étape 4 : Définir qui a le droit d&apos;utiliser cette commande</div>
                                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                                Ces commandes ne fonctionnent <strong>jamais</strong> dans les salons publics de votre serveur : elles sont <strong>strictement restreintes</strong> aux salons de tickets ouverts. Choisissez qui peut les exécuter.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-2.5">
                                        {/* Option 1 : Staff Only */}
                                        <label
                                            className={`p-3.5 rounded-xl border cursor-pointer block transition-all ${
                                                permissionMode === "STAFF_ONLY"
                                                    ? "bg-emerald-500/10 border-emerald-500/40 text-foreground"
                                                    : "bg-surface/30 border-border text-muted-foreground hover:bg-surface/50"
                                            }`}
                                        >
                                            <div className="flex items-start gap-2.5">
                                                <input
                                                    type="radio"
                                                    name="permMode"
                                                    value="STAFF_ONLY"
                                                    checked={permissionMode === "STAFF_ONLY"}
                                                    onChange={() => setPermissionMode("STAFF_ONLY")}
                                                    className="mt-1"
                                                />
                                                <div>
                                                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                                                        <Shield className="h-4 w-4 text-emerald-400" />
                                                        Staff du ticket uniquement (Recommandé)
                                                    </div>
                                                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                                                        Seuls les administrateurs et les rôles configurés comme staff sur ce type de ticket peuvent exécuter la commande. Les membres normaux ne peuvent pas l&apos;utiliser.
                                                    </div>
                                                </div>
                                            </div>
                                        </label>

                                        {/* Option 2 : Rôles spécifiques */}
                                        <label
                                            className={`p-3.5 rounded-xl border cursor-pointer block transition-all ${
                                                permissionMode === "CUSTOM_ROLES"
                                                    ? "bg-emerald-500/10 border-emerald-500/40 text-foreground"
                                                    : "bg-surface/30 border-border text-muted-foreground hover:bg-surface/50"
                                            }`}
                                        >
                                            <div className="flex items-start gap-2.5">
                                                <input
                                                    type="radio"
                                                    name="permMode"
                                                    value="CUSTOM_ROLES"
                                                    checked={permissionMode === "CUSTOM_ROLES"}
                                                    onChange={() => setPermissionMode("CUSTOM_ROLES")}
                                                    className="mt-1"
                                                />
                                                <div className="flex-1">
                                                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                                                        <UsersIcon className="h-4 w-4 text-purple-400" />
                                                        Rôles Discord spécifiques
                                                    </div>
                                                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                                                        Vous sélectionnez précisément quels rôles Discord ont l&apos;autorisation d&apos;utiliser cette commande.
                                                    </div>

                                                    {permissionMode === "CUSTOM_ROLES" && (
                                                        <div className="mt-3 pt-3 border-t border-border/50">
                                                            <TicketRolesPicker
                                                                guildId={guildId}
                                                                value={allowedRoleIds}
                                                                onChange={setAllowedRoleIds}
                                                                description="Seuls les membres avec au moins un de ces rôles pourront taper la commande."
                                                                title="Sélectionner les rôles autorisés"
                                                                emptyTitle="Sélectionnez au moins un rôle"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </label>

                                        {/* Option 3 : Tous */}
                                        <label
                                            className={`p-3.5 rounded-xl border cursor-pointer block transition-all ${
                                                permissionMode === "ALL"
                                                    ? "bg-emerald-500/10 border-emerald-500/40 text-foreground"
                                                    : "bg-surface/30 border-border text-muted-foreground hover:bg-surface/50"
                                            }`}
                                        >
                                            <div className="flex items-start gap-2.5">
                                                <input
                                                    type="radio"
                                                    name="permMode"
                                                    value="ALL"
                                                    checked={permissionMode === "ALL"}
                                                    onChange={() => setPermissionMode("ALL")}
                                                    className="mt-1"
                                                />
                                                <div>
                                                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                                                        <Eye className="h-4 w-4 text-amber-400" />
                                                        Tous les participants du ticket
                                                    </div>
                                                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                                                        Le créateur du ticket et tous les participants du salon peuvent taper la commande. Parfait pour une commande informative comme <code className="font-mono text-foreground">/faq</code>, <code className="font-mono text-foreground">/aide</code> ou <code className="font-mono text-foreground">/reglement</code>.
                                                    </div>
                                                </div>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Volet Aperçu Discord réaliste */}
                        <div className="rounded-xl border border-border bg-[#313338] p-3.5 space-y-3 h-fit text-white">
                            <div className="text-[10px] font-bold text-[#949ba4] uppercase tracking-wider flex items-center justify-between">
                                <span>Aperçu Discord réaliste</span>
                                {ephemeral && <span className="text-[9px] text-amber-400">Éphémère</span>}
                            </div>

                            {/* En-tête message Discord */}
                            <div className="flex items-start gap-2.5">
                                <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-xs shrink-0 select-none">
                                    S
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 leading-none mb-1">
                                        <span className="font-bold text-xs text-white">SigilOS</span>
                                        <span className="bg-[#5865F2] text-white text-[9px] font-bold px-1 rounded select-none">APP</span>
                                        <span className="text-[10px] text-[#949ba4]">aujourd&apos;hui à 12:00</span>
                                    </div>

                                    {/* Texte Markdown avec rendu des mentions et canaux */}
                                    {renderedPreviewContent && (
                                        <div className="text-xs text-[#dbdee1] leading-relaxed break-words font-sans">
                                            <DiscordTextRenderer text={renderedPreviewContent} />
                                        </div>
                                    )}

                                    {/* Embed Discord */}
                                    {embedEnabled && (
                                        <div
                                            className="mt-2 rounded bg-[#2b2d31] p-3 text-xs border-l-4 space-y-2 max-w-full"
                                            style={{ borderLeftColor: embedColor }}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 space-y-1">
                                                    {renderedEmbedTitle && (
                                                        <div className="font-bold text-sm text-white">
                                                            {renderedEmbedTitle}
                                                        </div>
                                                    )}
                                                    {renderedEmbedDesc && (
                                                        <div className="text-[#dbdee1] text-xs">
                                                            <DiscordTextRenderer text={renderedEmbedDesc} />
                                                        </div>
                                                    )}
                                                </div>
                                                {embedThumbnailUrl && (
                                                    <img
                                                        src={embedThumbnailUrl}
                                                        alt="Thumbnail"
                                                        className="h-10 w-10 rounded object-cover shrink-0"
                                                        onError={(e) => ((e.target as HTMLElement).style.display = "none")}
                                                    />
                                                )}
                                            </div>

                                            {embedImageUrl && (
                                                <img
                                                    src={embedImageUrl}
                                                    alt="Embed"
                                                    className="rounded max-h-36 w-full object-cover"
                                                    onError={(e) => ((e.target as HTMLElement).style.display = "none")}
                                                />
                                            )}

                                            {renderedEmbedFooter && (
                                                <div className="text-[10px] text-[#949ba4] pt-1 border-t border-[#3f4147]">
                                                    {renderedEmbedFooter}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-border">
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                                Annuler
                            </Button>
                            {activeModalTab !== "general" && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        const idx = TAB_STEPS.indexOf(activeModalTab);
                                        if (idx > 0) setActiveModalTab(TAB_STEPS[idx - 1]);
                                    }}
                                    className="gap-1 text-xs"
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                    Étape précédente
                                </Button>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {activeModalTab !== "permissions" && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const idx = TAB_STEPS.indexOf(activeModalTab);
                                        if (idx < TAB_STEPS.length - 1) setActiveModalTab(TAB_STEPS[idx + 1]);
                                    }}
                                    className="gap-1 text-xs font-semibold"
                                >
                                    Étape suivante
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </Button>
                            )}
                            <Button
                                size="sm"
                                onClick={handleSave}
                                disabled={isPending}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                            >
                                {isPending ? "Enregistrement..." : "Enregistrer et synchroniser Discord"}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function UsersIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    );
}
