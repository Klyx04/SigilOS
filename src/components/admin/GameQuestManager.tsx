"use client";

import { useState, useEffect, useCallback } from "react";
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
    getGameQuests,
    createGameQuest,
    updateGameQuest,
    deleteGameQuest,
} from "@/server/actions/game-data-admin-actions";
import { Map, Trash2, Edit2, Plus, Search, MoreHorizontal, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface GameQuest {
    id: string;
    name: string;
    dofusDbId?: number | null;
    levelMin?: number | null;
    levelMax?: number | null;
    description?: string | null;
    imageUrl?: string | null;
    category?: string | null;
}

const CATEGORIES = [
    "Épique", "Dimensionnelle", "Quête de Zone", "Scénario", "Légendaire", "Autre"
];

export default function GameQuestManager() {
    const [quests, setQuests] = useState<GameQuest[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const [formData, setFormData] = useState({
        name: "",
        dofusDbId: "" as string | number,
        levelMin: "" as string | number,
        levelMax: "" as string | number,
        description: "",
        imageUrl: "",
        category: "",
    });

    const loadQuests = useCallback(async () => {
        setLoading(true);
        const result = await getGameQuests();
        if (result.success && result.data) setQuests(result.data);
        setLoading(false);
    }, []);

    useEffect(() => { loadQuests(); }, [loadQuests]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const payload = {
            name: formData.name,
            dofusDbId: formData.dofusDbId !== "" ? Number(formData.dofusDbId) : null,
            levelMin: formData.levelMin !== "" ? Number(formData.levelMin) : null,
            levelMax: formData.levelMax !== "" ? Number(formData.levelMax) : null,
            description: formData.description || undefined,
            imageUrl: formData.imageUrl || undefined,
            category: formData.category || undefined,
        };
        const result = editing
            ? await updateGameQuest(editing, payload)
            : await createGameQuest(payload);

        if (result.success) {
            toast.success(editing ? "Quête mise à jour" : "Quête créée");
            resetForm();
            setIsDialogOpen(false);
            loadQuests();
        } else {
            toast.error(result.error || "Erreur");
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Supprimer cette quête ?")) return;
        const result = await deleteGameQuest(id);
        if (result.success) { toast.success("Quête supprimée"); loadQuests(); }
        else toast.error(result.error);
    }

    function resetForm() {
        setFormData({ name: "", dofusDbId: "", levelMin: "", levelMax: "", description: "", imageUrl: "", category: "" });
        setEditing(null);
    }

    function startEdit(quest: GameQuest) {
        setEditing(quest.id);
        setFormData({
            name: quest.name,
            dofusDbId: quest.dofusDbId ?? "",
            levelMin: quest.levelMin ?? "",
            levelMax: quest.levelMax ?? "",
            description: quest.description || "",
            imageUrl: quest.imageUrl || "",
            category: quest.category || "",
        });
        setIsDialogOpen(true);
    }

    const filtered = quests.filter(q =>
        q.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (q.category || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Group by category
    const categories = [...new Set(filtered.map(q => q.category || "Non classé"))].sort();

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Rechercher une quête..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-9 bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500"
                    />
                </div>
                <Button
                    onClick={() => { resetForm(); setIsDialogOpen(true); }}
                    className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 font-medium"
                >
                    <Plus className="w-4 h-4 mr-2" /> Nouvelle Quête
                </Button>
            </div>

            {loading ? (
                <div className="p-12 text-center text-slate-400 animate-pulse">Chargement...</div>
            ) : filtered.length === 0 ? (
                <div className="p-12 text-center text-slate-500 border border-dashed border-slate-700 rounded-lg">
                    Aucune quête trouvée
                </div>
            ) : (
                <div className="space-y-6">
                    {categories.map(cat => {
                        const items = filtered.filter(q => (q.category || "Non classé") === cat);
                        return (
                            <div key={cat}>
                                <h3 className="text-xs font-black uppercase tracking-widest text-cyan-400 mb-3 flex items-center gap-2 border-b border-slate-800 pb-2">
                                    <Map className="w-3 h-3" /> {cat} ({items.length})
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {items.map(quest => (
                                        <div
                                            key={quest.id}
                                            className="group relative bg-slate-900/40 border border-slate-800 rounded-xl p-4 hover:border-indigo-500/30 transition-all flex items-start gap-3"
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                                                {quest.imageUrl
                                                    ? <img src={quest.imageUrl} alt={quest.name} className="w-full h-full object-contain rounded-lg" />
                                                    : <Map className="w-5 h-5 text-slate-600" />
                                                }
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-semibold text-slate-200 text-sm truncate">{quest.name}</h4>
                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                    {(quest.levelMin || quest.levelMax) && (
                                                        <span className="text-[10px] text-slate-500">
                                                            Niv. {quest.levelMin ?? "?"}{quest.levelMax && quest.levelMax !== quest.levelMin ? `–${quest.levelMax}` : ""}
                                                        </span>
                                                    )}
                                                    {quest.dofusDbId && (
                                                        <a
                                                            href={`https://dofusdb.fr/fr/database/quest/${quest.dofusDbId}`}
                                                            target="_blank" rel="noopener noreferrer"
                                                            onClick={e => e.stopPropagation()}
                                                            className="text-[10px] text-cyan-500 hover:text-cyan-400 flex items-center gap-0.5"
                                                        >
                                                            <ExternalLink className="w-2.5 h-2.5" /> DofusDB
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 bg-slate-950/80 hover:bg-slate-800 text-slate-400">
                                                            <MoreHorizontal className="w-3 h-3" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                                                        <DropdownMenuItem onClick={() => startEdit(quest)} className="text-slate-300 focus:bg-slate-800 cursor-pointer">
                                                            <Edit2 className="w-3 h-3 mr-2 text-indigo-400" /> Modifier
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleDelete(quest.id)} className="text-red-400 focus:bg-red-950/30 cursor-pointer">
                                                            <Trash2 className="w-3 h-3 mr-2" /> Supprimer
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Form Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="w-[95vw] max-w-lg bg-slate-950 border-slate-800">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-white flex items-center gap-3">
                            <Map className="w-6 h-6 text-cyan-400" />
                            {editing ? "Modifier la quête" : "Nouvelle quête"}
                        </DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Ajoutez une quête Dofus au catalogue de référence.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nom *</label>
                            <Input
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                required
                                placeholder="Ex: La Quête du Requin"
                                className="bg-slate-900 border-slate-700 text-white"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Catégorie</label>
                            <select
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                            >
                                <option value="">-- Choisir --</option>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">ID DofusDB</label>
                                <Input
                                    type="number" min={1}
                                    value={formData.dofusDbId}
                                    onChange={e => setFormData({ ...formData, dofusDbId: e.target.value })}
                                    placeholder="1699"
                                    className="bg-slate-900 border-slate-700 text-white"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Niv. min</label>
                                <Input
                                    type="number" min={1}
                                    value={formData.levelMin}
                                    onChange={e => setFormData({ ...formData, levelMin: e.target.value })}
                                    placeholder="1"
                                    className="bg-slate-900 border-slate-700 text-white"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Niv. max</label>
                                <Input
                                    type="number" min={1}
                                    value={formData.levelMax}
                                    onChange={e => setFormData({ ...formData, levelMax: e.target.value })}
                                    placeholder="200"
                                    className="bg-slate-900 border-slate-700 text-white"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Description</label>
                            <textarea
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                rows={3}
                                placeholder="Description de la quête..."
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                            />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 font-bold">
                                {editing ? "💾 Enregistrer" : "➕ Créer"}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}
                                className="border-slate-700 text-slate-300 hover:bg-slate-800">
                                Annuler
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
