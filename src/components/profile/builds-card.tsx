"use client";

import { useState } from "react";
import { Link2, Trash2, Plus, Pencil, ShieldAlert, RefreshCw } from "lucide-react";
import NextImage from "next/image";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateDofusBookLinks } from "@/server/actions/profile-actions";
import { DofusbookPreview } from "@/components/dofus/dofusbook-preview";
import { DO_TAGS } from "@/lib/dofus-tags";
import type { BUILD_TAG_TYPE } from "@/lib/dofus-tags";

export type DofusBookLink = {
    id: string;
    url: string;
    name: string;
    tags?: string[];
    classId?: number;
    previewData?: any; // Cached build info
};

const ClassSelector = ({ 
    selectedId, 
    onSelect, 
    classes 
}: { 
    selectedId: number | null, 
    onSelect: (id: number) => void,
    classes: { id: number, name: string }[]
}) => (
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
                    title={cls.name}
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
);

interface BuildsCardProps {
    links: DofusBookLink[];
    onSave: (links: DofusBookLink[]) => void;
    readOnly?: boolean;
    guildId: string;
    targetUserId?: string;
}

export function BuildsCard({ links = [], onSave, readOnly = false, guildId, targetUserId }: BuildsCardProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [newLinkName, setNewLinkName] = useState("");
    const [newLinkUrl, setNewLinkUrl] = useState("");
    const [newLinkTags, setNewLinkTags] = useState<string[]>([]);
    const [newLinkClassId, setNewLinkClassId] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingLink, setEditingLink] = useState<DofusBookLink | null>(null);
    const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);

    const DOFUS_CLASSES = [
        { id: 1, name: "Féca" }, { id: 2, name: "Osamodas" }, { id: 3, name: "Enutrof" },
        { id: 4, name: "Sram" }, { id: 5, name: "Xélor" }, { id: 6, name: "Écaflip" },
        { id: 7, name: "Éniripsa" }, { id: 8, name: "Iop" }, { id: 9, name: "Crâ" },
        { id: 10, name: "Sadida" }, { id: 11, name: "Sacrieur" }, { id: 12, name: "Pandawa" },
        { id: 13, name: "Roublard" }, { id: 14, name: "Zobal" }, { id: 15, name: "Steamer" },
        { id: 16, name: "Éliotrope" }, { id: 17, name: "Huppermage" }, { id: 18, name: "Ouginak" },
        { id: 19, name: "Forgelance" }
    ];

    const handleAddLink = async () => {
        if (!newLinkName.trim() || !newLinkUrl.trim()) {
            toast.error("Veuillez remplir tous les champs");
            return;
        }

        // Strict Validation (supports /private/, etc.)
        const urlPattern = /^https:\/\/(www\.)?(d-bk\.net|dofusbook\.net)\/(fr|en|es|pt|de)\/(?:private\/)?[a-zA-Z0-9-_\/]+$/;
        if (!urlPattern.test(newLinkUrl.trim())) {
            toast.error("Format de lien invalide (d-bk.net ou dofusbook.net requis avec langue)");
            return;
        }

        if (links.length >= 10) {
            toast.error("Limite de 10 builds atteinte");
            return;
        }

        setIsSubmitting(true);


        const newLink: DofusBookLink = {
            id: crypto.randomUUID(),
            name: newLinkName.trim(),
            url: newLinkUrl.trim(),
            tags: newLinkTags,
            classId: newLinkClassId || undefined,
            previewData: null
        };

        const updatedLinks = [...links, newLink];

        try {
            const result = await updateDofusBookLinks({
                guildId,
                links: updatedLinks,
                targetUserId
            });
            if (result.success) {
                onSave(updatedLinks);
                setIsOpen(false);
                setNewLinkName("");
                setNewLinkUrl("");
                setNewLinkTags([]);
                setNewLinkClassId(null);
                toast.success("Build ajouté");
            } else {
                toast.error(result.error || "Erreur lors de l'ajout");
            }
        } catch (error) {
            toast.error("Erreur serveur");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditLink = async () => {
        if (!editingLink) return;
        if (!editingLink.name.trim() || !editingLink.url.trim()) {
            toast.error("Veuillez remplir tous les champs");
            return;
        }
        const urlPattern = /^https:\/\/(www\.)?(d-bk\.net|dofusbook\.net)\/(fr|en|es|pt|de)\/(?:private\/)?[a-zA-Z0-9-_\/]+$/;
        if (!urlPattern.test(editingLink.url.trim())) {
            toast.error("Format de lien invalide (d-bk.net ou dofusbook.net requis)");
            return;
        }
        setIsSubmitting(true);

        const updatedLinks = links.map(l =>
            l.id === editingLink.id ? editingLink : l
        );

        setIsSubmitting(true);
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
                            {links.length}/10
                        </span>
                    )}
                </div>

                {!readOnly && links.length < 10 && (
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-zinc-400 hover:text-white">
                                <Plus className="w-4 h-4" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-zinc-950 border-white/10 text-zinc-200 sm:max-w-xl">
                            <DialogHeader>
                                <DialogTitle>Ajouter un Build DofusBook</DialogTitle>
                                <DialogDescription className="text-zinc-400">
                                    Copiez le lien de partage de votre stuff (d-bk.net ou dofusbook.net).
                                </DialogDescription>
                            </DialogHeader>

                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Nom du build (Max 30)</Label>
                                    <Input
                                        id="name"
                                        placeholder="Ex: Cra Terre 200"
                                        maxLength={30}
                                        value={newLinkName}
                                        onChange={(e) => setNewLinkName(e.target.value)}
                                        className="bg-zinc-900 border-white/10"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="url">Lien DofusBook</Label>
                                    <Input
                                        id="url"
                                        placeholder="https://d-bk.net/fr/d/..."
                                        value={newLinkUrl}
                                        onChange={(e) => setNewLinkUrl(e.target.value)}
                                        className="bg-zinc-900 border-white/10 font-mono text-xs"
                                    />
                                    <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                                        <ShieldAlert className="w-3 h-3" />
                                        Seuls les liens d-bk.net et dofusbook.net sécurisés (https) sont acceptés.
                                    </p>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Tags (Optionnel, max 3)</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {DO_TAGS.map(tag => {
                                            const isSelected = newLinkTags.includes(tag.id);
                                            return (
                                                <button
                                                    key={tag.id}
                                                    type="button"
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setNewLinkTags(prev => prev.filter((t: string) => t !== tag.id));
                                                        } else if (newLinkTags.length < 3) {
                                                            setNewLinkTags(prev => [...prev, tag.id]);
                                                        }
                                                    }}
                                                    className={cn(
                                                        "px-2.5 py-1 text-[10px] sm:text-xs rounded-full transition-all border font-medium select-none",
                                                        isSelected
                                                            ? tag.className
                                                            : "bg-zinc-900 border-white/5 text-zinc-500 hover:border-white/20 hover:text-zinc-300 opacity-60 hover:opacity-100"
                                                    )}
                                                >
                                                    {tag.text}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Icône de classe (Recommandé)</Label>
                                    <ClassSelector 
                                        selectedId={newLinkClassId} 
                                        onSelect={setNewLinkClassId} 
                                        classes={DOFUS_CLASSES} 
                                    />
                                    <p className="text-[10px] text-zinc-500">
                                        Sélectionnez la classe pour assurer une belle preview, même si Dofusbook est lent.
                                    </p>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button variant="ghost" onClick={() => setIsOpen(false)}>Annuler</Button>
                                <Button onClick={handleAddLink} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                    {isSubmitting ? "Ajout..." : "Ajouter"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* Tag Filter UI */}
            {links.length > 0 && (
                <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 custom-scrollbar">
                    <span className="text-xs text-zinc-500 font-medium mr-1 whitespace-nowrap">Filtrer :</span>
                    <button
                        onClick={() => setSelectedTagFilter(null)}
                        className={cn(
                            "px-3 py-1 text-[11px] rounded-full transition-all border font-medium whitespace-nowrap",
                            selectedTagFilter === null
                                ? "bg-white/10 text-white border-white/20"
                                : "bg-transparent text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-white/5"
                        )}
                    >
                        Tous
                    </button>
                    {DO_TAGS.map(tag => {
                        const hasTag = links.some(l => l.tags?.includes(tag.id));
                        if (!hasTag) return null;

                        const isSelected = selectedTagFilter === tag.id;
                        return (
                            <button
                                key={tag.id}
                                onClick={() => setSelectedTagFilter(isSelected ? null : tag.id)}
                                className={cn(
                                    "px-3 py-1 text-[11px] rounded-full transition-all border font-medium whitespace-nowrap opacity-90 hover:opacity-100",
                                    isSelected
                                        ? tag.className
                                        : "bg-transparent text-zinc-400 border-white/5 hover:border-white/10 hover:bg-white/5"
                                )}
                            >
                                {tag.text}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* List or Grid */}
            <div className={cn(
                "grid gap-6 w-full",
                filteredLinks.length > 0 ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"
            )}>
                {filteredLinks.length > 0 ? (
                    filteredLinks.map(link => (
                        <div key={link.id} className="relative group/card h-full flex flex-col">
                            <DofusbookPreview url={link.url} title={link.name} tags={link.tags} classId={link.classId} initialData={(link as any).previewData} />

                            {!readOnly && (
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-all z-20">
                                    <button
                                        onClick={() => handleForceBake(link)}
                                        disabled={isSubmitting}
                                        className="p-2 bg-zinc-800/90 hover:bg-emerald-500 text-zinc-400 hover:text-white rounded-xl border border-white/10 shadow-xl transition-all disabled:opacity-50"
                                        title="Récupérer les données (Baking)"
                                    >
                                        <RefreshCw className={cn("w-4 h-4", isSubmitting && "animate-spin")} />
                                    </button>
                                    <button
                                        onClick={() => setEditingLink({ ...link })}
                                        className="p-2 bg-zinc-800/90 hover:bg-indigo-500 text-zinc-400 hover:text-white rounded-xl border border-white/10 shadow-xl transition-all"
                                        title="Modifier ce build"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteLink(link.id)}
                                        className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl border border-red-500/20 transition-all shadow-xl"
                                        title="Supprimer ce build"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="text-center py-12 bg-zinc-950/20 rounded-2xl border border-dashed border-white/5 flex flex-col items-center justify-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-zinc-900/50 flex items-center justify-center border border-white/5">
                            <Link2 className="w-6 h-6 text-zinc-700" />
                        </div>
                        <p className="text-zinc-600 text-sm italic">Aucun build enregistré</p>
                    </div>
                )}
            </div>

            {/* Edit Dialog */}
            <Dialog open={!!editingLink} onOpenChange={(open) => !open && setEditingLink(null)}>
                <DialogContent className="bg-zinc-950 border-white/10 text-zinc-200 sm:max-w-xl">
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
                                <Label htmlFor="edit-url">Lien DofusBook</Label>
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
                                                {tag.text}
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
                        <Button onClick={handleEditLink} disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                            {isSubmitting ? "Sauvegarde..." : "Enregistrer"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
