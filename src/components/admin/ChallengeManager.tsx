"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    getChallenges,
    createChallenge,
    updateChallenge,
    deleteChallenge,
} from "@/server/actions/game-data-admin-actions";
import { Trophy, Trash2, Edit2, X, Check, Plus } from "lucide-react";
import { LocalImagePicker } from "./LocalImagePicker";

interface Challenge {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    iconUrl?: string | null;
    difficulty?: number | null;
    _count?: { dungeonAchievements: number };
}

export default function ChallengeManager() {
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [showImagePicker, setShowImagePicker] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        slug: "",
        description: "",
        iconUrl: "",
        difficulty: 3,
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
        setFormData({ name: "", slug: "", description: "", iconUrl: "", difficulty: 3 });
        setEditing(null);
        setShowForm(false);
        setShowImagePicker(false);
    }

    function startEdit(challenge: Challenge) {
        setEditing(challenge.id);
        setFormData({
            name: challenge.name,
            slug: challenge.slug,
            description: challenge.description || "",
            iconUrl: challenge.iconUrl || "",
            difficulty: challenge.difficulty || 3,
        });
        setShowForm(true);
    }

    return (
        <div className="space-y-4">
            {/* Header + Add Button */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                    <h3 className="text-lg font-bold text-white">Challenges</h3>
                    <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full text-slate-300">
                        {challenges.length}
                    </span>
                </div>
                {!showForm && (
                    <Button
                        onClick={() => setShowForm(true)}
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-700"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Nouveau
                    </Button>
                )}
            </div>

            {/* Compact Form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-bold text-white">
                            {editing ? "Modifier" : "Nouveau"} Challenge
                        </h4>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={resetForm}
                            className="h-6 w-6 p-0"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Nom</label>
                            <input
                                type="text"
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
                                className="w-full px-3 py-1.5 text-sm bg-slate-900 border border-slate-600 rounded text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                                placeholder="Misanthrope"
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Difficulté</label>
                            <select
                                value={formData.difficulty}
                                onChange={(e) => setFormData({ ...formData, difficulty: parseInt(e.target.value) })}
                                className="w-full px-3 py-1.5 text-sm bg-slate-900 border border-slate-600 rounded text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                            >
                                <option value={1}>1 - Facile</option>
                                <option value={2}>2 - Normal</option>
                                <option value={3}>3 - Moyen</option>
                                <option value={4}>4 - Difficile</option>
                                <option value={5}>5 - Extrême</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Description (optionnelle)</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={2}
                            className="w-full px-3 py-1.5 text-sm bg-slate-900 border border-slate-600 rounded text-white focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                            placeholder="Description..."
                        />
                    </div>

                    {/* Image Selector - Compact */}
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Icône</label>
                        {formData.iconUrl ? (
                            <div className="flex items-center gap-2">
                                <img src={formData.iconUrl} alt="Preview" className="w-8 h-8 rounded bg-slate-900 p-1" />
                                <code className="text-xs text-slate-400 flex-1 truncate">{formData.iconUrl}</code>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setFormData({ ...formData, iconUrl: "" })}
                                    className="h-7 text-xs"
                                >
                                    Changer
                                </Button>
                            </div>
                        ) : (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setShowImagePicker(!showImagePicker)}
                                className="w-full"
                            >
                                {showImagePicker ? "Masquer" : "Choisir"} depuis la galerie
                            </Button>
                        )}

                        {showImagePicker && !formData.iconUrl && (
                            <div className="mt-2 border border-slate-700 rounded-lg p-2 bg-slate-900/50">
                                <LocalImagePicker
                                    directory="achievements"
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

                    <div className="flex gap-2 pt-2">
                        <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 flex-1">
                            <Check className="w-4 h-4 mr-1" />
                            {editing ? "Mettre à jour" : "Créer"}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={resetForm}>
                            Annuler
                        </Button>
                    </div>
                </form>
            )}

            {/* Compact List */}
            <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-400">Chargement...</div>
                ) : challenges.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">Aucun challenge</div>
                ) : (
                    <div className="divide-y divide-slate-700/30">
                        {challenges.map((challenge) => (
                            <div key={challenge.id} className="flex items-center gap-3 p-3 hover:bg-slate-700/20 transition-colors">
                                {challenge.iconUrl && (
                                    <img
                                        src={challenge.iconUrl}
                                        alt={challenge.name}
                                        className="w-8 h-8 rounded bg-slate-900/50 p-1 flex-shrink-0"
                                    />
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-semibold text-white text-sm truncate">{challenge.name}</h4>
                                        <span className="text-xs px-1.5 py-0.5 bg-slate-700 rounded text-slate-400 font-mono">
                                            {challenge.slug}
                                        </span>
                                        {challenge.difficulty && (
                                            <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${challenge.difficulty >= 4 ? 'bg-red-500/20 text-red-400' :
                                                challenge.difficulty === 3 ? 'bg-yellow-500/20 text-yellow-400' :
                                                    'bg-green-500/20 text-green-400'
                                                }`}>
                                                D{challenge.difficulty}
                                            </span>
                                        )}
                                    </div>
                                    {challenge.description && (
                                        <p className="text-xs text-slate-400 truncate mt-0.5">{challenge.description}</p>
                                    )}
                                </div>
                                <div className="flex gap-1 flex-shrink-0">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => startEdit(challenge)}
                                        className="h-7 w-7 p-0 hover:bg-indigo-600/20"
                                    >
                                        <Edit2 className="w-3.5 h-3.5 text-indigo-400" />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDelete(challenge.id)}
                                        className="h-7 w-7 p-0 hover:bg-red-600/20"
                                    >
                                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
