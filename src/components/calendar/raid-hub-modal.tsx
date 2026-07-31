"use client";

/**
 * RaidHubModal — Interface Hub Raid
 * Modale dédiée aux tips éditables pour les 2 types de raids.
 * Admin: édition complète + gestion des liens avec prévisualisation OG.
 * User: lecture seule avec vignettes cliquables.
 */

import { useState, useEffect, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
    getRaidHubConfig,
    updateRaidHubConfig,
    fetchLinkPreview,
    type RaidHubConfig,
    type RaidTipSection,
    type RaidTipLink,
} from "@/server/actions/raid-hub-actions";
import {
    Swords,
    Waves,
    Plus,
    Trash2,
    Edit3,
    Save,
    X,
    Link,
    ExternalLink,
    Loader2,
    BookOpen,
    ChevronRight,
    GripVertical,
    AlertCircle,
    RefreshCw,
    Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

// ============================================
// TYPES
// ============================================

interface RaidHubModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    guildId: string;
    isAdmin: boolean;
}

type RaidTab = "jardin" | "gigalodon";

// ============================================
// LINK PREVIEW CARD
// ============================================

function LinkPreviewCard({
    link,
    onRemove,
    isEditing,
}: {
    link: RaidTipLink;
    onRemove?: () => void;
    isEditing?: boolean;
}) {
    const domain = (() => {
        try {
            return new URL(link.url).hostname.replace("www.", "");
        } catch {
            return link.url;
        }
    })();

    return (
        <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
                if (isEditing) e.preventDefault();
            }}
            className={cn(
                "group relative flex items-stretch gap-3.5 p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 hover:border-amber-500/40 hover:bg-zinc-900/90 shadow-md transition-all duration-200 overflow-hidden",
                !isEditing && "cursor-pointer"
            )}
        >
            {/* Ambient hover glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/0 to-amber-500/5 group-hover:from-amber-500/5 transition-all pointer-events-none" />

            {/* Thumbnail */}
            {link.thumbnail ? (
                <div className="shrink-0 w-24 h-16 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800/80 relative">
                    <img
                        src={link.thumbnail}
                        alt={link.title ?? "Aperçu"}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                        }}
                    />
                </div>
            ) : (
                <div className="shrink-0 w-12 h-16 rounded-lg bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-center text-amber-500/60 group-hover:text-amber-400 transition-colors">
                    <Link className="h-5 w-5" />
                </div>
            )}

            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-black text-amber-400/90 uppercase tracking-widest bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                        {domain}
                    </span>
                </div>
                {link.title && (
                    <p className="text-xs font-bold text-zinc-100 group-hover:text-amber-200 leading-snug line-clamp-1 transition-colors">
                        {link.title}
                    </p>
                )}
                {link.description && (
                    <p className="text-[11px] text-zinc-400 leading-snug line-clamp-1 mt-0.5">
                        {link.description}
                    </p>
                )}
                {!link.title && (
                    <p className="text-xs text-zinc-400 truncate">{link.url}</p>
                )}
            </div>

            {/* Actions */}
            <div className="shrink-0 flex items-center gap-2 pl-2">
                {!isEditing && (
                    <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 group-hover:bg-amber-500 group-hover:text-zinc-950 text-zinc-400 transition-all shadow-sm">
                        <ExternalLink className="h-3.5 w-3.5" />
                    </div>
                )}
                {isEditing && onRemove && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onRemove();
                        }}
                        className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all"
                        title="Supprimer le lien"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>
        </a>
    );
}

// ============================================
// ADD LINK FORM
// ============================================

function AddLinkForm({
    onAdd,
    onCancel,
}: {
    onAdd: (link: RaidTipLink) => void;
    onCancel: () => void;
}) {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState<RaidTipLink | null>(null);

    const handleFetchPreview = async () => {
        if (!url.trim()) return;
        setLoading(true);
        setPreview(null);
        const result = await fetchLinkPreview(url.trim());
        if (result.success) {
            setPreview({
                url: url.trim(),
                title: result.title,
                description: result.description,
                thumbnail: result.thumbnail,
            });
        } else {
            setPreview({ url: url.trim() });
            toast.warning("Prévisualisation indisponible — lien ajouté sans vignette");
        }
        setLoading(false);
    };

    const handleAdd = () => {
        if (preview) {
            onAdd(preview);
        } else if (url.trim()) {
            onAdd({ url: url.trim() });
        }
    };

    return (
        <div className="space-y-3 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 backdrop-blur-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                <Link className="h-3.5 w-3.5" /> Ajouter un lien externe
            </p>

            {/* URL Input */}
            <div className="flex gap-2">
                <input
                    type="url"
                    value={url}
                    onChange={(e) => { setUrl(e.target.value); setPreview(null); }}
                    onKeyDown={(e) => e.key === "Enter" && handleFetchPreview()}
                    placeholder="https://www.dofuspourlesnoobs.com/..."
                    className="flex-1 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-700/80 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
                <button
                    type="button"
                    onClick={handleFetchPreview}
                    disabled={!url.trim() || loading}
                    className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white disabled:opacity-40 transition-all flex items-center gap-1.5 text-xs font-bold shrink-0 border border-zinc-700"
                >
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5 text-amber-400" />}
                    Aperçu
                </button>
            </div>

            {/* Preview */}
            {preview && (
                <LinkPreviewCard link={preview} />
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-1">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                    Annuler
                </button>
                <button
                    type="button"
                    onClick={handleAdd}
                    disabled={!url.trim() && !preview}
                    className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs disabled:opacity-40 transition-all shadow-md"
                >
                    Ajouter le lien
                </button>
            </div>
        </div>
    );
}

// ============================================
// TIP SECTION EDITOR
// ============================================

function TipSectionEditor({
    section,
    index,
    isAdmin,
    onUpdate,
    onDelete,
}: {
    section: RaidTipSection;
    index: number;
    isAdmin: boolean;
    onUpdate: (section: RaidTipSection) => void;
    onDelete: () => void;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(section.content);
    const [showAddLink, setShowAddLink] = useState(false);

    const handleSave = () => {
        onUpdate({ ...section, content: editContent });
        setIsEditing(false);
    };

    const handleAddLink = (link: RaidTipLink) => {
        onUpdate({ ...section, links: [...section.links, link] });
        setShowAddLink(false);
    };

    const handleRemoveLink = (idx: number) => {
        onUpdate({
            ...section,
            links: section.links.filter((_, i) => i !== idx),
        });
    };

    return (
        <div className="group/card relative rounded-2xl border border-zinc-800/90 bg-gradient-to-b from-zinc-900/60 to-zinc-950/80 backdrop-blur-md shadow-lg overflow-hidden transition-all duration-200 hover:border-zinc-700/80">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/70 border-b border-zinc-800/80">
                <div className="flex items-center gap-2">
                    <span className="h-5 px-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest flex items-center">
                        Conseil #{index + 1}
                    </span>
                </div>
                {isAdmin && (
                    <div className="flex items-center gap-1">
                        {!isEditing ? (
                            <button
                                type="button"
                                onClick={() => { setIsEditing(true); setEditContent(section.content); }}
                                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-all"
                                title="Modifier ce conseil"
                            >
                                <Edit3 className="h-3.5 w-3.5" />
                            </button>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all flex items-center gap-1 text-xs font-bold px-2"
                                    title="Sauvegarder"
                                >
                                    <Save className="h-3.5 w-3.5" /> OK
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(false)}
                                    className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all"
                                    title="Annuler"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </>
                        )}
                        <button
                            type="button"
                            onClick={onDelete}
                            className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400/70 hover:text-red-400 transition-all"
                            title="Supprimer ce conseil"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
                {isEditing ? (
                    <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={4}
                        placeholder="Ex: Lumière 0–4 : baisse toutes les 2 min, remonte avec Sel aux machines..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 resize-none transition-colors"
                    />
                ) : (
                    section.content ? (
                        <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap font-medium">
                            {section.content}
                        </p>
                    ) : (
                        <p className="text-sm text-zinc-600 italic">Aucun texte pour ce conseil — cliquez sur modifier pour remplir</p>
                    )
                )}

                {/* Links */}
                {section.links.length > 0 && (
                    <div className="space-y-2 pt-1">
                        {section.links.map((link, idx) => (
                            <LinkPreviewCard
                                key={idx}
                                link={link}
                                isEditing={isAdmin}
                                onRemove={isAdmin ? () => handleRemoveLink(idx) : undefined}
                            />
                        ))}
                    </div>
                )}

                {/* Add link */}
                {isAdmin && !showAddLink && (
                    <button
                        type="button"
                        onClick={() => setShowAddLink(true)}
                        className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-zinc-800 hover:border-amber-500/40 bg-zinc-950/40 hover:bg-amber-500/5 text-zinc-500 hover:text-amber-400 text-xs font-bold w-full transition-all group"
                    >
                        <Plus className="h-3.5 w-3.5 group-hover:text-amber-400" />
                        Ajouter une ressource ou un lien de guide
                    </button>
                )}

                {isAdmin && showAddLink && (
                    <AddLinkForm
                        onAdd={handleAddLink}
                        onCancel={() => setShowAddLink(false)}
                    />
                )}
            </div>
        </div>
    );
}

// ============================================
// RAID TAB PANEL
// ============================================

function RaidTabPanel({
    raidType,
    tips,
    description,
    isAdmin,
    onUpdateTips,
    onUpdateDescription,
}: {
    raidType: RaidTab;
    tips: RaidTipSection[];
    description?: string;
    isAdmin: boolean;
    onUpdateTips: (tips: RaidTipSection[]) => void;
    onUpdateDescription: (desc: string) => void;
}) {
    const [editingDesc, setEditingDesc] = useState(false);
    const [editDesc, setEditDesc] = useState(description ?? "");

    const config = raidType === "jardin"
        ? {
            name: "Sanctuaire des Jardins Éternels",
            subtitle: "Raid officiel",
            color: "text-red-400",
            border: "border-red-500/20",
            bg: "bg-red-500/5",
            badge: "RAID_OFFICIAL",
        }
        : {
            name: "Gigalodon",
            subtitle: "Raid officiel",
            color: "text-cyan-400",
            border: "border-cyan-500/20",
            bg: "bg-cyan-500/5",
            badge: "RAID_OFFICIAL",
        };

    const handleAddSection = () => {
        const newSection: RaidTipSection = {
            id: `tip-${Date.now()}`,
            content: "",
            links: [],
        };
        onUpdateTips([...tips, newSection]);
    };

    const handleUpdateSection = (idx: number, section: RaidTipSection) => {
        const updated = [...tips];
        updated[idx] = section;
        onUpdateTips(updated);
    };

    const handleDeleteSection = (idx: number) => {
        onUpdateTips(tips.filter((_, i) => i !== idx));
    };

    return (
        <div className="space-y-6">
            {/* Raid Banner Image */}
            <div className="relative h-44 rounded-2xl overflow-hidden border border-zinc-800 shadow-md">
                <Image
                    src={raidType === "jardin" ? "/assets/raids/sanctuaire.webp" : "/assets/raids/gigalodon.webp"}
                    alt={config.name}
                    fill
                    className="object-cover opacity-90"
                    priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tighter text-white drop-shadow-sm">
                            {config.name}
                        </h3>
                        <p className="text-xs text-zinc-300 font-bold drop-shadow-sm">{config.subtitle}</p>
                    </div>
                    <Badge className="bg-black/60 text-zinc-300 border border-zinc-800 text-[10px] font-black uppercase px-2 py-0.5 backdrop-blur-sm">
                        {config.badge}
                    </Badge>
                </div>
            </div>

            {/* Description */}
            <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-4">
                {editingDesc ? (
                    <div className="space-y-2">
                        <textarea
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            rows={3}
                            placeholder="Description générale de ce raid..."
                            className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 resize-none"
                        />
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setEditingDesc(false)} className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1">Annuler</button>
                            <button
                                onClick={() => { onUpdateDescription(editDesc); setEditingDesc(false); }}
                                className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-xs font-bold"
                            >
                                Sauvegarder
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-start gap-2 group">
                        <p className={cn("text-sm flex-1 leading-relaxed", description ? "text-zinc-300" : "text-zinc-600 italic")}>
                            {description || "Aucune description générale. Cliquez sur modifier pour en ajouter une."}
                        </p>
                        {isAdmin && (
                            <button
                                onClick={() => { setEditDesc(description ?? ""); setEditingDesc(true); }}
                                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-all shrink-0"
                            >
                                <Edit3 className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Tips */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-zinc-500" />
                        <span className="text-sm font-black uppercase tracking-widest text-zinc-500">
                            Conseils & Stratégies
                        </span>
                        <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700 text-[10px] font-black">
                            {tips.length}
                        </Badge>
                    </div>
                    {isAdmin && (
                        <button
                            onClick={handleAddSection}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-zinc-400 hover:text-zinc-200 text-xs font-bold transition-all"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Ajouter un conseil
                        </button>
                    )}
                </div>

                {tips.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 rounded-2xl border-2 border-dashed border-zinc-800 text-center">
                        <BookOpen className="h-8 w-8 text-zinc-700 mb-3" />
                        <p className="text-zinc-600 text-sm font-bold">Aucun conseil pour ce raid</p>
                        {isAdmin && (
                            <button
                                onClick={handleAddSection}
                                className="mt-3 px-4 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/20 transition-all"
                            >
                                Ajouter le premier conseil
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {tips.map((section, idx) => (
                            <TipSectionEditor
                                key={section.id}
                                section={section}
                                index={idx}
                                isAdmin={isAdmin}
                                onUpdate={(updated) => handleUpdateSection(idx, updated)}
                                onDelete={() => handleDeleteSection(idx)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================
// MAIN MODAL
// ============================================

export function RaidHubModal({ open, onOpenChange, guildId, isAdmin }: RaidHubModalProps) {
    const [activeTab, setActiveTab] = useState<RaidTab>("jardin");
    const [config, setConfig] = useState<RaidHubConfig>({
        jardinTips: [],
        gigalodonTips: [],
        jardinDescription: "",
        gigalodonDescription: "",
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const loadConfig = useCallback(async () => {
        setLoading(true);
        const result = await getRaidHubConfig(guildId);
        if (result.success && result.config) {
            setConfig(result.config);
        } else {
            toast.error(result.error ?? "Erreur de chargement");
        }
        setLoading(false);
    }, [guildId]);

    useEffect(() => {
        if (open) {
            loadConfig();
            setHasChanges(false);
        }
    }, [open, loadConfig]);

    const handleSave = async () => {
        setSaving(true);
        const result = await updateRaidHubConfig(guildId, config);
        if (result.success) {
            toast.success("Hub Raid sauvegardé !");
            setHasChanges(false);
        } else {
            toast.error(result.error ?? "Erreur de sauvegarde");
        }
        setSaving(false);
    };

    const updateConfig = (updates: Partial<RaidHubConfig>) => {
        setConfig((prev) => ({ ...prev, ...updates }));
        setHasChanges(true);
    };

    const TABS: { id: RaidTab; label: string; icon: any; color: string; activeBg: string; activeBorder: string }[] = [
        {
            id: "jardin",
            label: "Jardins",
            icon: Swords,
            color: "text-red-400",
            activeBg: "bg-red-500/10",
            activeBorder: "border-red-500/40",
        },
        {
            id: "gigalodon",
            label: "Gigalodon",
            icon: Waves,
            color: "text-cyan-400",
            activeBg: "bg-cyan-500/10",
            activeBorder: "border-cyan-500/40",
        },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-zinc-950/98 border border-white/10 ring-1 ring-red-500/20 shadow-[0_0_60px_rgba(239,68,68,0.15)] p-0">
                {/* Header */}
                <div className="relative overflow-hidden px-6 pt-6 pb-4 border-b border-zinc-800/80 shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-transparent to-cyan-500/5 pointer-events-none" />
                    <div className="relative flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-cyan-500/20 rounded-xl blur-lg" />
                                <div className="relative h-12 w-12 rounded-xl bg-gradient-to-br from-red-500/10 to-cyan-500/10 flex items-center justify-center border border-white/10">
                                    <Swords className="h-6 w-6 text-red-400" />
                                </div>
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black uppercase italic tracking-tighter text-zinc-100">
                                    Hub Raid
                                </DialogTitle>
                                <DialogDescription className="text-zinc-500 font-bold text-xs mt-0.5">
                                    Guides & conseils pour les raids de guilde
                                </DialogDescription>
                            </div>
                        </div>

                        {/* Save button is in the footer (single CTA) */}
                        {isAdmin && hasChanges && (
                            <div className="h-10" />
                        )}
                    </div>

                    {/* Unsaved changes warning */}
                    {isAdmin && hasChanges && !saving && (
                        <div className="relative flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                            <p className="text-xs text-amber-400 font-bold">Modifications non sauvegardées</p>
                        </div>
                    )}
                </div>

                {/* Tab Switcher */}
                <div className="flex gap-2 px-6 pt-4 shrink-0">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider border transition-all",
                                    isActive
                                        ? cn(tab.activeBg, tab.color, tab.activeBorder, "shadow-md")
                                        : "bg-zinc-900/50 text-zinc-500 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300"
                                )}
                            >
                                <Icon className={cn("h-4 w-4", isActive ? tab.color : "")} />
                                {tab.label}
                                <ChevronRight className={cn(
                                    "h-3 w-3 transition-transform",
                                    isActive ? "rotate-90 opacity-100" : "opacity-0"
                                )} />
                            </button>
                        );
                    })}

                    {/* Reload */}
                    <button
                        onClick={loadConfig}
                        disabled={loading}
                        className="ml-auto p-2 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-zinc-300 transition-all"
                        title="Rafraîchir"
                    >
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <div className="relative">
                                <div className="h-14 w-14 rounded-full bg-red-500/10 flex items-center justify-center animate-pulse">
                                    <Swords className="h-7 w-7 text-red-500/50" />
                                </div>
                                <Loader2 className="absolute -top-1 -right-1 h-5 w-5 text-red-400 animate-spin" />
                            </div>
                            <p className="text-zinc-500 text-sm">Chargement du Hub Raid...</p>
                        </div>
                    ) : activeTab === "jardin" ? (
                        <RaidTabPanel
                            raidType="jardin"
                            tips={config.jardinTips}
                            description={config.jardinDescription}
                            isAdmin={isAdmin}
                            onUpdateTips={(tips) => updateConfig({ jardinTips: tips })}
                            onUpdateDescription={(desc) => updateConfig({ jardinDescription: desc })}
                        />
                    ) : (
                        <RaidTabPanel
                            raidType="gigalodon"
                            tips={config.gigalodonTips}
                            description={config.gigalodonDescription}
                            isAdmin={isAdmin}
                            onUpdateTips={(tips) => updateConfig({ gigalodonTips: tips })}
                            onUpdateDescription={(desc) => updateConfig({ gigalodonDescription: desc })}
                        />
                    )}
                </div>

                {/* Footer */}
                {isAdmin && (
                    <div className="px-6 py-4 border-t border-zinc-800/80 shrink-0 flex items-center justify-between">
                        <p className="text-xs text-zinc-600 font-bold">
                            {isAdmin ? "Mode édition — visible par tous les membres" : "Vue lecture seule"}
                        </p>
                        {hasChanges && (
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 font-bold text-sm transition-all hover:scale-105 disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Sauvegarder les modifications
                            </button>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
