"use client";

import { useState } from "react";
import { Link2, Trash2, Plus, Pencil, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateDofusBookLinks } from "@/server/actions/profile-actions";
import { DofusbookPreview } from "@/components/dofus/dofusbook-preview";

export type BUILD_TAG_TYPE = "eau" | "feu" | "terre" | "air" | "multi" | "tank" | "dopou" | "pp" | "retpa" | "retpm" | "soin";

export const DO_TAGS = [
    { id: "eau", label: "Eau", text: "💧 Eau", className: "bg-blue-500/10 text-blue-400 border border-blue-500/20" },
    { id: "feu", label: "Feu", text: "🔥 Feu", className: "bg-red-500/10 text-red-400 border border-red-500/20" },
    { id: "terre", label: "Terre", text: "🌱 Terre", className: "bg-green-600/10 text-green-500 border border-green-600/20" },
    { id: "air", label: "Air", text: "💨 Air", className: "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20" },
    { id: "multi", label: "Multi", text: "🌈 Multi", className: "bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20" },
    { id: "tank", label: "Tank", text: "🛡️ Tank", className: "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20" },
    { id: "dopou", label: "Do Pou", text: "💥 Do Pou", className: "bg-orange-500/10 text-orange-400 border border-orange-500/20" },
    { id: "pp", label: "PP", text: "🍀 PP", className: "bg-yellow-400/10 text-yellow-500 border border-yellow-400/20" }
];

export type DofusBookLink = {
    id: string;
    url: string;
    name: string;
    tags?: string[];
};

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
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingLink, setEditingLink] = useState<DofusBookLink | null>(null);
    const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);

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
            tags: newLinkTags
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
        const updatedLinks = links.map(l => l.id === editingLink.id ? editingLink : l);
        try {
            const result = await updateDofusBookLinks({ guildId, links: updatedLinks, targetUserId });
            if (result.success) {
                onSave(updatedLinks);
                setEditingLink(null);
                toast.success("Build mis à jour");
            } else {
                toast.error(result.error || "Erreur lors de la modification");
            }
        } catch {
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
                                                            setNewLinkTags(prev => prev.filter(t => t !== tag.id));
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
                            <DofusbookPreview url={link.url} title={link.name} tags={link.tags} />

                            {!readOnly && (
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-all z-20">
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
                <DialogContent className="bg-zinc-950 border-white/10 text-zinc-200 sm:max-w-md">
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
                                                            return { ...prev, tags: curTags.filter(t => t !== tag.id) };
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
