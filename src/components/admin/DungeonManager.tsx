"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MultiSelect } from "@/components/ui/multi-select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
    getDungeonsWithAchievements,
    createDungeon,
    updateDungeon,
    deleteDungeon,
    getChallenges,
} from "@/server/actions/game-data-admin-actions";
import { ImageDownloader } from "./ImageDownloader";

// Types
interface Dungeon {
    id: string;
    name: string;
    bossName: string;
    level: number;
    dpnlUrl?: string | null;
    imageUrl?: string | null;
    isExpedition: boolean;
    expeditionModes?: string[] | null;
    expeditionMechanics?: string | null;
    achievements: { challengeId: string; challenge: { name: string; slug: string } }[];
}

interface Challenge {
    id: string;
    name: string;
    slug: string;
}

const EXPEDITION_MODES = [
    { label: "Bravoure", value: "BRAVOURE", color: 0xeab308 }, // Yellow
    { label: "Audace", value: "AUDACE", color: 0xef4444 },   // Red
    { label: "Normal", value: "NORMAL", color: 0x3b82f6 },   // Blue
];

export default function DungeonManager() {
    const [dungeons, setDungeons] = useState<Dungeon[]>([]);
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        bossName: "",
        level: 100,
        dpnlUrl: "",
        imageUrl: "",
        isExpedition: false,
        expeditionModes: [] as string[],
        expeditionMechanics: "",
        challengeIds: [] as string[],
    });

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        const [dungeonsRes, challengesRes] = await Promise.all([
            getDungeonsWithAchievements(),
            getChallenges()
        ]);

        if (dungeonsRes.success && dungeonsRes.data) {
            setDungeons(dungeonsRes.data);
        } else {
            toast.error(dungeonsRes.error || "Erreur chargement donjons");
        }

        if (challengesRes.success && challengesRes.data) {
            setChallenges(challengesRes.data);
        }

        setLoading(false);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        // Validation simple
        if (!formData.name || !formData.bossName) {
            toast.error("Nom et Boss requis");
            return;
        }

        const payload = {
            ...formData,
            // Ensure expedition modes is undefined if not expedition
            expeditionModes: formData.isExpedition ? formData.expeditionModes : undefined,
            expeditionMechanics: formData.isExpedition ? formData.expeditionMechanics : undefined,
        } as any; // Type cast to avoid excessive TS strictness with the exact Enum types on client side

        const result = editing
            ? await updateDungeon(editing, payload)
            : await createDungeon(payload);

        if (result.success) {
            toast.success(editing ? "Donjon mis à jour" : "Donjon créé");
            resetForm();
            loadData();
        } else {
            toast.error(result.error || "Erreur");
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Êtes-vous sûr de supprimer ce donjon ?")) return;

        const result = await deleteDungeon(id);
        if (result.success) {
            toast.success("Donjon supprimé");
            loadData();
        } else {
            toast.error(result.error || "Erreur de suppression");
        }
    }

    function resetForm() {
        setEditing(null);
        setFormData({
            name: "",
            bossName: "",
            level: 100,
            dpnlUrl: "",
            imageUrl: "",
            isExpedition: false,
            expeditionModes: [],
            expeditionMechanics: "",
            challengeIds: [],
        });
    }

    function startEdit(dungeon: Dungeon) {
        setEditing(dungeon.id);
        setFormData({
            name: dungeon.name,
            bossName: dungeon.bossName,
            level: dungeon.level,
            dpnlUrl: dungeon.dpnlUrl || "",
            imageUrl: dungeon.imageUrl || "",
            isExpedition: dungeon.isExpedition,
            expeditionModes: dungeon.expeditionModes || [],
            expeditionMechanics: dungeon.expeditionMechanics || "",
            challengeIds: dungeon.achievements.map(a => a.challengeId),
        });
    }

    // Helper options for MultiSelect
    const challengeOptions = challenges.map(c => ({
        label: c.name,
        value: c.id
    }));

    return (
        <div className="space-y-6">
            {/* Form */}
            <form onSubmit={handleSubmit} className="bg-slate-800/30 p-6 rounded-lg border border-slate-700/30 space-y-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-white">
                        {editing ? "✏️ Modifier le donjon" : "➕ Nouveau donjon"}
                    </h3>
                    <div className="flex items-center space-x-2 bg-slate-900/50 p-2 rounded-lg border border-slate-700">
                        <Switch
                            id="is-expedition"
                            checked={formData.isExpedition}
                            onCheckedChange={(checked) => setFormData({ ...formData, isExpedition: checked })}
                        />
                        <label htmlFor="is-expedition" className="text-sm font-medium text-white cursor-pointer">
                            Mode Expédition
                        </label>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Nom du Donjon <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                            className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Ex: Antre du Kralamoure Géant"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Nom du Boss <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.bossName}
                            onChange={(e) => setFormData({ ...formData, bossName: e.target.value })}
                            required
                            className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Ex: Kralamoure Géant"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Niveau
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="200"
                            value={formData.level}
                            onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 1 })}
                            className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                        Image Boss / Donjon
                    </label>
                    <ImageDownloader
                        imageUrl={formData.imageUrl}
                        type="dungeon"
                        identifier={formData.bossName || formData.name}
                        onImageDownloaded={(localPath) => setFormData({ ...formData, imageUrl: localPath })}
                    />
                </div>

                {/* Expedition Specific Fields */}
                {
                    formData.isExpedition && (
                        <div className="p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-lg space-y-4 animate-in fade-in slide-in-from-top-2">
                            <h4 className="text-sm font-semibold text-indigo-300 uppercase tracking-wider">Configuration Expédition</h4>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Modes Disponibles
                                </label>
                                <MultiSelect
                                    options={EXPEDITION_MODES}
                                    selected={formData.expeditionModes}
                                    onChange={(selected) => setFormData({ ...formData, expeditionModes: selected })}
                                    placeholder="Choisir les modes..."
                                    className="bg-slate-900/50"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Mécaniques & Notes
                                </label>
                                <textarea
                                    value={formData.expeditionMechanics}
                                    onChange={(e) => setFormData({ ...formData, expeditionMechanics: e.target.value })}
                                    rows={3}
                                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                    placeholder="Détails sur les mécaniques spécifiques..."
                                />
                            </div>
                        </div>
                    )
                }

                {/* Challenges Selection */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                        Succès / Challenges associés
                    </label>
                    <MultiSelect
                        options={challengeOptions}
                        selected={formData.challengeIds}
                        onChange={(selected) => setFormData({ ...formData, challengeIds: selected })}
                        placeholder="Sélectionner les succès..."
                        className="bg-slate-900/50"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                        Ces challenges seront proposés comme succès à valider pour ce donjon.
                    </p>
                </div>

                <div className="flex gap-3 pt-2">
                    <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
                        {editing ? "💾 Mettre à jour" : "➕ Créer le donjon"}
                    </Button>
                    {editing && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={resetForm}
                        >
                            ❌ Annuler
                        </Button>
                    )}
                </div>
            </form >

            {/* List */}
            < div className="bg-slate-800/30 rounded-lg border border-slate-700/30" >
                <div className="p-4 border-b border-slate-700/30 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-white">📋 Donjons ({dungeons.length})</h3>
                </div>

                {
                    loading ? (
                        <div className="p-8 text-center text-slate-400">Chargement...</div>
                    ) : dungeons.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">Aucun donjon créé</div>
                    ) : (
                        <div className="divide-y divide-slate-700/30 max-h-[800px] overflow-y-auto">
                            {dungeons.map((dungeon) => (
                                <div key={dungeon.id} className="p-4 hover:bg-slate-700/20 transition-colors">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-1">
                                                    {dungeon.imageUrl ? (
                                                        <img
                                                            src={dungeon.imageUrl}
                                                            alt={dungeon.bossName}
                                                            className="w-12 h-12 rounded object-cover border border-slate-700"
                                                        />
                                                    ) : (
                                                        <div className="w-12 h-12 rounded bg-slate-800 flex items-center justify-center text-2xl">
                                                            🏰
                                                        </div>
                                                    )}
                                                </div>

                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h4 className="font-semibold text-white">{dungeon.name}</h4>
                                                        <span className="text-xs px-2 py-0.5 bg-slate-800 rounded text-slate-300">
                                                            Lvl {dungeon.level}
                                                        </span>
                                                        {dungeon.isExpedition && (
                                                            <Badge variant="default" className="bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border-0">
                                                                EXPÉDITION
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    <p className="text-sm text-slate-400 mt-0.5">Boss: <span className="text-slate-200">{dungeon.bossName}</span></p>

                                                    {/* Badges for Expedition modes */}
                                                    {dungeon.isExpedition && dungeon.expeditionModes && dungeon.expeditionModes.length > 0 && (
                                                        <div className="flex gap-1 mt-2">
                                                            {dungeon.expeditionModes.map(mode => (
                                                                <span key={mode} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                                                    {mode}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Challenges list */}
                                                    {dungeon.achievements.length > 0 && (
                                                        <div className="mt-2 flex flex-wrap gap-1">
                                                            {dungeon.achievements.map(({ challenge }) => (
                                                                <span key={challenge.slug} className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-900/50 text-slate-500 border border-slate-800">
                                                                    {challenge.name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2 ml-4">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => startEdit(dungeon)}
                                                className="h-8 w-8 p-0"
                                            >
                                                ✏️
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleDelete(dungeon.id)}
                                                className="h-8 w-8 p-0 hover:bg-red-900/20 border-red-900/30 text-red-400"
                                            >
                                                🗑️
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                }
            </div >
        </div >
    );
}
