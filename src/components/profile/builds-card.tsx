"use client";

import { useState } from "react";
import { Link2, Trash2, Plus, ExternalLink, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateDofusBookLinks } from "@/server/actions/profile-actions";
import { DofusbookPreview } from "@/components/dofus/dofusbook-preview";

type DofusBookLink = {
    id: string;
    url: string;
    name: string;
};

interface BuildsCardProps {
    links: DofusBookLink[];
    onSave: (links: DofusBookLink[]) => void;
    readOnly?: boolean;
    guildId: string;
}

export function BuildsCard({ links = [], onSave, readOnly = false, guildId }: BuildsCardProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [newLinkName, setNewLinkName] = useState("");
    const [newLinkUrl, setNewLinkUrl] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAddLink = async () => {
        if (!newLinkName.trim() || !newLinkUrl.trim()) {
            toast.error("Veuillez remplir tous les champs");
            return;
        }

        // Strict Validation
        const urlPattern = /^https:\/\/(www\.)?(d-bk\.net|dofusbook\.net)\/(fr|en|es|pt|de)\/[a-zA-Z0-9-_\/]+$/;
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
            url: newLinkUrl.trim()
        };

        const updatedLinks = [...links, newLink];

        try {
            const result = await updateDofusBookLinks({ guildId, links: updatedLinks });
            if (result.success) {
                onSave(updatedLinks);
                setIsOpen(false);
                setNewLinkName("");
                setNewLinkUrl("");
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

    const handleDeleteLink = async (id: string) => {
        if (readOnly) return;
        const updatedLinks = links.filter(l => l.id !== id);

        // Optimistic update
        onSave(updatedLinks);

        const result = await updateDofusBookLinks({ guildId, links: updatedLinks });
        if (!result.success) {
            toast.error("Erreur lors de la suppression");
            // Revert (not easily done without local state refetch, but acceptable for now)
        } else {
            toast.success("Build supprimé");
        }
    };

    if (readOnly && links.length === 0) return null;

    return (
        <div className="p-6 bg-black/20 backdrop-blur-md rounded-2xl border border-white/10 flex flex-col gap-4">
            <div className="flex items-center justify-between">
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

            {/* List or Grid */}
            <div className={cn(
                "grid gap-4 w-full",
                links.length > 0 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
            )}>
                {links.length > 0 ? (
                    links.map(link => (
                        <div key={link.id} className="relative group/card">
                            <DofusbookPreview url={link.url} title={link.name} />

                            {!readOnly && (
                                <button
                                    onClick={() => handleDeleteLink(link.id)}
                                    className="absolute top-2 right-2 p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl border border-red-500/20 transition-all opacity-0 group-hover/card:opacity-100 z-20 shadow-xl"
                                    title="Supprimer ce build"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
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
        </div>
    );
}
