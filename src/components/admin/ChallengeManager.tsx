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
    getChallenges,
    createChallenge,
    updateChallenge,
    deleteChallenge,
} from "@/server/actions/game-data-admin-actions";
import { Trophy, Trash2, Edit2, Plus, Search, MoreHorizontal, ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ImageDownloader } from "./ImageDownloader";
import { LocalImagePicker } from "./LocalImagePicker";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion } from "framer-motion";

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
    const [isDialogOpen, setIsDialogOpen] = useState(false);
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
            setIsDialogOpen(false);
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
    }

    function startEdit(challenge: Challenge) {
        setEditing(challenge.id);
        setFormData({
            name: challenge.name,
            slug: challenge.slug,
            description: challenge.description || "",
            iconUrl: challenge.iconUrl || "",
        });
        setIsDialogOpen(true);
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
                    onClick={() => { resetForm(); setIsDialogOpen(true); }}
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

            {/* Form Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent draggable className="w-[95vw] max-w-7xl max-h-[95vh] bg-slate-950 border-slate-800 p-0 overflow-hidden shadow-2xl flex flex-col h-full">
                    {/* Header Draggable */}
                    <div className="p-8 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between shrink-0">
                        <DialogHeader>
                            <DialogTitle className="text-3xl font-black text-white flex items-center gap-4">
                                <Trophy className="w-8 h-8 text-indigo-500" />
                                {editing ? "Modifier le challenge" : "Nouveau challenge"}
                            </DialogTitle>
                            <DialogDescription className="text-slate-400 text-lg">
                                Configurez les détails du challenge et son icône représentative.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="p-10 overflow-y-auto flex-1 custom-scrollbar">
                        <form onSubmit={handleSubmit} className="space-y-10 pb-6">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                                {/* Left Column: Info */}
                                <div className="lg:col-span-7 space-y-10">
                                    <div className="space-y-8 bg-slate-900/30 p-8 rounded-3xl border border-slate-800/50">
                                        <h3 className="text-sm font-black text-indigo-400 uppercase tracking-[0.2em] border-b border-slate-800 pb-4 mb-2">Configuration du Challenge</h3>

                                        <div className="space-y-6">
                                            <div className="space-y-3">
                                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Nom du Challenge <span className="text-rose-500 text-lg">*</span></label>
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
                                                    className="h-16 bg-slate-950 border-slate-800 focus:border-indigo-500/50 focus:ring-indigo-500/20 text-xl font-bold transition-all rounded-2xl"
                                                />
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Identifiant (Slug)</label>
                                                <Input
                                                    value={formData.slug}
                                                    readOnly={!!editing}
                                                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                                    placeholder="identifiant-unique"
                                                    className={`h-12 bg-slate-950/50 border-slate-800 text-slate-500 font-mono text-sm rounded-xl ${editing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                />
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Description</label>
                                                <textarea
                                                    value={formData.description || ""}
                                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                    rows={4}
                                                    placeholder="Expliquez les conditions de réussite du challenge..."
                                                    className="w-full px-5 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 resize-none text-lg transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Icon */}
                                <div className="lg:col-span-5 space-y-8">
                                    <div className="bg-slate-950/50 p-8 rounded-3xl border border-slate-800 shadow-inner flex flex-col h-full">
                                        <h3 className="text-sm font-black text-indigo-400 uppercase tracking-[0.2em] border-b border-slate-800 pb-4 mb-6">Icône du Challenge</h3>

                                        <ImageDownloader
                                            type="achievement"
                                            imageUrl={formData.iconUrl}
                                            identifier={formData.name || formData.slug}
                                            onImageDownloaded={(path) => setFormData({ ...formData, iconUrl: path })}
                                            className="w-full"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-6 border-t border-slate-800 sticky bottom-0 bg-slate-950 py-4 shrink-0">
                                <Button type="submit" className="flex-[3] bg-indigo-600 hover:bg-indigo-500 h-14 text-lg font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 transition-all rounded-xl active:scale-[0.98]">
                                    {editing ? "💾 Enregistrer" : "➕ Créer le Challenge"}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsDialogOpen(false)}
                                    className="flex-1 h-14 border-white/10 hover:bg-white/5 text-slate-300 text-sm font-bold uppercase tracking-widest transition-all rounded-xl"
                                >
                                    Fermer
                                </Button>
                            </div>
                        </form>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
}
