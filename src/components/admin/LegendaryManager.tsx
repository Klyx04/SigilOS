"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    getLegendaryItems,
    createLegendaryItem,
    updateLegendaryItem,
    deleteLegendaryItem,
} from "@/server/actions/legendary-actions";
import {
    Sparkles, Trash2, Edit2, Plus, Search, MoreHorizontal, Hammer, Users
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ImageDownloader } from "./ImageDownloader";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import Image from "next/image";

// Métiers pouvant créer des légendaires
const LEGENDARY_JOBS = [
    { id: "bijoutier",  name: "Bijoutier",   icon: "/assets/dofus/jobs/bijoutier.png" },
    { id: "cordonnier", name: "Cordonnier",  icon: "/assets/dofus/jobs/cordonnier.png" },
    { id: "faconneur",  name: "Façonneur",   icon: "/assets/dofus/jobs/faconneur.png" },
    { id: "sculpteur",  name: "Sculpteur",   icon: "/assets/dofus/jobs/sculpteur.png" },
    { id: "tailleur",   name: "Tailleur",    icon: "/assets/dofus/jobs/tailleur.png" },
];

const CATEGORIES = ["Chapeau", "Cape", "Bottes", "Ceinture", "Amulette", "Anneau", "Bouclier", "Arme"];

interface LegendaryItem {
    id: string;
    name: string;
    category: string;
    jobRequired: string;
    imageUrl?: string | null;
    _count?: { crafters: number };
}

export default function LegendaryManager() {
    const [items, setItems] = useState<LegendaryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const [formData, setFormData] = useState({
        name: "",
        category: "Chapeau",
        jobRequired: "tailleur",
        imageUrl: "",
    });

    useEffect(() => { loadItems(); }, []);

    async function loadItems() {
        setLoading(true);
        const result = await getLegendaryItems();
        if (result.success && result.data) setItems(result.data as LegendaryItem[]);
        setLoading(false);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const result = editing
            ? await updateLegendaryItem(editing, formData)
            : await createLegendaryItem(formData);

        if (result.success) {
            toast.success(editing ? "Item mis à jour" : "Item créé");
            resetForm();
            setIsDialogOpen(false);
            loadItems();
        } else {
            toast.error(result.error || "Erreur");
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Supprimer cet objet légendaire ?")) return;
        const result = await deleteLegendaryItem(id);
        if (result.success) { toast.success("Item supprimé"); loadItems(); }
    }

    function resetForm() {
        setFormData({ name: "", category: "Chapeau", jobRequired: "tailleur", imageUrl: "" });
        setEditing(null);
    }

    function startEdit(item: LegendaryItem) {
        setEditing(item.id);
        setFormData({
            name: item.name,
            category: item.category,
            jobRequired: item.jobRequired,
            imageUrl: item.imageUrl || "",
        });
        setIsDialogOpen(true);
    }

    const filtered = items.filter(i =>
        i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.jobRequired.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selectedJob = LEGENDARY_JOBS.find(j => j.id === formData.jobRequired);

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-surface/50 p-4 rounded-lg border border-border/50 backdrop-blur-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Rechercher un objet légendaire..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-9 bg-elevated border-border text-foreground placeholder:text-muted-foreground"
                    />
                </div>
                <Button
                    onClick={() => { resetForm(); setIsDialogOpen(true); }}
                    className="w-full md:w-auto bg-info hover:bg-info shadow-lg shadow-purple-900/20"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Nouvel Objet
                </Button>
            </div>

            {/* Stats bar */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
                <span className="font-mono">{items.length} objets légendaires</span>
                <span>·</span>
                <span>{items.reduce((acc, i) => acc + (i._count?.crafters ?? 0), 0)} artisans déclarés au total</span>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="p-12 text-center text-muted-foreground animate-pulse">Chargement...</div>
            ) : filtered.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground bg-surface/30 rounded-lg border border-dashed border-border">
                    Aucun objet légendaire trouvé
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filtered.map((item) => {
                        const job = LEGENDARY_JOBS.find(j => j.id === item.jobRequired);
                        return (
                            <div
                                key={item.id}
                                className="group relative bg-surface/40 border border-border rounded-xl p-4 hover:border-info/30 hover:shadow-lg hover:shadow-purple-900/10 transition-all duration-300"
                            >
                                {/* Actions */}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 bg-background/80 hover:bg-elevated text-muted-foreground">
                                                <MoreHorizontal className="w-3 h-3" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="bg-surface border-border">
                                            <DropdownMenuItem onClick={() => startEdit(item)} className="text-foreground focus:bg-elevated cursor-pointer">
                                                <Edit2 className="w-3 h-3 mr-2 text-info" /> Modifier
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleDelete(item.id)} className="text-danger focus:bg-danger/30 cursor-pointer">
                                                <Trash2 className="w-3 h-3 mr-2" /> Supprimer
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                <div className="flex items-center gap-4">
                                    {/* Image */}
                                    <div className="w-14 h-14 rounded-xl bg-elevated border border-border flex items-center justify-center shrink-0 overflow-hidden p-1.5 group-hover:border-info/50 transition-colors">
                                        {item.imageUrl ? (
                                            <Image src={item.imageUrl} alt={item.name} width={48} height={48} className="object-contain" />
                                        ) : (
                                            <Sparkles className="w-7 h-7 text-muted-foreground" />
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0 space-y-1.5">
                                        <h4 className="font-bold text-foreground text-sm truncate leading-none" title={item.name}>
                                            {item.name}
                                        </h4>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <Badge variant="outline" className="text-caption px-1.5 py-0 border-border text-muted-foreground bg-elevated/50">
                                                {item.category}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-2 text-caption text-muted-foreground">
                                            {job && (
                                                <div className="flex items-center gap-1">
                                                    <div className="relative w-3.5 h-3.5">
                                                        <Image src={job.icon} alt={job.name} fill className="object-contain" />
                                                    </div>
                                                    <span className="font-bold">{job.name}</span>
                                                </div>
                                            )}
                                            {item._count && (
                                                <div className="flex items-center gap-1 ml-auto text-info/70">
                                                    <Users className="w-3 h-3" />
                                                    <span>{item._count.crafters}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Edit / Create Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="w-[95vw] max-w-4xl bg-background border-border p-0 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                    <div className="p-6 bg-surface/50 border-b border-border shrink-0">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black text-foreground flex items-center gap-3">
                                <Sparkles className="w-6 h-6 text-info" />
                                {editing ? "Modifier l'objet légendaire" : "Nouvel Objet Légendaire"}
                            </DialogTitle>
                            <DialogDescription className="text-muted-foreground">
                                Configurez le nom, la catégorie, le métier requis et l'icône.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="p-6 overflow-y-auto flex-1">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Left: Info */}
                                <div className="space-y-5 bg-surface/30 p-5 rounded-2xl border border-border/50">
                                    <h3 className="text-xs font-black text-info uppercase tracking-widest border-b border-border pb-3">
                                        Informations
                                    </h3>

                                    {/* Name */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                                            Nom <span className="text-danger">*</span>
                                        </label>
                                        <Input
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            required
                                            placeholder="Ex: Noblesse de Jahash Jurgen"
                                            className="bg-background border-border focus:border-info/50 text-foreground"
                                        />
                                    </div>

                                    {/* Category */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                                            Catégorie <span className="text-danger">*</span>
                                        </label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {CATEGORIES.map(cat => (
                                                <button
                                                    key={cat}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, category: cat })}
                                                    className={cn(
                                                        "px-2 py-2 rounded-lg text-caption font-bold uppercase tracking-wide border transition-all",
                                                        formData.category === cat
                                                            ? "bg-info border-info text-info-foreground shadow-lg shadow-purple-900/30"
                                                            : "bg-surface border-border text-muted-foreground hover:border-border hover:text-foreground"
                                                    )}
                                                >
                                                    {cat}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Job Required */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                                            Métier Requis (niveau 200) <span className="text-danger">*</span>
                                        </label>
                                        <div className="grid grid-cols-5 gap-2">
                                            {LEGENDARY_JOBS.map(job => (
                                                <button
                                                    key={job.id}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, jobRequired: job.id })}
                                                    className={cn(
                                                        "flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all",
                                                        formData.jobRequired === job.id
                                                            ? "bg-info/20 border-info/60 text-info shadow-lg shadow-purple-900/20"
                                                            : "bg-surface border-border text-muted-foreground hover:border-border hover:text-foreground"
                                                    )}
                                                >
                                                    <div className="relative w-8 h-8">
                                                        <Image src={job.icon} alt={job.name} fill className="object-contain" />
                                                    </div>
                                                    <span className="text-caption font-black uppercase tracking-tight leading-none text-center">
                                                        {job.name}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Image */}
                                <div className="bg-background/50 p-5 rounded-2xl border border-border">
                                    <h3 className="text-xs font-black text-info uppercase tracking-widest border-b border-border pb-3 mb-4">
                                        Icône de l'Objet
                                    </h3>
                                    <ImageDownloader
                                        type="legendary"
                                        imageUrl={formData.imageUrl}
                                        identifier={formData.name || "legendary-item"}
                                        onImageDownloaded={(path) => setFormData({ ...formData, imageUrl: path })}
                                        className="w-full"
                                    />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-4 border-t border-border">
                                <Button
                                    type="submit"
                                    className="flex-[3] bg-info hover:bg-info h-12 font-black uppercase tracking-widest shadow-xl shadow-purple-600/20 rounded-xl"
                                >
                                    {editing ? "💾 Enregistrer" : "✨ Créer l'Objet"}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => { setIsDialogOpen(false); resetForm(); }}
                                    className="flex-1 h-12 border-border hover:bg-surface text-foreground font-bold uppercase tracking-widest rounded-xl"
                                >
                                    Annuler
                                </Button>
                            </div>
                        </form>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
