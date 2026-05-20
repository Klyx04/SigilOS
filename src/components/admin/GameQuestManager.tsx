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
import { Map, Trash2, Edit2, Plus, Search, MoreHorizontal, ExternalLink, Loader2, ChevronDown, ChevronUp, BookOpen, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getQuestPrerequisites } from "@/server/actions/dofus-search-actions";

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

    // Advanced Filters state
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [minLevel, setMinLevel] = useState<string>("");
    const [maxLevel, setMaxLevel] = useState<string>("");
    const [selectedSource, setSelectedSource] = useState<string>("ALL");

    // Prerequisites dynamic loader state
    const [expandedQuestId, setExpandedQuestId] = useState<string | null>(null);
    const [loadedPrereqs, setLoadedPrereqs] = useState<Record<number, any>>({});
    const [loadingPrereqs, setLoadingPrereqs] = useState<Record<number, boolean>>({});

    const togglePrerequisites = useCallback(async (questId: string, dofusDbId: number) => {
        if (expandedQuestId === questId) {
            setExpandedQuestId(null);
            return;
        }
        setExpandedQuestId(questId);
        if (loadedPrereqs[dofusDbId]) return;

        setLoadingPrereqs(prev => ({ ...prev, [dofusDbId]: true }));
        const res = await getQuestPrerequisites(dofusDbId);
        if (res.success && res.data) {
            setLoadedPrereqs(prev => ({ ...prev, [dofusDbId]: res.data }));
        } else {
            toast.error(res.error || "Impossible de charger les prérequis");
        }
        setLoadingPrereqs(prev => ({ ...prev, [dofusDbId]: false }));
    }, [expandedQuestId, loadedPrereqs]);

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

    // Dynamically build all categories from all quests
    const allCategories = [...new Set(quests.map(q => q.category).filter(Boolean))].sort() as string[];

    const filtered = quests.filter(q => {
        // Search query
        const matchSearch = searchQuery === "" ||
            q.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (q.category || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (q.dofusDbId?.toString() || "").includes(searchQuery);

        // Category/Zone
        const matchCategory = selectedCategory === "" || q.category === selectedCategory;

        // Level bounds
        const qMin = q.levelMin ?? 1;
        const passMin = minLevel === "" || qMin >= Number(minLevel);
        const passMax = maxLevel === "" || qMin <= Number(maxLevel);

        // Source filter
        const isDofusDb = q.dofusDbId !== null && q.dofusDbId !== undefined;
        const matchSource = selectedSource === "ALL" ||
            (selectedSource === "DOFUSDB" && isDofusDb) ||
            (selectedSource === "MANUAL" && !isDofusDb);

        return matchSearch && matchCategory && passMin && passMax && matchSource;
    });

    const hasActiveFilters = selectedCategory !== "" || minLevel !== "" || maxLevel !== "" || selectedSource !== "ALL" || searchQuery !== "";

    // Group by category
    const categories = [...new Set(filtered.map(q => q.category || "Non classé"))].sort();

    return (
        <div className="space-y-4">
            {/* Toolbar & Filters */}
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 space-y-4">
                <div className="flex flex-col md:flex-row items-center gap-4">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Rechercher une quête par nom ou catégorie..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-9 bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                    </div>
                    <Button
                        onClick={() => { resetForm(); setIsDialogOpen(true); }}
                        className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 font-semibold transition-all shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 shrink-0"
                    >
                        <Plus className="w-4 h-4 mr-2" /> Nouvelle Quête
                    </Button>
                </div>

                {/* Advanced Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-slate-800/60">
                    {/* Zone/Category dropdown */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Zone / Catégorie</label>
                        <select
                            value={selectedCategory}
                            onChange={e => setSelectedCategory(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700/60 rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500 cursor-pointer"
                        >
                            <option value="">Toutes les zones</option>
                            {allCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Min Level */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Niveau Min</label>
                        <Input
                            type="number"
                            placeholder="1"
                            min={1}
                            max={200}
                            value={minLevel}
                            onChange={e => setMinLevel(e.target.value)}
                            className="h-8 bg-slate-800 border-slate-700/60 text-xs text-slate-200 placeholder:text-slate-600 focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500"
                        />
                    </div>

                    {/* Max Level */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Niveau Max</label>
                        <Input
                            type="number"
                            placeholder="200"
                            min={1}
                            max={200}
                            value={maxLevel}
                            onChange={e => setMaxLevel(e.target.value)}
                            className="h-8 bg-slate-800 border-slate-700/60 text-xs text-slate-200 placeholder:text-slate-600 focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500"
                        />
                    </div>

                    {/* Source */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Source</label>
                        <select
                            value={selectedSource}
                            onChange={e => setSelectedSource(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700/60 rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500 cursor-pointer"
                        >
                            <option value="ALL">Toutes les sources</option>
                            <option value="DOFUSDB">DofusDB uniquement</option>
                            <option value="MANUAL">Manuelle uniquement</option>
                        </select>
                    </div>
                </div>

                {hasActiveFilters && (
                    <div className="flex justify-end pt-1">
                        <button
                            onClick={() => {
                                setSearchQuery("");
                                setSelectedCategory("");
                                setMinLevel("");
                                setMaxLevel("");
                                setSelectedSource("ALL");
                            }}
                            className="text-xs text-rose-400 hover:text-rose-300 font-semibold transition-all underline decoration-dotted underline-offset-4 cursor-pointer"
                        >
                            Réinitialiser les filtres
                        </button>
                    </div>
                )}
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
                                            className="group relative bg-slate-900/40 border border-slate-800 rounded-xl p-4 hover:border-indigo-500/30 transition-all flex flex-col gap-3"
                                        >
                                            <div className="flex items-start gap-3 w-full">
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
                                                        {quest.dofusDbId ? (
                                                            <div className="flex items-center gap-2">
                                                                <a
                                                                    href={`https://dofusdb.fr/fr/database/quest/${quest.dofusDbId}`}
                                                                    target="_blank" rel="noopener noreferrer"
                                                                    onClick={e => e.stopPropagation()}
                                                                    className="text-[10px] text-cyan-500 hover:text-cyan-400 flex items-center gap-0.5"
                                                                >
                                                                    <ExternalLink className="w-2.5 h-2.5" /> DofusDB
                                                                </a>
                                                                <button
                                                                    onClick={() => togglePrerequisites(quest.id, quest.dofusDbId!)}
                                                                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition-colors"
                                                                >
                                                                    {loadingPrereqs[quest.dofusDbId] ? (
                                                                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                                                    ) : expandedQuestId === quest.id ? (
                                                                        <ChevronUp className="w-2.5 h-2.5" />
                                                                    ) : (
                                                                        <ChevronDown className="w-2.5 h-2.5" />
                                                                    )}
                                                                    Prérequis
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] text-amber-500 font-medium">Manuel</span>
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

                                            {/* Prerequisites Section */}
                                            {quest.dofusDbId && expandedQuestId === quest.id && (
                                                <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-2.5 animate-fadeIn">
                                                    {loadingPrereqs[quest.dofusDbId] ? (
                                                        <div className="flex items-center justify-center py-4">
                                                            <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                                                        </div>
                                                    ) : loadedPrereqs[quest.dofusDbId] ? (
                                                        (() => {
                                                            const prereqs = loadedPrereqs[quest.dofusDbId];
                                                            const hasConditions = prereqs.conditions && prereqs.conditions.length > 0;
                                                            const hasQuests = prereqs.prerequisiteQuests && prereqs.prerequisiteQuests.length > 0;
                                                            const hasAchievements = prereqs.prerequisiteAchievements && prereqs.prerequisiteAchievements.length > 0;

                                                            if (!hasConditions && !hasQuests && !hasAchievements) {
                                                                return (
                                                                    <div className="text-[10px] text-slate-500 italic py-1">
                                                                        Aucun prérequis spécifique enregistré pour cette quête.
                                                                    </div>
                                                                );
                                                            }

                                                            return (
                                                                <div className="space-y-2 text-left">
                                                                    {hasConditions && (
                                                                        <div className="space-y-0.5">
                                                                            <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Conditions de départ</span>
                                                                            <ul className="space-y-0.5">
                                                                                {prereqs.conditions.map((cond: string, idx: number) => (
                                                                                    <li key={idx} className="text-[10px] text-slate-300 flex items-center gap-1">
                                                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/85 shrink-0" />
                                                                                        <span>{cond}</span>
                                                                                    </li>
                                                                                ))}
                                                                            </ul>
                                                                        </div>
                                                                    )}

                                                                    {hasQuests && (
                                                                        <div className="space-y-1">
                                                                            <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Quêtes requises ({prereqs.prerequisiteQuests.length})</span>
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {prereqs.prerequisiteQuests.map((pq: any) => (
                                                                                    <a
                                                                                        key={pq.id}
                                                                                        href={`https://dofusdb.fr/fr/database/quest/${pq.id}`}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        className="text-[9px] px-1.5 py-0.5 bg-indigo-950/40 border border-indigo-900/60 text-indigo-300 rounded hover:bg-indigo-900/50 hover:text-indigo-200 transition-all flex items-center gap-1 max-w-full"
                                                                                    >
                                                                                        <BookOpen className="w-2.5 h-2.5 shrink-0 text-indigo-400" />
                                                                                        <span className="truncate">{pq.name}</span>
                                                                                    </a>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {hasAchievements && (
                                                                        <div className="space-y-1">
                                                                            <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Succès requis ({prereqs.prerequisiteAchievements.length})</span>
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {prereqs.prerequisiteAchievements.map((pa: any) => (
                                                                                    <a
                                                                                        key={pa.id}
                                                                                        href={`https://dofusdb.fr/fr/database/achievement/${pa.id}`}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        className="text-[9px] px-1.5 py-0.5 bg-amber-950/40 border border-amber-900/60 text-amber-300 rounded hover:bg-amber-900/50 hover:text-amber-200 transition-all flex items-center gap-1 max-w-full"
                                                                                    >
                                                                                        <Award className="w-2.5 h-2.5 shrink-0 text-amber-400" />
                                                                                        <span className="truncate">{pa.name}</span>
                                                                                    </a>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()
                                                    ) : null}
                                                </div>
                                            )}
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
