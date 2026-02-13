"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    getChallenges,
    createChallenge,
    updateChallenge,
    deleteChallenge,
} from "@/server/actions/game-data-admin-actions";
import { Trophy, Trash2, Edit2, Plus, Search, MoreHorizontal, ImageIcon } from "lucide-react";
import { LocalImagePicker } from "./LocalImagePicker";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Challenge {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    iconUrl?: string | null;
    _count?: { dungeonAchievements: number };
}

export default function ChallengeManager() {
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<string | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [showImagePicker, setShowImagePicker] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const [formData, setFormData] = useState({
        name: "",
        slug: "",
        description: "",
        iconUrl: "",
    });

    useEffect(() => {
        loadChallenges();
    }, []);

    async function loadChallenges() {
        setLoading(true);
        const result = await getChallenges();
        if (result.success && result.data) {
            setChallenges(result.data);
        }
        setLoading(false);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const result = editing
            ? await updateChallenge(editing, formData)
            : await createChallenge(formData);

        if (result.success) {
            toast.success(editing ? "Challenge mis à jour" : "Challenge créé");
            resetForm();
            setIsSheetOpen(false);
            loadChallenges();
        } else {
            toast.error(result.error || "Erreur");
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Supprimer ce challenge ?")) return;
        const result = await deleteChallenge(id);
        if (result.success) {
            toast.success("Challenge supprimé");
            loadChallenges();
        }
    }

    function resetForm() {
        setFormData({ name: "", slug: "", description: "", iconUrl: "" });
        setEditing(null);
        setShowImagePicker(false);
    }

    function startEdit(challenge: Challenge) {
        setEditing(challenge.id);
        setFormData({
            name: challenge.name,
            slug: challenge.slug,
            description: challenge.description || "",
            iconUrl: challenge.iconUrl || "",
        });
        setIsSheetOpen(true);
    }

    const filteredChallenges = challenges.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.slug.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 backdrop-blur-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Rechercher un challenge..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-9 bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500 focus:ring-indigo-500/50"
                    />
                </div>
                <Button
                    onClick={() => { resetForm(); setIsSheetOpen(true); }}
                    className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-900/20 transition-all font-medium"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Nouveau Challenge
                </Button>
            </div>

            {/* Grid List */}
            {loading ? (
                <div className="p-12 text-center text-slate-400 animate-pulse">Chargement des challenges...</div>
            ) : filteredChallenges.length === 0 ? (
                <div className="p-12 text-center text-slate-500 bg-slate-900/30 rounded-lg border border-dashed border-slate-700">
                    Aucun challenge trouvé
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredChallenges.map((challenge) => (
                        <div
                            key={challenge.id}
                            className="group relative bg-slate-900/40 border border-slate-800 rounded-xl p-4 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-900/10 transition-all duration-300"
                        >
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 bg-slate-950/80 hover:bg-slate-800 text-slate-400">
                                            <MoreHorizontal className="w-3 h-3" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                                        <DropdownMenuItem onClick={() => startEdit(challenge)} className="text-slate-300 focus:bg-slate-800 cursor-pointer">
                                            <Edit2 className="w-3 h-3 mr-2 text-indigo-400" /> Modifier
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDelete(challenge.id)} className="text-red-400 focus:bg-red-950/30 cursor-pointer">
                                            <Trash2 className="w-3 h-3 mr-2" /> Supprimer
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="flex flex-col items-center text-center gap-3">
                                <div className="w-12 h-12 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center p-1 group-hover:border-indigo-500/50 transition-colors">
                                    {challenge.iconUrl ? (
                                        <img src={challenge.iconUrl} alt={challenge.name} className="w-full h-full object-contain" />
                                    ) : (
                                        <Trophy className="w-6 h-6 text-slate-600" />
                                    )}
                                </div>

                                <div className="space-y-1 w-full">
                                    <h4 className="font-semibold text-slate-200 text-sm truncate" title={challenge.name}>{challenge.name}</h4>
                                    <div className="text-[10px] text-slate-500 font-mono truncate bg-slate-950/50 rounded px-1.5 py-0.5 mx-auto w-max max-w-full">
                                        {challenge.slug}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Form Sheet */}
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent className="w-full sm:max-w-md bg-slate-950 border-l-slate-800 p-0">
                    <div className="p-6 h-full flex flex-col">
                        <SheetHeader className="mb-6">
                            <SheetTitle className="text-xl font-bold text-white flex items-center gap-3">
                                {editing ? "✏️ Modifier le challenge" : "➕ Nouveau challenge"}
                            </SheetTitle>
                            <SheetDescription className="text-slate-400">
                                Ajoutez ou modifiez un challenge (succès).
                            </SheetDescription>
                        </SheetHeader>

                        <form onSubmit={handleSubmit} className="flex-1 flex flex-col space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Nom <span className="text-red-400">*</span></label>
                                    <Input
                                        value={formData.name}
                                        onChange={(e) => {
                                            const name = e.target.value;
                                            if (!editing) {
                                                const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                                                setFormData({ ...formData, name, slug });
                                            } else {
                                                setFormData({ ...formData, name });
                                            }
                                        }}
                                        required
                                        placeholder="Ex: Misanthrope"
                                        className="bg-slate-900 border-slate-700"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Description</label>
                                    <Input
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Description courte..."
                                        className="bg-slate-900 border-slate-700"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Icône</label>
                                    {formData.iconUrl ? (
                                        <div className="flex items-center gap-3 p-3 bg-slate-900 rounded-lg border border-slate-700">
                                            <img src={formData.iconUrl} alt="Preview" className="w-10 h-10 object-contain" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs text-slate-400 truncate">{formData.iconUrl.split('/').pop()}</p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setFormData({ ...formData, iconUrl: "" })}
                                                className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-800"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => setShowImagePicker(!showImagePicker)}
                                                className="w-full border-slate-700 hover:bg-slate-800"
                                            >
                                                {showImagePicker ? "Masquer la galerie" : "📷 Choisir depuis la galerie"}
                                            </Button>

                                            {showImagePicker && (
                                                <div className="border border-slate-700 rounded-lg p-2 bg-slate-900/50">
                                                    <LocalImagePicker
                                                        type="achievement"
                                                        onImageSelect={(path) => {
                                                            setFormData({ ...formData, iconUrl: path });
                                                            setShowImagePicker(false);
                                                        }}
                                                        className="max-h-48"
                                                        gridSize="small"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-6 mt-auto border-t border-slate-800">
                                <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                                    {editing ? "💾 Enregistrer" : "➕ Créer"}
                                </Button>
                                {editing && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={resetForm}
                                        className="border-slate-700 hover:bg-slate-800"
                                    >
                                        Annuler
                                    </Button>
                                )}
                            </div>
                        </form>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
