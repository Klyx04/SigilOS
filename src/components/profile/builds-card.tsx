"use client";

import { useState } from "react";
import { Link2, Trash2, Pencil, Plus, RefreshCw, Copy, Megaphone, Calendar } from "lucide-react";
import NextImage from "next/image";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateDofusBookLinks } from "@/server/actions/profile-actions";
import { shareGalleryItemOnDiscord } from "@/server/actions/gallery-actions";
import { DofusbookPreview } from "@/components/dofus/dofusbook-preview";
import { AddBuildModal } from "@/components/profile/add-build-modal";
import { DO_TAGS } from "@/lib/dofus-tags";
import type { BUILD_TAG_TYPE } from "@/lib/dofus-tags";

export type DofusBookLink = {
    id: string;
    url: string;
    name: string;
    tags?: string[];
    classId?: number;
    source?: "dofusbook"; // Source of the build
    previewData?: any; // Cached build info
    createdAt?: string | null;
    updatedAt?: string | null;
};

const DOFUS_CLASSES = [
    { id: 1, name: "Féca" }, { id: 2, name: "Osamodas" }, { id: 3, name: "Enutrof" },
    { id: 4, name: "Sram" }, { id: 5, name: "Xélor" }, { id: 6, name: "Écaflip" },
    { id: 7, name: "Éniripsa" }, { id: 8, name: "Iop" }, { id: 9, name: "Crâ" },
    { id: 10, name: "Sadida" }, { id: 11, name: "Sacrieur" }, { id: 12, name: "Pandawa" },
    { id: 13, name: "Roublard" }, { id: 14, name: "Zobal" }, { id: 15, name: "Steamer" },
    { id: 16, name: "Éliotrope" }, { id: 17, name: "Huppermage" }, { id: 18, name: "Ouginak" },
    { id: 19, name: "Forgelance" }
];

const ClassSelector = ({ 
    selectedId, 
    onSelect, 
    classes 
}: { 
    selectedId: number | null, 
    onSelect: (id: number) => void,
    classes: { id: number, name: string }[]
}) => {
    const [hoveredClassId, setHoveredClassId] = useState<number | null>(null);
    const activeClass = classes.find(c => c.id === (hoveredClassId || selectedId));

    return (
        <div className="flex flex-col gap-3">
            <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
                {classes.map((cls) => {
                    const colors: Record<number, string> = {
                        1: "#8b5cf6", 2: "#f59e0b", 3: "#10b981", 4: "#6366f1", 5: "#3b82f6",
                        6: "#ef4444", 7: "#ec4899", 8: "#f97316", 9: "#84cc16", 10: "#059669",
                        11: "#dc2626", 12: "#4ade80", 13: "#7c3aed", 14: "#1e40af", 15: "#0ea5e9",
                        16: "#2563eb", 17: "#9333ea", 18: "#ea580c", 19: "#06b6d4"
                    };
                    const color = colors[cls.id] || "#10b981";
                    const isSelected = selectedId === cls.id;

                    return (
                        <button
                            key={cls.id}
                            type="button"
                            onClick={() => onSelect(cls.id)}
                            onMouseEnter={() => setHoveredClassId(cls.id)}
                            onMouseLeave={() => setHoveredClassId(null)}
                            className={cn(
                                "relative aspect-square rounded-xl border transition-all duration-300 flex items-center justify-center group overflow-hidden",
                                isSelected 
                                    ? "border-white/40 shadow-xl scale-105" 
                                    : "bg-zinc-900/50 border-white/5 hover:border-white/20 hover:scale-105"
                            )}
                            style={{ 
                                backgroundColor: isSelected ? `${color}22` : undefined,
                                boxShadow: isSelected ? `0 0 20px ${color}33` : undefined
                            }}
                        >
                            {/* Background Glow on Selection */}
                            {isSelected && (
                                <div className="absolute inset-0 opacity-40 blur-xl pointer-events-none" style={{ backgroundColor: color }} />
                            )}

                            <div className={cn(
                                "relative w-7 h-7 sm:w-9 sm:h-9 transition-all duration-500 z-10",
                                isSelected ? "scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]" : "grayscale opacity-30 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-110"
                            )}>
                                <NextImage
                                    src={`/assets/dofus/classes/${cls.id === 19 ? 20 : cls.id}.png`}
                                    alt={cls.name}
                                    fill
                                    className="object-contain"
                                />
                            </div>
                        </button>
                    );
                })}
            </div>
            
            {/* Dynamic Class Name Preview */}
            <div className="flex items-center justify-center h-6">
                {activeClass ? (
                    <span className="text-xs font-bold px-3 py-1 bg-white/10 rounded-full text-white tracking-wide shadow-inner animate-in fade-in zoom-in duration-200">
                        {activeClass.name}
                    </span>
                ) : (
                    <span className="text-xs font-medium text-zinc-600 italic">
                        Survolez pour voir la nom de la classe
                    </span>
                )}
            </div>
        </div>
    );
};

interface BuildsCardProps {
    links: DofusBookLink[];
    onSave: (links: DofusBookLink[]) => void;
    readOnly?: boolean;
    guildId: string;
    targetUserId?: string;
}

export function BuildsCard({ links = [], onSave, readOnly = false, guildId, targetUserId }: BuildsCardProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingLink, setEditingLink] = useState<DofusBookLink | null>(null);
    const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);



    const handleEditLink = async () => {
        if (!editingLink) return;
        if (!editingLink.name.trim() || !editingLink.url.trim()) {
            toast.error("Veuillez remplir tous les champs");
            return;
        }
        const dofusbookPattern = /^https:\/\/(www\.)?(d-bk\.net|dofusbook\.net)\/(fr|en|es|pt|de)\/(?:private\/)?[a-zA-Z0-9-_\/]+$/;
        if (!dofusbookPattern.test(editingLink.url.trim())) {
            toast.error("Format de lien invalide (DofusBook requis)");
            return;
        }
        setIsSubmitting(true);

        const updatedLinks = links.map(l =>
            l.id === editingLink.id ? editingLink : l
        );
        try {
            const result = await updateDofusBookLinks({
                guildId,
                links: updatedLinks,
                targetUserId
            });
            if (result.success) {
                onSave(updatedLinks);
                setEditingLink(null);
                toast.success("Build mis à jour");
            } else {
                toast.error(result.error || "Erreur lors de la mise à jour");
            }
        } catch (error) {
            toast.error("Erreur serveur");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteLink = async (id: string) => {
        if (readOnly) return;
        const updatedLinks = links.filter(l => l.id !== id);

        // Optimistic update
        onSave(updatedLinks);

        const result = await updateDofusBookLinks({ guildId, links: updatedLinks, targetUserId });
        if (!result.success) {
            toast.error("Erreur lors de la suppression");
            // Revert (not easily done without local state refetch, but acceptable for now)
        } else {
            toast.success("Build supprimé");
        }
    };

    const handleForceBake = async (link: DofusBookLink) => {
        setIsSubmitting(true);
        toast.info(`Synchronisation en cours...`);
        
        // Clear previewData to force re-fetch on next server bake
        const updatedLinks = links.map(l => l.id === link.id ? { ...l, previewData: null } : l);
        
        try {
            const result = await updateDofusBookLinks({ guildId, links: updatedLinks, targetUserId });
            if (result.success) {
                onSave(updatedLinks); 
                // Check if the build actually got baked (previewData will be set by server if successful)
                toast.success("Synchronisation effectuée");
            } else {
                toast.error(result.error || "Échec de la synchronisation");
            }
        } catch {
            toast.error("Erreur serveur");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCopyLink = (url: string) => {
        navigator.clipboard.writeText(url);
        toast.success("Lien copié !");
    };

    if (readOnly && links.length === 0) return null;

    const filteredLinks = selectedTagFilter
        ? links.filter(l => l.tags?.includes(selectedTagFilter))
        : links;

    return (
        <div className="p-6 bg-zinc-900/40 backdrop-blur-md rounded-2xl border border-white/10 transition-all hover:border-white/20 group h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Link2 className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-base font-semibold text-zinc-200">Mes Builds</h3>
                    {!readOnly && (
                        <span className="text-xs text-zinc-500 bg-zinc-950/50 px-2 py-0.5 rounded border border-white/5">
                            {links.length}/20
                        </span>
                    )}
                </div>

                {!readOnly && links.length < 20 && (
                    <AddBuildModal
                        guildId={guildId}
                        links={links}
                        onSave={onSave}
                        targetUserId={targetUserId}
                    />
                )}
            </div>

            {/* Tag Filter UI Premium */}
            {links.length > 0 && (
                <div className="bg-zinc-950/80 backdrop-blur-2xl border border-white/10 rounded-[1.5rem] px-5 py-4 shadow-2xl flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
                    {/* Left: Filters */}
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* 1. Primary Elements */}
                        <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-2xl border border-white/5 flex-wrap">
                            <button
                                onClick={() => setSelectedTagFilter(null)}
                                className={cn(
                                    "h-8 px-4 rounded-xl text-[11px] font-black transition-all shrink-0",
                                    !selectedTagFilter ? "bg-white text-black shadow-md" : "text-zinc-500 hover:text-white hover:bg-white/10"
                                )}
                            >
                                Tous
                            </button>

                            {["eau","feu","terre","air","multi"].map(id => {
                                const tag = DO_TAGS.find(t => t.id === id)!;
                                const hasTag = links.some(l => l.tags?.includes(id));
                                if (!hasTag) return null;

                                return (
                                    <button
                                        key={id}
                                        onClick={() => setSelectedTagFilter(selectedTagFilter === id ? null : id)}
                                        className={cn(
                                            "h-8 px-3 rounded-xl text-[11px] font-bold transition-all shrink-0",
                                            selectedTagFilter === id ? `${tag.className} shadow-lg ring-1 ring-white/20` : "text-zinc-500 hover:text-white hover:bg-white/10"
                                        )}
                                    >
                                        {tag.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* 2. Advanced / Specialities (only if user has links with these) */}
                        {links.some(l => l.tags?.some(tagId => !["eau","feu","terre","air","multi"].includes(tagId))) && (
                            <>
                                <div className="w-px h-6 bg-white/10 shrink-0 hidden sm:block" />
                                <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-2xl border border-white/5 flex-wrap">
                                    {DO_TAGS.filter(t => !["eau","feu","terre","air","multi"].includes(t.id)).map(tag => {
                                        const hasTag = links.some(l => l.tags?.includes(tag.id));
                                        if (!hasTag) return null;

                                        return (
                                            <button
                                                key={tag.id}
                                                onClick={() => setSelectedTagFilter(selectedTagFilter === tag.id ? null : tag.id)}
                                                className={cn(
                                                    "h-8 px-3 rounded-xl text-[11px] font-bold transition-all shrink-0",
                                                    selectedTagFilter === tag.id ? `${tag.className} shadow-lg ring-1 ring-white/20` : "text-zinc-500 hover:text-white hover:bg-white/10"
                                                )}
                                            >
                                                {tag.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Right: Count */}
                    <div className="flex items-center gap-4 shrink-0 bg-black/40 px-4 py-2 rounded-2xl border border-white/5">
                        <p className="text-[11px] text-zinc-500 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500/50 animate-pulse" />
                            <span className="text-white font-black">{filteredLinks.length}</span>
                            <span> sur {links.length} build{links.length !== 1 ? "s" : ""}</span>
                        </p>
                    </div>
                </div>
            )}

            {/* List or Grid */}
            <div className={cn(
                "grid gap-6 w-full",
                filteredLinks.length > 0 ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"
            )}>
                {filteredLinks.length > 0 ? (
                    filteredLinks.map(link => (
                        <div key={link.id} className="relative group/card h-full flex flex-col justify-between gap-2">
                            <DofusbookPreview url={link.url} title={link.name} tags={link.tags} classId={link.classId} initialData={(link as any).previewData} />

                            {/* Upload / Update Date Bar (Gallery parity) */}
                            <div className="flex items-center justify-between px-2 pt-1 text-[11px] text-zinc-500 border-t border-white/5">
                                <div className="flex items-center gap-1.5">
                                    <Calendar className="w-3 h-3 text-zinc-500" />
                                    {link.createdAt ? (
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className="text-[10px] text-zinc-400 font-medium cursor-default">
                                                        {new Date(link.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="bg-zinc-900 border-zinc-700 text-[10px] text-zinc-300">
                                                    <p>Ajouté le {new Date(link.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
                                                    {link.updatedAt && link.updatedAt !== link.createdAt && (
                                                        <p className="text-zinc-400 mt-0.5">Mis à jour le {new Date(link.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
                                                    )}
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    ) : (
                                        <span className="text-[10px] text-zinc-500 italic">Importé</span>
                                    )}
                                </div>

                                {link.updatedAt && link.updatedAt !== link.createdAt && (
                                    <span className="text-[9px] text-emerald-400/90 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                        MAJ {new Date(link.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                                    </span>
                                )}
                            </div>

                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-30 opacity-0 group-hover/card:opacity-100 translate-y-2 group-hover/card:translate-y-0 transition-all duration-300 pointer-events-none">
                                <div className="flex items-center gap-1.5 bg-zinc-950/95 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] pointer-events-auto shrink-0 w-max">
                                    <button
                                        onClick={() => handleCopyLink(link.url)}
                                        className="p-2 bg-zinc-900/80 hover:bg-emerald-500 text-zinc-400 hover:text-white rounded-xl border border-white/5 hover:border-white/10 shadow-lg transition-all"
                                        title="Copier le lien"
                                    >
                                        <Copy className="w-3.5 h-3.5" />
                                    </button>
                                    {!readOnly && (
                                        <button
                                            onClick={async () => {
                                                const res = await shareGalleryItemOnDiscord(guildId, link.id, "STUFF", undefined /*targetUserId || "unknown"*/);
                                                if (res.success) toast.success("Partagé sur Discord !");
                                                else toast.error(res.error || "Erreur lors du partage");
                                            }}
                                            className="p-2 bg-zinc-900/80 hover:bg-indigo-500 text-indigo-400 hover:text-white rounded-xl border border-white/5 hover:border-white/10 shadow-lg transition-all"
                                            title="Partager sur Discord"
                                        >
                                            <Megaphone className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    {!readOnly && (
                                        <>
                                            <button
                                                onClick={() => handleForceBake(link)}
                                                disabled={isSubmitting}
                                                className="p-2 bg-zinc-900/80 hover:bg-emerald-500 text-zinc-400 hover:text-white rounded-xl border border-white/5 hover:border-white/10 shadow-lg transition-all disabled:opacity-50"
                                                title="Récupérer les données (Baking)"
                                            >
                                                <RefreshCw className={cn("w-3.5 h-3.5", isSubmitting && "animate-spin")} />
                                            </button>
                                            <button
                                                onClick={() => setEditingLink({ ...link })}
                                                className="p-2 bg-zinc-900/80 hover:bg-indigo-500 text-white/50 hover:text-white rounded-xl border border-white/5 hover:border-white/10 shadow-lg transition-all"
                                                title="Modifier ce build"
                                            >
                                                <Pencil className="w-3.5 h-3.5" strokeWidth={2.5} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteLink(link.id)}
                                                className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl border border-red-500/20 shadow-lg transition-all"
                                                title="Supprimer ce build"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full text-center py-16 bg-zinc-950/40 rounded-[2rem] border-2 border-dashed border-white/5 flex flex-col items-center justify-center gap-6 relative overflow-hidden group/empty">
                        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent opacity-0 group-hover/empty:opacity-100 transition-all duration-700" />
                        
                        <div className="relative">
                            <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 rotate-3 group-hover/empty:rotate-6 transition-all duration-500 shadow-2xl">
                                <Link2 className="w-10 h-10 text-emerald-400 group-hover/empty:scale-110 transition-all" />
                            </div>
                            <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center animate-bounce shadow-xl">
                                <Plus className="w-4 h-4 text-emerald-400" />
                            </div>
                        </div>

                        <div className="space-y-2 relative px-6">
                            <h4 className="text-white font-black uppercase tracking-widest text-sm">Aucun build importé</h4>
                            <p className="text-zinc-500 text-xs leading-relaxed max-w-sm mx-auto font-medium">
                                Importez vos stuffs depuis <span className="text-emerald-400 font-bold">DofusBook</span> pour que les membres puissent s'en inspirer.
                                <br />
                                <span className="text-zinc-600 italic">C'est ici que vous lorgnez le stuff des autres !</span>
                            </p>
                        </div>

                        {!readOnly && (
                            <AddBuildModal
                                guildId={guildId}
                                links={links}
                                onSave={onSave}
                                targetUserId={targetUserId}
                                trigger={
                                    <Button variant="sigil-emerald" size="xl" className="h-14">
                                        <Plus className="w-5 h-5 mr-3" />
                                        Importer mon premier stuff
                                    </Button>
                                }
                            />
                        )}
                    </div>
                )}
            </div>

            {/* Edit Dialog */}
            <Dialog open={!!editingLink} onOpenChange={(open) => !open && setEditingLink(null)}>
                <DialogContent className="bg-zinc-950 border-white/10 text-zinc-200 sm:max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Modifier le Build</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Modifiez le nom ou le lien de votre build.
                        </DialogDescription>
                    </DialogHeader>
                    {editingLink && (
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="edit-name">Nom du build (Max 30)</Label>
                                <Input
                                    id="edit-name"
                                    maxLength={30}
                                    value={editingLink.name}
                                    onChange={(e) => setEditingLink(prev => prev ? { ...prev, name: e.target.value } : null)}
                                    className="bg-zinc-900 border-white/10"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-url">Lien du Build DofusBook</Label>
                                <Input
                                    id="edit-url"
                                    value={editingLink.url}
                                    onChange={(e) => setEditingLink(prev => prev ? { ...prev, url: e.target.value } : null)}
                                    className="bg-zinc-900 border-white/10 font-mono text-xs"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Tags (Optionnel, max 3)</Label>
                                <div className="flex flex-wrap gap-2">
                                    {DO_TAGS.map(tag => {
                                        const tagsArray = editingLink.tags || [];
                                        const isSelected = tagsArray.includes(tag.id);
                                        return (
                                            <button
                                                key={tag.id}
                                                type="button"
                                                onClick={() => {
                                                    setEditingLink(prev => {
                                                        if (!prev) return prev;
                                                        const curTags = prev.tags || [];
                                                        if (isSelected) {
                                                            return { ...prev, tags: curTags.filter((t: string) => t !== tag.id) };
                                                        } else if (curTags.length < 3) {
                                                            return { ...prev, tags: [...curTags, tag.id] };
                                                        }
                                                        return prev;
                                                    });
                                                }}
                                                className={cn(
                                                    "px-2.5 py-1 text-[10px] sm:text-xs rounded-full transition-all border font-medium select-none",
                                                    isSelected
                                                        ? tag.className
                                                        : "bg-zinc-900 border-white/5 text-zinc-500 hover:border-white/20 hover:text-zinc-300 opacity-60 hover:opacity-100"
                                                )}
                                            >
                                                {tag.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label>Icône de classe (Recommandé)</Label>
                                <ClassSelector 
                                    selectedId={editingLink.classId || null} 
                                    onSelect={(id) => setEditingLink(prev => prev ? { ...prev, classId: id } : null)} 
                                    classes={DOFUS_CLASSES} 
                                />
                                <p className="text-[10px] text-zinc-500">
                                    Sélectionnez la classe pour assurer une belle preview.
                                </p>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setEditingLink(null)}>Annuler</Button>
                        <Button onClick={handleEditLink} disabled={isSubmitting} variant="sigil" className="h-10 px-6">
                            {isSubmitting ? "Sauvegarde..." : "Enregistrer"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
